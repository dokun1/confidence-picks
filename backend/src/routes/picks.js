import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { Group } from '../models/Group.js';
import { GameService } from '../services/GameService.js';
import { UserPick } from '../models/UserPick.js';
import pool from '../config/database.js';

const router = express.Router();

async function ensureMembership(groupIdentifier, userId) {
  const group = await Group.findByIdentifier(groupIdentifier, userId);
  if (!group) throw new Error('GROUP_NOT_FOUND');
  if (!group.userRole) throw new Error('NOT_MEMBER');
  return group;
}

function normalizeGame(g) { return typeof g.toJSON === 'function' ? g.toJSON() : g; }

// Determine closest upcoming week (first with any non-final game)
async function computeClosestWeek(seasonYear, seasonType) {
  const { rows } = await pool.query(`SELECT week, MIN(status) as any_status
    FROM games WHERE season=$1 AND season_type=$2 GROUP BY week ORDER BY week`, [seasonYear, seasonType]);
  if (rows.length === 0) return 0; // allow week 0
  // naive: fetch weeks ascending, pick first where exists non-FINAL
  for (const r of rows) {
    // Need counts per week
    const { rows: games } = await pool.query('SELECT status FROM games WHERE season=$1 AND season_type=$2 AND week=$3', [seasonYear, seasonType, r.week]);
    if (games.some(g => g.status !== 'FINAL')) return r.week;
  }
  return rows[rows.length - 1].week; // all final -> last week (could be 0)
}

function deriveGamePickMeta(gameJson, pick) {
  const status = gameJson.status;
  // Treat legacy/alternate pre-game statuses as editable (e.g., NOT_STARTED)
  const preStatuses = new Set(['SCHEDULED','NOT_STARTED','PRE','PREGAME']);
  const lock = !preStatuses.has(status);
  const inProgress = status === 'IN_PROGRESS';
  return {
    locked: lock,
    canEdit: !lock,
    inProgress,
    final: status === 'FINAL'
  };
}

