import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Game } from '../src/models/Game.js';

// ESPN models a postponement as state 'pre' + name STATUS_POSTPONED. The three-way
// status normalization flattens that into SCHEDULED, which is deliberate — picks stay
// open for the rescheduled date — but it erased the postponement entirely, so the UI
// showed "not started" beside a kickoff time that had already gone by.

function espnEvent({ statusName, detail, state = 'pre' }) {
  const status = {
    clock: 0,
    displayClock: '0:00',
    period: 0,
    type: { id: '1', name: statusName, state, completed: false, description: detail, detail },
  };
  return {
    id: '401999001',
    date: '2026-09-13T17:00:00Z',
    name: 'Cincinnati Bengals at Buffalo Bills',
    shortName: 'CIN @ BUF',
    season: { year: 2026, type: 2 },
    week: { number: 1 },
    status,
    competitions: [{
      id: '401999001',
      date: '2026-09-13T17:00:00Z',
      status,
      competitors: [
        { id: '2', homeAway: 'home', score: '0', team: { id: '2', displayName: 'Buffalo Bills', abbreviation: 'BUF' } },
        { id: '4', homeAway: 'away', score: '0', team: { id: '4', displayName: 'Cincinnati Bengals', abbreviation: 'CIN' } },
      ],
      odds: [],
      season: { year: 2026, type: 2 },
      week: { number: 1 },
    }],
  };
}

describe('Game postponed detection', () => {
  test('flags a postponed ESPN event while leaving status SCHEDULED', () => {
    const game = Game.fromESPNData(espnEvent({ statusName: 'STATUS_POSTPONED', detail: 'Postponed' }));

    assert.strictEqual(game.postponed, true);
    // status must stay SCHEDULED so the game remains pickable once rescheduled
    assert.strictEqual(game.status, 'SCHEDULED');
  });

  test('leaves an ordinary scheduled game unflagged', () => {
    const game = Game.fromESPNData(espnEvent({ statusName: 'STATUS_SCHEDULED', detail: '1:00 PM ET' }));

    assert.strictEqual(game.postponed, false);
    assert.strictEqual(game.status, 'SCHEDULED');
  });

  test('surfaces the flag through toJSON', () => {
    const game = Game.fromESPNData(espnEvent({ statusName: 'STATUS_POSTPONED', detail: 'Postponed' }));

    assert.strictEqual(game.toJSON().postponed, true);
  });

  test('recovers the flag from a DB row, where the raw ESPN name is gone', () => {
    // fromDbRow maps rawStatus from row.status, so STATUS_POSTPONED never survives the
    // round-trip — status_detail is the only carrier left.
    const game = Game.fromDbRow({
      id: 1,
      espn_id: '401999001',
      home_team: { id: '2', abbreviation: 'BUF' },
      away_team: { id: '4', abbreviation: 'CIN' },
      game_date: '2026-09-13T17:00:00Z',
      status: 'SCHEDULED',
      status_detail: 'Postponed',
      home_score: 0,
      away_score: 0,
      week: 1,
      season: 2026,
      season_type: 2,
    });

    assert.strictEqual(game.postponed, true);
    assert.strictEqual(game.status, 'SCHEDULED');
  });

  test('a normal scheduled row stays unflagged', () => {
    const game = Game.fromDbRow({
      id: 2,
      espn_id: '401999002',
      home_team: { id: '2', abbreviation: 'BUF' },
      away_team: { id: '4', abbreviation: 'CIN' },
      game_date: '2026-09-13T17:00:00Z',
      status: 'SCHEDULED',
      status_detail: '1:00 PM ET',
      home_score: 0,
      away_score: 0,
      week: 1,
      season: 2026,
      season_type: 2,
    });

    assert.strictEqual(game.postponed, false);
  });
});
