# Knockout Score-Prediction Bonus Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let World Cup members optionally predict knockout-match final scores for 0–2 bonus points on top of the existing 3/0 advance pick, surfaced on the leaderboard, the on-page rules, an in-app tooltip, and the written rules — with a local dummy-data build for hands-on testing.

**Architecture:** A new pure scoring function in `SoccerScoringService` computes the bonus; two nullable columns on `user_picks` (self-healed, no `INIT_DB`) persist predictions; the WC picks API threads predicted scores through both the self and admin write/read paths; the leaderboard payload gains `bonus_points` and the snapshot cache is invalidated once via a `SCORING_VERSION` bump; the frontend adds optional score inputs on knockout pick rows, a first-visit tooltip, an on-page rules line, and a Bonus leaderboard column (with draw columns hidden for knockout-only groups).

**Tech Stack:** Node ESM + Express + PostgreSQL (`node --test`); React 18 + TS + Vitest + Playwright (run on Node 20 via `nvm use 20`, binaries at `node_modules/.bin/*`).

## Global Constraints

- **Spec is the source of truth:** `docs/superpowers/specs/2026-06-26-knockout-score-bonus-design.md`. The exact/off-by-one/mirror rule and the reference table are binding.
- **Bonus rule:** +2 exact `(ph===ah && pa===aa)`; +1 if L1 `|ph-ah|+|pa-aa| === 1` OR mirror `(ph===aa && pa===ah)` and not exact; else 0. Only when the knockout game is FINAL and both predicted scores are present. Actual score = `homeScore`/`awayScore` (on-field, excludes PK kicks).
- **Additive only:** do NOT remove/weaken existing tests. Backend full suite (`cd backend && NODE_ENV=test npm test` with docker DB up) and frontend (`vitest run` + e2e on Node 20) must stay green.
- **No `INIT_DB`:** new columns self-heal on the pick write path, mirroring `Group.ensureKnockoutOnlyColumn`.
- **Rules copy must match across three surfaces:** the on-page `<li>`, the tooltip popover, and `frontend/docs/world-cup-picks-rules.md`.
- **Two write paths + two read paths:** the predicted-score plumbing applies to BOTH `POST .../world-cup` (self, `worldCupPicks.js:44`) and `POST .../world-cup/user/:userId` (admin, `:316`), and BOTH `GET .../world-cup/me` (`:162`) and `GET .../world-cup/user/:userId` (`:263`).

## File Structure

- **Modify** `backend/src/services/SoccerScoringService.js` — `scoreKnockoutScoreBonus`, `bonus_points` in aggregate/leaderboard rows, `SCORING_VERSION`.
- **Modify** `backend/src/services/WorldCupLeaderboardService.js` — include `SCORING_VERSION` in `buildVersionString`; carry `bonus_points` through `buildGroupLeaderboard`.
- **Modify** `backend/src/database/schema.sql` — inline columns + idempotent block.
- **Modify** `backend/src/models/UserPick.js` — `buildWorldCupUpsert` writes the two columns; add `ensureScorePredictionColumns` self-heal called on the upsert path.
- **Modify** `backend/src/routes/worldCupPicks.js` — validate + thread predicted scores on both POST paths; return them on both GET paths; add `bonus_points` to the leaderboard payload; select predicted scores in the leaderboard pick query.
- **Modify** `backend/src/mocks/espnWorldCupData.js` — add upcoming (SCHEDULED) knockout fixtures for local testing.
- **Modify** `frontend/src/lib/types.ts` — `MatchPick`/draft + `TournamentLeaderboardRow` gain score/bonus fields.
- **Modify** `frontend/src/lib/worldCupService.js` — submit sends predicted scores; my-picks parses them.
- **Modify** `frontend/src/designsystem/components/MatchPickRow/MatchPickRow.tsx` — score inputs + tooltip affordance.
- **Modify** `frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx` — score draft + submit + hydrate + rules `<li>`.
- **Create** `frontend/src/designsystem/components/ScoreBonusTooltip/` (or inline) — first-visit popover.
- **Modify** `frontend/src/designsystem/components/TournamentLeaderboard/TournamentLeaderboard.tsx` — Bonus column + conditional draw columns + `knockoutOnly` prop.
- **Modify** `frontend/src/pages/GroupDetails/WorldCupLeaderboardTab.tsx` + `frontend/src/pages/GroupDetailsPage.tsx` — thread `knockoutOnly`.
- **Modify** `frontend/docs/world-cup-picks-rules.md` — Score-Prediction Bonus section.

