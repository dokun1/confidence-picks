import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { buildWorldCupUpsert, UserPick } from '../src/models/UserPick.js';
import pool from '../src/config/database.js';

describe('buildWorldCupUpsert with predicted scores', () => {
  test('includes predicted score columns and values (null when absent)', () => {
    const { sql, values } = buildWorldCupUpsert({
      userId: 1, groupId: 2, season: 2026, seasonType: 1, week: 1,
      picks: [
        { gameId: 10, pickedResult: 'home', predictedHomeScore: 3, predictedAwayScore: 2 },
        { gameId: 11, pickedResult: 'away' },
      ],
    });
    assert.match(sql, /predicted_home_score/);
    assert.match(sql, /predicted_away_score/);
    assert.match(sql, /predicted_home_score = EXCLUDED\.predicted_home_score/);
    // row 1 carries 3/2, row 2 carries null/null
    assert.deepEqual(values.slice(0, 9), [1, 2, 10, 'home', 1, 2026, 1, 3, 2]);
    assert.deepEqual(values.slice(9), [1, 2, 11, 'away', 1, 2026, 1, null, null]);
  });
});

describe('UserPick.ensureScorePredictionColumns (self-heal)', () => {
  beforeEach(() => {
    UserPick._scoreColumnsEnsured = false;
  });
  afterEach(() => {
    mock.restoreAll();
    UserPick._scoreColumnsEnsured = false;
  });

  test('adds both columns with idempotent ALTERs when they are missing', async () => {
    const sqls = [];
    mock.method(pool, 'query', async (sql) => {
      sqls.push(sql);
      if (/information_schema\.columns/.test(sql)) return { rows: [] }; // columns missing
      if (/ALTER TABLE user_picks/.test(sql)) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });

    await UserPick.ensureScorePredictionColumns();

    assert.ok(
      sqls.some((s) => /ALTER TABLE user_picks ADD COLUMN IF NOT EXISTS predicted_home_score INTEGER NULL/.test(s)),
      'issues the ALTER for predicted_home_score when absent',
    );
    assert.ok(
      sqls.some((s) => /ALTER TABLE user_picks ADD COLUMN IF NOT EXISTS predicted_away_score INTEGER NULL/.test(s)),
      'issues the ALTER for predicted_away_score when absent',
    );
    assert.strictEqual(UserPick._scoreColumnsEnsured, true, 'latches after adding');
  });

  test('does NOT alter when both columns already exist', async () => {
    const sqls = [];
    mock.method(pool, 'query', async (sql) => {
      sqls.push(sql);
      if (/information_schema\.columns/.test(sql)) return { rows: [{ '?column?': 1 }] }; // present
      throw new Error(`unexpected query: ${sql}`);
    });

    await UserPick.ensureScorePredictionColumns();

    assert.ok(!sqls.some((s) => /ALTER TABLE/.test(s)), 'no ALTER issued when both columns are present');
    assert.strictEqual(UserPick._scoreColumnsEnsured, true);
  });

  test('latches so a warm instance skips the catalog check on later calls', async () => {
    let queryCount = 0;
    mock.method(pool, 'query', async (sql) => {
      queryCount++;
      if (/information_schema\.columns/.test(sql)) return { rows: [{ '?column?': 1 }] };
      return { rows: [] };
    });

    await UserPick.ensureScorePredictionColumns();
    await UserPick.ensureScorePredictionColumns();
    await UserPick.ensureScorePredictionColumns();

    assert.strictEqual(queryCount, 2, 'only the first call hits the DB (two catalog checks); the rest are the zero-query fast path');
  });

  test('does NOT latch on failure, so the next call retries', async () => {
    let queryCount = 0;
    mock.method(pool, 'query', async () => {
      queryCount++;
      throw new Error('transient DB error');
    });

    await UserPick.ensureScorePredictionColumns(); // swallows the error
    await UserPick.ensureScorePredictionColumns(); // must try again

    assert.strictEqual(queryCount, 2, 'a transient failure does not permanently latch');
    assert.strictEqual(UserPick._scoreColumnsEnsured, false);
  });
});
