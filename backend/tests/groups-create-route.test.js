import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import groupsRouter from '../src/routes/groups.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';

// Mounts the groups router on a throwaway app at /api/groups and stubs auth
// (AuthService.verifyAccessToken + User.findById) plus Group.create so the create
// route's validation/plumbing is exercised without a live Postgres. Focused on the
// World Cup `knockoutOnly` sub-setting added alongside pool_type.

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

describe('Groups create route — knockoutOnly', () => {
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

  test('passes knockoutOnly through to Group.create for a world_cup_2026 pool', async () => {
    let seen = null;
    mock.method(Group, 'create', async (data) => {
      seen = data;
      return { id: 5, ...data };
    });

    const res = await post({
      name: 'Knockout Crew',
      identifier: 'knockout-crew',
      poolType: 'world_cup_2026',
      knockoutOnly: true,
    });

    assert.strictEqual(res.status, 201);
    assert.strictEqual(seen.knockoutOnly, true, 'create receives knockoutOnly=true');
    assert.strictEqual(seen.poolType, 'world_cup_2026');
  });

  test('defaults knockoutOnly to false when omitted', async () => {
    let seen = null;
    mock.method(Group, 'create', async (data) => {
      seen = data;
      return { id: 6, ...data };
    });

    const res = await post({ name: 'Plain WC', identifier: 'plain-wc', poolType: 'world_cup_2026' });
    assert.strictEqual(res.status, 201);
    assert.strictEqual(seen.knockoutOnly, false);
  });

  test('rejects knockoutOnly on a non-world-cup pool with 400 (no create)', async () => {
    const create = mock.method(Group, 'create', async (data) => ({ id: 7, ...data }));

    const res = await post({ name: 'NFL Group', identifier: 'nfl-group', poolType: 'nfl_weekly', knockoutOnly: true });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /knockoutOnly is only valid for world_cup_2026/);
    assert.strictEqual(create.mock.callCount(), 0, 'an invalid combination must never create a group');
  });

  test('rejects knockoutOnly when poolType is omitted (defaults to NFL)', async () => {
    const create = mock.method(Group, 'create', async (data) => ({ id: 8, ...data }));
    const res = await post({ name: 'No Pool', identifier: 'no-pool', knockoutOnly: true });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(create.mock.callCount(), 0);
  });
});
