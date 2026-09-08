/**
 * Validation and normalisation for the dues fields on PUT /groups/:identifier.
 *
 * Extracted from the route so it can be unit-tested without a database or an
 * HTTP server: every rule here is a pure function of the request body.
 */

// Venmo usernames and Cash App cashtags are both [A-Za-z0-9_-] with a length
// cap; users habitually paste them with the leading @ or $, so accept and strip
// it rather than rejecting. Kept deliberately permissive -- we are building a
// URL, not authenticating against either service, and a wrong handle simply
// lands the payer on a "user not found" page.
export const HANDLE_RE = /^[A-Za-z0-9_-]{1,50}$/;

// A group collects dues one way. 'other' carries free-text instructions for
// everything neither service covers (Zelle, cash, check).
export const DUES_METHODS = ['venmo', 'cashapp', 'other'];

// $10,000 ceiling: this is a rec-league pool, and a stray keystroke turning $20
// into $200000 should not reach a payment deeplink.
export const MAX_DUES_CENTS = 1000000;

export const MAX_TEXT_LENGTH = 1000;

export function normalizeHandle(raw) {
  if (raw === null || raw === undefined) return null;
  const trimmed = String(raw).trim().replace(/^[@$]/, '');
  return trimmed.length === 0 ? null : trimmed;
}

/** Trim to null-or-content, rejecting anything over the length cap. */
function normalizeText(raw, label) {
  const text = raw === null || raw === undefined ? null : String(raw).trim();
  if (text && text.length > MAX_TEXT_LENGTH) {
    return { error: `${label} must be ${MAX_TEXT_LENGTH} characters or less` };
  }
  return { value: text && text.length > 0 ? text : null };
}

/**
 * Validate + normalise the dues fields on a PUT body. Mutates `updates` in
 * place (stripping @/$ from handles, coercing blanks to NULL, clearing the
 * columns that the selected payment method does not use) and returns an error
 * string, or null when the payload is acceptable.
 *
 * Deliberately does NOT require a payment method when dues are enabled: an
 * admin may legitimately turn dues on, then fill in the handle afterwards, and
 * blocking that makes the settings form hostile to fill out top-to-bottom.
 *
 * Collector membership is NOT checked here -- it needs the group's member list,
 * so the route does it after resolving the group.
 */
export function validateDuesUpdates(updates) {
  if (Object.prototype.hasOwnProperty.call(updates, 'duesAmountCents')) {
    const raw = updates.duesAmountCents;
    if (raw === null || raw === '') {
      updates.duesAmountCents = null;
    } else {
      const cents = Number(raw);
      if (!Number.isInteger(cents) || cents <= 0) {
        return 'Dues amount must be a whole number of cents greater than zero';
      }
      if (cents > MAX_DUES_CENTS) {
        return 'Dues amount must be $10,000 or less';
      }
      updates.duesAmountCents = cents;
    }
  }

  for (const field of ['duesVenmoHandle', 'duesCashappHandle']) {
    if (!Object.prototype.hasOwnProperty.call(updates, field)) continue;
    const handle = normalizeHandle(updates[field]);
    if (handle !== null && !HANDLE_RE.test(handle)) {
      const label = field === 'duesVenmoHandle' ? 'Venmo username' : 'Cash App cashtag';
      return `${label} may only contain letters, numbers, hyphens and underscores`;
    }
    updates[field] = handle;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'duesInstructions')) {
    const result = normalizeText(updates.duesInstructions, 'Payment instructions');
    if (result.error) return result.error;
    updates.duesInstructions = result.value;
  }

  // Payout notes survive a method change: how the pot is split has nothing to
  // do with how it was collected, so this is NOT cleared below.
  if (Object.prototype.hasOwnProperty.call(updates, 'duesPayoutNotes')) {
    const result = normalizeText(updates.duesPayoutNotes, 'Payout notes');
    if (result.error) return result.error;
    updates.duesPayoutNotes = result.value;
  }

  if (Object.prototype.hasOwnProperty.call(updates, 'duesEnabled')) {
    updates.duesEnabled = Boolean(updates.duesEnabled);
  }

  // A group collects dues exactly one way. When the method is specified, the
  // other value columns are cleared here rather than merely ignored, so the
  // database never holds a second method that the UI would not show but a later
  // query might pick up.
  if (Object.prototype.hasOwnProperty.call(updates, 'duesPaymentMethod')) {
    const method = updates.duesPaymentMethod || null;
    if (method !== null && !DUES_METHODS.includes(method)) {
      return `Payment method must be one of: ${DUES_METHODS.join(', ')}`;
    }
    updates.duesPaymentMethod = method;

    if (method === 'venmo') {
      updates.duesCashappHandle = null;
      updates.duesInstructions = null;
    } else if (method === 'cashapp') {
      updates.duesVenmoHandle = null;
      updates.duesInstructions = null;
    } else if (method === 'other') {
      updates.duesVenmoHandle = null;
      updates.duesCashappHandle = null;
    } else {
      updates.duesVenmoHandle = null;
      updates.duesCashappHandle = null;
      updates.duesInstructions = null;
    }
  }

  return null;
}
