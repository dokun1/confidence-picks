# Create Group Form

Form component for creating new groups with validation, auto-ID generation, and loading states.

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
  name: 'string',        // Group name
  identifier: 'string',  // Auto-generated identifier
  description: 'string'  // Group description (optional)
}
```

## Usage

```svelte
<script>
  import CreateGroupForm from '../designsystem/components/CreateGroupForm.svelte';

  let isLoading = false;

  function handleSubmit(event) {
    isLoading = true;
    const formData = event.detail;
    
    // Submit to API
    fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    })
    .then(response => response.json())
    .then(data => {
      console.log('Group created:', data);
      isLoading = false;
    })
    .catch(error => {
      console.error('Error:', error);
      isLoading = false;
    });
  }

  function handleCancel() {
    console.log('Form cancelled');
  }
</script>

<CreateGroupForm 
  {isLoading}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>
```

## Features

- **Auto-ID Generation**: Creates URL-friendly identifiers from group names
- **Real-time Validation**: Validates fields as user types
- **Character Limits**: Enforces reasonable length limits
- **Multiline Description**: Uses textarea for longer descriptions
- **Loading States**: Disables form during submission
- **Required Field Indicators**: Visual markers for required fields
- **Error Handling**: Shows validation errors inline

## Validation Rules

- **Name**: Required, 3-50 characters, alphanumeric with spaces and hyphens
- **Identifier**: Auto-generated, must be unique, URL-friendly
- **Description**: Optional, max 200 characters

## Form States

- **Default**: Ready for input
- **Loading**: Disabled during submission
- **Error**: Shows validation messages
- **Success**: Form submitted successfully

## Accessibility

- Form labels properly associated
- Error messages announced to screen readers
- Keyboard navigation support
- Focus management during loading states
