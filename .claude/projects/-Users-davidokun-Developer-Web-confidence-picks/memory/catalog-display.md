# Design System Catalog: Navigation, GroupCard, GroupsList

Scanned from Svelte source files in `frontend/src/designsystem/components/`.
Date: 2026-03-23

---

## Navigation

**Source**: `Navigation.svelte`, `Navigation.md`

### Exported Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `currentRoute` | `string` | `'/'` | Used by `isActive()` to highlight nav item |
| `displayName` | `string \| null` | `null` | Legacy backward-compat prop (string name) |
| `user` | `object \| null` | `null` | Full user object: `{ id, name, email, pictureUrl }` |
| `showThemeToggle` | `boolean` | `true` | Conditionally renders theme toggle button |
| `darkMode` | `boolean` | `false` | Controls sun/moon icon swap |

> **Note**: The `.md` doc lists `userName` as the prop name but the Svelte source uses `displayName`. The source is authoritative.

### Events Dispatched

| Event | Detail Shape | Trigger |
|-------|-------------|---------|
| `navigate` | `{ href: string }` | Any nav item click, Sign In click |
| `themeToggle` | `{ darkMode: boolean }` | Theme toggle button click (passes negated current value) |
| `mobileMenuToggle` | `{ open: boolean }` | Hamburger toggle button click |
| `signOut` | _(no detail)_ | "Sign Out" user menu item click |

### Internal State

| Variable | Type | Purpose |
|----------|------|---------|
| `userMenuOpen` | `boolean` | Controls user dropdown visibility |
| `mobileMenuOpen` | `boolean` | Controls slide-out sidebar visibility |
| `avatarSources` | `string[]` | Google avatar URL fallback chain |
| `avatarIndex` | `number` | Current index in fallback chain |
| `avatarFailed` | `boolean` | Falls back to initials avatar |

### Navigation Items (hardcoded)

```js
[
  { label: 'Home',   href: '/',      icon: 'home' },
  { label: 'Groups', href: '/groups', icon: 'user-group', requiresAuth: true },
  { label: 'About',  href: '/about',  icon: 'information-circle' }
]
```
"Groups" is filtered out when `displayName` is falsy (unauthenticated guest).

### User Menu Items (hardcoded, shown when authenticated)

```js
[
  { label: 'Profile',  href: '/profile',  icon: 'user' },
  { label: 'Sign Out', action: 'signOut', icon: 'arrow-right-on-rectangle' }
]
```

### `isActive()` Logic

```js
currentRoute === href || (href !== '/' && currentRoute.startsWith(href))
```

### Active State Classes (nav items)

```
text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900
```

### Inactive/Default State Classes (nav items)

```
text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50
dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800
```

### Tailwind Classes — Full Inventory

**`<nav>` root:**
```
mobile-menu-container bg-neutral-0 dark:bg-secondary-900
border-b border-secondary-200 dark:border-secondary-700
transition-colors duration-fast
```

**Inner container:**
```
max-w-7xl mx-auto px-sm sm:px-md lg:px-lg
```

**Flex row:**
```
flex justify-between h-[4rem]
```

**Logo area:**
```
flex items-center
```

**Logo icon box:**
```
w-[2rem] h-[2rem] bg-primary-500 rounded-base mr-xs flex items-center justify-center
```

**Logo SVG:**
```
w-[1.25rem] h-[1.25rem] text-neutral-0
```

**Brand text:**
```
text-xl font-heading font-bold text-secondary-900 dark:text-neutral-0
```

**Mobile hamburger button:**
```
md:hidden mr-xs p-xs rounded-base text-secondary-600 hover:text-secondary-900
hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100
dark:hover:bg-secondary-800 transition-colors duration-fast
focus:outline-none focus:ring-1 focus:ring-primary-500
```

**Desktop nav container:**
```
hidden md:flex md:items-center md:space-x-lg
```

**Desktop nav item button (inactive):**
```
flex items-center px-xs py-xxxs rounded-base text-sm font-medium transition-colors duration-fast
text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50
dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800
```

