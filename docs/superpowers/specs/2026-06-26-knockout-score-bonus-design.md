# Knockout Score-Prediction Bonus — Design Spec

**Date:** 2026-06-26
**Status:** Approved (design); pending implementation plan.

## Goal

For World Cup 2026 groups, let members optionally predict the **final score** of each **knockout-stage** match to earn bonus points on top of the existing advance pick. The base game is unchanged: pick the advancing team → 3 points, wrong → 0. The score prediction is a separate, optional add-on worth 0–2 extra points, independent of who actually advances. The leaderboard, the on-page rules, an in-app tooltip, and the written rules doc all reflect this.

## Scoring rule

Per knockout match, total = **base** (advance pick: 3 or 0) + **bonus** (score prediction: 0/1/2).

The bonus compares the predicted scoreline `(pred_home, pred_away)` to the **actual on-field score** `(home, away)` — the 90'/extra-time score, **excluding penalty-shootout kicks**. A PK-decided match therefore has a level actual score (e.g. 1–1); the advancing side is tracked separately by `winnerTeamId` and does not affect the bonus.

- **+2** — exact: `pred_home === home && pred_away === away`.
- **+1** — either:
  - **off by one goal:** L1 distance `|pred_home − home| + |pred_away − away| === 1` (exactly one team off by one, the other exact); **or**
  - **right scoreline, wrong teams (mirror):** `pred_home === away && pred_away === home` (and not exact).
- **+0** — anything else.

Reference table for **actual 3–2**:

| Predicted | Bonus | Why |
|---|---|---|
| 3–2 | +2 | exact |
| 3–3, 2–2, 4–2, 3–1 | +1 | one team off by one |
| 2–3 | +1 | right scoreline, teams flipped |
| 4–3, 2–1 | 0 | both teams off (L1 = 2), not a mirror |
| 1–0 | 0 | not close |

Notes:
- A draw's mirror is itself, so PK-game draws have no special case: exact 1–1 = +2, and 2–1 / 0–1 / 1–0 = +1.
- The bonus is computed only when the match is FINAL (a definite on-field score exists). It is independent of `winnerTeamId` resolution — the score is known even on an as-yet-unresolved PK game.
- The advance pick must exist for the row to score the base 3/0; the bonus is computed independently when a predicted score is present (an add-on, not gated on the base pick being correct).

## Data model

Two nullable columns on `user_picks`:
- `predicted_home_score INTEGER NULL`
- `predicted_away_score INTEGER NULL`

Set only for knockout picks; null everywhere else (group stage, NFL). Applied via the established **self-heal pattern** (a `Group`/`UserPick`-style `ensure…Columns()` that runs `ALTER TABLE user_picks ADD COLUMN IF NOT EXISTS …`, latched, on the pick write path) so production migrates with **no `INIT_DB` toggle and no manual SQL** — mirroring `ensureKnockoutOnlyColumn` / `ensureMaxMembersConstraint`. The inline `schema.sql` definition + idempotent block are updated too for fresh DBs and the `db:init` path.

## Scoring service (`backend/src/services/SoccerScoringService.js`)

- New pure function `scoreKnockoutScoreBonus(pick, game) → 0 | 1 | 2`:
  - Returns 0 unless `isKnockoutStage(game.stage)`, the game `isFinal`, and both `pick.predicted_home_score` / `predicted_away_score` are present (non-null).
  - Else applies the exact / off-by-one / mirror rule above against `game.homeScore` / `game.awayScore`.
- `aggregateUserScore` adds the bonus to `points` **and** accumulates a new `bonus_points` field (initialized 0). The base bucket counts (`wins_correct` etc.) are unchanged — bonus is not bucketed.
- `buildLeaderboard` rows gain `bonus_points`. `tiebreakerComparator` is **unchanged** (sort by total `points`, then the four existing counts; `bonus_points` is display-only).
- `SCORING_VERSION` constant (exported) bumped whenever scoring changes.

## Leaderboard cache invalidation

The snapshot cache's version watermark captures *data* changes (finalization / membership / picks) but not *code* changes. To avoid serving boards computed by the old scorer after deploy, `buildVersionString` (in `WorldCupLeaderboardService`) includes `SoccerScoringService.SCORING_VERSION`. Bumping it on this change makes every snapshot's `source_version` differ once → a single clean recompute. Cheap and robust.

## API

- `POST /api/picks/group/:groupId/world-cup` accepts, per pick, optional `predictedHomeScore` / `predictedAwayScore`. Validation:
  - Both present or both absent (reject one-without-the-other).
  - Non-negative integers within a sane cap (e.g. 0–20).
  - Only meaningful for knockout games. For non-knockout games any supplied scores are **ignored** (not stored) so group-stage rows are never affected.
  - The existing **kickoff lock** (`game_date <= now` drops the pick) applies to the whole row, so a started match's score prediction is frozen too.
