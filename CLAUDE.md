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

### Open follow-ups (not yet done)

- Collapse the seven-stage fan-out into one backend endpoint
  (`/api/games/world-cup-2026/stages` or `?stage=all`) so even a cold Picks load
  is a single round-trip. The backend already DB-caches per stage
  (`api.js` → `GameService.getWorldCupStage`), so this is mostly a route + a
  `getAllWorldCupStages()` service wrapper.
- Break the `GroupDetailsPage` waterfall: kick off the leaderboard fetch in
  parallel with the shell instead of after it, and lazy-load `getMessages` when
  the Chat tab opens rather than eagerly on mount.
- The NFL `PicksTab`/scoreboard via `picksService.js` has the same
  re-fetch-on-mount shape; the same cache pattern applies.

## Commands

```bash
# from frontend/
pnpm install
pnpm exec vitest run --no-coverage   # unit tests
pnpm build                           # production build (no separate typecheck step)
```
