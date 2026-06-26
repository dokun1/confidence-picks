import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { Group } from '../models/Group.js';
import { UserPick, WORLD_CUP_RESULTS } from '../models/UserPick.js';
import { computeLive, getGroupLeaderboardCached, leaderboardsMatch } from '../services/WorldCupLeaderboardService.js';
import pool from '../config/database.js';

const router = express.Router();

// Membership gate, identical in shape to the NFL picks routes: resolve the group
// for this user and reject when the group is missing or the caller isn't a member.
async function ensureMembership(groupIdentifier, userId) {
  const group = await Group.findByIdentifier(groupIdentifier, userId);
  if (!group) throw new Error('GROUP_NOT_FOUND');
  if (!group.userRole) throw new Error('NOT_MEMBER');
  return group;
}

// Knockout-only enforcement. In a world_cup_2026 group created with
// knockout_only=true, members may pick only knockout-stage games; the group stage
// is off-limits. The frontend hides group-stage games for these pools, so a
// group-stage gameId arriving here is anomalous — reject the whole batch with the
// offending ids rather than silently dropping them. Returns the offending ids
// (empty when the group is unrestricted or every pick is a knockout game).
function groupStagePickViolations(group, picks, gameById) {
  if (!group.knockoutOnly) return [];
  return picks
    .filter((p) => gameById.get(p.gameId)?.stage === 'group')
    .map((p) => p.gameId);
}

/**
 * Submit World Cup picks for the authenticated user in a group.
 *
 * Body: { picks: [{ gameId, pickedResult: 'home'|'away'|'draw' }] }
 *
 * Picks persist through the UserPick World Cup upsert path: `picked_result` is
 * stored, confidence/picked_team_id stay NULL. Each submitted gameId is verified
 * to be a World Cup game so the (season, season_type, week) NOT NULL columns can
 * be filled from the game row rather than trusted from the client. Picks are
 * grouped by their game's slot because a single submission may span stages with
 * different week numbers, and the upsert builder takes one slot per call.
 */
router.post('/group/:groupId/world-cup', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { picks } = req.body;

    if (!Array.isArray(picks)) {
      return res.status(400).json({ error: 'picks array required' });
    }

    // Validate the pick shape before touching the DB. World Cup picks carry only
    // a gameId and a side-relative result.
    for (const p of picks) {
      if (p.gameId == null) {
        return res.status(400).json({ error: 'Missing gameId' });
      }
      if (!WORLD_CUP_RESULTS.includes(p.pickedResult)) {
        return res.status(400).json({ error: 'Invalid pickedResult', gameId: p.gameId, pickedResult: p.pickedResult });
      }
    }

    const group = await ensureMembership(groupId, req.user.id);

    if (picks.length === 0) {
      return res.json({ picks: [] });
    }

    // Confirm every submitted game is a persisted World Cup game and read back the
    // slot columns (season/season_type/week) the upsert requires.
    const gameIds = picks.map(p => p.gameId);
    const { rows: gameRows } = await pool.query(
      `SELECT id, season, season_type, week, game_date, stage FROM games WHERE id = ANY($1::int[]) AND league = 'world_cup'`,
      [gameIds]
    );
    const gameById = new Map(gameRows.map(g => [g.id, g]));

    for (const p of picks) {
      if (!gameById.has(p.gameId)) {
        return res.status(400).json({ error: 'Invalid gameId', gameId: p.gameId });
      }
    }

    // Knockout-only groups reject any group-stage pick outright (see helper).
    const groupStageIds = groupStagePickViolations(group, picks, gameById);
    if (groupStageIds.length > 0) {
      return res.status(400).json({ error: 'Group-stage picks are not allowed in this group', gameIds: groupStageIds });
    }

    // Lock picks at kickoff. game_date (the scheduled start) is the authoritative,
    // stable boundary — we never trust the client and we never key off the live
    // status, because ESPN can briefly flap an in-progress match back to
    // SCHEDULED. Any pick whose kickoff has passed is dropped (its previously
    // saved value is preserved untouched); the rest of the submission still
    // saves. The client submits the whole slate each time, so rejecting the
    // entire batch would make every pick unsavable once the first match starts —
    // hence skip-and-save-rest, with the locked ids reported back.
    const now = Date.now();
    const lockedGameIds = [];
    const openPicks = picks.filter(p => {
      const g = gameById.get(p.gameId);
      if (g && new Date(g.game_date).getTime() <= now) {
        lockedGameIds.push(p.gameId);
        return false;
      }
      return true;
    });

    if (openPicks.length === 0) {
      return res.json({ picks: [], lockedGameIds });
    }

    // Group picks by their game's (season, season_type, week) slot — one upsert call
    // per slot keeps the parameter columns consistent across mixed-stage submissions.
    const bySlot = new Map();
    for (const p of openPicks) {
      const g = gameById.get(p.gameId);
      const key = `${g.season}|${g.season_type}|${g.week}`;
      if (!bySlot.has(key)) {
        bySlot.set(key, { season: g.season, seasonType: g.season_type, week: g.week, picks: [] });
      }
      bySlot.get(key).picks.push({ gameId: p.gameId, pickedResult: p.pickedResult });
    }

    const saved = [];
    for (const slot of bySlot.values()) {
      const rows = await UserPick.bulkUpsertWorldCupPicks({
        userId: req.user.id,
        groupId: group.id,
        season: slot.season,
        seasonType: slot.seasonType,
        week: slot.week,
        picks: slot.picks,
      });
      saved.push(...rows);
    }

    res.json({
      picks: saved.map(p => ({ gameId: p.gameId, pickedResult: p.pickedResult })),
      lockedGameIds,
    });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    if (e.message && /Invalid picked_result|missing gameId/.test(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    console.error('POST world-cup picks error', e);
    res.status(500).json({ error: 'Failed to save World Cup picks' });
  }
});