---

### Task 1: Score-bonus scoring (pure)

**Files:**
- Modify: `backend/src/services/SoccerScoringService.js`
- Test: `backend/tests/soccer-scoring-bonus.test.js` (create)

**Interfaces:**
- Produces:
  - `scoreKnockoutScoreBonus(pick, game) => 0|1|2` — `pick.predicted_home_score`/`predicted_away_score` are integers or null; game must be knockout + FINAL.
  - `aggregateUserScore` rows gain `bonus_points: number`; `buildLeaderboard` rows include `bonus_points`.
  - `export const SCORING_VERSION` (string, e.g. `'2'`).

- [ ] **Step 1: Write the failing test** — `backend/tests/soccer-scoring-bonus.test.js`:

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { scoreKnockoutScoreBonus, aggregateUserScore, SCORING_VERSION } from '../src/services/SoccerScoringService.js';

const ko = (homeScore, awayScore, extra = {}) => ({
  stage: 'r16', status: 'FINAL', homeScore, awayScore,
  homeTeam: { id: 'H' }, awayTeam: { id: 'A' }, winnerTeamId: 'H', ...extra,
});
const pred = (h, a) => ({ predicted_home_score: h, predicted_away_score: a, picked_result: 'home' });

describe('scoreKnockoutScoreBonus (actual 3-2)', () => {
  const g = ko(3, 2);
  test('exact = 2', () => assert.equal(scoreKnockoutScoreBonus(pred(3, 2), g), 2));
  test('one off (3-3, 2-2, 4-2, 3-1) = 1', () => {
    for (const [h, a] of [[3,3],[2,2],[4,2],[3,1]]) assert.equal(scoreKnockoutScoreBonus(pred(h, a), g), 1, `${h}-${a}`);
  });
  test('mirror 2-3 = 1', () => assert.equal(scoreKnockoutScoreBonus(pred(2, 3), g), 1));
  test('both off / far (4-3, 2-1, 1-0) = 0', () => {
    for (const [h, a] of [[4,3],[2,1],[1,0]]) assert.equal(scoreKnockoutScoreBonus(pred(h, a), g), 0, `${h}-${a}`);
  });
});

describe('scoreKnockoutScoreBonus edge cases', () => {
  test('PK-game draw: exact 1-1 = 2, 2-1 = 1', () => {
    const g = ko(1, 1, { winnerTeamId: 'A' });
    assert.equal(scoreKnockoutScoreBonus(pred(1, 1), g), 2);
    assert.equal(scoreKnockoutScoreBonus(pred(2, 1), g), 1);
  });
  test('no prediction = 0', () => assert.equal(scoreKnockoutScoreBonus({ picked_result: 'home' }, ko(3, 2)), 0));
  test('group stage = 0', () => assert.equal(scoreKnockoutScoreBonus(pred(3, 2), { stage: 'group', status: 'FINAL', homeScore: 3, awayScore: 2 }), 0));
  test('not final = 0', () => assert.equal(scoreKnockoutScoreBonus(pred(3, 2), ko(0, 0, { status: 'SCHEDULED' })), 0));
});

describe('aggregateUserScore includes bonus_points', () => {
  test('advance correct (3) + exact score (2) = 5, bonus_points 2', () => {
    const row = aggregateUserScore([{ pick: pred(3, 2), game: ko(3, 2) }]);
    assert.equal(row.points, 5);
    assert.equal(row.bonus_points, 2);
  });
});

