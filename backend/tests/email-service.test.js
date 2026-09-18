import { test, describe } from 'node:test';
import assert from 'node:assert';
import { createEmailService, isSendableAddress } from '../src/services/EmailService.js';

const BASE_ENV = {
  EMAIL_DRY_RUN: 'false',
  RESEND_API_KEY: 'test-key',
  EMAIL_FROM: 'Confidence Picks <noreply@confidence-picks.com>',
  EMAIL_REPLY_TO: 'hello@noetalabs.tech',
};

const MSG = {
  to: 'a@example.com',
  subject: 'S',
  html: '<p>h</p>',
  text: 't',
  unsubscribeUrl: 'https://api.confidence-picks.com/api/email/unsubscribe?token=t',
  idempotencyKey: 'k1',
};

const noop = { log: () => {}, warn: () => {} };
const okFetch = async () => ({ ok: true, json: async () => ({ id: 'abc-123' }) });

describe('isSendableAddress', () => {
  test('refuses the Apple placeholder domain', () => {
    assert.strictEqual(isSendableAddress('apple_001@confidence-picks.local'), false);
    assert.strictEqual(isSendableAddress('APPLE_001@Confidence-Picks.LOCAL'), false);
  });

  test('accepts a real address and rejects nonsense', () => {
    assert.strictEqual(isSendableAddress('real@example.com'), true);
    assert.strictEqual(isSendableAddress(null), false);
    assert.strictEqual(isSendableAddress(undefined), false);
    assert.strictEqual(isSendableAddress('no-at-sign'), false);
  });
});

describe('createEmailService', () => {
  test('dry run is the default and issues no request', async () => {
    let called = false;
    const svc = createEmailService({
      env: { ...BASE_ENV, EMAIL_DRY_RUN: undefined },
      fetchImpl: async () => {
        called = true;
      },
      logger: noop,
    });

    const res = await svc.send(MSG);

    assert.strictEqual(called, false, 'an unset flag must not send');
    assert.strictEqual(res.dryRun, true);
    assert.strictEqual(svc.dryRun, true);
  });

  test('only the literal string "false" enables sending', async () => {
    for (const value of ['true', 'TRUE', 'no', '0', 'False ']) {
      const svc = createEmailService({
        env: { ...BASE_ENV, EMAIL_DRY_RUN: value },
        fetchImpl: okFetch,
        logger: noop,
      });
      assert.strictEqual(svc.dryRun, true, `${JSON.stringify(value)} must stay in dry run`);
    }
    const live = createEmailService({ env: BASE_ENV, fetchImpl: okFetch, logger: noop });
    assert.strictEqual(live.dryRun, false);
  });

  test('posts to Resend with auth, unsubscribe and idempotency headers', async () => {
    let captured = null;
    const svc = createEmailService({
      env: BASE_ENV,
      fetchImpl: async (url, opts) => {
        captured = { url, opts };
        return { ok: true, json: async () => ({ id: 'abc-123' }) };
      },
      logger: noop,
    });

    const res = await svc.send(MSG);

    assert.strictEqual(res.id, 'abc-123');
    assert.strictEqual(captured.url, 'https://api.resend.com/emails');
    assert.strictEqual(captured.opts.headers.Authorization, 'Bearer test-key');
    assert.strictEqual(captured.opts.headers['Idempotency-Key'], 'k1');

    const body = JSON.parse(captured.opts.body);
    assert.strictEqual(body.from, BASE_ENV.EMAIL_FROM);
    assert.strictEqual(body.to, 'a@example.com');
    assert.strictEqual(body.reply_to, BASE_ENV.EMAIL_REPLY_TO);
    assert.strictEqual(body.headers['List-Unsubscribe'], `<${MSG.unsubscribeUrl}>`);
    assert.strictEqual(body.headers['List-Unsubscribe-Post'], 'List-Unsubscribe=One-Click');
  });

  test('skips an unsendable address without calling the provider', async () => {
    let called = false;
    const svc = createEmailService({
      env: BASE_ENV,
      fetchImpl: async () => {
        called = true;
      },
      logger: noop,
    });

    const res = await svc.send({ ...MSG, to: 'apple_1@confidence-picks.local' });

    assert.strictEqual(called, false);
    assert.strictEqual(res.skipped, 'unsendable-address');
    assert.strictEqual(svc.sentCount, 0, 'a skip must not consume the budget');
  });

  test('throws rather than exceeding EMAIL_MAX_PER_RUN', async () => {
    const svc = createEmailService({
      env: { ...BASE_ENV, EMAIL_MAX_PER_RUN: '2' },
      fetchImpl: okFetch,
      logger: noop,
    });

    await svc.send(MSG);
    await svc.send(MSG);
    await assert.rejects(() => svc.send(MSG), /EMAIL_MAX_PER_RUN/);
    assert.strictEqual(svc.sentCount, 2);
  });

  test('a non-ok provider response rejects with status and body', async () => {
    const svc = createEmailService({
      env: BASE_ENV,
      fetchImpl: async () => ({
        ok: false,
        status: 422,
        text: async () => 'domain not verified',
      }),
      logger: noop,
    });

    await assert.rejects(() => svc.send(MSG), /422[\s\S]*domain not verified/);
  });
});