router.get('/:identifier/picks', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    // Runtime safeguard: ensure confidence unique index is correct shape
    UserPick.ensureConfidenceIndex().catch(()=>{});
    const season = parseInt(req.query.season) || new Date().getFullYear();
    const seasonType = parseInt(req.query.seasonType) || 2;
    const weekRaw = req.query.week;
    const week = weekRaw === '0' ? 0 : parseInt(weekRaw);
    if (Number.isNaN(week)) return res.status(400).json({ error: 'week required' });
    console.log('[picks][GET] request', { userId: req.user.id, identifier, season, seasonType, week });

    const group = await ensureMembership(identifier, req.user.id);
    console.log('[picks][GET] group', { groupId: group.id });

  // Map regular season week 0 to preseason week 4 (display preseason finale inside week 0 slot)
  // Exception for 2025: treat preseason week 4 as regular season week 0 for testing
  let fetchSeasonType = seasonType;
  let fetchWeek = week;
  let espnSeasonType = seasonType;
  let espnWeek = week;
  
  if (seasonType === 2 && week === 0) {
    if (season === 2025) {
      // For 2025, fetch from ESPN as preseason week 4 but store/query as regular season week 0
      espnSeasonType = 1;
      espnWeek = 4;
      console.log('[picks][GET] 2025 exception: fetching ESPN preseason week 4 as regular season week 0');
    } else {
      // For other years, use the normal mapping
      fetchSeasonType = 1; 
      fetchWeek = 4; 
      console.log('[picks][GET] mapped week0 -> preseason week4'); 
    }
  }
  // Get games and user picks (using mapped values)
  const games = await GameService.getGamesForWeek(season, espnSeasonType || fetchSeasonType, espnWeek || fetchWeek, false);
    console.log('[picks][GET] games', games.length, games.map(g=>({ id:g.id, status:g.status, date:g.gameDate })));
  const picks = await UserPick.findForUserWeek({ userId: req.user.id, groupId: group.id, season, seasonType: fetchSeasonType, week: fetchWeek });
    console.log('[picks][GET] existing picks', picks.map(p=>({ gameId:p.gameId, conf:p.confidence, team:p.pickedTeamId })));
    
    // Compute points on-demand for FINAL games that don't have stored scores
    const calculatedPicks = [];
    for (const pick of picks) {
      const game = games.find(g => g.id === pick.gameId);
      if (pick.points == null && game && game.status === 'FINAL' && pick.confidence != null && pick.pickedTeamId) {
        const winnerTeamId = (game.homeScore > game.awayScore) ? game.homeTeam.id : game.awayTeam.id;
        pick.points = (winnerTeamId === pick.pickedTeamId) ? pick.confidence : -pick.confidence;
        pick.won = (winnerTeamId === pick.pickedTeamId);
        console.log(`[picks][GET] computed on-demand score for game ${game.id}: pick team ${pick.pickedTeamId}, winner ${winnerTeamId}, result: ${pick.won ? 'WON' : 'LOST'} ${pick.points}`);
        
        // Track this game for group-wide database persistence
        calculatedPicks.push({
          gameId: pick.gameId,
          winnerTeamId: winnerTeamId
        });
      }
    }
    
    // Persist calculated scores to database for ALL users in the group
    if (calculatedPicks.length > 0) {
      try {
        for (const calc of calculatedPicks) {
          // Update ALL users' picks for this game in this group
          const { rowCount } = await pool.query(`
            UPDATE user_picks 
            SET won = (picked_team_id = $1), 
                points = CASE 
                  WHEN picked_team_id = $1 THEN confidence_level 
                  ELSE -confidence_level 
                END,
                updated_at = NOW()
            WHERE group_id = $2 AND game_id = $3 AND picked_team_id IS NOT NULL AND points IS NULL
          `, [calc.winnerTeamId, group.id, calc.gameId]);
          
          console.log(`[picks][GET] updated ${rowCount} user picks for game ${calc.gameId} (winner: team ${calc.winnerTeamId}) across all group members`);
        }
        console.log(`[picks][GET] persisted scores for ${calculatedPicks.length} games across all group members`);
      } catch (error) {
        console.error('[picks][GET] failed to persist calculated scores:', error);
        // Continue anyway - on-demand calculation still works
      }
    }
    
    const pickMap = new Map(picks.map(p => [p.gameId, p]));

    const totalGames = games.length;

    const payloadGames = games.map(g => {
      const j = normalizeGame(g);
      const pick = pickMap.get(g.id) || null; // note g.id is db id
      return {
        ...j,
        pick: pick ? {
          gameId: pick.gameId,
          pickedTeamId: pick.pickedTeamId,
          confidence: pick.confidence,
          won: pick.won,
          points: pick.points
        } : null,
        meta: deriveGamePickMeta(j, pick)
      };
    });

    const usedConfidences = picks.filter(p => p.confidence != null).map(p => p.confidence);
    const availableConfidences = Array.from({ length: totalGames }, (_, i) => i + 1).filter(n => !usedConfidences.includes(n));
    const weekPoints = picks.reduce((sum, p) => sum + (p.points || 0), 0);

    res.json({
      games: payloadGames,
      availableConfidences,
      totalGames,
      pickedCount: usedConfidences.length,
      weekPoints
    });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    console.error('GET picks error', e);
    res.status(500).json({ error: 'Failed to load picks' });
  }
});

router.get('/:identifier/picks/closest', authenticateToken, async (req, res) => {
  try {
  const { identifier } = req.params;
  UserPick.ensureConfidenceIndex().catch(()=>{});
    const season = parseInt(req.query.season) || new Date().getFullYear();
    const seasonType = parseInt(req.query.seasonType) || 2;
    const group = await ensureMembership(identifier, req.user.id);
    const week = await computeClosestWeek(season, seasonType);
    res.json({ season, seasonType, week });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    res.status(500).json({ error: 'Failed to compute closest week' });
  }
});