test('SCORING_VERSION is exported', () => assert.equal(typeof SCORING_VERSION, 'string'));
```

- [ ] **Step 2: Run — expect FAIL** (`scoreKnockoutScoreBonus`/`SCORING_VERSION` undefined):
Run: `cd backend && node --test tests/soccer-scoring-bonus.test.js`

- [ ] **Step 3: Implement** in `SoccerScoringService.js`. Add near the top (after `BUCKETS`):

```javascript
// Bump whenever scoring logic changes so the leaderboard cache invalidates once
// (see WorldCupLeaderboardService.buildVersionString). '1' = pre-bonus; '2' = score bonus.
export const SCORING_VERSION = '2';
```

Add the function (after `scoreSoccerPick`):

```javascript
/**
 * Optional knockout score-prediction bonus, independent of the advance pick and
 * the actual winner. Compares the predicted scoreline to the on-field score
 * (homeScore/awayScore — excludes PK kicks). +2 exact; +1 if off by one goal
 * (L1 distance 1) OR the exact mirror (right scoreline, teams flipped); else 0.
 * Returns 0 for non-knockout, non-final, or missing-prediction inputs.
 */
export function scoreKnockoutScoreBonus(pick, game) {
  if (!isKnockoutStage(game?.stage)) return 0;
  if (!isFinal(game)) return 0;
  const ph = pick?.predicted_home_score;
  const pa = pick?.predicted_away_score;
  if (ph == null || pa == null) return 0;
  const ah = Number(game.homeScore ?? 0);
  const aa = Number(game.awayScore ?? 0);
  if (ph === ah && pa === aa) return 2;                 // exact
  if (Math.abs(ph - ah) + Math.abs(pa - aa) === 1) return 1; // off by one goal
  if (ph === aa && pa === ah) return 1;                 // mirror (teams flipped)
  return 0;
}
```

In `aggregateUserScore`, initialize `bonus_points: 0` in `row`, and inside the loop add after the base scoring:

```javascript
    const bonus = scoreKnockoutScoreBonus(pick, game);
    if (bonus > 0) { row.points += bonus; row.bonus_points += bonus; }
```

(`isFinal` and `isKnockoutStage` already exist in this module.) `buildLeaderboard` spreads `aggregateUserScore` output, so `bonus_points` flows through automatically — confirm the returned rows include it.

- [ ] **Step 4: Run — expect PASS:** `cd backend && node --test tests/soccer-scoring-bonus.test.js`
- [ ] **Step 5: Regression:** `cd backend && node --test tests/soccer-scoring.test.js` (existing scoring tests unchanged).
- [ ] **Step 6: Commit:**
```bash
git add backend/src/services/SoccerScoringService.js backend/tests/soccer-scoring-bonus.test.js
git commit -m "feat(wc): knockout score-prediction bonus scoring + SCORING_VERSION"
```

---

### Task 2: Persist predicted scores (schema + self-heal + upsert)

**Files:**
- Modify: `backend/src/database/schema.sql`
- Modify: `backend/src/models/UserPick.js`
- Test: `backend/tests/userpick-score-prediction.test.js` (create)

**Interfaces:**
- Consumes: nothing from Task 1.
- Produces:
  - `user_picks.predicted_home_score INT NULL`, `predicted_away_score INT NULL`.
  - `buildWorldCupUpsert({ ... picks })` where each pick may carry `predictedHomeScore`/`predictedAwayScore` (ints or undefined/null) → persisted (null when absent).
  - `UserPick.ensureScorePredictionColumns()` (static, latched) — self-heals the columns; called at the top of `bulkUpsertWorldCupPicks`.

- [ ] **Step 1: Schema** — add to the `user_picks` CREATE TABLE column list in `schema.sql`: `predicted_home_score INTEGER NULL,` and `predicted_away_score INTEGER NULL,`. Append an idempotent block:
```sql
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_picks' AND column_name='predicted_home_score') THEN
    ALTER TABLE user_picks ADD COLUMN predicted_home_score INTEGER NULL;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='user_picks' AND column_name='predicted_away_score') THEN
    ALTER TABLE user_picks ADD COLUMN predicted_away_score INTEGER NULL;
  END IF;
