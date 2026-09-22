import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import adminPortalRouter from '../src/routes/adminPortal.js';
import { matchPolicy } from '../src/middleware/mcpAuth.js';

// The admin portal (admin.confidence-picks.com) asks this endpoint, at Google
// sign-in time, whether the authenticated email may enter. The portal is the
// only caller and proves itself with ADMIN_API_SECRET. Every branch here must
// fail CLOSED: an unset secret, an unset allowlist, or a mismatch each has to
// mean "nobody gets in", never "everybody does".

const SECRET = 's3cret-' + 'x'.repeat(40);

describe('GET /api/admin-portal/allowlist/check', () => {
  let server, baseURL, savedEnv;

  before(async () => {
    const app = express();
    app.use('/api', adminPortalRouter);
    await new Promise((r) => { server = app.listen(0, () => { baseURL = `http://localhost:${server.address().port}`; r(); }); });
  });
  after(async () => { await new Promise((r) => server.close(r)); });

  beforeEach(() => {
    savedEnv = { secret: process.env.ADMIN_API_SECRET, emails: process.env.ADMIN_EMAILS };
    process.env.ADMIN_API_SECRET = SECRET;
    process.env.ADMIN_EMAILS = 'Owner@Example.com, second@example.com';
  });
  afterEach(() => {
    if (savedEnv.secret === undefined) delete process.env.ADMIN_API_SECRET; else process.env.ADMIN_API_SECRET = savedEnv.secret;
    if (savedEnv.emails === undefined) delete process.env.ADMIN_EMAILS; else process.env.ADMIN_EMAILS = savedEnv.emails;
  });

  const check = (email, auth = `Bearer ${SECRET}`) =>
    fetch(`${baseURL}/api/admin-portal/allowlist/check?email=${encodeURIComponent(email)}`, { headers: auth ? { Authorization: auth } : {} });

  test('allows a listed email, case-insensitively', async () => {
    const res = await check('owner@example.com');
    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { allowed: true });
    assert.deepStrictEqual(await (await check('SECOND@EXAMPLE.COM')).json(), { allowed: true });
  });

  test('denies an unlisted email', async () => {
    assert.deepStrictEqual(await (await check('member@example.com')).json(), { allowed: false });
  });

  test('denies an empty email', async () => {
    assert.deepStrictEqual(await (await check('')).json(), { allowed: false });
  });

  test('denies everyone when ADMIN_EMAILS is unset or blank', async () => {
    delete process.env.ADMIN_EMAILS;
    assert.deepStrictEqual(await (await check('owner@example.com')).json(), { allowed: false });
    process.env.ADMIN_EMAILS = ' , ';
    assert.deepStrictEqual(await (await check('owner@example.com')).json(), { allowed: false });
  });

  test('401s a missing, malformed or wrong secret', async () => {
    for (const auth of [null, 'Bearer ', `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(0, -1)}`, SECRET, `Basic ${SECRET}`]) {
      const res = await check('owner@example.com', auth);
      assert.strictEqual(res.status, 401, `expected 401 for ${JSON.stringify(auth)}`);
    }
  });

  // Unset secret = inert surface (401), NOT open, and NOT hidden (404).
  test('401s everything when ADMIN_API_SECRET is unset or empty', async () => {
    delete process.env.ADMIN_API_SECRET;
    assert.strictEqual((await check('owner@example.com')).status, 401);
    process.env.ADMIN_API_SECRET = '';
    assert.strictEqual((await check('owner@example.com', 'Bearer ')).status, 401);
  });

  test('is unreachable through an MCP token', () => {
    assert.strictEqual(matchPolicy('GET', '/admin-portal/allowlist/check'), null);
  });
});
