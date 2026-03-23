# App.svelte Routing Analysis
# Source: frontend/src/App.svelte + frontend/src/lib/router.js
# Purpose: Reference for Phase 5 sub-tasks — avoids re-reading App.svelte

---

## 1. Route Definitions

# Every route is matched by checking the $currentRoute store (a string).
# Matching is if/else-if chains — ORDER MATTERS (more specific paths come first).

# Route                                  Component          Props passed
# -------                                ---------          ------------
# /  (or 'home')                         inline HTML        none (uses isAuthenticated local var)
# /games                                 GamesPage          none
# /groups/create                         CreateGroupPage    none
# /groups/join                           JoinGroupPage      none
# /groups/:id/edit  (depth=4, ends /edit) EditGroupPage     groupId={$currentRoute.split('/')[2]}
# /groups/:id       (depth=3)            GroupDetailsPage   groupId={$currentRoute.split('/')[2]}
# /groups                                GroupsPage         none
# /about                                 inline HTML        none
# /design-system                         DesignSystemHub    none
# /login                                 LoginPage          none
# /profile                               ProfilePage        none
# /auth/callback (or ?token=)            AuthCallback       none
# /invite/:token  (depth=3)              InvitePage         token={$currentRoute.split('/')[2]}
# (catch-all)                            inline 404 HTML    none

# IMPORTANT: /groups/create and /groups/join must be matched BEFORE /groups/:id
# because the route store stores them as the literal string '/groups/create' etc.
# The edit route checks split('/').length === 4 AND endsWith('/edit').
# The details route checks split('/').length === 3.

---

## 2. Props and Context Threaded to Page Components

# No Svelte context (setContext/getContext) is used in App.svelte.
# Props are passed directly via component attributes.

# Component          Props
# ---------          -----
# GamesPage          (none)
# CreateGroupPage    (none)
# JoinGroupPage      (none)
# GroupDetailsPage   groupId: string — the raw path segment at index 2
# EditGroupPage      groupId: string — the raw path segment at index 2
# GroupsPage         (none)
# LoginPage          (none)
# ProfilePage        (none)
# AuthCallback       (none)
# InvitePage         token: string — the raw path segment at index 2
# DesignSystemHub    (none)

# NOTE: groupId is extracted as $currentRoute.split('/')[2].
# For path /groups/abc123/edit → groupId = 'abc123'
# For path /groups/abc123     → groupId = 'abc123'
# Components that need auth state (isAuthenticated, user) must import the
# authStore themselves — App.svelte does NOT pass auth as a prop.

# Navigation component (always rendered):
# <Navigation
#   currentRoute={$currentRoute}
#   darkMode={darkMode}
#   displayName={$auth?.user?.name || null}
#   user={$auth.user}
# />
# Navigation emits: navigate, themeToggle, mobileMenuToggle, signOut events.

---

## 3. Authentication Gating of Protected Routes

# Two mechanisms protect /groups/* routes:

# A) Reactive statement (runs on every $currentRoute change):
#    if ($currentRoute.startsWith('/groups') && !isAuthenticated) → navigateTo('/login')
#    This covers direct-URL access and any navigation that somehow bypasses the guard below.

# B) handleNavigate event handler (fired by Navigation component):
#    if (!isAuthenticated && target.startsWith('/groups')) → navigateTo('/login')
#    This intercepts nav-link clicks before pushState is called.

# These two together mean:
# - Unauthenticated users clicking /groups/* links are redirected to /login immediately.
# - Unauthenticated users who land directly on a /groups/* URL are also redirected.
# - /login, /auth/callback, /invite/:token, /games, /about, /design-system are PUBLIC.
# - /profile is public in the route table (no guard), but ProfilePage likely guards itself.

# React migration target: replace both with a <ProtectedRoute> wrapper on /groups/* routes.

---

## 4. Custom Router Store and popstate Interaction

# router.js exports:
#   currentRoute   — writable Svelte store, initial value '/'
#   navigateTo(route) — normalizes input, calls getRouteForPath(), sets store, calls pushState
#   initRouter()   — registers popstate listener + sets initial route from window.location

# initRouter() is called once in App.svelte's onMount.

# getRouteForPath(path, hash, search):
#   Converts window.location.{pathname,hash,search} → a canonical route string.
#   Dynamic routes (/groups/:id, /groups/:id/edit, /invite/:token) return the FULL path.
#   Static routes return their literal string ('/groups', '/login', etc.).
#   Auth callback: matches path.startsWith('/auth/callback') OR search.includes('token=')
#     → always returns '/auth/callback' (loses the actual query string in the store).
#   Unmatched paths return '404' (not a URL path, just the string '404').

# popstate handler: on browser back/forward, re-runs getRouteForPath and sets the store.
#   Does NOT call pushState (correct — popstate already changed the URL).

# navigateTo: calls getRouteForPath on the input before setting the store.
#   This means navigateTo('/groups/abc123') stores '/groups/abc123' (full path).
#   navigateTo('/groups') stores '/groups' (matched exactly).

# IMPORTANT for React migration:
#   The auth/callback route loses query params in the store. AuthCallback.svelte must
#   read window.location.search directly (not from the route store) to get token/refresh.

---

## 5. Top-Level Data Fetches and Side Effects on Mount

# onMount runs these in order:
#   1. initRouter()           — sets currentRoute from current URL, registers popstate
#   2. Read localStorage('theme') — if 'dark', sets darkMode=true and adds .dark to <html>
#   3. checkAuthStatus()      — async, validates/refreshes JWT on startup

# checkAuthStatus() logic:
#   if AuthService.isAuthenticated() (token present in localStorage):
#     a. Get user from AuthService.getUser() (decode JWT payload)
#     b. If no user:
#        - try AuthService.refreshToken() (POST /auth/refresh)
#        - then getUser() again, or AuthService.getCurrentUser() (GET /api/users/me)
#     c. If user found → setAuthUser(user) — updates auth store
#     d. If user still not found → clearTokens() + clearAuth()
#   else:
#     clearAuth() — ensures store is falsy

# Side effects on auth store change ($: reactive declarations):
#   isAuthenticated = $auth.isAuthenticated   (derived, used in template guards)
#   userName = $auth?.user?.name || null      (derived, passed to Navigation)

# handleSignOut():
#   AuthService.logout() — POST /auth/logout + clear localStorage
#   clearAuth()          — reset auth store

# handleThemeToggle(event):
#   Toggles .dark class on document.documentElement
#   Saves 'theme' → 'dark' or 'light' in localStorage

# NO top-level data fetches for page content — all page data is fetched inside
# each page component on its own mount. App.svelte only fetches auth state.
