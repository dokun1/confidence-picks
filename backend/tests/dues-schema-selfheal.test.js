import { describe, test, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { Group } from '../src/models/Group.js';
import { GroupInvite } from '../src/models/GroupInvite.js';
import pool from '../src/config/database.js';

// Production runs with INIT_DB unset, so schema.sql is never synced on deploy
// and the dues columns do not exist until something adds them. The dues queries
// name their columns explicitly -- findByIdentifier JOINs on
// g.dues_collector_user_id, getMembers selects gm.dues_paid_at, the invite
// preview selects g.dues_enabled -- and Postgres raises on a missing column in
// a JOIN or select list rather than yielding undefined.
//
// So every path touching those columns must call Group.ensureDuesSchema first.
// These tests pin that wiring without a database: the pool is stubbed, and we
// assert only that the guard ran before the query.

describe('dues schema self-heal', () => {
  let ensured;

  beforeEach(() => {
    // Unlatch so each case exercises the guard rather than the warm fast path.
    Group._duesSchemaEnsured = false;
    ensured = mock.method(Group, 'ensureDuesSchema', async () => {
      Group._duesSchemaEnsured = true;
    });
    mock.method(pool, 'query', async () => ({ rows: [] }));
  });

  afterEach(() => {
    mock.restoreAll();
    Group._duesSchemaEnsured = false;
  });

  // findByIdentifier is the important one: it backs nearly every group route,
  // so an ungated version would 500 the whole group section on first deploy.
  test('findByIdentifier ensures the columns before querying', async () => {
    await Group.findByIdentifier('squad', 1);
    assert.strictEqual(ensured.mock.calls.length, 1);
  });

  test('getMembers ensures the columns before querying', async () => {
    await Group.getMembers(9);
    assert.strictEqual(ensured.mock.calls.length, 1);
  });

  test('the invite preview ensures the columns before querying', async () => {
    await GroupInvite.getByToken('tok');
    assert.strictEqual(ensured.mock.calls.length, 1);
  });

  test('setDuesPaid ensures the columns before writing', async () => {
    await Group.setDuesPaid(9, 2, true, 1).catch(() => {}); // role check fails on empty rows
    assert.strictEqual(ensured.mock.calls.length, 1);
  });

  // update() checks admin BEFORE self-healing, which is the right order: there
  // is no reason to migrate the schema on behalf of a caller who is about to be
  // rejected. So the caller has to look like an admin for the guard to be hit.
  test('update ensures the columns before writing', async () => {
    mock.restoreAll();
    Group._duesSchemaEnsured = false;
    ensured = mock.method(Group, 'ensureDuesSchema', async () => {});
    mock.method(Group, 'ensureMaxMembersConstraint', async () => {});
    mock.method(pool, 'query', async () => ({ rows: [{ role: 'admin' }] }));

    await Group.update(9, { duesEnabled: true }, 1).catch(() => {});

    assert.strictEqual(ensured.mock.calls.length, 1);
  });

  test('update rejects a non-admin before touching the schema', async () => {
    await Group.update(9, { duesEnabled: true }, 1).catch(() => {});
    assert.strictEqual(ensured.mock.calls.length, 0, 'no migration for a rejected caller');
  });
});

describe('ensureDuesSchema latching', () => {
  afterEach(() => {
    mock.restoreAll();
    Group._duesSchemaEnsured = false;
  });

  test('queries the catalog once, then short-circuits', async () => {
    Group._duesSchemaEnsured = false;
    const query = mock.method(pool, 'query', async () => ({ rows: [{ '?column?': 1 }] }));

    await Group.ensureDuesSchema();
    const afterFirst = query.mock.calls.length;
    await Group.ensureDuesSchema();
    await Group.ensureDuesSchema();

    assert.strictEqual(afterFirst, 1, 'first call does one catalog lookup');
    assert.strictEqual(query.mock.calls.length, 1, 'later calls issue no query');
  });

  // A transient failure must not latch, or the process would spend its life
  // believing columns exist that do not.
  test('does not latch when the catalog lookup fails', async () => {
    Group._duesSchemaEnsured = false;
    mock.method(pool, 'query', async () => {
      throw new Error('connection terminated');
    });

    await Group.ensureDuesSchema();

    assert.strictEqual(Group._duesSchemaEnsured, false, 'must stay unlatched to retry');
  });
});

// dues_marked_via arrived AFTER the dues columns shipped. ensureDuesSchema
// short-circuits on the presence of dues_enabled, which production already has,
// so it can never add this column -- hence a guard and latch of its own.
describe('dues_marked_via self-heal', () => {
  afterEach(() => {
    mock.restoreAll();
    Group._duesSchemaEnsured = false;
    Group._duesMarkedViaEnsured = false;
  });

  test('adds the column idempotently, then short-circuits', async () => {
    Group._duesMarkedViaEnsured = false;
    const query = mock.method(pool, 'query', async () => ({ rows: [] }));

    await Group.ensureDuesMarkedViaColumn();
    await Group.ensureDuesMarkedViaColumn();

    assert.strictEqual(query.mock.calls.length, 1, 'one ALTER, then the latch');
    const sql = query.mock.calls[0].arguments[0];
    assert.match(sql, /ALTER TABLE group_memberships/);
    assert.match(sql, /ADD COLUMN IF NOT EXISTS dues_marked_via/);
  });

  test('does not latch when the ALTER fails', async () => {
    Group._duesMarkedViaEnsured = false;
    mock.method(pool, 'query', async () => { throw new Error('connection terminated'); });
    await Group.ensureDuesMarkedViaColumn();
    assert.strictEqual(Group._duesMarkedViaEnsured, false);
  });

  test('setDuesPaid and getMembers both ensure it before querying', async () => {
    mock.method(Group, 'ensureDuesSchema', async () => {});
    const ensured = mock.method(Group, 'ensureDuesMarkedViaColumn', async () => {});
    mock.method(pool, 'query', async () => ({ rows: [] }));
    await Group.getMembers(9);
    await Group.setDuesPaid(9, 2, true, 1, 'mcp').catch(() => {});
    assert.strictEqual(ensured.mock.calls.length, 2);
  });

  test('setDuesPaid stores via when marking paid and clears it when un-marking', async () => {
    mock.method(Group, 'ensureDuesSchema', async () => {});
    mock.method(Group, 'ensureDuesMarkedViaColumn', async () => {});
    const query = mock.method(pool, 'query', async (sql) => (
      /SELECT role/.test(sql) ? { rows: [{ role: 'admin' }] } : { rows: [{ user_id: 2, dues_paid_at: null }] }
    ));

    await Group.setDuesPaid(9, 2, true, 1, 'mcp');
    const paidCall = query.mock.calls.find((c) => /UPDATE group_memberships/.test(c.arguments[0]));
    assert.match(paidCall.arguments[0], /dues_marked_via/);
    assert.ok(paidCall.arguments[1].includes('mcp'));

    query.mock.resetCalls();
    await Group.setDuesPaid(9, 2, false, 1, 'mcp');
    const unpaidCall = query.mock.calls.find((c) => /UPDATE group_memberships/.test(c.arguments[0]));
    assert.ok(!unpaidCall.arguments[1].includes('mcp'), 'un-marking clears via, like dues_marked_by');
  });

  test('setDuesPaid defaults via to web and rejects anything else', async () => {
    mock.method(Group, 'ensureDuesSchema', async () => {});
    mock.method(Group, 'ensureDuesMarkedViaColumn', async () => {});
    const query = mock.method(pool, 'query', async (sql) => (
      /SELECT role/.test(sql) ? { rows: [{ role: 'admin' }] } : { rows: [{ user_id: 2 }] }
    ));
    await Group.setDuesPaid(9, 2, true, 1);
    const call = query.mock.calls.find((c) => /UPDATE group_memberships/.test(c.arguments[0]));
    assert.ok(call.arguments[1].includes('web'));
    await assert.rejects(() => Group.setDuesPaid(9, 2, true, 1, 'carrier-pigeon'), /via/);
  });
});
