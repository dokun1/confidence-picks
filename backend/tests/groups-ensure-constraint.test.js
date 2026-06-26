import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { Group } from '../src/models/Group.js';
import pool from '../src/config/database.js';

// The groups.max_members CHECK constraint self-heals from the legacy <=40 cap to
// <=500 on the first group create/update after a deploy (prod runs with INIT_DB
// unset). These tests drive Group.ensureMaxMembersConstraint directly with a
// stubbed pool. The static `_maxMembersConstraintEnsured` latch is reset around
// each case because it persists for the process lifetime.

describe('Group.ensureMaxMembersConstraint (self-heal)', () => {
  beforeEach(() => { Group._maxMembersConstraintEnsured = false; });
  afterEach(() => { mock.restoreAll(); Group._maxMembersConstraintEnsured = false; });

  test('swaps the legacy <=40 constraint for the <=500 range', async () => {
    const sqls = [];
    mock.method(pool, 'query', async (sql) => {
      sqls.push(sql);
      if (/FROM pg_constraint/.test(sql)) return { rows: [{ conname: 'groups_max_members_check' }] };
      return { rows: [] }; // the ALTERs
    });

    await Group.ensureMaxMembersConstraint();

    assert.ok(
      sqls.some((s) => /DROP CONSTRAINT IF EXISTS groups_max_members_check/.test(s)),
      'drops the legacy constraint',
    );
    assert.ok(
      sqls.some((s) => /ADD CONSTRAINT groups_max_members_range CHECK \(max_members <= 500/.test(s)),
      'adds the <=500 range constraint',
    );
    assert.strictEqual(Group._maxMembersConstraintEnsured, true, 'latches after migrating');
  });

  test('adds the range constraint when neither constraint is present', async () => {
    const sqls = [];
    mock.method(pool, 'query', async (sql) => {
      sqls.push(sql);
      if (/FROM pg_constraint/.test(sql)) return { rows: [] }; // neither present
      return { rows: [] };
    });

    await Group.ensureMaxMembersConstraint();

    assert.ok(sqls.some((s) => /ADD CONSTRAINT groups_max_members_range/.test(s)), 'adds the range constraint');
    assert.strictEqual(Group._maxMembersConstraintEnsured, true);
  });

  test('does NOT change the constraint when the range already exists, but aligns the default', async () => {
    const sqls = [];
    mock.method(pool, 'query', async (sql) => {
      sqls.push(sql);
      if (/FROM pg_constraint/.test(sql)) return { rows: [{ conname: 'groups_max_members_range' }] };
      return { rows: [] };
    });

    await Group.ensureMaxMembersConstraint();

    assert.ok(!sqls.some((s) => /(DROP|ADD) CONSTRAINT/.test(s)), 'no constraint change when already migrated');
    assert.ok(
      sqls.some((s) => /ALTER COLUMN max_members SET DEFAULT 50/.test(s)),
      'still aligns the column default to 50',
    );
    assert.strictEqual(Group._maxMembersConstraintEnsured, true);
  });

  test('latches so a warm instance skips the catalog check on later calls', async () => {
    let queryCount = 0;
    mock.method(pool, 'query', async (sql) => {
      queryCount++;
      if (/FROM pg_constraint/.test(sql)) return { rows: [{ conname: 'groups_max_members_range' }] };
      return { rows: [] };
    });

    await Group.ensureMaxMembersConstraint();
    const afterFirst = queryCount;
    await Group.ensureMaxMembersConstraint();
    await Group.ensureMaxMembersConstraint();

    assert.strictEqual(queryCount, afterFirst, 'later calls add no queries (latched)');
  });

  test('does NOT latch on failure, so the next call retries', async () => {
    let queryCount = 0;
    mock.method(pool, 'query', async () => {
      queryCount++;
      throw new Error('transient DB error');
    });

    await Group.ensureMaxMembersConstraint();
    await Group.ensureMaxMembersConstraint();

    assert.strictEqual(queryCount, 2, 'a transient failure does not permanently latch');
    assert.strictEqual(Group._maxMembersConstraintEnsured, false);
  });
});
