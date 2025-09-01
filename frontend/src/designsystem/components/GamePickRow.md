# GamePickRow Component Documentation

## Overview

The GamePickRow component is the core interface for displaying and interacting with NFL game data in a confidence picks system. It supports team selection, confidence assignment, and comprehensive game state visualization with full token-based theming.

## Usage

```svelte
<script>
  import GamePickRow from '../designsystem/components/GamePickRow.svelte';
  
  let game = {
    id: 401773004,
    awayTeam: { id: 3, name: "Bears", abbreviation: "CHI", logo: "...", color: "0b1c3a" },
    homeTeam: { id: 12, name: "Chiefs", abbreviation: "KC", logo: "...", color: "e31837" },
    awayScore: 29,
    homeScore: 27,
    status: "FINAL",
    gameDate: "2025-08-23T00:20Z",
    meta: { final: true, locked: false },
    pick: { pickedTeamId: 3, confidence: 8, points: 8, won: true }
  };
  
  let draft = {};
  
  function handleToggleWinner(event) {
    console.log('Selected team:', event.detail);
  }
  
  function handleAssignConfidence(event) {
    console.log('Confidence value:', event.detail);
  }
</script>

<GamePickRow 
  {game} 
  {draft} 
  totalGames={16}
  on:toggleWinner={handleToggleWinner}
  on:assignConfidence={handleAssignConfidence}
  on:clearPick={() => console.log('Pick cleared')} />
```

## Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `game` | `GameObject` | Required | Complete game data object |
| `draft` | `object` | `{}` | Draft picks state by game ID |
| `totalGames` | `number` | `0` | Total games for confidence range |
| `focusGameId` | `number \| null` | `null` | Game ID to auto-focus/scroll to |
| `cleared` | `boolean` | `false` | Whether this game's pick was cleared |
| `variant` | `'default' \| 'compact'` | `'default'` | Display variant |
| `readonly` | `boolean` | `false` | Disables all interactions |

## Game Object Structure

```typescript
interface GameObject {
  id: number;
  awayTeam: {
    id: number;
    name: string;
    abbreviation: string;
    logo?: string;
    color?: string; // hex color without #
  };
  homeTeam: {
    id: number;
    name: string;
    abbreviation: string;
    logo?: string;
    color?: string; // hex color without #
  };
  awayScore: number;
  homeScore: number;
  status: 'SCHEDULED' | 'IN_PROGRESS' | 'FINAL' | string;
  gameDate: string; // ISO date string
  displayClock?: string; // Game clock display
  period?: number; // Quarter/period
  meta: {
    final: boolean;
    locked: boolean;
  };
  pick?: {
    pickedTeamId?: number;
    confidence?: number;
    points?: number;
    won?: boolean;
  };
  odds?: {
    favoriteAbbr?: string;
    spread?: string;
    overUnder?: string;
    provider?: string;
  };
}
```

## Events

| Event | Detail Type | Description |
|-------|-------------|-------------|
| `toggleWinner` | `number` | Fired when user selects/deselects a team |
| `assignConfidence` | `number \| null` | Fired when confidence value changes |
| `clearPick` | `void` | Fired when pick is cleared |

## Variants

### Default
- **Use case**: Primary game selection interface
- **Features**: Full game details, odds display, complete interaction
- **Layout**: Responsive grid on mobile, horizontal on desktop

### Compact
- **Use case**: Dense lists, secondary displays
- **Features**: Reduced padding, no odds display
- **Layout**: Same responsive behavior with tighter spacing

## Game States

### Not Started (`SCHEDULED`)
- **Visual**: Gray status badge, teams clickable
- **Behavior**: Full interaction enabled
- **Confidence**: Dropdown selector available

### In Progress (`IN_PROGRESS`)
- **Visual**: Yellow status badge, shows clock/quarter
- **Behavior**: Teams locked, confidence shows current or 0
- **Score**: Live scores with neutral styling

### Final (`FINAL`)
- **Visual**: Green status badge, winner highlighted
- **Behavior**: All interactions disabled
- **Confidence**: Shows final points with win/loss styling

## Selection States

### Team Selection
- **Unselected**: Neutral styling with team colors
- **Selected**: Blue border, elevated shadow, check mark
- **Winner** (final games): Green border and glow
- **Loser** (final games): Red border when selected

### Confidence Assignment
- **Empty**: Shows "—" placeholder
- **Assigned**: Shows number in blue gradient button
- **Final Won**: Green gradient with points earned
- **Final Lost**: Red gradient with points lost
- **No Pick**: Gray gradient with 0

## Accessibility Features

- **ARIA Labels**: Proper radiogroup and role assignments
- **Keyboard Navigation**: Tab, Enter, Space key support
- **Screen Readers**: Descriptive labels and states
- **Focus Management**: Visible focus indicators
- **Color Contrast**: Meets WCAG guidelines in all states

## Design System Integration

### Tokens Used
- **Colors**: Primary, secondary, success, error, warning palettes
- **Spacing**: All spacing values from token system
- **Typography**: Font sizes, weights, line heights
- **Borders**: Border radius values
- **Shadows**: Elevation system
- **Animation**: Duration and easing curves

### Responsive Design
- **Desktop** (>950px): Horizontal layout
- **Mobile** (≤950px): Vertical grid layout
- **Touch Targets**: Minimum 44px for mobile interaction

## Advanced Features

### Auto-Focus
When `focusGameId` matches the game ID, the component automatically scrolls into view with a pulse animation.

### Team Color Integration
Team colors from the API are automatically applied as backgrounds with calculated contrasting text colors for accessibility.

### Draft State Management
The component intelligently merges draft picks with server picks, allowing for optimistic UI updates while maintaining data consistency.

### Odds Display
When available and not in compact mode, betting odds are displayed below the game matchup.

## Best Practices

1. **Always provide totalGames** for proper confidence range
2. **Handle all three events** for complete functionality
3. **Use readonly mode** for display-only scenarios
4. **Implement proper error boundaries** for malformed game data
5. **Consider variant="compact"** for lists or secondary displays

## Example: Read-only Display

```svelte
<GamePickRow 
  {game} 
  {draft} 
  readonly={true}
  variant="compact" />
```

## Example: With Focus Management

```svelte
<script>
  let focusedGameId = null;
  
  function highlightGame(gameId) {
    focusedGameId = gameId;
    setTimeout(() => focusedGameId = null, 3000);
  }
</script>

<GamePickRow 
  {game} 
  {draft} 
  focusGameId={focusedGameId}
  on:assignConfidence={(e) => highlightGame(game.id)} />
```
