# CLAUDE.md

Project notes for Claude Code. Append durable findings here so future
investigations start with context instead of rediscovering it.

## Stack

- **Frontend** (`frontend/`): React 18 + TypeScript, React Router v6, Vite 4,
  Context API for state (no Redux), native `fetch` (no axios), Vitest for unit
  tests, Playwright for e2e. Package manager: **pnpm**.
- **Backend** (`backend/`): Express (ES modules), Passport (Google + Apple
  OAuth), `jsonwebtoken`, PostgreSQL.

## Auth & session model

Tokens live in `localStorage`:

- `accessToken` — JWT, **15 min** TTL (`AuthService.ACCESS_TOKEN_EXPIRES`),
  payload carries `userId`, `email`, `name`, `pictureUrl`.
- `refreshToken` — JWT, **30 day** TTL, payload is just `userId`; also stored
  server-side so it can be revoked.
- `user` — the full profile last fetched from `GET /auth/me`, cached so the UI
  can render the avatar/name without re-deriving it from the token.

Key files:

- `frontend/src/lib/authService.js` — token storage, JWT decode, `refreshToken`,
  `getCurrentUser`, and `makeAuthenticatedRequest` (Bearer header + 401/403
  retry-after-refresh). `picksService.js` has its own parallel `authFetch` with
  the same retry shape.
- `frontend/src/contexts/AuthContext.tsx` — `AuthProvider` derives initial auth
  state and runs the silent session restore on mount. `isRestoring` tells route
  guards a refresh is in flight so they don't bounce to `/login`.
- `frontend/src/components/ProtectedRoute.tsx` — renders nothing while
  `isRestoring`, else gates on `isAuthenticated`.
- `frontend/src/designsystem/components/Navigation/Navigation.tsx` — shows the
  avatar menu when `isAuthenticated && user`, else a "Sign In" CTA. It does
  **not** consult `isRestoring` (see follow-up below).
- Backend: `backend/src/routes/auth.js` (`/auth/refresh`, `/auth/me`, OAuth
  callbacks), `backend/src/services/AuthService.js`, `backend/src/middleware/auth.js`.

## Investigation: slow / "logged out" profile load on revisit (2026-06)

**Symptom:** returning to the site after the access token expired felt slow and
briefly looked logged out before resolving.

**Root cause:** the app discarded the cached identity and rebuilt it over the
network behind a logged-out shell. `getUser()` returns `null` the moment the
15-min access token expires (even though the cached profile + a valid 30-day
refresh token are both present), so `AuthProvider` initialized logged-out, the
navbar flashed "Sign In", `ProtectedRoute` blanked the page, and a blocking
`POST /auth/refresh` (+ possible `GET /auth/me`) round-trip gated first render.

**Fix (committed):** optimistic hydration + background reconcile.

- `AuthService.getCachedUser()` returns the persisted profile **independent of
  token expiry**; `isAccessTokenValid()` is a clean validity check.
- `AuthProvider` now hydrates from the cached profile when the access token is
  expired but a refresh token exists, so `isAuthenticated` is true on first
  paint. The refresh runs as a silent, non-blocking background reconcile;
  `isRestoring` only blocks in the rare refresh-token-but-no-cached-profile case.
- `refreshToken()` de-duplicates concurrent refreshes behind one in-flight
  promise, so the restore and the first protected API calls don't stampede
  `/auth/refresh`.

**Mental model:** cached data should paint immediately; the network should only
*reconcile*, never gate first render. When touching auth state, check all four
seams together — `getUser`/`getCachedUser`, `AuthProvider` init + effect,
`ProtectedRoute`, and `Navigation` — they each independently decide "logged in?"
and can disagree during restore.

**Test seam:** `AuthContext.test.tsx` and `App.test.tsx` mock
`../lib/authService.js`. When adding methods that `AuthProvider` calls during
init/restore (e.g. `getCachedUser`, `isAccessTokenValid`), add them to **both**
mocks or the providers throw "X is not a function" at mount.

### Open follow-ups (not yet done)

