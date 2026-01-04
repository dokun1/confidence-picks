# Mock ESPN API Data

This module provides realistic mock ESPN API data for testing during the offseason or when developing features without hitting the real ESPN API.

## Features

- ✅ **Authentic Data Structure**: Mock data matches the exact ESPN API response format
- ✅ **All Game States**: Scheduled, in-progress (Q1-Q4, halftime), final, overtime, postponed
- ✅ **Live Score Updates**: Scores progress realistically over time for in-progress games
- ✅ **Configurable Schedule**: Set game times relative to current time
- ✅ **Multiple Teams**: 16 NFL teams included with real logos and colors
- ✅ **Odds & Probability**: Realistic betting odds and win probabilities
- ✅ **Drop-in Replacement**: Works seamlessly with existing GameService

## Quick Start

### 1. Enable Mock Data

Set the environment variable in your `.env` file:

```bash
USE_MOCK_ESPN=true
```

### 2. Start Your Server

```bash
npm run dev
```

The backend will now use mock data instead of calling the real ESPN API.

### 3. Test Different Game States

Access games through the API:

```bash
# Get all games for the mock week
curl http://localhost:3001/api/games/2024/2/1

# Force refresh to see score updates
curl http://localhost:3001/api/games/2024/2/1?refresh=true
```

## Configuration

### Using Default Configuration

By default, mock data generates a week with:
- 1 scheduled game (2 days in future)
- 5 in-progress games at different stages
- 3 completed games (including 1 tie)
- 1 postponed game

### Custom Configuration

Create a custom setup in your code:

```javascript
import { MockESPNService } from './src/mocks/MockESPNService.js';

// Configure mock games
MockESPNService.configure({
  baseDate: new Date('2024-09-08T12:00:00Z'),
  season: 2024,
  seasonType: 2, // Regular season
  week: 5
});
```

### Environment Variable Overrides

You can also configure via environment variables:

```bash
USE_MOCK_ESPN=true
MOCK_SEASON=2024
MOCK_WEEK=5
MOCK_SEASON_TYPE=2
```

### Preset Scenarios

Use preset scenarios for common testing needs:

```javascript
import { enableMockData } from './src/mocks/index.js';

// All games scheduled in the future
enableMockData({ scenario: 'allUpcoming' });

// All games completed
enableMockData({ scenario: 'allCompleted' });

// All games currently in progress
enableMockData({ scenario: 'allLive' });

// Mixed states (default)
enableMockData({ scenario: 'mixed' });
```

## Game States Included

The mock data includes examples of all possible NFL game states:

### 1. Scheduled Games
- **Game ID**: `401671001`
- **Teams**: KC @ BAL
- **Status**: Scheduled for 2 days in future
- **Use Case**: Test upcoming game display and pick submission

### 2. In-Progress Games

#### Early First Quarter
- **Game ID**: `401671002`
- **Teams**: DET @ SF
- **Status**: Q1 9:00 remaining, SF leading 7-3
- **Use Case**: Test live score updates

#### Second Quarter
- **Game ID**: `401671003`
- **Teams**: MIA @ BUF
- **Status**: Q2 7:05 remaining, MIA leading 17-14
- **Use Case**: Test game progression

#### Halftime
- **Game ID**: `401671004`
- **Teams**: PHI @ DAL
- **Status**: Halftime, tied 10-10
- **Use Case**: Test halftime display

#### Third Quarter
- **Game ID**: `401671005`
- **Teams**: MIN @ GB
- **Status**: Q3 10:00 remaining, GB leading 21-17
- **Use Case**: Test second-half updates

#### Fourth Quarter (Close Game)
- **Game ID**: `401671006`
- **Teams**: PIT @ CIN
- **Status**: Q4 2:00 remaining, tied 24-24
- **Use Case**: Test exciting finish scenarios

### 3. Final Games

#### Regular Win
- **Game ID**: `401671007`
- **Teams**: SEA @ LAR
- **Status**: Final, LAR wins 28-21
- **Use Case**: Test completed game display

#### Away Team Win
- **Game ID**: `401671008`
- **Teams**: TB @ ATL
- **Status**: Final, TB wins 24-17
- **Use Case**: Test away team victories

#### Overtime Tie
- **Game ID**: `401671009`
- **Teams**: SF @ KC
- **Status**: Final/OT, tied 20-20
- **Use Case**: Test tie game handling (rare but possible)

### 4. Postponed Games
- **Game ID**: `401671010`
- **Teams**: CIN @ BUF
- **Status**: Postponed
- **Use Case**: Test postponed game handling

## Progressive Score Updates

In-progress games update their scores based on elapsed time:

