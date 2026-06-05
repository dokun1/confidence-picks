# Games & Picks Panel — Svelte Source Analysis

Files analyzed:
- `frontend/src/components/GamesPage.svelte`
- `frontend/src/components/PicksPanel.svelte`
- `frontend/src/components/GamePickRow.svelte`
- `frontend/src/designsystem/components/GroupPicks.svelte` (legacy design-system stub)
- `frontend/src/lib/picksService.js`
- `frontend/src/lib/nflSeasonUtils.js`

---

## 1. GamesPage.svelte

### 1a. Reactive Variables and Initial Values

| Variable | Initial Value | Type | Notes |
|---|---|---|---|
| `games` | `[]` | Array | Populated by `fetchGames()` |
| `loading` | `false` | boolean | Set true during fetch |
| `error` | `''` | string | Error message display |
| `selectedYear` | `2025` | number | Year selector (hardcoded options: 2024, 2025) |
| `selectedWeek` | `1` | number | Week number, 1-indexed |
| `seasonType` | `2` | number | 1 = Preseason (4 weeks), 2 = Regular (18 weeks) |
| `forceRefresh` | `false` | boolean | Checkbox to bypass server cache |
| `SEASON_TYPE_META` | `{ 1: { label:'Preseason', weeks:4 }, 2: { label:'Regular Season', weeks:18 } }` | object | Lookup constant |

**Derived reactive (`$:`):**
- `totalWeeks = SEASON_TYPE_META[seasonType].weeks` — drives week selector options count
- `if (selectedWeek > totalWeeks) selectedWeek = 1` — auto-reset on season type change (Regular→Preseason)

Each game object is augmented on load with `_derivedStatus` via `deriveStatus(game)`.

### 1b. API Service Calls

**Direct `fetch()` (no authFetch — public endpoint, no auth required):**
```
GET /api/games/{selectedYear}/{seasonType}/{selectedWeek}?force={forceRefresh}
```
- Called on `onMount` and when user clicks "Load Games"
- Also re-fetched on `seasonType` change via `on:change={fetchGames}`
- Response shape: `{ games: Array<GameObject> }`
- Uses `API_URL` resolved from `import.meta.env.PROD` — production: `https://api.confidence-picks.com`, dev: `http://localhost:3001`

### 1c. Week and Season Selector State Transitions

1. **Year** — `<select bind:value={selectedYear}>` — does NOT auto-fetch; user must click "Load Games"
2. **Season type** — `<select bind:value={seasonType} on:change={fetchGames}>` — fetches immediately on change; the reactive rule `$: if (selectedWeek > totalWeeks) selectedWeek = 1` resets the week if needed
3. **Week** — `<select bind:value={selectedWeek}>` — does NOT auto-fetch; user must click "Load Games"
4. **Load Games button** — always triggers `fetchGames()`, regardless of what changed
5. **Force refresh** — checkbox bound to `forceRefresh`, passed as query param

### 1d. Game Card Rendering

**Status derivation** (`deriveStatus(game)` → `_derivedStatus`):
| `game.status` (from API) | `_derivedStatus` | CSS class |
|---|---|---|
| `'FINAL'` | `'final'` | `.game-status.final` (green bg `#198754`) |
| `'IN_PROGRESS'` | `'in progress'` | `.game-status.in-progress` (red bg `#dc3545`) |
| `'SCHEDULED'` or anything else | `'not started'` | `.game-status.not-started` (gray bg `#adb5bd`) |

**Status badge content:**
- `in progress`: shows `{game.displayClock} · Q{game.period}` (clock and period if available)
- all others: shows the `_derivedStatus` string

**Probability row** — rendered only when `game._derivedStatus === 'in progress' && game.probability`:
```
{Math.round(game.probability.awayWinPct * 100)}% | Win Prob | {Math.round(game.probability.homeWinPct * 100)}%
```
Displayed as a 3-column grid below the matchup.

**Odds display** — rendered when `game.odds` exists:
- `game.odds.favoriteAbbr` + `game.odds.spread` (formatted: if spread > 0 prefix with `-`)
- fallback: `game.odds.details`
- `game.odds.overUnder` → `O/U {value}` (separated by `|`)
- `game.odds.provider` in italic parens

