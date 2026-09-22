#!/usr/bin/env node
/**
 * Send NFL pick reminders and weekly summaries.
 *
 * Runs hourly from .github/workflows/nfl-emails.yml. Both jobs are cheap no-ops
 * outside their windows, so one hourly invocation is the whole schedule.
 *
 * Environment variables:
 *  RESEND_API_KEY       required to actually send
 *  EMAIL_TOKEN_SECRET   required — signs unsubscribe links
 *  EMAIL_FROM           e.g. "Confidence Picks <noreply@confidence-picks.com>"
 *  EMAIL_REPLY_TO       e.g. hello@noetalabs.tech
 *  EMAIL_DRY_RUN        defaults TRUE; only the literal 'false' enables sending
 *  EMAIL_MAX_PER_RUN    defaults 80
 *  FRONTEND_BASE_URL    links in emails point here
 *  API_BASE_URL         unsubscribe links point here
 *
 * Locally these come from the macOS keychain:
 *   envchain confidence-picks pnpm run email:send
 *
 * Exit codes: 0 success, 1 failure.
 */
import '../config/database.js'; // loads env + pool listeners
import pool from '../config/database.js';
import { GameService } from '../services/GameService.js';
import { getCurrentNFLSeason } from '../utils/nflSeasonUtils.js';
import { computeClosestWeek } from '../routes/picks.js';
import { buildScoreboard, buildWeekPickGrid } from '../services/NflScoreboardService.js';
import { createEmailService } from '../services/EmailService.js';
import { EmailSend } from '../models/EmailSend.js';
import { Group } from '../models/Group.js';
import { runPickReminders, runWeeklySummaries } from '../services/NflEmailJobs.js';

/**
 * An in-memory stand-in for the claim ledger, used only in dry runs.
 *
 * The jobs claim before sending, so a dry run against the real table would
 * write claim rows and silently suppress the real send later — the dedupe key
 * for that day would already be taken. A dry run must leave no trace.
 */
function dryRunLedger() {
  const claimed = new Set();
  return {
    async claim({ userId, emailType, dedupeKey }) {
      const key = `${userId}:${emailType}:${dedupeKey}`;
      if (claimed.has(key)) return null;
      claimed.add(key);
      return -1; // a sentinel id; markSent/markFailed ignore it
    },
    async markSent() {},
    async markFailed() {},
  };
}

async function main() {
  const emailService = createEmailService();
  if (emailService.dryRun) {
    console.log('[email] DRY RUN — no mail will be sent, and no claim rows are written.');
    console.log('[email] Set EMAIL_DRY_RUN=false to send for real.');
  }

  // Fail fast and loudly: a missing secret must not look like "nothing to do".
  if (!process.env.EMAIL_TOKEN_SECRET) {
    throw new Error('EMAIL_TOKEN_SECRET is not set — unsubscribe links cannot be signed');
  }

  // Without a connection string, pg silently defaults to localhost:5432 and the
  // run dies with a bare ECONNREFUSED that says nothing about the real problem.
  if (!process.env.PROD_DATABASE_URL && !process.env.DATABASE_URL) {
    throw new Error(
      'No database URL set — expected PROD_DATABASE_URL or DATABASE_URL (repository secret DATABASE_URL)'
    );
  }

  // Self-heal BOTH schemas this process depends on. The jobs query
  // gm.email_reminders / gm.email_summaries straight through the pool, and
  // those columns are otherwise only healed by Group.findByIdentifier — which
  // runs on the web backend, not here. On a freshly deployed database where
  // nobody has opened a group page yet, the candidate query would throw
  // 'column does not exist' on the first game day. Both calls latch, so every
  // later run is a zero-query no-op.
  await Group.ensureEmailPrefsSchema();
  if (!emailService.dryRun) await EmailSend.ensureSchema();

  const deps = {
    pool,
    gameService: GameService,
    computeClosestWeek,
    buildScoreboard,
    buildWeekPickGrid,
    emailService,
    emailSend: emailService.dryRun ? dryRunLedger() : EmailSend,
    season: getCurrentNFLSeason(),
    seasonType: 2,
    appUrl: process.env.FRONTEND_BASE_URL || 'https://www.confidence-picks.com',
    apiUrl: process.env.API_BASE_URL || 'https://api.confidence-picks.com',
  };

  const now = new Date();
  console.log(`[email] run at ${now.toISOString()} season=${deps.season}`);

  const line = (label, r) =>
    `[email] ${label}: sent=${r.sent} failed=${r.failed ?? 0}` +
    (r.reason ? ` reason=${r.reason}` : '');

  const reminders = await runPickReminders({ now, deps });
  console.log(line('reminders', reminders));

  const summaries = await runWeeklySummaries({ now, deps });
  console.log(line('summaries', summaries));

  const sent = reminders.sent + summaries.sent;
  const failed = (reminders.failed ?? 0) + (summaries.failed ?? 0);

  // `sentCount` counts ATTEMPTS against the per-run cap, not deliveries. It was
  // previously logged as "total sent", which made a run where every send failed
  // read like a success at a glance -- the reason a broken API key went
  // unnoticed for a day.
  console.log(`[email] delivered=${sent} failed=${failed} attempted=${emailService.sentCount}`);

  // Fail the job so GitHub shows a red X. Failures are recorded per-row in
  // email_sends, but a green check on a run that delivered nothing is worse
  // than useless -- it actively hides the outage.
  if (failed > 0) {
    throw new Error(`${failed} email(s) failed to send — see email_sends.error for details`);
  }
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Email send failed', err);
    pool.end(() => process.exit(1));
  });