END $$;
```

- [ ] **Step 2: Write the failing test** — `backend/tests/userpick-score-prediction.test.js`:

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildWorldCupUpsert } from '../src/models/UserPick.js';

describe('buildWorldCupUpsert with predicted scores', () => {
  test('includes predicted score columns and values (null when absent)', () => {
    const { sql, values } = buildWorldCupUpsert({
      userId: 1, groupId: 2, season: 2026, seasonType: 1, week: 1,
      picks: [
        { gameId: 10, pickedResult: 'home', predictedHomeScore: 3, predictedAwayScore: 2 },
        { gameId: 11, pickedResult: 'away' },
      ],
    });
    assert.match(sql, /predicted_home_score/);
    assert.match(sql, /predicted_away_score/);
    assert.match(sql, /predicted_home_score = EXCLUDED\.predicted_home_score/);
    // row 1 carries 3/2, row 2 carries null/null
    assert.deepEqual(values.slice(0, 9), [1, 2, 10, 'home', 1, 2026, 1, 3, 2]);
    assert.deepEqual(values.slice(9), [1, 2, 11, 'away', 1, 2026, 1, null, null]);
  });
});
```

- [ ] **Step 3: Run — expect FAIL.** `cd backend && node --test tests/userpick-score-prediction.test.js`

- [ ] **Step 4: Implement `buildWorldCupUpsert`** — extend from 7 to 9 columns. New body:

