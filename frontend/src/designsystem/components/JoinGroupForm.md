# Join Group Form

Simple form component for joining existing groups by group identifier with validation.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `onSubmit` | `Function` | `() => {}` | Callback when form is submitted |
| `onCancel` | `Function` | `() => {}` | Callback when form is cancelled |
| `isLoading` | `Boolean` | `false` | Loading state during submission |

## Events

### `submit`
Fired when the form is successfully submitted.

**Event Detail:**
```javascript
{
  identifier: 'string'  // Group identifier to join
}
```

## Usage

```svelte
<script>
  import JoinGroupForm from '../designsystem/components/JoinGroupForm.svelte';

  let isLoading = false;

  function handleSubmit(event) {
    isLoading = true;
    const { identifier } = event.detail;
    
    // Join group via API
    fetch(`/api/groups/${identifier}/join`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    })
    .then(response => response.json())
    .then(data => {
      console.log('Joined group:', data);
      isLoading = false;
    })
    .catch(error => {
      console.error('Error:', error);
      isLoading = false;
    });
  }

  function handleCancel() {
    console.log('Join cancelled');
  }
</script>

<JoinGroupForm 
  {isLoading}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## Features

- **Identifier Validation**: Validates group identifier format
- **Pattern Matching**: Ensures valid URL-friendly identifiers
- **Loading States**: Disables form during lookup
- **User Guidance**: Helpful examples and instructions
- **Error Handling**: Clear error messages for invalid identifiers
- **Auto-formatting**: Converts input to lowercase, replaces spaces

## Validation Rules

- **Identifier**: Required, 3-50 characters, lowercase alphanumeric with hyphens
- **Pattern**: Must match `/^[a-z0-9-]+$/`
- **Format**: Automatically formats input (spaces → hyphens, uppercase → lowercase)

## Example Identifiers

- `fantasy-friends-2024`
- `office-championship`
- `family-pool-2024`
- `college-buddies`

## Form States

- **Default**: Ready for input
- **Loading**: Disabled during group lookup
- **Error**: Shows validation or lookup errors
- **Success**: Group found and joined

## Accessibility

- Form labels properly associated
- Error messages announced to screen readers
- Keyboard navigation support
- Focus management during loading states
