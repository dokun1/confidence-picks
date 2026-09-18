import { test, describe, before } from 'node:test';
import assert from 'node:assert';
import { signUnsubscribe, verifyUnsubscribe } from '../src/utils/emailTokens.js';

describe('unsubscribe tokens', () => {
  before(() => {
    process.env.EMAIL_TOKEN_SECRET = 'test-secret-do-not-use';
  });

  test('round-trips a group-scoped token', () => {
    const token = signUnsubscribe({ userId: 12, groupId: 5, type: 'pick_reminder' });
    assert.deepStrictEqual(verifyUnsubscribe(token), {
      userId: 12,
      groupId: 5,
      type: 'pick_reminder',
    });
  });

  test('round-trips a group-less token (reminders are batched across groups)', () => {
    const token = signUnsubscribe({ userId: 12, groupId: null, type: 'pick_reminder' });
    assert.deepStrictEqual(verifyUnsubscribe(token), {
      userId: 12,
      groupId: null,
      type: 'pick_reminder',
    });
  });

  test('rejects a tampered payload carrying a valid-looking signature', () => {
    const token = signUnsubscribe({ userId: 12, groupId: 5, type: 'pick_reminder' });
    const mac = token.slice(token.lastIndexOf('.') + 1);
    const forged = Buffer.from('99.5.pick_reminder').toString('base64url');
    assert.strictEqual(
      verifyUnsubscribe(`${forged}.${mac}`),
      null,
      'swapping the user id must not verify',
    );
  });

  test('rejects a token signed with a different secret', () => {
    const token = signUnsubscribe({ userId: 12, groupId: 5, type: 'pick_reminder' });
    process.env.EMAIL_TOKEN_SECRET = 'a-different-secret';
    try {
      assert.strictEqual(verifyUnsubscribe(token), null);
    } finally {
      process.env.EMAIL_TOKEN_SECRET = 'test-secret-do-not-use';
    }
  });

  test('rejects garbage without throwing', () => {
    assert.strictEqual(verifyUnsubscribe('not-a-token'), null);
    assert.strictEqual(verifyUnsubscribe(''), null);
    assert.strictEqual(verifyUnsubscribe(null), null);
    assert.strictEqual(verifyUnsubscribe(undefined), null);
    assert.strictEqual(verifyUnsubscribe('a.b'), null);
  });

  test('refuses to sign an unknown email type', () => {
    assert.throws(
      () => signUnsubscribe({ userId: 1, groupId: 1, type: 'marketing_blast' }),
      /Unknown email type/,
    );
  });
});
