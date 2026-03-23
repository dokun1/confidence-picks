# InvitePage & EditGroupPage Analysis

## InvitePage.svelte

### 1. Reactive Variables and Initial Values

| Variable    | Type      | Initial Value | Purpose                                  |
|-------------|-----------|---------------|------------------------------------------|
| `token`     | prop      | `''`          | Invite token passed from router          |
| `loading`   | `boolean` | `true`        | Controls loading skeleton UI             |
| `invite`    | `object`  | `null`        | Full invite + group data from API        |
| `error`     | `string`  | `null`        | Error message string or null             |
| `accepting` | `boolean` | `false`       | Disables accept button during API call   |

### 2. API Service Calls

**`invitesService.js`**

| Function         | Endpoint                                  | Method | Auth Required | Called When                    |
|------------------|-------------------------------------------|--------|---------------|--------------------------------|
| `getInvite(token)` | `GET /api/invites/:token`               | GET    | Optional (Bearer if present) | `onMount` via `load()`   |
| `acceptInvite(token)` | `POST /api/invites/:token/accept`   | POST   | Required      | `handleAccept()` when authenticated |

Notes on `getInvite`:
- 404 → throws `'Invitation not found'`
- Non-ok → throws `'Failed to load invitation'`
- Returns: `{ valid, reason?, alreadyMember, group: { name, identifier, ownerName, ownerPictureUrl, description, memberCount, maxMembers }, invite: { remainingUses } }`

Notes on `acceptInvite`:
- Non-ok → throws `data.error || 'Failed to accept invite'`
- Returns: `{ groupIdentifier }` (used to navigate post-accept)

### 3. Two Distinct User Flows

#### Flow A — Authenticated Accept
1. `onMount` → `load()` → `getInvite(token)` → `invite` state set
2. User clicks "Accept & Join" → `handleAccept()`
3. `AuthService.getToken()` returns a token → proceed
4. Set `accepting = true`, call `acceptInvite(token)`
5. On success: `navigateTo('/groups/' + res.groupIdentifier)`
6. On error: set `error`, clear `accepting`

#### Flow B — Unauthenticated Preview + Post-Login Auto-Accept
1. `onMount` → `load()` → `getInvite(token)` (no auth header, still works for public invite data)
2. User clicks "Accept & Join" → `handleAccept()`
3. `AuthService.getToken()` returns falsy → persist intent:
   - `sessionStorage.setItem('postLoginRedirect', window.location.pathname)` — e.g. `/invite/<token>`
   - `sessionStorage.setItem('postLoginInviteToken', token)`
4. `navigateTo('/login')` — user authenticates via Google/Apple OAuth
5. **AuthCallback.svelte** handles the OAuth return:
   - Reads `postLoginInviteToken` from sessionStorage
   - Removes `postLoginInviteToken`, sets `autoAcceptInviteToken = token`
   - Sets navigation `target = '/invite/<token>'`
   - Clears `postLoginRedirect`
   - After 400ms delay, `navigateTo('/invite/<token>')`
6. InvitePage mounts again → `load()` fetches invite data
7. `onMount` checks `sessionStorage.getItem('autoAcceptInviteToken')`
8. If `autoToken === token` AND `AuthService.getToken()` is set AND `invite.valid` AND `!invite.alreadyMember`:
   - Removes `autoAcceptInviteToken` from sessionStorage
   - Calls `handleAccept()` automatically (fire-and-forget)

### 4. How the Invite Token is Extracted from the URL

**Router (`router.js` line 38-39):**
```javascript
} else if (path.startsWith('/invite/') && path.split('/').length === 3) {
    return path; // invite landing page
```

**App.svelte (line 341-342):**
```svelte
{:else if $currentRoute.startsWith('/invite/') && $currentRoute.split('/').length === 3}
  <InvitePage token={$currentRoute.split('/')[2]} />
```

The token is the third path segment extracted via `split('/')[2]` from the current route string stored in the `$currentRoute` Svelte store.

### 5. Conditional UI Branches

| Condition                              | UI Rendered                                                     |
|----------------------------------------|-----------------------------------------------------------------|
| `loading === true`                     | Animated pulse skeleton (3 divs of varying widths)             |
| `error !== null`                       | "Invitation Error" heading + `error` message + "Go to Groups" button |
| `invite !== null && !invite.valid`     | "Invite Unavailable" + `invite.reason` + "Browse Groups" button |
| `invite !== null && invite.valid && invite.alreadyMember` | Full group preview + single "Go to Group" button (navigates to group) |
| `invite !== null && invite.valid && !invite.alreadyMember` | Full group preview + "Accept & Join" (disabled when `accepting`) + "Decline" button |
| `invite.group.description` present    | Description paragraph rendered inside valid invite card        |
| `invite.invite.remainingUses != null`  | "N uses left" appended to member count stats row               |

---

## EditGroupPage.svelte

### 1. Reactive Variables and Initial Values