- `Navigation.tsx` could consult `isRestoring` to suppress the "Sign In" CTA in
  the rare no-cache cold-start; mostly moot after optimistic hydration.
- 15-min access-token TTL means frequent background refreshes. Lengthening it or
  refreshing proactively before expiry would cut churn — a security tradeoff,
  get owner sign-off first.
- Other latency to investigate next: the picks/scoreboard fetches in
  `frontend/src/lib/picksService.js` (no client-side caching; each page mount
  re-fetches).

## Investigation: "extra beat" on World Cup group tabs (2026-06)

**Symptom:** the Leaderboard and Picks tabs in a `world_cup_2026` group felt a
beat slow each time you opened them — including switching away and back.

**Root cause:** `GroupDetailsPage` conditionally renders only the active tab
(`activeTab === 'leaderboard' && …`), so each tab **unmounts on every tab
switch** and its data-owning child re-fetches from scratch behind a `Loading…`
blank. There was no client-side cache, so re-entry never reused prior data. The
Picks tab was the worst case: `WorldCupPicksTab` fans out to **seven** stage
requests (`Promise.all(WORLD_CUP_STAGES.map(getStageMatches))`) on every mount,
plus a my-picks hydrate and a my-groups fetch.

Secondary contributor (not yet fixed): the page-shell `Promise.all([getGroup,
getMembers, getMessages])` gates first render, and the leaderboard fetch can't
even *start* until that resolves — a serial waterfall. `getMessages` is fetched
eagerly on mount even though Chat isn't the default tab.

**Fix (committed):** a tiny stale-while-revalidate cache,
`frontend/src/lib/worldCupCache.ts` (`peekCache`/`writeCache`/
`clearWorldCupCache` + `wcCacheKeys`). It's process-memory only, no TTL —
freshness comes from always revalidating, not from expiry.

- `WorldCupLeaderboardTab` and `WorldCupPicksTab` seed initial state
  synchronously from `peekCache(...)`, so a warm cache paints the last-known
  standings/match slate **instantly** on re-entry. The fetch still runs but only
  shows the blocking spinner on a **cold** load (`peekCache(...) === undefined`);
  a warm revalidate is silent. A failed revalidate keeps the stale data on
  screen instead of replacing it with an error.
- Stage matches are cached tournament-globally (`wc:stages`); the leaderboard is
  cached per group (`wc:lb:<id>`). The Picks tab's live-poll silent refresh also
  writes the cache so a mid-tournament tab switch re-seeds from the latest
  scores, not a stale pre-kickoff slate.

**Mental model (same as the auth fix):** cached data paints immediately; the
network only *reconciles*. The cold-vs-warm distinction is the whole trick — gate
the spinner on `peekCache(key) === undefined`, never unconditionally.

**Test seam:** the cache is module-global and **persists across test cases**.
Component tests that seed from it must `clearWorldCupCache()` in `beforeEach`
(see `WorldCupLeaderboardTab.test.tsx` / `WorldCupPicksTab.test.tsx`) or a prior
render's data leaks into the next — most visibly breaking the "shows the loading
state" cases (a warm cache means no spinner). The cache module is imported
*real* (unmocked) in those tests, alongside the mocked `worldCupService.js`.

### Follow-ups: cold-load round-trips + the shell waterfall (2026-06, done)

Both done in the pass that followed the SWR cache.

**1. Single-request stage slate.** The Picks tab's seven-stage fan-out is now one
round-trip. `GameService.getAllWorldCupStages(forceRefresh)`
(`backend/src/services/GameService.js`) `Promise.all`s the seven
`getWorldCupStage` reads server-side and flattens them in calendar order
(`WORLD_CUP_STAGE_ORDER`); the per-stage DB cache + live-refresh rules are
unchanged. Exposed at `GET /api/games/world-cup-2026/stages`
(`backend/src/routes/api.js`, registered before the NFL `/:year/...` param route
like the other literal world-cup routes) returning the same
`{ games, count, cached }` shape with the grafted `winnerTeamId`. Frontend:
`getAllWorldCupStages()` in `worldCupService.js`; `WorldCupPicksTab` calls it in
place of `Promise.all(WORLD_CUP_STAGES.map(getStageMatches))` in BOTH the initial
fetch and the live-poll `refreshMatchesSilently`. `getStageMatches` is still
exported (single-stage callers/tests), but no component fans out anymore.

