/**
 * SoccerSummaryService — a pure parser for ESPN's per-event `/summary` payload.
 *
 * Isolated from the stage/list/picks flow on purpose: it does NO fetching, NO
 * persistence, and touches NO database. It takes a raw ESPN summary object and
 * returns the curated `{ venue, stats, lineups }` shape the World Cup detail
 * panel renders. The calling route fetches live and guarantees the never-500
 * contract; this parser only has to be defensive — never throw on a missing key.
 *
 * Scope (v1): venue + match stats + lineups. Head-to-head and standings are
 * deliberately deferred. The frontend renders only the sections present.
 */

// Curated, ordered stat set. Each entry: [ESPN statistic `name`, display label].
// Looked up by `name` in each team's boxscore `.statistics[]`; missing → ''.
const STAT_SPEC = [
  ['possessionPct', 'Possession'],
  ['totalShots', 'Shots'],
  ['shotsOnTarget', 'Shots on target'],
  ['wonCorners', 'Corners'],
  ['foulsCommitted', 'Fouls'],
  ['yellowCards', 'Yellow cards'],
  ['redCards', 'Red cards'],
];

export class SoccerSummaryService {
  /**
   * Parse a raw ESPN `/summary` object into the detail-panel shape.
   * Always returns a valid object; never throws.
   *
   * @param {Object} summary - raw ESPN summary JSON (may be sparse/empty)
   * @returns {{ venue: (string|null), stats: Array, lineups: (Object|null) }}
   */
  static parseSummary(summary) {
    const safe = summary && typeof summary === 'object' ? summary : {};

    // Identify home/away once; every other section maps off this.
    const competitors = safe?.header?.competitions?.[0]?.competitors || [];
    const home = competitors.find((c) => c && c.homeAway === 'home') || null;
    const away = competitors.find((c) => c && c.homeAway === 'away') || null;
    const homeId = home?.team?.id ?? null;
    const awayId = away?.team?.id ?? null;

    return {
      venue: this._parseVenue(safe),
      stats: this._parseStats(safe, homeId, awayId),
      lineups: this._parseLineups(safe, home, away),
    };
  }

  /** "<fullName> · <address.city>" from gameInfo.venue, or null if absent. */
  static _parseVenue(summary) {
    const v = summary?.gameInfo?.venue;
    if (!v || !v.fullName) return null;
    const city = v?.address?.city;
    return city ? `${v.fullName} · ${city}` : v.fullName;
  }

  /**
   * Ordered [{ label, home, away }] for the curated STAT_SPEC. Maps each team's
   * boxscore entry to home/away by team.id. Returns [] if boxscore/teams absent.
   */
  static _parseStats(summary, homeId, awayId) {
    const teams = summary?.boxscore?.teams;
    if (!Array.isArray(teams) || teams.length === 0) return [];

    const byId = (id) => teams.find((t) => t && t?.team?.id === id) || null;
    const homeTeam = byId(homeId);
    const awayTeam = byId(awayId);

    const lookup = (team, name) => {
      const list = team?.statistics;
      if (!Array.isArray(list)) return '';
      const found = list.find((s) => s && s.name === name);
      return found && found.displayValue != null ? found.displayValue : '';
    };

    return STAT_SPEC.map(([name, label]) => ({
      label,
      home: lookup(homeTeam, name),
      away: lookup(awayTeam, name),
    }));
  }

  /**
   * { home: TeamLineup, away: TeamLineup } from summary.rosters[], or null if
   * rosters absent/empty. keyEvents marks are attached best-effort by name.
   */
  static _parseLineups(summary, home, away) {
    const rosters = summary?.rosters;
    if (!Array.isArray(rosters) || rosters.length === 0) return null;

    const marksByName = this._buildMarks(summary?.keyEvents);

    const homeRoster = rosters.find((r) => r && r.homeAway === 'home') || null;
    const awayRoster = rosters.find((r) => r && r.homeAway === 'away') || null;

    return {
      home: this._teamLineup(homeRoster, home, marksByName),
      away: this._teamLineup(awayRoster, away, marksByName),
    };
  }