**Team card:**
- `teamStyle(team)` computes inline `background`/`color` from `team.color` hex (luminance threshold 0.6 → black/white text)
- Shows: team logo (if available), abbreviation, full name, score
- Score rendered even for SCHEDULED games (shows `0` from API)

**GamesPage has no picks interaction** — it is a read-only browse view with no locked/editable distinction.

### 1e. Conditional UI Branches

| Condition | Renders |
|---|---|
| `loading` | `<div class="loading">Loading games...</div>` |
| `error` (non-empty) | Error message + "Try Again" button |
| `games.length === 0` (and not loading/error) | "No games found for this week." message |
| else | `games-grid` with game cards |
| `game._derivedStatus === 'in progress' && game.probability` | Probability row inside game card |
| `game.odds` exists | Odds line inside `.game-meta` |
| `game._derivedStatus === 'in progress'` | Clock/period in status badge |

---

## 2. PicksPanel.svelte

### 2a. Reactive Variables and Initial Values

**Props (exported `let`):**
| Prop | Default | Direction |
|---|---|---|
| `groupIdentifier` | required | in |
| `isOwner` | `false` | in |
| `canSave` | `false` | out (bound by parent) |
| `savingState` | `false` | out |
| `clearingState` | `false` | out |
| `hasSortedPicks` | `false` | out |
| `hasMultipleGroups` | `false` | out |
| `showGroupSelector` | `false` | in/out (two-way via parent) |
| `currentWeek` | `null` | out |

**Internal state:**
| Variable | Initial Value | Description |
|---|---|---|
| `season` | `getCurrentNFLSeason()` | Current NFL season year |
| `seasonType` | `2` | Regular season only |
| `week` | `null` | Set by `getClosestWeek()` on mount |
| `loading` | `false` | Overall page loading |
| `saving` | `false` | Save in progress |
| `clearing` | `false` | Clear in progress |
| `error` | `''` | Error message |
| `showErrorToast` | `false` | Toast visibility |
| `lastRefreshed` | `null` | Date of last successful fetch |
| `autoRefreshInterval` | `null` | setInterval handle |
| `games` | `[]` | Server game payload |
| `availableConfidences` | `[]` | Unused (populated from API, not rendered directly) |
| `totalGames` | `0` | Used for confidence range in GamePickRow |
| `weekPoints` | `0` | Displayed as "Week Points: {n}" |
| `draft` | `{}` | `{ [gameId]: { pickedTeamId, confidence } }` |
| `original` | `{}` | Server-saved state snapshot |
| `showScoreboard` | `false` | Toggle scoreboard table |
| `scoreboard` | `null` | Loaded lazily when `showScoreboard` becomes true |
| `loadingScoreboard` | `false` | Loading indicator |
| `focusGameId` | `null` | Auto-scroll target after confidence override |
| `clearedPicks` | `new Set()` | Game IDs explicitly cleared by user |
| `userGroups` | `[]` | All groups the user belongs to |
| `selectedGroups` | `new Set()` | Groups to save picks to |
| `loadingGroups` | `false` | |
| `groupMembers` | `[]` | All members of the current group |
| `loadingMembers` | `false` | |
| `selectedUserId` | `null` | null = current user, number = viewing another user |
| `showUserSelector` | `false` | Dropdown visibility |
| `showOwnerConfirmDialog` | `false` | Confirmation modal visibility |
| `pendingSaveAction` | `null` | Stored callback for deferred save |
| `currentUser` | `null` | From auth store subscription |
| `canEditSelectedUser` | `false` | Set by API response (`data.canEdit`) |
| `viewingOtherUser` | `false` | Reactive flag |
| `canSaveValue` | `false` | Internal, synced to exported `canSave` |

**Derived reactive (`$:`):**
- `sortedGames` — games with both a winner and confidence assigned, sorted descending by confidence
- `unsortedGames` — games not in `sortedGames`
- `weekGameCount = games.length`
- `canSave = canSaveValue` (sync to exported prop)
- `savingState = saving`
- `clearingState = clearing`
- `hasSortedPicks = sortedGames.length > 0`
- `hasMultipleGroups = userGroups && userGroups.length > 1`
- `currentWeek = week`
- `if (showScoreboard && !scoreboard && !loadingScoreboard) loadScoreboard()` — lazy scoreboard load

