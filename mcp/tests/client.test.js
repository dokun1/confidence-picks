import { test, describe } from 'node:test';
import assert from 'node:assert';
import { ConfidencePicksClient } from '../src/client.js';
import { TOOLS, dispatch } from '../src/stdio.js';

describe('ConfidencePicksClient', () => {
  const ok = (body) => async () => ({ ok: true, status: 200, json: async () => body });

  test('refuses to start without a token', () => {
    assert.throws(() => new ConfidencePicksClient({ token: null }), /CONFIDENCE_PICKS_TOKEN/);
  });

  test('defaults to production and strips a trailing slash', () => {
    assert.strictEqual(new ConfidencePicksClient({ token: 't' }).baseUrl, 'https://api.confidence-picks.com');
    assert.strictEqual(new ConfidencePicksClient({ token: 't', baseUrl: 'http://localhost:3001/' }).baseUrl, 'http://localhost:3001');
  });

  test('sends the token as a bearer credential', async () => {
    let seen;
    const c = new ConfidencePicksClient({ token: 'cp_live_x', fetchImpl: async (_u, o) => { seen = o; return { ok: true, status: 200, json: async () => ({}) }; } });
    await c.get('/api/groups/my-groups');
    assert.strictEqual(seen.headers.Authorization, 'Bearer cp_live_x');
  });

  test('sets a JSON content type only when there is a body', async () => {
    let seen;
    const c = new ConfidencePicksClient({ token: 't', fetchImpl: async (_u, o) => { seen = o; return { ok: true, status: 200, json: async () => ({}) }; } });
    await c.get('/x');
    assert.strictEqual(seen.headers['Content-Type'], undefined);
    await c.post('/x', { a: 1 });
    assert.strictEqual(seen.headers['Content-Type'], 'application/json');
    assert.strictEqual(seen.body, '{"a":1}');
  });

  // A model can only recover from a failure it understands, so each status the
  // API actually uses becomes an actionable sentence.
  for (const [status, pattern] of [[401, /revoked or expired/], [403, /scope/], [409, /kicked off/], [429, /Rate limited/]]) {
    test(`translates ${status} into guidance`, async () => {
      const c = new ConfidencePicksClient({
        token: 't',
        fetchImpl: async () => ({ ok: false, status, json: async () => ({ error: 'x' }) })
      });
      await assert.rejects(() => c.get('/x'), pattern);
    });
  }

  test('survives a non-JSON error body', async () => {
    const c = new ConfidencePicksClient({
      token: 't',
      fetchImpl: async () => ({ ok: false, status: 502, json: async () => { throw new Error('not json'); } })
    });
    await assert.rejects(() => c.get('/x'), /502/);
  });

  test('handles a 204 with no body', async () => {
    const c = new ConfidencePicksClient({ token: 't', fetchImpl: async () => ({ ok: true, status: 204 }) });
    assert.strictEqual(await c.get('/x'), null);
  });
});

describe('tool surface', () => {
  test('exposes exactly the five phase-1 tools', () => {
    assert.deepStrictEqual(TOOLS.map((t) => t.name).sort(), ['get_my_picks', 'get_slate', 'get_standings', 'list_groups', 'submit_week']);
  });

  test('every tool declares a description and an object schema', () => {
    for (const t of TOOLS) {
      assert.ok(t.description && t.description.length > 20, `${t.name} needs a usable description`);
      assert.strictEqual(t.inputSchema.type, 'object');
    }
  });

  test('no tool offers a destructive capability', () => {
    // The scope model withholds these; the tool surface must not advertise them.
    const blob = JSON.stringify(TOOLS).toLowerCase();
    for (const word of ['delete', 'leave_group', 'remove_member', 'dues']) {
      assert.ok(!blob.includes(word), `tool surface must not mention ${word}`);
    }
  });

  test('rejects an unknown tool name', async () => {
    await assert.rejects(() => dispatch('drop_database', {}, {}), /Unknown tool/);
  });

  test('routes each tool to the API path it belongs to', async () => {
    const calls = [];
    const c = { get: async (p) => { calls.push(p); return { picks: [], games: [] }; }, post: async (p) => { calls.push(p); return {}; } };
    await dispatch('list_groups', {}, c);
    await dispatch('get_slate', { season: 2026, week: 1 }, c);
    await dispatch('get_my_picks', { group: 'g', season: 2026, week: 1 }, c);
    await dispatch('get_standings', { group: 'g', season: 2026 }, c);
    assert.deepStrictEqual(calls, [
      '/api/groups/my-groups',
      '/api/games/2026/2/1',
      '/api/groups/g/picks/me?season=2026&seasonType=2&week=1',
      '/api/groups/g/scoreboard?season=2026&seasonType=2'
    ]);
  });
});

// A deadline user cannot act on "Duplicate confidence". These assert the error
// text names the value and the two games, which is the difference between a
// self-correctable mistake and a lost week.
describe('ConfidencePicksClient: actionable write errors', () => {
  const fail = (status, body) => async () => ({ ok: false, status, json: async () => body });

  test('a duplicate-confidence 400 names the value and both games', async () => {
    const c = new ConfidencePicksClient({
      token: 't',
      fetchImpl: fail(400, { error: 'Duplicate confidence', confidence: 3, gameIds: [126875, 126882] })
    });
    await assert.rejects(() => c.post('/x', {}), (e) => {
      assert.match(e.message, /Duplicate confidence 3/);
      assert.match(e.message, /126875 and 126882/);
      return true;
    });
  });

  test('an out-of-range 400 names the bound it broke', async () => {
    const c = new ConfidencePicksClient({
      token: 't',
      fetchImpl: fail(400, { error: 'Confidence out of range', gameId: 126882, confidence: 17, min: 1, max: 16 })
    });
    await assert.rejects(() => c.post('/x', {}), (e) => {
      assert.match(e.message, /Confidence 17 is out of range for game 126882/);
      assert.match(e.message, /allowed 1\.\.16/);
      return true;
    });
  });

  test('an idempotency key rides along on the request headers', async () => {
    let seen;
    const c = new ConfidencePicksClient({
      token: 't',
      fetchImpl: async (_u, o) => { seen = o; return { ok: true, status: 200, json: async () => ({}) }; }
    });
    await c.post('/x', { a: 1 }, { 'Idempotency-Key': 'k-123' });
    assert.strictEqual(seen.headers['Idempotency-Key'], 'k-123');
    assert.strictEqual(seen.headers.Authorization, 'Bearer t');
  });
});
