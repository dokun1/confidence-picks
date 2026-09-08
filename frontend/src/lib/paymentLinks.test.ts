import { describe, it, expect } from 'vitest';
import {
  normalizeHandle,
  formatCents,
  buildVenmoLink,
  buildCashAppLink,
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

describe('buildVenmoLink', () => {
  it('builds the documented web deeplink with amount in dollars', () => {
    const url = buildVenmoLink('dana-smith', 2000, 'Fall dues');
    expect(url).toBe(
      'https://venmo.com/dana-smith?txn=pay&amount=20.00&note=Fall+dues',
    );
  });

  it('accepts a handle pasted with the @ sigil', () => {
    expect(buildVenmoLink('@dana-smith', 500, 'x')).toContain('venmo.com/dana-smith');
  });

  it('encodes spaces in the note as + per the Venmo format', () => {
    const url = buildVenmoLink('dana', 100, 'Q3 pool dues');
    expect(url).toContain('note=Q3+pool+dues');
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

  it('percent-encodes characters that would break the query string', () => {
    const url = buildVenmoLink('dana', 100, 'dues & fees');
    expect(url).toContain('%26');
    expect(url).not.toContain(' & ');
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
  it('is true when a Venmo handle is set', () => {
    expect(hasAnyPaymentMethod({ venmoHandle: 'dana' })).toBe(true);
  });

  it('is true when a Cash App handle is set', () => {
    expect(hasAnyPaymentMethod({ cashappHandle: 'dana' })).toBe(true);
  });

  it('is true when only free-text instructions are set', () => {
    expect(hasAnyPaymentMethod({ instructions: 'Zelle me at 555-0100' })).toBe(true);
  });

  it('is false when nothing is configured', () => {
    expect(hasAnyPaymentMethod({})).toBe(false);
    expect(
      hasAnyPaymentMethod({ venmoHandle: '  ', cashappHandle: null, instructions: '' }),
    ).toBe(false);
  });
});