| Variable         | Type      | Initial Value | Purpose                                          |
|------------------|-----------|---------------|--------------------------------------------------|
| `groupId`        | prop      | (required)    | Group identifier string passed from router       |
| `isLoading`      | `boolean` | `false`       | Controls "Loading group..." placeholder          |
| `isSaving`       | `boolean` | `false`       | Passed to form as `isLoading` prop               |
| `error`          | `string`  | `null`        | Error banner message                             |
| `group`          | `object`  | `null`        | Full group object from API                       |
| `showDeleteModal`| `boolean` | `false`       | Controls `ConfirmDeleteModal` open state         |
| `deleting`       | `boolean` | `false`       | Passed to modal as `loading`, disables delete btn|

### 2. API Service Calls

**`groupsService.js`**

| Function                      | Endpoint                        | Method | Called When                     |
|-------------------------------|---------------------------------|--------|---------------------------------|
| `getGroup(groupId)`           | `GET /api/groups/:id`           | GET    | `onMount` via `loadGroup()`     |
| `updateGroup(identifier, updates)` | `PATCH /api/groups/:id`    | PATCH  | `handleSubmit()` on form save   |
| `deleteGroup(identifier)`     | `DELETE /api/groups/:id`        | DELETE | `handleDeleteConfirm()` on modal confirm |

### 3. Pre-filled Form Initialization

1. `onMount` calls `loadGroup()`
2. `loadGroup()` sets `isLoading = true`, calls `getGroup(groupId)`
3. On success: `group` is set to the API response
4. Authorization check: if `!group.userRole || group.userRole !== 'admin'`, sets `error = 'You are not authorized to edit this group'` — form is hidden (see conditional UI)
5. `CreateGroupForm` receives `initialValues`:
   ```svelte
   initialValues={{ name: group.name, identifier: group.identifier, description: group.description }}
   ```
   The identifier field is intentionally read-only (comment: "Identifier is immutable for now")

### 4. Save Flow

1. `CreateGroupForm` calls `onSubmit(formData)` → `handleSubmit(formData)`
2. Builds `updates` object — **only includes changed fields**:
   - `name`: included if `formData.name` is truthy AND differs from `group.name`
   - `description`: always included if differs (normalizes empty string: `formData.description || ''`)
   - `identifier`: intentionally excluded (immutable)
3. If `Object.keys(updates).length === 0`: sets `error = 'No changes to save'` and returns early
4. Calls `updateGroup(group.identifier, updates)`
5. On success: merges updated fields into `group` state (`group = { ...group, ...updated }`)
6. Navigates to `/groups/${group.identifier}`
7. On error: sets `error` to thrown message

### 5. Delete Confirmation Flow

1. User clicks "Delete Group" button → sets `showDeleteModal = true`
2. `ConfirmDeleteModal` opens with props:
   - `open={showDeleteModal}`
   - `name={group?.name}`
   - `slug={group?.identifier}`
   - `loading={deleting}`
   - `error={error && deleting ? error : null}` — only passes error when actively deleting
3. User cancels modal (`on:cancel`): if `!deleting`, sets `showDeleteModal = false`
4. User confirms modal (`on:confirm`) → `handleDeleteConfirm()`:
   - Sets `deleting = true`
   - Calls `deleteGroup(group.identifier)`
   - On success: `navigateTo('/groups')` (back to groups list)
   - On error: sets `error`, clears `deleting`, closes modal (`showDeleteModal = false`)
   - `finally`: always clears `deleting = false` and `showDeleteModal = false`

### 6. Conditional UI Branches

| Condition                              | UI Rendered                                                       |
|----------------------------------------|-------------------------------------------------------------------|
| `error !== null`                       | Error banner with icon, "Cannot Edit Group" heading + `error` text (shown regardless of load state) |
| `isLoading === true`                   | "Loading group..." centered text                                  |
| `group !== null && !error`             | `CreateGroupForm` with pre-filled values + "Danger Zone" section  |
| `isLoading === false && !group`        | Nothing (empty — only reachable if `loadGroup` fails silently)    |
| `showDeleteModal === true`             | `ConfirmDeleteModal` overlay rendered                             |
| `deleting === true`                    | Delete button shows "Deleting..." and is disabled                 |
| `isSaving === true`                    | Passed to `CreateGroupForm` as `isLoading` (disables form submit) |

---

## Key React Migration Notes

### InvitePage
- `export let token` → prop from `<Route path="/invite/:token">` via `useParams()`
- `onMount` → `useEffect(() => { load(); autoAcceptCheck(); }, [])`
- `sessionStorage` usage is framework-agnostic — ports directly
- `AuthService.getToken()` check ports directly (static service class)
- Two-phase auto-accept: the `autoAcceptInviteToken` sessionStorage key bridges AuthCallback → InvitePage

### EditGroupPage
- `export let groupId` → `useParams()` (router prop)
- `onMount(loadGroup)` → `useEffect(() => { loadGroup(); }, [groupId])`
- Admin authorization check happens in `loadGroup`, not a route guard
- `CreateGroupForm` must support `initialValues` and `onSubmit`/`onCancel` callback props
- `ConfirmDeleteModal` uses Svelte event dispatching (`on:cancel`, `on:confirm`) → React callback props (`onCancel`, `onConfirm`)
- `error` banner is always rendered if set, even when `isLoading` is also true (error takes precedence visually)
