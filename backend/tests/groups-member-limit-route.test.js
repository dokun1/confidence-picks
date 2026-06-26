import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import groupsRouter from '../src/routes/groups.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';

// Exercises the configurable member-limit validation on the groups create + update
// routes without a live Postgres. Auth + the Group model are stubbed; the focus is
// the route-level bounds checks ([2,500]) and the HTTP status mapping for the
// shrink-below-count conflict.

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

describe('Groups member-limit routes', () => {
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
  });

  afterEach(() => {
    mock.restoreAll();
  });

  function post(body) {
    return fetch(`${baseURL}/api/groups`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify(body),
    });
  }
  function put(identifier, body) {
    return fetch(`${baseURL}/api/groups/${identifier}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...AUTH_HEADER },
      body: JSON.stringify(body),
    });
  }

  describe('create', () => {
    test('defaults the member limit to 50 when omitted', async () => {
      let seen = null;
      mock.method(Group, 'create', async (data) => { seen = data; return { id: 1, ...data }; });
      const res = await post({ name: 'G', identifier: 'g' });
      assert.equal(res.status, 201);
      assert.equal(seen.maxMembers, 50);
    });

    test('accepts a member limit up to the 500 cap', async () => {
      mock.method(Group, 'create', async (data) => ({ id: 1, ...data }));
      const res = await post({ name: 'G', identifier: 'g', maxMembers: 500 });
      assert.equal(res.status, 201);
    });

    test('rejects a member limit over 500', async () => {
      const res = await post({ name: 'G', identifier: 'g', maxMembers: 501 });
      assert.equal(res.status, 400);
    });

    test('rejects a member limit below 2', async () => {
      const res = await post({ name: 'G', identifier: 'g', maxMembers: 1 });
      assert.equal(res.status, 400);
    });

    test('rejects a non-integer member limit', async () => {
      const res = await post({ name: 'G', identifier: 'g', maxMembers: 12.5 });
      assert.equal(res.status, 400);
    });
  });

  describe('update status mapping', () => {
    test('maps the shrink-below-count error to 409', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 10 }));
      mock.method(Group, 'update', async () => {
        throw new Error('Member limit (30) is below the current member count (38). Members must leave the group before you can lower the limit this far.');
      });
      const res = await put('g', { maxMembers: 30 });
      assert.equal(res.status, 409);
      const body = await res.json();
      assert.match(body.error, /below the current member count/);
    });

    test('maps an out-of-range limit error to 400', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 10 }));
      mock.method(Group, 'update', async () => {
        throw new Error('Member limit must be a whole number between 2 and 500');
      });
      const res = await put('g', { maxMembers: 999 });
      assert.equal(res.status, 400);
    });

    test('a successful expansion returns 200', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 10 }));
      mock.method(Group, 'update', async (id, updates) => ({ id, max_members: updates.maxMembers }));
      const res = await put('g', { maxMembers: 200 });
      assert.equal(res.status, 200);
    });
  });
});