router.post('/:identifier/picks', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    UserPick.ensureConfidenceIndex().catch(()=>{});
    const { season, seasonType, week, picks, clearedGameIds } = req.body;
    console.log('[picks][POST] incoming', { userId: req.user.id, identifier, season, seasonType, week, picksCount: picks?.length, clearedGameIds });
    if (!season || !seasonType || (week === undefined || week === null || Number.isNaN(parseInt(week))) || !Array.isArray(picks)) {
      return res.status(400).json({ error: 'Missing fields' });
    }
    const group = await ensureMembership(identifier, req.user.id);
    console.log('[picks][POST] group', { groupId: group.id });

  // Week 0 mapping logic (same as GET)
  // Exception for 2025: treat preseason week 4 as regular season week 0 for testing
  let fetchSeasonType = seasonType;
  let fetchWeek = week;
  let espnSeasonType = seasonType;
  let espnWeek = week;
  
  if (seasonType === 2 && week === 0) {
    if (season === 2025) {
      // For 2025, fetch from ESPN as preseason week 4 but store/query as regular season week 0
      espnSeasonType = 1;
      espnWeek = 4;
      console.log('[picks][POST] 2025 exception: fetching ESPN preseason week 4 as regular season week 0');
    } else {
      // For other years, use the normal mapping
      fetchSeasonType = 1; 
      fetchWeek = 4; 
      console.log('[picks][POST] mapped week0 -> preseason week4'); 
    }
  }
  const games = await GameService.getGamesForWeek(season, espnSeasonType || fetchSeasonType, espnWeek || fetchWeek, false);
    console.log('[picks][POST] games', games.length);
    const gameById = new Map(games.map(g => [g.id, g]));

    // Normalise clearedGameIds (optional array of numbers)
    const cleared = Array.isArray(clearedGameIds) ? clearedGameIds.map(n => parseInt(n, 10)).filter(n => !Number.isNaN(n)) : [];

    // Validate picks
    const totalGames = games.length;
    const seenConf = new Set();
  for (const p of picks) {
      const game = gameById.get(p.gameId);
      if (!game) return res.status(400).json({ error: 'Invalid gameId', gameId: p.gameId });
      if (cleared.includes(p.gameId)) continue; // if also cleared, skip (clear wins)
      const status = game.status;
      if (status !== 'SCHEDULED') return res.status(409).json({ error: 'Game locked', gameId: p.gameId });
      if (p.confidence != null) {
        if (p.confidence < 1 || p.confidence > totalGames) return res.status(400).json({ error: 'Confidence out of range', gameId: p.gameId });
        if (seenConf.has(p.confidence)) return res.status(400).json({ error: 'Duplicate confidence', confidence: p.confidence });
        seenConf.add(p.confidence);
        if (!p.pickedTeamId) return res.status(400).json({ error: 'Winner required when confidence set', gameId: p.gameId });
      }
      if (p.pickedTeamId != null) {
        const validTeam = [game.homeTeam.id, game.awayTeam.id].map(String).includes(String(p.pickedTeamId));
        if (!validTeam) {
          console.warn('Invalid team for game validation failed', { gameId: p.gameId, pickedTeamId: p.pickedTeamId, homeTeamId: game.homeTeam.id, awayTeamId: game.awayTeam.id });
          return res.status(400).json({ error: 'Invalid team for game', gameId: p.gameId });
        }
      }
    }
  console.log('[picks][POST] validation complete');

    // Validate cleared ids (must be valid games & unlocked)
    for (const gid of cleared) {
      const game = gameById.get(gid);
      if (!game) return res.status(400).json({ error: 'Invalid clearedGameId', gameId: gid });
      if (game.status !== 'SCHEDULED') return res.status(409).json({ error: 'Game locked', gameId: gid });
    }

    // Load existing picks for this user/week to detect implicit overrides
  const existingPicks = await UserPick.findForUserWeek({ userId: req.user.id, groupId: group.id, season, seasonType: fetchSeasonType, week: fetchWeek });
  console.log('[picks][POST] existing picks', existingPicks.map(p=>({ gameId:p.gameId, conf:p.confidence, team:p.pickedTeamId })));

    // Detect confidence overrides: if payload assigns confidence X to game A but some other existing game B already
    // has confidence X (and B is not explicitly updated or cleared), we must clear that confidence first (retain winner).
    const payloadGameIds = new Set(picks.map(p => p.gameId));
    const implicitConfidenceClears = new Set();
  for (const p of picks) {
      if (p.confidence == null) continue;
      const conflict = existingPicks.find(ep => ep.confidence === p.confidence && ep.gameId !== p.gameId);
      if (conflict && !payloadGameIds.has(conflict.gameId) && !cleared.includes(conflict.gameId)) {
        const conflictGame = gameById.get(conflict.gameId);
        if (!conflictGame) continue; // safety
        if (conflictGame.status !== 'SCHEDULED') {
          return res.status(409).json({ error: 'Confidence locked by started game', confidence: p.confidence, gameId: conflict.gameId });
        }
        implicitConfidenceClears.add(conflict.gameId);
      }
    }
  console.log('[picks][POST] implicit clears', [...implicitConfidenceClears]);

    // Perform explicit clears (full clear: winner+confidence) first
  if (cleared.length > 0) {
  await UserPick.clearPending({ userId: req.user.id, groupId: group.id, season, seasonType: fetchSeasonType, week: fetchWeek, gameIds: cleared });
    }

    // Then clear JUST the confidence for implicit overrides (retain picked_team_id so user can reassign)
  if (implicitConfidenceClears.size > 0) {
      const icIds = [...implicitConfidenceClears];
      const params = [req.user.id, group.id, season, fetchSeasonType, fetchWeek];
      const inClause = icIds.map((_, i) => `$${i+6}`).join(',');
      params.push(...icIds);
      await pool.query(`UPDATE user_picks SET confidence_level=NULL, updated_at=NOW()
        WHERE user_id=$1 AND group_id=$2 AND season=$3 AND season_type=$4 AND week=$5 AND game_id IN (${inClause})` , params);
    }
  console.log('[picks][POST] performed clears', { explicit: cleared, implicit:[...implicitConfidenceClears] });

    // Filter out any picks that were also cleared to avoid re-upserting them
  // Filter out any picks that were explicitly cleared (implicit clears keep winner so payload may still include other picks)
  const effectivePicks = picks.filter(p => !cleared.includes(p.gameId));
  if (effectivePicks.length > 0) {
  await UserPick.bulkUpsert({ userId: req.user.id, groupId: group.id, season, seasonType: fetchSeasonType, week: fetchWeek, picks: effectivePicks });
    }
  console.log('[picks][POST] upsert done');

    // Return updated week state
  const updatedPicks = await UserPick.findForUserWeek({ userId: req.user.id, groupId: group.id, season, seasonType: fetchSeasonType, week: fetchWeek });
  console.log('[picks][POST] updated picks', updatedPicks.map(p=>({ gameId:p.gameId, conf:p.confidence, team:p.pickedTeamId })));
    const pickMap = new Map(updatedPicks.map(p => [p.gameId, p]));

    const payloadGames = games.map(g => {
      const j = normalizeGame(g);
      const pick = pickMap.get(g.id) || null;
      return {
        ...j,
        pick: pick ? {
          gameId: pick.gameId,
          pickedTeamId: pick.pickedTeamId,
          confidence: pick.confidence,
          won: pick.won,
          points: pick.points
        } : null,
        meta: deriveGamePickMeta(j, pick)
      };
    });

    const usedConfidences = updatedPicks.filter(p => p.confidence != null).map(p => p.confidence);
    const availableConfidences = Array.from({ length: games.length }, (_, i) => i + 1).filter(n => !usedConfidences.includes(n));
    const weekPoints = updatedPicks.reduce((sum, p) => sum + (p.points || 0), 0);

    const responseBody = { games: payloadGames, availableConfidences, totalGames: games.length, pickedCount: usedConfidences.length, weekPoints };
    console.log('[picks][POST] response', {
      availableConfidences,
      usedConfidences,
      weekPoints,
      games: payloadGames.map(g=>({ id:g.id, status:g.status, pick:g.pick ? { conf:g.pick.confidence, team:g.pick.pickedTeamId } : null }))
    });
    res.json(responseBody);
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    if (e.code === '23505') return res.status(400).json({ error: 'Duplicate confidence (constraint)' });
    console.error('POST picks error', e);
    res.status(500).json({ error: 'Failed to save picks' });
  }
});