**2. Broke the `GroupDetailsPage` waterfall.** Two changes:
- The shell `Promise.all` is now just `[getGroup, getMembers]` — `getMessages`
  was dropped from the critical path and is **lazy-loaded the first time the Chat
  tab opens** (`ensureMessagesLoaded`, guarded so it fetches once; the tab shows
  a spinner until `messagesLoaded`). Chat history no longer delays first paint.
- For `world_cup_2026` pools the page **prefetches the leaderboard in parallel**
  with the shell: as soon as `getGroup` resolves and the pool type is known, it
  fires `getWorldCupLeaderboard` and `writeCache`s it under
  `wcCacheKeys.leaderboard(id)`. The default Leaderboard tab seeds from that
  cache and paints instantly instead of starting its fetch only after the shell
  resolves. (The tab still revalidates on mount — one extra background call, by
  SWR design.)

**Test-seam notes:**
- `WorldCupPicksTab.test.tsx`, `WorldCupPicksPage.test.tsx`, and
  `GroupDetailsPage.test.tsx` now mock `getAllWorldCupStages` (a single resolved
  `{ games }`) instead of per-stage `getStageMatches`.
- `GroupDetailsPage.test.tsx` imports the **real** cache and calls
  `clearWorldCupCache()` in `beforeEach` (the leaderboard prefetch + the embedded
  WC tabs both touch it); chat assertions are now `await findByText(...)` because
  messages lazy-load; and `getMessages` must NOT be called on mount.
- Backend: `tests/api-worldcup-route.test.js` covers the `/stages` route (flattened
  multi-stage payload + grafted knockout `winnerTeamId`).

### Open follow-ups (not yet done)

- The NFL `PicksTab`/scoreboard via `picksService.js` has the same
  re-fetch-on-mount shape; the SWR cache pattern (and the parallel-prefetch trick)
  applies there too. The NFL `LeaderboardTab` has no cache yet, so the
  parallel-prefetch optimization is currently World-Cup-only.

## Feature: "knockout stage picks only" WC groups (2026-06)

A `world_cup_2026` sub-setting, chosen at group creation and **immutable** (like
`pool_type`). When on, the group only allows picks on knockout-stage games; the
group stage (`stage = 'group'`) is hidden in the UI and rejected server-side.
Scoring/leaderboard are unchanged — they already sum per-match over whatever picks
exist.

- **Column:** `groups.knockout_only BOOLEAN NOT NULL DEFAULT false`. Defined in
  `schema.sql` (CREATE + idempotent `DO $$` ALTER) and `backend/scripts/addWorldCupColumns.js`.
- **Deploy (automatic, self-healing):** prod runs with `INIT_DB` unset, so neither
  `schema.sql` nor the migration script runs on a normal deploy — and `create()`'s
  INSERT names `knockout_only`, so a missing column would 500 *every* new group.
  `Group.ensureKnockoutOnlyColumn()` closes this the same way `ensureChatReadsSchema`
  / `GroupInvite.ensureLinkInviteSchema` do: `create()` calls it first, it adds the
  column (`ADD COLUMN IF NOT EXISTS`) on the first group creation after deploy, then
  a static `Group._knockoutOnlyColumnEnsured` latch makes every later create a
  zero-query no-op ("back to normal"). Reads already tolerate a missing column
  (`SELECT g.*` → undefined → false). `INIT_DB=true` and the migration script remain
  as explicit/ops alternatives but are no longer required.
- **Model:** `Group` carries `knockoutOnly` (camelCase) through the constructor,
  `create()`, `findByIdentifier()`, `getUserGroups()`. Left out of `update()`'s
  `allowedFields` on purpose (immutable).
- **Backend enforcement:** `POST /api/groups` rejects `knockoutOnly` when
  `poolType !== 'world_cup_2026'` (400). Both WC pick routes in `worldCupPicks.js`
  (self + admin-override) read `stage` back from the games row and reject any
  group-stage pick via `groupStagePickViolations()` (400 `{ error, gameIds }`).
