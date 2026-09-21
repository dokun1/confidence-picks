import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { McpToken, MCP_SCOPES } from '../src/models/McpToken.js';
import pool from '../src/config/database.js';

// Model-level behaviour with the pool stubbed, mirroring
// dues-schema-selfheal.test.js. Real-SQL coverage lives in the L3 docker run;
// these cases pin the logic that must hold regardless of the database.

describe('McpToken', () => {
  beforeEach(() => {
    McpToken._schemaEnsured = true; // skip the ensure query unless a case unlatches
  });
  afterEach(() => {
    mock.restoreAll();
    McpToken._schemaEnsured = false;
  });

  describe('token format', () => {
    test('mints a prefixed, high-entropy token', () => {
      const a = McpToken.generatePlaintext();
      const b = McpToken.generatePlaintext();
      assert.ok(a.startsWith('cp_live_'));
      assert.notStrictEqual(a, b, 'two mints must never collide');
      assert.ok(a.length > 40);
    });

    test('hash is stable, and is not the plaintext', () => {
      const p = McpToken.generatePlaintext();
      assert.strictEqual(McpToken.hash(p), McpToken.hash(p));
      assert.notStrictEqual(McpToken.hash(p), p);
      assert.strictEqual(McpToken.hash(p).length, 64);
    });

    test('rejects malformed candidates without touching the database', async () => {
      const q = mock.method(pool, 'query', async () => ({ rows: [] }));
      for (const bad of ['', null, undefined, 'Bearer x', 'cp_live_', 'eyJhbGciOi.x.y', 'cp_test_abc']) {
        assert.strictEqual(await McpToken.findByPlaintext(bad), null);
      }
      assert.strictEqual(q.mock.calls.length, 0, 'malformed input must short-circuit before SQL');
    });
  });

  describe('scope validation', () => {
    test('accepts the known scopes and de-duplicates', () => {
      assert.deepStrictEqual(McpToken.validateScopes(['picks:read', 'picks:read']), ['picks:read']);
      assert.deepStrictEqual(McpToken.validateScopes(MCP_SCOPES), MCP_SCOPES);
    });

    test('dues:write is a real scope, and the only dues scope', () => {
      assert.ok(MCP_SCOPES.includes('dues:write'));
      assert.deepStrictEqual(McpToken.validateScopes(['groups:read', 'dues:write']), ['groups:read', 'dues:write']);
      assert.strictEqual(McpToken.validateScopes(['dues:read']), null);
      assert.strictEqual(McpToken.validateScopes(['dues:admin']), null);
    });

    test('rejects unknown, empty, and non-array scopes', () => {
      // The destructive scopes deliberately do not exist -- asking for one is an error.
      assert.strictEqual(McpToken.validateScopes(['groups:admin']), null);
      assert.strictEqual(McpToken.validateScopes(['picks:read', 'groups:delete']), null);
      assert.strictEqual(McpToken.validateScopes([]), null);
      assert.strictEqual(McpToken.validateScopes('picks:read'), null);
      assert.strictEqual(McpToken.validateScopes(null), null);
    });
  });

  describe('findByPlaintext fails closed', () => {
    // Postgres now evaluates revocation and expiry (see McpToken.findByPlaintext
    // -- comparing a `timestamp without time zone` against Date.now() shifted the
    // deadline by the host's UTC offset), so the stub returns the flags the query
    // computes rather than raw timestamps for the model to interpret.
    const row = (over = {}) => ({
      rows: [{
        id: 1, user_id: 7, name: 'laptop', scopes: ['picks:read'],
        created_at: new Date(), last_used_at: null,
        expires_at: new Date(Date.now() + 86400000), revoked_at: null,
        is_revoked: false, is_expired: false,
        ...over
      }]
    });

    test('resolves a live token to its owner', async () => {
      mock.method(pool, 'query', async () => row());
      const t = await McpToken.findByPlaintext('cp_live_' + 'a'.repeat(43));
      assert.strictEqual(t.userId, 7);
      assert.deepStrictEqual(t.scopes, ['picks:read']);
    });

    test('returns null for a revoked token', async () => {
      mock.method(pool, 'query', async () => row({ revoked_at: new Date(), is_revoked: true }));
      assert.strictEqual(await McpToken.findByPlaintext('cp_live_' + 'a'.repeat(43)), null);
    });

    test('returns null for an expired token', async () => {
      mock.method(pool, 'query', async () => row({ expires_at: new Date(Date.now() - 1000), is_expired: true }));
      assert.strictEqual(await McpToken.findByPlaintext('cp_live_' + 'a'.repeat(43)), null);
    });

    test('asks Postgres to evaluate revocation and expiry', async () => {
      let sql;
      mock.method(pool, 'query', async (q) => { sql = q; return row(); });
      await McpToken.findByPlaintext('cp_live_' + 'a'.repeat(43));
      assert.match(sql, /is_revoked/, 'revocation must be computed in SQL');
      assert.match(sql, /expires_at <= NOW\(\)/, 'expiry must be compared by the database clock');
    });

    test('returns null when no row matches', async () => {
      mock.method(pool, 'query', async () => ({ rows: [] }));
      assert.strictEqual(await McpToken.findByPlaintext('cp_live_' + 'a'.repeat(43)), null);
    });
  });

  describe('create', () => {
    test('stores only the hash, and returns the plaintext exactly once', async () => {
      let captured;
      mock.method(pool, 'query', async (_sql, params) => {
        captured = params;
        return { rows: [{ id: 3, name: 'cli', scopes: ['picks:write'], created_at: new Date(), last_used_at: null, expires_at: new Date(), revoked_at: null }] };
      });
      const { plaintext, token } = await McpToken.create({ userId: 7, name: 'cli', scopes: ['picks:write'] });
      assert.ok(plaintext.startsWith('cp_live_'));
      assert.strictEqual(captured[2], McpToken.hash(plaintext), 'the hash, not the token, is persisted');
      assert.ok(!captured.includes(plaintext), 'plaintext must never reach the database');
      assert.strictEqual(token.id, 3);
      assert.strictEqual(token.plaintext, undefined, 'the returned record carries no secret');
    });

    test('clamps an absurd expiry to one year', async () => {
      let captured;
      mock.method(pool, 'query', async (_sql, params) => {
        captured = params;
        return { rows: [{ id: 1, name: 'x', scopes: [], created_at: new Date(), last_used_at: null, expires_at: new Date(), revoked_at: null }] };
      });
      await McpToken.create({ userId: 1, name: 'x', scopes: ['picks:read'], expiresInDays: 99999 });
      assert.strictEqual(captured[4], '365');
    });
  });

  describe('revoke', () => {
    test('is scoped to the owner so one user cannot revoke another"s token', async () => {
      let captured;
      mock.method(pool, 'query', async (_sql, params) => { captured = params; return { rows: [{ id: 5 }] }; });
      assert.strictEqual(await McpToken.revoke(5, 7), true);
      assert.deepStrictEqual(captured, [5, 7], 'user_id must be part of the predicate');
    });

    test('reports false when nothing was revoked', async () => {
      mock.method(pool, 'query', async () => ({ rows: [] }));
      assert.strictEqual(await McpToken.revoke(5, 999), false);
    });
  });
});

