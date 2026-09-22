import express from 'express';
import { timingSafeEqual } from 'crypto';

// Endpoints for admin.confidence-picks.com, the separate Next.js portal. The
// portal is the only caller and proves itself with ADMIN_API_SECRET, a machine
// secret shared by the two Vercel projects. Human identity (who is signed in)
// is the portal's concern; this layer only answers "does this email belong to
// an admin", from the same ADMIN_EMAILS allowlist that gates routes/admin.js.
//
// Same posture as findplayplace's server/src/middleware/admin-api.ts: constant-
// time compare, and an unset secret makes the whole surface inert (401), not
// hidden (404) and never open.

const router = express.Router();
const BEARER = 'Bearer ';

function safeEqual(provided, expected) {
  if (typeof expected !== 'string' || expected.length === 0) return false;
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export function requireAdminApi(req, res, next) {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith(BEARER) ? header.slice(BEARER.length) : '';
  if (!safeEqual(token, process.env.ADMIN_API_SECRET)) {
    return res.status(401).json({ error: 'invalid admin credentials' });
  }
  next();
}

// Parsed per request so a redeploy-free env change takes effect immediately.
export function allowlistedEmails() {
  return (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

router.use('/admin-portal', requireAdminApi);

router.get('/admin-portal/allowlist/check', (req, res) => {
  const email = String(req.query.email ?? '').trim().toLowerCase();
  const allowed = email.length > 0 && allowlistedEmails().includes(email);
  res.json({ allowed });
});

export default router;
