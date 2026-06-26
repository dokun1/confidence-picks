import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { Group } from '../src/models/Group.js';
import pool from '../src/config/database.js';

// The groups.knockout_only column self-heals on the first group creation after a
// deploy (prod runs with INIT_DB unset, so schema.sql is not synced). These tests
// drive Group.ensureKnockoutOnlyColumn directly with a stubbed pool so no live
// Postgres is needed. The static `_knockoutOnlyColumnEnsured` latch is reset before
// each case because it persists for the lifetime of the process.

describe('Group.ensureKnockoutOnlyColumn (self-heal)', () => {
  beforeEach(() => {
    Group._knockoutOnlyColumnEnsured = false;
  });
  afterEach(() => {
    mock.restoreAll();
    Group._knockoutOnlyColumnEnsured = false;
  });

  test('adds the column with an idempotent ALTER when it is missing', async () => {
    const sqls = [];
    mock.method(pool, 'query', async (sql) => {
      sqls.push(sql);
      if (/information_schema\.columns/.test(sql)) return { rows: [] }; // column missing
      if (/ALTER TABLE groups/.test(sql)) return { rows: [] };
      throw new Error(`unexpected query: ${sql}`);
    });

    await Group.ensureKnockoutOnlyColumn();

    assert.ok(
      sqls.some((s) => /ALTER TABLE groups ADD COLUMN IF NOT EXISTS knockout_only BOOLEAN NOT NULL DEFAULT false/.test(s)),
      'issues the idempotent ALTER when the column is absent',
    );
    assert.strictEqual(Group._knockoutOnlyColumnEnsured, true, 'latches after adding');
  });

  test('does NOT alter when the column already exists', async () => {
    const sqls = [];
    mock.method(pool, 'query', async (sql) => {
      sqls.push(sql);
      if (/information_schema\.columns/.test(sql)) return { rows: [{ '?column?': 1 }] }; // present
      throw new Error(`unexpected query: ${sql}`);
    });

    await Group.ensureKnockoutOnlyColumn();

    assert.ok(!sqls.some((s) => /ALTER TABLE/.test(s)), 'no ALTER issued when the column is present');
    assert.strictEqual(Group._knockoutOnlyColumnEnsured, true);
  });

  test('latches so a warm instance skips the catalog check on later calls', async () => {
    let queryCount = 0;
    mock.method(pool, 'query', async (sql) => {
      queryCount++;
      if (/information_schema\.columns/.test(sql)) return { rows: [{ '?column?': 1 }] };
      return { rows: [] };
    });

    await Group.ensureKnockoutOnlyColumn();
    await Group.ensureKnockoutOnlyColumn();
    await Group.ensureKnockoutOnlyColumn();

    assert.strictEqual(queryCount, 1, 'only the first call hits the DB; the rest are the zero-query fast path');
  });

  test('does NOT latch on failure, so the next call retries', async () => {
    let queryCount = 0;
    mock.method(pool, 'query', async () => {
      queryCount++;
      throw new Error('transient DB error');
    });

    await Group.ensureKnockoutOnlyColumn(); // swallows the error
    await Group.ensureKnockoutOnlyColumn(); // must try again

    assert.strictEqual(queryCount, 2, 'a transient failure does not permanently latch');
    assert.strictEqual(Group._knockoutOnlyColumnEnsured, false);
  });
});
