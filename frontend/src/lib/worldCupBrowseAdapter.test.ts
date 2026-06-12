import { describe, it, expect } from 'vitest';
import { toBrowseGames } from './worldCupBrowseAdapter';
import type { WorldCupMatch } from './types';

const match = (over: Partial<WorldCupMatch> = {}): WorldCupMatch => ({
  id: 1, stage: 'group', homeTeam: { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: 'mex.png' },
  awayTeam: { id: '2', name: 'South Africa', abbreviation: 'RSA', logo: 'rsa.png' },
  homeScore: 0, awayScore: 0, status: 'SCHEDULED', isKnockout: false,
  gameDate: '2026-06-12T17:00:00Z', ...over,
});

describe('toBrowseGames', () => {
  it('maps fields, labels the stage, and carries the draft pick', () => {
    const [g] = toBrowseGames([match({ id: 7, homeScore: 2, awayScore: 0, status: 'FINAL' })], { 7: 'home' });
    expect(g).toMatchObject({
      id: 7, espnId: '7', stage: 'group', stageLabel: 'Group Stage',
      kickoff: '2026-06-12T17:00:00Z', status: 'FINAL', homeScore: 2, awayScore: 0, picked: 'home',
    });
    expect(g.home).toMatchObject({ abbr: 'MEX', name: 'Mexico', logo: 'mex.png' });
    expect(g.home.record).toBeUndefined();
  });
  it('omits a pick when the draft has none', () => {
    expect(toBrowseGames([match({ id: 9 })], {})[0].picked).toBeUndefined();
  });
});
