import crypto from 'node:crypto';

const TYPES = new Set(['pick_reminder', 'weekly_summary']);

// A dedicated secret, deliberately NOT JWT_SECRET: an unsubscribe link lives in
// an inbox forever, so rotating the session signing key must not break links
// already sent. The tokens carry no expiry for the same reason.
function secret() {
  const s = process.env.EMAIL_TOKEN_SECRET;
  if (!s) throw new Error('EMAIL_TOKEN_SECRET is not set');
  return s;
}

function mac(payload) {
  return crypto.createHmac('sha256', secret()).update(payload).digest('base64url');
}

/**
 * Sign an unsubscribe claim. `groupId` may be null for reminder emails, which
 * are batched across groups and so cannot name one.
 */
export function signUnsubscribe({ userId, groupId, type }) {
  if (!TYPES.has(type)) throw new Error(`Unknown email type: ${type}`);
  const payload = `${userId}.${groupId ?? ''}.${type}`;
  return `${Buffer.from(payload).toString('base64url')}.${mac(payload)}`;
}

/** Returns the claim, or null for anything that does not verify. */
export function verifyUnsubscribe(token) {
  if (typeof token !== 'string' || !token.includes('.')) return null;

  const idx = token.lastIndexOf('.');
  const provided = token.slice(idx + 1);
  let payload;
  try {
    payload = Buffer.from(token.slice(0, idx), 'base64url').toString('utf8');
  } catch {
    return null;
  }

  const expected = mac(payload);
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // Length check first: timingSafeEqual THROWS on mismatched lengths rather
  // than returning false.
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

  const [userId, groupId, type] = payload.split('.');
  if (!TYPES.has(type)) return null;
  const uid = Number(userId);
  if (!Number.isInteger(uid)) return null;

  return {
    userId: uid,
    groupId: groupId === '' ? null : Number(groupId),
    type,
  };
}
