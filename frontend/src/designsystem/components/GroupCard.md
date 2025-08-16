# Group Card

The Group Card component displays group information with member counts, owner/member badges, and contextual actions.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `group` | `Object` | `{}` | Group data object |
| `onView` | `Function` | `() => {}` | Callback when view button is clicked |
| `onEdit` | `Function` | `() => {}` | Callback when edit button is clicked |
| `onLeave` | `Function` | `() => {}` | Callback when leave button is clicked |

## Group Object Structure

```javascript
{
  id: 'string',           // Unique group identifier
  name: 'string',         // Display name of the group
  identifier: 'string',   // URL-friendly identifier for joining
  description: 'string',  // Group description
  memberCount: number,    // Number of members
  isOwner: boolean,       // Whether current user owns the group
  createdAt: 'string'     // ISO date string
}
```

## Usage

```svelte
<script>
  import GroupCard from '../designsystem/components/GroupCard.svelte';

  const group = {
    id: '1',
    name: 'Fantasy Friends',
    identifier: 'fantasy-friends-2024',
    description: 'Our yearly fantasy football confidence pool.',
    memberCount: 8,
    isOwner: true,
    createdAt: '2024-08-01T10:00:00Z'
  };

  function handleView(group) {
    console.log('View group:', group);
  }

  function handleEdit(group) {
    console.log('Edit group:', group);
  }
</script>

<GroupCard 
  {group}
  onView={handleView}
  onEdit={handleEdit}
/>
```

## Features

- **Owner vs Member Views**: Different actions based on ownership
- **Member Count Display**: Shows current membership
- **Formatted Dates**: Human-readable creation dates
- **Responsive Design**: Works on mobile and desktop
- **Hover Effects**: Visual feedback on interaction
- **Badge System**: Visual indicators for ownership status

## States

- **Owner View**: Shows "Edit" and "View" actions
- **Member View**: Shows "View" and "Leave" actions
- **Loading State**: Disabled during async operations
- **Hover State**: Elevated appearance with shadow

## Accessibility

- Semantic button elements
- Keyboard navigation support
- Screen reader friendly labels
- High contrast mode support
