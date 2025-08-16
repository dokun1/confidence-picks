# Groups List

Master component for displaying all user groups with empty states, loading states, and action panels.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `groups` | `Array` | `[]` | Array of group objects |
| `isLoading` | `Boolean` | `false` | Loading state while fetching groups |
| `onCreateNew` | `Function` | `() => {}` | Callback for create new group action |
| `onJoinExisting` | `Function` | `() => {}` | Callback for join existing group action |
| `onViewGroup` | `Function` | `() => {}` | Callback when group is viewed |
| `onEditGroup` | `Function` | `() => {}` | Callback when group is edited |
| `onLeaveGroup` | `Function` | `() => {}` | Callback when group is left |

## Events

### `viewGroup`
Fired when a group's view action is triggered.

### `editGroup`
Fired when a group's edit action is triggered.

### `leaveGroup`
Fired when a group's leave action is triggered.

**Event Detail (all events):**
```javascript
{
  id: 'string',
  name: 'string',
  identifier: 'string',
  // ... full group object
}
```

## Usage

```svelte
<script>
  import GroupsList from '../designsystem/components/GroupsList.svelte';

  let groups = [];
  let isLoading = false;

  function handleCreateNew() {
    // Navigate to create group form
  }

  function handleJoinExisting() {
    // Navigate to join group form
  }

  function handleViewGroup(event) {
    const group = event.detail;
    // Navigate to group details
  }

  function handleEditGroup(event) {
    const group = event.detail;
    // Navigate to edit group form
  }

  function handleLeaveGroup(event) {
    const group = event.detail;
    // Show confirmation and leave group
  }
</script>

<GroupsList 
  {groups}
  {isLoading}
  onCreateNew={handleCreateNew}
  onJoinExisting={handleJoinExisting}
  onViewGroup={handleViewGroup}
  onEditGroup={handleEditGroup}
  onLeaveGroup={handleLeaveGroup}
/>
```

## Features

- **Responsive Grid**: Adapts to screen size with 1-3 columns
- **Empty State**: Helpful message and actions when no groups exist
- **Loading State**: Skeleton cards during data fetching
- **Action Panel**: Quick access to create/join actions
- **Event Delegation**: Handles all group actions through events
- **Mobile Responsive**: Optimized for mobile devices

## States

### Loading State
Shows skeleton placeholder cards while groups are being fetched.

### Empty State
Displays when user has no groups:
- Helpful message explaining groups
- Primary action to create new group
- Secondary action to join existing group

### Populated State
Shows groups in responsive grid:
- Action panel at top with create/join buttons
- Grid of group cards
- Individual actions per group (view/edit/leave)

## Layout

- **Desktop**: 3-column grid with action panel
- **Tablet**: 2-column grid
- **Mobile**: Single column stacked layout

## Accessibility

- Semantic heading structure
- Keyboard navigation for all actions
- Screen reader friendly empty states
- Focus management during loading
