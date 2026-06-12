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
  it('maps the stageLabel for a knockout stage', () => {
    expect(toBrowseGames([match({ stage: 'r16' })], {})[0].stageLabel).toBe('Round of 16');
  });
  it('derives isKnockout from the stage — every non-group stage is knockout', () => {
    expect(toBrowseGames([match({ stage: 'group' })], {})[0].isKnockout).toBe(false);
    for (const stage of ['r32', 'r16', 'qf', 'sf', 'third', 'final'] as const) {
      expect(toBrowseGames([match({ stage })], {})[0].isKnockout).toBe(true);
    }
  });
  it('ignores the unreliable m.isKnockout flag (the stage route never emits it)', () => {
    // A knockout match whose isKnockout arrives false/undefined must still be
    // flagged knockout from its stage — this is the prod bug that re-enabled Draw.
    expect(toBrowseGames([match({ stage: 'r16', isKnockout: false })], {})[0].isKnockout).toBe(true);
    expect(toBrowseGames([match({ stage: 'group', isKnockout: true })], {})[0].isKnockout).toBe(false);
  });
  it('normalizes an unknown status to SCHEDULED', () => {
    expect(toBrowseGames([match({ status: 'POSTPONED' as WorldCupMatch['status'] })], {})[0].status).toBe('SCHEDULED');
  });

  it('maps odds.threeWay + team record + real espnId onto BrowseGame', () => {
    const m = match({
      id: 42,
      espnId: 'espn-101',
      homeTeam: { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: 'mex.png', record: '2-1-0' },
      awayTeam: { id: '2', name: 'South Africa', abbreviation: 'RSA', logo: 'rsa.png', record: '1-1-1' },
      odds: {
        threeWay: { home: '-150', draw: '+260', away: '+420' },
        overUnder: 2.5,
      },
    });
    const [g] = toBrowseGames([m], {});
    expect(g.espnId).toBe('espn-101');
    expect(g.home.record).toBe('2-1-0');
    expect(g.home.moneyline).toBe('-150');
    expect(g.away.record).toBe('1-1-1');
    expect(g.away.moneyline).toBe('+420');
    expect(g.drawOdds).toBe('+260');
    expect(g.overUnder).toBe('2.5');
  });

  it('leaves moneyline/drawOdds/overUnder undefined and falls back espnId when no odds', () => {
    const [g] = toBrowseGames([match({ id: 99 })], {});
    expect(g.espnId).toBe('99');
    expect(g.home.moneyline).toBeUndefined();
    expect(g.away.moneyline).toBeUndefined();
    expect(g.drawOdds).toBeUndefined();
    expect(g.overUnder).toBeUndefined();
  });
});
