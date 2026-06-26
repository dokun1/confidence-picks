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

## Commands

```bash
# from frontend/
pnpm install
pnpm exec vitest run --no-coverage   # unit tests
pnpm build                           # production build (no separate typecheck step)
```
