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
  it('sets savedPicked from the savedDraft baseline (only when supplied)', () => {
    // No savedDraft → undefined, so needsPick falls back to `picked` (banner/dot path).
    expect(toBrowseGames([match({ id: 9 })], {})[0].savedPicked).toBeUndefined();
    // savedDraft supplied → true only for games with a saved pick.
    const [saved] = toBrowseGames([match({ id: 9 })], { 9: 'home' }, undefined, { 9: 'home' });
    expect(saved.savedPicked).toBe(true);
    // Drafted but not in the saved baseline → false (still "needs pick" until submit).
    const [drafted] = toBrowseGames([match({ id: 9 })], { 9: 'home' }, undefined, {});
    expect(drafted.savedPicked).toBe(false);
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

  describe('winner (knockout advancing side from winnerTeamId)', () => {
    // home id '1', away id '2' from the factory.
    it('maps winnerTeamId to the home/away side', () => {
      expect(toBrowseGames([match({ stage: 'r32', winnerTeamId: '1' })], {})[0].winner).toBe('home');
      expect(toBrowseGames([match({ stage: 'r32', winnerTeamId: '2' })], {})[0].winner).toBe('away');
    });
    it('is absent when there is no resolved winner', () => {
      expect(toBrowseGames([match({ stage: 'r32', winnerTeamId: null })], {})[0].winner).toBeUndefined();
      expect(toBrowseGames([match({ stage: 'r32' })], {})[0].winner).toBeUndefined();
    });
    it('is absent when winnerTeamId matches neither side (falls back to scoreline)', () => {
      expect(toBrowseGames([match({ stage: 'r32', winnerTeamId: '999' })], {})[0].winner).toBeUndefined();
    });
    it('survives a numeric-vs-string id mismatch', () => {
      const m = match({ stage: 'r32', winnerTeamId: 2 as unknown as string });
      expect(toBrowseGames([m], {})[0].winner).toBe('away');
    });
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

  it('carries team form and the match events timeline through', () => {
    const events: WorldCupMatch['events'] = [
      { type: 'goal', minute: "9'", player: 'J. Quiñones', side: 'home', teamAbbr: 'MEX' },
    ];
    const m = match({
      id: 55,
      homeTeam: { id: '1', name: 'Mexico', abbreviation: 'MEX', logo: 'mex.png', form: 'WWDWL' },
      awayTeam: { id: '2', name: 'South Africa', abbreviation: 'RSA', logo: 'rsa.png', form: 'LDWWD' },
      events,
    });
    const [g] = toBrowseGames([m], {});
    expect(g.home.form).toBe('WWDWL');
    expect(g.away.form).toBe('LDWWD');
    expect(g.events).toEqual(events);
  });

  it('leaves form and events undefined when the match omits them', () => {
    const [g] = toBrowseGames([match({ id: 56 })], {});
    expect(g.home.form).toBeUndefined();
    expect(g.away.form).toBeUndefined();
    expect(g.events).toBeUndefined();
  });

  it('carries live progress (displayClock / statusDetail / period) through', () => {
    const m = match({ id: 57, status: 'IN_PROGRESS', displayClock: "63'", statusDetail: '2nd Half', period: 2 });
    const [g] = toBrowseGames([m], {});
    expect(g.displayClock).toBe("63'");
    expect(g.statusDetail).toBe('2nd Half');
    expect(g.period).toBe(2);
  });

  it('collapses an empty-string displayClock/statusDetail to undefined', () => {
    const m = match({ id: 58, displayClock: '', statusDetail: '' });
    const [g] = toBrowseGames([m], {});
    expect(g.displayClock).toBeUndefined();
    expect(g.statusDetail).toBeUndefined();
  });

  it('populates wcGroup from the home team abbreviation for group-stage games', () => {
    // USA is in Group D
    const m = match({ stage: 'group', homeTeam: { id: '660', name: 'United States', abbreviation: 'USA', logo: '' } });
    const [g] = toBrowseGames([m], {});
    expect(g.wcGroup).toBe('D');
  });

  it('falls back to the away team abbreviation when home is unknown', () => {
    // PAR (Paraguay) is also in Group D
    const m = match({
      stage: 'group',
      homeTeam: { id: '0', name: 'Unknown', abbreviation: 'UNK', logo: '' },
      awayTeam: { id: '1', name: 'Paraguay', abbreviation: 'PAR', logo: '' },
    });
    const [g] = toBrowseGames([m], {});
    expect(g.wcGroup).toBe('D');
  });

  it('leaves wcGroup undefined for knockout matches', () => {
    const m = match({ stage: 'r16', homeTeam: { id: '660', name: 'United States', abbreviation: 'USA', logo: '' } });
    const [g] = toBrowseGames([m], {});
    expect(g.wcGroup).toBeUndefined();
  });

  it('leaves wcGroup undefined when neither team abbreviation is in the lookup', () => {
    const m = match({
      stage: 'group',
      homeTeam: { id: '0', name: 'Unknown A', abbreviation: 'UNK', logo: '' },
      awayTeam: { id: '1', name: 'Unknown B', abbreviation: 'XYZ', logo: '' },
    });
    const [g] = toBrowseGames([m], {});
    expect(g.wcGroup).toBeUndefined();
  });
});