- **Frontend:** `CreateGroupForm` shows the checkbox only for a WC pool (cleared
  on switch to NFL). `WorldCupPicksTab` takes a `knockoutOnly` prop
  (`GroupDetailsPage` passes `group.knockoutOnly`) and also derives it from its own
  `getMyGroups` fetch as a fallback for the standalone `/world-cup` page; it filters
  `stage === 'group'` matches out of `visibleMatches` before render/count.
- **Test seams:** several exact-payload assertions
  (`CreateGroupForm.test.tsx`, `CreateGroupPage.test.tsx`) now include
  `knockoutOnly`. WC-pick-route tests stub `Group.findByIdentifier` to return
  `{ ..., knockoutOnly: true }` and add `stage` to the `FROM games` row mock.

## Fixes: WC needs-pick banner + stale knockout matchups (2026-06)

Two independent bugs surfaced by a knockout-only group; fixed together.

**1. Banner/dot over-counts in a knockout-only group.** The leaderboard banner
(`GroupDetailsPage`) and the groups-list dot (`GroupsPage`) both call
`countNeedsPick(matches, picks, now)` ([wcNeedsPick.ts](frontend/src/lib/wcNeedsPick.ts)),
which counted the *unfiltered* slate — so a knockout-only group counted the
remaining pickable **group-stage** games it can't actually pick (banner said 13,
Picks tab said 1). Both screens already share the same `needsPick`/`teamsDecided`
predicate; the only divergence was the missing stage filter. Fix: `countNeedsPick`
takes an optional `knockoutOnly` arg that drops `stage === 'group'` before counting;
both call sites pass the group's flag (`group?.knockoutOnly` / `g.knockoutOnly`).
Ongoing pools pass `false` → unchanged.

**2. Resolved knockout matchups served stale (placeholders).** Two compounding
backend causes, both pre-existing:
- `Game.isDifferentFrom()` ([Game.js](backend/src/models/Game.js)) compared
  date/status/score/period/clock/statusDetail/eventCount but **not team identity**,
  so when ESPN swaps a bracket placeholder ("Third Place Group B/E/F/I/J", abbr
  `3RD`, `isActive:false`) for the resolved team (Bosnia/`BIH`/`isActive:true`) with
  no other field changing, the cache update gate never fired. Fix: also diff a
  team-identity fingerprint over **stable** fields only — `id | abbreviation |
  isActive` — for home and away. Volatile fields (record/form/logo/odds) are
  deliberately excluded so NFL/group-stage rows never churn.
- `GameService.isStageCacheFresh()` served future SCHEDULED games from the DB for up
  to 24h without consulting ESPN, so even with the diff fix nothing re-fetched.
  Fix: a **proactive, throttled** trigger — a knockout stage still holding
  placeholder participants (`hasUnresolvedKnockoutParticipants` /
  `isPlaceholderTeam`, mirroring the frontend `teamDecided` rule) re-checks ESPN at
  most once per `PLACEHOLDER_REFRESH_THROTTLE_MS` (5 min), tracked per stage in the
  in-process `_lastStageFetchAt` map (set in `getWorldCupStage` whenever ESPN is
  fetched). `isStageCacheFresh` now takes `(cachedSet, stage, now)`; the old
  2-arg/`stage=null` calls skip the placeholder branch (group stage never has
  placeholders anyway). Bounds ESPN to traffic-independent ~1 call/stage/5min.

Both fixes apply to ongoing AND knockout-only World Cup groups (the stale-matchup
fix is at the cache layer, shared by all WC pools). `?refresh=true` / `?force=1` on
the stage routes still force-bypass the cache.

## SEV: penalty-shootout knockout scored as a draw (2026-06)

**Symptom:** Germany 1-1 Paraguay went to PKs (Paraguay advanced). A user who
picked Germany saw the match as a draw and a partial-credit **"~ +1"** badge,
when a knockout loss should be **0**.