/**
 * Read the authenticated user's own World Cup picks for a group.
 *
 * Returns the same shape POST accepts and writes: `{ picks: [{ gameId,
 * pickedResult }] }`, scoped to WC games (league='world_cup') so an NFL pick
 * row from a shared user can never leak in. Picks page hydrates the draft
 * state from this so a refresh doesn't blank out a previously-saved choice.
 */
router.get('/group/:groupId/world-cup/me', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await ensureMembership(groupId, req.user.id);

    const { rows } = await pool.query(
      `SELECT up.game_id, up.picked_result
       FROM user_picks up
       JOIN games g ON g.id = up.game_id
       WHERE up.user_id = $1
         AND up.group_id = $2
         AND g.league = 'world_cup'
         AND up.picked_result IS NOT NULL`,
      [req.user.id, group.id]
    );

    res.json({
      picks: rows.map((r) => ({ gameId: r.game_id, pickedResult: r.picked_result })),
    });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    console.error('GET world-cup picks error', e);
    res.status(500).json({ error: 'Failed to load World Cup picks' });
  }
});

/**
 * World Cup tournament leaderboard for a group.
 *
 * Path selected by WC_LEADERBOARD_CACHE:
 *   off (default) — computeLive: fetch all stages, score, return. Behavior-
 *     identical to the legacy inline loop.
 *   shadow — compute live, also run the cached path, log any mismatch, but
 *     ALWAYS serve the live result (production parity gate).
 *   on — serve the cached snapshot (recompute on version miss).
 *
 * Members with no picks are surfaced as zero rows so the leaderboard lists the
 * whole group. Each row carries the four tiebreaker counts plus identity + rank.
 */
