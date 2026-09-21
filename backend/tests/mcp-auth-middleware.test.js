import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import { mcpTokenExchange, matchPolicy, checkRateLimit, _resetRateLimit, MCP_ROUTE_POLICY } from '../src/middleware/mcpAuth.js';
import { McpToken } from '../src/models/McpToken.js';
import { User } from '../src/models/User.js';
import { AuthService } from '../src/services/AuthService.js';

// The MCP edge guard is the whole security boundary for phase 1, so these cases
// are written adversarially: every one of them is a way an agent could try to
// reach something it should not.

const TOKEN = 'cp_live_' + 'a'.repeat(43);

describe('MCP route policy', () => {
  test('permits exactly the read and pick-write surface', () => {
    assert.ok(matchPolicy('GET', '/groups/my-groups'));
    assert.ok(matchPolicy('GET', '/groups/okun-family-picks'));
    assert.ok(matchPolicy('GET', '/groups/okun-family-picks/scoreboard'));
    assert.ok(matchPolicy('GET', '/groups/okun-family-picks/picks/me'));
    assert.ok(matchPolicy('POST', '/groups/okun-family-picks/picks'));
    assert.ok(matchPolicy('POST', '/groups/okun-family-picks/picks/clear'));
    assert.ok(matchPolicy('GET', '/games/2026/2/1'));
  });

  test('denies every destructive or out-of-scope endpoint', () => {
    // If any of these ever start matching, an agent gained a capability the
    // design explicitly withholds.
    const forbidden = [
      ['DELETE', '/groups/okun-family-picks'],
      ['PUT', '/groups/okun-family-picks'],
      ['POST', '/groups/okun-family-picks/leave'],
      ['POST', '/groups/okun-family-picks/join'],
      ['POST', '/groups'],
      ['GET', '/groups/okun-family-picks/messages'],
      ['POST', '/groups/okun-family-picks/messages'],
      ['POST', '/groups/okun-family-picks/invites'],
      ['POST', '/groups/okun-family-picks/picks/user/9'],
      ['GET', '/groups/okun-family-picks/picks/user/9'],
      ['GET', '/mcp/tokens'],
      ['POST', '/mcp/tokens'],
      ['DELETE', '/mcp/tokens/1']
    ];
    for (const [m, p] of forbidden) {
      assert.strictEqual(matchPolicy(m, p), null, `${m} ${p} must be denied`);
    }
  });

  // Dues were withheld entirely in phase 1. They are now reachable, but only
  // through these two routes and only with the opt-in dues:write scope. Whether
  // the caller is an ADMIN of the group is not this layer's question -- the
  // routes enforce that against the token owner's real role.
  test('permits the dues write surface, and only under dues:write', () => {
    const mark = matchPolicy('POST', '/groups/okun-family-picks/members/3/dues');
    const settings = matchPolicy('PUT', '/groups/okun-family-picks/dues');
    assert.strictEqual(mark?.scope, 'dues:write');
    assert.strictEqual(settings?.scope, 'dues:write');
  });

  test('the general settings route stays denied now that dues has its own', () => {
    // PUT /groups/:id also renames the group, flips is_public and changes the
    // member limit. Dues settings moved to PUT /groups/:id/dues precisely so
    // this never has to be allowlisted.
    assert.strictEqual(matchPolicy('PUT', '/groups/okun-family-picks'), null);
    assert.strictEqual(matchPolicy('PUT', '/groups/okun-family-picks/'), null);
    // Neighbouring shapes must not ride in on the dues patterns.
    assert.strictEqual(matchPolicy('DELETE', '/groups/g/dues'), null);
    assert.strictEqual(matchPolicy('POST', '/groups/g/dues'), null);
    assert.strictEqual(matchPolicy('PUT', '/groups/g/members/3/dues'), null);
    assert.strictEqual(matchPolicy('POST', '/groups/g/members/3/dues/extra'), null);
    assert.strictEqual(matchPolicy('POST', '/groups/g/members/3'), null);
  });

  test('admin pick-override is not reachable through the broader picks pattern', () => {
    // /groups/:id/picks is allowed; /groups/:id/picks/user/:userId must not be
    // swallowed by it, because that route edits another member's picks.
    assert.strictEqual(matchPolicy('POST', '/groups/g/picks/user/4'), null);
  });

  test('every policy entry names a real scope or is explicitly public', () => {
    for (const r of MCP_ROUTE_POLICY) {
      assert.ok(r.scope === null || ['groups:read', 'picks:read', 'picks:write', 'dues:write'].includes(r.scope));
    }
  });
});

