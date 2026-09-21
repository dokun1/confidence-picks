import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import pool from '../src/config/database.js';
import { Group } from '../src/models/Group.js';

// The mocked tests prove setDuesPaid and getMembers ISSUE the right SQL. This
// proves Postgres accepts it: the self-healing ALTER, the three-column UPDATE,
// and getMembers' LEFT JOIN back onto users for the marker's name. A typo in any
// of those is invisible to a stubbed pool.
//
// Skips (rather than fails) with no database, so `npm test` still works for a
// contributor who has not started Postgres.

let live = false;
let adminId, memberId, groupId;

before(async () => {
  try {
    await pool.query('SELECT 1');
    await pool.query('SELECT 1 FROM group_memberships LIMIT 1');
    live = true;
  } catch { return; }

  const stamp = Date.now();
  const mkUser = async (tag, name) => (await pool.query(
    `INSERT INTO users (email, name, provider, google_id) VALUES ($1,$2,$3,$4) RETURNING id`,
    [`dues-${tag}-${stamp}@test.local`, name, 'google', `dues-${tag}-${stamp}`]
  )).rows[0].id;
  adminId = await mkUser('admin', 'Dues Admin');
  memberId = await mkUser('member', 'Dues Member');

  groupId = (await pool.query(
    `INSERT INTO groups (name, identifier, created_by) VALUES ($1,$2,$3) RETURNING id`,
    [`dues-grp-${stamp}`, `dues-grp-${stamp}`, adminId]
  )).rows[0].id;
  await pool.query(
    `INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1,$2,'admin'), ($1,$3,'member')
     ON CONFLICT DO NOTHING`,
    [groupId, adminId, memberId]
  );
});

after(async () => {
  if (!live) return;
  try {
    await pool.query('DELETE FROM group_memberships WHERE group_id=$1', [groupId]);
    await pool.query('DELETE FROM groups WHERE id=$1', [groupId]);
    await pool.query('DELETE FROM users WHERE id = ANY($1::int[])', [[adminId, memberId]]);
  } catch { /* best effort */ }
  await pool.end().catch(() => {});
});

describe('dues_marked_via against a real database', () => {
  const row = async () => (await Group.getMembers(groupId)).find((m) => m.id === memberId);

  test('the self-heal is idempotent: a second ALTER on an existing column is fine', async (t) => {
    if (!live) return t.skip('no database');
    Group._duesMarkedViaEnsured = false;
    await Group.ensureDuesMarkedViaColumn();
    Group._duesMarkedViaEnsured = false;
    await Group.ensureDuesMarkedViaColumn();
    assert.strictEqual(Group._duesMarkedViaEnsured, true);
  });

  test('a member starts unpaid, with no marker', async (t) => {
    if (!live) return t.skip('no database');
    const m = await row();
    assert.strictEqual(m.dues_paid_at, null);
    assert.strictEqual(m.dues_marked_via, null);
    assert.strictEqual(m.dues_marked_by_name, null);
  });

  test('marking paid through a token records mcp and the admin who held it', async (t) => {
    if (!live) return t.skip('no database');
    const res = await Group.setDuesPaid(groupId, memberId, true, adminId, 'mcp');
    assert.strictEqual(res.dues_marked_via, 'mcp');
    const m = await row();
    assert.ok(m.dues_paid_at instanceof Date);
    assert.strictEqual(m.dues_marked_via, 'mcp');
    assert.strictEqual(m.dues_marked_by_name, 'Dues Admin', 'the LEFT JOIN resolves the marker');
  });

  test('un-marking clears all three columns', async (t) => {
    if (!live) return t.skip('no database');
    await Group.setDuesPaid(groupId, memberId, false, adminId, 'mcp');
    const m = await row();
    assert.strictEqual(m.dues_paid_at, null);
    assert.strictEqual(m.dues_marked_via, null);
    assert.strictEqual(m.dues_marked_by_name, null);
  });

  test('the default is web', async (t) => {
    if (!live) return t.skip('no database');
    await Group.setDuesPaid(groupId, memberId, true, adminId);
    assert.strictEqual((await row()).dues_marked_via, 'web');
  });

  test('a plain member cannot mark anyone, whatever the via', async (t) => {
    if (!live) return t.skip('no database');
    await assert.rejects(() => Group.setDuesPaid(groupId, adminId, true, memberId, 'mcp'), /Only group admins/);
    assert.strictEqual((await Group.getMembers(groupId)).find((m) => m.id === adminId).dues_paid_at, null);
  });

  test('a plain member cannot change dues settings either', async (t) => {
    if (!live) return t.skip('no database');
    await assert.rejects(() => Group.update(groupId, { duesEnabled: true }, memberId), /Only group admins/);
  });

  test('every member still comes back when nobody has been marked', async (t) => {
    if (!live) return t.skip('no database');
    await Group.setDuesPaid(groupId, memberId, false, adminId);
    assert.strictEqual((await Group.getMembers(groupId)).length, 2, 'the LEFT JOIN must not drop unmarked rows');
  });
});
