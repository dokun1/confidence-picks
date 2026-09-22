import { etDateKey, etHour, NFL_TIME_ZONE } from '../utils/etTime.js';
import { isPickLocked } from '../utils/pickLock.js';
import { signUnsubscribe } from '../utils/emailTokens.js';
import { EMAIL_TYPES } from '../models/EmailSend.js';
import { pickReminder } from '../emails/pickReminder.js';
import { weeklySummary } from '../emails/weeklySummary.js';

export const REMINDER_WINDOW_MS = 4 * 60 * 60 * 1000;
export const SUMMARY_SEND_HOUR_ET = 8;

// How stale a completed week may be and still be worth summarising, measured
// from its LAST kickoff.
//
// Without this, the job reports whatever the most recent fully-final week is,
// however long ago it ended — so the first run after a mid-season deploy mails
// everyone a recap of a week they had long forgotten. 36 hours covers the real
// case (a Monday night game ending ~23:30 ET, summarised at 08:00 ET Tuesday,
// about 12 hours later) with room for a postponement, and excludes anything
// older.
export const SUMMARY_MAX_AGE_MS = 36 * 60 * 60 * 1000;

const KICKOFF_FMT = new Intl.DateTimeFormat('en-US', {
  timeZone: NFL_TIME_ZONE,
  hour: 'numeric',
  minute: '2-digit',
  hour12: true,
});

function kickoffLabel(date) {
  return `${KICKOFF_FMT.format(date)} ET`;
}

function unsubscribeUrl(apiUrl, { userId, groupId, type }) {
  return `${apiUrl}/api/email/unsubscribe?token=${signUnsubscribe({ userId, groupId, type })}`;
}

/**
 * "You have picks to make today" — one email per user per Eastern day, fired by
 * the hourly cron when the day's first kickoff is four hours out or less.
 *
 * Window-based rather than exact-time: a scheduled GitHub Action can fire 5-30
 * minutes late, which should narrow the window rather than miss the moment.
 */
