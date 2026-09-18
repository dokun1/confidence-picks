import { test, describe } from 'node:test';
import assert from 'node:assert';
import { pickReminder } from '../src/emails/pickReminder.js';
import { weeklySummary } from '../src/emails/weeklySummary.js';

const UNSUB = 'https://api.confidence-picks.com/api/email/unsubscribe?token=abc';
const APP = 'https://www.confidence-picks.com';

describe('pickReminder', () => {
  test('names one group and pluralises correctly', () => {
    const { subject, html, text } = pickReminder({
      userName: 'Ann',
      groups: [{ name: 'Sunday Squad', identifier: 'sunday-squad', count: 1 }],
      kickoffLabel: '1:00 PM ET',
      unsubscribeUrl: UNSUB,
      appUrl: APP,
    });

    assert.match(subject, /1 pick to make/);
    assert.ok(!subject.includes('1 picks'));
    assert.match(html, /Sunday Squad/);
    assert.match(html, /1:00 PM ET/);
    assert.ok(html.includes(UNSUB), 'every email must carry its unsubscribe link');
    assert.match(text, /Sunday Squad/);
    assert.ok(text.includes(UNSUB));
  });

  test('sums across several groups in the subject', () => {
    const { subject, html } = pickReminder({
      userName: 'Ann',
      groups: [
        { name: 'Sunday Squad', identifier: 'a', count: 3 },
        { name: 'Work Pool', identifier: 'b', count: 2 },
      ],
      kickoffLabel: '1:00 PM ET',
      unsubscribeUrl: UNSUB,
      appUrl: APP,
    });

    assert.match(subject, /5 picks/);
    assert.match(html, /Sunday Squad/);
    assert.match(html, /Work Pool/);
  });

  test('links each group to its own editor', () => {
    const { html } = pickReminder({
      userName: 'Ann',
      groups: [{ name: 'Sunday Squad', identifier: 'sunday-squad', count: 1 }],
      kickoffLabel: '1:00 PM ET',
      unsubscribeUrl: UNSUB,
      appUrl: APP,
    });
    assert.ok(html.includes(`${APP}/games?groupId=sunday-squad`));
  });

  test('escapes HTML in a group name', () => {
    const { html } = pickReminder({
      userName: 'Ann',
      groups: [{ name: '<script>alert(1)</script>', identifier: 'x', count: 1 }],
      kickoffLabel: '1:00 PM ET',
      unsubscribeUrl: UNSUB,
      appUrl: APP,
    });

    assert.ok(!html.includes('<script>'), 'group names are user input and must be escaped');
    assert.match(html, /&lt;script&gt;/);
  });
});

describe('weeklySummary', () => {
  const grid = {
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
      { userId: 2, name: 'Bo', picks: [], weekPoints: 0 },
    ],
  };
  const scoreboard = {
    season: 2026,
    seasonType: 2,
    weeks: [1],
    users: [
      { userId: 1, name: 'Ann', pictureUrl: null, weekly: [{ week: 1, points: 5 }], totalPoints: 5 },
      { userId: 2, name: 'Bo', pictureUrl: null, weekly: [{ week: 1, points: 0 }], totalPoints: 0 },
    ],
  };

  function render(overrides = {}) {
    return weeklySummary({
      userName: 'Ann',
      groupName: 'Sunday Squad',
      week: 1,
      grid,
      scoreboard,
      unsubscribeUrl: UNSUB,
      appUrl: APP,
      ...overrides,
    });
  }

  test('names the group and week in the subject', () => {
    const { subject } = render();
    assert.strictEqual(subject, 'Sunday Squad: Week 1 results');
  });

  test('renders the grid, the standings and the results', () => {
    const { html, text } = render();
    assert.match(html, /How everyone did/);
    assert.match(html, /Standings/);
    assert.match(html, /LAR @ SF/);
    assert.match(html, /1\/1/, "Ann's correct count");
    assert.match(html, /0\/0/, 'a member who sat the week out still appears');
    assert.ok(html.includes(UNSUB));
    assert.match(text, /Week 1/);
    assert.match(text, /Ann — 5 pts/);
  });

  test('escapes HTML in a group name', () => {
    const { html } = render({ groupName: '<img src=x onerror=1>' });
    assert.ok(!html.includes('<img src=x'));
    assert.match(html, /&lt;img/);
  });
});
