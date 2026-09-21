import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getDues, updateDuesSettings, setDuesPaid } from '../src/dues.js';

// Fixtures mirror the LIVE wire shapes, read off production rather than guessed:
// GET /groups/:id is camelCase, while GET /groups/:id/members returns the raw
// rows -- snake_case, numeric ids, and no email for token requests. A fixture
// that agrees with the code but not with production is how `date` vs `gameDate`
// shipped.
const GROUP = {
  id: 9, name: 'Squad', identifier: 'squad', userRole: 'admin', poolType: 'nfl',
  duesEnabled: true, duesPaymentMethod: 'venmo', duesAmountCents: 2000,
  duesVenmoHandle: 'dana-r', duesCashappHandle: null, duesInstructions: null,
  duesPayoutNotes: 'Winner takes all', duesCollectorUserId: 1, duesCollectorName: 'Dana Reyes'
};
const MEMBERS = [
  { id: 1, name: 'Dana Reyes', picture_url: null, role: 'admin', joined_at: '2026-08-01T00:00:00.000Z', dues_paid_at: '2026-09-01T12:00:00.000Z', dues_marked_via: 'web', dues_marked_by_name: 'Dana Reyes' },
  { id: 2, name: 'Sam Cole', picture_url: null, role: 'member', joined_at: '2026-08-02T00:00:00.000Z', dues_paid_at: '2026-09-02T12:00:00.000Z', dues_marked_via: 'mcp', dues_marked_by_name: 'Dana Reyes' },
  { id: 3, name: 'Ari Voss', picture_url: null, role: 'member', joined_at: '2026-08-03T00:00:00.000Z', dues_paid_at: null, dues_marked_via: null, dues_marked_by_name: null }
];

function fakeClient({ group = GROUP, members = MEMBERS, put, post } = {}) {
  const calls = [];
  return {
    calls,
    get: async (p) => {
      calls.push(['GET', p]);
      return p.endsWith('/members') ? members.map((m) => ({ ...m })) : { ...group };
    },
    put: async (p, b) => { calls.push(['PUT', p, b]); return put ? put(p, b) : { ...group }; },
    post: async (p, b) => { calls.push(['POST', p, b]); return post ? post(p, b) : { userId: 0, duesPaidAt: null }; }
  };
}
const writes = (c) => c.calls.filter(([m]) => m !== 'GET');

describe('getDues', () => {
  test('gives an admin the settings, the ledger and the totals', async () => {
    const out = await getDues(fakeClient(), { group: 'squad' });
    assert.deepStrictEqual(out.settings, {
      enabled: true, amount: 20, amountCents: 2000, paymentMethod: 'venmo',
      venmoHandle: 'dana-r', cashappHandle: null, instructions: null,
      payoutNotes: 'Winner takes all', collector: { userId: 1, name: 'Dana Reyes' }
    });
    assert.deepStrictEqual(out.members[1], {
      userId: 2, name: 'Sam Cole', role: 'member', paid: true,
      paidAt: '2026-09-02T12:00:00.000Z', markedBy: 'Dana Reyes', markedVia: 'mcp'
    });
    assert.deepStrictEqual(out.members[2], {
      userId: 3, name: 'Ari Voss', role: 'member', paid: false, paidAt: null, markedBy: null, markedVia: null
    });
    assert.deepStrictEqual(out.totals, { members: 3, paid: 2, unpaid: 1, collected: 40, outstanding: 20 });
    assert.strictEqual(out.role, 'admin');
  });

  test('never passes an email through, even if the server sends one', async () => {
    const members = MEMBERS.map((m) => ({ ...m, email: `${m.id}@x.io` }));
    const out = await getDues(fakeClient({ members }), { group: 'squad' });
    assert.ok(!JSON.stringify(out).includes('@x.io'));
  });

  // Mirrors the page, where "Who has paid" is an admin-only section.
  test('gives a non-admin the settings but not the ledger, and does not fetch it', async () => {
    const c = fakeClient({ group: { ...GROUP, userRole: 'member' } });
    const out = await getDues(c, { group: 'squad' });
    assert.strictEqual(out.role, 'member');
    assert.strictEqual(out.settings.amount, 20);
    assert.strictEqual(out.members, null);
    assert.strictEqual(out.totals, null);
    assert.match(out.note, /admin/i);
    assert.ok(!c.calls.some(([, p]) => p.endsWith('/members')));
  });

  test('reports no money totals when no amount is set', async () => {
    const out = await getDues(fakeClient({ group: { ...GROUP, duesAmountCents: null } }), { group: 'squad' });
    assert.strictEqual(out.settings.amount, null);
    assert.deepStrictEqual(out.totals, { members: 3, paid: 2, unpaid: 1, collected: null, outstanding: null });
  });

  test('tolerates a server that predates dues_marked_via', async () => {
    const members = MEMBERS.map(({ dues_marked_via, dues_marked_by_name, ...rest }) => rest);
    const out = await getDues(fakeClient({ members }), { group: 'squad' });
    assert.strictEqual(out.members[0].markedVia, null);
    assert.strictEqual(out.members[0].markedBy, null);
  });

  test('handles cents that are not whole dollars', async () => {
    const out = await getDues(fakeClient({ group: { ...GROUP, duesAmountCents: 2550 } }), { group: 'squad' });
    assert.strictEqual(out.settings.amount, 25.5);
    assert.strictEqual(out.totals.collected, 51);
    assert.strictEqual(out.totals.outstanding, 25.5);
  });
});

