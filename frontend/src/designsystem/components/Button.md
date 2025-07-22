# Button Component Documentation

## Overview

The Button component is a versatile, token-based UI element that supports four variants, three sizes, and comprehensive light/dark mode theming.

## Usage

```svelte
<script>
  import Button from '../designsystem/components/Button.svelte';
</script>

<Button variant="primary" size="md" on:click={handleClick}>
  Click me
</Button>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `variant` | `'primary' \| 'secondary' \| 'tertiary' \| 'destructive'` | `'primary'` | Button style variant |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Button size |
| `disabled` | `boolean` | `false` | Disables the button |
| `loading` | `boolean` | `false` | Shows loading spinner |
| `href` | `string \| null` | `null` | Renders as link if provided |
| `type` | `'button' \| 'submit' \| 'reset'` | `'button'` | Button type for forms |

## Variants

### Primary Button
- **Use case**: Main call-to-action buttons
- **Colors**: Cerulean blue (`primary-500`) background
- **Design**: Small corner radius, subtle shadow
- **States**: Hover deepens color, active has inner shadow, disabled is muted

### Secondary Button  
- **Use case**: Secondary actions, alternatives to primary
- **Colors**: Light gray (`secondary-100`) background with dark text
- **Design**: Same radius and shadow as primary
- **States**: Hover lightens background, maintains contrast ratios

### Tertiary Button
- **Use case**: Subtle actions, text-like buttons
- **Colors**: Transparent background with primary text color
- **Design**: No border or shadow in default state
- **States**: Hover adds light background, maintains accessibility

### Destructive Button
- **Use case**: Delete, remove, or dangerous actions
- **Colors**: Red (`error-500`) background
- **Design**: Same visual treatment as primary but red
- **States**: Clear visual feedback for dangerous actions

## Dark Mode Support

All button variants automatically adapt to dark mode:
- **Semantic colors**: Uses CSS custom properties for theme switching
- **Automatic transitions**: Smooth color transitions when theme changes
- **Maintained contrast**: All variants maintain WCAG AA contrast ratios

## Design Tokens Used

The button component uses **only** design system tokens:

### Colors
- `primary-*`: Primary button colors
- `secondary-*`: Secondary button colors  
- `error-*`: Destructive button colors
- `neutral-*`: Text and neutral colors

### Spacing
- `px-{xs|sm|md|lg}`: Horizontal padding
- `py-{xxxs|xs|sm}`: Vertical padding
- `mr-xs`: Loading spinner margin

### Typography
- `text-{sm|base|lg}`: Font sizes
- `font-medium`: Font weight

### Border & Shadow
- `rounded-{sm|base|md}`: Corner radius
- `border`: Border width
- `shadow-{sm|base|inner}`: Box shadows

### Animation
- `transition-all`: Transition property
- `duration-normal`: Transition duration
- `ease-smooth`: Transition timing function

## Accessibility Features

- **Keyboard navigation**: Full keyboard support
- **Focus management**: Visible focus indicators
- **Screen readers**: Proper ARIA attributes
- **Disabled states**: Clear visual and interaction feedback
- **Color contrast**: WCAG AA compliant in all themes

## Examples

```svelte
<!-- Basic buttons -->
<Button variant="primary">Save Changes</Button>
<Button variant="secondary">Cancel</Button>
<Button variant="tertiary">Learn More</Button>
<Button variant="destructive">Delete Account</Button>

<!-- Different sizes -->
<Button variant="primary" size="sm">Small</Button>
<Button variant="primary" size="md">Medium</Button>
<Button variant="primary" size="lg">Large</Button>

<!-- States -->
<Button variant="primary" disabled>Disabled</Button>
<Button variant="primary" loading>Loading...</Button>

<!-- As link -->
<Button variant="primary" href="/dashboard">Go to Dashboard</Button>

<!-- Event handling -->
<Button variant="primary" on:click={handleSubmit}>
  Submit Form
</Button>
```

## Customization

The button component is fully token-driven, so you can customize it by modifying design tokens:

1. **Change colors**: Update `color.json` tokens
2. **Adjust spacing**: Modify `spacing.json` tokens  
3. **Update typography**: Change `typography.json` tokens
4. **Modify shadows**: Update `border.json` shadow tokens

All changes automatically propagate through the platform token generation system!