  /**
   * Build a TeamLineup from a roster + its matching competitor. Returns a valid
   * (possibly empty) lineup even when the roster is missing, so the panel can
   * still render the team header.
   */
  static _teamLineup(roster, competitor, marksByName) {
    const abbr = competitor?.team?.abbreviation ?? '';
    const name = competitor?.team?.displayName ?? '';
    const formation = roster?.formation ?? '';
    const entries = Array.isArray(roster?.roster) ? roster.roster : [];

    const starters = entries
      .filter((e) => e && e.starter === true)
      .map((e) => ({
        num: e?.jersey ?? '',
        name: e?.athlete?.displayName ?? '',
        line: this._deriveLine(e?.position?.abbreviation),
        marks: marksByName.get(e?.athlete?.displayName) || [],
      }));

    const subs = entries
      .filter((e) => e && e.subbedIn === true)
      .map((e) => ({
        num: e?.jersey ?? '',
        name: e?.athlete?.displayName ?? '',
        marks: marksByName.get(e?.athlete?.displayName) || [],
      }));

    return { abbr, name, formation, starters, subs };
  }

  /**
   * Map an ESPN position abbreviation to a coarse line: GK/DEF/MID/FWD.
   * Unknown/absent → 'MID' (a safe centre default for the pitch layout).
   */
  static _deriveLine(abbr) {
    if (!abbr) return 'MID';
    const a = String(abbr).toUpperCase();
    if (a === 'G' || a === 'GK') return 'GK';
    if (a.startsWith('D') || a === 'LB' || a === 'RB' || a === 'CD') return 'DEF';
    if (a.startsWith('M') || a === 'CM' || a === 'DM' || a === 'AM' || a === 'LM' || a === 'RM') return 'MID';
    if (a === 'F' || a === 'CF' || a === 'ST' || a === 'LW' || a === 'RW') return 'FWD';
    return 'MID';
  }

  /**
   * Build a Map<displayName, mark[]> from summary.keyEvents. Each mark is
   * { kind, min }. Be defensive — keyEvents may be absent; never throw.
   *
   *   Goal (type.text contains 'Goal', not 'Own') → scorer participants[0]: {kind:'goal'}
   *   Own goal (type.text contains 'Own')         → participants[0]: {kind:'own-goal'}
   *   Yellow Card                                  → participants[0]: {kind:'yellow'}
   *   Red Card                                     → participants[0]: {kind:'red'}
   *   Substitution → participants[0] ON {kind:'on'}, participants[1] OFF {kind:'off'}
   */
  static _buildMarks(keyEvents) {
    const map = new Map();
    if (!Array.isArray(keyEvents)) return map;

    const add = (displayName, mark) => {
      if (!displayName) return;
      if (!map.has(displayName)) map.set(displayName, []);
      map.get(displayName).push(mark);
    };

    for (const ev of keyEvents) {
      if (!ev) continue;
      const text = ev?.type?.text || '';
      const min = ev?.clock?.displayValue ?? '';
      const parts = Array.isArray(ev.participants) ? ev.participants : [];
      const nameOf = (i) => parts[i]?.athlete?.displayName;

      if (text === 'Substitution') {
        add(nameOf(0), { kind: 'on', min });
        add(nameOf(1), { kind: 'off', min });
      } else if (/Own/i.test(text)) {
        add(nameOf(0), { kind: 'own-goal', min });
      } else if (/Goal/i.test(text)) {
        add(nameOf(0), { kind: 'goal', min });
      } else if (/Yellow Card/i.test(text)) {
        add(nameOf(0), { kind: 'yellow', min });
      } else if (/Red Card/i.test(text)) {
        add(nameOf(0), { kind: 'red', min });
      }
    }

    return map;
  }
}
