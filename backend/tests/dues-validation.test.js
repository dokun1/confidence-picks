import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  validateDuesUpdates,
  normalizeHandle,
  DUES_METHODS,
} from '../src/utils/duesValidation.js';

describe('normalizeHandle', () => {
  it('strips a leading @ that Venmo users paste', () => {
    assert.strictEqual(normalizeHandle('@dana-reyes'), 'dana-reyes');
  });

  it('strips a leading $ that Cash App users paste', () => {
    assert.strictEqual(normalizeHandle('$danareyes'), 'danareyes');
  });

  it('trims surrounding whitespace', () => {
    assert.strictEqual(normalizeHandle('  dana  '), 'dana');
  });

  it('treats blank input as unset', () => {
    assert.strictEqual(normalizeHandle('   '), null);
    assert.strictEqual(normalizeHandle(''), null);
    assert.strictEqual(normalizeHandle(null), null);
    assert.strictEqual(normalizeHandle(undefined), null);
  });
});

describe('validateDuesUpdates: amount', () => {
  it('accepts a whole number of cents', () => {
    const updates = { duesAmountCents: 2000 };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesAmountCents, 2000);
  });

  it('coerces a numeric string to a number', () => {
    const updates = { duesAmountCents: '2000' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesAmountCents, 2000);
  });

  it('treats null and empty string as clearing the amount', () => {
    for (const raw of [null, '']) {
      const updates = { duesAmountCents: raw };
      assert.strictEqual(validateDuesUpdates(updates), null);
      assert.strictEqual(updates.duesAmountCents, null);
    }
  });

  it('rejects zero and negatives', () => {
    for (const raw of [0, -1, -2000]) {
      assert.match(
        validateDuesUpdates({ duesAmountCents: raw }),
        /greater than zero/,
        `expected ${raw} to be rejected`,
      );
    }
  });

  it('rejects fractional cents', () => {
    assert.match(validateDuesUpdates({ duesAmountCents: 20.5 }), /whole number/);
  });

  it('rejects non-numeric input', () => {
    assert.match(validateDuesUpdates({ duesAmountCents: 'twenty' }), /whole number/);
  });

  // A stray keystroke turning $20 into $200,000 must not reach a deeplink.
  it('rejects an amount over $10,000', () => {
    assert.match(validateDuesUpdates({ duesAmountCents: 1000001 }), /\$10,000 or less/);
  });

  it('accepts exactly $10,000', () => {
    const updates = { duesAmountCents: 1000000 };
    assert.strictEqual(validateDuesUpdates(updates), null);
  });

  it('leaves the amount untouched when the key is absent', () => {
    const updates = { name: 'Pool' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.ok(!('duesAmountCents' in updates));
  });
});

describe('validateDuesUpdates: handles', () => {
  it('normalises a Venmo handle pasted with @', () => {
    const updates = { duesVenmoHandle: '@Candace-Henson-1' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesVenmoHandle, 'Candace-Henson-1');
  });

  it('normalises a cashtag pasted with $', () => {
    const updates = { duesCashappHandle: '$nalgaskat' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesCashappHandle, 'nalgaskat');
  });

  it('rejects handles containing spaces or punctuation', () => {
    for (const bad of ['dana reyes', 'dana.reyes', 'dana/reyes', 'dana@reyes']) {
      assert.match(
        validateDuesUpdates({ duesVenmoHandle: bad }),
        /letters, numbers, hyphens and underscores/,
        `expected "${bad}" to be rejected`,
      );
    }
  });

  it('names the offending field in the error', () => {
    assert.match(validateDuesUpdates({ duesVenmoHandle: 'a b' }), /Venmo username/);
    assert.match(validateDuesUpdates({ duesCashappHandle: 'a b' }), /Cash App cashtag/);
  });

  it('rejects a handle longer than 50 characters', () => {
    assert.match(validateDuesUpdates({ duesVenmoHandle: 'a'.repeat(51) }), /letters, numbers/);
  });

  it('treats a blank handle as clearing it', () => {
    const updates = { duesVenmoHandle: '   ' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesVenmoHandle, null);
  });
});

