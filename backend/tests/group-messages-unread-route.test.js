import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import groupsRouter from '../src/routes/groups.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';

// Exercises the unread-chat endpoints on the groups router without a live
// Postgres. Auth is faked by stubbing the same seam the real authenticateToken
// middleware reads (AuthService.verifyAccessToken + User.findById); the Group
// model methods are stubbed per test so only the route + membership gating is
// under test.

const AUTH_HEADER = { Authorization: 'Bearer test-token' };

describe('group chat unread routes', () => {
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

  describe('GET /:identifier/messages/unread', () => {
    test('rejects an unauthenticated request', async () => {
      const res = await fetch(`${baseURL}/api/groups/squad/messages/unread`);
      assert.strictEqual(res.status, 401);
    });

    test('returns 404 for an unknown group', async () => {
      mock.method(Group, 'findByIdentifier', async () => null);
      const res = await fetch(`${baseURL}/api/groups/nope/messages/unread`, { headers: { ...AUTH_HEADER } });
      assert.strictEqual(res.status, 404);
    });

    test('returns 403 when the caller is not a group member', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: null }));
      const res = await fetch(`${baseURL}/api/groups/squad/messages/unread`, { headers: { ...AUTH_HEADER } });
      assert.strictEqual(res.status, 403);
    });

    test('reports hasUnread true when the model finds unread messages', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      const unread = mock.method(Group, 'getUnreadStatus', async () => true);

      const res = await fetch(`${baseURL}/api/groups/squad/messages/unread`, { headers: { ...AUTH_HEADER } });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.hasUnread, true);
      // Computed for the resolved group id and the authenticated caller.
      assert.deepStrictEqual(unread.mock.calls[0].arguments, [9, 1]);
    });

    test('reports hasUnread false when there is nothing new', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'admin' }));
      mock.method(Group, 'getUnreadStatus', async () => false);

      const res = await fetch(`${baseURL}/api/groups/squad/messages/unread`, { headers: { ...AUTH_HEADER } });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.hasUnread, false);
    });
  });

  describe('POST /:identifier/messages/read', () => {
    test('rejects an unauthenticated request', async () => {
      const res = await fetch(`${baseURL}/api/groups/squad/messages/read`, { method: 'POST' });
      assert.strictEqual(res.status, 401);
    });

    test('returns 404 for an unknown group', async () => {
      mock.method(Group, 'findByIdentifier', async () => null);
      const res = await fetch(`${baseURL}/api/groups/nope/messages/read`, {
        method: 'POST',
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 404);
    });

    test('returns 403 when the caller is not a group member', async () => {
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: null }));
      const mark = mock.method(Group, 'markMessagesRead', async () => new Date().toISOString());
      const res = await fetch(`${baseURL}/api/groups/squad/messages/read`, {
        method: 'POST',
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 403);
      assert.strictEqual(mark.mock.callCount(), 0, 'a non-member must not write a read marker');
    });

    test('marks the chat read for the caller and echoes the timestamp', async () => {
      const lastReadAt = '2026-06-14T12:00:00.000Z';
      mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
      const mark = mock.method(Group, 'markMessagesRead', async () => lastReadAt);

      const res = await fetch(`${baseURL}/api/groups/squad/messages/read`, {
        method: 'POST',
        headers: { ...AUTH_HEADER },
      });
      assert.strictEqual(res.status, 200);
      const data = await res.json();
      assert.strictEqual(data.lastReadAt, lastReadAt);
      // Read marker upserted for the resolved group id and authenticated caller.
      assert.deepStrictEqual(mark.mock.calls[0].arguments, [9, 1]);
    });
  });
});
