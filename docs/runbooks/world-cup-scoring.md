# Runbook: Fixing World Cup 2026 picks scoring in prod

You are on this page because someone reports their WC2026 picks are wrong:
points missing, leaderboard order looks off, a finished match isn't reflected,
or a user got points for a draw they didn't predict. This runbook walks you
through diagnosing and correcting that without taking the whole site down.

The same procedure applies to NFL picks; the queries differ only in which
table columns matter.

## 0. Before you do anything

WC scoring is **lazy on read**. Confidence-Picks does not have a game-completion
cron; `points` / `won` on `user_picks` is only written when a code path actually
reads that pick after `games.status = 'FINAL'`. Many "wrong" reports are
*expected NULL*s in rows nobody has fetched yet, not corruption.

Confirm the report is real:

- Does the user see wrong values **in the UI**, or are they only inferring
  from a leaderboard? Leaderboards aggregate; an aggregation bug is *not* a
  scoring bug — go straight to step 3.
- Has the ESPN side actually finalized the match (`status.type.completed = true`)?
  Check `https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard?dates=<YYYYMMDD>`.
  If ESPN hasn't called it final, your DB shouldn't either.

If both check out, proceed.

## 1. Diagnose

Connect to the **dev** Neon branch first (`DEV_DATABASE_URL` in `backend/.env`)
to reproduce. Only touch prod once you've confirmed the shape of the fix.

### Is the game row itself sane?

```sql
SELECT id, espn_id, league, stage, status, completed,
       home_team->>'displayName' AS home,
       home_score,
       away_team->>'displayName' AS away,
       away_score,
       winner_team_id,
       last_updated
FROM games
WHERE league = 'world_cup' AND espn_id = '<espn id>';
```

What "sane" looks like for a finished WC match:

- `status = 'FINAL'` AND `completed = true`
- `home_score` and `away_score` are non-null integers
- `winner_team_id` is the ESPN team id string of the winner — **or `null`
  for a true draw** in the group stage (knockouts never end in a draw post-PK;
  if you see `winner_team_id = null` in a knockout row, the row is broken)
- `stage` is one of `group`, `r32`, `r16`, `qf`, `sf`, `third`, `final`

If the row is stale, refresh it from ESPN before doing anything to picks:

```bash
# Forces the games-cache refresh for the affected stage.
curl -s "https://confidence-picks.com/api/games/world-cup-2026/stage/<stage>?refresh=true" | jq '.count'
```

### Are the picks scored?

```sql
-- All picks against this match, with computed scores.
SELECT up.id, up.user_id, u.email,
       up.picked_result, up.picked_team_id,
       up.won, up.points, up.updated_at
FROM user_picks up
JOIN users u ON u.id = up.user_id
WHERE up.game_id = (
  SELECT id FROM games WHERE league = 'world_cup' AND espn_id = '<espn id>'
)
ORDER BY up.updated_at DESC;
```

Common shapes you'll see:

| Symptom | Meaning |
|---|---|
| `picked_result` set, `won` and `points` null | Lazy-scoring never fired (no one read the pick post-final). Step 2A fixes this for one pick; step 2B fixes it for a whole match. |
| `picked_result` set, `won = true/false`, `points = NULL` | Bug — scoring partially applied. Step 2B. |
| `picked_result` set, `won = true`, `points` doesn't match expected scale | Logic bug, not a data bug. Stop, file an issue against `SoccerScoringService.scoreSoccerPick`, do **not** brute-force overwrite. |
| `picked_result` is null | The user never picked. Not a scoring issue. |

## 2. Fix

### 2A. One user, one match (cheapest)

If exactly one pick is wrong and the rest are fine, trigger the lazy-scoring
path by re-reading that pick. The simplest way is to hit the leaderboard
endpoint for that group:

```bash
curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
  "https://confidence-picks.com/api/groups/<identifier>/leaderboard"
```

That reads every member's picks for the group and writes the computed
`won`/`points` back per row. After it returns, re-run the diagnosis SELECT to
verify.

### 2B. Whole match or whole tournament (admin endpoint)

When more than a handful of picks are wrong — e.g. a match was finalized late
and a hundred picks are stuck at `NULL` — call the admin recompute endpoint:

```bash
curl -s -X POST -H "Authorization: Bearer $ADMIN_ACCESS_TOKEN" \
  "https://confidence-picks.com/api/admin/recalculate-scoring-temp"
```

What this does, in plain English:

- Walks every `games` row with `status = 'FINAL'`.
- For each, UPDATEs every `user_picks` row that pointed at that game, writing
  `won` and `points` based on whether the pick matched the recorded winner.