### 2b. API Service Calls

All calls from `picksService.js` via `authFetch` (auto-refreshes JWT on 401/403):

| Function | Endpoint | Called When |
|---|---|---|
| `getClosestWeek(groupIdentifier, season, seasonType)` | `GET /api/groups/{id}/picks/closest?season=&seasonType=` | `initWeek()` on mount, only if `week == null` |
| `getPicks(groupIdentifier, { season, seasonType, week })` | `GET /api/groups/{id}/picks?season=&seasonType=&week=` | `fetchPicks()` — normal user mode |
| `getUserPicks(groupIdentifier, userId, { season, seasonType, week })` | `GET /api/groups/{id}/picks/user/{userId}?season=&seasonType=&week=` | `fetchPicks()` — when `selectedUserId !== null` |
| `savePicks(groupId, body)` | `POST /api/groups/{id}/picks` | `doSaveInternal()` — called per selected group |
| `saveUserPicks(groupIdentifier, userId, body)` | `POST /api/groups/{id}/picks/user/{userId}` | `doSaveInternal()` — when `selectedUserId !== null` |
| `clearPicks(groupIdentifier, body)` | `POST /api/groups/{id}/picks/clear` | `doClear()` |
| `getScoreboard(groupIdentifier, { season, seasonType })` | `GET /api/groups/{id}/scoreboard?season=&seasonType=` | `loadScoreboard()` — when `showScoreboard` toggled on |

**From `groupsService.js`:**
| Function | Called When |
|---|---|
| `getMyGroups()` | `loadUserGroups()` on init |
| `getMembers(groupIdentifier)` | `loadGroupMembers()` on init |

### 2c. Week and Season Selector State Transitions

1. **Initialization** — `onMount` calls `initWeek()`:
   - Loads user groups and group members in parallel
   - Subscribes to auth store to capture `currentUser`
   - If `week === null`, calls `getClosestWeek()` to determine the most relevant week
   - Falls back to `week = 1` if `getClosestWeek` fails
   - Calls `fetchPicks()` after week is known

2. **Week change** — `<select bind:value={week} on:change={() => { week = Number(week); fetchPicks(); }}`
   - Parses to number on change (binding may supply string)
   - Immediately calls `fetchPicks()` — resets `draft`, `original`, `clearedPicks`

3. **User selection** — `changeSelectedUser(userId)`:
   - Sets `selectedUserId`
   - Clears `draft`, `original`, `clearedPicks`
   - Calls `fetchPicks()` which routes to `getUserPicks` path

4. **Refresh button** — calls `fetchPicks()` directly

5. **Auto-refresh** — `ensureAutoRefresh()` sets 60-second polling if any game is not final. Called from... (note: `ensureAutoRefresh` is defined but never explicitly called from `fetchPicks` in this code — it is defined but the call site is absent from the current code; it would need to be called after `fetchPicks` completes).

### 2d. Game Cards — Status, Odds, Lock State

PicksPanel delegates game rendering to `GamePickRow`. Status categories (same derivation as GamesPage):
| `game.status` | Derived label | Lock behavior |
|---|---|---|
| `'SCHEDULED'` | `'not started'` | Editable if `!game.meta.locked` |
| `'IN_PROGRESS'` | `'in progress'` | Locked (`game.meta.locked` is true) |
| `'FINAL'` | `'final'` | Locked (`game.meta.final` is true) |

The `game.meta.locked` and `game.meta.final` flags are the authoritative source for lock state (set by backend).

### 2e. Picks Draft State

**Data shape:**
```
draft = {
  [gameId: number]: {
    pickedTeamId: number | null,
    confidence: number | null
  }
}
```

**Assigning a winner (`toggleWinner(game, teamId)`):**
- Guards: view-only mode → error toast; locked game → error toast
- Removes `gameId` from `clearedPicks`
- If same team already selected AND no confidence → deletes `draft[gameId]` (deselect)
- If same team already selected AND has confidence → sets `pickedTeamId = null` only
- Otherwise sets `pickedTeamId = teamNum`
- Removes entry if both fields are null after mutation
- Forces Svelte reactivity via `draft = { ...draft }`

