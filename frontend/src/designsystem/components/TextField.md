# TextField Component Documentation

## Overview

The TextField component is a comprehensive input field that supports validation, different states, security features, and follows the design system tokens for consistent styling.

## Usage

```svelte
<script>
  import TextField from '../designsystem/components/TextField.svelte';
  
  let email = '';
</script>

<TextField 
  bind:value={email}
  label="Email Address"
  inputType="email"
  placeholder="Enter your email..."
  validationMessage="Please enter a valid email"
  validationState="error"
  required
/>
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `value` | `string` | `''` | Current input value (bindable) |
| `placeholder` | `string` | `''` | Placeholder text with fade animation |
| `label` | `string` | `''` | Optional label above the field |
| `validationMessage` | `string` | `''` | Validation message below field |
| `validationState` | `'none' \| 'success' \| 'error'` | `'none'` | Validation state styling |
| `disabled` | `boolean` | `false` | Disables the input |
| `secure` | `boolean` | `false` | Prevents text copying, enables paste |
| `showClearButton` | `boolean` | `true` | Shows/hides clear button when text present |
| `inputType` | `string` | `'text'` | HTML input type (text, email, password, etc.) |
| `size` | `'sm' \| 'md' \| 'lg'` | `'md'` | Field size |
| `required` | `boolean` | `false` | Marks field as required |
| `readonly` | `boolean` | `false` | Makes field read-only |
| `id` | `string` | `''` | HTML id attribute |

## Features

### 🎨 Design System Integration
- **Corner Radius**: Same as buttons (`rounded-base` = 4px)
- **Token-Based Colors**: Uses design system color tokens
- **Consistent Sizing**: Matches button height and padding scales

### ✨ Placeholder Animation
- **Fade Out**: Placeholder quickly fades when typing starts
- **Fade In**: Placeholder returns when field is empty and unfocused
- **Duration**: Uses `duration-fast` (150ms) for smooth transitions

### ✅ Validation System
- **Three States**: None (primary), Success (green), Error (red)
- **Colored Borders**: State determines border and focus ring colors
- **Icons**: Validation messages include contextual icons (✓, ⚠, ℹ)
- **Message Display**: Shows below field with appropriate color

### 🏷️ Label Support
- **Optional Labels**: Positioned above the field
- **Required Indicator**: Red asterisk (*) for required fields
- **Accessibility**: Proper label/input association

### 🔒 Security Features
- **Text Protection**: Secure fields prevent text copying
- **Paste Allowed**: Users can still paste into secure fields
- **Visual Feedback**: No visual indication of security (for UX)

### 🗑️ Clear Button
- **Auto-Show**: Appears when text is present
- **Auto-Hide**: Hidden when field is empty, disabled, or readonly
- **Configurable**: Can be disabled via `showClearButton` prop
- **Accessibility**: Proper button role and keyboard navigation

### 📐 Size Variations
- **Small**: 32px height, compact padding
- **Medium**: 40px height, standard padding  
- **Large**: 48px height, generous padding

### 🌓 Dark Mode Support
- **Automatic Adaptation**: All colors adapt to dark theme
- **Semantic Colors**: Uses CSS custom properties for theming
- **Maintained Contrast**: WCAG AA compliance in all themes

## Design Tokens Used

### Colors
- `neutral-*`: Input background and text
- `secondary-*`: Borders, placeholders, disabled states
- `primary-*`: Focus states and default validation
- `success-*`: Success validation state
- `error-*`: Error validation state

### Spacing  
- `px-{xs|sm|md}`: Horizontal padding by size
- `py-{xxxs|xs|sm}`: Vertical padding by size
- `gap-xs`: Icon spacing in validation messages

### Typography
- `text-{sm|base|lg}`: Font sizes by size
- `font-medium`: Label font weight

### Border & Effects
- `rounded-base`: Corner radius (matches buttons)
- `border`: Border width
- `focus:ring-2`: Focus ring size

### Animation
- `transition-all`: Smooth property transitions
- `duration-fast`: Quick animations (150ms)
- `ease-smooth`: Smooth timing function

## Events

| Event | Detail | Description |
|-------|--------|-------------|
| `input` | `{ value, event }` | Fired on every input change |
| `focus` | `{ value, event }` | Fired when field gains focus |
| `blur` | `{ value, event }` | Fired when field loses focus |
| `keydown` | `{ value, event }` | Fired on key press |
| `clear` | `undefined` | Fired when clear button is clicked |
| `change` | Native event | Standard HTML change event |
| `keyup` | Native event | Standard HTML keyup event |
| `keypress` | Native event | Standard HTML keypress event |

## Examples

### Basic Text Field
```svelte
<TextField 
  bind:value={name}
  label="Full Name"
  placeholder="Enter your name..."
/>
```

### Email Validation
```svelte
<TextField 
  bind:value={email}
  label="Email Address"
  inputType="email"
  placeholder="user@example.com"
  validationMessage={emailError}
  validationState={emailError ? 'error' : 'success'}
  required
/>
```

### Secure Password Field
```svelte
<TextField 
  bind:value={password}
  label="Password"
  inputType="password"
  secure={true}
  placeholder="Enter password..."
  validationMessage="Password cannot be copied"
/>
```

### Different Sizes
```svelte
<TextField size="sm" placeholder="Small field..." />
<TextField size="md" placeholder="Medium field..." />
<TextField size="lg" placeholder="Large field..." />
```

### No Clear Button
```svelte
<TextField 
  bind:value={search}
  placeholder="Search..."
  showClearButton={false}
/>
```

## Accessibility Features

- **Keyboard Navigation**: Full keyboard support
- **Screen Readers**: Proper labels and ARIA attributes
- **Focus Management**: Visible focus indicators
- **Required Fields**: Clear visual and semantic indication
- **Validation**: Error states announced to screen readers
- **Color Contrast**: WCAG AA compliant in all themes

## Customization

All styling uses design system tokens, so you can customize by modifying:

1. **Colors**: Update `color.json` for different themes
2. **Spacing**: Modify `spacing.json` for padding/margins
3. **Typography**: Change `typography.json` for font sizes
4. **Borders**: Update `border.json` for radius/shadows
5. **Animation**: Modify `animation.json` for timing

Changes automatically propagate through the platform token system!
