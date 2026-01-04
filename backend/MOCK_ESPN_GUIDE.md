# Mock ESPN API Data Guide

This guide explains how to use the Mock ESPN API system for testing and development during the offseason.

## Overview

The Mock ESPN API system provides realistic NFL game data that simulates the ESPN API without requiring network access or live games. It's perfect for:

- **Offseason Testing**: Test your application when no games are happening
- **Development**: Build features without depending on live game data
- **Demonstrations**: Show features with predictable game states
- **CI/CD**: Run tests without external API dependencies

## Quick Start

### 1. Enable Mock Mode

Add to your `.env` file:

```bash
USE_MOCK_ESPN=true
```

### 2. Start Your Server

```bash
npm run dev
```

That's it! Your application will now use mock data instead of the real ESPN API.

## What You Get

The mock system provides **10 realistic games** covering all possible states:

| Game ID | Teams | Status | Purpose |
|---------|-------|--------|---------|
| 401671001 | BAL @ KC | Scheduled (2 days future) | Test upcoming games |
| 401671002 | DET @ SF | In Progress (Q1) | Test early game state |
| 401671003 | MIA @ BUF | In Progress (Q2) | Test mid-game updates |
| 401671004 | PHI @ DAL | Halftime | Test halftime display |
| 401671005 | MIN @ GB | In Progress (Q3) | Test late game state |
| 401671006 | PIT @ CIN | In Progress (Q4) | Test close finish |
| 401671007 | SEA @ LAR | Final | Test completed games |
| 401671008 | TB @ ATL | Final | Test away wins |
| 401671009 | SF @ KC | Final/OT (Tie 20-20) | Test tie games |
| 401671010 | CIN @ BUF | Postponed | Test postponed games |

## Features

### ✅ Authentic Data Structure

Mock data matches the exact ESPN API format:
- Team data with real logos and colors
- Complete game metadata
- Odds and probability information
- Live game status (period, clock, etc.)

### ✅ Progressive Score Updates

In-progress games update their scores automatically based on elapsed time:

```javascript
// Game starts at 0-0
// After 10 minutes: SF 7, DET 0
// After 15 minutes: SF 7, DET 3
// Scores progress realistically through the game
```

### ✅ Configurable Schedule

Set game times relative to "now":

```javascript
import { MockESPNService } from './src/mocks/MockESPNService.js';

MockESPNService.configure({
  baseDate: new Date(), // Games scheduled relative to this
  season: 2024,
  seasonType: 2, // 1=preseason, 2=regular, 3=postseason
  week: 5
});
```

### ✅ Multiple Scenarios

Choose from preset scenarios:

```javascript
import { enableMockData } from './src/mocks/index.js';

// All games in progress
enableMockData({ scenario: 'allLive' });

// All games completed
enableMockData({ scenario: 'allCompleted' });

// All games upcoming
enableMockData({ scenario: 'allUpcoming' });

// Mixed states (default)
enableMockData({ scenario: 'mixed' });
```

## Configuration Options

### Environment Variables

```bash
# Enable mock mode
USE_MOCK_ESPN=true

# Optional: Override configuration
MOCK_SEASON=2024
MOCK_WEEK=5
MOCK_SEASON_TYPE=2
```

### Programmatic Configuration

```javascript
import { MockESPNService } from './src/mocks/MockESPNService.js';

MockESPNService.configure({
  baseDate: new Date('2024-09-15T18:00:00Z'),
  season: 2024,
  seasonType: 2,
  week: 2
});
```

### Custom Game Schedule

Modify game times by editing `src/mocks/mockConfig.js`:

```javascript
export const GAME_SCHEDULE = {
  scheduled: {
    thursdayNight: 2 * 24 * 60, // 2 days in future (minutes)
  },
  inProgress: {
    earlyQ1: -15,   // Started 15 min ago
    midQ2: -45,     // Started 45 min ago
    // ...
  }
};
```

## Usage Examples

### Basic API Access

```bash
# Fetch games (will use mock data if enabled)
curl http://localhost:3001/api/games/2024/2/1

# Force refresh to see score updates
curl http://localhost:3001/api/games/2024/2/1?refresh=true
```

### In Your Code

The mock system integrates seamlessly:

```javascript
import { GameService } from './src/services/GameService.js';

// Works with both real and mock ESPN data
const games = await GameService.getGamesForWeek(2024, 2, 1);

// Games will be mock data if USE_MOCK_ESPN=true
games.forEach(game => {
  console.log(`${game.awayTeam.abbreviation} @ ${game.homeTeam.abbreviation}`);
  console.log(`Status: ${game.status}, Score: ${game.awayScore}-${game.homeScore}`);
});
```

### Testing Specific States

```javascript
import { MockESPNService } from './src/mocks/MockESPNService.js';

// Get a specific game by ID
const game = await MockESPNService.fetchGameById('401671002');

// Check game state
if (game.competitions[0].status.type.state === 'in') {
  console.log('Game is in progress!');
}
```