**Desktop nav item button (active):**
```
flex items-center px-xs py-xxxs rounded-base text-sm font-medium transition-colors duration-fast
text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900
```

**Nav item icon SVG:**
```
w-[1rem] h-[1rem] mr-xs
```

**Right-side controls:**
```
flex items-center space-x-xs
```

**Theme toggle button:**
```
p-xs rounded-base text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100
dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800
transition-colors duration-fast focus:outline-none focus:ring-1 focus:ring-primary-500
```

**Theme toggle SVG:**
```
w-[1.25rem] h-[1.25rem]
```

**User menu trigger button:**
```
flex items-center p-xs rounded-base text-secondary-600 hover:text-secondary-900
hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100
dark:hover:bg-secondary-800 transition-colors duration-fast
focus:outline-none focus:ring-1 focus:ring-primary-500
```

**Avatar image (when pictureUrl):**
```
w-[2rem] h-[2rem] rounded-full object-cover mr-xs
border border-primary-100 dark:border-primary-800
```

**Avatar fallback (initials):**
```
w-[2rem] h-[2rem] bg-primary-500 rounded-full flex items-center justify-center mr-xs
```
Inner `<span>`: `text-sm font-medium text-neutral-0`

**User display name (desktop):**
```
hidden lg:block text-sm font-medium mr-xs
```

**Chevron icon (rotates when open):**
```
w-[1rem] h-[1rem] transition-transform duration-fast [rotate-180 when open]
```

**User dropdown panel:**
```
absolute right-0 mt-xs w-[12rem] bg-neutral-0 dark:bg-secondary-800
rounded-md shadow-lg border border-secondary-200 dark:border-secondary-700 py-xs z-50
```

**User dropdown item button:**
```
flex items-center w-full px-sm py-xs text-left text-sm
text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50
dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700
transition-colors duration-fast
```

**Sign In button (unauthenticated):**
```
px-sm py-xs bg-primary-500 text-neutral-0 rounded-base text-sm font-medium
hover:bg-primary-600 transition-colors duration-fast
focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1
```

**Mobile overlay:**
```
fixed inset-0 bg-secondary-900 bg-opacity-50 z-40 md:hidden
```

**Mobile sidebar (`<aside>`):**
```
mobile-menu-container fixed top-0 left-0 w-64 h-full
bg-neutral-50 dark:bg-secondary-800
border-r border-secondary-200 dark:border-secondary-700
transform transition-transform duration-300 ease-in-out z-50 md:hidden pt-16 p-md
[translate-x-0 when open | -translate-x-full when closed]
```

**Mobile close button:**
```
absolute top-4 right-4 p-2 rounded-base text-secondary-600 hover:text-secondary-900
hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100
dark:hover:bg-secondary-700 focus:outline-none focus:ring-1 focus:ring-primary-500
```
SVG: `w-5 h-5`

**Mobile nav section heading:**
```
text-xs font-semibold tracking-wide uppercase text-secondary-500 dark:text-secondary-400
```

**Mobile nav item (inactive):**
```
flex items-center w-full px-sm py-xs rounded-base text-left text-sm font-medium
transition-colors duration-fast
text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50
dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700
```

**Mobile nav item (active):**
```
flex items-center w-full px-sm py-xs rounded-base text-left text-sm font-medium
transition-colors duration-fast
text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900
```

**Mobile nav item icon:**
```
w-[1rem] h-[1rem] mr-sm
```

**Mobile theme toggle section:**
```
mt-lg pt-md border-t border-secondary-200 dark:border-secondary-700
```
Button: same as mobile nav item (inactive)

**Mobile account section:**
```
mt-md
```
Heading: `text-xs font-semibold tracking-wide uppercase text-secondary-500 dark:text-secondary-400 mb-xxs`

### Icons Used (inline SVG paths, no external icon library)

| Name | Used For |
|------|---------|
| `home` | Home nav item |
| `user-group` | Groups nav item |
| `information-circle` | About nav item |
| `cog-6-tooth` | (defined in map, not rendered in nav items) |
| `user` | Profile user menu item |
| `arrow-right-on-rectangle` | Sign Out user menu item |
| `bars-3` | (defined but unused — hamburger uses inline SVG `M4 6h16M4 12h16M4 18h16`) |
| `x-mark` | Mobile sidebar close button |
| `trophy` | Logo / brand icon |

