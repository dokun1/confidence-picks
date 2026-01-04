/**
 * Authentic ESPN API mock data based on actual ESPN API responses
 * These structures match the exact format ESPN returns for NFL games
 * 
 * Each game object follows ESPN's scoreboard API structure:
 * - competitions[0] contains the main game data
 * - competitors array has home/away teams
 * - status contains game state, clock, period info
 * - odds and probability data when available
 */

// NFL Teams data (subset for mocks)
export const NFL_TEAMS = {
  KC: { id: '12', name: 'Kansas City Chiefs', abbreviation: 'KC', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/kc.png', color: 'e31837', alternateColor: 'ffb612' },
  BAL: { id: '33', name: 'Baltimore Ravens', abbreviation: 'BAL', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/bal.png', color: '241773', alternateColor: '9e7c0c' },
  SF: { id: '25', name: 'San Francisco 49ers', abbreviation: 'SF', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/sf.png', color: 'aa0000', alternateColor: 'b3995d' },
  DET: { id: '8', name: 'Detroit Lions', abbreviation: 'DET', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/det.png', color: '0076b6', alternateColor: 'b0b7bc' },
  BUF: { id: '2', name: 'Buffalo Bills', abbreviation: 'BUF', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/buf.png', color: '00338d', alternateColor: 'c60c30' },
  MIA: { id: '15', name: 'Miami Dolphins', abbreviation: 'MIA', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/mia.png', color: '008e97', alternateColor: 'fc4c02' },
  DAL: { id: '6', name: 'Dallas Cowboys', abbreviation: 'DAL', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/dal.png', color: '041e42', alternateColor: '869397' },
  PHI: { id: '21', name: 'Philadelphia Eagles', abbreviation: 'PHI', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/phi.png', color: '004c54', alternateColor: 'a5acaf' },
  GB: { id: '9', name: 'Green Bay Packers', abbreviation: 'GB', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/gb.png', color: '203731', alternateColor: 'ffb612' },
  MIN: { id: '16', name: 'Minnesota Vikings', abbreviation: 'MIN', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/min.png', color: '4f2683', alternateColor: 'ffc62f' },
  CIN: { id: '4', name: 'Cincinnati Bengals', abbreviation: 'CIN', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/cin.png', color: 'fb4f14', alternateColor: '000000' },
  PIT: { id: '23', name: 'Pittsburgh Steelers', abbreviation: 'PIT', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/pit.png', color: 'ffb612', alternateColor: '101820' },
  LAR: { id: '14', name: 'Los Angeles Rams', abbreviation: 'LAR', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/lar.png', color: '003594', alternateColor: 'ffd100' },
  SEA: { id: '26', name: 'Seattle Seahawks', abbreviation: 'SEA', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/sea.png', color: '002244', alternateColor: '69be28' },
  TB: { id: '27', name: 'Tampa Bay Buccaneers', abbreviation: 'TB', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/tb.png', color: 'd50a0a', alternateColor: 'ff7900' },
  ATL: { id: '1', name: 'Atlanta Falcons', abbreviation: 'ATL', logo: 'https://a.espncdn.com/i/teamlogos/nfl/500/atl.png', color: 'a71930', alternateColor: '000000' }
};

/**
 * Helper to create ESPN game structure
 */
function createESPNGame({ 
  id, 
  homeTeam, 
  awayTeam, 
  homeScore, 
  awayScore, 
  gameDate, 
  status, 
  week, 
  season, 
  seasonType,
  period = null,
  clock = null,
  displayClock = null,
  odds = null,
  probability = null
}) {
  const statusConfig = {
    scheduled: { state: 'pre', name: 'STATUS_SCHEDULED', description: 'Scheduled', detail: gameDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }), completed: false },
    inProgress: { state: 'in', name: 'STATUS_IN_PROGRESS', description: 'In Progress', detail: displayClock || 'Q1 15:00', completed: false },
    halftime: { state: 'in', name: 'STATUS_HALFTIME', description: 'Halftime', detail: 'Halftime', completed: false },
    final: { state: 'post', name: 'STATUS_FINAL', description: 'Final', detail: 'Final', completed: true },
    finalOT: { state: 'post', name: 'STATUS_FINAL', description: 'Final/OT', detail: 'Final/OT', completed: true },
    postponed: { state: 'pre', name: 'STATUS_POSTPONED', description: 'Postponed', detail: 'Postponed', completed: false }
  };

  const statusData = statusConfig[status] || statusConfig.scheduled;

  return {
    id,
    uid: `s:20~l:28~e:${id}`,
    date: gameDate.toISOString(),
    name: `${awayTeam.name} at ${homeTeam.name}`,
    shortName: `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`,
    season: { year: season, type: seasonType },
    week: { number: week },
    competitions: [{
      id,
      uid: `s:20~l:28~e:${id}~c:${id}`,
      date: gameDate.toISOString(),
      attendance: 0,
      type: { id: '1', abbreviation: 'STD' },
      timeValid: true,
      neutralSite: false,
      conferenceCompetition: false,
      recent: false,
      venue: {
        id: '3800',
        fullName: `${homeTeam.name} Stadium`,
        address: { city: 'City', state: 'ST' },
        capacity: 70000,
        indoor: false
      },
      competitors: [
        {
          id: homeTeam.id,
          uid: `s:20~t:${homeTeam.id}`,
          type: 'team',
          order: 0,
          homeAway: 'home',
          team: {
            id: homeTeam.id,
            uid: `s:20~t:${homeTeam.id}`,
            location: homeTeam.name.split(' ').slice(0, -1).join(' '),
            name: homeTeam.name.split(' ').slice(-1)[0],
            abbreviation: homeTeam.abbreviation,
            displayName: homeTeam.name,
            shortDisplayName: homeTeam.abbreviation,
            color: homeTeam.color,
            alternateColor: homeTeam.alternateColor,
            isActive: true,
            logo: homeTeam.logo
          },
          score: homeScore.toString(),
          linescores: []
        },
        {
          id: awayTeam.id,
          uid: `s:20~t:${awayTeam.id}`,
          type: 'team',
          order: 1,
          homeAway: 'away',
          team: {
            id: awayTeam.id,
            uid: `s:20~t:${awayTeam.id}`,
            location: awayTeam.name.split(' ').slice(0, -1).join(' '),
            name: awayTeam.name.split(' ').slice(-1)[0],
            abbreviation: awayTeam.abbreviation,
            displayName: awayTeam.name,
            shortDisplayName: awayTeam.abbreviation,
            color: awayTeam.color,
            alternateColor: awayTeam.alternateColor,
            isActive: true,
            logo: awayTeam.logo
          },
          score: awayScore.toString(),
          linescores: []
        }
      ],
      notes: [],
      status: {
        clock: clock || 0,
        displayClock: displayClock || '0:00',
        period: period || 0,
        type: {
          id: status === 'scheduled' ? '1' : status === 'final' || status === 'finalOT' ? '3' : '2',
          name: statusData.name,
          state: statusData.state,
          completed: statusData.completed,
          description: statusData.description,
          detail: statusData.detail,
          shortDetail: statusData.detail
        }
      },
      broadcasts: [],
      format: { regulation: { periods: 4 } },
      startDate: gameDate.toISOString(),
      geoBroadcasts: [],
      odds: odds ? [odds] : [],
      situation: probability ? {
        lastPlay: {
          probability: {
            homeWinPercentage: probability.homeWinPct,
            awayWinPercentage: probability.awayWinPct,
            tiePercentage: 0
          }
        }
      } : undefined,
      week: { number: week },
      season: { year: season, type: seasonType }
    }],
    links: [],
    status: {
      clock: clock || 0,
      displayClock: displayClock || '0:00',
      period: period || 0,
      type: {
        id: status === 'scheduled' ? '1' : status === 'final' || status === 'finalOT' ? '3' : '2',
        name: statusData.name,
        state: statusData.state,
        completed: statusData.completed,
        description: statusData.description,
        detail: statusData.detail,
        shortDetail: statusData.detail
      }
    }
  };
}

/**
 * Generate mock games for a configurable week
 * Games are scheduled with time offsets from a base date
 */
export function generateMockWeek(config = {}) {
  const {
    baseDate = new Date(),
    season = new Date().getFullYear(),
    seasonType = 2, // Regular season
    week = 1
  } = config;

  const games = [];

  // Game 1: Scheduled - 2 days in future (Thursday Night Football)
  const game1Date = new Date(baseDate.getTime() + 2 * 24 * 60 * 60 * 1000);
  game1Date.setHours(20, 15, 0, 0); // 8:15 PM
  games.push(createESPNGame({
    id: '401671001',
    homeTeam: NFL_TEAMS.KC,
    awayTeam: NFL_TEAMS.BAL,
    homeScore: 0,
    awayScore: 0,
    gameDate: game1Date,
    status: 'scheduled',
    week,
    season,
    seasonType,
    odds: {
      provider: { name: 'consensus' },
      details: 'KC -3.0',
      overUnder: 47.5,
      spread: -3.0,
      homeTeamOdds: { favorite: true },
      awayTeamOdds: { favorite: false }
    }
  }));

  // Game 2: In Progress Q1 - started 15 minutes ago
  const game2Date = new Date(baseDate.getTime() - 15 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671002',
    homeTeam: NFL_TEAMS.SF,
    awayTeam: NFL_TEAMS.DET,
    homeScore: 7,
    awayScore: 3,
    gameDate: game2Date,
    status: 'inProgress',
    week,
    season,
    seasonType,
    period: 1,
    clock: 540, // 9:00 remaining
    displayClock: '9:00',
    probability: {
      homeWinPct: 62.5,
      awayWinPct: 37.5
    }
  }));

  // Game 3: In Progress Q2 - started 45 minutes ago
  const game3Date = new Date(baseDate.getTime() - 45 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671003',
    homeTeam: NFL_TEAMS.BUF,
    awayTeam: NFL_TEAMS.MIA,
    homeScore: 14,
    awayScore: 17,
    gameDate: game3Date,
    status: 'inProgress',
    week,
    season,
    seasonType,
    period: 2,
    clock: 425, // 7:05 remaining
    displayClock: '7:05',
    probability: {
      homeWinPct: 45.2,
      awayWinPct: 54.8
    }
  }));

  // Game 4: Halftime - started 70 minutes ago
  const game4Date = new Date(baseDate.getTime() - 70 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671004',
    homeTeam: NFL_TEAMS.DAL,
    awayTeam: NFL_TEAMS.PHI,
    homeScore: 10,
    awayScore: 10,
    gameDate: game4Date,
    status: 'halftime',
    week,
    season,
    seasonType,
    period: 2,
    clock: 0,
    displayClock: '0:00',
    probability: {
      homeWinPct: 50.0,
      awayWinPct: 50.0
    }
  }));

  // Game 5: In Progress Q3 - started 90 minutes ago
  const game5Date = new Date(baseDate.getTime() - 90 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671005',
    homeTeam: NFL_TEAMS.GB,
    awayTeam: NFL_TEAMS.MIN,
    homeScore: 21,
    awayScore: 17,
    gameDate: game5Date,
    status: 'inProgress',
    week,
    season,
    seasonType,
    period: 3,
    clock: 600, // 10:00 remaining
    displayClock: '10:00',
    probability: {
      homeWinPct: 68.3,
      awayWinPct: 31.7
    }
  }));

  // Game 6: In Progress Q4 - started 2.5 hours ago (close game)
  const game6Date = new Date(baseDate.getTime() - 150 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671006',
    homeTeam: NFL_TEAMS.CIN,
    awayTeam: NFL_TEAMS.PIT,
    homeScore: 24,
    awayScore: 24,
    gameDate: game6Date,
    status: 'inProgress',
    week,
    season,
    seasonType,
    period: 4,
    clock: 120, // 2:00 remaining
    displayClock: '2:00',
    probability: {
      homeWinPct: 51.5,
      awayWinPct: 48.5
    }
  }));

  // Game 7: Final - Home team wins - completed 1 hour ago
  const game7Date = new Date(baseDate.getTime() - 4 * 60 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671007',
    homeTeam: NFL_TEAMS.LAR,
    awayTeam: NFL_TEAMS.SEA,
    homeScore: 28,
    awayScore: 21,
    gameDate: game7Date,
    status: 'final',
    week,
    season,
    seasonType,
    period: 4,
    clock: 0,
    displayClock: '0:00'
  }));

  // Game 8: Final - Away team wins - completed 2 hours ago
  const game8Date = new Date(baseDate.getTime() - 5 * 60 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671008',
    homeTeam: NFL_TEAMS.ATL,
    awayTeam: NFL_TEAMS.TB,
    homeScore: 17,
    awayScore: 24,
    gameDate: game8Date,
    status: 'final',
    week,
    season,
    seasonType,
    period: 4,
    clock: 0,
    displayClock: '0:00'
  }));

  // Game 9: Final Overtime Tie (20-20) - completed 3 hours ago
  // Note: NFL rules changed in 2017, ties are rare but possible
  const game9Date = new Date(baseDate.getTime() - 6 * 60 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671009',
    homeTeam: NFL_TEAMS.KC,
    awayTeam: NFL_TEAMS.SF,
    homeScore: 20,
    awayScore: 20,
    gameDate: game9Date,
    status: 'finalOT',
    week,
    season,
    seasonType,
    period: 5, // Overtime
    clock: 0,
    displayClock: '0:00'
  }));

  // Game 10: Postponed - was scheduled for yesterday
  const game10Date = new Date(baseDate.getTime() - 24 * 60 * 60 * 1000);
  games.push(createESPNGame({
    id: '401671010',
    homeTeam: NFL_TEAMS.BUF,
    awayTeam: NFL_TEAMS.CIN,
    homeScore: 0,
    awayScore: 0,
    gameDate: game10Date,
    status: 'postponed',
    week,
    season,
    seasonType
  }));

  return games;
}

