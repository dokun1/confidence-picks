import { test, describe, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import pool from '../src/config/database.js';
import { buildScoreboard, buildWeekPickGrid } from '../src/services/NflScoreboardService.js';

// Characterization tests for the extraction out of the GET /scoreboard route
// closure. These pin the scoring rule and the response shape: a behaviour
// change here silently rewrites everyone's standings.

const HOME = { id: '1', abbreviation: 'SF' };
const AWAY = { id: '2', abbreviation: 'LAR' };

function stubQueries({ users, picks }) {
  mock.method(pool, 'query', async (sql) => {
    if (sql.includes('group_memberships')) return { rows: users };
    return { rows: picks };
  });
}

function pick(overrides) {
  return {
    user_id: 1,
    game_id: 1,
    week: 1,
    confidence_level: 5,
    picked_team_id: '1',
    points: null,
    won: null,
    status: 'FINAL',
    home_team: HOME,
    away_team: AWAY,
    home_score: 20,
    away_score: 10,
    ...overrides,
  };
}

describe('buildScoreboard', () => {
  afterEach(() => mock.restoreAll());

  test('grades ungraded FINAL picks: +confidence win, -confidence loss', async () => {
    stubQueries({
      users: [{ id: 1, name: 'Ann', picture_url: null }],
      picks: [
        pick({ game_id: 1, confidence_level: 5, picked_team_id: '1' }), // home won: +5
        pick({ game_id: 2, confidence_level: 3, picked_team_id: '2' }), // away lost: -3
      ],
    });

    const board = await buildScoreboard(7, 2026, 2);

    assert.deepStrictEqual(board.weeks, [1]);
    assert.strictEqual(board.users[0].totalPoints, 2);
  });

  test('a tie scores zero and leaves won null', async () => {
    stubQueries({
      users: [{ id: 1, name: 'Ann', picture_url: null }],
      picks: [pick({ week: 2, confidence_level: 9, home_score: 17, away_score: 17 })],
    });

    const board = await buildScoreboard(7, 2026, 2);
    assert.strictEqual(board.users[0].totalPoints, 0);
  });

  test('a stored points value is preserved rather than recomputed', async () => {
    stubQueries({
      users: [{ id: 1, name: 'Ann', picture_url: null }],
      picks: [pick({ points: 99, won: true })],
    });

    const board = await buildScoreboard(7, 2026, 2);
    assert.strictEqual(board.users[0].totalPoints, 99);
  });

  test('members with no picks still appear, sorted last', async () => {
    stubQueries({
      users: [
        { id: 1, name: 'Ann', picture_url: null },
        { id: 2, name: 'Bo', picture_url: null },
      ],
      picks: [pick({ confidence_level: 4 })],
    });

    const board = await buildScoreboard(7, 2026, 2);

    assert.strictEqual(board.users.length, 2);
    assert.strictEqual(board.users[0].name, 'Ann');
    assert.strictEqual(board.users[1].totalPoints, 0);
    assert.deepStrictEqual(board.users[1].weekly, [{ week: 1, points: 0 }]);
  });

  test('a non-final game contributes nothing', async () => {
    stubQueries({
      users: [{ id: 1, name: 'Ann', picture_url: null }],
      picks: [pick({ week: 3, confidence_level: 7, status: 'IN_PROGRESS', home_score: 7, away_score: 0 })],
    });

    const board = await buildScoreboard(7, 2026, 2);
    assert.strictEqual(board.users[0].totalPoints, 0);
  });

  test('returns the documented envelope', async () => {
    stubQueries({ users: [{ id: 1, name: 'Ann', picture_url: 'p.png' }], picks: [pick()] });

    const board = await buildScoreboard(7, 2026, 2);

    assert.deepStrictEqual(Object.keys(board).sort(), ['season', 'seasonType', 'users', 'weeks']);
    assert.strictEqual(board.season, 2026);
    assert.strictEqual(board.seasonType, 2);
    assert.deepStrictEqual(Object.keys(board.users[0]).sort(), [
      'name',
      'pictureUrl',
      'totalPoints',
      'userId',
      'weekly',
    ]);
  });

  test('parses team JSON delivered as a string', async () => {
    stubQueries({
      users: [{ id: 1, name: 'Ann', picture_url: null }],
      picks: [pick({ home_team: JSON.stringify(HOME), away_team: JSON.stringify(AWAY) })],
    });

    const board = await buildScoreboard(7, 2026, 2);
    assert.strictEqual(board.users[0].totalPoints, 5);
  });
});

describe('buildWeekPickGrid', () => {
  afterEach(() => mock.restoreAll());

  test('lists each game once and each member once', async () => {
    stubQueries({
      users: [
        { id: 1, name: 'Ann', picture_url: null },
        { id: 2, name: 'Bo', picture_url: null },
      ],
      picks: [
        pick({ user_id: 1, game_id: 1, confidence_level: 5, picked_team_id: '1' }),
        pick({ user_id: 2, game_id: 1, confidence_level: 2, picked_team_id: '2' }),
      ],
    });

    const grid = await buildWeekPickGrid(7, 2026, 2, 1);

    assert.strictEqual(grid.games.length, 1);
    assert.deepStrictEqual(grid.games[0], {
      gameId: 1,
      homeAbbr: 'SF',
      awayAbbr: 'LAR',
      homeScore: 20,
      awayScore: 10,
      status: 'FINAL',
    });
    assert.strictEqual(grid.rows.length, 2);
    assert.strictEqual(grid.rows[0].name, 'Ann', 'sorted by week points desc');
    assert.strictEqual(grid.rows[0].weekPoints, 5);
    assert.strictEqual(grid.rows[1].weekPoints, -2);
  });

  test('a member who made no picks appears with an empty row', async () => {
    stubQueries({
      users: [
        { id: 1, name: 'Ann', picture_url: null },
        { id: 2, name: 'Bo', picture_url: null },
      ],
      picks: [pick({ user_id: 1 })],
    });

    const grid = await buildWeekPickGrid(7, 2026, 2, 1);
    const bo = grid.rows.find((r) => r.name === 'Bo');
    assert.deepStrictEqual(bo.picks, []);
    assert.strictEqual(bo.weekPoints, 0);
  });
});
