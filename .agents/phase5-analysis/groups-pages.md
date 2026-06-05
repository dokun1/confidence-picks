# Groups Pages Analysis

Source files:
- `frontend/src/components/GroupsPage.svelte`
- `frontend/src/components/GroupDetailsPage.svelte`

---

## GroupsPage.svelte

### 1. Reactive Variables and Initial Values

| Variable | Initial Value | Purpose |
|---|---|---|
| `groups` | `[]` | Array of user's groups |
| `isLoading` | `false` | Loading state for fetch |
| `error` | `null` | Error message string |
| `deleting` | `false` | In-flight state for delete action |
| `showDeleteModal` | `false` | Controls ConfirmDeleteModal visibility |
| `groupPendingDelete` | `null` | Group object staged for deletion |

### 2. API Service Calls

| Function | Import | Trigger | Response Mapping |
|---|---|---|---|
| `getMyGroups()` | `groupsService.js` | `onMount` → `loadGroups()` | Assigns returned array directly to `groups` |
| `leaveGroup(identifier)` | `groupsService.js` | `handleLeaveGroup` after `confirm()` | On success, filters group out of `groups` array |
| `deleteGroup(identifier)` | `groupsService.js` | `confirmDelete()` (modal confirm event) | On success, filters group out of `groups` array, closes modal |

### 3. User Interaction Handlers

| Handler | Trigger | Action |
|---|---|---|
| `handleCreateNew()` | Button click | `navigateTo('/groups/create')` |
| `handleJoinExisting()` | Button click | `navigateTo('/groups/join')` |
| `handleViewGroup(group)` | GroupsList callback | `navigateTo('/groups/${group.identifier}')` |
| `handleEditGroup(group)` | GroupsList callback | `navigateTo('/groups/${group.identifier}/edit')` |
| `handleLeaveGroup(group)` | GroupsList callback | `confirm()` → `leaveGroup()` → filter local state |
| `handleDeleteGroup(group)` | GroupsList callback | Guard: `isOwner` only; sets `groupPendingDelete`, opens modal |
| `confirmDelete()` | ConfirmDeleteModal `confirm` event | Calls `deleteGroup()`, filters local state, closes modal |
| `loadGroups()` | "Try Again" button in error banner | Re-fetches groups, resets `isLoading`/`error` |
| Modal cancel | ConfirmDeleteModal `cancel` event | Closes modal (blocked if `deleting`) |

### 4. Conditional UI Branches

| State | Condition | Rendered Content |
|---|---|---|
| **Error** | `error` is truthy | Error banner with message + "Try Again" button |
| **Loading / Success** | Delegated to `GroupsList` component | `GroupsList` receives `isLoading` and `groups` props |
| **Delete modal** | `showDeleteModal === true` | `ConfirmDeleteModal` with group name/identifier |

### 5. Derived / Computed Values

None. All values are plain reactive variables. The error display on the modal uses inline expression: `error && deleting ? error : null`.

---

## GroupDetailsPage.svelte

### 1. Reactive Variables and Initial Values

#### Core / Global

| Variable | Initial Value | Purpose |
|---|---|---|
| `groupId` | `''` (prop) | Identifier passed from router |
| `group` | `null` | Mapped group object after load |
| `members` | `[]` | Members array |
| `messages` | `[]` | Messages array |
| `isLoading` | `false` | Loading state for initial page load |
| `error` | `null` | Error message string |
| `activeTab` | `'leaderboard'` | Currently active tab |
| `showCopyToast` | `false` | Controls identifier-copied toast |

#### Leaderboard Tab

| Variable | Initial Value | Purpose |
|---|---|---|
| `leaderboardLoading` | `false` | Loading state for leaderboard fetch |
| `leaderboardError` | `''` | Error message for leaderboard |
| `leaderboardUsers` | `[]` | Sorted array of user score objects |
| `leaderboardLoaded` | `false` | Guard to prevent duplicate fetches |
| `currentSeason` | `getCurrentNFLSeason()` | Computed once at module level |
| `currentSeasonType` | `2` | Hardcoded to regular season |

