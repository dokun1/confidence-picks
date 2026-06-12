import { describe, it, expect } from 'vitest';
import {
  applyFilters, applyView, buildSections, groupByDate, isLocked, matchesSearch,
  needsPick, NO_FILTERS, outcomeOf, pickVerdict, resultShade, sortGames,
  type BrowseGame, type BrowseTeam,
} from './wcGamesView';

const NOW = new Date('2026-06-12T16:00:00');

const team = (abbr: string, name: string): BrowseTeam => ({ abbr, name, logo: '' });

function game(over: Partial<BrowseGame> = {}): BrowseGame {
  return {
    id: 1, espnId: 'e1', stage: 'group', stageLabel: 'Group Stage',
    kickoff: '2026-06-12T20:00:00', // after NOW → not locked
    home: team('USA', 'United States'), away: team('PAR', 'Paraguay'),
    status: 'SCHEDULED', isKnockout: false,
    ...over,
  };
}

describe('isLocked / needsPick', () => {
  it('a scheduled match before kickoff is unlocked and needs a pick', () => {
    const g = game();
    expect(isLocked(g, NOW)).toBe(false);
    expect(needsPick(g, NOW)).toBe(true);
  });
  it('locks once kickoff passes even if still SCHEDULED', () => {
    expect(isLocked(game({ kickoff: '2026-06-12T15:00:00' }), NOW)).toBe(true);
  });
  it('a non-scheduled status is always locked', () => {
    expect(isLocked(game({ status: 'IN_PROGRESS' }), NOW)).toBe(true);
    expect(isLocked(game({ status: 'FINAL' }), NOW)).toBe(true);
  });
  it('a picked-but-open game no longer needs a pick', () => {
    expect(needsPick(game({ picked: 'home' }), NOW)).toBe(false);
  });
});

describe('applyView', () => {
  const games = [
    game({ id: 1, kickoff: '2026-06-12T20:00:00' }), // today, unpicked, open → needs-pick
    game({ id: 2, status: 'IN_PROGRESS', kickoff: '2026-06-12T14:00:00' }), // live + today
    game({ id: 3, status: 'FINAL', kickoff: '2026-06-11T14:00:00', picked: 'home', homeScore: 2, awayScore: 0 }), // correct
    game({ id: 4, status: 'FINAL', kickoff: '2026-06-11T14:00:00', picked: 'home', homeScore: 1, awayScore: 1 }), // incorrect (drew)
    game({ id: 5, status: 'FINAL', kickoff: '2026-06-11T14:00:00', homeScore: 0, awayScore: 1 }), // no pick → neither
  ];

  it('needs-pick = open + unpicked only', () => {
    expect(applyView(games, 'needs-pick', NOW).map((g) => g.id)).toEqual([1]);
  });
  it('today = kickoff on NOW’s date', () => {
    expect(applyView(games, 'today', NOW).map((g) => g.id).sort()).toEqual([1, 2]);
  });
  it('live = in progress', () => {
    expect(applyView(games, 'live', NOW).map((g) => g.id)).toEqual([2]);
  });
  it('correct / incorrect partition the decided picks; no-pick is in neither', () => {
    expect(applyView(games, 'correct', NOW).map((g) => g.id)).toEqual([3]);
    expect(applyView(games, 'incorrect', NOW).map((g) => g.id)).toEqual([4]);
  });
  it('all = everything', () => {
    expect(applyView(games, 'all', NOW)).toHaveLength(5);
  });
});

describe('applyFilters (AND-combined)', () => {
  const games = [
    game({ id: 1, stage: 'group', status: 'SCHEDULED' }),
    game({ id: 2, stage: 'r16', status: 'FINAL', picked: 'home' }),
    game({ id: 3, stage: 'group', status: 'FINAL' }),
  ];
  it('filters by stage', () => {
    expect(applyFilters(games, { ...NO_FILTERS, stage: 'group' }).map((g) => g.id)).toEqual([1, 3]);
  });
  it('filters by status and pick-state together', () => {
    expect(applyFilters(games, { ...NO_FILTERS, status: 'FINAL', picked: true }).map((g) => g.id)).toEqual([2]);
    expect(applyFilters(games, { ...NO_FILTERS, picked: false }).map((g) => g.id)).toEqual([1, 3]);
  });
});

describe('matchesSearch', () => {
  const g = game({ home: team('MEX', 'México'), away: team('RSA', 'South Africa') });
  it('matches code and name, case- and diacritic-insensitive', () => {
    expect(matchesSearch(g, 'mex')).toBe(true);
    expect(matchesSearch(g, 'mexico')).toBe(true); // query w/o accent matches "México"
    expect(matchesSearch(g, 'south')).toBe(true);
    expect(matchesSearch(g, 'brazil')).toBe(false);
  });
  it('empty query matches everything', () => {
    expect(matchesSearch(g, '')).toBe(true);
  });
});

