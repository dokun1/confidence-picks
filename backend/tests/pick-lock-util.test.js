import { test, describe } from 'node:test';
import assert from 'node:assert';
import { isPickLocked, pickWindow } from '../src/utils/pickLock.js';

// Picks stay open until the scheduled kickoff instant, and not a millisecond
// longer. ESPN's status lags the real kickoff by minutes, so the scheduled time
// is the authority; a started status only ever locks earlier, never later.

const KICKOFF = new Date('2026-09-11T00:35:00.000Z');
const game = (over = {}) => ({ status: 'SCHEDULED', gameDate: KICKOFF, postponed: false, ...over });

describe('isPickLocked', () => {
  test('open one second before kickoff', () => {
    assert.strictEqual(isPickLocked(game(), KICKOFF.getTime() - 1000), false);
  });

  test('open one millisecond before kickoff', () => {
    assert.strictEqual(isPickLocked(game(), KICKOFF.getTime() - 1), false);
  });

  test('locked at the scheduled kickoff', () => {
    assert.strictEqual(isPickLocked(game(), KICKOFF.getTime()), true);
  });

  test('locked after kickoff while ESPN still reports SCHEDULED', () => {
    assert.strictEqual(isPickLocked(game(), KICKOFF.getTime() + 5 * 60 * 1000), true);
  });

  test('locked once ESPN reports the game started, whatever the clock says', () => {
    const before = KICKOFF.getTime() - 60 * 1000;
    assert.strictEqual(isPickLocked(game({ status: 'IN_PROGRESS' }), before), true);
    assert.strictEqual(isPickLocked(game({ status: 'FINAL' }), before), true);
  });

  test('accepts an ISO string kickoff as well as a Date', () => {
    const iso = game({ gameDate: KICKOFF.toISOString() });
    assert.strictEqual(isPickLocked(iso, KICKOFF.getTime() - 1), false);
    assert.strictEqual(isPickLocked(iso, KICKOFF.getTime()), true);
  });

  test('legacy pre-game status spellings count as not started', () => {
    for (const status of ['NOT_STARTED', 'PRE', 'PREGAME']) {
      assert.strictEqual(isPickLocked(game({ status }), KICKOFF.getTime() - 1000), false, status);
    }
  });

  test('a postponed game stays open past its original kickoff', () => {
    assert.strictEqual(isPickLocked(game({ postponed: true }), KICKOFF.getTime() + 60 * 60 * 1000), false);
  });

  test('falls back to status alone when the kickoff time is unknown', () => {
    const later = KICKOFF.getTime() + 60 * 60 * 1000;
    assert.strictEqual(isPickLocked(game({ gameDate: null }), later), false);
    assert.strictEqual(isPickLocked(game({ gameDate: 'not a date' }), later), false);
  });
});

// pickWindow is what clients are supposed to trust instead of ESPN `status` or
// their own clock. It must agree with isPickLocked exactly -- two answers to
// "can I still edit this?" that can disagree is the bug that caused the Week 1
// lockout, just relocated.
describe('pickWindow', () => {
  const kickoff = '2026-09-20T17:00:00.000Z';
  const T = Date.parse(kickoff);

  test('publishes the scheduled kickoff as the deadline', () => {
    const w = pickWindow({ status: 'SCHEDULED', gameDate: kickoff }, T - 60_000);
    assert.deepStrictEqual(w, { locksAt: kickoff, editable: true });
  });

  test('closes exactly at kickoff, to the millisecond', () => {
    const g = { status: 'SCHEDULED', gameDate: kickoff };
    assert.strictEqual(pickWindow(g, T - 1).editable, true);
    assert.strictEqual(pickWindow(g, T).editable, false);
  });

  test('never disagrees with isPickLocked', () => {
    const cases = [
      { status: 'SCHEDULED', gameDate: kickoff },
      { status: 'FINAL', gameDate: kickoff },
      { status: 'IN_PROGRESS', gameDate: kickoff },
      { status: 'SCHEDULED', gameDate: kickoff, postponed: true },
      { status: 'SCHEDULED', gameDate: null }
    ];
    for (const g of cases) {
      for (const now of [T - 1000, T, T + 1000]) {
        assert.strictEqual(pickWindow(g, now).editable, !isPickLocked(g, now), JSON.stringify({ g, now }));
      }
    }
  });

  test('a postponed game stays editable and reports its original date', () => {
    const w = pickWindow({ status: 'SCHEDULED', gameDate: kickoff, postponed: true }, T + 86_400_000);
    assert.strictEqual(w.editable, true);
    assert.strictEqual(w.locksAt, kickoff);
  });

  test('a game with no usable kickoff reports no deadline rather than a bogus one', () => {
    assert.strictEqual(pickWindow({ status: 'SCHEDULED', gameDate: null }, T).locksAt, null);
    assert.strictEqual(pickWindow({ status: 'SCHEDULED', gameDate: 'not-a-date' }, T).locksAt, null);
  });
});
