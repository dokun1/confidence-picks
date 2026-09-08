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
      assert.deepStrictEqual(setDuesPaid.mock.calls[0].arguments, [9, '2', true, 1]);
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
});
