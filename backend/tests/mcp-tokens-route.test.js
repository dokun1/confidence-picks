import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import mcpTokensRouter from '../src/routes/mcpTokens.js';
import { McpToken } from '../src/models/McpToken.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';

// Token management is a web-session-only surface. These cases pin the
// validation and the ownership gating; that MCP tokens cannot reach these
// routes at all is proven in mcp-auth-middleware.test.js.

const AUTH = { Authorization: 'Bearer session-jwt', 'Content-Type': 'application/json' };

describe('mcp token routes', () => {
  let server, baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/mcp', mcpTokensRouter);
    await new Promise((r) => { server = app.listen(0, () => { baseURL = `http://localhost:${server.address().port}`; r(); }); });
  });
  after(async () => { await new Promise((r) => server.close(r)); });

  beforeEach(() => {
    mock.method(AuthService, 'verifyAccessToken', () => ({ userId: 1 }));
    mock.method(User, 'findById', async () => ({ id: 1, name: 'Tester', email: 't@x.io' }));
  });
  afterEach(() => mock.restoreAll());

  test('advertises the available scopes without requiring auth', async () => {
    const res = await fetch(`${baseURL}/api/mcp/scopes`);
    const body = await res.json();
    assert.deepStrictEqual(body.scopes, ['groups:read', 'picks:read', 'picks:write', 'dues:write']);
  });

  test('requires a session to list tokens', async () => {
    const res = await fetch(`${baseURL}/api/mcp/tokens`);
    assert.strictEqual(res.status, 401);
  });

  test('lists only the caller"s tokens and never a secret', async () => {
    mock.method(McpToken, 'listForUser', async (uid) => {
      assert.strictEqual(uid, 1);
      return [{ id: 2, name: 'laptop', scopes: ['picks:read'], createdAt: new Date(), lastUsedAt: null, expiresAt: new Date(), revokedAt: null }];
    });
    const res = await fetch(`${baseURL}/api/mcp/tokens`, { headers: AUTH });
    const body = await res.json();
    assert.strictEqual(body.tokens.length, 1);
    assert.ok(!JSON.stringify(body).includes('cp_live_'), 'a listing must never expose token material');
  });

  test('mints a token and returns the plaintext exactly once', async () => {
    mock.method(McpToken, 'create', async ({ userId, name, scopes }) => {
      assert.strictEqual(userId, 1);
      assert.strictEqual(name, 'My laptop');
      assert.deepStrictEqual(scopes, ['picks:read', 'picks:write']);
      return { plaintext: 'cp_live_secret', token: { id: 4, name, scopes } };
    });
    const res = await fetch(`${baseURL}/api/mcp/tokens`, {
      method: 'POST', headers: AUTH,
      body: JSON.stringify({ name: '  My laptop  ', scopes: ['picks:read', 'picks:write'] })
    });
    assert.strictEqual(res.status, 201);
    const body = await res.json();
    assert.strictEqual(body.plaintext, 'cp_live_secret');
    assert.strictEqual(body.token.id, 4);
  });

  test('rejects a missing or oversized name', async () => {
    for (const name of [undefined, '', '   ', 'x'.repeat(65)]) {
      const res = await fetch(`${baseURL}/api/mcp/tokens`, {
        method: 'POST', headers: AUTH, body: JSON.stringify({ name, scopes: ['picks:read'] })
      });
      assert.strictEqual(res.status, 400, `name ${JSON.stringify(name)} must be rejected`);
    }
  });

  test('rejects an attempt to grant a scope that does not exist', async () => {
    const created = mock.method(McpToken, 'create', async () => { throw new Error('must not be reached'); });
    const res = await fetch(`${baseURL}/api/mcp/tokens`, {
      method: 'POST', headers: AUTH, body: JSON.stringify({ name: 'sneaky', scopes: ['groups:admin'] })
    });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(created.mock.calls.length, 0);
  });

  test('revokes a token the caller owns', async () => {
    mock.method(McpToken, 'revoke', async (id, uid) => { assert.deepStrictEqual([id, uid], [9, 1]); return true; });
    const res = await fetch(`${baseURL}/api/mcp/tokens/9`, { method: 'DELETE', headers: AUTH });
    assert.strictEqual(res.status, 200);
  });

  test('404s revoking a token belonging to someone else', async () => {
    mock.method(McpToken, 'revoke', async () => false);
    const res = await fetch(`${baseURL}/api/mcp/tokens/9`, { method: 'DELETE', headers: AUTH });
    assert.strictEqual(res.status, 404);
  });

  test('400s a non-numeric token id', async () => {
    const res = await fetch(`${baseURL}/api/mcp/tokens/abc`, { method: 'DELETE', headers: AUTH });
    assert.strictEqual(res.status, 400);
  });
});
