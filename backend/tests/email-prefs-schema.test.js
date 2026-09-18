import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import pool from '../src/config/database.js';
import { Group } from '../src/models/Group.js';

// The opt-in email preference columns self-heal the same way the dues columns
// do: prod deploys with INIT_DB unset, so schema.sql never runs and the first
// call after a deploy has to add them. Mirrors dues-schema-selfheal.test.js.

describe('Group.ensureEmailPrefsSchema', () => {
  beforeEach(() => {
    Group._emailPrefsSchemaEnsured = false;
  });

  afterEach(() => {
    mock.restoreAll();
    Group._emailPrefsSchemaEnsured = false;
  });

  test('adds the columns when the probe finds none, then latches', async () => {
    const calls = [];
    mock.method(pool, 'query', async (sql) => {
      calls.push(sql);
      if (sql.includes('information_schema.columns')) return { rows: [] };
      return { rows: [] };
    });

    await Group.ensureEmailPrefsSchema();

    assert.strictEqual(Group._emailPrefsSchemaEnsured, true);
    assert.ok(
      calls.some((s) => s.includes('ALTER TABLE group_memberships')),
      'must add the membership columns',
    );
    assert.ok(
      calls.some((s) => s.includes('ALTER TABLE users')),
      'must add the global pause column',
    );

    const before = calls.length;
    await Group.ensureEmailPrefsSchema();
    assert.strictEqual(calls.length, before, 'a latched call must issue no queries');
  });

  test('latches without altering when the columns already exist', async () => {
    const calls = [];
    mock.method(pool, 'query', async (sql) => {
      calls.push(sql);
      return { rows: [{ '?column?': 1 }] };
    });

    await Group.ensureEmailPrefsSchema();

    assert.strictEqual(Group._emailPrefsSchemaEnsured, true);
    assert.strictEqual(calls.length, 1, 'probe only');
    assert.ok(!calls.some((s) => s.includes('ALTER TABLE')));
  });

  test('does NOT latch when the probe throws, so the next call retries', async () => {
    mock.method(pool, 'query', async () => {
      throw new Error('connection reset');
    });

    await Group.ensureEmailPrefsSchema();

    assert.strictEqual(
      Group._emailPrefsSchemaEnsured,
      false,
      'a transient failure must not permanently claim the columns exist',
    );
  });
});