**Assigning confidence (`assignConfidence(game, value)`):**
- Guards: view-only mode → error toast; locked game → error toast
- Normalizes string → int
- No-op if value equals current confidence
- **Override logic**: if value is already used by another game, sets that game's confidence to `null` (winner preserved), triggers `focusGameId` auto-scroll for the bumped game
- Removes draft entry if both pickedTeamId and confidence are null after mutation

**Clearing a single pick (`handleClearPick(game)`):**
- Deletes `draft[gameId]`, spreads draft for reactivity
- Adds `gameId` to `clearedPicks` set

**`isDirty()`:** `JSON.stringify(draft) !== JSON.stringify(original)`

**`completePicks()`:** entries where both `pickedTeamId` and `confidence != null`

**`hasIncomplete()`:** entries where only one of the two fields is set

**`canSaveValue` logic:**
```
hasChanges = completePicks().length > 0 || clearedPicks.size > 0
canEdit = !viewingOtherUser || canEditSelectedUser
canSaveValue = hasChanges && canEdit && !saving
```

### 2f. Save Flow

**`doSave()`:**
1. If `isOwner && selectedUserId === currentUser?.id && hasLockedGames()` — shows `showOwnerConfirmDialog` modal, stores action in `pendingSaveAction`
2. Otherwise calls `doSaveInternal()` directly

**`doSaveInternal()`:**
1. Builds `picksPayload` — only complete picks (both team + confidence)
2. Builds `clearedGameIds` — Array from `clearedPicks`
3. **Override mode** (`selectedUserId !== null`): calls `saveUserPicks(groupIdentifier, selectedUserId, { season, seasonType, week, picks, clearedGameIds })`
4. **Normal mode**: iterates `selectedGroups` (or falls back to `[groupIdentifier]`), calls `savePicks(groupId, ...)` for each
   - If current group fails → throws (shows error)
   - If another group fails → `raiseError` warning toast (non-blocking)
   - Uses the result from the current group (`groupIdentifier`) to update UI state
5. After save: updates `games`, `availableConfidences`, `totalGames`, `weekPoints`, `original`, resets `draft` from `original`, clears `clearedPicks`, calls `recalcCanSave()`, sets `lastRefreshed`
6. Closes `showGroupSelector`

**`doClear()` (Clear All):**
- Calls `clearPicks(groupIdentifier, { season, seasonType, week })`
- On success: calls `fetchPicks()` to reload

### 2g. Multi-Group Save Logic

- `userGroups` loaded via `getMyGroups()` on init
- `selectedGroups` initialized as `new Set([groupIdentifier])` — current group pre-selected
- `hasMultipleGroups = userGroups.length > 1` — exposed to parent to show UI
- `showGroupSelector` controlled by parent via two-way binding; toggled by `toggleGroupSelector()`
- Group selector UI: checkbox per group, "Select All", "Deselect All", "Save to N groups" button
- `savePicksAction()` / `selectAllGroups()` / `deselectAllGroups()` / `getSelectedGroupsInfo()` are imperative exports for parent's sticky bar

### 2h. Conditional UI Branches (PicksPanel)

| Condition | Renders |
|---|---|
| `groupMembers.length > 0` | User selector dropdown control |
| `showUserSelector` | User selector dropdown panel |
| `selectedUserId !== null && canEditSelectedUser` | Amber "Owner Override Mode" banner |
| `selectedUserId !== null && !canEditSelectedUser` | Blue "View Only" banner |
| `error` non-empty | Red error div |
| `showErrorToast` | `<InlineToast>` (4-second auto-dismiss) |
| `showScoreboard` | Scoreboard section (else picks list) |
| `loadingScoreboard` | "Loading scoreboard..." text |
| `scoreboard` exists | Scoreboard table with user/week/total columns |
| `sortedGames.length > 0` | "Sorted Picks" section with `GamePickRow` per game |
| always (in else branch) | "Unsorted / Incomplete" section |
| `hasIncomplete()` | Amber hint text about incomplete picks |
| `showGroupSelector && userGroups.length > 1` | Group selector overlay dropdown |
| `showOwnerConfirmDialog` | Owner self-override confirmation modal |

