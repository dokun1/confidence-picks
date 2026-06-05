# Svelte → React Migration Plan

> Generated: January 2026
> Project: Confidence Picks Frontend

---

## Table of Contents

1. [Current State Summary](#current-state-summary)
2. [Phase 1: React Foundation Setup](#phase-1-react-foundation-setup)
3. [Phase 2: Design System Component Migration](#phase-2-design-system-component-migration)
4. [Phase 3: Infrastructure Migration](#phase-3-infrastructure-migration)
5. [Phase 4: Page Migration](#phase-4-page-migration)
6. [Phase 5: New Components Needed](#phase-5-new-components-needed)
7. [Migration Order Summary](#migration-order-summary)
8. [Key Principles](#key-principles-for-migration)

---

## Current State Summary

### Design System (`/src/designsystem/`)

- **11 Svelte components** with documentation
- **6 token JSON files** (color, spacing, typography, animation, border, icon)
- **Automated token → Tailwind generation** (framework-agnostic, stays unchanged)
- **Dark mode support** via class-based toggle

### Existing Design System Components

| Component | File | Documentation |
|-----------|------|---------------|
| Button | `Button.svelte` | `Button.md` |
| TextField | `TextField.svelte` | `TextField.md` |
| Avatar | `Avatar.svelte` | - |
| Navigation | `Navigation.svelte` | `Navigation.md` |
| GroupCard | `GroupCard.svelte` | `GroupCard.md` |
| GroupsList | `GroupsList.svelte` | `GroupsList.md` |
| GroupPicks | `GroupPicks.svelte` | `GroupPicks.md` |
| CreateGroupForm | `CreateGroupForm.svelte` | `CreateGroupForm.md` |
| JoinGroupForm | `JoinGroupForm.svelte` | `JoinGroupForm.md` |
| InlineToast | `InlineToast.svelte` | - |
| ConfirmDeleteModal | `ConfirmDeleteModal.svelte` | - |

### Pages (`/src/components/` + `App.svelte`)

- 10+ full pages (Games, Groups, Login, Profile, etc.)
- Custom client-side router in `/src/lib/router.js`
- Service layer for API calls (auth, groups, picks, invites)

### Token System

```
/src/designsystem/tokens/
├── color.json          # Color palette (primary, secondary, success, error, warning, neutral)
├── spacing.json        # Spacing scale + layout + component spacing
├── typography.json     # Font families, sizes, weights, line heights
├── animation.json      # Durations and easing functions
├── border.json         # Radius, width, shadows
└── icon.json           # Semantic icon mappings to Heroicons
```

---

## Phase 1: React Foundation Setup ✅ Complete

### 1.1 Install React Dependencies

Add to `package.json`:

```json
{
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "react-router-dom": "^6.x",
    "@heroicons/react": "^2.x"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.x",
    "@types/react": "^18.x",
    "@types/react-dom": "^18.x",
    "typescript": "^5.x"
  }
}
```

### 1.2 Configure Vite for React

Replace `@sveltejs/vite-plugin-svelte` with `@vitejs/plugin-react` in `vite.config.js`:

```js
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
})
```

### 1.3 Keep Token System Intact

Your token generation system is **framework-agnostic**. The generated `tailwind.config.js` works identically with React.

**No changes needed to:**

- `/src/designsystem/tokens/*.json`
- `/scripts/generate-platform-tokens.js`
- `/scripts/watch-tokens.js`
- `/src/designsystem/platform-tokens/`

---

## Phase 2: Design System Component Migration ✅ Complete

### Migration Order (by dependency)

Migrate components in order of **dependency** (leaf components first):

| Order | Component | Svelte Props → React Props | Notes |
|-------|-----------|---------------------------|-------|
| 1 | **Button** | `variant`, `size`, `disabled`, `loading`, `href`, `type` | Add `onClick`, use `React.ButtonHTMLAttributes` |
| 2 | **TextField** | `value`, `label`, `validationMessage`, `validationState`, `disabled`, `secure`, `showClearButton`, `multiline` | Use controlled component pattern with `onChange` |
| 3 | **Avatar** | `name`, `email`, `pictureUrl`, `variant`, `rounded` | Straightforward port |
| 4 | **InlineToast** | `open`, `message`, `variant`, `timeout`, `onClose` | Consider adding React context for global toast management |
| 5 | **Navigation** | `currentRoute`, `displayName`, `user`, `showThemeToggle`, `darkMode` | Integrate with `react-router-dom`'s `useLocation` |
| 6 | **GroupCard** | `group` object | Compose with Avatar |
| 7 | **GroupsList** | `groups` array | Map over GroupCard |
| 8 | **CreateGroupForm** | `onSubmit`, `onCancel`, `isLoading`, `initialValues` | Use `react-hook-form` or controlled inputs |
| 9 | **JoinGroupForm** | `onSubmit`, `onCancel`, `isLoading` | Similar pattern to CreateGroupForm |
| 10 | **GroupPicks** | group/picks data | Depends on your data shape |
| 11 | **ConfirmDeleteModal** | `open`, `onConfirm`, `onCancel`, `title`, `message` | Add portal rendering |

### Recommended File Structure

```
/src/designsystem/
├── tokens/              # UNCHANGED
├── platform-tokens/     # UNCHANGED
├── components/
│   ├── Button/
│   │   ├── Button.tsx
│   │   ├── Button.test.tsx
│   │   └── index.ts
│   ├── TextField/
│   │   ├── TextField.tsx
│   │   └── index.ts
│   ├── Avatar/
│   │   ├── Avatar.tsx
│   │   └── index.ts
│   ├── InlineToast/
│   │   ├── InlineToast.tsx
│   │   └── index.ts
│   ├── Navigation/
│   │   ├── Navigation.tsx
│   │   └── index.ts
│   ├── GroupCard/
│   │   ├── GroupCard.tsx
│   │   └── index.ts
│   ├── GroupsList/
│   │   ├── GroupsList.tsx
│   │   └── index.ts
│   ├── CreateGroupForm/
│   │   ├── CreateGroupForm.tsx
│   │   └── index.ts
│   ├── JoinGroupForm/
│   │   ├── JoinGroupForm.tsx
│   │   └── index.ts
│   ├── GroupPicks/
│   │   ├── GroupPicks.tsx
│   │   └── index.ts
│   └── Modal/
│       ├── Modal.tsx
│       ├── ConfirmDeleteModal.tsx
│       └── index.ts
└── index.ts             # Barrel export
```

### Key Patterns to Apply

#### TypeScript Interfaces

```tsx
// Button.tsx
interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'tertiary' | 'destructive';
  size?: 'sm' | 'md' | 'lg';
  loading?: boolean;
  href?: string;
}

// TextField.tsx
interface TextFieldProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'size'> {
  label?: string;
  validationMessage?: string;
  validationState?: 'none' | 'success' | 'error';
  showClearButton?: boolean;
  multiline?: boolean;
  rows?: number;
  size?: 'sm' | 'md' | 'lg';
}

// Avatar.tsx
interface AvatarProps {
  name?: string;
  email?: string;
  pictureUrl?: string;
  variant?: 'sm' | 'md' | 'lg';
  rounded?: 'full' | 'base';
}
```

#### Tailwind Class Composition

```tsx
// Use same pattern from Svelte - just in JS/TS
const variantStyles = {
  primary: 'bg-primary-500 hover:bg-primary-600 text-neutral-0',
  secondary: 'bg-secondary-100 hover:bg-secondary-200 text-secondary-700',
  tertiary: 'bg-transparent hover:bg-secondary-100 text-secondary-700',
  destructive: 'bg-error-500 hover:bg-error-600 text-neutral-0',
};

const sizeStyles = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-base',
  lg: 'px-6 py-3 text-lg',
};
```

#### ForwardRef for Form Components

```tsx
const TextField = React.forwardRef<HTMLInputElement, TextFieldProps>(
  ({ label, validationMessage, validationState = 'none', ...props }, ref) => {
    return (
      <div className="flex flex-col gap-1">
        {label && <label className="text-sm font-medium">{label}</label>}
        <input ref={ref} {...props} />
        {validationMessage && (
          <span className={validationState === 'error' ? 'text-error-500' : 'text-success-500'}>
            {validationMessage}
          </span>
        )}
      </div>
    );
  }
);
```

---

## Phase 3: Infrastructure Migration ✅ Complete

### 3.1 Router Migration

| Current (Custom) | React Router |
|------------------|--------------|
| `/src/lib/router.js` | `react-router-dom` |
| `navigateTo(path)` | `useNavigate()` hook |
| `$currentRoute` store | `useLocation()` hook |
| Route guards in App.svelte | `<ProtectedRoute>` wrapper component |

#### React Router Setup

```tsx
// App.tsx
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/groups" element={<ProtectedRoute><GroupsPage /></ProtectedRoute>} />
        <Route path="/groups/create" element={<ProtectedRoute><CreateGroupPage /></ProtectedRoute>} />
        <Route path="/groups/:groupId" element={<ProtectedRoute><GroupDetailsPage /></ProtectedRoute>} />
        <Route path="/groups/:groupId/edit" element={<ProtectedRoute><EditGroupPage /></ProtectedRoute>} />
        <Route path="/games" element={<ProtectedRoute><GamesPage /></ProtectedRoute>} />
        <Route path="/profile" element={<ProtectedRoute><ProfilePage /></ProtectedRoute>} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
```

#### Protected Route Component

```tsx
// components/ProtectedRoute.tsx
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}
```

### 3.2 Auth Store Migration

| Current (Svelte Store) | React Equivalent |
|------------------------|------------------|
| `/src/lib/authStore.js` | React Context + `useReducer` or Zustand |
| `$user` reactive | `useAuth()` custom hook |

#### Auth Context Implementation

```tsx
// contexts/AuthContext.tsx
import { createContext, useContext, useReducer, useEffect } from 'react';
import { authService } from '../lib/authService';

interface AuthState {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthState & { signOut: () => void } | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    // Check for existing session on mount
    authService.getCurrentUser().then(user => {
      dispatch({ type: 'SET_USER', payload: user });
    });
  }, []);

  const signOut = () => {
    authService.signOut();
    dispatch({ type: 'SIGN_OUT' });
  };

  return (
    <AuthContext.Provider value={{ ...state, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
```

### 3.3 Service Layer

Your services are **mostly reusable**. They just need:

- Remove any Svelte store imports
- Return Promises (they likely already do)
- Optionally wrap with React Query for caching

#### Optional: React Query Integration

```tsx
// hooks/useGroups.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { groupsService } from '../lib/groupsService';

export function useGroups() {
  return useQuery({
    queryKey: ['groups'],
    queryFn: () => groupsService.getGroups(),
  });
}

export function useCreateGroup() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: groupsService.createGroup,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['groups'] });
    },
  });
}
```

---

## Phase 4: Page Migration ✅ Complete

### Migration Order (by complexity)

Migrate pages in order of **complexity** (simplest first):

| Order | Page | Complexity | Dependencies |
|-------|------|------------|--------------|
| 1 | **About** | Low | None |
| 2 | **404** | Low | None |
| 3 | **LoginPage** | Medium | Button, authService |
| 4 | **ProfilePage** | Medium | Avatar, useAuth |
| 5 | **Home** | Medium | Button, Navigation |
| 6 | **CreateGroupPage** | Medium | CreateGroupForm |
| 7 | **JoinGroupPage** | Medium | JoinGroupForm |
| 8 | **GroupsPage** | Medium | GroupsList, GroupCard |
| 9 | **GroupDetailsPage** | High | Multiple components, picks data |
| 10 | **EditGroupPage** | Medium | CreateGroupForm (edit mode) |
| 11 | **GamesPage** | High | GamePickRow, complex state |
| 12 | **InvitePage** | Medium | Auth flow |
| 13 | **AuthCallback** | Low | OAuth handling |

### Page File Structure

```
/src/pages/
├── HomePage.tsx
├── AboutPage.tsx
├── NotFoundPage.tsx
├── LoginPage.tsx
├── ProfilePage.tsx
├── GroupsPage.tsx
├── CreateGroupPage.tsx
├── JoinGroupPage.tsx
├── GroupDetailsPage.tsx
├── EditGroupPage.tsx
├── GamesPage.tsx
├── InvitePage.tsx
├── AuthCallback.tsx
└── index.ts
```

---

## Phase 5: New Components Needed ✅ Complete

### Must Create

Based on evaluation of existing pages, these components don't exist in your design system but are needed:

| Component | Why | Used In |
|-----------|-----|---------|
| **Modal** | `ConfirmDeleteModal` exists but you need a generic base Modal with portal support | GroupDetailsPage, anywhere confirmations are needed |
| **GamePickRow** | Currently in `/src/components/`, should be promoted to design system | GamesPage |
| **WeekSelector** | Implicit in GamesPage, should be extracted | GamesPage |
| **Leaderboard** | Likely exists but not formalized in design system | GroupDetailsPage |

### Consider Creating

| Component | Why |
|-----------|-----|
| **Badge** | You use owner/member badges in GroupCard - extract to reusable component |
| **Card** | GroupCard is specific; a generic Card component would reduce duplication |
| **EmptyState** | For "no groups", "no picks" states - standardize messaging |
| **Spinner/Loader** | Button has loading state, but a standalone spinner is useful |
| **Skeleton** | Loading placeholder for async content |

### Suggested Implementations

#### Badge Component

```tsx
interface BadgeProps {
  variant?: 'default' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md';
  children: React.ReactNode;
}

export function Badge({ variant = 'default', size = 'sm', children }: BadgeProps) {
  // Use tokens for colors
}
```

#### Modal Component

```tsx
interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function Modal({ open, onClose, title, children, footer }: ModalProps) {
  // Use React portal, handle escape key, focus trap
}
```

---

## Migration Order Summary

### Timeline Overview

```
Phase 1: Foundation (Week 1-2) ✅ Complete
├── Install React dependencies
├── Configure Vite for React
├── Set up TypeScript
└── Create component folder structure

Phase 2: Core Design System (Week 3-4) ✅ Complete
├── Button
├── TextField
├── Avatar
├── InlineToast
└── Write unit tests for each

Phase 3: Composite Components (Week 5-6) ✅ Complete
├── Navigation (with react-router integration)
├── GroupCard
├── GroupsList
├── CreateGroupForm
├── JoinGroupForm
├── Modal (new)
└── Badge (new)

Phase 4: Infrastructure (Week 7-8) ✅ Complete
├── Auth context/hooks
├── Router setup with protected routes
├── React Query integration (optional)
└── Theme context for dark mode

Phase 5: Pages - Simple (Week 9-10) ✅ Complete
├── AboutPage
├── NotFoundPage
├── LoginPage
├── ProfilePage
└── HomePage

Phase 6: Pages - Complex (Week 11-12) ✅ Complete
├── GroupsPage
├── CreateGroupPage
├── JoinGroupPage
├── GroupDetailsPage
├── EditGroupPage
├── GamesPage
├── InvitePage
└── AuthCallback
```

---

## Key Principles for Migration

### 1. Token System is Your Source of Truth

- Don't duplicate color/spacing values anywhere
- Always reference the generated Tailwind config
- If you need a new token, add it to the JSON files

### 2. Component Props Define the API

- Document every prop with TypeScript interfaces
- The interface IS your component specification
- Use discriminated unions for variant props

### 3. Composition Over Customization

- Build complex UI by composing simple components
- Don't add more props to handle edge cases
- Create new components when needed

### 4. No Custom Styles Outside Components

- Pages should only use design system components + Tailwind utilities from tokens
- If you're writing custom CSS, you probably need a new component

### 5. Test at the Component Level

- Each design system component should have isolated tests
- Pages become integration tests
- Use React Testing Library

### 6. Maintain Feature Parity

- Don't add features during migration
- Don't remove features during migration
- Migration should be invisible to users

---

## Checklist

### Pre-Migration

- [x] Review all existing Svelte components
- [x] Document any undocumented component props
- [x] Identify all page-specific styles that should become components
- [x] Set up React project alongside Svelte (optional: incremental migration)

### Design System Components

- [x] Button
- [x] TextField
- [x] Avatar
- [x] InlineToast
- [x] Navigation
- [x] GroupCard
- [x] GroupsList
- [x] CreateGroupForm
- [x] JoinGroupForm
- [x] GroupPicks
- [x] Modal (new)
- [x] ConfirmDeleteModal
- [x] Badge (new)
- [x] Card (new, optional)
- [x] EmptyState (new, optional)
- [x] Spinner (new, optional)

### Infrastructure

- [x] React Router setup
- [x] Auth context
- [x] Theme context (dark mode)
- [x] API service hooks (React Query optional)

### Pages

- [x] HomePage
- [x] AboutPage
- [x] NotFoundPage
- [x] LoginPage
- [x] ProfilePage
- [x] GroupsPage
- [x] CreateGroupPage
- [x] JoinGroupPage
- [x] GroupDetailsPage
- [x] EditGroupPage
- [x] GamesPage
- [x] InvitePage
- [x] AuthCallback

### Post-Migration

- [x] Remove Svelte dependencies
- [x] Update build scripts
- [x] Update CI/CD pipeline
- [x] Performance testing
- [x] Accessibility audit

## Migration Complete (2026-06-05)

The Svelte to React migration has landed. All 11 design-system components were ported to React/TSX (Avatar, Button, TextField, InlineToast, Modal/ConfirmDeleteModal, Navigation, GroupCard, GroupsList, GroupPicks, and CreateGroupForm), built on top of a shared Modal primitive that ConfirmDeleteModal composes. Routing is handled by a BrowserRouter route table wired in `frontend/src/App.tsx`, which also exports an `AppRoutes` component so unit tests can mount the same routes under a MemoryRouter. Every page under `frontend/src/pages/` was ported: Home, About, NotFound, AuthCallback, Login, Profile, Groups, CreateGroup, JoinGroup, EditGroup, and GroupDetails (including its PicksTab, ChatTab, and SettingsTab tabs), plus Games and Invite. A Playwright end-to-end smoke suite is in place alongside a page-to-spec coverage invariant enforced by `scripts/check-page-spec-coverage.mjs`, ensuring each page has a corresponding e2e spec. Vitest unit coverage is enforced at the configured 70% thresholds for statements, branches, functions, and lines per `frontend/vitest.config.ts`.
