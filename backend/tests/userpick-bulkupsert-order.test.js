import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { UserPick } from '../src/models/UserPick.js';
import pool from '../src/config/database.js';

// The write order IS the fix. `ux_user_picks_conf_per_week` is a PARTIAL unique
// index (WHERE confidence_level IS NOT NULL), and Postgres cannot make a partial
// index DEFERRABLE -- so the collision has to be designed out of the statement
// order rather than deferred to commit.
//
// bulkUpsert therefore runs two phases in one transaction: NULL every confidence
// the batch is about to reassign (the index ignores NULLs, so no duplicate can
// exist), then claim them. These assertions pin that order; reverse them and a
// confidence swap goes back to failing with 23505.

describe('UserPick.bulkUpsert write ordering', () => {
  let issued, released, client;

  beforeEach(() => {
    issued = [];
    released = false;
    client = {
      query: async (sql, params) => {
        issued.push({ sql: String(sql).replace(/\s+/g, ' ').trim(), params });
        return { rows: [] };
      },
      release: () => { released = true; }
    };
    mock.method(pool, 'connect', async () => client);
  });
  afterEach(() => mock.restoreAll());

  const run = () => UserPick.bulkUpsert({
    userId: 83, groupId: 6, season: 2026, seasonType: 2, week: 2,
    picks: [
      { gameId: 201, pickedTeamId: '14', confidence: 2 },
      { gameId: 202, pickedTeamId: '25', confidence: 1 }
    ]
  });

  test('vacates the batch\'s confidences before claiming them, inside one transaction', async () => {
    await run();
    const kinds = issued.map((q) =>
      /^BEGIN/.test(q.sql) ? 'begin'
        : /pg_advisory_xact_lock/.test(q.sql) ? 'lock'
        : /^UPDATE user_picks SET confidence_level = NULL/.test(q.sql) ? 'vacate'
        : /^INSERT INTO user_picks/.test(q.sql) ? 'claim'
        : /^COMMIT/.test(q.sql) ? 'commit' : 'other');
    assert.deepStrictEqual(kinds, ['begin', 'lock', 'vacate', 'claim', 'commit']);
  });

  test('the vacate is scoped to exactly the games in the batch', async () => {
    await run();
    const vacate = issued.find((q) => q.sql.startsWith('UPDATE user_picks SET confidence_level = NULL'));
    assert.deepStrictEqual(vacate.params[5], [201, 202]);
    assert.match(vacate.sql, /confidence_level IS NOT NULL/, 'rows with no confidence need no write');
    assert.match(vacate.sql, /picked_team_id = NULL/, 'chk_pick_consistency requires the pair to clear together');
  });

  test('a failure rolls back and still releases the connection', async () => {
    client.query = async (sql) => {
      issued.push({ sql: String(sql).replace(/\s+/g, ' ').trim() });
      if (/^INSERT INTO user_picks/.test(sql)) { const e = new Error('boom'); e.code = '23505'; throw e; }
      return { rows: [] };
    };
    await assert.rejects(run, /boom/);
    assert.ok(issued.some((q) => q.sql === 'ROLLBACK'), 'must not leave a half-vacated week committed');
    assert.strictEqual(released, true, 'a leaked connection would exhaust the pool');
  });

  test('an empty batch touches neither the pool nor a transaction', async () => {
    const out = await UserPick.bulkUpsert({ userId: 83, groupId: 6, season: 2026, seasonType: 2, week: 2, picks: [] });
    assert.deepStrictEqual(out, []);
    assert.strictEqual(issued.length, 0);
  });
});