---

## 3. GamePickRow.svelte

### 3a. Props

| Prop | Default | Description |
|---|---|---|
| `game` | required | Game object from server |
| `draft` | required | Full draft map from PicksPanel |
| `totalGames` | `0` | Drives confidence option count (1..totalGames) |
| `isSorted` | `false` | If true, show full confidence range even if incomplete |
| `focusGameId` | `null` | When matches `game.id`, scroll+pulse this row |
| `cleared` | `false` | When true, never fall back to server pick |
| `isOwnerOverride` | `false` | When true, allow editing even final games |

### 3b. Reactive Derived State

| Reactive var | Logic |
|---|---|
| `pick` | Merge of `draft[game.id]` and `game.pick`; if `cleared` → only draft; if `final && game.pick` → merge with points/won from server |
| `awayTeamId` / `homeTeamId` | `Number(game.awayTeam.id)` / `Number(game.homeTeam.id)` |
| `pickTeamId` | `pick?.pickedTeamId` normalized to number |
| `awaySelected` / `homeSelected` | Comparison of `pickTeamId` to team id |
| `final` | `game.meta.final` |
| `winnerTeamId` | Score comparison; `null` on tie |
| `pickWon` / `pickLost` | `final && pick?.won === true/false` |
| `isTie` | `final && winnerTeamId === null` |
| `displayedFinalValue` | `pick.points ?? pick.confidence ?? 0` (tie uses same) |
| `finalBadgeClass` | `'push'` / `'won'` / `'lost'` / `'no-pick'` |
| `resultLabel` | e.g. `"Won +5"`, `"Lost 3"`, `"Push - tie"` |
| `incomplete` | `pick && !(pickedTeamId && confidence != null)` |
| `localConfidence` | String form of confidence; synced down from `pick.confidence` |
| `showPicker` | `false` — popover visibility |
| `usedConfidences` | Set of confidences used by other games in draft |
| `allowedConfidences` | `1..totalGames`; filtered to unused if `!completePick && !isSorted` |
| `statusLabel` | `deriveStatus()` result |

### 3c. Confidence Picker Rendering (locked vs editable)

The confidence widget is in `.confidence-wrapper` and has three mutually exclusive branches:

```
{#if final && !isOwnerOverride}
  → .final-confidence div (read-only, color-coded: won/lost/push/no-pick)
{:else if !game.meta.locked}
  → .conf-button (clickable, opens .conf-popover with allowedConfidences)
{:else}
  → .locked div (read-only display of pick.confidence or '—')
{/if}
```

**Clear button** — shown when `(!game.meta.locked && statusLabel === 'not started') || isOwnerOverride` AND pick has at least one field set. Dispatches `clearPick`.

**Odds line** — shown only when `!final && game.status === 'SCHEDULED' && game.odds`.

**Result line** — shown when `final && pick` — shows `resultLabel` with won/lost/push styling.

### 3d. Events Dispatched

| Event | Detail | Trigger |
|---|---|---|
| `toggleWinner` | `Number(teamId)` | Click or keyboard (Enter/Space/Arrow) on team |
| `assignConfidence` | parsed int or `null` | Selecting from popover; also clearing confidence sets `null` |
| `clearPick` | none | Clear button click |

---

## 4. GroupPicks.svelte (designsystem stub — legacy)

This is a **prop-driven design system prototype**, not used in the active PicksPanel flow. Key differences:

- Props: `group`, `picks`, `games`, `isLoading`, `onUpdatePick`, `onSubmitPicks`, `onBack`
- State: `userPicks = {}` (keyed by `gameId`, value = confidence number), `hasChanges = false`
- Status constants: `'completed'`, `'in_progress'`, `'scheduled'` (lowercase snake — different from backend `'FINAL'`, `'IN_PROGRESS'`, `'SCHEDULED'`)
- No winner selection — only confidence (1–7, select dropdown)
- No draft/original diff logic, no multi-group save, no owner override
- Disabled when `game.status !== 'scheduled'`
- **This component is NOT used by PicksPanel or GamesPage** — it is a demo scaffold only