### Visual States Summary

| State | Where |
|-------|-------|
| Active nav item | Primary color text + bg tint (desktop + mobile) |
| Inactive nav item | Secondary text, hover bg |
| Authenticated (has `displayName`\|`user`) | Shows avatar + name + dropdown |
| Unauthenticated | Shows "Sign In" button; hides auth-required nav items |
| `darkMode=true` | Moon icon shown in theme toggle |
| `darkMode=false` | Sun icon shown in theme toggle |
| `userMenuOpen=true` | Dropdown panel rendered, chevron rotated 180° |
| `mobileMenuOpen=true` | Overlay rendered, sidebar translated in |
| Avatar load failure | Falls back through URL variants, then initials div |

### Sub-components Imported

None — Navigation renders its own inline SVGs. No design system components used.

---

## GroupCard

**Source**: `GroupCard.svelte`, `GroupCard.md`

### Exported Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `group` | `object` | `{ id:'', name:'', identifier:'', description:'', memberCount:0, isOwner:false, createdAt:'' }` | Full group data; `createdByName` and `createdByPictureUrl` are optional fields not in default |
| `onView` | `() => void` | `() => {}` | Called on "View Group" button click |
| `onEdit` | `() => void` | `() => {}` | Called on "Edit" button click (owner only) |
| `onLeave` | `() => void` | `() => {}` | Called on "Leave Group" button click (member only) |
| `onDelete` | `() => void` | `() => {}` | Called on "Delete" button click (owner only) |

### Group Object Shape

```ts
{
  id: string;
  name: string;
  identifier: string;        // URL-friendly join code
  description?: string;      // Optional; section omitted when empty
  memberCount: number;
  isOwner: boolean;
  createdAt: string;         // ISO date string
  createdByName?: string;    // Optional; shows avatar row when present + !isOwner
  createdByPictureUrl?: string; // Optional; passed to Avatar
}
```

### Tailwind Classes — Full Inventory

**Root card div:**
```
bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow
```

**Header block:**
```
flex flex-col mb-4
```

**Group name `<h3>`:**
```
text-lg font-semibold text-gray-900 mb-1 truncate sm:whitespace-normal leading-snug
```
Inline style: `word-break:keep-all; overflow-wrap:break-word;`

**Identifier `<p>`:**
```
text-sm text-gray-500 mb-2 break-all sm:break-normal
```
Inline style: `overflow-wrap:anywhere;`

**Description `<p>` (conditional on `group.description`):**
```
text-gray-600 text-sm mb-3 leading-snug line-clamp-3 sm:line-clamp-none
```
Inline style: `overflow-wrap:break-word;`

**Badge row:**
```
flex flex-row flex-wrap gap-2 mt-1
```

**"Owner" badge:**
```
inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800
```

**"Member" badge:**
```
inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800
```

**Meta row (member count + date):**
```
flex flex-col xs:flex-row xs:justify-between xs:items-center mb-4 gap-1
```
Each cell: `text-sm text-gray-500 break-words`; member count value: `font-medium`

**Creator avatar row (conditional: `createdByName && !isOwner`):**
```
flex items-center gap-2 mb-4
```
Label text: `text-xs text-gray-500`; name span: `font-medium text-gray-700`; "Created by" span: `text-gray-600`

**Actions container:**
```
flex flex-col gap-2
```

### Conditional Rendering Logic

```
Always: "View Group" button (primary, sm, w-full)

If isOwner:
  "Edit" button     (secondary,    sm, w-full)
  "Delete" button   (destructive,  sm, w-full)

If !isOwner:
  "Leave Group" button (tertiary, sm, w-full)
```

### Visual States

