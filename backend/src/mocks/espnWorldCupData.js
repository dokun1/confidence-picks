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
 * @param {('scheduled'|'inProgress'|'halftime'|'final'|'draw'|'finalPK'|'postponed')} [descriptor.status='scheduled']
 * @param {string} [descriptor.state] - explicit ESPN state ('pre'|'in'|'post'); derived from status when omitted
 * @param {string} [descriptor.stage] - tournament stage tag (group|r32|r16|qf|sf|third|final)
 * @param {number} [descriptor.season=2026]
 * @param {number} [descriptor.period=null] - 1 = first half, 2 = second half, 3+ = extra time
 * @param {number} [descriptor.clock=null]
 * @param {string} [descriptor.displayClock=null]
 * @param {Object} [descriptor.odds=null] - 3-way moneyline descriptor { home, draw, away, provider, favorite }
 * @param {Object} [descriptor.probability=null] - { homeWinPct, awayWinPct, drawPct }
 * @param {('home'|'away'|null)} [descriptor.winner=null] - homeAway of the team ESPN flags as the
 *   result. Required for knockout advancement: stamps `competitors[].winner` (true on the advancing
 *   side, false on the other) so a level 90' scoreline still resolves a winner. Group regulation
 *   wins/draws omit it (the parser reads scores there); null leaves `winner` off the competitors.
 * @param {Object} [descriptor.shootout=null] - penalty-shootout tally { home, away } stamped onto
 *   `competitors[].shootoutScore`. Pairs with status 'finalPK' to model a PK-decided knockout.
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
  probability = null,
  winner = null,
  shootout = null,
  events = null,
  homeForm,
  awayForm,
  homeRecord,
  awayRecord,
}) {
  const statusConfig = {
    scheduled: { state: 'pre', name: 'STATUS_SCHEDULED', description: 'Scheduled', detail: date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }), completed: false },
    inProgress: { state: 'in', name: 'STATUS_IN_PROGRESS', description: 'In Progress', detail: displayClock || "1' 1st Half", completed: false },
    halftime: { state: 'in', name: 'STATUS_HALFTIME', description: 'Halftime', detail: 'Halftime', completed: false },
    final: { state: 'post', name: 'STATUS_FULL_TIME', description: 'Full Time', detail: 'FT', completed: true },
    // Regulation group-stage draw: completed, level scoreline. ESPN's status name
    // for a finished match is STATUS_FINAL (state 'post'); the parser keys off
    // state + completed, so the name is cosmetic, but we stamp it to read truthfully.
    draw: { state: 'post', name: 'STATUS_FINAL', description: 'Full-Time Draw', detail: 'FT', completed: true },
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

  const buildCompetitor = (team, homeAway, scoreValue, order) => {
    const form = homeAway === 'home' ? homeForm : awayForm;
    const record = homeAway === 'home' ? homeRecord : awayRecord;
    const competitor = {
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
    };
    // Stamp form string when provided (e.g. "WWWWD").
    if (form != null) {
      competitor.form = form;
    }
    // Stamp W-D-L record as a single-entry records array matching ESPN's shape.
    if (record != null) {
      competitor.records = [{ name: 'All Splits', type: 'total', summary: record, abbreviation: 'Total' }];
    }
    // ESPN flags the result team via competitors[].winner. Only stamped when a
    // winner is declared (knockouts), so group regulation matches keep their
    // existing shape and the parser there still reads the scoreline.
    if (winner === 'home' || winner === 'away') {
      competitor.winner = homeAway === winner;
    }
    // Penalty-shootout tally lives on the competitor alongside the level
    // regulation score, mirroring ESPN's PK-decided knockout payload.
    if (shootout) {
      competitor.shootoutScore = (homeAway === 'home' ? shootout.home : shootout.away).toString();
    }
    return competitor;
  };

  // ESPN exposes goals/cards under competition.details. Build that array from a
  // compact descriptor list — { type: 'goal'|'own-goal'|'yellow-card'|'red-card',
  // minute: "9'", player, side: 'home'|'away' } — mirroring the real payload's
  // boolean flags (scoringPlay/ownGoal/yellowCard/redCard), clock, team ref, and
  // athletesInvolved so Game.parseMatchEvents has realistic input to flatten.
  const DETAIL_TYPE = {
    goal: { id: '70', text: 'Goal' },
    'own-goal': { id: '97', text: 'Own Goal' },
    'yellow-card': { id: '94', text: 'Yellow Card' },
    'red-card': { id: '93', text: 'Red Card' }
  };
  const matchDetails = Array.isArray(events)
    ? events.map((e) => {
        const team = e.side === 'home' ? homeTeam : awayTeam;
        return {
          type: DETAIL_TYPE[e.type] || { id: '0', text: e.type },
          clock: { value: 0, displayValue: e.minute },
          team: { id: team.id },
          scoringPlay: e.type === 'goal' || e.type === 'own-goal',
          ownGoal: e.type === 'own-goal',
          penaltyKick: false,
          yellowCard: e.type === 'yellow-card',
          redCard: e.type === 'red-card',
          athletesInvolved: [{ displayName: e.player }]
        };
      })
    : [];

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
      details: matchDetails,
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
 * Group stage returns 3 ESPN-event-shaped matches built via
 * buildMockWorldCupEvent, mirroring the state variety of espnGameData.js's
 * generateMockWeek: one regulation draw (final), one final with a winner, and
 * one in-progress match. Every match carries a 3-way (home/draw/away) moneyline
 * on the competition. Other stages remain stubbed (return []) until built out.
 *
 * Kickoffs are derived as offsets from baseDate and clamped into the group-stage
 * window (Jun 11-27, 2026) of the Jun 11 - Jul 19 tournament so fixtures stay
 * calendar-valid regardless of the caller's anchor.
 *
 * @param {Object} config
 * @param {string} config.stage - tournament stage (group|r32|r16|qf|sf|third|final)
 * @param {Date} [config.baseDate] - anchor date for kickoff offsets
 * @param {number} [config.year=2026]
 * @returns {Array<Object>} ESPN scoreboard events for the stage
 */
