# Design System Platform Tokens

This document explains how the automated platform token generation works in our design system.

## Overview

Our design system uses a **three-tier token architecture**:

1. **Raw Tokens** (`/tokens/`) - Platform-agnostic JSON design decisions
2. **Platform Tokens** (`/platform-tokens/`) - Auto-generated Tailwind CSS configuration
3. **Components** (`/components/`) - Svelte components using only platform tokens

## Automated Generation

### How It Works

Any time you modify a JSON file in `/tokens/`, the platform tokens are automatically regenerated for Tailwind CSS. This ensures your design system stays in sync.

```
tokens/color.json     →  platform-tokens/tailwind.config.js
tokens/spacing.json   →  (extends Tailwind theme)
tokens/typography.json →  (extends Tailwind theme)
tokens/animation.json →  (extends Tailwind theme)
tokens/border.json    →  (extends Tailwind theme)
tokens/icon.json      →  platform-tokens/icons.js
```

### Generated Files

**`platform-tokens/tailwind.config.js`**
- Main Tailwind configuration extending the default theme
- Includes all your custom colors, spacing, typography, animations
- Ready to use with Tailwind utilities

**`platform-tokens/icons.js`**
- Maps semantic icon names to Heroicon identifiers
- Used by the `Icon.svelte` component
- Format: `{ "navigation-home": "home", "score-up": "arrow-up" }`

**`platform-tokens/summary.json`**
- Generation metadata and statistics
- Helpful for debugging and understanding what was generated

## Available Commands

```bash
# Generate platform tokens once
pnpm tokens:generate

# Watch tokens and regenerate on changes
pnpm tokens:watch

# Run dev server with token watching (recommended)
pnpm dev:tokens
```

## Using Platform Tokens

### In Svelte Components

```svelte
<!-- Colors -->
<div class="bg-primary-500 text-neutral-0">
  
<!-- Spacing -->
<div class="p-md m-lg">

<!-- Typography -->
<h1 class="font-heading text-xl font-semibold">

<!-- Custom icon sizes -->
<Icon name="navigation-home" class="w-icon-md h-icon-md" />
```

### Available Tailwind Utilities

Based on your tokens, you get these utilities:

**Colors**
- `bg-primary-{50|100|200|...900}`
- `bg-secondary-{50|100|200|...900}`
- `bg-success-{50|100|200|...900}`
- `bg-error-{50|100|200|...900}`
- `bg-warning-{50|100|200|...900}`
- `bg-neutral-{0|50|100|...1000}`
- `bg-surface-{primary|secondary|tertiary|inverse}`
- Same for `text-`, `border-`, etc.

**Spacing**
- `p-{none|xxxs|xxs|xs|sm|md|lg|xl|xxl|xxxl}`
- `m-{none|xxxs|xxs|xs|sm|md|lg|xl|xxl|xxxl}`
- `gap-{none|xxxs|xxs|xs|sm|md|lg|xl|xxl|xxxl}`
- `p-layout-{section|container|page}`

**Typography**
- `font-{heading|body|mono}`
- `text-{xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl}`
- `font-{thin|extralight|light|normal|medium|semibold|bold|extrabold|black}`
- `leading-{none|tight|snug|normal|relaxed|loose}`
- `tracking-{tighter|tight|normal|wide|wider|widest}`

**Animation**
- `duration-{instant|fast|normal|slow|slower|slowest}`
- `ease-{linear|ease|ease-in|ease-out|ease-in-out|bounce|smooth}`

**Icons**
- `w-icon-{xs|sm|md|lg|xl|xxl}` and `h-icon-{xs|sm|md|lg|xl|xxl}`

## Token Structure Examples

### Color Tokens → Tailwind Colors
```json
// tokens/color.json
{
  "color": {
    "primary": {
      "500": "#0ea5e9"
    }
  }
}
```
Becomes: `bg-primary-500`, `text-primary-500`, `border-primary-500`

### Spacing Tokens → Tailwind Spacing
```json
// tokens/spacing.json
{
  "spacing": {
    "md": "16"
  }
}
```
Becomes: `p-md` (padding: 16px), `m-md` (margin: 16px), `gap-md` (gap: 16px)

### Icon Tokens → Icon Map
```json
// tokens/icon.json
{
  "icon": {
    "navigation": {
      "home": "home"
    }
  }
}
```
Becomes: Icon component usage `<Icon name="navigation-home" />`

## File Watching

The token watcher (`scripts/watch-tokens.js`) monitors `/tokens/*.json` files and automatically regenerates platform tokens when:

- A token file is added
- A token file is modified  
- A token file is deleted

This happens instantly during development, so you see changes immediately.

## Development Workflow

### Recommended Development Process

1. **Start development with token watching**:
   ```bash
   pnpm dev:tokens
   ```

2. **Modify tokens** in `/tokens/*.json` files

3. **Platform tokens regenerate automatically**

4. **Use new tokens** in your components:
   ```svelte
   <div class="bg-new-color-500 p-new-spacing">
   ```

### Adding New Tokens

1. **Edit the appropriate JSON file** in `/tokens/`
2. **Platform tokens regenerate automatically**
3. **New Tailwind utilities are available immediately**

### Example: Adding a New Color

```json
// tokens/color.json
{
  "color": {
    "brand": {
      "400": "#60a5fa",
      "500": "#3b82f6", 
      "600": "#2563eb"
    }
  }
}
```

Instantly available: `bg-brand-400`, `bg-brand-500`, `bg-brand-600`

## Troubleshooting

### Platform Tokens Not Updating
- Check that the token watcher is running (`pnpm tokens:watch`)
- Verify JSON syntax is valid
- Look for console errors in the watcher output

### Tailwind Classes Not Working
- Ensure PostCSS is configured correctly
- Check that the generated `tailwind.config.js` includes your tokens
- Verify your component is included in Tailwind's content paths

### Icons Not Loading
- Check that icon names match the generated icon map
- Verify Heroicons package is installed
- Ensure the Icon component is importing the icon map correctly

## Technical Details

### File Structure
```
scripts/
├── generate-platform-tokens.js  # Main generation logic
└── watch-tokens.js              # File watcher

src/designsystem/
├── tokens/                      # Raw JSON tokens
├── platform-tokens/             # Generated Tailwind config
└── components/                  # Svelte components
```

### Dependencies
- `chokidar` - File watching
- `tailwindcss` - CSS framework
- `heroicons` - Icon library
- `concurrently` - Run multiple commands

This automated system ensures your design tokens and Tailwind utilities stay perfectly synchronized!
