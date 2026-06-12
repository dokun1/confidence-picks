export class ESPNService {
  static BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/football/nfl/scoreboard';

  // Soccer (FIFA World Cup 2026) lives under a different sport root. Kept as the
  // soccer sport base so fetchSoccerWeek can build `${SOCCER_BASE_URL}/${leagueSlug}/scoreboard`
  // — the NFL BASE_URL above is untouched. See WORLD_CUP_2026_API.md.
  static SOCCER_BASE_URL = 'https://site.api.espn.com/apis/site/v2/sports/soccer';

  // Internal stage keys -> ESPN's `groups` scoreboard filter value
  // (WORLD_CUP_2026_API.md "Scoreboard by Group/Round"). A raw numeric value or
  // a stage key both resolve here; an unknown value passes through unchanged.
  //
  // NOTE: empirically the `?groups=<n>` filter on the WC2026 league returns ≤2
  // events per stage (only today's matches in that group), not the whole bracket.
  // The real per-stage fetch uses SOCCER_STAGE_DATE_RANGES below; this map is
  // kept for backwards-compat with callers that still pass `?groups=`.
  static SOCCER_STAGE_GROUPS = {
    group: '1',
    r32: '2',
    r16: '3',
    qf: '4',
    sf: '5',
    third: '6',
    final: '7'
  };

  // Internal stage keys -> tournament-schedule date window for that stage,
  // formatted as ESPN's `?dates=YYYYMMDD-YYYYMMDD` range. Source: official
  // FIFA World Cup 2026 schedule. Group-stage matches fall June 11–27 2026;
  // knockout windows trail behind. ESPN tags each event with
  // `season.slug` ('group-stage', 'round-of-32', …) which the caller uses to
  // filter spillover events; the date range is a coarse pre-filter so we
  // don't pull all 104 tournament matches every time.
  static SOCCER_STAGE_DATE_RANGES = {
    group:  '20260611-20260627',
    r32:    '20260628-20260703',
    r16:    '20260704-20260707',
    qf:     '20260709-20260711',
    sf:     '20260714-20260715',
    third:  '20260718-20260718',
    final:  '20260719-20260719',
  };

  // Internal stage keys -> ESPN season.slug values used to filter spillover
  // matches within a date range (e.g. an early R32 listed under June 27).
  // Empirically verified against the live scoreboard 2026-06-05.
  static SOCCER_STAGE_SLUGS = {
    group:  'group-stage',
    r32:    'round-of-32',
    r16:    'round-of-16',
    qf:     'quarterfinals',
    sf:     'semifinals',
    third:  '3rd-place-match', // NOT 'third-place'
    final:  'final',
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
      const events = data.events || [];

      // For known stage keys, filter spillover by matching event.season.slug.
      // Without this, a date-range fetch (e.g. group: 20260611-20260627) could
      // return early matches from the next stage that happen to fall on June 27.
      // Unknown stages and free-form `{ dates }` objects fall through unfiltered.
      const stageKey = typeof stage === 'string' ? stage : (stage && stage.stage);
      const expectedSlug = stageKey && this.SOCCER_STAGE_SLUGS[stageKey];
      if (expectedSlug) {
        return events.filter((e) => {
          const slug = e && e.season && e.season.slug;
          // Be permissive: if ESPN omits the slug, keep the event — better to
          // show an extra match than to silently drop a real one.
          return !slug || slug === expectedSlug;
        });
      }
      return events;
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
      // Explicit `{ dates, groups, stage }` object — honor every field the
      // caller provides. Stage key still maps to `groups` for legacy callers.
      dates = stage.dates;
      groups = stage.groups != null
        ? stage.groups
        : (stage.stage != null ? (this.SOCCER_STAGE_GROUPS[stage.stage] ?? stage.stage) : undefined);
    } else if (stage != null) {
      // Bare stage key: prefer the date-range path (returns the full slate
      // for that stage), fall through to `groups` for unknown keys to keep
      // the legacy contract for the mock service's URL-equality tests.
      const dateRange = this.SOCCER_STAGE_DATE_RANGES[stage];
      if (dateRange) {
        dates = dateRange;
      } else {
        groups = this.SOCCER_STAGE_GROUPS[stage] ?? stage;
      }
    }

    const params = new URLSearchParams();
    if (dates != null) params.set('dates', dates);
    if (groups != null) params.set('groups', groups);
    // `?limit=200` covers the worst-case stage (group, ~72 events in the date
    // window) under the default 25-event cap. Only emit when we're actually
    // hitting the API by date so legacy `?groups=` URLs (used by tests) are
    // byte-identical to before.
    if (dates != null && groups == null) params.set('limit', '200');

    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
  }

  /**
   * Fetch ESPN's per-event `/summary` for a single FIFA World Cup 2026 match.
   *
   * Mirrors fetchSoccerWeek's fetch/throw contract: builds the summary URL,
   * throws on a non-OK response so the caller (the resilient /event route) can
   * catch and return a sparse body. The route — not this method — guarantees the
   * never-500 behaviour; this stays a thin throwing fetch like its siblings.
   *
   * @param {(string|number)} eventId - ESPN event id
   * @returns {Promise<Object>} Raw ESPN summary JSON
   */
  static async fetchSoccerSummary(eventId) {
    const url = `${this.SOCCER_BASE_URL}/fifa.world/summary?event=${encodeURIComponent(eventId)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`ESPN summary ${res.status} for event ${eventId}`);
    return res.json();
  }

  static async fetchGameById(gameId) {
    // ESPN doesn't have a direct game-by-id endpoint for scoreboard
    // You'd need to implement this based on their API structure
    // For now, we'll throw an error
    throw new Error('ESPN API does not support fetching individual games');
  }
}