describe('updateDuesSettings', () => {
  test('sends only the one field it was given', async () => {
    const c = fakeClient();
    await updateDuesSettings(c, { group: 'squad', payoutNotes: 'Top two split 70/30' });
    assert.deepStrictEqual(writes(c), [['PUT', '/api/groups/squad/dues', { duesPayoutNotes: 'Top two split 70/30' }]]);
  });

  test('sends several fields at once, under the API names', async () => {
    const c = fakeClient();
    await updateDuesSettings(c, { group: 'squad', enabled: false, paymentMethod: 'cashapp', cashappHandle: '$dana', collectorUserId: 2 });
    assert.deepStrictEqual(writes(c)[0][2], { duesEnabled: false, duesPaymentMethod: 'cashapp', duesCashappHandle: '$dana', duesCollectorUserId: 2 });
  });

  // An agent told "$20" will send 20. The API unit is cents, where 20 is twenty
  // cents -- so the tool speaks dollars and converts.
  test('takes the amount in dollars and sends cents', async () => {
    const c = fakeClient();
    await updateDuesSettings(c, { group: 'squad', amount: 20 });
    assert.deepStrictEqual(writes(c)[0][2], { duesAmountCents: 2000 });
    const c2 = fakeClient();
    await updateDuesSettings(c2, { group: 'squad', amount: 25.5 });
    assert.deepStrictEqual(writes(c2)[0][2], { duesAmountCents: 2550 });
    const c3 = fakeClient();
    await updateDuesSettings(c3, { group: 'squad', amount: 19.99 });
    assert.deepStrictEqual(writes(c3)[0][2], { duesAmountCents: 1999 }, 'no float drift');
  });

  test('rejects an amount it would have to round, or that is not a positive number', async () => {
    for (const amount of [20.005, 0, -5, NaN, Infinity, '20']) {
      const c = fakeClient();
      await assert.rejects(() => updateDuesSettings(c, { group: 'squad', amount }), /amount/i, String(amount));
      assert.strictEqual(writes(c).length, 0);
    }
  });

  test('null clears the amount and the collector', async () => {
    const c = fakeClient();
    await updateDuesSettings(c, { group: 'squad', amount: null, collectorUserId: null });
    assert.deepStrictEqual(writes(c)[0][2], { duesAmountCents: null, duesCollectorUserId: null });
  });

  test('refuses to send an empty update', async () => {
    const c = fakeClient();
    await assert.rejects(() => updateDuesSettings(c, { group: 'squad' }), /nothing to update/i);
    await assert.rejects(() => updateDuesSettings(c, { group: 'squad', enabled: undefined }), /nothing to update/i);
    assert.strictEqual(writes(c).length, 0);
  });

  test('stops a non-admin before any write, in plain words', async () => {
    const c = fakeClient({ group: { ...GROUP, userRole: 'member' } });
    await assert.rejects(() => updateDuesSettings(c, { group: 'squad', enabled: false }), /not an admin of squad/i);
    assert.strictEqual(writes(c).length, 0);
  });

  // The compensating control for one scope covering the payment handle: whatever
  // changed is in the tool result, where the person can see it.
  test('returns what changed, before and after', async () => {
    const c = fakeClient({ put: async () => ({ ...GROUP, duesVenmoHandle: 'new-handle', duesCollectorUserId: 2, duesCollectorName: 'Sam Cole' }) });
    const out = await updateDuesSettings(c, { group: 'squad', venmoHandle: 'new-handle', collectorUserId: 2 });
    assert.deepStrictEqual(out.changed, ['venmoHandle', 'collector']);
    assert.strictEqual(out.before.venmoHandle, 'dana-r');
    assert.strictEqual(out.after.venmoHandle, 'new-handle');
    assert.deepStrictEqual(out.before.collector, { userId: 1, name: 'Dana Reyes' });
    assert.deepStrictEqual(out.after.collector, { userId: 2, name: 'Sam Cole' });
  });

  test('reports the fields a method change cleared, not just the ones sent', async () => {
    const c = fakeClient({ put: async () => ({ ...GROUP, duesPaymentMethod: 'other', duesVenmoHandle: null, duesInstructions: 'Zelle to Dana' }) });
    const out = await updateDuesSettings(c, { group: 'squad', paymentMethod: 'other', instructions: 'Zelle to Dana' });
    assert.deepStrictEqual(out.changed, ['paymentMethod', 'venmoHandle', 'instructions']);
  });
});