export function generateMockWorldCupStage({ stage, baseDate, year = 2026 } = {}) {
  if (stage === 'knockout') {
    return generateKnockoutSlate({ baseDate, year });
  }
  if (stage !== 'group') {
    // Individual knockout-stage codes (r32/r16/qf/...) are not generated piecemeal;
    // the whole knockout slate is produced via stage:'knockout'. Keep importable.
    return [];
  }

  // Anchor kickoffs inside the group-stage window (Jun 11-27). When the caller's
  // baseDate falls outside that window we fall back to mid-group-stage so offsets
  // never escape the Jun 11 - Jul 19 tournament bounds.
  const GROUP_OPEN = new Date(Date.UTC(year, 5, 11, 16, 0, 0)); // Jun 11
  const GROUP_CLOSE = new Date(Date.UTC(year, 5, 27, 22, 0, 0)); // Jun 27
  const requested = baseDate instanceof Date ? baseDate : new Date(Date.UTC(year, 5, 17, 18, 0, 0));
  const anchor = (requested >= GROUP_OPEN && requested <= GROUP_CLOSE)
    ? requested
    : new Date(Date.UTC(year, 5, 17, 18, 0, 0)); // Jun 17, mid-group-stage

  const DAY = 24 * 60 * 60 * 1000;
  const clampToWindow = (d) => new Date(Math.min(Math.max(d.getTime(), GROUP_OPEN.getTime()), GROUP_CLOSE.getTime()));

  // Match 1: Regulation DRAW (final). MEX 1-1 USA — host-nation opener vibe.
  const drawDate = clampToWindow(new Date(anchor.getTime() - 4 * DAY));
  const drawMatch = buildMockWorldCupEvent({
    id: '760601',
    date: drawDate,
    homeTeam: WORLD_CUP_2026_TEAMS.MEX,
    awayTeam: WORLD_CUP_2026_TEAMS.USA,
    homeScore: 1,
    awayScore: 1,
    status: 'draw',
    stage: 'group',
    season: year,
    period: 2,
    odds: { provider: 'DraftKings', details: 'MEX -150', home: '-150', draw: '+260', away: '+420', favorite: 'home' }
  });

  // Match 2: Final with a winner. BRA 2-0 CAN — home team wins.
  const winDate = clampToWindow(new Date(anchor.getTime() - 2 * 60 * 60 * 1000));
  const winnerMatch = buildMockWorldCupEvent({
    id: '760602',
    date: winDate,
    homeTeam: WORLD_CUP_2026_TEAMS.BRA,
    awayTeam: WORLD_CUP_2026_TEAMS.CAN,
    homeScore: 2,
    awayScore: 0,
    status: 'final',
    stage: 'group',
    season: year,
    period: 2,
    odds: { provider: 'DraftKings', details: 'BRA -400', home: '-400', draw: '+480', away: '+900', favorite: 'home' }
  });

  // Match 3: In progress (2nd half). ARG 1-0 FRA — live state variety.
  const liveDate = clampToWindow(new Date(anchor.getTime() + 2 * DAY));
  const liveMatch = buildMockWorldCupEvent({
    id: '760603',
    date: liveDate,
    homeTeam: WORLD_CUP_2026_TEAMS.ARG,
    awayTeam: WORLD_CUP_2026_TEAMS.FRA,
    homeScore: 1,
    awayScore: 0,
    status: 'inProgress',
    stage: 'group',
    season: year,
    period: 2,
    clock: 1500,
    displayClock: "63'",
    odds: { provider: 'DraftKings', details: 'ARG +120', home: '+120', draw: '+230', away: '+210', favorite: 'home' },
    probability: { homeWinPct: 58.0, awayWinPct: 24.0, drawPct: 18.0 }
  });

  return [drawMatch, winnerMatch, liveMatch];
}

