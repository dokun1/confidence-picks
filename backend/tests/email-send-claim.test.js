import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import pool from '../src/config/database.js';
import { EmailSend, EMAIL_TYPES } from '../src/models/EmailSend.js';

// The claim row is the whole idempotency story: a unique (user, type,
// dedupe_key) inserted BEFORE the provider call makes delivery at-most-once,
// so cron jitter, a double dispatch and a retry all collapse to a no-op.

describe('EmailSend.claim', () => {
  beforeEach(() => {
    EmailSend._schemaEnsured = true; // skip the CREATE TABLE probe
  });

  afterEach(() => {
    mock.restoreAll();
    EmailSend._schemaEnsured = false;
  });

  test('returns the row id when the claim is new', async () => {
    mock.method(pool, 'query', async () => ({ rows: [{ id: 99 }] }));
    const id = await EmailSend.claim({
      userId: 1,
      groupId: null,
      emailType: EMAIL_TYPES.REMINDER,
      dedupeKey: 'reminder:2026-09-20',
    });
    assert.strictEqual(id, 99);
  });

  test('returns null when the same key was already claimed', async () => {
    // ON CONFLICT DO NOTHING yields zero rows.
    mock.method(pool, 'query', async () => ({ rows: [] }));
    const id = await EmailSend.claim({
      userId: 1,
      groupId: null,
      emailType: EMAIL_TYPES.REMINDER,
      dedupeKey: 'reminder:2026-09-20',
    });
    assert.strictEqual(id, null, 'a taken claim must not look like a fresh one');
  });

  test('claims before sending: the row starts as "claimed", not "sent"', async () => {
    let captured = null;
    mock.method(pool, 'query', async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ id: 1 }] };
    });

    await EmailSend.claim({
      userId: 5,
      groupId: 3,
      emailType: EMAIL_TYPES.SUMMARY,
      dedupeKey: 'summary:3:2026:2:1',
    });

    assert.ok(captured.sql.includes("'claimed'"));
    assert.ok(captured.sql.includes('ON CONFLICT'));
    assert.deepStrictEqual(captured.params, [5, 3, 'weekly_summary', 'summary:3:2026:2:1']);
  });
});

describe('EmailSend result recording', () => {
  afterEach(() => mock.restoreAll());

  test('markSent stores the provider message id', async () => {
    let params = null;
    mock.method(pool, 'query', async (sql, p) => {
      params = p;
      return { rows: [] };
    });
    await EmailSend.markSent(7, 'resend-abc');
    assert.deepStrictEqual(params, [7, 'resend-abc']);
  });

  test('markSent tolerates a missing provider id (dry run)', async () => {
    let params = null;
    mock.method(pool, 'query', async (sql, p) => {
      params = p;
      return { rows: [] };
    });
    await EmailSend.markSent(7, undefined);
    assert.strictEqual(params[1], null);
  });

  test('markFailed truncates a runaway error message', async () => {
    let params = null;
    mock.method(pool, 'query', async (sql, p) => {
      params = p;
      return { rows: [] };
    });
    await EmailSend.markFailed(7, 'x'.repeat(5000));
    assert.strictEqual(params[1].length, 2000, 'error column must not be unbounded');
  });
});
