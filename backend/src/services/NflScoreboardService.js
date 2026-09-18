import pool from '../config/database.js';

// Extracted verbatim from the GET /:identifier/scoreboard route closure, which
// was the only place NFL standings existed -- dependent on req/res and so
// unreachable from the weekly summary email. Duplicating the +/-confidence rule
// into the email job instead would mean two copies of a scoring rule, which is
// how scoring bugs are born.
//
// Grading here is IN MEMORY only. This never writes to user_picks: a reporting
// path should not be a writer of scoring data, and GET /picks already persists
// grades on demand for the app.

function parseTeam(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

/** Winning team id for a FINAL row, or null on a tie. */
function winnerOf(row) {
  const home = parseTeam(row.home_team);
  const away = parseTeam(row.away_team);
  if (row.home_score > row.away_score) return home.id;
  if (row.away_score > row.home_score) return away.id;
  return null;
}

/**
 * Grade rows in place, matching the existing on-demand scoring exactly:
 * +confidence for a correct pick, -confidence for a wrong one, 0 and won=null
 * on a tie. A stored `points` wins over a recomputed one, except on a tie,
 * where the tie result is authoritative.
 */
function gradeRows(pickRows) {
  for (const r of pickRows) {
    if (r.status !== 'FINAL' || r.confidence_level == null || !r.picked_team_id) continue;

    const winnerTeamId = winnerOf(r);
    if (winnerTeamId === null) {
      r.points = 0;
      r.won = null;
    } else if (r.points == null) {
      const didWin = String(winnerTeamId) === String(r.picked_team_id);
      r.points = didWin ? r.confidence_level : -r.confidence_level;
      r.won = didWin;
    }
  }
  return pickRows;
}

async function loadMembers(groupId) {
  const { rows } = await pool.query(
    `SELECT u.id, u.name, u.picture_url FROM group_memberships gm JOIN users u ON u.id=gm.user_id WHERE gm.group_id=$1`,
    [groupId]
  );
  return rows;
}

/**
 * Season-to-date standings for one group.
 *
 * Response shape is byte-identical to what GET /:identifier/scoreboard returned
 * before the extraction -- the route is now a thin caller.
 */
export async function buildScoreboard(groupId, season, seasonType) {
  const users = await loadMembers(groupId);

  const { rows: pickRows } = await pool.query(
    `
      SELECT p.*, g.status, g.home_team, g.away_team, g.home_score, g.away_score
      FROM user_picks p
      JOIN games g ON g.id = p.game_id
      WHERE p.group_id=$1 AND p.season=$2 AND p.season_type=$3
    `,
    [groupId, season, seasonType]
  );
  gradeRows(pickRows);

  const weeks = [...new Set(pickRows.map((r) => r.week))].sort((a, b) => a - b);

  const userMap = new Map(
    users.map((u) => [
      u.id,
      { userId: u.id, name: u.name, pictureUrl: u.picture_url, weekly: [], totalPoints: 0 },
    ])
  );
  for (const w of weeks) {
    for (const u of users) {
      const picks = pickRows.filter((r) => r.user_id === u.id && r.week === w);
      const points = picks.reduce((sum, p) => sum + (p.points || 0), 0);
      userMap.get(u.id).weekly.push({ week: w, points });
      userMap.get(u.id).totalPoints += points;
    }
  }

  const result = [...userMap.values()].sort((a, b) => b.totalPoints - a.totalPoints);
  return { season, seasonType, weeks, users: result };
}

/**
 * One week's picks per member, for the summary email's grid.
 *
 * Members with no picks that week still appear, with an empty picks array and
 * zero points — the email should show who sat the week out.
 */
export async function buildWeekPickGrid(groupId, season, seasonType, week) {
  const users = await loadMembers(groupId);

  const { rows } = await pool.query(
    `
      SELECT p.*, g.status, g.home_team, g.away_team, g.home_score, g.away_score, g.game_date
      FROM user_picks p
      JOIN games g ON g.id = p.game_id
      WHERE p.group_id=$1 AND p.season=$2 AND p.season_type=$3 AND p.week=$4
      ORDER BY g.game_date ASC, g.id ASC
    `,
    [groupId, season, seasonType, week]
  );
  gradeRows(rows);

  // One entry per distinct game, in kickoff order (the query already sorts).
  const games = new Map();
  for (const r of rows) {
    if (games.has(r.game_id)) continue;
    const home = parseTeam(r.home_team);
    const away = parseTeam(r.away_team);
    games.set(r.game_id, {
      gameId: r.game_id,
      homeAbbr: home.abbreviation,
      awayAbbr: away.abbreviation,
      homeScore: r.home_score,
      awayScore: r.away_score,
      status: r.status,
    });
  }

  const gridRows = users.map((u) => {
    const mine = rows.filter((r) => r.user_id === u.id);
    return {
      userId: u.id,
      name: u.name,
      picks: mine.map((r) => ({
        gameId: r.game_id,
        pickedTeamId: r.picked_team_id,
        confidence: r.confidence_level,
        won: r.won,
        points: r.points,
      })),
      weekPoints: mine.reduce((sum, r) => sum + (r.points || 0), 0),
    };
  });
  gridRows.sort((a, b) => b.weekPoints - a.weekPoints);

  return { games: [...games.values()], rows: gridRows };
}