/**
 * Build the knockout slate: 3 resolved ESPN-event-shaped matches, identical in
 * competition/competitor/status structure to the group stage so the file is a
 * drop-in across both. Each match declares an advancing team via
 * `competitors[].winner` (the knockout truth source — a level 90' scoreline
 * still resolves a result), and each competition is tagged with its real
 * knockout `stage` code (r16/qf/final).
 *
 * Resolutions, per the task:
 *  - One PENALTY SHOOTOUT: 90' level (1-1), away side advances on penalties.
 *    status 'finalPK' (description "Full Time (Penalties)") + competitor
 *    shootoutScore, so downstream scoring treats the advancer as the winner
 *    even though the regulation score is level.
 *  - Two regulation wins: the higher-scoring side advances and is winner:true.
 *
 * Knockouts carry no 3-way moneyline — a 'draw' pick scores 0 here, so the draw
 * price is meaningless. Kickoffs land in the post-group knockout window
 * (Jun 28 - Jul 19, 2026), clamped so they never escape the tournament bounds.
 *
 * @param {Object} config
 * @param {Date} [config.baseDate] - anchor date for kickoff offsets
 * @param {number} [config.year=2026]
 * @returns {Array<Object>} three ESPN scoreboard events
 */
function generateKnockoutSlate({ baseDate, year = 2026 }) {
  // Knockout window opens the day after the group stage closes (Jun 27) and runs
  // through the final (Jul 19). Anchor inside it; fall back to mid-bracket when
  // the caller's baseDate is out of range, so offsets never leave the window.
  const KO_OPEN = new Date(Date.UTC(year, 5, 28, 16, 0, 0)); // Jun 28
  const KO_CLOSE = new Date(Date.UTC(year, 6, 19, 19, 0, 0)); // Jul 19 (final)
  const requested = baseDate instanceof Date ? baseDate : new Date(Date.UTC(year, 6, 9, 18, 0, 0));
  const anchor = (requested >= KO_OPEN && requested <= KO_CLOSE)
    ? requested
    : new Date(Date.UTC(year, 6, 9, 18, 0, 0)); // Jul 9, mid-bracket

  const DAY = 24 * 60 * 60 * 1000;
  const clampToWindow = (d) => new Date(Math.min(Math.max(d.getTime(), KO_OPEN.getTime()), KO_CLOSE.getTime()));

  // Match 1: Round of 16, regulation win. ENG 2-0 GER — home advances outright.
  const r16Date = clampToWindow(new Date(anchor.getTime() - 4 * DAY));
  const r16Match = buildMockWorldCupEvent({
    id: '760611',
    date: r16Date,
    homeTeam: WORLD_CUP_2026_TEAMS.ENG,
    awayTeam: WORLD_CUP_2026_TEAMS.GER,
    homeScore: 2,
    awayScore: 0,
    status: 'final',
    stage: 'r16',
    season: year,
    period: 2,
    winner: 'home'
  });

  // Match 2: Quarter-final decided by PENALTY SHOOTOUT. MEX 1-1 USA at 90' (level);
  // USA (away) advances on penalties 4-3. The level regulation scoreline gives
  // neither side a goal edge, so the result is resolvable only via winner:true +
  // the shootout score — exactly the case knockout scoring must handle.
  const pkDate = clampToWindow(new Date(anchor.getTime()));
  const pkMatch = buildMockWorldCupEvent({
    id: '760612',
    date: pkDate,
    homeTeam: WORLD_CUP_2026_TEAMS.MEX,
    awayTeam: WORLD_CUP_2026_TEAMS.USA,
    homeScore: 1,
    awayScore: 1,
    status: 'finalPK',
    stage: 'qf',
    season: year,
    period: 2,
    winner: 'away',
    shootout: { home: 3, away: 4 }
  });

  // Match 3: Final, regulation win. BRA 3-1 ARG — home lifts the trophy.
  const finalDate = clampToWindow(new Date(anchor.getTime() + 6 * DAY));
  const finalMatch = buildMockWorldCupEvent({
    id: '760613',
    date: finalDate,
    homeTeam: WORLD_CUP_2026_TEAMS.BRA,
    awayTeam: WORLD_CUP_2026_TEAMS.ARG,
    homeScore: 3,
    awayScore: 1,
    status: 'final',
    stage: 'final',
    season: year,
    period: 2,
    winner: 'home'
  });

  return [r16Match, pkMatch, finalMatch];
}
