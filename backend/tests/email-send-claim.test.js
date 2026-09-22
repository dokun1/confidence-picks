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

  test('reclaims a row left in failed state, so a send can be retried', async () => {
    // A provider outage or a bad API key records 'failed'. That email reached
    // nobody, so the dedupe key must open again — otherwise the only recovery
    // is deleting rows by hand.
    let captured = null;
    mock.method(pool, 'query', async (sql, params) => {
      captured = { sql, params };
      return { rows: [{ id: 42 }] };
    });

    const id = await EmailSend.claim({
      userId: 1,
      groupId: 9,
      emailType: EMAIL_TYPES.SUMMARY,
      dedupeKey: 'summary:9:2026:2:2',
    });

    assert.strictEqual(id, 42);
    assert.ok(captured.sql.includes('DO UPDATE'), 'must not be DO NOTHING');
    assert.ok(
      /WHERE\s+email_sends\.status\s*=\s*'failed'/.test(captured.sql),
      'only a failed row may be reclaimed',
    );
  });

  test("does not reclaim a row that is 'claimed' or 'sent'", async () => {
    // The guarded UPDATE matches nothing, so RETURNING is empty — at-most-once
    // still holds for anything that was actually handed to the provider.
    mock.method(pool, 'query', async () => ({ rows: [] }));
    const id = await EmailSend.claim({
      userId: 1,
      groupId: 9,
      emailType: EMAIL_TYPES.SUMMARY,
      dedupeKey: 'summary:9:2026:2:2',
    });
    assert.strictEqual(id, null);
  });

  test('clears the previous error when reclaiming', async () => {
    let captured = null;
    mock.method(pool, 'query', async (sql) => {
      captured = sql;
      return { rows: [{ id: 42 }] };
    });
    await EmailSend.claim({
      userId: 1,
      groupId: 9,
      emailType: EMAIL_TYPES.SUMMARY,
      dedupeKey: 'k',
    });
    assert.ok(/error\s*=\s*NULL/.test(captured), 'a stale error would misreport the retry');
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