#### Messages Tab

| Variable | Initial Value | Purpose |
|---|---|---|
| `newMessage` | `''` | Controlled input value |
| `isPostingMessage` | `false` | Submission in-flight guard |

#### Members Tab

No additional state — uses shared `members` array loaded on mount.

#### Picks Tab

| Variable | Initial Value | Purpose |
|---|---|---|
| `picksPanelRef` | `undefined` | Bind ref to `PicksPanel` for imperative calls |
| `canSave` | `false` | Bound from `PicksPanel` — enables Save button |
| `savingState` | `false` | Bound from `PicksPanel` — in-flight save |
| `clearingState` | `false` | Bound from `PicksPanel` — in-flight clear |
| `hasSortedPicks` | `false` | Bound from `PicksPanel` — enables Clear button |
| `hasMultipleGroups` | `false` | Bound from `PicksPanel` — shows split-button UI |
| `showGroupSelector` | `false` | Bound from `PicksPanel` — dropdown open state |
| `currentWeek` | `null` | Bound from `PicksPanel` — used in Clear confirmation text |

#### Invite / Leave

| Variable | Initial Value | Purpose |
|---|---|---|
| `inviteCreating` | `false` | In-flight state for invite creation |
| `inviteError` | `null` | Error message for invite creation |
| `lastInviteUrl` | `null` | Caches last created invite URL |
| `showLeaveModal` | `false` | Controls leave-group modal visibility |
| `leaving` | `false` | In-flight state for leave action |
| `leaveError` | `null` | Error message for leave action |

### 2. API Service Calls

| Function | Import | Trigger | Response Mapping |
|---|---|---|---|
| `getGroup(groupId)` | `groupsService.js` | `onMount` → `loadGroupData()` | Maps to `group` object: `{ id, name, identifier, description, memberCount, isOwner (userRole==='admin'), createdAt }` |
| `getMembers(groupId)` | `groupsService.js` | `onMount` → `loadGroupData()` (parallel) | Assigned directly to `members` |
| `getMessages(groupId)` | `groupsService.js` | `onMount` → `loadGroupData()` (parallel) | Assigned directly to `messages` |
| `apiPostMessage(groupId, text)` | `groupsService.js` | Form submit → `postMessage()` | Prepends returned message to `messages` array |
| `getScoreboard(identifier, { season, seasonType })` | `picksService.js` | Reactive statement when `activeTab === 'leaderboard'` (lazy, once) | Maps `data.users`, sorts by `totalPoints` desc → `leaderboardUsers` |
| `createLinkInvite(identifier, {})` | `invitesService.js` | `shareInvite()` / `copyInviteLink()` (owner only) | Returns `{ joinUrl }` → `lastInviteUrl` |
| `leaveGroup(identifier)` | `groupsService.js` | `handleLeaveGroup()` (after modal confirm) | On success: `navigateTo('/groups')` |

All three initial fetches (`getGroup`, `getMembers`, `getMessages`) run in `Promise.all`.

### 3. User Interaction Handlers

