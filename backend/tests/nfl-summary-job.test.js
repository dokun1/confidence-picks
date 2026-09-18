import { test, describe } from 'node:test';
import assert from 'node:assert';
import { runWeeklySummaries } from '../src/services/NflEmailJobs.js';

process.env.EMAIL_TOKEN_SECRET = 'test-secret';

const TUES_8AM_ET = new Date('2026-09-22T12:00:00Z');
const TUES_2PM_ET = new Date('2026-09-22T18:00:00Z');

const SUBSCRIBER = {
  user_id: 1,
  name: 'Ann',
  email: 'ann@example.com',
  group_id: 9,
  group_name: 'Sunday Squad',
  identifier: 'sunday-squad',
};

const COMPLETE_WEEK = [{ week: 3, total: '16', final_count: '16' }];

function makeDeps({ weekRows, subscribers, sent = [] }) {
  return {
    pool: {
      query: async (sql) => {
        if (sql.includes('FILTER')) return { rows: weekRows };
        if (sql.includes('email_summaries')) return { rows: subscribers };
        return { rows: [] };
      },
    },
    buildScoreboard: async () => ({
      season: 2026,
      seasonType: 2,
      weeks: [3],
      users: [
        { userId: 1, name: 'Ann', pictureUrl: null, weekly: [{ week: 3, points: 5 }], totalPoints: 5 },
      ],
    }),
    buildWeekPickGrid: async () => ({
      games: [
        { gameId: 1, homeAbbr: 'SF', awayAbbr: 'LAR', homeScore: 20, awayScore: 10, status: 'FINAL' },
      ],
      rows: [
        {
          userId: 1,
          name: 'Ann',
          picks: [{ gameId: 1, pickedTeamId: '1', confidence: 5, won: true, points: 5 }],
          weekPoints: 5,
        },
      ],
    }),
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

describe('runWeeklySummaries', () => {
  test('sends in the 8am ET hour for a fully final week', async () => {
    const sent = [];
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [SUBSCRIBER], sent });

    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });

    assert.strictEqual(res.sent, 1);
    assert.strictEqual(sent[0].subject, 'Sunday Squad: Week 3 results');
    assert.strictEqual(sent[0].to, 'ann@example.com');
  });

  test('does nothing outside the 8am ET hour', async () => {
    const sent = [];
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [SUBSCRIBER], sent });

    const res = await runWeeklySummaries({ now: TUES_2PM_ET, deps });

    assert.strictEqual(res.sent, 0);
    assert.strictEqual(res.reason, 'not-send-hour');
    assert.strictEqual(sent.length, 0);
  });

  test('does nothing while any game in the week is unfinished', async () => {
    const sent = [];
    const deps = makeDeps({
      weekRows: [{ week: 3, total: '16', final_count: '15' }],
      subscribers: [SUBSCRIBER],
      sent,
    });

    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });

    assert.strictEqual(res.sent, 0);
    assert.strictEqual(res.reason, 'no-completed-week');
  });

  test('picks the most recent complete week, not an older one', async () => {
    const sent = [];
    const deps = makeDeps({
      weekRows: [
        { week: 4, total: '16', final_count: '9' }, // in progress
        { week: 3, total: '16', final_count: '16' }, // the one to report
        { week: 2, total: '16', final_count: '16' }, // already reported
      ],
      subscribers: [SUBSCRIBER],
      sent,
    });

    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });

    assert.strictEqual(res.sent, 1);
    assert.match(sent[0].subject, /Week 3/, 'never backfills older weeks');
  });

  test('ignores a week with no games at all', async () => {
    const deps = makeDeps({
      weekRows: [{ week: 5, total: '0', final_count: '0' }],
      subscribers: [SUBSCRIBER],
    });

    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });
    assert.strictEqual(res.reason, 'no-completed-week');
  });

  test('a second run for the same week is a no-op', async () => {
    const sent = [];
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [SUBSCRIBER], sent });
    deps.emailSend.claim = async () => null;

    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });

    assert.strictEqual(res.sent, 0);
    assert.strictEqual(sent.length, 0);
  });

  test('sends one email per group, per member', async () => {
    const sent = [];
    const deps = makeDeps({
      weekRows: COMPLETE_WEEK,
      subscribers: [
        SUBSCRIBER,
        { ...SUBSCRIBER, group_id: 10, group_name: 'Work Pool', identifier: 'work-pool' },
      ],
      sent,
    });

    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });

    assert.strictEqual(res.sent, 2);
    assert.deepStrictEqual(
      sent.map((m) => m.subject).sort(),
      ['Sunday Squad: Week 3 results', 'Work Pool: Week 3 results'],
    );
  });

  test('computes the scoreboard once per group, not once per member', async () => {
    let boardCalls = 0;
    const deps = makeDeps({
      weekRows: COMPLETE_WEEK,
      subscribers: [
        SUBSCRIBER,
        { ...SUBSCRIBER, user_id: 2, name: 'Bo', email: 'bo@example.com' },
        { ...SUBSCRIBER, user_id: 3, name: 'Cy', email: 'cy@example.com' },
      ],
    });
    const original = deps.buildScoreboard;
    deps.buildScoreboard = async (...args) => {
      boardCalls += 1;
      return original(...args);
    };

    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });

    assert.strictEqual(res.sent, 3);
    assert.strictEqual(boardCalls, 1);
  });

  test('carries a group-scoped unsubscribe link', async () => {
    const sent = [];
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [SUBSCRIBER], sent });

    await runWeeklySummaries({ now: TUES_8AM_ET, deps });

    assert.match(sent[0].unsubscribeUrl, /\/api\/email\/unsubscribe\?token=/);
    assert.ok(sent[0].html.includes(sent[0].unsubscribeUrl));
  });

  test('reports no-subscribers when nobody opted in', async () => {
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [] });
    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });
    assert.strictEqual(res.reason, 'no-subscribers');
  });

  test('marks the claim failed when the provider throws', async () => {
    let failed = null;
    const deps = makeDeps({ weekRows: COMPLETE_WEEK, subscribers: [SUBSCRIBER] });
    deps.emailService.send = async () => {
      throw new Error('rate limited');
    };
    deps.emailSend.markFailed = async (id, msg) => {
      failed = msg;
    };

    const res = await runWeeklySummaries({ now: TUES_8AM_ET, deps });

    assert.strictEqual(res.sent, 0);
    assert.match(failed, /rate limited/);
  });
});
