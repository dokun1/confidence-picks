import { test, describe } from 'node:test';
import assert from 'node:assert';
import { runPickReminders, REMINDER_WINDOW_MS } from '../src/services/NflEmailJobs.js';

process.env.EMAIL_TOKEN_SECRET = 'test-secret';

// Sunday 2026-09-20, 1:00 PM ET.
const KICKOFF = new Date('2026-09-20T17:00:00Z');

function game(id, date, status = 'SCHEDULED') {
  return { id, gameDate: date, status, postponed: false };
}

const CANDIDATE = {
  user_id: 1,
  name: 'Ann',
  email: 'ann@example.com',
  group_id: 9,
  group_name: 'Sunday Squad',
  identifier: 'sunday-squad',
};

/** deps double: two games today, configurable subscribers and existing picks. */
function makeDeps({ candidates, completed = [], sent = [], games } = {}) {
  return {
    pool: {
      query: async (sql) => {
        if (sql.includes('email_reminders')) return { rows: candidates ?? [] };
        if (sql.includes('user_picks')) return { rows: completed };
        return { rows: [] };
      },
    },
    gameService: {
      getGamesForWeek: async () => games ?? [game(1, KICKOFF), game(2, KICKOFF)],
    },
    computeClosestWeek: async () => 3,
    emailService: {
      send: async (m) => {
        sent.push(m);
        return { id: 'msg-1' };
      },
    },
    emailSend: {
      claim: async () => 1,
      markSent: async () => {},
      markFailed: async () => {},
    },
    season: 2026,
    seasonType: 2,
    appUrl: 'https://www.confidence-picks.com',
    apiUrl: 'https://api.confidence-picks.com',
  };
}

describe('runPickReminders', () => {
  test('sends inside the 4-hour window', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    const now = new Date(KICKOFF.getTime() - 3 * 60 * 60 * 1000);

    const res = await runPickReminders({ now, deps });

    assert.strictEqual(res.sent, 1);
    assert.strictEqual(sent.length, 1);
    assert.strictEqual(sent[0].to, 'ann@example.com');
    assert.match(sent[0].subject, /2 picks/);
    assert.match(sent[0].subject, /1:00 PM ET/);
  });

  test('sends at the very edge of the window', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    const now = new Date(KICKOFF.getTime() - REMINDER_WINDOW_MS);

    const res = await runPickReminders({ now, deps });
    assert.strictEqual(res.sent, 1);
  });

  test('does nothing more than 4 hours out', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    const now = new Date(KICKOFF.getTime() - REMINDER_WINDOW_MS - 60_000);

    const res = await runPickReminders({ now, deps });

    assert.strictEqual(res.sent, 0);
    assert.strictEqual(res.reason, 'outside-window');
    assert.strictEqual(sent.length, 0);
  });

  test('does nothing once the first game has kicked off', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() + 1000), deps });
    assert.strictEqual(res.sent, 0);
    assert.strictEqual(sent.length, 0);
  });

  test('ignores games on another Eastern day', async () => {
    const sent = [];
    // Thursday's game, evaluated on Sunday.
    const thursday = new Date('2026-09-17T20:00:00Z');
    const deps = makeDeps({ candidates: [CANDIDATE], sent, games: [game(1, thursday)] });

    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });

    assert.strictEqual(res.sent, 0);
    assert.strictEqual(res.reason, 'no-open-games-today');
  });

  test('a member with every pick in gets nothing', async () => {
    const sent = [];
    const deps = makeDeps({
      candidates: [CANDIDATE],
      sent,
      completed: [
        { user_id: 1, group_id: 9, game_id: 1 },
        { user_id: 1, group_id: 9, game_id: 2 },
      ],
    });

    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });

    assert.strictEqual(res.sent, 0);
    assert.strictEqual(sent.length, 0);
  });

  test('counts a partially-picked slate', async () => {
    const sent = [];
    const deps = makeDeps({
      candidates: [CANDIDATE],
      sent,
      completed: [{ user_id: 1, group_id: 9, game_id: 1 }],
    });

    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });

    assert.strictEqual(res.sent, 1);
    assert.match(sent[0].subject, /1 pick to make/);
  });

  test('a second run the same day is a no-op (claim already taken)', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });
    deps.emailSend.claim = async () => null;

    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });

    assert.strictEqual(res.sent, 0);
    assert.strictEqual(sent.length, 0, 'must not send when the claim was already taken');
  });

  test('one email covers several groups', async () => {
    const sent = [];
    const deps = makeDeps({
      candidates: [
        CANDIDATE,
        { ...CANDIDATE, group_id: 10, group_name: 'Work Pool', identifier: 'work-pool' },
      ],
      sent,
    });

    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });

    assert.strictEqual(res.sent, 1, 'batched per user, not per group');
    assert.match(sent[0].subject, /4 picks/);
    assert.match(sent[0].html, /Sunday Squad/);
    assert.match(sent[0].html, /Work Pool/);
  });

  test('marks the claim failed when the provider throws', async () => {
    let failed = null;
    const deps = makeDeps({ candidates: [CANDIDATE] });
    deps.emailService.send = async () => {
      throw new Error('provider down');
    };
    deps.emailSend.markFailed = async (id, msg) => {
      failed = { id, msg };
    };

    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });

    assert.strictEqual(res.sent, 0);
    assert.match(failed.msg, /provider down/);
  });

  test('a skipped address is recorded but not counted as sent', async () => {
    const deps = makeDeps({ candidates: [CANDIDATE] });
    deps.emailService.send = async () => ({ id: null, skipped: 'unsendable-address' });

    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });

    assert.strictEqual(res.sent, 0);
  });

  test('carries an unsubscribe link with no group (reminders span groups)', async () => {
    const sent = [];
    const deps = makeDeps({ candidates: [CANDIDATE], sent });

    await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });

    assert.match(sent[0].unsubscribeUrl, /^https:\/\/api\.confidence-picks\.com\/api\/email\/unsubscribe\?token=/);
  });

  test('reports no-subscribers when nobody opted in', async () => {
    const deps = makeDeps({ candidates: [] });
    const res = await runPickReminders({ now: new Date(KICKOFF.getTime() - 3600_000), deps });
    assert.strictEqual(res.reason, 'no-subscribers');
  });
});
