import { describe, it, expect } from 'vitest';
import {
  normalizeHandle,
  sanitizeNote,
  formatCents,
  buildVenmoLink,
  buildCashAppLink,
  buildPaymentLink,
  hasAnyPaymentMethod,
} from './paymentLinks';

describe('normalizeHandle', () => {
  it('strips a leading @ that Venmo users habitually paste', () => {
    expect(normalizeHandle('@dana-smith')).toBe('dana-smith');
  });

  it('strips a leading $ that Cash App users habitually paste', () => {
    expect(normalizeHandle('$danasmith')).toBe('danasmith');
  });

  it('trims surrounding whitespace', () => {
    expect(normalizeHandle('  dana  ')).toBe('dana');
  });

  it('returns null for blank input so callers can treat it as "unset"', () => {
    expect(normalizeHandle('   ')).toBeNull();
    expect(normalizeHandle('')).toBeNull();
    expect(normalizeHandle(null)).toBeNull();
    expect(normalizeHandle(undefined)).toBeNull();
  });

  it('strips only one leading sigil, not repeated ones', () => {
    expect(normalizeHandle('@@dana')).toBe('@dana');
  });
});

describe('formatCents', () => {
  it('renders whole dollars with cents', () => {
    expect(formatCents(2000)).toBe('$20.00');
  });

  it('renders sub-dollar amounts', () => {
    expect(formatCents(50)).toBe('$0.50');
  });

  it('groups thousands', () => {
    expect(formatCents(150000)).toBe('$1,500.00');
  });

  it('returns null when there is no amount to format', () => {
    expect(formatCents(null)).toBeNull();
  });
});

// The memo must survive venmo.com's web->app handoff, which re-encodes the
// query string with a form-urlencoder (spaces -> `+`) that the Venmo app then
// renders literally. That bridge runs even from Safari (verified on device), so
// percent-encoding cannot survive it. A note needing no escaping can't be
// re-escaped wrongly.
describe('sanitizeNote', () => {
  it('turns spaces into hyphens so no encoder can mangle them', () => {
    expect(sanitizeNote('Fall 2026 dues')).toBe('Fall-2026-dues');
  });

  it('collapses a run of punctuation and spaces into a single hyphen', () => {
    expect(sanitizeNote('dues  &  fees')).toBe('dues-fees');
  });

  it('strips leading and trailing hyphens', () => {
    expect(sanitizeNote('  !dues!  ')).toBe('dues');
  });

  it('leaves an already-safe note untouched', () => {
    expect(sanitizeNote('Fall-2026-dues')).toBe('Fall-2026-dues');
  });

  it('returns null when nothing survives', () => {
    expect(sanitizeNote('!!!')).toBeNull();
    expect(sanitizeNote('')).toBeNull();
    expect(sanitizeNote(null)).toBeNull();
  });
});

describe('buildVenmoLink', () => {
  it('builds the documented web deeplink with amount in dollars', () => {
    const url = buildVenmoLink('dana-smith', 2000, 'Fall dues');
    expect(url).toBe(
      'https://venmo.com/dana-smith?txn=pay&amount=20.00&note=Fall-dues',
    );
  });

  // The whole point of sanitizing: the emitted URL must contain no percent
  // escapes and no plus signs in the note, on any input.
  it('emits a note that needs no encoding at all', () => {
    const url = buildVenmoLink('dana', 2000, 'Q3 pool dues & fees');
    const note = url!.split('note=')[1];
    expect(note).toBe('Q3-pool-dues-fees');
    expect(note).not.toContain('%');
    expect(note).not.toContain('+');
  });

  it('accepts a handle pasted with the @ sigil', () => {
    expect(buildVenmoLink('@dana-smith', 500, 'x')).toContain('venmo.com/dana-smith');
  });

  it('renders spaces in the note as hyphens', () => {
    const url = buildVenmoLink('dana', 100, 'Q3 pool dues');
    expect(url).toContain('note=Q3-pool-dues');
    expect(url).not.toContain('+');
  });

  it('omits the note parameter when no note is given', () => {
    const url = buildVenmoLink('dana', 100, null);
    expect(url).toBe('https://venmo.com/dana?txn=pay&amount=1.00');
  });

  it('returns null without a handle, so callers render no button', () => {
    expect(buildVenmoLink(null, 2000, 'x')).toBeNull();
    expect(buildVenmoLink('  ', 2000, 'x')).toBeNull();
  });

  it('returns null without an amount', () => {
    expect(buildVenmoLink('dana', null, 'x')).toBeNull();
  });

  it('drops characters that would need escaping in the query string', () => {
    const url = buildVenmoLink('dana', 100, 'dues & fees');
    expect(url).toContain('note=dues-fees');
    expect(url).not.toContain('&fees');
  });

  it('omits the note when nothing survives sanitising', () => {
    expect(buildVenmoLink('dana', 100, '!!!')).toBe(
      'https://venmo.com/dana?txn=pay&amount=1.00',
    );
  });
});

