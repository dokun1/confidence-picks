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

  const reminders = await runPickReminders({ now, deps });
  console.log(
    `[email] reminders: sent=${reminders.sent}${reminders.reason ? ` reason=${reminders.reason}` : ''}`
  );

  const summaries = await runWeeklySummaries({ now, deps });
  console.log(
    `[email] summaries: sent=${summaries.sent}${summaries.reason ? ` reason=${summaries.reason}` : ''}`
  );

  console.log(`[email] total sent this run: ${emailService.sentCount}`);
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Email send failed', err);
    pool.end(() => process.exit(1));
  });