- Returns a JSON summary of how many rows it touched.

Constraints:

- **Auth required.** The bearer must be a user whose `email` is in the
  `ADMIN_EMAILS` env (comma-separated, set on the backend Vercel project).
  Unset `ADMIN_EMAILS` returns 503 by design.
- **It runs over ALL final games, not just WC.** That's slightly more work
  than needed but is idempotent: re-running it never produces a different
  result than running it once.
- **Today it scores NFL the NFL way and WC the NFL way.** Read carefully:
  the current admin endpoint computes `won = (picked_team_id = winner)` and
  `points = ±confidence_level`. That is wrong for WC2026 picks, which use
  `picked_result` ('home'|'away'|'draw') and `scoreSoccerPick` bucket-based
  points instead of confidence. **Do not use 2B as a blanket WC fix until the
  admin endpoint is taught about `league = 'world_cup'`.** Until then, prefer
  2A or 2C for WC scoring problems.

### 2C. Direct SQL for a single match's WC picks (surgical)

When 2A is too slow and 2B is unsafe for WC, write the picks directly. This
mirrors what `SoccerScoringService.scoreSoccerPick` would compute, but only
for one match:

```sql
WITH g AS (
  SELECT id, stage,
         CASE WHEN home_score > away_score THEN 'home'
              WHEN away_score > home_score THEN 'away'
              ELSE 'draw' END AS true_result
  FROM games
  WHERE league = 'world_cup' AND espn_id = '<espn id>' AND status = 'FINAL'
)
UPDATE user_picks up
SET won = (up.picked_result = g.true_result),
    -- Group stage = 1 point correct, 0 wrong. Knockouts = 2 points correct.
    -- See world-cup-picks-rules.md for the canonical scoring table; adjust
    -- here if the rule sheet changes.
    points = CASE
      WHEN up.picked_result IS NULL THEN NULL
      WHEN up.picked_result = g.true_result AND g.stage = 'group' THEN 1
      WHEN up.picked_result = g.true_result THEN 2
      ELSE 0
    END,
    updated_at = NOW()
FROM g
WHERE up.game_id = g.id
  AND up.picked_result IS NOT NULL;
```

**Wrap in a transaction. Run on dev first. Verify the row count.**

```sql
BEGIN;
-- (UPDATE statement above)
SELECT COUNT(*) FROM user_picks WHERE game_id = (SELECT id FROM g);  -- sanity
-- COMMIT;   -- ← uncomment after the count matches expectations
ROLLBACK;
```

## 3. Leaderboard / aggregate looks wrong but picks look right

If individual picks have correct `won` and `points` but the leaderboard
disagrees, the bug is in aggregation, not scoring. Check
`backend/src/services/SoccerScoringService.js` — specifically
`buildLeaderboard` (aggregation), `aggregateUserScore` (per-user roll-up),
and `tiebreakerComparator` (ordering). Reproduce in `backend/tests/worldCup.test.js`
(currently 24/24) before touching code; a regression here will cascade.

## 4. Rollback considerations

- **Vercel** rolls back code instantly (`vercel rollback <previous-deployment>`)
  but does not touch the DB. A bad admin-endpoint deploy can be reverted in
  ~30 seconds; the picks it overwrote stay overwritten.
- **Neon** has point-in-time recovery on the branch (retention varies by
  plan). Use this **only** for true corruption — it resets every write since
  the chosen instant, including legitimate ones. Take a `pg_dump` of the
  affected tables before invoking PITR so you can re-apply the legitimate
  rows by hand.
- The migration that added `league`, `stage`, `picked_result`, and
  `pool_type` (`backend/scripts/addWorldCupColumns.js`) is forward-only and
  has no down migration. If you absolutely need to remove those columns,
  write a one-off SQL script — do not roll the migration "back" in code.

## 5. Pre-flight before any of the above

1. `gh auth status` — confirm you're authenticated as the admin account.
2. Verify the env: `vercel env ls production` and look for `ADMIN_EMAILS`.
   If it's missing, set it *before* calling the admin endpoint, otherwise
   you'll just get 503s.
3. Run the diagnosis query (§1) and screenshot the result for the incident
   record. You'll want the pre-fix state when writing the postmortem.

## 6. After you fix it

- Re-run the diagnosis query and screenshot the post-fix state.
- Open an incident issue with both screenshots, the SQL/HTTP commands you ran,
  and the symptom that triggered the page. Tag it `area:scoring`.
- If the fix was 2C (direct SQL), open a follow-up to teach
  `/admin/recalculate-scoring-temp` about `league = 'world_cup'` so the next
  occurrence is 2B-fixable, not 2C-fixable.
