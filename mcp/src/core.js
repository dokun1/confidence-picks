// Core tool logic. Deliberately free of MCP imports and of `fetch`: every
// function here takes an injected client, so the whole layer is unit-testable
// with no network and no protocol.

export const WORLD_CUP_POOL = 'world_cup_2026';

// POST /picks is a WHOLE-WEEK upsert, not a per-pick setter. The server
// enforces that confidence is unique across the week, and assigning a value
// that another game already holds implicitly strips it from that game. A naive
// "set one pick" call therefore corrupts the rest of the week.
//
// mergeWeek is the guard: it folds the caller's changes into the picks that
// already exist and resolves collisions the same way the server would, so the
// array we post is always internally consistent.
export function mergeWeek(existing, incoming) {
  const byGame = new Map();
  for (const p of existing || []) {
    byGame.set(p.gameId, { gameId: p.gameId, pickedTeamId: p.pickedTeamId ?? null, confidence: p.confidence ?? null });
  }

  const incomingIds = new Set();
  for (const p of incoming || []) {
    if (p == null || p.gameId == null) continue;
    incomingIds.add(p.gameId);
    const prev = byGame.get(p.gameId) || {};
    byGame.set(p.gameId, {
      gameId: p.gameId,
      // An incoming entry that omits the team keeps whatever was already picked.
      pickedTeamId: p.pickedTeamId !== undefined ? p.pickedTeamId : (prev.pickedTeamId ?? null),
      confidence: p.confidence !== undefined ? p.confidence : (prev.confidence ?? null)
    });
  }

  // Collision resolution: the caller's assignment wins, and the older holder of
  // that confidence surrenders it while keeping its winner. This mirrors the
  // server's implicit-clear behaviour instead of sending it a duplicate it
  // would reject with a 400.
  const claimed = new Map();
  for (const id of incomingIds) {
    const entry = byGame.get(id);
    if (entry && entry.confidence != null) claimed.set(entry.confidence, id);
  }
  for (const [gameId, entry] of byGame) {
    if (entry.confidence == null) continue;
    const owner = claimed.get(entry.confidence);
    if (owner !== undefined && owner !== gameId) {
      byGame.set(gameId, { ...entry, confidence: null });
    }
  }

  // Drop entries that carry neither a winner nor a confidence -- there is
  // nothing to persist and the server would reject a bare gameId.
  return [...byGame.values()].filter((e) => e.pickedTeamId != null || e.confidence != null);
}

// The server requires a winner whenever a confidence is set, and rejects a
// duplicate outright. Catching both here turns a 400 round-trip into a clear
// message the model can act on.
export function validateWeek(picks) {
  const errors = [];
  const seen = new Map();
  for (const p of picks) {
    if (p.confidence != null) {
      if (!p.pickedTeamId) errors.push(`Game ${p.gameId} has confidence ${p.confidence} but no winner selected.`);
      if (seen.has(p.confidence)) {
        errors.push(`Confidence ${p.confidence} is used by both game ${seen.get(p.confidence)} and game ${p.gameId}.`);
      }
      seen.set(p.confidence, p.gameId);
    }
  }
  return errors;
}

export function nflGroups(groups) {
  return (Array.isArray(groups) ? groups : []).filter((g) => g.poolType !== WORLD_CUP_POOL);
}

export async function listGroups(client) {
  const groups = await client.get('/api/groups/my-groups');
  return nflGroups(groups).map((g) => ({
    identifier: g.identifier, name: g.name, memberCount: g.memberCount, role: g.userRole
  }));
}

export async function getSlate(client, { season, seasonType = 2, week }) {
  const data = await client.get(`/api/games/${season}/${seasonType}/${week}`);
  const games = data.games || data || [];
  return games.map((g) => ({
    gameId: g.id,
    matchup: `${g.awayTeam?.abbreviation}@${g.homeTeam?.abbreviation}`,
    kickoff: g.date,
    status: g.status,
    homeTeam: { id: g.homeTeam?.id, abbreviation: g.homeTeam?.abbreviation },
    awayTeam: { id: g.awayTeam?.id, abbreviation: g.awayTeam?.abbreviation },
    odds: g.odds ?? null
  }));
}

export async function getMyPicks(client, { group, season, seasonType = 2, week }) {
  const q = `?season=${season}&seasonType=${seasonType}&week=${week}`;
  const data = await client.get(`/api/groups/${encodeURIComponent(group)}/picks/me${q}`);
  return data.picks || [];
}

export async function getStandings(client, { group, season, seasonType = 2 }) {
  return client.get(`/api/groups/${encodeURIComponent(group)}/scoreboard?season=${season}&seasonType=${seasonType}`);
}

// Fans one identical set of picks out to several groups. Each group is a
// separate request, so a partial failure is a real outcome and is reported as
// one -- never silently swallowed.
export async function submitWeek(client, { groups, season, seasonType = 2, week, picks }) {
  const results = [];
  for (const group of groups) {
    try {
      const existing = await getMyPicks(client, { group, season, seasonType, week });
      const merged = mergeWeek(existing, picks);
      const errors = validateWeek(merged);
      if (errors.length) {
        results.push({ group, ok: false, error: errors.join(' ') });
        continue;
      }
      await client.post(`/api/groups/${encodeURIComponent(group)}/picks`, {
        season, seasonType, week, picks: merged, clearedGameIds: []
      });
      results.push({ group, ok: true, count: merged.length });
    } catch (e) {
      results.push({ group, ok: false, error: e.message });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  return { saved: ok, failed: results.length - ok, results };
}