## Testing

### Run Mock Tests

```bash
npm test tests/mock-espn.test.js
```

### Example Scripts

```bash
# See all mock features in action
node examples/useMockData.js

# Test integration with GameService
node examples/testIntegration.js
```

## Advanced Usage

### Custom Games

Create your own game scenarios:

```javascript
import { createESPNGame, NFL_TEAMS } from './src/mocks/espnGameData.js';

const customGame = createESPNGame({
  id: 'custom001',
  homeTeam: NFL_TEAMS.KC,
  awayTeam: NFL_TEAMS.SF,
  homeScore: 31,
  awayScore: 28,
  gameDate: new Date(),
  status: 'final',
  week: 1,
  season: 2024,
  seasonType: 2
});

MockESPNService.setMockGames([customGame]);
```

### Update Game States Dynamically

```javascript
// Simulate a game progressing
MockESPNService.updateGame('401671002', {
  competitions: [{
    competitors: [
      { score: '14' }, // home
      { score: '10' }  // away
    ],
    status: {
      period: 2,
      displayClock: '5:00'
    }
  }]
});
```

### Score Progression Details

Scores update based on elapsed time from game start:

```javascript
import { getProgressiveScore } from './src/mocks/espnGameData.js';

const game = await MockESPNService.fetchGameById('401671002');
const elapsedMinutes = 15;

// Get game state as it would be 15 minutes after kickoff
const updatedGame = getProgressiveScore(game, elapsedMinutes);
```

## NFL Teams Available

16 teams are included with authentic data:

- Kansas City Chiefs (KC)
- Baltimore Ravens (BAL)
- San Francisco 49ers (SF)
- Detroit Lions (DET)
- Buffalo Bills (BUF)
- Miami Dolphins (MIA)
- Dallas Cowboys (DAL)
- Philadelphia Eagles (PHI)
- Green Bay Packers (GB)
- Minnesota Vikings (MIN)
- Cincinnati Bengals (CIN)
- Pittsburgh Steelers (PIT)
- Los Angeles Rams (LAR)
- Seattle Seahawks (SEA)
- Tampa Bay Buccaneers (TB)
- Atlanta Falcons (ATL)

Each team includes:
- Team ID (matches ESPN)
- Full name and abbreviation
- Logo URL (ESPN CDN)
- Primary and alternate colors (hex)

## Troubleshooting

### Mock data not loading?

1. Check `USE_MOCK_ESPN=true` in your `.env`
2. Verify console logs show `[GameService] Using MockESPNService`
3. Check that season/week parameters match your configuration

### Scores not updating?

1. Use `?refresh=true` to force a refresh
2. Check that games are in the correct time window
3. Only in-progress games update automatically

### Wrong week showing?

Mock service returns empty array if requested week doesn't match configured week:

```javascript
// Configured: week 1
MockESPNService.configure({ week: 1 });

// Requested: week 5 - returns []
await MockESPNService.fetchGames(2024, 2, 5);
```

## Architecture

```
┌─────────────────────────────────────────┐
│         GameService                      │
│  (Handles caching & business logic)     │
└───────────────┬─────────────────────────┘
                │
                ├─ if USE_MOCK_ESPN=true
                │
                v
┌─────────────────────────────────────────┐
│      MockESPNService                     │
│  (Generates & serves mock data)         │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  espnGameData.js                   │ │
│  │  • Team data                       │ │
│  │  • Game generator                  │ │
│  │  • Score progression               │ │
│  └────────────────────────────────────┘ │
│                                          │
│  ┌────────────────────────────────────┐ │
│  │  mockConfig.js                     │ │
│  │  • Configuration options           │ │
│  │  • Preset scenarios                │ │
│  │  • Validation                      │ │
│  └────────────────────────────────────┘ │
└─────────────────────────────────────────┘
```

## Best Practices

1. **Use environment variables** for easy on/off switching
2. **Match week numbers** when requesting games
3. **Test all game states** (scheduled, live, final, postponed)
4. **Use preset scenarios** for common testing needs
5. **Refresh periodically** to see score updates in live games

## Limitations

- **Fixed team set**: Only 16 teams included (can be expanded)
- **One week at a time**: Configure one week per instance
- **Requires database**: GameService still uses database for caching
- **No network calls**: Cannot fetch real-time ESPN data when enabled

## Migration Path

To switch between real and mock:

```bash
# Development with mock data
USE_MOCK_ESPN=true npm run dev

# Production with real ESPN API
USE_MOCK_ESPN=false npm start
# or just omit the variable
```

## Support

For issues or questions:

1. Check the [detailed README](src/mocks/README.md)
2. Review [example scripts](examples/)
3. Run [mock tests](tests/mock-espn.test.js)
4. Open an issue on GitHub

## License

This mock data is for testing purposes only. Team names, logos, and data structure are based on ESPN's API format.
