/**
 * Authentic ESPN API mock data for FIFA World Cup 2026 (soccer)
 * These structures match the exact format ESPN returns for `fifa.world` games
 * so Game.fromESPNData / GameService parse them identically to NFL games.
 *
 * Each event object follows ESPN's scoreboard API structure:
 * - competitions[0] contains the main match data
 * - competitors[] array carries home/away teams via the `homeAway` field
 * - status.type.{state,name,description,completed} drives completion logic
 * - odds (3-way: home/draw/away) and probability data when available
 *
 * See WORLD_CUP_2026_API.md (repo root) for the live-feed reference. Soccer
 * differs from NFL only at the edges: two-half regulation, a draw outcome in
 * the group stage, and a 3-way moneyline. The competitor shape — including the
 * shared `homeAway` field — is identical, so the existing parser is reused.
 */

// National-team data (ESPN-shaped subset for mocks). Field set mirrors
// NFL_TEAMS in espnGameData.js exactly so the same parsing path applies.
// Logos use ESPN's soccer team-logo CDN pattern; colors are the federations'
// primary/alternate kit colors.
export const WORLD_CUP_2026_TEAMS = {
  USA: { id: '660', name: 'United States', abbreviation: 'USA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/660.png', color: '1a3668', alternateColor: 'b22234' },
  MEX: { id: '203', name: 'Mexico', abbreviation: 'MEX', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/203.png', color: '006847', alternateColor: 'ce1126' },
  CAN: { id: '196', name: 'Canada', abbreviation: 'CAN', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/196.png', color: 'd52b1e', alternateColor: 'ffffff' },
  BRA: { id: '205', name: 'Brazil', abbreviation: 'BRA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/205.png', color: 'fedf00', alternateColor: '009b3a' },
  ARG: { id: '202', name: 'Argentina', abbreviation: 'ARG', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/202.png', color: '6cace4', alternateColor: 'ffffff' },
  FRA: { id: '478', name: 'France', abbreviation: 'FRA', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/478.png', color: '21304f', alternateColor: 'ce1126' },
  ENG: { id: '448', name: 'England', abbreviation: 'ENG', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/448.png', color: 'ffffff', alternateColor: 'cf102d' },
  GER: { id: '481', name: 'Germany', abbreviation: 'GER', logo: 'https://a.espncdn.com/i/teamlogos/soccer/500/481.png', color: '000000', alternateColor: 'dd0000' }
};

/**
 * Build one ESPN-event-shaped object from a compact match descriptor.
 *
 * Mirrors createESPNGame in espnGameData.js, adapted for soccer: two-half
 * regulation, a 3-way moneyline, and an optional `stage` tag (group/r32/.../final)
 * carried on the competition so downstream soccer scoring can distinguish
 * group-stage draws from knockout advancement.
 *
 * @param {Object} descriptor
 * @param {string} descriptor.id - ESPN event id
 * @param {Date} descriptor.date - kickoff date/time
 * @param {Object} descriptor.homeTeam - entry from WORLD_CUP_2026_TEAMS
 * @param {Object} descriptor.awayTeam - entry from WORLD_CUP_2026_TEAMS
 * @param {number} descriptor.homeScore - home goals (regulation/FT)
 * @param {number} descriptor.awayScore - away goals (regulation/FT)
 * @param {('scheduled'|'inProgress'|'halftime'|'final'|'finalPK'|'postponed')} [descriptor.status='scheduled']
 * @param {string} [descriptor.state] - explicit ESPN state ('pre'|'in'|'post'); derived from status when omitted
 * @param {string} [descriptor.stage] - tournament stage tag (group|r32|r16|qf|sf|third|final)
 * @param {number} [descriptor.season=2026]
 * @param {number} [descriptor.period=null] - 1 = first half, 2 = second half, 3+ = extra time
 * @param {number} [descriptor.clock=null]
 * @param {string} [descriptor.displayClock=null]
 * @param {Object} [descriptor.odds=null] - 3-way moneyline descriptor { home, draw, away, provider, favorite }
 * @param {Object} [descriptor.probability=null] - { homeWinPct, awayWinPct, drawPct }
 * @returns {Object} ESPN scoreboard event
 */
export function buildMockWorldCupEvent({
  id,
  date,
  homeTeam,
  awayTeam,
  homeScore,
  awayScore,
  status = 'scheduled',
  state = null,
  stage = null,
  season = 2026,
  period = null,
  clock = null,
  displayClock = null,
  odds = null,
  probability = null
}) {
  const statusConfig = {
    scheduled: { state: 'pre', name: 'STATUS_SCHEDULED', description: 'Scheduled', detail: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }), completed: false },
    inProgress: { state: 'in', name: 'STATUS_IN_PROGRESS', description: 'In Progress', detail: displayClock || "1' 1st Half", completed: false },
    halftime: { state: 'in', name: 'STATUS_HALFTIME', description: 'Halftime', detail: 'Halftime', completed: false },
    final: { state: 'post', name: 'STATUS_FULL_TIME', description: 'Full Time', detail: 'FT', completed: true },
    finalPK: { state: 'post', name: 'STATUS_FINAL_PEN', description: 'Full Time (Penalties)', detail: 'FT (Pens)', completed: true },
    postponed: { state: 'pre', name: 'STATUS_POSTPONED', description: 'Postponed', detail: 'Postponed', completed: false }
  };

  const statusData = statusConfig[status] || statusConfig.scheduled;
  const resolvedState = state || statusData.state;
  const statusTypeId = resolvedState === 'pre' ? '1' : resolvedState === 'post' ? '3' : '2';

  const statusBlock = {
    clock: clock || 0,
    displayClock: displayClock || '0\'',
    period: period || 0,
    type: {
      id: statusTypeId,
      name: statusData.name,
      state: resolvedState,
      completed: statusData.completed,
      description: statusData.description,
      detail: statusData.detail,
      shortDetail: statusData.detail
    }
  };

  // 3-way moneyline (home/draw/away) — soccer-specific vs NFL's 2-way spread.
  const oddsArray = odds ? [{
    provider: { name: odds.provider || 'DraftKings' },
    details: odds.details || `${homeTeam.abbreviation} ML ${odds.home}`,
    moneyline: {
      home: { close: { odds: odds.home } },
      draw: { close: { odds: odds.draw } },
      away: { close: { odds: odds.away } }
    },
    drawOdds: { moneyLine: odds.draw },
    homeTeamOdds: { favorite: odds.favorite === 'home' },
    awayTeamOdds: { favorite: odds.favorite === 'away' }
  }] : [];

  const buildCompetitor = (team, homeAway, scoreValue, order) => ({
    id: team.id,
    uid: `s:600~t:${team.id}`,
    type: 'team',
    order,
    homeAway,
    team: {
      id: team.id,
      uid: `s:600~t:${team.id}`,
      location: team.name,
      name: team.name,
      abbreviation: team.abbreviation,
      displayName: team.name,
      shortDisplayName: team.abbreviation,
      color: team.color,
      alternateColor: team.alternateColor,
      isActive: true,
      logo: team.logo
    },
    score: scoreValue.toString(),
    linescores: []
  });

  return {
    id,
    uid: `s:600~l:606~e:${id}`,
    date: date.toISOString(),
    name: `${awayTeam.name} at ${homeTeam.name}`,
    shortName: `${awayTeam.abbreviation} @ ${homeTeam.abbreviation}`,
    season: { year: season, type: 1 },
    competitions: [{
      id,
      uid: `s:600~l:606~e:${id}~c:${id}`,
      date: date.toISOString(),
      attendance: 0,
      type: { id: '1', abbreviation: 'STD' },
      timeValid: true,
      neutralSite: true,
      conferenceCompetition: false,
      recent: false,
      stage, // soccer-only tag; NFL parsing ignores it
      venue: {
        id: '5000',
        fullName: `${homeTeam.name} Host Stadium`,
        address: { city: 'City', state: 'ST' },
        capacity: 65000,
        indoor: false
      },
      competitors: [
        buildCompetitor(homeTeam, 'home', homeScore, 0),
        buildCompetitor(awayTeam, 'away', awayScore, 1)
      ],
      notes: [],
      status: statusBlock,
      broadcasts: [],
      format: { regulation: { periods: 2 } },
      startDate: date.toISOString(),
      geoBroadcasts: [],
      odds: oddsArray,
      situation: probability ? {
        lastPlay: {
          probability: {
            homeWinPercentage: probability.homeWinPct,
            awayWinPercentage: probability.awayWinPct,
            tiePercentage: probability.drawPct || 0
          }
        }
      } : undefined,
      season: { year: season, type: 1 }
    }],
    links: [],
    status: statusBlock
  };
}

/**
 * Generate mock World Cup events for a single tournament stage.
 *
 * Stub for now — returns [] so the file is importable while the fixture
 * generator is built out in a later task.
 *
 * @param {Object} config
 * @param {string} config.stage - tournament stage (group|r32|r16|qf|sf|third|final)
 * @param {Date} [config.baseDate] - anchor date for kickoff offsets
 * @param {number} [config.year=2026]
 * @returns {Array<Object>} ESPN scoreboard events for the stage
 */
export function generateMockWorldCupStage({ stage, baseDate, year } = {}) {
  return [];
}