**Root cause — frontend only (the visible bug).** A PK shootout has a *level*
regulation scoreline (1-1); the advancing side is carried by `winnerTeamId`, NOT
the score. The backend scores correctly (`SoccerScoringService.deriveActualResult`
already prefers `winnerTeamId` for knockouts), but the frontend derived the result
purely from the scoreline: `wcGamesView.outcomeOf()` read `homeScore`/`awayScore`
only, and `worldCupBrowseAdapter.toBrowseGames()` never even carried `winnerTeamId`
onto `BrowseGame`. So a 1-1 PK game read as `'draw'` → `resultShade('home','draw')`
→ `'partial'` → the "~ +1" badge (MatchListCard line ~59), and the Correct/Incorrect
filter chips (`pickVerdict`) were wrong too. **The displayed badge is frontend-
derived, not the server leaderboard value** — so the user's actual standings were
only wrong if the backend `winnerTeamId` was itself unresolved (see below).

**Fix (committed):**
- **Frontend:** `BrowseGame.winner?: 'home'|'away'` (the advancing side), mapped in
  `toBrowseGames` from `m.winnerTeamId` vs `homeTeam.id`/`awayTeam.id` (string-
  compared). `outcomeOf` is now knockout-aware — trusts `winner` over the
  scoreline; an unresolved level knockout returns `null` (undecided, never
  `'draw'`); group stage unchanged. This **mirrors backend `deriveActualResult`**
  exactly. `outcomeOf`'s `Pick<>` now needs `isKnockout`+`winner` (callers pass full
  `BrowseGame`, so only tests changed).
- **Backend hardening (defensive + enables auto-recalc):**
  1. `winnerHomeAwayFromESPN` now falls back to `competitors[].shootoutScore` (higher
     PK tally advanced) when ESPN's `winner` flag is absent — the only other PK
     signal, in case ESPN lags the flag at finalization.
  2. New `hasUnresolvedKnockoutWinner(cachedSet, stage)` + an `isStageCacheFresh`
     trigger (same per-stage throttle as the placeholder refresh): a FINAL knockout
     with a level score and `winnerTeamId == null` re-checks ESPN instead of serving
     the unscored row for 24h. Recovering the winner bumps the row's `last_updated`.

**Recalculation is automatic — no script.** `WorldCupLeaderboardService.getLeaderboardVersion`
keys the snapshot cache on `MAX(last_updated)` among FINAL `world_cup` games. The
moment a game row's `winnerTeamId` is corrected (self-heal re-fetch persists it,
bumping `last_updated`), the version string changes and **every group's leaderboard
recomputes from scratch on next read**. If `winnerTeamId` was already correct, the
self-heal never fires and the board was already right — only the frontend display
needed the fix.

**Mental model:** the advancing team on a knockout is `winnerTeamId`, never the
1-1 scoreline. Any code that asks "who won?" from a WC match must consult it for
knockouts — frontend `outcomeOf` and backend `deriveActualResult` are the two
seams, and they must agree.

## SEV: "Game locked" on a game that hadn't kicked off (2026-09)

**Symptom:** NFL Week 1, 2026. Members couldn't save a pick on Thursday's SF@LAR
six minutes before kickoff; the editor toasted "Game locked". 13 users across 5
groups were blocked from editing *any* Week 1 pick once the Wednesday opener
started.

**Root cause:** the lock was per-*submit*, not per-game. `GamesPage` hydrates the
draft from saved picks (since `44fd60a`, 2026-06) and submits the whole draft, so
the payload always carried the finished opener's pick. The POST validator rejected
the entire batch with `409 Game locked` on the first non-SCHEDULED game before
writing anything. The MCP client's `mergeWeek` also re-sends the whole week.

A second, opposite bug: the lock keyed off ESPN `status`, which lags the real
kickoff by minutes, so picks were accepted *after* kickoff (1–2 min in one group).

**Fix:**
- `backend/src/utils/pickLock.js` — `isPickLocked(game, now)`: open until the
  **scheduled kickoff instant** (`now >= gameDate` locks), or earlier if ESPN
  already reports the game started. Postponed games stay open. Every lock site in
  `routes/picks.js` (new pick, explicit clear, confidence reclaim, clear-all) uses
  it. `PRE_STATUSES` moved there too.
