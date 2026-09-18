import express from 'express';
import { verifyUnsubscribe } from '../utils/emailTokens.js';
import { Group } from '../models/Group.js';
import { User } from '../models/User.js';

const router = express.Router();

/**
 * Apply an unsubscribe claim. Returns null for anything that does not verify.
 *
 * Deliberately unauthenticated: the signed token IS the credential. Someone
 * clicking unsubscribe from their mail client is not logged in, and requiring a
 * login to stop email would make the link useless — and non-compliant.
 */
async function applyUnsubscribe(token) {
  const claim = verifyUnsubscribe(token);
  if (!claim) return null;

  // Reminder emails are batched across groups, so their token names no group.
  // The only honest reading of a click there is "stop emailing me".
  if (claim.groupId === null) {
    await User.setEmailPaused(claim.userId, true);
    return { scope: 'all' };
  }

  const prefs =
    claim.type === 'weekly_summary' ? { emailSummaries: false } : { emailReminders: false };
  await Group.setEmailPrefs(claim.groupId, claim.userId, prefs);
  return { scope: claim.type };
}

function page(message) {
  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title></head>
<body style="margin:0;padding:48px 16px;background:#f5f5f4;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Helvetica,Arial,sans-serif;color:#1c1917;">
<div style="max-width:480px;margin:0 auto;background:#fff;border:1px solid #e7e5e4;border-radius:8px;padding:24px;">
<h1 style="margin:0 0 12px 0;font-size:20px;">${message}</h1>
<p style="margin:0;font-size:14px;color:#57534e;">You can change this any time in your group settings.</p>
</div></body></html>`;
}

router.get('/unsubscribe', async (req, res) => {
  try {
    const result = await applyUnsubscribe(req.query.token);
    if (!result) {
      return res.status(400).type('html').send(page('That unsubscribe link is not valid.'));
    }
    return res
      .type('html')
      .send(page(result.scope === 'all' ? 'All emails are paused.' : "You're unsubscribed."));
  } catch (e) {
    return res.status(500).type('html').send(page('Something went wrong. Please try again.'));
  }
});

// RFC 8058 one-click target, named by the List-Unsubscribe-Post header. Mail
// clients POST here without a human ever seeing a page.
router.post('/unsubscribe', async (req, res) => {
  try {
    const token = req.body?.token ?? req.query.token;
    const result = await applyUnsubscribe(token);
    if (!result) return res.status(400).json({ error: 'Invalid token' });
    return res.json({ ok: true, scope: result.scope });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to unsubscribe' });
  }
});

export default router;
