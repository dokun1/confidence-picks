export class ESPNService {
  static BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

  // Soccer (FIFA World Cup 2026) lives under a different sport root. Kept as the
  // soccer sport base so fetchSoccerWeek can build `${SOCCER_BASE_URL}/${leagueSlug}/scoreboard`
  // — the NFL BASE_URL above is untouched. See WORLD_CUP_2026_API.md.
  static SOCCER_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

  // Internal stage keys -> ESPN's `groups` scoreboard filter value
  // (WORLD_CUP_2026_API.md "Scoreboard by Group/Round"). A raw numeric value or
  // a stage key both resolve here; an unknown value passes through unchanged.
  static SOCCER_STAGE_GROUPS = {
    group: '1',
    r32: '2',
    r16: '3',
    qf: '4',
    sf: '5',
    third: '6',
    final: '7'
  };

  static async fetchGames(year, seasonType, week) {
    const url = `${this.BASE_URL}?dates=${year}&seasontype=${seasonType}&week=${week}`;

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error('Failed to fetch ESPN data:', error);
      throw error;
    }
  }

  /**
   * Fetch FIFA World Cup 2026 matches for a tournament stage.
   *
   * Mirrors fetchGames' contract: builds the scoreboard URL, throws on a non-OK
   * response, logs + rethrows on failure, and returns `data.events || []`.
   *
   * @param {string} leagueSlug - ESPN soccer league slug (e.g. 'fifa.world')
   * @param {(string|number|Object)} stage - tournament stage. A stage key
   *   ('group'|'r32'|'r16'|'qf'|'sf'|'third'|'final') or raw `groups` value maps
   *   to `?groups=<n>`. An object `{ stage|groups, dates }` allows an explicit
   *   `?dates=YYYYMMDD` date-keyed fetch alongside (or instead of) the group filter.
   * @returns {Promise<Array>} Array of ESPN scoreboard events
   */
  static async fetchSoccerWeek(leagueSlug, stage) {
    const url = this.buildSoccerScoreboardUrl(leagueSlug, stage);

    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`ESPN API error: ${response.status}`);
      }

      const data = await response.json();
      return data.events || [];
    } catch (error) {
      console.error('Failed to fetch ESPN soccer data:', error);
      throw error;
    }
  }

  /**
   * Construct the soccer scoreboard URL with the stage filter applied as query
   * params. `dates` (when present) is emitted before `groups` to match the
   * documented date-keyed form `?dates=YYYYMMDD&groups=<n>`.
   */
  static buildSoccerScoreboardUrl(leagueSlug, stage) {
    const base = `${this.SOCCER_BASE_URL}/${leagueSlug}/scoreboard`;

    let groups;
    let dates;
    if (stage && typeof stage === 'object') {
      dates = stage.dates;
      groups = stage.groups != null
        ? stage.groups
        : (stage.stage != null ? (this.SOCCER_STAGE_GROUPS[stage.stage] ?? stage.stage) : undefined);
    } else if (stage != null) {
      groups = this.SOCCER_STAGE_GROUPS[stage] ?? stage;
    }

    const params = new URLSearchParams();
    if (dates != null) params.set('dates', dates);
    if (groups != null) params.set('groups', groups);

    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  static async fetchGameById(gameId) {
    // ESPN doesn't have a direct game-by-id endpoint for scoreboard
    // You'd need to implement this based on their API structure
    // For now, we'll throw an error
    throw new Error('ESPN API does not support fetching individual games');
  }
}