```javascript
// Scores change every minute for in-progress games
// Game progresses through realistic scoring patterns

// Example: Game 401671002 (SF vs DET)
// Minute 0:  SF 0, DET 0  (Kickoff)
// Minute 10: SF 7, DET 0  (SF touchdown)
// Minute 15: SF 7, DET 3  (DET field goal)
// Minute 25: SF 14, DET 3 (SF touchdown again)
```

The progression is realistic and matches actual NFL scoring patterns.

## Testing

### Manual Testing

1. **Test Scheduled Games**:
   ```bash
   # Set base date 3 days before games
   USE_MOCK_ESPN=true npm run dev
   ```

2. **Test Live Games**:
   ```bash
   # Games in progress with updating scores
   curl http://localhost:3001/api/games/2024/2/1?refresh=true
   ```

3. **Test Completed Games**:
   ```bash
   # Set base date after all games
   # Final scores should be stable
   ```

### Automated Testing

Add mock data to your tests:

```javascript
import { MockESPNService } from '../src/mocks/MockESPNService.js';

describe('Game Tests', () => {
  beforeEach(() => {
    MockESPNService.configure({
      baseDate: new Date('2024-09-08T12:00:00Z'),
      season: 2024,
      week: 1
    });
  });

  test('should fetch mock games', async () => {
    const games = await MockESPNService.fetchGames(2024, 2, 1);
    expect(games).toHaveLength(10);
  });
});
```

## API Reference

### MockESPNService

#### `configure(config)`
Set up the mock service with custom configuration.

```javascript
MockESPNService.configure({
  baseDate: new Date(),
  season: 2024,
  seasonType: 2,
  week: 1
});
```

#### `fetchGames(year, seasonType, week)`
Fetch mock games (mimics ESPNService.fetchGames).

```javascript
const games = await MockESPNService.fetchGames(2024, 2, 1);
```

#### `setEnabled(enabled)`
Enable or disable the mock service.

```javascript
MockESPNService.setEnabled(true);
```

#### `reset()`
Reset the mock service to initial state.

```javascript
MockESPNService.reset();
```

### Helper Functions

#### `enableMockData(options)`
Quick setup function.

```javascript
import { enableMockData } from './src/mocks/index.js';

enableMockData({ scenario: 'allLive' });
```

#### `generateMockWeek(config)`
Generate a full week of mock games.

```javascript
import { generateMockWeek } from './src/mocks/espnGameData.js';

const games = generateMockWeek({
  baseDate: new Date(),
  season: 2024,
  week: 1
});
```

## Data Structure

Mock data follows the exact ESPN API format. Here's a simplified example:

```json
{
  "id": "401671002",
  "date": "2024-09-08T17:00:00Z",
  "name": "Detroit Lions at San Francisco 49ers",
  "competitions": [{
    "competitors": [
      {
        "homeAway": "home",
        "team": { "abbreviation": "SF", "displayName": "San Francisco 49ers" },
        "score": "7"
      },
      {
        "homeAway": "away",
        "team": { "abbreviation": "DET", "displayName": "Detroit Lions" },
        "score": "3"
      }
    ],
    "status": {
      "period": 1,
      "displayClock": "9:00",
      "type": {
        "state": "in",
        "name": "STATUS_IN_PROGRESS",
        "completed": false
      }
    }
  }]
}
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
- Full name
- Abbreviation
- Logo URL (ESPN CDN)
- Primary and alternate colors

## Troubleshooting

### Mock data not loading?

1. Check that `USE_MOCK_ESPN=true` is set
2. Verify the import path is correct
3. Check console logs for configuration messages

### Scores not updating?

1. Use `?refresh=true` to force refresh
2. Check that games are in the correct time window
3. Verify game IDs match the mock data

### Wrong week showing?

1. Check your configuration matches the request parameters
2. Verify season, seasonType, and week all match
3. Mock service returns empty array if parameters don't match

## Advanced Usage

### Custom Game Data

Create your own custom games:

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

### Testing Specific Scenarios

```javascript
// Test a game that just started
MockESPNService.updateGame('401671002', {
  competitions: [{
    status: {
      period: 1,
      displayClock: '15:00',
      clock: 900
    }
  }]
});

// Test a close finish
MockESPNService.updateGame('401671006', {
  competitions: [{
    competitors: [
      { score: '27' },
      { score: '28' }
    ],
    status: {
      period: 4,
      displayClock: '0:15',
      clock: 15
    }
  }]
});
```

## Contributing

To add more teams or games:

1. Add team data to `NFL_TEAMS` in `espnGameData.js`
2. Create new games in `generateMockWeek()`
3. Add score progressions to `SCORE_PROGRESSIONS`
4. Update this README with new examples

## License

This mock data is for testing purposes only. Team names, logos, and data structure are based on ESPN's API format.