describe('rate limiter', () => {
  beforeEach(() => _resetRateLimit());

  test('allows a normal burst then blocks a runaway loop', () => {
    for (let i = 0; i < 120; i++) {
      assert.strictEqual(checkRateLimit('tok').allowed, true, `call ${i} should pass`);
    }
    const blocked = checkRateLimit('tok');
    assert.strictEqual(blocked.allowed, false);
    assert.ok(blocked.retryAfter > 0);
  });

  test('windows are per token, not global', () => {
    for (let i = 0; i < 121; i++) checkRateLimit('noisy');
    assert.strictEqual(checkRateLimit('quiet').allowed, true);
  });

  test('the window rolls over', () => {
    const t0 = 1_000_000;
    for (let i = 0; i < 121; i++) checkRateLimit('t', t0);
    assert.strictEqual(checkRateLimit('t', t0).allowed, false);
    assert.strictEqual(checkRateLimit('t', t0 + 60_001).allowed, true);
  });
});

describe('mcpTokenExchange middleware', () => {
  let server, baseURL, seenAuthHeader;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api', mcpTokenExchange);
    // Stand-in for the real routers: records what the exchange handed downstream.
    app.all('/api/*', (req, res) => {
      seenAuthHeader = req.headers['authorization'];
      res.json({ reached: true, auth: seenAuthHeader, mcp: req.mcpToken || null });
    });
    await new Promise((r) => { server = app.listen(0, () => { baseURL = `http://localhost:${server.address().port}`; r(); }); });
  });
  after(async () => { await new Promise((r) => server.close(r)); });

  beforeEach(() => { _resetRateLimit(); seenAuthHeader = undefined; });
  afterEach(() => mock.restoreAll());

  const live = (scopes) => mock.method(McpToken, 'findByPlaintext', async () => ({ id: 1, userId: 7, scopes }));

  // THE regression guard for the whole PR: anything that is not an MCP token
  // must pass through completely untouched, so web sessions cannot regress.
  test('is a no-op for a request with no Authorization header', async () => {
    const q = mock.method(McpToken, 'findByPlaintext', async () => { throw new Error('must not be called'); });
    const res = await fetch(`${baseURL}/api/groups/my-groups`);
    assert.strictEqual(res.status, 200);
    assert.strictEqual(q.mock.calls.length, 0);
  });

  test('is a no-op for an ordinary JWT bearer, leaving the header byte-identical', async () => {
    const q = mock.method(McpToken, 'findByPlaintext', async () => { throw new Error('must not be called'); });
    const jwt = 'Bearer eyJhbGciOiJIUzI1NiJ9.payload.sig';
    const res = await fetch(`${baseURL}/api/groups/my-groups`, { headers: { Authorization: jwt } });
    const body = await res.json();
    assert.strictEqual(body.auth, jwt, 'an existing session header must not be rewritten');
    assert.strictEqual(q.mock.calls.length, 0, 'MCP lookup must not run for JWT callers');
  });

  test('401s an unknown, revoked or expired token', async () => {
    mock.method(McpToken, 'findByPlaintext', async () => null);
    const res = await fetch(`${baseURL}/api/groups/my-groups`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.strictEqual(res.status, 401);
  });

  test('403s a denied endpoint even when the token is valid and fully scoped', async () => {
    live(['groups:read', 'picks:read', 'picks:write']);
    const res = await fetch(`${baseURL}/api/groups/okun-family-picks`, { method: 'DELETE', headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.strictEqual(res.status, 403);
    assert.strictEqual(seenAuthHeader, undefined, 'the request must never reach the router');
  });

  // A phase-1 token holds every phase-1 scope and must still be unable to touch
  // dues: the scope is opt-in, never implied.
  test('403s a dues write from a token without dues:write', async () => {
    live(['groups:read', 'picks:read', 'picks:write']);
    for (const [method, path] of [['POST', '/api/groups/g/members/3/dues'], ['PUT', '/api/groups/g/dues']]) {
      seenAuthHeader = undefined;
      const res = await fetch(`${baseURL}${path}`, { method, headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: '{}' });
      assert.strictEqual(res.status, 403, `${method} ${path}`);
      assert.strictEqual((await res.json()).required, 'dues:write');
      assert.strictEqual(seenAuthHeader, undefined, 'the request must never reach the router');
    }
  });

  test('lets a dues write through with dues:write, tagged as an MCP request', async () => {
    live(['groups:read', 'dues:write']);
    mock.method(User, 'findById', async () => ({ id: 7, email: 'u@x.io', name: 'U' }));
    mock.method(AuthService, 'generateAccessToken', () => 'minted.jwt');
    const res = await fetch(`${baseURL}/api/groups/g/members/3/dues`, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: '{"paid":true}' });
    assert.strictEqual(res.status, 200);
    const body = await res.json();
    // req.mcpToken is what the dues route keys `via: 'mcp'` off.
    assert.ok(body.mcp, 'downstream must be able to tell this came through a token');
  });

  test('403s when the route needs a scope the token lacks', async () => {
    live(['picks:read']);
    const res = await fetch(`${baseURL}/api/groups/g/picks`, {
      method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: '{}'
    });
    assert.strictEqual(res.status, 403);
    const body = await res.json();
    assert.strictEqual(body.required, 'picks:write');
  });

  test('exchanges a permitted call for a real access JWT', async () => {
    live(['picks:write']);
    mock.method(User, 'findById', async () => ({ id: 7, email: 'a@b.co', name: 'Tester' }));
    const res = await fetch(`${baseURL}/api/groups/g/picks`, {
      method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' }, body: '{}'
    });
    const body = await res.json();
    assert.strictEqual(res.status, 200);
    assert.ok(body.auth.startsWith('Bearer '));
    assert.ok(!body.auth.includes('cp_live_'), 'the opaque token must not leak downstream');
    // The minted credential must be a JWT the existing middleware would accept.
    const decoded = AuthService.verifyAccessToken(body.auth.split(' ')[1]);
    assert.strictEqual(decoded.userId, 7);
    assert.deepStrictEqual(body.mcp.scopes, ['picks:write']);
  });

  test('401s when the token maps to a user that no longer exists', async () => {
    live(['groups:read']);
    mock.method(User, 'findById', async () => null);
    const res = await fetch(`${baseURL}/api/groups/my-groups`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.strictEqual(res.status, 401);
  });

  test('429s a runaway agent and sets Retry-After', async () => {
    live(['groups:read']);
    mock.method(User, 'findById', async () => ({ id: 7, email: 'a@b.co', name: 'T' }));
    let last;
    for (let i = 0; i < 121; i++) {
      last = await fetch(`${baseURL}/api/groups/my-groups`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    }
    assert.strictEqual(last.status, 429);
    assert.ok(last.headers.get('retry-after'));
  });

  test('500s rather than falling open when the token store errors', async () => {
    mock.method(McpToken, 'findByPlaintext', async () => { throw new Error('db down'); });
    const res = await fetch(`${baseURL}/api/groups/my-groups`, { headers: { Authorization: `Bearer ${TOKEN}` } });
    assert.strictEqual(res.status, 500);
    assert.strictEqual(seenAuthHeader, undefined, 'a failure must not reach the router');
  });
});
