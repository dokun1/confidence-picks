import { test, describe, before, after, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';

// Set before importing the token util, which reads the secret lazily per call
// but is clearer pinned up front.
process.env.EMAIL_TOKEN_SECRET = 'test-secret';

const { default: emailRouter } = await import('../src/routes/email.js');
const { Group } = await import('../src/models/Group.js');
const { User } = await import('../src/models/User.js');
const { signUnsubscribe } = await import('../src/utils/emailTokens.js');

describe('unsubscribe routes', () => {
  let server;
  let baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/email', emailRouter);
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

  afterEach(() => {
    mock.restoreAll();
  });

  test('GET with a valid token turns that preference off, with no auth header', async () => {
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({
      emailReminders: false,
      emailSummaries: true,
    }));

    const token = signUnsubscribe({ userId: 3, groupId: 9, type: 'pick_reminder' });
    const res = await fetch(`${baseURL}/api/email/unsubscribe?token=${token}`);

    assert.strictEqual(res.status, 200);
    assert.match(res.headers.get('content-type'), /html/);

    const [groupId, userId, prefs] = setPrefs.mock.calls[0].arguments;
    assert.strictEqual(groupId, 9);
    assert.strictEqual(userId, 3);
    assert.deepStrictEqual(prefs, { emailReminders: false });
  });

  test('a summary token turns off summaries, not reminders', async () => {
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({}));

    const token = signUnsubscribe({ userId: 3, groupId: 9, type: 'weekly_summary' });
    await fetch(`${baseURL}/api/email/unsubscribe?token=${token}`);

    const [, , prefs] = setPrefs.mock.calls[0].arguments;
    assert.deepStrictEqual(prefs, { emailSummaries: false });
  });

  test('a forged token is rejected and changes nothing', async () => {
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({}));
    const pause = mock.method(User, 'setEmailPaused', async () => ({}));

    const res = await fetch(`${baseURL}/api/email/unsubscribe?token=bogus.token`);

    assert.strictEqual(res.status, 400);
    assert.strictEqual(setPrefs.mock.calls.length, 0);
    assert.strictEqual(pause.mock.calls.length, 0);
  });

  test('a missing token is rejected', async () => {
    const res = await fetch(`${baseURL}/api/email/unsubscribe`);
    assert.strictEqual(res.status, 400);
  });

  test('POST is the one-click target and returns JSON', async () => {
    mock.method(Group, 'setEmailPrefs', async () => ({}));

    const token = signUnsubscribe({ userId: 3, groupId: 9, type: 'pick_reminder' });
    const res = await fetch(`${baseURL}/api/email/unsubscribe`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    });

    assert.strictEqual(res.status, 200);
    const body = await res.json();
    assert.strictEqual(body.ok, true);
    assert.strictEqual(body.scope, 'pick_reminder');
  });

  test('POST accepts the token on the query string too', async () => {
    mock.method(Group, 'setEmailPrefs', async () => ({}));
    const token = signUnsubscribe({ userId: 3, groupId: 9, type: 'pick_reminder' });
    const res = await fetch(`${baseURL}/api/email/unsubscribe?token=${token}`, { method: 'POST' });
    assert.strictEqual(res.status, 200);
  });

  test('a group-less reminder token pauses the user globally', async () => {
    const pause = mock.method(User, 'setEmailPaused', async () => ({ emailPausedAt: new Date() }));
    const setPrefs = mock.method(Group, 'setEmailPrefs', async () => ({}));

    const token = signUnsubscribe({ userId: 3, groupId: null, type: 'pick_reminder' });
    const res = await fetch(`${baseURL}/api/email/unsubscribe?token=${token}`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(pause.mock.calls[0].arguments, [3, true]);
    assert.strictEqual(setPrefs.mock.calls.length, 0, 'no group to scope to');
  });

  test('a model failure surfaces as 500, not a false success', async () => {
    mock.method(Group, 'setEmailPrefs', async () => {
      throw new Error('db down');
    });
    const token = signUnsubscribe({ userId: 3, groupId: 9, type: 'pick_reminder' });
    const res = await fetch(`${baseURL}/api/email/unsubscribe?token=${token}`);
    assert.strictEqual(res.status, 500);
  });
});