```javascript
export function buildWorldCupUpsert({ userId, groupId, season, seasonType, week, picks }) {
  const values = [];
  const placeholders = picks.map((p, i) => {
    if (p.gameId == null) throw new Error('World Cup pick missing gameId');
    if (!WORLD_CUP_RESULTS.includes(p.pickedResult)) {
      throw new Error(`Invalid picked_result: ${p.pickedResult}`);
    }
    const ph = p.predictedHomeScore == null ? null : p.predictedHomeScore;
    const pa = p.predictedAwayScore == null ? null : p.predictedAwayScore;
    const base = i * 9;
    values.push(userId, groupId, p.gameId, p.pickedResult, week, season, seasonType, ph, pa);
    return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9})`;
  }).join(',');

  const sql = `INSERT INTO user_picks (user_id, group_id, game_id, picked_result, week, season, season_type, predicted_home_score, predicted_away_score)
         VALUES ${placeholders}
         ON CONFLICT (user_id, group_id, game_id) DO UPDATE SET
                   picked_result = EXCLUDED.picked_result,
                   picked_team_id = NULL,
                   confidence_level = NULL,
                   week = EXCLUDED.week,
                   season = EXCLUDED.season,
                   season_type = EXCLUDED.season_type,
                   predicted_home_score = EXCLUDED.predicted_home_score,
                   predicted_away_score = EXCLUDED.predicted_away_score,
                   updated_at = NOW()
                 RETURNING *`;
  return { sql, values };
}
```

- [ ] **Step 5: Add `ensureScorePredictionColumns`** (mirror `Group.ensureKnockoutOnlyColumn`) on the `UserPick` class with a static `_scoreColumnsEnsured = false` latch; it runs the two `ADD COLUMN IF NOT EXISTS` ALTERs when missing, latches on success, does not latch on failure. Call `await UserPick.ensureScorePredictionColumns()` at the top of `bulkUpsertWorldCupPicks` (before the upsert query). Add a focused self-heal test mirroring `backend/tests/groups-ensure-column.test.js` (missing→adds, present→no-op, latch, failure-no-latch) in the same test file.

- [ ] **Step 6: Run new tests — expect PASS.** `cd backend && node --test tests/userpick-score-prediction.test.js`
- [ ] **Step 7: DB regression** — bring up the docker test DB, re-init, run the upsert against it (the existing `userpick-worldcup.test.js` + full suite):
```bash
cd backend && docker compose -f docker-compose.test.yml up -d && sleep 3 && NODE_ENV=test npm run db:init && NODE_ENV=test npm test 2>&1 | grep -E "^ℹ (pass|fail)"
```
Expected: `fail 0`.
- [ ] **Step 8: Commit.**
```bash
git add backend/src/database/schema.sql backend/src/models/UserPick.js backend/tests/userpick-score-prediction.test.js
git commit -m "feat(wc): persist predicted knockout scores (columns + self-heal + upsert)"
```

---

### Task 3: WC picks API — accept/return predicted scores (both paths)

**Files:**
- Modify: `backend/src/routes/worldCupPicks.js`
- Test: `backend/tests/worldcup-picks-route.test.js` (extend)

**Interfaces:**
- Consumes: `buildWorldCupUpsert` predicted-score params (Task 2).
- Produces: POST accepts `predictedHomeScore`/`predictedAwayScore` per pick (validated); GET me/user return them.

- [ ] **Step 1: Add a validation helper + thread through both POST handlers.** In each POST handler (`:44` self, `:316` admin), after the existing `pickedResult` validation loop, validate predicted scores per pick:
  - If exactly one of `predictedHomeScore`/`predictedAwayScore` is present → 400 `{ error: 'Both predicted scores required together', gameId }`.
  - If present: must be integers `0 ≤ n ≤ 20` → else 400 `{ error: 'Predicted score must be a whole number between 0 and 20', gameId }`.
  - Only keep predicted scores for knockout games: when building the `picks` array passed to `UserPick.bulkUpsertWorldCupPicks`, look up the game's `stage` (already selected in the `SELECT … stage FROM games …` query at `:74`/`:357`) and pass `predictedHomeScore`/`predictedAwayScore` only when `KNOCKOUT_STAGES` includes the stage; otherwise pass null. (Import `isKnockoutStage` from `SoccerScoringService` or inline the stage set.)
  - The kickoff-lock filter (`game_date <= now`) already drops the whole pick — scores ride along, so no extra lock logic.
- [ ] **Step 2: Return predicted scores on both GET handlers** (`:162` me, `:263` user): add `up.predicted_home_score, up.predicted_away_score` to the SELECT and map `predictedHomeScore`/`predictedAwayScore` into each returned pick object.
- [ ] **Step 3: Tests** — extend `worldcup-picks-route.test.js`: a POST with a knockout pick + scores persists them (assert the stub `bulkUpsertWorldCupPicks` received them); one-sided score → 400; out-of-range → 400; group-stage game ignores scores (passes null); GET me returns the predicted scores. Mirror the file's existing harness (stubbed auth + `UserPick`/`pool`).
- [ ] **Step 4: Run — expect PASS,** then full suite (docker DB up) `fail 0`.
- [ ] **Step 5: Commit.** `git commit -m "feat(wc): accept + return knockout predicted scores on pick routes"`

---

### Task 4: Leaderboard payload + cache version

**Files:**
- Modify: `backend/src/routes/worldCupPicks.js` (leaderboard route `:202`)
- Modify: `backend/src/services/WorldCupLeaderboardService.js`
- Test: `backend/tests/worldcup-leaderboard-service.test.js` (extend), `backend/tests/worldcup-picks-route.test.js`

**Interfaces:**
- Consumes: `bonus_points` from `buildLeaderboard` (Task 1); `SCORING_VERSION` (Task 1).
- Produces: leaderboard rows carry `bonus_points`; `buildVersionString` includes `SCORING_VERSION`.

- [ ] **Step 1: Pick query** — the leaderboard route's pick query (the `SELECT user_id, game_id, picked_result FROM user_picks …`) must also select `predicted_home_score, predicted_away_score`, and the `scoringRows` it builds must put them on `pick` (so `scoreKnockoutScoreBonus` sees them).
- [ ] **Step 2: Payload** — the leaderboard row mapping must include `bonus_points: row.bonus_points` (the `buildGroupLeaderboard` output already carries it once Task 1 lands; confirm `buildGroupLeaderboard` in `WorldCupLeaderboardService` passes it through the row shape).
- [ ] **Step 3: Cache version** — in `WorldCupLeaderboardService.buildVersionString`, add a `scoringVersion` component sourced from `SoccerScoringService.SCORING_VERSION` so the string changes when scoring changes. Update `getLeaderboardVersion` to pass it. Add a unit test: `buildVersionString` differs when `scoringVersion` differs.
- [ ] **Step 4: Tests** — extend the service test (bonus_points in `buildGroupLeaderboard` output; version includes scoring version) and the route test (leaderboard payload includes `bonus_points`). Run; full suite `fail 0`.
- [ ] **Step 5: Commit.** `git commit -m "feat(wc): leaderboard bonus_points + SCORING_VERSION cache invalidation"`

---

### Task 5: Frontend pick entry — score inputs + draft + submit + hydrate

**Files:**
- Modify: `frontend/src/lib/types.ts`, `frontend/src/lib/worldCupService.js`
- Modify: `frontend/src/designsystem/components/MatchPickRow/MatchPickRow.tsx`
- Modify: `frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx`
- Test: `MatchPickRow.test.tsx`, `WorldCupPicksTab.test.tsx` (extend)

**Interfaces:**
- Consumes: API predicted-score fields (Tasks 2–3).
- Produces: `MatchPick` gains optional `predictedHomeScore?`/`predictedAwayScore?`; `MatchPickRow` renders two optional score inputs for editable knockout matches and reports changes; submit payload + my-picks hydration carry them.

- [ ] **Step 1: Types** — `MatchPick` (and the draft entry) gains `predictedHomeScore?: number | null`, `predictedAwayScore?: number | null`.
- [ ] **Step 2: MatchPickRow** — for `match.isKnockout && editable`, render two small number inputs (labeled by home/away team abbreviation), controlled by new props `predictedHomeScore`/`predictedAwayScore` + `onScoreChange(matchId, 'home'|'away', value)`. Hidden for group-stage; read-only display when locked. Add a test: knockout editable row shows two score inputs; group-stage row does not; locked row shows them read-only.
- [ ] **Step 3: WorldCupPicksTab** — extend the draft to carry per-game predicted scores (a parallel `scoreDraft: Record<number, { home?: number; away?: number }>` or fold into the draft entry). Wire `onScoreChange`. Include `predictedHomeScore`/`predictedAwayScore` in the `picks` submit array for knockout games. Hydrate from `GET …/me` (which now returns them). Add tests: submitting a knockout pick with a score includes it in the payload; hydration pre-fills the inputs.
- [ ] **Step 4: worldCupService** — `submitWorldCupPicks` forwards the new fields in the POST body; `getMyWorldCupPicks` maps them onto returned picks.
- [ ] **Step 5: Run** `vitest run` (Node 20) for the two components; full frontend unit suite green.
- [ ] **Step 6: Commit.** `git commit -m "feat(wc): knockout score-prediction inputs + submit/hydrate"`

---

### Task 6: First-visit tooltip + on-page rules line

**Files:**
- Modify: `frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx` (rules `<li>` + tooltip mount)
- Create: `frontend/src/designsystem/components/ScoreBonusTooltip/ScoreBonusTooltip.tsx` (+ test) — or an inline popover
- Test: `ScoreBonusTooltip.test.tsx`, `WorldCupPicksTab.test.tsx`

**Interfaces:**
- Produces: a dismissible popover, auto-shown once (localStorage `wc-score-bonus-tooltip-seen`), available via an ℹ️ affordance; a rules `<li>` in the existing `<ul>`.

- [ ] **Step 1: Rules `<li>`** — add to the rules-box `<ul>` in `WorldCupPicksTab` (shown for all WC groups, after the Knockout line), copy verbatim from the spec: *"Knockout score bonus (optional): predict the final score for extra points — exact score = +2; off by one goal, or the right scoreline with the teams flipped = +1. PK shootouts count as a draw score."* Test: the `<li>` text renders.
- [ ] **Step 2: Tooltip** — `ScoreBonusTooltip` reads/sets `localStorage['wc-score-bonus-tooltip-seen']`: auto-open on first mount (when the WC knockout view is shown), dismiss button sets the flag, and an ℹ️ button re-opens it. Tests: first render shows it and sets the flag; with the flag set it stays closed until the ℹ️ is clicked. Mount it near the rules box / score inputs in `WorldCupPicksTab`.
- [ ] **Step 3: Run** vitest for both; commit. `git commit -m "feat(wc): score-bonus first-visit tooltip + on-page rules line"`

---

### Task 7: Leaderboard display — Bonus column + hide draws for knockout-only

**Files:**
- Modify: `frontend/src/designsystem/components/TournamentLeaderboard/TournamentLeaderboard.tsx`
- Modify: `frontend/src/lib/types.ts` (`TournamentLeaderboardRow` gains `bonus_points`)
- Modify: `frontend/src/pages/GroupDetails/WorldCupLeaderboardTab.tsx`, `frontend/src/pages/GroupDetailsPage.tsx`
- Test: `TournamentLeaderboard.test.tsx` (extend)

**Interfaces:**
- Consumes: leaderboard `bonus_points` (Task 4); group `knockoutOnly` flag.
- Produces: `TournamentLeaderboard` accepts `knockoutOnly?: boolean`; renders a **Bonus** column; omits the two draw columns when `knockoutOnly`.

- [ ] **Step 1: Type** — `TournamentLeaderboardRow` gains `bonus_points: number`.
- [ ] **Step 2: Component** — add `knockoutOnly?: boolean` prop. Add a "Bonus" header + per-row `{row.bonus_points}` cell. Wrap the two draw `<th>`/`<td>` (Draws Correct, Draws Incorrect) in `{!knockoutOnly && (…)}`. Tests: bonus column shows the value; with `knockoutOnly` the two draw columns are absent; without it they're present.
- [ ] **Step 3: Thread the prop** — `GroupDetailsPage` passes `knockoutOnly={group?.knockoutOnly ?? false}` to `WorldCupLeaderboardTab`, which forwards it to `TournamentLeaderboard`. Update the leaderboard tab test to pass/forward it.
- [ ] **Step 4: Run** vitest; commit. `git commit -m "feat(wc): leaderboard Bonus column + hide draw columns for knockout-only"`

---

### Task 8: Written rules doc + mock dummy data + local build

**Files:**
- Modify: `frontend/docs/world-cup-picks-rules.md`
- Modify: `backend/src/mocks/espnWorldCupData.js`
- Create: `docs/superpowers/plans/2026-06-26-knockout-score-bonus-runbook.md` is unnecessary — local-run steps live here.

- [ ] **Step 1: Rules doc** — add a "Score-Prediction Bonus (Knockout)" section before Tiebreakers: the optional/independent framing, the exact/off-by-one/mirror rule with the reference table from the spec, and the PK/ET score handling. Note the knockout-only leaderboard column omission. Keep wording consistent with the on-page `<li>` and the tooltip.
- [ ] **Step 2: Mock data** — add **upcoming (SCHEDULED, future-dated)** knockout fixtures to `generateKnockoutSlate` (e.g. a future `r16` Norway vs France and a future `qf`), with `status: 'SCHEDULED'` and a `gameDate` a few days out and both teams assigned, so a local tester can enter score predictions. Keep the existing FINAL fixtures so the leaderboard shows earned bonus. (No automated test required beyond the suite staying green; verify the mock stage still parses.)
- [ ] **Step 3: Local build (manual, done at PR time)** — document + run:
  ```bash
  # Terminal 1 (backend, mock data)
  cd backend && USE_MOCK_ESPN=true npm run dev   # :3001
  # Terminal 2 (frontend)
  cd frontend && (nvm use 20) && npm run dev      # :5173 -> auto-targets :3001
  # Browser: log in, open a World Cup group's Picks tab, pick a knockout game + enter a score, submit;
  # check the Leaderboard tab's Bonus column.
  ```
  Confirm the experience end-to-end before opening the PR; include these steps in the PR description so the reviewer can reproduce.
- [ ] **Step 4: Commit.** `git commit -m "docs(wc): score-bonus rules + upcoming knockout mock fixtures"`

---

## Self-Review notes
- **Spec coverage:** scoring rule (T1), columns/self-heal (T2), API both paths (T3), leaderboard payload + cache version (T4), pick UI + submit/hydrate (T5), tooltip + on-page rules (T6), leaderboard column + hidden draws (T7), written rules + mock data + local build (T8). All covered.
- **Type consistency:** `predictedHomeScore`/`predictedAwayScore` (camelCase API/FE) vs `predicted_home_score`/`predicted_away_score` (snake DB) used consistently; `bonus_points` (snake, matches existing row fields) on rows + `TournamentLeaderboardRow`; `SCORING_VERSION` string throughout.
- **Verify-before-build:** T2/T3 reference existing symbols to confirm at implementation time — `Group.ensureKnockoutOnlyColumn` (self-heal template), the two `SELECT … stage FROM games` queries, and `buildGroupLeaderboard`'s row shape.
- **Two-path reminder:** T3 + T5 must cover BOTH self and admin write/read paths.
