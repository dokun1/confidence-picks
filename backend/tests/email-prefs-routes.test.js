import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import groupsRouter from '../src/routes/groups.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';

// Exercises the email preference endpoint on the groups router without a live
// Postgres, following dues-routes.test.js: auth is faked at
// AuthService.verifyAccessToken + User.findById and the Group model is stubbed,
// so only the route, its validation and its authorization gating are under test.

const AUTH_HEADER = { Authorization: 'Bearer test-token', 'Content-Type': 'application/json' };

describe('email preference routes', () => {
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
    mock.method(User, 'findById', async () => ({ id: 1, name: 'Ann', email: 'ann@example.com' }));
  });

  afterEach(() => {
    mock.restoreAll();
  });

  function postPrefs(body) {
    return fetch(`${baseURL}/api/groups/sunday-squad/email-prefs`, {
      method: 'POST',
      headers: AUTH_HEADER,
      body: JSON.stringify(body),
    });
  }

  test('rejects an unauthenticated request', async () => {
    const res = await fetch(`${baseURL}/api/groups/sunday-squad/email-prefs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailReminders: true }),
    });
    assert.strictEqual(res.status, 401);
  });

  test('a member updates their own preferences', async () => {
    mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({
      emailReminders: true,
      emailSummaries: false,
    }));

    const res = await postPrefs({ emailReminders: true });

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { emailReminders: true, emailSummaries: false });

    const [groupId, userId] = setPrefs.mock.calls[0].arguments;
    assert.strictEqual(groupId, 9, 'writes against the resolved group id');
    assert.strictEqual(userId, 1, 'always the authenticated caller, never a body field');
  });

  test('turning a preference off is a valid update', async () => {
    mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({
      emailReminders: false,
      emailSummaries: false,
    }));

    const res = await postPrefs({ emailReminders: false });

    assert.strictEqual(res.status, 200);
    const [, , prefs] = setPrefs.mock.calls[0].arguments;
    assert.strictEqual(prefs.emailReminders, false);
  });

  test('an admin has no special path — the caller is always the subject', async () => {
    mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({
      emailReminders: true,
      emailSummaries: true,
    }));

    await postPrefs({ emailReminders: true, emailSummaries: true, userId: 999 });

    const [, userId] = setPrefs.mock.calls[0].arguments;
    assert.strictEqual(userId, 1, 'a userId in the body must be ignored');
  });

  test('a non-member gets 403 and the model is never called', async () => {
    mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: null }));
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({}));

    const res = await postPrefs({ emailReminders: true });

    assert.strictEqual(res.status, 403);
    assert.strictEqual(setPrefs.mock.calls.length, 0);
  });

  test('a missing group gets 404', async () => {
    mock.method(Group, 'findByIdentifier', async () => null);
    const res = await postPrefs({ emailReminders: true });
    assert.strictEqual(res.status, 404);
  });

  test('a body with no boolean fields gets 400 before any lookup', async () => {
    const find = mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));

    const res = await postPrefs({ emailReminders: 'yes' });

    assert.strictEqual(res.status, 400);
    assert.strictEqual(find.mock.calls.length, 0, 'validate before touching the DB');
  });

  test('an empty body gets 400', async () => {
    const res = await postPrefs({});
    assert.strictEqual(res.status, 400);
  });
});