---

## 5. picksService.js — Full API Contract Summary

Base: `{AuthService.getApiBaseUrl()}/api/groups`

| Export | Method | Path | Body / Params |
|---|---|---|---|
| `getClosestWeek` | GET | `/{groupId}/picks/closest` | `?season=&seasonType=` |
| `getPicks` | GET | `/{groupId}/picks` | `?season=&seasonType=&week=` |
| `savePicks` | POST | `/{groupId}/picks` | `{ season, seasonType, week, picks: [{gameId, pickedTeamId, confidence}], clearedGameIds: [number] }` |
| `clearPicks` | POST | `/{groupId}/picks/clear` | `{ season, seasonType, week }` |
| `getScoreboard` | GET | `/{groupId}/scoreboard` | `?season=&seasonType=` |
| `getUserPicks` | GET | `/{groupId}/picks/user/{userId}` | `?season=&seasonType=&week=` |
| `saveUserPicks` | POST | `/{groupId}/picks/user/{userId}` | `{ season, seasonType, week, picks: [...], clearedGameIds: [...] }` |

All use `authFetch` — auto-refresh on 401/403 (one retry).

---

## 6. React Migration Notes

### GamesPage
- `onMount` → `useEffect(fetchGames, [])` on initial load
- `seasonType on:change` → onChange handler triggers fetch
- `$: totalWeeks` → derive in render or `useMemo`
- `$: if (selectedWeek > totalWeeks) selectedWeek = 1` → side effect in `useEffect([seasonType])`
- `forceRefresh` checkbox → `useState(false)`
- `teamStyle(team)` / `readableTextColor(hex)` → pure utility functions (no framework dependency)
- No auth required — plain `fetch()`

### PicksPanel
- Complex component — recommend splitting into:
  - `PicksPanel` (data/state layer, no JSX)
  - `GamePicksList` (sorted + unsorted sections)
  - `GroupSelectorDropdown`
  - `OwnerConfirmDialog`
  - `UserSelectorDropdown`
  - `ScoreboardTable`
- `draft` state is a plain object keyed by gameId — `useState({})` with spread-copy for mutation
- `clearedPicks` is a Set — `useRef(new Set())` (does not need to trigger re-renders directly; recalcCanSave recalculates canSave)
- `focusGameId` → `useState(null)` + `useEffect` in GamePickRow
- Imperative exports (`savePicksAction`, `clearAllAction`, `toggleGroupSelector`, etc.) → lift these as callbacks passed as props or via `useImperativeHandle` with `forwardRef`
- Exported bound props (`canSave`, `savingState`, etc.) → lift state up to parent and pass as props
- Auth store subscription → `useAuth()` hook
- `ensureAutoRefresh` → `useEffect` watching `games`; return cleanup to `clearInterval`

### GamePickRow
- `createEventDispatcher` → replace with callback props: `onToggleWinner`, `onAssignConfidence`, `onClearPick`
- All `$:` reactive statements → `useMemo` or derived in render
- `focusGameId` auto-scroll → `useEffect([focusGameId])` with `document.getElementById`
- `localConfidence` → `useState('')` with sync effect `useEffect([pick?.confidence])`
- `showPicker` → `useState(false)`

### Key Behavioral Requirements to Preserve
1. Confidence uniqueness enforced per-week: assigning a value bumps the previous holder; bumped game auto-scrolls
2. `clearedPicks` set prevents server pick fallback for explicitly cleared games
3. Save payload includes both `picks` (complete) AND `clearedGameIds` (cleared) — backend needs both
4. Multi-group save iterates groups sequentially; current group failure throws, other groups log warnings
5. Owner override mode: owner can view AND edit any member's picks; `canEdit` flag comes from API response
6. Owner self-override for locked games requires explicit modal confirmation
7. Status classification: `game.meta.locked` / `game.meta.final` are the authoritative lock flags (not just `game.status`)
8. Odds displayed only for SCHEDULED games; probability only for IN_PROGRESS games
9. Auto-refresh (60s) when any game is not final — cleanup on unmount
10. `getClosestWeek` determines initial week; falls back to 1 on failure