router.get('/group/:groupId/world-cup/leaderboard', authenticateToken, async (req, res) => {
  try {
    const { groupId } = req.params;
    const group = await ensureMembership(groupId, req.user.id);

    const mode = process.env.WC_LEADERBOARD_CACHE || 'off';

    if (mode === 'on') {
      const { leaderboard } = await getGroupLeaderboardCached(pool, group);
      return res.json({ leaderboard });
    }

    if (mode === 'shadow') {
      const live = await computeLive(pool, group);
      try {
        const { leaderboard: cached, source } = await getGroupLeaderboardCached(pool, group);
        if (!leaderboardsMatch(cached, live)) {
          console.warn('[wc-leaderboard-shadow] MISMATCH', {
            groupId: group.id, source,
            liveLen: live.length, cachedLen: cached.length,
          });
        } else {
          console.log('[wc-leaderboard-shadow] match', { groupId: group.id, source, n: live.length });
        }
      } catch (err) {
        console.error('[wc-leaderboard-shadow] cached path threw', err);
      }
      return res.json({ leaderboard: live }); // always serve the trusted live result
    }

    // mode === 'off' (default): behavior-identical to the legacy inline loop
    const leaderboard = await computeLive(pool, group);
    return res.json({ leaderboard });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    console.error('GET world-cup leaderboard error', e);
    res.status(500).json({ error: 'Failed to load World Cup leaderboard' });
  }
});

// Confirm a user id is a member of the group. Returns true/false; never throws.
async function isGroupMember(groupId, userId) {
  const { rows } = await pool.query(
    'SELECT 1 FROM group_memberships WHERE group_id = $1 AND user_id = $2',
    [groupId, userId]
  );
  return rows.length > 0;
}

/**
 * Read ANOTHER member's World Cup picks for a group (the soccer sibling of the
 * NFL `GET /:identifier/picks/user/:userId` route).
 *
 * Visibility rule: any group member may VIEW any other member's picks — World
 * Cup pools are open-book, mirroring the NFL behavior. The response carries a
 * `canEdit` flag that is true ONLY for admins; non-admins receive the picks for
 * display but the client renders them read-only and the write route below
 * rejects them outright. This split (open read, admin-gated write) is the whole
 * contract: "see everyone's picks, change only your own — unless you're an admin".
 */
router.get('/group/:groupId/world-cup/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const targetUserId = parseInt(userId, 10);
    if (Number.isNaN(targetUserId)) return res.status(400).json({ error: 'Invalid userId' });

    const group = await ensureMembership(groupId, req.user.id);
    // Only admins may edit another member's picks. Everyone else gets read-only.
    const canEdit = group.userRole === 'admin';

    if (!(await isGroupMember(group.id, targetUserId))) {
      return res.status(404).json({ error: 'User is not a member of this group' });
    }

    const { rows } = await pool.query(
      `SELECT up.game_id, up.picked_result
       FROM user_picks up
       JOIN games g ON g.id = up.game_id
       WHERE up.user_id = $1
         AND up.group_id = $2
         AND g.league = 'world_cup'
         AND up.picked_result IS NOT NULL`,
      [targetUserId, group.id]
    );

    res.json({
      picks: rows.map((r) => ({ gameId: r.game_id, pickedResult: r.picked_result })),
      canEdit,
    });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    console.error('GET world-cup user picks error', e);
    res.status(500).json({ error: 'Failed to load member World Cup picks' });
  }
});

/**
 * Submit World Cup picks ON BEHALF OF another member — admins only.
 *
 * This is the only write path that can touch a row whose user_id differs from
 * the caller's. The guard order is deliberate and airtight:
 *   1. validate the pick shape (gameId + result) BEFORE any auth-sensitive work;
 *   2. resolve the caller's membership/role for THIS group;
 *   3. reject with 403 unless the caller's role is 'admin' — a member who is not
 *      an admin can never reach the upsert, so nobody can change another
 *      person's picks by guessing a userId;
 *   4. reject with 404 unless the TARGET is also a member of this group.
 * Only after all four does the same WC-game validation + slot-grouped upsert as
 * the self route run, but keyed to `targetUserId`. There is no multi-group
 * fan-out here on purpose: an admin override is scoped to the one group whose
 * roster they administer.
 */