describe('sortGames', () => {
  const a = game({ id: 1, stage: 'r16', kickoff: '2026-06-12T20:00:00' });
  const b = game({ id: 2, stage: 'group', kickoff: '2026-06-12T22:00:00' });
  const c = game({ id: 3, stage: 'group', kickoff: '2026-06-12T18:00:00' });
  it('kickoff order by default', () => {
    expect(sortGames([a, b, c], 'kickoff').map((g) => g.id)).toEqual([3, 1, 2]);
  });
  it('stage order then kickoff', () => {
    expect(sortGames([a, b, c], 'stage').map((g) => g.id)).toEqual([3, 2, 1]);
  });
  it('does not mutate the input', () => {
    const input = [a, b, c];
    sortGames(input, 'kickoff');
    expect(input.map((g) => g.id)).toEqual([1, 2, 3]);
  });
});

describe('groupByDate', () => {
  it('labels today/tomorrow and carries a shared stage on the divider', () => {
    const games = sortGames([
      game({ id: 1, kickoff: '2026-06-12T17:00:00' }),
      game({ id: 2, kickoff: '2026-06-13T14:00:00' }),
    ], 'kickoff');
    const groups = groupByDate(games, NOW);
    expect(groups.map((g) => g.label)).toEqual(['Today · Fri Jun 12', 'Tomorrow · Sat Jun 13']);
    expect(groups[0].stageLabel).toBe('Group Stage');
  });
  it('blanks the divider stage when a day mixes stages', () => {
    const games = [
      game({ id: 1, kickoff: '2026-06-12T17:00:00', stage: 'group', stageLabel: 'Group Stage' }),
      game({ id: 2, kickoff: '2026-06-12T20:00:00', stage: 'r16', stageLabel: 'Round of 16' }),
    ];
    expect(groupByDate(games, NOW)[0].stageLabel).toBe('');
  });
});

describe('outcomeOf / resultShade / pickVerdict', () => {
  const final = (hs: number, as: number, picked?: BrowseGame['picked']) =>
    game({ status: 'FINAL', homeScore: hs, awayScore: as, picked });

  it('reads the outcome from the scoreline', () => {
    expect(outcomeOf(final(2, 0))).toBe('home');
    expect(outcomeOf(final(0, 1))).toBe('away');
    expect(outcomeOf(final(1, 1))).toBe('draw');
    expect(outcomeOf(game())).toBeNull(); // no score
  });

  it('shades by points: win / draw / partial / loss / no-pick', () => {
    expect(resultShade('home', 'home')).toBe('win');
    expect(resultShade('draw', 'draw')).toBe('draw');
    expect(resultShade('home', 'draw')).toBe('partial'); // team that drew
    expect(resultShade('draw', 'home')).toBe('partial'); // draw pick, a team won
    expect(resultShade('home', 'away')).toBe('loss');
    expect(resultShade(undefined, 'home')).toBe('loss'); // no pick
    expect(resultShade('home', null)).toBeNull(); // not scored
  });

  it('verdicts only decided, picked, final games', () => {
    expect(pickVerdict(final(2, 0, 'home'))).toBe('correct');
    expect(pickVerdict(final(1, 1, 'draw'))).toBe('correct');
    expect(pickVerdict(final(1, 1, 'home'))).toBe('incorrect'); // picked team, drew
    expect(pickVerdict(final(0, 1, 'home'))).toBe('incorrect');
    expect(pickVerdict(final(2, 0))).toBeNull(); // no pick
    expect(pickVerdict(game({ picked: 'home' }))).toBeNull(); // not final
  });
});

describe('buildSections (pipeline)', () => {
  it('applies view → filter → search → sort → grouping', () => {
    const games = [
      game({ id: 1, kickoff: '2026-06-12T20:00:00', home: team('USA', 'United States') }),
      game({ id: 2, kickoff: '2026-06-12T18:00:00', home: team('BRA', 'Brazil'), picked: 'home' }),
      game({ id: 3, status: 'FINAL', kickoff: '2026-06-11T18:00:00', picked: 'home', homeScore: 2, awayScore: 0 }),
    ];
    const sections = buildSections(games, {
      view: 'needs-pick', filters: NO_FILTERS, query: '', sort: 'kickoff', now: NOW,
    });
    // Only game 1 needs a pick; one date group containing it.
    expect(sections).toHaveLength(1);
    expect(sections[0].games.map((g) => g.id)).toEqual([1]);
  });
});