/**
 * Get live score progression for a game
 * Returns updated scores based on elapsed time
 */
export function getProgressiveScore(game, elapsedMinutes) {
  // Only update in-progress games
  if (game.competitions[0].status.type.state !== 'in') {
    return game;
  }

  const gameId = game.id;
  const progression = SCORE_PROGRESSIONS[gameId];
  
  if (!progression) {
    return game;
  }

  // Find the current state based on elapsed time
  let currentState = progression[0];
  for (const state of progression) {
    if (elapsedMinutes >= state.minute) {
      currentState = state;
    } else {
      break;
    }
  }

  // Update game with current state
  const updatedGame = JSON.parse(JSON.stringify(game));
  updatedGame.competitions[0].competitors[0].score = currentState.homeScore.toString();
  updatedGame.competitions[0].competitors[1].score = currentState.awayScore.toString();
  updatedGame.competitions[0].status.period = currentState.period;
  updatedGame.competitions[0].status.displayClock = currentState.clock;
  updatedGame.competitions[0].status.clock = currentState.clockSeconds || 0;

  // Update probability if exists
  if (currentState.probability && updatedGame.competitions[0].situation) {
    updatedGame.competitions[0].situation.lastPlay.probability = {
      homeWinPercentage: currentState.probability.homeWinPct,
      awayWinPercentage: currentState.probability.awayWinPct,
      tiePercentage: 0
    };
  }

  return updatedGame;
}

