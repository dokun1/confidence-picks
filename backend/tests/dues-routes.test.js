import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import groupsRouter from '../src/routes/groups.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';

// Exercises the dues endpoints on the groups router without a live Postgres,
// following the same seams as group-messages-unread-route.test.js: auth is
// faked at AuthService.verifyAccessToken + User.findById, and the Group model
// is stubbed per test so only the route, its validation and its authorization
// gating are under test.

const AUTH_HEADER = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };
const MEMBERS = [
  { id: 1, name: 'Tester', role: 'admin' },
  { id: 2, name: 'Dana', role: 'member' },
];

describe('dues routes', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    // Stand-in for mcpTokenExchange, which sets req.mcpToken for requests that
    // arrived on a cp_live_ token. The routes key off its presence alone.
    app.use((req, _res, next) => {
      if (req.headers['x-test-mcp']) req.mcpToken = { id: 5, scopes: ['groups:read', 'dues:write'] };
      next();
    });
    app.use('/api/groups', groupsRouter);
    await new Promise((resolve) => {
      server = app.listen(0, () => {
        baseURL = `http://localhost:${server.address().port}`;
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  beforeEach(() => {
    mock.method(AuthService, 'verifyAccessToken', () => ({ userId: 1 }));
    mock.method(User, 'findById', async () => ({ id: 1, name: 'Tester', email: 't@x.io' }));
    mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
    mock.method(Group, 'getMembers', async () => MEMBERS);
  });

  afterEach(() => {
    mock.restoreAll();
  });

  function putDues(body) {
    return fetch(`${baseURL}/api/groups/squad`, {
      method: 'PUT',
      headers: AUTH_HEADER,
      body: JSON.stringify(body),
    });
  }

  describe('PUT /:identifier — dues settings', () => {
    test('rejects an unauthenticated request', async () => {
      const res = await fetch(`${baseURL}/api/groups/squad`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ duesEnabled: true }),
      });
      assert.strictEqual(res.status, 401);
    });

    test('passes validated dues fields through to the model', async () => {
      const update = mock.method(Group, 'update', async () => ({ id: 9 }));
      const res = await putDues({
        duesEnabled: true,
        duesPaymentMethod: 'venmo',
        duesAmountCents: 2000,
        duesVenmoHandle: '@Candace-Henson-1',
      });
      assert.strictEqual(res.status, 200);
      const [, updates] = update.mock.calls[0].arguments;
      assert.strictEqual(updates.duesEnabled, true);
      assert.strictEqual(updates.duesAmountCents, 2000);
      assert.strictEqual(updates.duesVenmoHandle, 'Candace-Henson-1', '@ should be stripped');
    });

    test('rejects a bad amount before touching the model', async () => {
      const update = mock.method(Group, 'update', async () => ({ id: 9 }));
      const res = await putDues({ duesAmountCents: -5 });
      assert.strictEqual(res.status, 400);
      assert.match((await res.json()).error, /greater than zero/);
      assert.strictEqual(update.mock.calls.length, 0, 'model must not be called');
    });

    test('rejects an amount over the $10,000 ceiling', async () => {
      const res = await putDues({ duesAmountCents: 5000000 });
      assert.strictEqual(res.status, 400);
      assert.match((await res.json()).error, /\$10,000 or less/);
    });

    test('rejects a malformed handle', async () => {
      const res = await putDues({ duesVenmoHandle: 'not a handle' });
      assert.strictEqual(res.status, 400);
      assert.match((await res.json()).error, /Venmo username/);
    });

    test('rejects an unknown payment method', async () => {
      const res = await putDues({ duesPaymentMethod: 'paypal' });
      assert.strictEqual(res.status, 400);
      assert.match((await res.json()).error, /must be one of/);
    });

    // The single-method guarantee, asserted at the boundary that writes to the DB.
    test('clears the non-selected method fields before the write', async () => {
      const update = mock.method(Group, 'update', async () => ({ id: 9 }));
      await putDues({
        duesPaymentMethod: 'cashapp',
        duesCashappHandle: 'nalgaskat',
        duesVenmoHandle: 'dana',
        duesInstructions: 'Zelle me',
      });
      const [, updates] = update.mock.calls[0].arguments;
      assert.strictEqual(updates.duesCashappHandle, 'nalgaskat');
      assert.strictEqual(updates.duesVenmoHandle, null);
      assert.strictEqual(updates.duesInstructions, null);
    });

    test('keeps payout notes through a method change', async () => {
      const update = mock.method(Group, 'update', async () => ({ id: 9 }));
      await putDues({
        duesPaymentMethod: 'venmo',
        duesVenmoHandle: 'dana',
        duesPayoutNotes: 'Winner takes all.',
      });
      const [, updates] = update.mock.calls[0].arguments;
      assert.strictEqual(updates.duesPayoutNotes, 'Winner takes all.');
    });

    test('rejects a collector who is not a member of the group', async () => {
      const update = mock.method(Group, 'update', async () => ({ id: 9 }));
      const res = await putDues({ duesCollectorUserId: 999 });
      assert.strictEqual(res.status, 400);
      assert.match((await res.json()).error, /must be a member/);
      assert.strictEqual(update.mock.calls.length, 0);
    });

    test('accepts a collector who is a member', async () => {
      const update = mock.method(Group, 'update', async () => ({ id: 9 }));
      const res = await putDues({ duesCollectorUserId: 2 });
      assert.strictEqual(res.status, 200);
      const [, updates] = update.mock.calls[0].arguments;
      assert.strictEqual(updates.duesCollectorUserId, 2);
    });

    test('allows clearing the collector', async () => {
      const update = mock.method(Group, 'update', async () => ({ id: 9 }));
      const res = await putDues({ duesCollectorUserId: null });
      assert.strictEqual(res.status, 200);
      assert.strictEqual(update.mock.calls[0].arguments[1].duesCollectorUserId, null);
    });

    // Group.update enforces admin-only server-side; the route must surface that
    // as 403 rather than a 500.
    test('surfaces the model\'s admin-only rejection as 403', async () => {
      mock.method(Group, 'update', async () => {
        throw new Error('Only group admins can update group settings');
      });
      const res = await putDues({ duesEnabled: true });
      assert.strictEqual(res.status, 403);
    });

    test('404s for a group that does not exist', async () => {
      mock.method(Group, 'findByIdentifier', async () => null);
      const res = await putDues({ duesEnabled: true });
      assert.strictEqual(res.status, 404);
    });
  });

  describe('POST /:identifier/members/:userId/dues', () => {
    function markPaid(userId, body) {
      return fetch(`${baseURL}/api/groups/squad/members/${userId}/dues`, {
        method: 'POST',
        headers: AUTH_HEADER,
        body: JSON.stringify(body),
      });
    }

    test('rejects an unauthenticated request', async () => {
      const res = await fetch(`${baseURL}/api/groups/squad/members/2/dues`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paid: true }),
      });
      assert.strictEqual(res.status, 401);
    });

    test('marks a member paid and echoes the timestamp', async () => {
      const when = new Date('2026-09-07T12:00:00Z');
      const setDuesPaid = mock.method(Group, 'setDuesPaid', async () => ({
        user_id: 2,
        dues_paid_at: when,
      }));
      const res = await markPaid(2, { paid: true });
      assert.strictEqual(res.status, 200);
      const body = await res.json();
      assert.strictEqual(body.userId, 2);
      assert.strictEqual(new Date(body.duesPaidAt).toISOString(), when.toISOString());
      assert.deepStrictEqual(setDuesPaid.mock.calls[0].arguments, [9, '2', true, 1, 'web']);
    });

    test('marks a member unpaid', async () => {
      const setDuesPaid = mock.method(Group, 'setDuesPaid', async () => ({
        user_id: 2,
        dues_paid_at: null,
      }));
      const res = await markPaid(2, { paid: false });
      assert.strictEqual(res.status, 200);
      assert.strictEqual((await res.json()).duesPaidAt, null);
      assert.strictEqual(setDuesPaid.mock.calls[0].arguments[2], false);
    });

    // `paid` must be an explicit boolean: a missing field would otherwise read
    // as falsy and silently mark someone unpaid.
    test('requires an explicit boolean paid field', async () => {
      const setDuesPaid = mock.method(Group, 'setDuesPaid', async () => ({}));
      for (const body of [{}, { paid: 'true' }, { paid: 1 }, { paid: null }]) {
        const res = await markPaid(2, body);
        assert.strictEqual(res.status, 400, `expected 400 for ${JSON.stringify(body)}`);
      }
      assert.strictEqual(setDuesPaid.mock.calls.length, 0);
    });

    test('surfaces the admin-only rejection as 403', async () => {
      mock.method(Group, 'setDuesPaid', async () => {
        throw new Error('Only group admins can update dues status');
      });
      const res = await markPaid(2, { paid: true });
      assert.strictEqual(res.status, 403);
    });

    test('404s when the target is not a member of the group', async () => {
      mock.method(Group, 'setDuesPaid', async () => {
        throw new Error('That user is not a member of this group');
      });
      const res = await markPaid(99, { paid: true });
      assert.strictEqual(res.status, 404);
    });

    test('404s for a group that does not exist', async () => {
      mock.method(Group, 'findByIdentifier', async () => null);
      const res = await markPaid(2, { paid: true });
      assert.strictEqual(res.status, 404);
    });
  });

  // dues_marked_via: an agent's mark must be distinguishable from the admin's own.
  describe('POST /:identifier/members/:userId/dues — marked via', () => {
    test('records a browser session as web', async () => {
      const setDuesPaid = mock.method(Group, 'setDuesPaid', async () => ({ user_id: 2, dues_paid_at: new Date() }));
      await fetch(`${baseURL}/api/groups/squad/members/2/dues`, { method: 'POST', headers: AUTH_HEADER, body: JSON.stringify({ paid: true }) });
      assert.strictEqual(setDuesPaid.mock.calls[0].arguments[4], 'web');
    });

    test('records a token-authenticated request as mcp', async () => {
      const setDuesPaid = mock.method(Group, 'setDuesPaid', async () => ({ user_id: 2, dues_paid_at: new Date() }));
      await fetch(`${baseURL}/api/groups/squad/members/2/dues`, { method: 'POST', headers: { ...AUTH_HEADER, 'x-test-mcp': '1' }, body: JSON.stringify({ paid: true }) });
      assert.strictEqual(setDuesPaid.mock.calls[0].arguments[4], 'mcp');
    });

    // The scope says "this token may touch dues"; the role says "in this group".
    // A member who minted a dues:write token must still be refused.
    test('a plain member is refused even through a dues:write token', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      mock.method(Group, 'setDuesPaid', async () => { throw new Error('Only group admins can update dues status'); });
      const res = await fetch(`${baseURL}/api/groups/squad/members/2/dues`, { method: 'POST', headers: { ...AUTH_HEADER, 'x-test-mcp': '1' }, body: JSON.stringify({ paid: true }) });
      assert.strictEqual(res.status, 403);
    });
  });

  // The MCP-reachable settings route. It exists so that PUT /:identifier -- which
  // also renames the group and flips is_public -- never has to be allowlisted.
  describe('PUT /:identifier/dues', () => {
    function putDuesOnly(body, headers = AUTH_HEADER) {
      return fetch(`${baseURL}/api/groups/squad/dues`, { method: 'PUT', headers, body: JSON.stringify(body) });
    }
    // What Group.update REALLY returns: the raw row, snake_case, no collector
    // name. The route must not build its response from this.
    const updated = { id: 9, name: 'Squad', is_public: false, dues_enabled: true, dues_amount_cents: 2000, dues_payment_method: 'venmo', dues_venmo_handle: 'dana', dues_collector_user_id: 2 };
    // What findByIdentifier returns: the camelCase Group, collector name joined in.
    const fresh = { id: 9, userRole: 'admin', name: 'Squad', isPublic: false, duesEnabled: true, duesAmountCents: 2000, duesPaymentMethod: 'venmo', duesVenmoHandle: 'dana', duesCashappHandle: null, duesInstructions: null, duesPayoutNotes: null, duesCollectorUserId: 2, duesCollectorName: 'Dana' };

    test('rejects an unauthenticated request', async () => {
      const res = await putDuesOnly({ duesEnabled: true }, { 'Content-Type': 'application/json' });
      assert.strictEqual(res.status, 401);
    });

    test('updates a single field and leaves the rest alone', async () => {
      const update = mock.method(Group, 'update', async () => updated);
      const res = await putDuesOnly({ duesAmountCents: 2000 });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(update.mock.calls[0].arguments, [9, { duesAmountCents: 2000 }, 1]);
    });

    test('updates several fields at once', async () => {
      const update = mock.method(Group, 'update', async () => updated);
      await putDuesOnly({ duesEnabled: true, duesPayoutNotes: 'Winner takes all', duesCollectorUserId: 2 });
      assert.deepStrictEqual(update.mock.calls[0].arguments[1], { duesEnabled: true, duesPayoutNotes: 'Winner takes all', duesCollectorUserId: 2 });
    });

    // THE reason this route exists.
    test('ignores every non-dues key, so a token cannot rename or publish a group', async () => {
      const update = mock.method(Group, 'update', async () => updated);
      const res = await putDuesOnly({ duesEnabled: true, name: 'Hijacked', description: 'x', isPublic: true, is_public: true, maxMembers: 500, avatarUrl: 'http://x', identifier: 'new-slug' });
      assert.strictEqual(res.status, 200);
      assert.deepStrictEqual(update.mock.calls[0].arguments[1], { duesEnabled: true });
    });

    test('400s a body with no dues fields rather than treating it as a no-op', async () => {
      const update = mock.method(Group, 'update', async () => updated);
      for (const body of [{}, { name: 'Only a rename' }]) {
        const res = await putDuesOnly(body);
        assert.strictEqual(res.status, 400, JSON.stringify(body));
      }
      assert.strictEqual(update.mock.calls.length, 0);
    });

    test('applies the same validation as the general route', async () => {
      const update = mock.method(Group, 'update', async () => updated);
      assert.strictEqual((await putDuesOnly({ duesAmountCents: -5 })).status, 400);
      assert.strictEqual((await putDuesOnly({ duesVenmoHandle: 'not a handle!' })).status, 400);
      assert.strictEqual((await putDuesOnly({ duesPaymentMethod: 'paypal' })).status, 400);
      assert.strictEqual((await putDuesOnly({ duesCollectorUserId: 99 })).status, 400, 'collector must be a member');
      assert.strictEqual(update.mock.calls.length, 0);
    });

    test('choosing a method clears the other methods, as the form does', async () => {
      const update = mock.method(Group, 'update', async () => updated);
      await putDuesOnly({ duesPaymentMethod: 'venmo', duesVenmoHandle: '@dana', duesCashappHandle: 'old' });
      const sent = update.mock.calls[0].arguments[1];
      assert.strictEqual(sent.duesVenmoHandle, 'dana');
      assert.strictEqual(sent.duesCashappHandle, null);
      assert.strictEqual(sent.duesInstructions, null);
    });

    test('responds with the camelCase dues fields only, re-read after the write', async () => {
      mock.method(Group, 'update', async () => updated);
      mock.method(Group, 'findByIdentifier', async () => fresh);
      const body = await (await putDuesOnly({ duesEnabled: true })).json();
      assert.deepStrictEqual(body, { duesEnabled: true, duesAmountCents: 2000, duesPaymentMethod: 'venmo', duesVenmoHandle: 'dana', duesCashappHandle: null, duesInstructions: null, duesPayoutNotes: null, duesCollectorUserId: 2, duesCollectorName: 'Dana' });
    });

    test('a plain member is refused even through a dues:write token', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      mock.method(Group, 'update', async () => { throw new Error('Only group admins can update group settings'); });
      const res = await putDuesOnly({ duesEnabled: false }, { ...AUTH_HEADER, 'x-test-mcp': '1' });
      assert.strictEqual(res.status, 403);
    });

    test('404s for a group that does not exist', async () => {
      mock.method(Group, 'findByIdentifier', async () => null);
      assert.strictEqual((await putDuesOnly({ duesEnabled: true })).status, 404);
    });
  });

  // Tokens can already reach this route under groups:read. No MCP tool needs
  // addresses, so they are withheld from token requests only.
  describe('GET /:identifier/members — email', () => {
    const rows = [{ id: 1, name: 'Tester', email: 't@x.io', role: 'admin', dues_paid_at: null }, { id: 2, name: 'Dana', email: 'd@x.io', role: 'member', dues_paid_at: null }];

    test('a browser session still receives member emails', async () => {
      mock.method(Group, 'getMembers', async () => rows.map((r) => ({ ...r })));
      const body = await (await fetch(`${baseURL}/api/groups/squad/members`, { headers: AUTH_HEADER })).json();
      assert.strictEqual(body[1].email, 'd@x.io');
    });

    test('a token request receives no member emails', async () => {
      mock.method(Group, 'getMembers', async () => rows.map((r) => ({ ...r })));
      const body = await (await fetch(`${baseURL}/api/groups/squad/members`, { headers: { ...AUTH_HEADER, 'x-test-mcp': '1' } })).json();
      assert.strictEqual(body.length, 2);
      for (const m of body) assert.ok(!('email' in m), 'email must be absent, not null');
      assert.strictEqual(body[1].name, 'Dana', 'everything else is unchanged');
    });
  });
});
