import { test, describe, before, after, beforeEach } from 'node:test';
import assert from 'node:assert';
import pool from '../src/config/database.js';
import { McpToken } from '../src/models/McpToken.js';

// L3: real SQL. Everything else stubs the pool, so this is the only place that
// proves the DDL is valid Postgres, that the hash column really is unique, and
// that expiry/revocation behave against actual timestamps rather than mocks.
//
// Run against the dockerised test database:
//   npm run test:setup && NODE_ENV=test node --test tests/mcp-token-integration.test.js
//
// Skips rather than fails when no database is reachable, so the default suite
// stays runnable on a machine without Docker.

let dbUp = false;
let userId;

describe('McpToken against real Postgres', () => {
  before(async () => {
    try {
      await pool.query('SELECT 1');
      dbUp = true;
    } catch {
      console.log('  (no database reachable -- skipping L3 integration cases)');
      return;
    }
    await McpToken.ensureSchema();
    const { rows } = await pool.query(
      `INSERT INTO users (email, name, provider, google_id)
       VALUES ($1, $2, 'google', $3) RETURNING id`,
      [`mcp-int-${Date.now()}@test.local`, 'MCP Integration', `mcp-${Date.now()}`]
    );
    userId = rows[0].id;
  });

  after(async () => {
    if (!dbUp || !userId) return;
    // ON DELETE CASCADE takes the tokens with it; asserted below before cleanup.
    await pool.query('DELETE FROM users WHERE id = $1', [userId]);
    await pool.end();
  });

  beforeEach(async () => {
    if (dbUp && userId) await pool.query('DELETE FROM mcp_tokens WHERE user_id = $1', [userId]);
  });

  test('ensureSchema creates the table and its indexes', async (t) => {
    if (!dbUp) return t.skip('no database');
    const tbl = await pool.query(
      `SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='mcp_tokens'`
    );
    assert.strictEqual(tbl.rows.length, 1);
    const idx = await pool.query(`SELECT indexname FROM pg_indexes WHERE tablename='mcp_tokens'`);
    const names = idx.rows.map((r) => r.indexname);
    assert.ok(names.includes('idx_mcp_tokens_hash'), `missing hash index in ${names}`);
    assert.ok(names.includes('idx_mcp_tokens_user'), `missing user index in ${names}`);
  });

  test('ensureSchema is idempotent, so a redeploy cannot break', async (t) => {
    if (!dbUp) return t.skip('no database');
    McpToken._schemaEnsured = false;
    await McpToken.ensureSchema();
    McpToken._schemaEnsured = false;
    await McpToken.ensureSchema(); // must not throw on an existing table
    assert.strictEqual(McpToken._schemaEnsured, true);
  });

  test('stores only the hash -- the plaintext never reaches the database', async (t) => {
    if (!dbUp) return t.skip('no database');
    const { plaintext } = await McpToken.create({ userId, name: 'laptop', scopes: ['picks:read'] });
    const { rows } = await pool.query('SELECT token_hash FROM mcp_tokens WHERE user_id=$1', [userId]);
    assert.strictEqual(rows.length, 1);
    assert.notStrictEqual(rows[0].token_hash, plaintext);
    assert.strictEqual(rows[0].token_hash, McpToken.hash(plaintext));
    // Belt and braces: the secret must not appear anywhere in the row.
    const all = await pool.query('SELECT * FROM mcp_tokens WHERE user_id=$1', [userId]);
    assert.ok(!JSON.stringify(all.rows).includes(plaintext));
  });

  test('round-trips a live token and rejects a near-miss', async (t) => {
    if (!dbUp) return t.skip('no database');
    const { plaintext } = await McpToken.create({ userId, name: 'cli', scopes: ['picks:read', 'picks:write'] });
    const found = await McpToken.findByPlaintext(plaintext);
    assert.strictEqual(found.userId, userId);
    assert.deepStrictEqual(found.scopes, ['picks:read', 'picks:write']);
    // One character off must not authenticate.
    assert.strictEqual(await McpToken.findByPlaintext(plaintext.slice(0, -1) + 'X'), null);
  });

  test('a revoked token stops authenticating', async (t) => {
    if (!dbUp) return t.skip('no database');
    const { plaintext, token } = await McpToken.create({ userId, name: 'revoke-me', scopes: ['picks:read'] });
    assert.ok(await McpToken.findByPlaintext(plaintext));
    assert.strictEqual(await McpToken.revoke(token.id, userId), true);
    assert.strictEqual(await McpToken.findByPlaintext(plaintext), null);
    assert.strictEqual(await McpToken.revoke(token.id, userId), false, 'revoking twice is a no-op');
  });

  test('another user cannot revoke your token', async (t) => {
    if (!dbUp) return t.skip('no database');
    const { plaintext, token } = await McpToken.create({ userId, name: 'mine', scopes: ['picks:read'] });
    assert.strictEqual(await McpToken.revoke(token.id, userId + 99999), false);
    assert.ok(await McpToken.findByPlaintext(plaintext), 'the token must still work');
  });

  test('an expired token stops authenticating', async (t) => {
    if (!dbUp) return t.skip('no database');
    const { plaintext } = await McpToken.create({ userId, name: 'short', scopes: ['picks:read'] });
    await pool.query(`UPDATE mcp_tokens SET expires_at = NOW() - INTERVAL '1 second' WHERE user_id=$1`, [userId]);
    assert.strictEqual(await McpToken.findByPlaintext(plaintext), null);
  });

  test('listForUser hides revoked tokens', async (t) => {
    if (!dbUp) return t.skip('no database');
    const a = await McpToken.create({ userId, name: 'keep', scopes: ['picks:read'] });
    const b = await McpToken.create({ userId, name: 'drop', scopes: ['picks:read'] });
    await McpToken.revoke(b.token.id, userId);
    const list = await McpToken.listForUser(userId);
    assert.deepStrictEqual(list.map((t2) => t2.name), ['keep']);
    assert.ok(!JSON.stringify(list).includes(a.plaintext));
  });

  test('touch records last use', async (t) => {
    if (!dbUp) return t.skip('no database');
    const { token } = await McpToken.create({ userId, name: 'touched', scopes: ['picks:read'] });
    assert.strictEqual(token.lastUsedAt, null);
    await McpToken.touch(token.id);
    const { rows } = await pool.query('SELECT last_used_at FROM mcp_tokens WHERE id=$1', [token.id]);
    assert.ok(rows[0].last_used_at instanceof Date);
  });

  test('deleting the user cascades the tokens away', async (t) => {
    if (!dbUp) return t.skip('no database');
    const { rows: u } = await pool.query(
      `INSERT INTO users (email, name, provider, google_id) VALUES ($1,$2,'google',$3) RETURNING id`,
      [`mcp-cascade-${Date.now()}@test.local`, 'Cascade', `casc-${Date.now()}`]
    );
    const doomed = u[0].id;
    await McpToken.create({ userId: doomed, name: 'orphan', scopes: ['picks:read'] });
    await pool.query('DELETE FROM users WHERE id=$1', [doomed]);
    const { rows } = await pool.query('SELECT 1 FROM mcp_tokens WHERE user_id=$1', [doomed]);
    assert.strictEqual(rows.length, 0, 'tokens must not outlive their owner');
  });
});