router.post('/:identifier/picks/clear', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
  const { season, seasonType, week } = req.body;
  if (!season || !seasonType || (week === undefined || week === null)) return res.status(400).json({ error: 'Missing fields' });
    const group = await ensureMembership(identifier, req.user.id);

    const games = await GameService.getGamesForWeek(season, seasonType, week, false);
    const unlockedIds = games.filter(g => g.status === 'SCHEDULED').map(g => g.id);
    await UserPick.clearPending({ userId: req.user.id, groupId: group.id, season, seasonType, week, gameIds: unlockedIds });
    res.json({ cleared: unlockedIds.length });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    res.status(500).json({ error: 'Failed to clear picks' });
  }
});

// Scoreboard: aggregate per user per week
router.get('/:identifier/scoreboard', authenticateToken, async (req, res) => {
  try {
    const { identifier } = req.params;
    const season = parseInt(req.query.season) || new Date().getFullYear();
    const seasonType = parseInt(req.query.seasonType) || 2;
    const group = await ensureMembership(identifier, req.user.id);

    const { rows: users } = await pool.query(`SELECT u.id, u.name, u.picture_url FROM group_memberships gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1`, [group.id]);

    // Gather picks with computed points (points may be null; compute on fly if game final)
    const { rows: pickRows } = await pool.query(`
      SELECT p.*, g.status, g.home_team, g.away_team, g.home_score, g.away_score
      FROM user_picks p
      JOIN games g ON g.id = p.game_id
      WHERE p.group_id=$1 AND p.season=$2 AND p.season_type=$3
    `, [group.id, season, seasonType]);

    // Compute points if not stored but game final
    for (const r of pickRows) {
      if (r.points == null && r.status === 'FINAL' && r.confidence_level != null && r.picked_team_id) {
        const home = typeof r.home_team === 'string' ? JSON.parse(r.home_team) : r.home_team;
        const away = typeof r.away_team === 'string' ? JSON.parse(r.away_team) : r.away_team;
        const winnerTeamId = (r.home_score > r.away_score) ? home.id : away.id;
        // Use correct scoring: +confidence for wins, -confidence for losses
        r.points = (winnerTeamId === r.picked_team_id) ? r.confidence_level : -r.confidence_level;
      }
    }

    const weeksSet = new Set(pickRows.map(r => r.week));
    const weeks = [...weeksSet].sort((a,b)=>a-b);

    const userMap = new Map(users.map(u => [u.id, { userId: u.id, name: u.name, pictureUrl: u.picture_url, weekly: [], totalPoints: 0 }]));
    for (const w of weeks) {
      for (const u of users) {
        const picks = pickRows.filter(r => r.user_id === u.id && r.week === w);
        const points = picks.reduce((sum, p) => sum + (p.points || 0), 0);
        userMap.get(u.id).weekly.push({ week: w, points });
        userMap.get(u.id).totalPoints += points;
      }
    }

    const result = [...userMap.values()].sort((a,b)=>b.totalPoints - a.totalPoints);
    res.json({ season, seasonType, weeks, users: result });
  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    res.status(500).json({ error: 'Failed to load scoreboard' });
  }
});