/**
 * Score progressions for in-progress games
 * Each entry represents the game state at a specific minute
 */
const SCORE_PROGRESSIONS = {
  '401671002': [ // SF vs DET - Q1
    { minute: 0, period: 1, clock: '15:00', clockSeconds: 900, homeScore: 0, awayScore: 0, probability: { homeWinPct: 50, awayWinPct: 50 } },
    { minute: 5, period: 1, clock: '12:00', clockSeconds: 720, homeScore: 0, awayScore: 0, probability: { homeWinPct: 48, awayWinPct: 52 } },
    { minute: 10, period: 1, clock: '9:00', clockSeconds: 540, homeScore: 7, awayScore: 0, probability: { homeWinPct: 65, awayWinPct: 35 } },
    { minute: 15, period: 1, clock: '6:00', clockSeconds: 360, homeScore: 7, awayScore: 3, probability: { homeWinPct: 62, awayWinPct: 38 } },
    { minute: 20, period: 1, clock: '3:00', clockSeconds: 180, homeScore: 7, awayScore: 3, probability: { homeWinPct: 60, awayWinPct: 40 } },
    { minute: 25, period: 2, clock: '15:00', clockSeconds: 900, homeScore: 14, awayScore: 3, probability: { homeWinPct: 75, awayWinPct: 25 } }
  ],
  '401671003': [ // BUF vs MIA - Q2
    { minute: 0, period: 1, clock: '15:00', clockSeconds: 900, homeScore: 0, awayScore: 0, probability: { homeWinPct: 50, awayWinPct: 50 } },
    { minute: 15, period: 1, clock: '5:00', clockSeconds: 300, homeScore: 7, awayScore: 0, probability: { homeWinPct: 65, awayWinPct: 35 } },
    { minute: 20, period: 2, clock: '15:00', clockSeconds: 900, homeScore: 7, awayScore: 7, probability: { homeWinPct: 50, awayWinPct: 50 } },
    { minute: 30, period: 2, clock: '10:00', clockSeconds: 600, homeScore: 7, awayScore: 14, probability: { homeWinPct: 35, awayWinPct: 65 } },
    { minute: 40, period: 2, clock: '7:05', clockSeconds: 425, homeScore: 14, awayScore: 14, probability: { homeWinPct: 50, awayWinPct: 50 } },
    { minute: 45, period: 2, clock: '4:00', clockSeconds: 240, homeScore: 14, awayScore: 17, probability: { homeWinPct: 45, awayWinPct: 55 } },
    { minute: 50, period: 2, clock: '1:00', clockSeconds: 60, homeScore: 14, awayScore: 17, probability: { homeWinPct: 42, awayWinPct: 58 } }
  ],
  '401671005': [ // GB vs MIN - Q3
    { minute: 0, period: 1, clock: '15:00', clockSeconds: 900, homeScore: 0, awayScore: 0, probability: { homeWinPct: 50, awayWinPct: 50 } },
    { minute: 30, period: 2, clock: '0:00', clockSeconds: 0, homeScore: 14, awayScore: 10, probability: { homeWinPct: 60, awayWinPct: 40 } },
    { minute: 45, period: 3, clock: '15:00', clockSeconds: 900, homeScore: 14, awayScore: 10, probability: { homeWinPct: 62, awayWinPct: 38 } },
    { minute: 60, period: 3, clock: '10:00', clockSeconds: 600, homeScore: 21, awayScore: 10, probability: { homeWinPct: 78, awayWinPct: 22 } },
    { minute: 75, period: 3, clock: '5:00', clockSeconds: 300, homeScore: 21, awayScore: 17, probability: { homeWinPct: 68, awayWinPct: 32 } },
    { minute: 90, period: 4, clock: '15:00', clockSeconds: 900, homeScore: 21, awayScore: 17, probability: { homeWinPct: 70, awayWinPct: 30 } }
  ],
  '401671006': [ // CIN vs PIT - Q4 close
    { minute: 0, period: 1, clock: '15:00', clockSeconds: 900, homeScore: 0, awayScore: 0, probability: { homeWinPct: 50, awayWinPct: 50 } },
    { minute: 30, period: 2, clock: '0:00', clockSeconds: 0, homeScore: 10, awayScore: 14, probability: { homeWinPct: 40, awayWinPct: 60 } },
    { minute: 60, period: 3, clock: '0:00', clockSeconds: 0, homeScore: 17, awayScore: 17, probability: { homeWinPct: 50, awayWinPct: 50 } },
    { minute: 90, period: 4, clock: '15:00', clockSeconds: 900, homeScore: 17, awayScore: 17, probability: { homeWinPct: 50, awayWinPct: 50 } },
    { minute: 120, period: 4, clock: '10:00', clockSeconds: 600, homeScore: 24, awayScore: 17, probability: { homeWinPct: 72, awayWinPct: 28 } },
    { minute: 135, period: 4, clock: '5:00', clockSeconds: 300, homeScore: 24, awayScore: 21, probability: { homeWinPct: 62, awayWinPct: 38 } },
    { minute: 145, period: 4, clock: '2:00', clockSeconds: 120, homeScore: 24, awayScore: 24, probability: { homeWinPct: 51, awayWinPct: 49 } },
    { minute: 155, period: 4, clock: '0:30', clockSeconds: 30, homeScore: 27, awayScore: 24, probability: { homeWinPct: 88, awayWinPct: 12 } }
  ]
};