describe('mcp schema self-heal', () => {
  afterEach(() => { mock.restoreAll(); McpToken._schemaEnsured = false; });

  test('creates the table on first use, then latches to a zero-query fast path', async () => {
    McpToken._schemaEnsured = false;
    const q = mock.method(pool, 'query', async () => ({ rows: [] }));
    await McpToken.ensureSchema();
    const afterFirst = q.mock.calls.length;
    assert.ok(afterFirst >= 1, 'first call must issue DDL');
    assert.strictEqual(McpToken._schemaEnsured, true);
    await McpToken.ensureSchema();
    assert.strictEqual(q.mock.calls.length, afterFirst, 'second call must issue no queries');
  });

  test('does not latch on failure, so the next call retries', async () => {
    McpToken._schemaEnsured = false;
    mock.method(pool, 'query', async () => { throw new Error('connection reset'); });
    await assert.rejects(() => McpToken.ensureSchema());
    assert.strictEqual(McpToken._schemaEnsured, false, 'a transient error must remain retryable');
  });

  test('listForUser ensures the table before querying', async () => {
    McpToken._schemaEnsured = false;
    const calls = [];
    mock.method(pool, 'query', async (sql) => { calls.push(sql); return { rows: [] }; });
    await McpToken.listForUser(1);
    assert.ok(/CREATE TABLE/i.test(calls[0]), 'the guard must run before the read');
  });
});