// Get another user's picks (read-only, only for in-progress/final games)
router.get('/:identifier/users/:userId/picks', authenticateToken, async (req, res) => {
  try {
    const { identifier, userId } = req.params;
    const targetUserId = parseInt(userId);
    const season = parseInt(req.query.season) || new Date().getFullYear();
    const seasonType = parseInt(req.query.seasonType) || 2;
    const weekRaw = req.query.week;
    const week = weekRaw === '0' ? 0 : parseInt(weekRaw);
    if (Number.isNaN(week) || Number.isNaN(targetUserId)) {
      return res.status(400).json({ error: 'week and userId required' });
    }

    console.log('[picks][GET user picks] request', { 
      requesterId: req.user.id, 
      targetUserId, 
      identifier, 
      season, 
      seasonType, 
      week 
    });

    const group = await ensureMembership(identifier, req.user.id);
    
    // Verify target user is also a member of this group
    const targetMemberQuery = await pool.query(`
      SELECT u.id, u.name, u.email, u.picture_url
      FROM users u
      JOIN group_memberships gm ON u.id = gm.user_id
      WHERE gm.group_id = $1 AND u.id = $2
    `, [group.id, targetUserId]);

    if (targetMemberQuery.rows.length === 0) {
      return res.status(404).json({ error: 'User not found in this group' });
    }

    const targetUser = targetMemberQuery.rows[0];

    // Map week 0 handling (same as regular picks endpoint)
    let fetchSeasonType = seasonType;
    let fetchWeek = week;
    let espnSeasonType = seasonType;
    let espnWeek = week;
    
    if (seasonType === 2 && week === 0) {
      if (season === 2025) {
        espnSeasonType = 1;
        espnWeek = 4;
        console.log('[picks][GET user picks] 2025 exception: fetching ESPN preseason week 4 as regular season week 0');
      } else {
        fetchSeasonType = 1; 
        fetchWeek = 4; 
        console.log('[picks][GET user picks] mapped week0 -> preseason week4'); 
      }
    }

    // Get games and target user's picks
    const games = await GameService.getGamesForWeek(season, espnSeasonType || fetchSeasonType, espnWeek || fetchWeek, false);
    const picks = await UserPick.findForUserWeek({ 
      userId: targetUserId, 
      groupId: group.id, 
      season, 
      seasonType: fetchSeasonType, 
      week: fetchWeek 
    });

    console.log('[picks][GET user picks] found', picks.length, 'picks for user', targetUserId);

    // Compute on-demand scoring for final games
    let weekPoints = 0;
    for (const pick of picks) {
      const game = games.find(g => g.id === pick.gameId);
      if (pick.points == null && game && game.status === 'FINAL' && pick.confidence != null && pick.pickedTeamId) {
        const winnerTeamId = (game.homeScore > game.awayScore) ? game.homeTeam.id : game.awayTeam.id;
        pick.points = (winnerTeamId === pick.pickedTeamId) ? pick.confidence : -pick.confidence;
        pick.won = (winnerTeamId === pick.pickedTeamId);
        console.log(`[picks][GET user picks] computed score for game ${game.id}: ${pick.won ? 'WON' : 'LOST'} ${pick.points}`);
      }
      if (pick.points != null) {
        weekPoints += pick.points;
      }
    }

    // Filter games to only show picks for in-progress or final games
    const picksMap = new Map(picks.map(p => [p.gameId, p]));
    const visibleGames = [];
    const availableConfidences = [];

    for (const game of games) {
      // Only show games that are in-progress or final
      const isVisible = game.status === 'IN_PROGRESS' || game.status === 'FINAL';
      
      if (isVisible) {
        const pick = picksMap.get(game.id);
        const gameMeta = deriveGamePickMeta(game, pick);
        
        visibleGames.push({
          id: game.id,
          homeTeam: game.homeTeam,
          awayTeam: game.awayTeam,
          gameDate: game.gameDate,
          status: game.status,
          homeScore: game.homeScore || 0,
          awayScore: game.awayScore || 0,
          week: game.week,
          pick: pick ? {
            pickedTeamId: pick.pickedTeamId,
            confidence: pick.confidence,
            points: pick.points,
            won: pick.won
          } : null,
          meta: {
            ...gameMeta,
            locked: true, // Always locked for other users' picks
            canEdit: false
          }
        });
      }
    }

    console.log('[picks][GET user picks] returning', visibleGames.length, 'visible games out of', games.length, 'total');

    res.json({
      games: visibleGames,
      availableConfidences, // Empty for other users
      totalGames: games.length, // Total games for the week
      weekPoints,
      targetUser: {
        id: targetUser.id,
        name: targetUser.name,
        email: targetUser.email,
        pictureUrl: targetUser.picture_url
      },
      viewMode: 'other-user' // Flag to indicate this is viewing another user
    });

  } catch (e) {
    if (e.message === 'GROUP_NOT_FOUND') return res.status(404).json({ error: 'Group not found' });
    if (e.message === 'NOT_MEMBER') return res.status(403).json({ error: 'Not a group member' });
    console.error('GET user picks error', e);
    res.status(500).json({ error: 'Failed to load user picks' });
  }
});

export default router;