router.post('/group/:groupId/world-cup/user/:userId', authenticateToken, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { picks } = req.body;

    const targetUserId = parseInt(userId, 10);
    if (Number.isNaN(targetUserId)) return res.status(400).json({ error: 'Invalid userId' });

    if (!Array.isArray(picks)) {
      return res.status(400).json({ error: 'picks array required' });
    }
    for (const p of picks) {
      if (p.gameId == null) {
        return res.status(400).json({ error: 'Missing gameId' });
      }
      if (!WORLD_CUP_RESULTS.includes(p.pickedResult)) {
        return res.status(400).json({ error: 'Invalid pickedResult', gameId: p.gameId, pickedResult: p.pickedResult });
      }
    }

    const group = await ensureMembership(groupId, req.user.id);

    // The single most important check in this file: only an admin of THIS group
    // may write another member's picks. A non-admin member is membership-valid
    // (passed ensureMembership) yet still forbidden here.
    if (group.userRole !== 'admin') {
      return res.status(403).json({ error: 'Only group admins can submit picks for other members' });
    }

    if (!(await isGroupMember(group.id, targetUserId))) {
      return res.status(404).json({ error: 'User is not a member of this group' });
    }

    if (picks.length === 0) {
      return res.json({ picks: [], targetUserId, isAdminOverride: true });
    }

    // Same WC-game verification + slot grouping as the self route, but the rows
    // are upserted under targetUserId rather than the caller.
    const gameIds = picks.map((p) => p.gameId);
    const { rows: gameRows } = await pool.query(
      `SELECT id, season, season_type, week, game_date, stage FROM games WHERE id = ANY($1::int[]) AND league = 'world_cup'`,
      [gameIds]
    );
    const gameById = new Map(gameRows.map((g) => [g.id, g]));
    for (const p of picks) {
      if (!gameById.has(p.gameId)) {
        return res.status(400).json({ error: 'Invalid gameId', gameId: p.gameId });
      }
    }

    // Knockout-only groups reject any group-stage pick, even from an admin override.
    const groupStageIds = groupStagePickViolations(group, picks, gameById);
    if (groupStageIds.length > 0) {
      return res.status(400).json({ error: 'Group-stage picks are not allowed in this group', gameIds: groupStageIds });
    }

    // Kickoff lock applies to admin overrides too: a started match's pick is
    // frozen for everyone, so even an admin cannot change a member's pick after
    // the result is in motion. Same stable game_date boundary as the self route.
    const now = Date.now();
    const lockedGameIds = [];
    const openPicks = picks.filter((p) => {
      const g = gameById.get(p.gameId);
      if (g && new Date(g.game_date).getTime() <= now) {
        lockedGameIds.push(p.gameId);
        return false;
      }
      return true;
    });

    if (openPicks.length === 0) {
      return res.json({ picks: [], targetUserId, isAdminOverride: true, lockedGameIds });
    }

    const bySlot = new Map();
    for (const p of openPicks) {
      const g = gameById.get(p.gameId);
      const key = `${g.season}|${g.season_type}|${g.week}`;
      if (!bySlot.has(key)) {
        bySlot.set(key, { season: g.season, seasonType: g.season_type, week: g.week, picks: [] });
      }
      bySlot.get(key).picks.push({ gameId: p.gameId, pickedResult: p.pickedResult });
    }

    const saved = [];
    for (const slot of bySlot.values()) {
      const rows = await UserPick.bulkUpsertWorldCupPicks({
        userId: targetUserId,
        groupId: group.id,
        season: slot.season,
        seasonType: slot.seasonType,
        week: slot.week,
        picks: slot.picks,
      });
      saved.push(...rows);
    }

    res.json({
      picks: saved.map((p) => ({ gameId: p.gameId, pickedResult: p.pickedResult })),
      targetUserId,
      isAdminOverride: true,
      lockedGameIds,
    });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    if (e.message && /Invalid picked_result|missing gameId/.test(e.message)) {
      return res.status(400).json({ error: e.message });
    }
    console.error('POST world-cup user picks error', e);
    res.status(500).json({ error: 'Failed to save member World Cup picks' });
  }
});

export default router;