export async function runPickReminders({ now = new Date(), deps }) {
  const {
    pool,
    gameService,
    computeClosestWeek,
    emailService,
    emailSend,
    season,
    seasonType,
    appUrl,
    apiUrl = appUrl,
  } = deps;

  const week = await computeClosestWeek(season, seasonType);
  const games = await gameService.getGamesForWeek(season, seasonType, week, false);

  const todayKey = etDateKey(now);
  const todays = games.filter(
    (g) => etDateKey(new Date(g.gameDate)) === todayKey && !isPickLocked(g, now.getTime())
  );
  if (todays.length === 0) return { sent: 0, failed: 0, reason: 'no-open-games-today' };

  const firstKickoff = Math.min(...todays.map((g) => new Date(g.gameDate).getTime()));
  const msOut = firstKickoff - now.getTime();
  if (msOut <= 0 || msOut > REMINDER_WINDOW_MS) return { sent: 0, failed: 0, reason: 'outside-window' };

  // Opted-in members of NFL groups who are not globally paused.
  const { rows: candidates } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email,
            g.id AS group_id, g.name AS group_name, g.identifier
     FROM group_memberships gm
     JOIN users u ON u.id = gm.user_id
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.email_reminders = true
       AND u.email_paused_at IS NULL
       AND g.pool_type = 'nfl_weekly'`
  );
  if (candidates.length === 0) return { sent: 0, failed: 0, reason: 'no-subscribers' };

  const gameIds = todays.map((g) => g.id);
  const groupIds = [...new Set(candidates.map((c) => c.group_id))];

  // A pick counts as MADE only when both columns are set. UserPick.clearPending
  // writes NULL rows rather than deleting, so an EXISTS test would silently skip
  // the members who cleared a pick — exactly the people who need the reminder.
  const { rows: completed } = await pool.query(
    `SELECT user_id, group_id, game_id FROM user_picks
     WHERE group_id = ANY($1) AND game_id = ANY($2)
       AND picked_team_id IS NOT NULL AND confidence_level IS NOT NULL`,
    [groupIds, gameIds]
  );
  const done = new Set(completed.map((r) => `${r.user_id}:${r.group_id}:${r.game_id}`));

  // Fold the (user, group) rows into one entry per user: a member of five
  // groups gets one email, not five.
  const byUser = new Map();
  for (const c of candidates) {
    const outstanding = gameIds.filter((gid) => !done.has(`${c.user_id}:${c.group_id}:${gid}`)).length;
    if (outstanding === 0) continue;
    if (!byUser.has(c.user_id)) {
      byUser.set(c.user_id, { userId: c.user_id, name: c.name, email: c.email, groups: [] });
    }
    byUser.get(c.user_id).groups.push({
      name: c.group_name,
      identifier: c.identifier,
      count: outstanding,
    });
  }

  const label = kickoffLabel(new Date(firstKickoff));
  const dedupeKey = `reminder:${todayKey}`;
  let sent = 0;
  let failed = 0;

  for (const user of byUser.values()) {
    // Claim BEFORE sending. At-most-once by construction.
    const claimId = await emailSend.claim({
      userId: user.userId,
      groupId: null,
      emailType: EMAIL_TYPES.REMINDER,
      dedupeKey,
    });
    if (claimId === null) continue; // already sent today

    const unsub = unsubscribeUrl(apiUrl, {
      userId: user.userId,
      groupId: null,
      type: EMAIL_TYPES.REMINDER,
    });
    const { subject, html, text } = pickReminder({
      userName: user.name,
      groups: user.groups,
      kickoffLabel: label,
      unsubscribeUrl: unsub,
      appUrl,
    });

    try {
      const res = await emailService.send({
        to: user.email,
        subject,
        html,
        text,
        unsubscribeUrl: unsub,
        idempotencyKey: `${dedupeKey}:${user.userId}`,
      });
      await emailSend.markSent(claimId, res.id);
      if (!res.skipped) sent += 1;
    } catch (err) {
      // Recorded, not rethrown: one bad address must not abort the rest of the
      // run. The count is returned so the caller can fail the JOB — a run where
      // every send failed previously exited 0 and showed a green check.
      failed += 1;
      await emailSend.markFailed(claimId, err.message);
    }
  }

  return { sent, failed };
}

/**
 * The week in review, one email per group.
 *
 * "The morning after the last game" is derived, not pinned to a weekday: the
 * most recent week whose games are ALL final, sent in the 8am ET hour. That
 * covers Saturday-heavy weeks, flexed games and Tuesday postponement makeups
 * without a special case. Only the most recent complete week is considered, so
 * the job never backfills history; the claim row stops it re-sending.
 */
export async function runWeeklySummaries({ now = new Date(), deps }) {
  const {
    pool,
    buildScoreboard,
    buildWeekPickGrid,
    emailService,
    emailSend,
    season,
    seasonType,
    appUrl,
    apiUrl = appUrl,
  } = deps;

  if (etHour(now) !== SUMMARY_SEND_HOUR_ET) return { sent: 0, failed: 0, reason: 'not-send-hour' };

  const { rows: weekRows } = await pool.query(
    `SELECT week, COUNT(*) AS total, COUNT(*) FILTER (WHERE status = 'FINAL') AS final_count,
            EXTRACT(EPOCH FROM (MAX(game_date) AT TIME ZONE 'UTC')) AS last_kickoff_epoch
     FROM games
     WHERE season = $1 AND season_type = $2 AND league = 'nfl'
     GROUP BY week ORDER BY week DESC`,
    [season, seasonType]
  );
  const complete = weekRows.find(
    (r) => Number(r.total) > 0 && Number(r.total) === Number(r.final_count)
  );
  if (!complete) return { sent: 0, failed: 0, reason: 'no-completed-week' };
  const week = Number(complete.week);

  // Don't summarise a week that finished long ago. The epoch is computed in SQL
  // (game_date is a naive timestamp holding UTC) so this does not depend on the
  // process timezone the way a JS Date parse would.
  // Checked before the arithmetic: Number(null) is 0, not NaN, so a null epoch
  // would otherwise look like 1970 and report 'week-too-old' — failing closed,
  // but for a reason that would send you hunting the wrong bug.
  const epochRaw = complete.last_kickoff_epoch;
  const lastKickoffMs = epochRaw == null ? NaN : Number(epochRaw) * 1000;
  if (!Number.isFinite(lastKickoffMs)) return { sent: 0, failed: 0, reason: 'unknown-week-age' };
  if (now.getTime() - lastKickoffMs > SUMMARY_MAX_AGE_MS) {
    return { sent: 0, failed: 0, reason: 'week-too-old' };
  }

  const { rows: subscribers } = await pool.query(
    `SELECT u.id AS user_id, u.name, u.email,
            g.id AS group_id, g.name AS group_name, g.identifier
     FROM group_memberships gm
     JOIN users u ON u.id = gm.user_id
     JOIN groups g ON g.id = gm.group_id
     WHERE gm.email_summaries = true
       AND u.email_paused_at IS NULL
       AND g.pool_type = 'nfl_weekly'`
  );
  if (subscribers.length === 0) return { sent: 0, failed: 0, reason: 'no-subscribers' };

  // Group members together so the scoreboard is computed once per group rather
  // than once per recipient.
  const byGroup = new Map();
  for (const s of subscribers) {
    if (!byGroup.has(s.group_id)) {
      byGroup.set(s.group_id, {
        groupId: s.group_id,
        name: s.group_name,
        identifier: s.identifier,
        members: [],
      });
    }
    byGroup.get(s.group_id).members.push({ userId: s.user_id, name: s.name, email: s.email });
  }

  let sent = 0;
  let failed = 0;
  for (const group of byGroup.values()) {
    const [scoreboard, grid] = await Promise.all([
      buildScoreboard(group.groupId, season, seasonType),
      buildWeekPickGrid(group.groupId, season, seasonType, week),
    ]);
    const dedupeKey = `summary:${group.groupId}:${season}:${seasonType}:${week}`;

    for (const member of group.members) {
      const claimId = await emailSend.claim({
        userId: member.userId,
        groupId: group.groupId,
        emailType: EMAIL_TYPES.SUMMARY,
        dedupeKey,
      });
      if (claimId === null) continue;

      const unsub = unsubscribeUrl(apiUrl, {
        userId: member.userId,
        groupId: group.groupId,
        type: EMAIL_TYPES.SUMMARY,
      });
      const { subject, html, text } = weeklySummary({
        userName: member.name,
        groupName: group.name,
        week,
        grid,
        scoreboard,
        unsubscribeUrl: unsub,
        appUrl,
      });

      try {
        const res = await emailService.send({
          to: member.email,
          subject,
          html,
          text,
          unsubscribeUrl: unsub,
          idempotencyKey: `${dedupeKey}:${member.userId}`,
        });
        await emailSend.markSent(claimId, res.id);
        if (!res.skipped) sent += 1;
      } catch (err) {
        // See the note in runPickReminders: recorded, counted, not rethrown.
        failed += 1;
        await emailSend.markFailed(claimId, err.message);
      }
    }
  }

  return { sent, failed };
}