- `UserPick.bulkUpsertWorldCupPicks` writes the two new columns.
- `GET .../world-cup/me` returns `predictedHomeScore` / `predictedAwayScore` so the picker hydrates saved predictions.
- The leaderboard route payload (`worldCupPicks.js` GET leaderboard) includes `bonus_points` per row.

## Frontend

### Pick entry (`MatchPickRow` + `WorldCupPicksTab`)
- For **knockout** matches that are **editable** (not started, teams assigned), `MatchPickRow` renders two small optional number inputs — home-team score and away-team score, labeled by team abbreviation — alongside the existing advance buttons. Group-stage rows are untouched. When locked, the saved prediction renders read-only.
- `WorldCupPicksTab`'s draft is extended to carry optional predicted scores per knockout game; the submit payload includes `predictedHomeScore` / `predictedAwayScore` on those picks. Hydration from `GET …/me` pre-fills them.

### First-visit tooltip
- An info affordance (ℹ️) next to the knockout score inputs, with a popover explaining the bonus (the exact/off-by-one/mirror rule, short form). **Auto-shown once** on first visit after the feature ships — dismissible, gated by a `localStorage` flag (e.g. `wc-score-bonus-tooltip-seen`) so it never nags — and available on demand thereafter.

### On-page rules box (`WorldCupPicksTab`, the existing `<ul>`)
- Add a `<li>` (shown for **all** WC groups, since knockout games occur in both regular and knockout-only pools):
  > **Knockout score bonus (optional):** predict the final score for extra points — exact score = +2; off by one goal, or the right scoreline with the teams flipped = +1. PK shootouts count as a draw score.

### Leaderboard (`TournamentLeaderboard` + tab wiring)
- `TournamentLeaderboard` gains a `knockoutOnly` prop, threaded `GroupDetailsPage → WorldCupLeaderboardTab → TournamentLeaderboard`.
- A new **"Bonus"** column shows `bonus_points` (for all WC groups).
- The **Draws Correct / Draws Incorrect** columns are **hidden** when `knockoutOnly` is true (always 0 there; no scoring/tiebreaker change, display only).
- `TournamentLeaderboardRow` type gains `bonus_points`.

## Written rules doc (`frontend/docs/world-cup-picks-rules.md`)
- New section "Score-Prediction Bonus (Knockout)" before Tiebreakers, documenting the exact/off-by-one/mirror rule with the table above, that it's optional and independent of the winner, and the PK/ET score handling.
- Note the knockout-only leaderboard column omission. Keep this doc, the on-page rules box, and the tooltip copy consistent.

## Local dummy-data build (for hands-on testing)

When the PR opens, stand up a local instance the human can click through:
- Backend with `USE_MOCK_ESPN=true` (port 3001); frontend `npm run dev` (5173, auto-targets localhost backend).
- The current mock knockout fixtures (`espnWorldCupData.js`) are all FINAL. **Add upcoming (SCHEDULED, future-dated) knockout fixtures** to the mock so a tester can actually enter score predictions, while keeping a couple of FINAL ones so the leaderboard demonstrates earned bonus points. Provide a short run script / instructions and a seeded WC group.

## Edge cases (decided)
- "Off by one" = L1 distance 1; reversed/mirror exact = +1; both-teams-off (L1 = 2, non-mirror) = +0.
- Extra-time goals count toward the score; only PK kicks excluded.
- Bonus only when FINAL; independent of winner resolution and of the base pick's correctness.
- Mid-tournament launch: only not-yet-kicked-off knockout games are predictable; already-played games yield 0 bonus for everyone (no backfill).
- Incoherent combos allowed (predict 2–2 while picking one side to advance) — bonus is score-only.

## Testing
- **Unit (pure):** `scoreKnockoutScoreBonus` — exact / off-by-one (each team, both directions) / mirror / far / draw scores / PK-game level score / non-knockout returns 0 / missing-prediction returns 0 / not-final returns 0. `aggregateUserScore` + `buildLeaderboard` include `bonus_points` and total. `buildVersionString` changes when `SCORING_VERSION` bumps.
- **Backend route:** predicted-score validation (both-or-neither, bounds), upsert persists the columns, kickoff lock freezes them, leaderboard payload includes `bonus_points`.
- **Frontend unit:** `MatchPickRow` renders score inputs only for editable knockout matches; `WorldCupPicksTab` includes scores in the submit payload + hydrates them; `TournamentLeaderboard` shows the Bonus column and hides the draw columns when `knockoutOnly`; tooltip shows once then respects the localStorage flag.
- **E2e:** make a knockout advance pick *with* a score prediction and submit; assert the payload; assert the rules `<li>` is present.

## Migration / deploy
- Columns self-heal on first pick write (no `INIT_DB`). `SCORING_VERSION` bump invalidates leaderboard snapshots once. Frontend deploy carries the UI + rules + tooltip. Backend deploy carries scoring + columns + cache version.
