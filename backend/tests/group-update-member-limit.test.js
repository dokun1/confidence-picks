import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { Group } from '../src/models/Group.js';
import pool from '../src/config/database.js';

// Unit-tests the real member-limit guard inside Group.update by stubbing the pool
// singleton: the admin role lookup, the current member-count query, and the UPDATE.
// No live Postgres. Covers the shrink guard (can't drop below current count), the
// equal-to-count boundary, the [2,500] bounds, and the admin gate.

describe('Group.update — member limit guard', () => {
  // The max_members constraint self-heal is covered by groups-ensure-constraint.test.js;
  // latch it here so update() skips it and the stubbed pool only sees the guard's queries.
  beforeEach(() => { Group._maxMembersConstraintEnsured = true; });
  afterEach(() => { mock.restoreAll(); Group._maxMembersConstraintEnsured = false; });

  // role: the caller's membership role (null = not a member).
  // memberCount: rows returned by the COUNT(*) query.
  function stubPool({ role = 'admin', memberCount = 3 } = {}) {
    mock.method(pool, 'query', async (sql, params) => {
      if (/SELECT role FROM group_memberships/.test(sql)) {
        return { rows: role ? [{ role }] : [] };
      }
      if (/COUNT\(\*\)/.test(sql)) {
        return { rows: [{ count: memberCount }] };
      }
      // The UPDATE ... RETURNING *
      return { rows: [{ id: 10, max_members: params[0] }] };
    });
  }

  test('expanding the limit up to the 500 cap succeeds', async () => {
    stubPool({ memberCount: 3 });
    const res = await Group.update(10, { maxMembers: 500 }, 1);
    assert.equal(res.max_members, 500);
  });

  test('lowering below the current member count is rejected (shrink guard)', async () => {
    stubPool({ memberCount: 38 });
    await assert.rejects(
      () => Group.update(10, { maxMembers: 30 }, 1),
      /below the current member count \(38\)/,
    );
  });

  test('lowering to exactly the current member count is allowed', async () => {
    stubPool({ memberCount: 30 });
    const res = await Group.update(10, { maxMembers: 30 }, 1);
    assert.equal(res.max_members, 30);
  });

  test('a limit over 500 throws the bounds error before touching member count', async () => {
    stubPool({ memberCount: 3 });
    await assert.rejects(() => Group.update(10, { maxMembers: 501 }, 1), /between 2 and 500/);
  });

  test('a limit below 2 throws the bounds error', async () => {
    stubPool({ memberCount: 3 });
    await assert.rejects(() => Group.update(10, { maxMembers: 1 }, 1), /between 2 and 500/);
  });

  test('a non-admin cannot change the limit', async () => {
    stubPool({ role: 'member', memberCount: 3 });
    await assert.rejects(() => Group.update(10, { maxMembers: 50 }, 1), /Only group admins/);
  });

  test('updates that do not touch maxMembers skip the limit guard', async () => {
    stubPool({ memberCount: 3 });
    const res = await Group.update(10, { name: 'Renamed' }, 1);
    assert.ok(res);
  });
});