describe('buildCashAppLink', () => {
  // Cash App puts the amount in the PATH, not a query param, and supports no
  // note parameter at all -- this asymmetry with Venmo is deliberate.
  it('puts the amount in the path segment', () => {
    expect(buildCashAppLink('danasmith', 2000)).toBe('https://cash.app/$danasmith/20.00');
  });

  it('accepts a cashtag pasted with the $ sigil', () => {
    expect(buildCashAppLink('$danasmith', 2000)).toBe('https://cash.app/$danasmith/20.00');
  });

  it('renders sub-dollar amounts', () => {
    expect(buildCashAppLink('dana', 75)).toBe('https://cash.app/$dana/0.75');
  });

  it('returns null without a cashtag', () => {
    expect(buildCashAppLink(null, 2000)).toBeNull();
  });

  it('returns null without an amount', () => {
    expect(buildCashAppLink('dana', null)).toBeNull();
  });
});

describe('hasAnyPaymentMethod', () => {
  it('is true when the chosen method has its value', () => {
    expect(hasAnyPaymentMethod({ method: 'venmo', venmoHandle: 'dana' })).toBe(true);
    expect(hasAnyPaymentMethod({ method: 'cashapp', cashappHandle: 'dana' })).toBe(true);
    expect(hasAnyPaymentMethod({ method: 'other', instructions: 'Zelle 555-0100' })).toBe(true);
  });

  // A stale handle from a previously-selected method must not count: the group
  // collects one way, and that way is whatever `method` says.
  it('ignores values belonging to a method that is not selected', () => {
    expect(hasAnyPaymentMethod({ method: 'cashapp', venmoHandle: 'dana' })).toBe(false);
    expect(hasAnyPaymentMethod({ method: 'venmo', instructions: 'Zelle me' })).toBe(false);
  });

  it('is false when the method is chosen but its value is blank', () => {
    expect(hasAnyPaymentMethod({ method: 'venmo', venmoHandle: '  ' })).toBe(false);
    expect(hasAnyPaymentMethod({ method: 'other', instructions: '' })).toBe(false);
  });

  it('is false when no method is chosen', () => {
    expect(hasAnyPaymentMethod({})).toBe(false);
    expect(hasAnyPaymentMethod({ method: null, venmoHandle: 'dana' })).toBe(false);
  });
});

describe('buildPaymentLink', () => {
  it('returns the Venmo link when Venmo is the chosen method', () => {
    const url = buildPaymentLink({ method: 'venmo', venmoHandle: 'dana' }, 2000, 'dues');
    expect(url).toBe('https://venmo.com/dana?txn=pay&amount=20.00&note=dues');
  });

  it('returns the Cash App link when Cash App is the chosen method', () => {
    const url = buildPaymentLink({ method: 'cashapp', cashappHandle: 'dana' }, 2000, 'dues');
    expect(url).toBe('https://cash.app/$dana/20.00');
  });

  it('returns null for the free-text method, which has no URL', () => {
    expect(buildPaymentLink({ method: 'other', instructions: 'Zelle me' }, 2000, 'x')).toBeNull();
  });

  it('ignores a handle that belongs to a non-selected method', () => {
    expect(buildPaymentLink({ method: 'cashapp', venmoHandle: 'dana' }, 2000, 'x')).toBeNull();
  });

  it('returns null when no method is chosen', () => {
    expect(buildPaymentLink({ venmoHandle: 'dana' }, 2000, 'x')).toBeNull();
  });
});
