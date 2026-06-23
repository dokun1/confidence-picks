import { describe, it, expect } from 'vitest';
import { countNeedsPick } from './wcNeedsPick';
import type { MatchPick, WorldCupMatch } from './types';

// NOW sits after the group-stage opener but before the others below, so the
// open/locked window is exercised, not just the pick state.
const NOW = new Date('2026-06-12T18:00:00Z');

const match = (over: Partial<WorldCupMatch> = {}): WorldCupMatch => ({
  id: 1,
  stage: 'group',
  homeTeam: { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: 'mex.png' },
  awayTeam: { id: '2', name: 'South Africa', abbreviation: 'RSA', logo: 'rsa.png' },
  homeScore: 0,
  awayScore: 0,
  status: 'SCHEDULED',
  isKnockout: false,
  gameDate: '2026-06-20T17:00:00Z', // future → open
  ...over,
});

const pick = (gameId: number, pickedResult: MatchPick['pickedResult'] = 'home'): MatchPick => ({
  gameId,
  pickedResult,
});

describe('countNeedsPick', () => {
  it('counts open, unpicked, decided matches', () => {
    const matches = [match({ id: 1 }), match({ id: 2 }), match({ id: 3 })];
    expect(countNeedsPick(matches, [], NOW)).toBe(3);
  });

  it('excludes matches the viewer has already picked', () => {
    const matches = [match({ id: 1 }), match({ id: 2 })];
    expect(countNeedsPick(matches, [pick(1)], NOW)).toBe(1);
  });

  it('excludes matches that have already kicked off (locked)', () => {
    const matches = [
      match({ id: 1, gameDate: '2026-06-10T17:00:00Z' }), // past kickoff → locked
      match({ id: 2, gameDate: '2026-06-20T17:00:00Z' }), // future → open
    ];
    expect(countNeedsPick(matches, [], NOW)).toBe(1);
  });

  it('excludes in-progress / final matches', () => {
    const matches = [
      match({ id: 1, status: 'IN_PROGRESS' }),
      match({ id: 2, status: 'FINAL' }),
      match({ id: 3 }),
    ];
    expect(countNeedsPick(matches, [], NOW)).toBe(1);
  });

  it('excludes undecided knockout placeholders even when open + unpicked', () => {
    const matches = [
      match({
        id: 1,
        stage: 'r16',
        homeTeam: { id: '2A', name: 'Group A 2nd Place', abbreviation: '2A', logo: '' },
      }),
      match({ id: 2 }),
    ];
    expect(countNeedsPick(matches, [], NOW)).toBe(1);
  });

  it('handles an undefined picks payload', () => {
    expect(countNeedsPick([match({ id: 1 })], undefined, NOW)).toBe(1);
  });

  it('returns 0 for an empty slate', () => {
    expect(countNeedsPick([], [], NOW)).toBe(0);
  });
});