describe('setDuesPaid', () => {
  const postOk = async (p, b) => ({ userId: Number(p.split('/')[5]), duesPaidAt: b.paid ? '2026-09-21T15:00:00.000Z' : null });

  test('marks one member paid', async () => {
    const c = fakeClient({ post: postOk });
    const out = await setDuesPaid(c, { group: 'squad', members: [3], paid: true });
    assert.deepStrictEqual(writes(c), [['POST', '/api/groups/squad/members/3/dues', { paid: true }]]);
    assert.strictEqual(out.ok, true);
    assert.deepStrictEqual(out.results, [{
      userId: 3, name: 'Ari Voss', ok: true,
      before: { paid: false, paidAt: null }, after: { paid: true, paidAt: '2026-09-21T15:00:00.000Z' }
    }]);
  });

  test('marks a member unpaid', async () => {
    const c = fakeClient({ post: postOk });
    const out = await setDuesPaid(c, { group: 'squad', members: [2], paid: false });
    assert.deepStrictEqual(writes(c)[0][2], { paid: false });
    assert.deepStrictEqual(out.results[0].after, { paid: false, paidAt: null });
  });

  // Re-marking would overwrite the original paid date and who recorded it.
  test('leaves a member who is already in that state untouched', async () => {
    const c = fakeClient({ post: postOk });
    const out = await setDuesPaid(c, { group: 'squad', members: [2, 3], paid: true });
    assert.deepStrictEqual(writes(c).map(([, p]) => p), ['/api/groups/squad/members/3/dues']);
    assert.deepStrictEqual(out.results[0], {
      userId: 2, name: 'Sam Cole', ok: true, unchanged: true,
      before: { paid: true, paidAt: '2026-09-02T12:00:00.000Z' }, after: { paid: true, paidAt: '2026-09-02T12:00:00.000Z' }
    });
  });

  test('rejects an id that is not a member before writing anything', async () => {
    const c = fakeClient({ post: postOk });
    await assert.rejects(() => setDuesPaid(c, { group: 'squad', members: [3, 99], paid: true }), /99/);
    assert.strictEqual(writes(c).length, 0);
  });

  test('accepts ids as numbers or numeric strings, and de-duplicates', async () => {
    const c = fakeClient({ post: postOk });
    const out = await setDuesPaid(c, { group: 'squad', members: ['3', 3], paid: true });
    assert.strictEqual(writes(c).length, 1);
    assert.strictEqual(out.results.length, 1);
  });

  test('requires a real boolean and a non-empty member list', async () => {
    const c = fakeClient();
    for (const args of [{ members: [3] }, { members: [3], paid: 'true' }, { members: [], paid: true }, { members: 3, paid: true }, { paid: true }]) {
      await assert.rejects(() => setDuesPaid(c, { group: 'squad', ...args }), /paid|members/i, JSON.stringify(args));
    }
    assert.strictEqual(writes(c).length, 0);
  });

  test('stops a non-admin before any write', async () => {
    const c = fakeClient({ group: { ...GROUP, userRole: 'member' } });
    await assert.rejects(() => setDuesPaid(c, { group: 'squad', members: [3], paid: true }), /not an admin of squad/i);
    assert.strictEqual(writes(c).length, 0);
  });

  // One request per member, so a partial failure is a real outcome.
  test('reports a partial failure per member and keeps going', async () => {
    const members = [...MEMBERS, { id: 4, name: 'Lee Ito', role: 'member', dues_paid_at: null }];
    const c = fakeClient({ members, post: async (p, b) => { if (p.includes('/3/')) throw new Error('POST failed (500).'); return postOk(p, b); } });
    const out = await setDuesPaid(c, { group: 'squad', members: [3, 4], paid: true });
    assert.strictEqual(out.ok, false);
    assert.deepStrictEqual(out.results[0], { userId: 3, name: 'Ari Voss', ok: false, error: 'POST failed (500).' });
    assert.strictEqual(out.results[1].ok, true);
  });

  test('encodes the group identifier', async () => {
    const c = fakeClient({ post: postOk });
    await setDuesPaid(c, { group: 'a b', members: [3], paid: true });
    assert.ok(writes(c)[0][1].startsWith('/api/groups/a%20b/'));
  });
});