describe('validateDuesUpdates: payment method', () => {
  it('accepts each supported method', () => {
    for (const method of DUES_METHODS) {
      assert.strictEqual(validateDuesUpdates({ duesPaymentMethod: method }), null);
    }
  });

  it('rejects an unknown method', () => {
    assert.match(validateDuesUpdates({ duesPaymentMethod: 'paypal' }), /must be one of/);
  });

  // The core single-method guarantee: the database must never hold a second
  // method that the UI would not show but a later query could pick up.
  it('clears Cash App and instructions when Venmo is selected', () => {
    const updates = {
      duesPaymentMethod: 'venmo',
      duesVenmoHandle: 'dana',
      duesCashappHandle: 'dana',
      duesInstructions: 'Zelle me',
    };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesVenmoHandle, 'dana');
    assert.strictEqual(updates.duesCashappHandle, null);
    assert.strictEqual(updates.duesInstructions, null);
  });

  it('clears Venmo and instructions when Cash App is selected', () => {
    const updates = {
      duesPaymentMethod: 'cashapp',
      duesVenmoHandle: 'dana',
      duesCashappHandle: 'dana',
      duesInstructions: 'Zelle me',
    };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesVenmoHandle, null);
    assert.strictEqual(updates.duesCashappHandle, 'dana');
    assert.strictEqual(updates.duesInstructions, null);
  });

  it('clears both handles when the free-text method is selected', () => {
    const updates = {
      duesPaymentMethod: 'other',
      duesVenmoHandle: 'dana',
      duesCashappHandle: 'dana',
      duesInstructions: 'Zelle me',
    };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesVenmoHandle, null);
    assert.strictEqual(updates.duesCashappHandle, null);
    assert.strictEqual(updates.duesInstructions, 'Zelle me');
  });

  it('clears every method field when the method is unset', () => {
    const updates = {
      duesPaymentMethod: null,
      duesVenmoHandle: 'dana',
      duesCashappHandle: 'dana',
      duesInstructions: 'Zelle me',
    };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesVenmoHandle, null);
    assert.strictEqual(updates.duesCashappHandle, null);
    assert.strictEqual(updates.duesInstructions, null);
  });

  it('leaves the other fields alone when the method is not being changed', () => {
    const updates = { duesVenmoHandle: 'dana', duesCashappHandle: 'sam' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesVenmoHandle, 'dana');
    assert.strictEqual(updates.duesCashappHandle, 'sam');
  });
});

describe('validateDuesUpdates: payout notes', () => {
  it('trims and keeps the notes', () => {
    const updates = { duesPayoutNotes: '  Winner takes all.  ' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesPayoutNotes, 'Winner takes all.');
  });

  it('treats blank notes as unset', () => {
    const updates = { duesPayoutNotes: '   ' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesPayoutNotes, null);
  });

  it('rejects notes over the length cap', () => {
    assert.match(validateDuesUpdates({ duesPayoutNotes: 'x'.repeat(1001) }), /1000 characters/);
  });

  it('accepts notes exactly at the cap', () => {
    assert.strictEqual(validateDuesUpdates({ duesPayoutNotes: 'x'.repeat(1000) }), null);
  });

  // Payout is money OUT; the method is money IN. Changing how members pay must
  // not silently erase how the pot is split.
  it('survives a payment method change, unlike the handles', () => {
    const updates = {
      duesPaymentMethod: 'cashapp',
      duesVenmoHandle: 'dana',
      duesPayoutNotes: 'Winner takes all.',
    };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.strictEqual(updates.duesVenmoHandle, null, 'handle should be cleared');
    assert.strictEqual(
      updates.duesPayoutNotes,
      'Winner takes all.',
      'payout notes must survive the method change',
    );
  });
});

describe('validateDuesUpdates: instructions and enabled flag', () => {
  it('rejects instructions over the length cap', () => {
    assert.match(
      validateDuesUpdates({ duesInstructions: 'x'.repeat(1001) }),
      /1000 characters/,
    );
  });

  it('coerces duesEnabled to a real boolean', () => {
    for (const [raw, expected] of [[1, true], [0, false], ['yes', true], ['', false]]) {
      const updates = { duesEnabled: raw };
      assert.strictEqual(validateDuesUpdates(updates), null);
      assert.strictEqual(updates.duesEnabled, expected, `for input ${JSON.stringify(raw)}`);
    }
  });

  it('accepts a payload with no dues fields at all', () => {
    const updates = { name: 'Renamed', description: 'x' };
    assert.strictEqual(validateDuesUpdates(updates), null);
    assert.deepStrictEqual(updates, { name: 'Renamed', description: 'x' });
  });
});
