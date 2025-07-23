# Navigation Component

A responsive navigation component that provides both desktop and mobile layouts with support for user authentication states, theme toggling, and proper accessibility.

## Features

- **Responsive Design**: Desktop horizontal layout with mobile hamburger menu
- **Theme Support**: Built-in light/dark mode toggle with proper contrast ratios
- **User Authentication**: Supports both authenticated and guest states
- **Accessibility**: Full keyboard navigation, ARIA labels, and screen reader support
- **Active States**: Visual indication of current page/route
- **Design System**: Uses only design system tokens for all styling

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `currentRoute` | `string` | `'/'` | Current active route for highlighting |
| `userName` | `string \| null` | `null` | User name for authenticated state |
| `showThemeToggle` | `boolean` | `true` | Whether to show the theme toggle button |
| `darkMode` | `boolean` | `false` | Current theme state |

## Events

| Event | Detail | Description |
|-------|---------|-------------|
| `navigate` | `{ href: string }` | Fired when user clicks navigation item |
| `themeToggle` | `{ darkMode: boolean }` | Fired when theme toggle is clicked |
| `mobileMenuToggle` | `{ open: boolean }` | Fired when mobile menu is toggled |

## Usage

### Basic Navigation
\`\`\`svelte
<script>
  import Navigation from '../designsystem/components/Navigation.svelte';
  
  let currentRoute = '/games';
  let darkMode = false;
  
  function handleNavigate(event) {
    currentRoute = event.detail.href;
    // Handle navigation logic
  }
  
  function handleThemeToggle(event) {
    darkMode = event.detail.darkMode;
    // Handle theme change
  }
</script>

<Navigation 
  {currentRoute}
  {darkMode}
  on:navigate={handleNavigate}
  on:themeToggle={handleThemeToggle}
/>
\`\`\`

### Authenticated User State
\`\`\`svelte
<Navigation 
  {currentRoute}
  {darkMode}
  userName="John Doe"
  on:navigate={handleNavigate}
  on:themeToggle={handleThemeToggle}
/>
\`\`\`

### Without Theme Toggle
\`\`\`svelte
<Navigation 
  {currentRoute}
  showThemeToggle={false}
  on:navigate={handleNavigate}
/>
\`\`\`

## Navigation Items

The component includes the following navigation items by default:

- **Home** (`/`) - Main dashboard
- **Games** (`/games`) - Browse NFL games
- **My Picks** (`/picks`) - User's confidence picks
- **Leaderboard** (`/leaderboard`) - Rankings and scores
- **Design System** (`/design-system`) - Component library

## User Menu Items

When authenticated, the user menu includes:

- **Profile** (`/profile`) - User profile settings
- **Settings** (`/settings`) - Application preferences
- **Sign Out** (`/logout`) - Authentication logout

## Responsive Behavior

### Desktop (md and up)
- Horizontal navigation bar with all items visible
- User menu with dropdown for authenticated users
- Theme toggle in header

### Mobile (below md)
- Hamburger menu button
- Slide-out navigation panel
- Full-width navigation items
- Theme toggle integrated in mobile menu

## Accessibility Features

- **Keyboard Navigation**: Full keyboard support with proper focus management
- **ARIA Labels**: Comprehensive labeling for screen readers
- **Focus Indicators**: Visible focus rings using design system colors
- **Semantic HTML**: Proper use of nav, button, and menu elements
- **High Contrast**: Proper contrast ratios in both light and dark modes

## Design System Integration

The component uses the following design tokens:

### Colors
- Primary colors for active states and branding
- Secondary colors for inactive states and borders
- Neutral colors for backgrounds and text
- Proper dark mode variants for all colors

### Spacing
- Consistent spacing using spacing tokens (xs, sm, md, lg)
- Proper padding and margins for touch targets

### Typography
- Font sizes and weights from typography tokens
- Consistent text styling across all elements

### Transitions
- Animation duration and easing from animation tokens
- Smooth transitions for hover and focus states

## States

### Navigation Item States
- **Default**: Normal navigation item appearance
- **Hover**: Enhanced visibility with background color change
- **Active**: Primary color highlighting for current route
- **Focus**: Visible focus ring for keyboard navigation

### Theme Toggle States
- **Light Mode**: Sun icon with proper contrast
- **Dark Mode**: Moon icon with inverted colors
- **Hover/Focus**: Background color changes for interaction feedback

### Mobile Menu States
- **Closed**: Hamburger icon, no menu visible
- **Open**: X icon, slide-out menu visible
- **Transition**: Smooth animation between states
