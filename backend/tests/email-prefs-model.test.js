import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import pool from '../src/config/database.js';
import { Group } from '../src/models/Group.js';
import { User } from '../src/models/User.js';

// Member-scoped preference writes. Deliberately NOT admin-gated: every member
// owns their own inbox, so there is no role check and no path to set someone
// else's preferences.

describe('Group.setEmailPrefs', () => {
  beforeEach(() => {
    Group._emailPrefsSchemaEnsured = true; // skip the self-heal probe
  });

  afterEach(() => {
    mock.restoreAll();
    Group._emailPrefsSchemaEnsured = false;
  });

  test('updates only the fields provided and returns the new state', async () => {
    let captured = null;
    mock.method(pool, 'query', async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ email_reminders: true, email_summaries: false }] };
    });

    const result = await Group.setEmailPrefs(7, 42, { emailReminders: true });

    assert.deepStrictEqual(result, { emailReminders: true, emailSummaries: false });
    assert.ok(captured.sql.includes('email_reminders ='));
    assert.ok(
      !captured.sql.includes('email_summaries ='),
      'an omitted field must not be written',
    );
    assert.deepStrictEqual(captured.params.slice(-2), [7, 42]);
  });

  test('writes both fields when both are given', async () => {
    let captured = null;
    mock.method(pool, 'query', async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ email_reminders: true, email_summaries: true }] };
    });

    await Group.setEmailPrefs(7, 42, { emailReminders: true, emailSummaries: true });

    assert.ok(captured.sql.includes('email_reminders ='));
    assert.ok(captured.sql.includes('email_summaries ='));
    assert.deepStrictEqual(captured.params, [true, true, 7, 42]);
  });

  test('accepts false as a value rather than treating it as absent', async () => {
    let captured = null;
    mock.method(pool, 'query', async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ email_reminders: false, email_summaries: false }] };
    });

    await Group.setEmailPrefs(7, 42, { emailReminders: false });

    assert.ok(captured.sql.includes('email_reminders ='), 'false is a real value, not a no-op');
    assert.strictEqual(captured.params[0], false);
  });

  test('throws when the membership row does not exist', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));
    await assert.rejects(
      () => Group.setEmailPrefs(7, 42, { emailSummaries: true }),
      /not a member/i,
    );
  });

  test('rejects a call with no recognised fields', async () => {
    const query = mock.method(pool, 'query', async () => ({ rows: [] }));
    await assert.rejects(() => Group.setEmailPrefs(7, 42, {}), /No valid fields/);
    assert.strictEqual(query.mock.calls.length, 0, 'must not hit the DB');
  });
});

describe('User.setEmailPaused', () => {
  afterEach(() => mock.restoreAll());

  test('stamps a timestamp when pausing', async () => {
    let params = null;
    mock.method(pool, 'query', async (sql, p) => {
      params = p;
      return { rows: [{ email_paused_at: new Date('2026-09-17T00:00:00Z') }] };
    });

    const result = await User.setEmailPaused(42, true);

    assert.strictEqual(params[0], 42);
    assert.ok(params[1] instanceof Date, 'pausing stores when it happened');
    assert.ok(result.emailPausedAt instanceof Date);
  });

  test('clears the timestamp when resuming', async () => {
    let params = null;
    mock.method(pool, 'query', async (sql, p) => {
      params = p;
      return { rows: [{ email_paused_at: null }] };
    });

    const result = await User.setEmailPaused(42, false);

    assert.strictEqual(params[1], null);
    assert.strictEqual(result.emailPausedAt, null);
  });

  test('throws for an unknown user', async () => {
    mock.method(pool, 'query', async () => ({ rows: [] }));
    await assert.rejects(() => User.setEmailPaused(999, true), /User not found/);
  });
});
