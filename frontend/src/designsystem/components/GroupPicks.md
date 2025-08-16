# Group Picks

Interface component for making confidence picks within groups with game management and pick validation.

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `group` | `Object` | `{}` | Group information |
| `picks` | `Array` | `[]` | User's current picks |
| `games` | `Array` | `[]` | Available games for picking |
| `isLoading` | `Boolean` | `false` | Loading state during save operations |
| `onPickSubmit` | `Function` | `() => {}` | Callback when individual pick is made |
| `onSaveAll` | `Function` | `() => {}` | Callback when saving all picks |

## Data Structures

### Group Object
```javascript
{
  id: 'string',
  name: 'string',
  identifier: 'string'
}
```

### Pick Object
```javascript
{
  gameId: 'string',    // References game.id
  teamId: 'string',    // Team being picked
  confidence: number   // Confidence level (1-16)
}
```

### Game Object
```javascript
{
  id: 'string',
  week: number,
  date: 'string',      // ISO date string
  status: 'string',    // 'upcoming', 'live', 'completed'
  awayTeam: {
    id: 'string',
    name: 'string',
    score: number | null
  },
  homeTeam: {
    id: 'string',
    name: 'string', 
    score: number | null
  }
}
```

## Events

### `pickSubmit`
Fired when an individual pick is made or changed.

**Event Detail:**
```javascript
{
  gameId: 'string',
  teamId: 'string',
  teamName: 'string',
  confidence: number
}
```

### `saveAll`
Fired when user saves all their picks.

**Event Detail:**
```javascript
[
  {
    gameId: 'string',
    teamId: 'string',
    confidence: number
  },
  // ... more picks
]
```

## Usage

```svelte
<script>
  import GroupPicks from '../designsystem/components/GroupPicks.svelte';

  let group = {
    id: '1',
    name: 'Fantasy Friends',
    identifier: 'fantasy-friends-2024'
  };

  let picks = [];
  let games = [];
  let isLoading = false;

  function handlePickSubmit(event) {
    const { gameId, teamId, confidence } = event.detail;
    // Update picks array
    picks = picks.filter(p => p.gameId !== gameId);
    picks = [...picks, { gameId, teamId, confidence }];
  }

  function handleSaveAll(event) {
    isLoading = true;
    const allPicks = event.detail;
    
    fetch(`/api/groups/${group.id}/picks`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(allPicks)
    })
    .then(() => {
      isLoading = false;
      console.log('Picks saved successfully');
    })
    .catch(error => {
      isLoading = false;
      console.error('Error saving picks:', error);
    });
  }
</script>

<GroupPicks 
  {group}
  {picks}
  {games}
  {isLoading}
  onPickSubmit={handlePickSubmit}
  onSaveAll={handleSaveAll}
/>
```

## Features

- **Confidence Levels**: 1-16 point system for NFL picks
- **Team Selection**: Visual team picker with logos
- **Game Sorting**: Orders by date and game status
- **Pick Validation**: Prevents duplicate confidence levels
- **Bulk Save**: Save all picks at once
- **Game Status**: Shows upcoming/live/completed games
- **Mobile Responsive**: Touch-friendly interface
- **Loading States**: Visual feedback during operations

## Confidence Pick Rules

- Each game must have a unique confidence level (1-16)
- Higher numbers indicate higher confidence
- All confidence levels must be used exactly once
- Points awarded = confidence level if pick is correct, 0 if wrong

## Game States

- **Upcoming**: Can make/change picks
- **Live**: Picks locked, shows current status
- **Completed**: Shows final scores and pick results

## Accessibility

- Keyboard navigation for all controls
- Screen reader support for game information
- High contrast mode compatibility
- Focus indicators on interactive elements