| State | Description |
|-------|-------------|
| Owner | Blue "Owner" badge; Edit + Delete actions shown |
| Member | Green "Member" badge; Leave action shown |
| Has description | Description paragraph rendered |
| No description | Description paragraph omitted |
| Has `createdByName` and not owner | Avatar + creator info row rendered |
| Card hover | `shadow-md` (elevated shadow via Tailwind `hover:shadow-md`) |

### Sub-components Imported

| Component | Import Path | Usage |
|-----------|-------------|-------|
| `Button` | `./Button.svelte` | "View Group", "Edit", "Delete", "Leave Group" buttons |
| `Avatar` | `./Avatar.svelte` | Creator avatar row (`variant="sm"`, receives `name` + `pictureUrl`) |

### Implicit Prop Contract with Avatar

```svelte
<Avatar name={group.createdByName} pictureUrl={group.createdByPictureUrl} variant="sm" />
```
Avatar receives `name: string`, `pictureUrl: string | undefined`, `variant: "sm"`.

### Event Handlers

No Svelte `dispatch` events. All actions are plain callback props (`onView`, `onEdit`, `onLeave`, `onDelete`) called directly.

---

## GroupsList

**Source**: `GroupsList.svelte`, `GroupsList.md`

### Exported Props

| Prop | Type | Default | Notes |
|------|------|---------|-------|
| `groups` | `Group[]` | `[]` | Array of group objects (same shape as GroupCard's `group`) |
| `isLoading` | `boolean` | `false` | Shows spinner when true |
| `onCreateNew` | `() => void` | `() => {}` | "Create Group" button |
| `onJoinExisting` | `() => void` | `() => {}` | "Join Group" button |
| `onViewGroup` | `(group: Group) => void` | `() => {}` | Passed through to GroupCard |
| `onEditGroup` | `(group: Group) => void` | `() => {}` | Passed through to GroupCard |
| `onLeaveGroup` | `(group: Group) => void` | `() => {}` | Wrapped with `window.confirm` before calling |
| `onDeleteGroup` | `(group: Group) => void` | `() => {}` | Passed through without confirmation |
| `onRefresh` | `() => void` | `() => {}` | "Refresh" button; disabled when `isLoading` |
| `showHeader` | `boolean` | `true` | When false hides `<h1>` + subheading, shows minimal action row |

### Internal Handler Logic

```js
handleLeaveGroup(group): calls window.confirm(`Are you sure you want to leave "${group.name}"?`)
  → only calls onLeaveGroup(group) if confirmed
handleDeleteGroup(group): calls onDeleteGroup(group) directly (no confirm — confirm is expected upstream)
handleViewGroup/handleEditGroup: pass-through wrappers
```

### Tailwind Classes — Full Inventory

**Root wrapper:**
```
space-y-6
```

**Header row (`showHeader=true`):**
```
flex flex-col md:flex-row md:justify-between md:items-center gap-sm md:gap-0
```

**Title block:**
```
order-1
```
`<h1>`: `text-2xl font-bold text-gray-900`
`<p>`: `text-gray-600 mt-1`

**Action buttons row (`showHeader=true`):**
```
flex flex-col order-2 md:order-none md:flex-row md:space-x-3 gap-sm md:gap-0 w-full md:w-auto md:items-center mt-sm md:mt-0
```

**Action buttons row (`showHeader=false`):**
```
flex flex-col md:flex-row md:justify-end md:items-center gap-sm md:gap-3
```

**Loading state:**
```
flex justify-center items-center py-12
```
Spinner: `animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600`
Text: `ml-3 text-gray-600`

**Empty state wrapper:**
```
text-center py-12
```

**Empty state icon container:**
```
mx-auto h-12 w-12 text-gray-400
```

**Empty state heading:**
```
mt-2 text-sm font-medium text-gray-900
```

**Empty state subtext:**
```
mt-1 text-sm text-gray-500
```

**Empty state buttons row:**
```
mt-6 flex justify-center space-x-3
```

**Groups grid (populated state):**
```css
/* Tailwind class: .groups-grid (defined via <style> block) */
display: grid;
gap: 1.5rem;
grid-template-columns: 1fr;                      /* default: 1 col */

@media (min-width: 860px)  { grid-template-columns: repeat(2, 1fr); }  /* 2 cols */
@media (min-width: 1420px) { grid-template-columns: repeat(3, 1fr); }  /* 3 cols */
```
> Custom breakpoints (860px, 1420px) — **not standard Tailwind breakpoints**.

### Visual States

| State | Condition | Output |
|-------|-----------|--------|
| Loading | `isLoading=true` | Spinner + "Loading groups..." text |
| Empty | `isLoading=false && groups.length === 0` | Icon + message + Create/Join buttons |
| Populated | `groups.length > 0` | Grid of GroupCard components |
| `showHeader=true` | default | `<h1>My Groups</h1>` + subheading + full action row with Refresh |
| `showHeader=false` | opt-in | No heading; compact right-aligned action row (no Refresh button) |

### Buttons Rendered

| Label | Variant | Size | When |
|-------|---------|------|------|
| Create Group | `primary` | default | Header (both modes), empty state |
| Join Group | `secondary` | default | Header (both modes), empty state |
| Refresh | `secondary` | `sm` | Header `showHeader=true` only; `disabled={isLoading}` |
| Create Your First Group | `primary` | default | Empty state only |
| Join a Group | `secondary` | default | Empty state only |

### Implicit Prop Contract with GroupCard

GroupsList passes the full `group` object through closure callbacks:

```svelte
<GroupCard
  {group}
  onView={() => handleViewGroup(group)}
  onEdit={() => handleEditGroup(group)}
  onLeave={() => handleLeaveGroup(group)}
  onDelete={() => handleDeleteGroup(group)}
/>
```

The `group` object passed to `onLeave` is the full group shape including `.name` (used in `window.confirm` message). GroupCard's `onDelete` prop maps to GroupsList's `onDeleteGroup` — no in-list confirm dialog.

### Sub-components Imported

| Component | Import Path | Usage |
|-----------|-------------|-------|
| `GroupCard` | `./GroupCard.svelte` | Rendered per group in populated state |
| `Button` | `./Button.svelte` | All action buttons (Create, Join, Refresh, empty state CTAs) |

### Refresh Button Icon

Inline SVG in Refresh button (not from `getIcon`):
```
path: M16.023 9.348h4.992V4.356M2.985 14.652v4.992h4.992M19.207 15.6a8.25 8.25 0 01-14.64 2.474m-.774-9.574a8.25 8.25 0 0114.64-2.474
```
SVG classes: `w-4 h-4 mr-xs`

### Empty State Icon

Inline SVG (user-group style):
```
path: M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z
```

---

## Key React Migration Notes

### Navigation
- The `.md` doc is **outdated** (lists `userName` not `displayName`, wrong nav items). Use the `.svelte` source.
- `displayName` + `user` are both props; React should accept both for backward compat or merge into `user`.
- `signOut` event dispatched with no detail — React prop: `onSignOut: () => void`.
- Avatar fallback chain logic needs porting: try multiple Google image size variants on error.
- `svelte:window on:click` → `useEffect` with `document.addEventListener('click', ...)` + cleanup.
- Mobile sidebar uses CSS transform (translate), not conditional render — for animation to work, keep the element mounted and toggle class.

### GroupCard
- All actions are callback props, not Svelte events — maps cleanly to React.
- `onDelete` prop exists in source but is **missing from the `.md` doc** — it must be included in the React interface.
- `Avatar` sub-component must accept `variant="sm"` — already ported to TSX, verify prop exists.
- No dark-mode classes on GroupCard — uses plain Tailwind grays (`gray-*`) not design system tokens.

### GroupsList
- `window.confirm` in `handleLeaveGroup` — keep in React port (same behavior).
- Custom grid breakpoints (860px, 1420px) require a `<style>` block or Tailwind `safelist` / `theme.extend.screens`.
- `showHeader` controls both the visible heading and which action layout to use.
- `onRefresh` prop and Refresh button only appear when `showHeader=true`.
- GroupsList passes the full group object to callbacks; GroupCard exposes `onView/onEdit/onLeave/onDelete` as no-arg callbacks (closures close over `group` in GroupsList).