| Handler | Trigger | Action |
|---|---|---|
| Tab buttons (4) | Click | Sets `activeTab` to `'leaderboard'`, `'picks'`, `'messages'`, or `'members'` |
| Back button | Click | `navigateTo('/groups')` |
| `copyGroupIdentifier()` | Button click | Writes `group.identifier` to clipboard; toggles `showCopyToast` via `requestAnimationFrame` |
| Edit Group button | Click (owner only) | `navigateTo('/groups/${identifier}/edit')` |
| `shareInvite()` | Button click (owner only) | Creates link invite → uses `navigator.share` if available, else clipboard |
| `copyInviteLink()` | — (called from `shareInvite` fallback path) | Reuses `lastInviteUrl` or creates new invite; copies to clipboard |
| `postMessage()` | Form submit | `apiPostMessage()` → prepends to `messages`, clears `newMessage` |
| `loadLeaderboard()` | Reactive statement + Refresh button | Fetches scoreboard, sorts users |
| Leaderboard Refresh button | Click | Calls `loadLeaderboard()` directly |
| "Make Picks" quick action | Click | Sets `activeTab = 'picks'` |
| "View Messages" quick action | Click | Sets `activeTab = 'messages'` |
| "Leave Group" button | Click (non-owner only) | Opens `showLeaveModal` |
| Leave modal confirm | Event | Calls `handleLeaveGroup()` |
| Leave modal cancel | Event | Closes modal (blocked if `leaving`) |
| Save Picks button | Click | Calls `picksPanelRef.savePicksAction()` imperatively |
| Save Picks dropdown | Click (multi-group) | Calls `picksPanelRef.toggleGroupSelector()` imperatively |
| Clear All button | Click | `confirm()` dialog → `picksPanelRef.clearAllAction()` imperatively |
| "How To Play" button | Click | `navigateTo('/about')` |

### 4. Conditional UI Branches

#### Page-level

| State | Condition | Rendered Content |
|---|---|---|
| **Loading** | `isLoading === true` | Animated skeleton (pulse) layout |
| **Error** | `error` is truthy (after load) | "Group Not Found" centered message + "Back to Groups" button |
| **Success** | `group` is truthy | Full group details UI with tabs |

#### Leaderboard Tab

| State | Condition | Rendered Content |
|---|---|---|
| **Error** | `leaderboardError` truthy | Inline error text |
| **Loading** | `leaderboardLoading && !leaderboardLoaded` | "Loading leaderboard…" text |
| **Empty** | `leaderboardUsers.length === 0` | "No points yet." text |
| **Success** | `leaderboardUsers.length > 0` | Ranked list with Avatar, name, totalPoints |
| **Owner actions** | `group.isOwner` | Shows "Edit Group" + "Share Invite" buttons in Quick Actions |
| **Non-owner actions** | `!group.isOwner` | Shows "Leave Group" button |

#### Picks Tab

| State | Condition | Rendered Content |
|---|---|---|
| **Multi-group save** | `hasMultipleGroups` | Split button (main + dropdown trigger) |
| **Single-group save** | `!hasMultipleGroups` | Single Save Picks button |
| Save button disabled | `!canSave || savingState` | Button disabled |
| Clear button disabled | `clearingState || !hasSortedPicks` | Button disabled |
| Picks content | Always | `PicksPanel` component with bound state |

#### Messages Tab

| State | Condition | Rendered Content |
|---|---|---|
| **Empty** | No explicit — messages list renders empty `div` | No empty-state message (messages array empty = empty list) |
| **Send button disabled** | `!newMessage.trim() || isPostingMessage` | Button disabled |

#### Members Tab

| State | Condition | Rendered Content |
|---|---|---|
| **Owner sidebar** | `group.isOwner` | "Invite New Members" panel with identifier + copy button |
| **Owner badge** | `member.isOwner` | "Owner" badge shown per row |

### 5. Derived / Computed Values

| Value | How Derived |
|---|---|
| `currentSeason` | `getCurrentNFLSeason()` called once at module init (not reactive) |
| `leaderboardUsers` | Sorted copy of `data.users` from API (`slice().sort(...)` by `totalPoints` desc) |
| Tab badge counts | Inline expressions in tab labels: `messages.length`, `members.length` |
| `group.isOwner` | Derived at mapping time from `groupResp.userRole === 'admin'` |
| Reactive leaderboard load | `$: if (activeTab === 'leaderboard' && group && !leaderboardLoaded && !leaderboardLoading) loadLeaderboard()` — lazy load once on first tab visit |
| Invite error display | `inviteError` shown only when `inviteCreating` is false (after the finally block) |
| Leave modal error | `leaveError` shown inside modal footer |
