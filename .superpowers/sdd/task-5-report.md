# Task 5 Report: Frontend score-prediction inputs + submit/hydrate

## Status: DONE

## Commit
`8f25504` — feat(wc): knockout score-prediction inputs + submit/hydrate

## Files Changed

**Types and adapters:**
- `frontend/src/lib/types.ts` — added `predictedHomeScore?: number | null` and `predictedAwayScore?: number | null` to `MatchPick`
- `frontend/src/lib/wcGamesView.ts` — added same two optional fields to `BrowseGame`
- `frontend/src/lib/worldCupBrowseAdapter.ts` — `toBrowseGames` accepts optional `scoreDraft` arg; maps scores onto each `BrowseGame`

**UI components:**
- `frontend/src/designsystem/components/MatchPickRow/MatchPickRow.tsx` — added `predictedHomeScore`, `predictedAwayScore`, `onScoreChange` props; renders two `<input type="number" step="any">` for editable knockout matches; read-only prediction display for locked knockout matches when scores are set; group-stage matches visually unchanged
- `frontend/src/designsystem/components/WorldCupBrowse/WorldCupGamesList.tsx` — added `onScoreChange` prop; passes it through to each `MatchListCard`
- `frontend/src/designsystem/components/WorldCupBrowse/MatchListCard.tsx` — added `onScoreChange` prop; renders score inputs for unlocked knockout cards when `onScoreChange` is present

**Pick tab:**
- `frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx` — added `ScoreDraft` type + `scoreDraft` state; `scoreChange()` handler; passes `scoreDraft` to `toBrowseGames`; passes `onScoreChange={readOnly ? undefined : scoreChange}` to `WorldCupGamesList`; `picks` memo includes score fields for knockout matches; hydration seeds `scoreDraft` from API response; `scoreDraft` cleared on person switch

**Tests:**
- `frontend/src/designsystem/components/MatchPickRow/MatchPickRow.test.tsx` — added `score prediction inputs` describe block (5 new tests)
- `frontend/src/pages/GroupDetails/WorldCupPicksTab.test.tsx` — added `score prediction inputs (knockout matches)` describe block (4 new tests)

## Test Commands & Results

```
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20 >/dev/null
cd frontend && node_modules/.bin/vitest run src/designsystem/components/MatchPickRow src/pages/GroupDetails/WorldCupPicksTab
```
Result: **53 tests pass** (23 MatchPickRow, 30 WorldCupPicksTab), 0 failures.

```
node_modules/.bin/vitest run
```
Result: **770 tests pass**, 5 todo (pre-existing ProtectedRoute skips), **0 failures**. 56 test files passed.

## Build Result

```
node_modules/.bin/vite build
```
Result: Clean — 773 modules transformed, built in 1.73s, no TypeScript errors.

## Key Design Decisions
- Score inputs use `step="any"` (no `min`/`max`) per spec — server enforces [0,20] bounds.
- Inputs are optional; a knockout pick with no predicted score is valid.
- `MatchPickRow` gained score props for future use (e.g., detail panel). The tab UI uses `MatchListCard` (browse list architecture) which also received score support.
- `scoreDraft` cleared on person-switch alongside `draft` to prevent cross-member bleed.
- `worldCupService.js` needed no changes: the POST body serializes the full picks array (score fields travel with it automatically), and GET responses pass through all fields as-is.

## Concerns
None — purely additive. No existing tests modified, removed, or skipped.

---

# Task 5 Review Fixes

## Status: DONE

## Commit
(see git log — fix(wc): both-or-neither score submit + locked prediction display + adapter guard)

## Files Changed

**Fix 1 — Both-or-neither score on submit:**
- `frontend/src/pages/GroupDetails/WorldCupPicksTab.tsx` — `picks` memo now only includes `predictedHomeScore`/`predictedAwayScore` when BOTH are present and are valid numbers (`s.home != null && !isNaN(s.home) && s.away != null && !isNaN(s.away)`). One-sided entry omits both fields.
- `frontend/src/designsystem/components/WorldCupBrowse/MatchListCard.tsx` — score input section converted to IIFE to compute `homeFilled`/`awayFilled`/`oneSided`; a `<p data-testid="score-hint-{id}">Enter both scores to earn the bonus</p>` renders below the inputs when exactly one side is filled.

**Fix 2 — Locked read-only prediction display:**
- `frontend/src/designsystem/components/WorldCupBrowse/MatchListCard.tsx` — locked branch now renders a `<div data-testid="prediction-{id}">Your prediction: X–Y</div>` when `game.isKnockout` and at least one score is present. Mirrors `MatchPickRow`'s existing pattern.

**Fix 3 — Adapter guard:**
- `frontend/src/lib/worldCupBrowseAdapter.ts` — `predictedHomeScore`/`predictedAwayScore` now guarded by `m.stage !== 'group'` so they are only attached to knockout entries, aligning code with comment.

## Test Commands & Results

```
export NVM_DIR="$HOME/.nvm" && . "$NVM_DIR/nvm.sh" && nvm use 20 >/dev/null
cd frontend
node_modules/.bin/vitest run src/designsystem/components/WorldCupBrowse/MatchListCard src/pages/GroupDetails/WorldCupPicksTab src/designsystem/components/MatchPickRow
```
Result: **70 tests pass** (14 MatchListCard, 33 WorldCupPicksTab, 23 MatchPickRow), 0 failures.

```
node_modules/.bin/vitest run
```
Result: **778 tests pass**, 5 todo (pre-existing ProtectedRoute skips), **0 failures**. 56 test files passed, 1 skipped.

## Build Result

```
node_modules/.bin/vite build
```
Result: Clean — 773 modules transformed, built in 1.67s, no TypeScript errors.

## Covering Test Files
- `frontend/src/designsystem/components/WorldCupBrowse/MatchListCard.test.tsx` — added `score prediction (knockout matches)` describe block (5 new tests: locked with/without prediction, one-sided hint shown/hidden/neither-filled)
- `frontend/src/pages/GroupDetails/WorldCupPicksTab.test.tsx` — added 3 new tests inside the existing `score prediction inputs (knockout matches)` describe: no-scores-sends-no-fields, one-sided-home-omitted, one-sided-away-omitted