- POST skips an **unchanged** re-send of a saved pick on a locked game
  (`isUnchangedPick`) instead of rejecting; its confidence still counts toward the
  duplicate check. A *changed* pick on a locked game is still `409`.
- `GamesPage` leaves picks on IN_PROGRESS/FINAL games out of the submit body. It
  deliberately never checks kickoff time — the server owns time, and a fast device
  clock must never lock a game early.

**Not changed:** `deriveGamePickMeta` and the line-~264 redaction of others' picks
still key off status (neither can lock early; the NFL editor doesn't read `meta`).
The owner override (`POST /:group/picks/user/:userId`, API-only — no UI calls
`saveUserPicks`) still skips the lock for *other* members so owners can fix
submission issues, but when an owner targets their **own** id it applies the
member rules (lock at kickoff, unchanged re-sends skipped, no clearing/reclaiming
a started game) — otherwise it was a curl loophole for late picks. MCP tokens
can't reach it (`mcpAuth.js` denies unlisted routes).

**Timezone dependency:** `games.game_date` is `timestamp without time zone` holding
UTC; node-pg parses it in the *process* timezone. Vercel runs TZ=UTC so kickoff is
exact in prod; a local backend in CDT locks ~5h late. Don't run the API with a
non-UTC `TZ`.

**Test seams:** `tests/pick-lock-util.test.js` pins the boundary to the
millisecond; `tests/picks-lock.test.js` covers the route. Route fixtures must keep
confidences ≤ the mocked slate size or `Confidence out of range` (400) fires first.

## Fix: NFL pick editor always opened on Week 1 (2026-09)

**Symptom:** Week 2, 2026. "Make picks" on an NFL group opened `GamesPage` on
Week 1 — a slate whose 16 games were all FINAL. The group's own banner correctly
said "N picks available to make in Week 2" and the button it rendered went to
Week 1.

**Root cause:** `GamesPage.tsx` initialized `const [week, setWeek] = useState(1)`
— a literal. `year` was derived (`getCurrentNFLSeason()`) and `seasonType` pinned
to 2, but week was never resolved from anything: no date math, no backend call,
no URL param, no storage. Only the dropdown and an out-of-range clamp ever wrote
to it. The codebase already had the answer in two places and the editor used
neither: `PicksTab` resolves via `getClosestWeek`, and `GroupDetailsPage` fetched
the very same value into `nflPickWeek` for its banner, then dropped it when
navigating.

**Fix:** `?week=` is the source of truth, with backend resolution as the default.
- `GamesPage` seeds `week` from `?week=` (`parseWeekParam`, 1-18 or null), else
  calls `getClosestWeek(groupId, year, seasonType)` on mount. `week` is
  `number | null`; **null means unresolved and both fetch effects wait on it**
  rather than firing at a placeholder — so the stale Week 1 slate is never
  requested on the way to the right week.
- Fallbacks all land on 1: lookup rejects, backend answers week 0 (it can, for a
  season with no games rows), or there is no `groupId` (the closest-week endpoint
  is membership-gated, so the standalone `/games` view can't ask).
- Picking a week writes it to the URL (`chooseWeek`, `replace: true`) so a
  refresh stays put. A *resolved* week is deliberately NOT written back, so a
  bookmarked `/games?groupId=X` always reopens on the current week.
- Both entry points now pass the week they already know: `PicksTab`'s link and
  `GroupDetailsPage.goToNflPicks()` (from `nflPickWeek`).

**Note:** `computeClosestWeek` (`backend/src/routes/picks.js:22`) is DB-driven,
not date-driven — *first week holding any non-FINAL game*. It depends on next
week's games being ingested; with no rows for a season it returns 0. It is also
why an in-progress week correctly stays selected rather than advancing.

**Test seams:** `GamesPage.test.tsx` must now include `getClosestWeek` in its
`picksService.js` mock (as `PicksTab.test.tsx` already did) or the page throws at
mount — the same both-mocks trap as the auth work above. Its `beforeEach` mocks
the closest week to 1 so the pre-existing week-1 URL assertions keep their
meaning. A `LocationProbe` in `renderPage` exposes the query string for the
URL-writing assertion.

## Fix: a confidence ladder could not be reordered (2026-09)

**Symptom:** Week 2, 2026. A user trying to swap two games' confidences minutes
before kickoff got `400 {"error":"Duplicate confidence (constraint)"}` from every
attempt — the merged payload, the whole-week resend, and a park-at-17 workaround
(`Confidence out of range`, the range is hard 1..slate size). Reordering a saved
ladder was impossible through the API.

**Root cause:** reordering is a PERMUTATION of confidences, and
`ux_user_picks_conf_per_week` is a **partial** unique index
(`… , confidence_level) WHERE confidence_level IS NOT NULL`). `UserPick.bulkUpsert`
sent one multi-row `INSERT … ON CONFLICT`, which Postgres applies row-by-row
against the live index: game A claims 3 while game B still holds 3 → 23505 on the
whole statement. With every value 1..N already spoken for there is no free slot
to route through, so no ordering of a 2-cycle (or any cycle) can succeed. A
partial index **cannot** be made `DEFERRABLE`, so deferring the constraint — the
usual fix — is not available here.

**Fix:** two-phase write inside one transaction in `bulkUpsert`:
1. NULL `confidence_level` **and** `picked_team_id` for every game in the batch
   (the partial index ignores NULLs, so no duplicate can exist mid-write). Both
   columns must clear together or `chk_pick_consistency` fails — that CHECK
   requires the pair to be set or unset as one.
2. Upsert the batch; every value it claims is now free.
Plus `pg_advisory_xact_lock` keyed on user/group/season/type/week so two racing
retries cannot interleave their phases.

Same CHECK bug existed in `routes/picks.js` `implicitConfidenceClears`, which set
`confidence_level=NULL` alone and therefore 500'd whenever that path fired. It
now clears the team too; the schema simply does not permit a winner with no
confidence, so the old "retain picked_team_id" comment described something
impossible.

**Also shipped (MCP usability up to the deadline):**
- `pickWindow(game, now)` in `utils/pickLock.js` — publishes `locksAt` (the
  scheduled kickoff) and a server-resolved `editable`. Carried on
  `GET /api/games/:year/:seasonType/:week` and the picks payloads. Clients must
  never infer editability from ESPN `status` (lags kickoff by minutes) or their
  own clock (a fast device locks early).
- `mcp/src/core.js` `getSlate` read `g.date`; the API field is **`gameDate`**, so
  every slate shipped with `kickoff: undefined` and `JSON.stringify` dropped it.
  The unit test's fixture used `date` too, so the test and the code agreed with
  each other and disagreed with production — when fixing a mapping bug, check the
  fixture encodes the real payload shape.
- Duplicate/out-of-range 400s now name the value, both `gameIds`, and the bounds.
- POST picks returns `skippedLocked` (games accepted only as unchanged no-ops)
  and echoes `Idempotency-Key`. `submitWeek` withholds picks on started games so
  one kicked-off game can't sink an otherwise-valid batch.

**Test seams:** `tests/picks-confidence-swap-db.test.js` is the only test that
would have caught the original bug — it exercises the **real** partial index
(mocks cannot reproduce index evaluation) and skips cleanly with no database. It
also caught the `chk_pick_consistency` violation in the first draft of the fix.
`tests/userpick-bulkupsert-order.test.js` pins vacate-before-claim.
Route fixtures must keep confidences ≤ the mocked slate size (`max` is the slate
length, so a 2-game slate rejects confidence 3).

## Commands

```bash
# from frontend/
pnpm install
pnpm exec vitest run --no-coverage   # unit tests
pnpm build                           # production build (no separate typecheck step)
pnpm exec tsc --noEmit               # real typecheck; `pnpm build` does NOT type-check
```

Note: `tsc --noEmit` reports two **pre-existing** errors in `AuthContext` for
`getCachedUser` / `isAccessTokenValid` (JS service, no declarations). Ignore
those two; treat anything else as yours.
