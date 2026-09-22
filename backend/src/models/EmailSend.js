import pool from '../config/database.js';

export const EMAIL_TYPES = {
  REMINDER: 'pick_reminder',
  SUMMARY: 'weekly_summary',
};

/**
 * The send ledger, and the whole idempotency story.
 *
 * A row is claimed BEFORE the provider call, never after. That makes delivery
 * at-most-once: a crash between claim and send loses one email, where the
 * opposite ordering would turn every retry and every duplicate cron dispatch
 * into a duplicate inbox delivery. Duplicate mail is what makes people
 * unsubscribe; a missed reminder is a nuisance. The asymmetry decides it.
 *
 * Dedupe keys:
 *   reminder: `reminder:<ET date>`                      (one per user per day)
 *   summary:  `summary:<groupId>:<season>:<type>:<week>` (one per user per week)
 */
export class EmailSend {
  // Self-heal latch, mirroring the Group.ensure* pattern. Prod runs with
  // INIT_DB unset, so schema.sql never executes on deploy.
  static _schemaEnsured = false;

  static async ensureSchema() {
    if (this._schemaEnsured) return; // warm-instance fast path
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS email_sends (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          group_id INTEGER NULL REFERENCES groups(id) ON DELETE CASCADE,
          email_type VARCHAR(32) NOT NULL,
          dedupe_key VARCHAR(120) NOT NULL,
          provider_message_id VARCHAR(80) NULL,
          status VARCHAR(20) NOT NULL,
          error TEXT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(user_id, email_type, dedupe_key)
        )
      `);
      this._schemaEnsured = true;
    } catch (e) {
      // Do NOT latch on failure — let the next call retry.
      console.warn('[email] Failed to ensure email_sends table:', e.message);
    }
  }

  /**
   * Stake a claim on one send. Returns a row id to send against, or null when
   * this key is already spoken for — in which case the caller MUST NOT send.
   *
   * A row in 'failed' state is reclaimed rather than treated as spoken for. The
   * original version used ON CONFLICT DO NOTHING, which conflated "already
   * attempted" with "already delivered": a provider outage (or, in the case
   * that found this, an invalid API key) permanently burned the dedupe key, and
   * the email could never be retried without deleting rows by hand.
   *
   * At-most-once is still the guarantee. 'claimed' and 'sent' both stay locked;
   * only a recorded failure — which by definition did not reach anyone — opens
   * the key again. The DO UPDATE ... WHERE is atomic: when the predicate is
   * false no row is touched and RETURNING yields nothing, so two concurrent
   * runners cannot both win the same claim.
   */
  static async claim({ userId, groupId, emailType, dedupeKey }) {
    await EmailSend.ensureSchema();
    const { rows } = await pool.query(
      `INSERT INTO email_sends (user_id, group_id, email_type, dedupe_key, status)
       VALUES ($1, $2, $3, $4, 'claimed')
       ON CONFLICT (user_id, email_type, dedupe_key) DO UPDATE
         SET status = 'claimed',
             error = NULL,
             provider_message_id = NULL,
             created_at = CURRENT_TIMESTAMP
         WHERE email_sends.status = 'failed'
       RETURNING id`,
      [userId, groupId, emailType, dedupeKey]
    );
    return rows.length > 0 ? rows[0].id : null;
  }

  static async markSent(id, providerMessageId) {
    await pool.query(
      `UPDATE email_sends SET status = 'sent', provider_message_id = $2 WHERE id = $1`,
      [id, providerMessageId ?? null]
    );
  }

  static async markFailed(id, message) {
    await pool.query(`UPDATE email_sends SET status = 'failed', error = $2 WHERE id = $1`, [
      id,
      String(message).slice(0, 2000),
    ]);
  }
}
