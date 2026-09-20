// Core tool logic. Deliberately free of MCP imports and of `fetch`: every
// function here takes an injected client, so the whole layer is unit-testable
// with no network and no protocol.

export const WORLD_CUP_POOL = 'world_cup_2026';

// POST /picks is a WHOLE-WEEK upsert, not a per-pick setter. The server
// enforces that confidence is unique across the week, so a naive "set one pick"
// call would post a payload that collides with the rest of the saved week.
//
// mergeWeek is the guard: it folds the caller's changes into the picks that
// already exist and hands the value back to whichever game the caller assigned
// it to, so the array we post is always internally consistent.
//
// Note on the server contract: assigning a confidence another game holds does
// NOT implicitly strip it from that game (an earlier version of this comment
// claimed it did). The server clears the previous holder only when that game is
// absent from the payload; when BOTH games are in the payload it relies on the
// write being ordered safely. That is why this function must still resolve
// collisions locally, and why the ordering fix lives in the server's two-phase
// bulkUpsert rather than here.
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

// Mirrors the backend's PRE_STATUSES (utils/pickLock.js): a game in one of these
// has not kicked off, so the 0-0 the API sends for it is a placeholder, not a score.
const NOT_STARTED = new Set(['SCHEDULED', 'NOT_STARTED', 'PRE', 'PREGAME']);

export async function getSlate(client, { season, seasonType = 2, week }) {
  const data = await client.get(`/api/games/${season}/${seasonType}/${week}`);
  const games = data.games || data || [];
  return games.map((g) => ({
    gameId: g.id,
    matchup: `${g.awayTeam?.abbreviation}@${g.homeTeam?.abbreviation}`,
    // The API field is `gameDate`. This read `g.date` -- always undefined, which
    // JSON.stringify drops silently, so every slate went out with no kickoff at
    // all and callers had no way to see a deadline coming.
    kickoff: g.gameDate ?? null,
    // Editability is resolved by the server (it owns the clock). `status` alone
    // is not a substitute: it trails the real kickoff by minutes, so a client
    // keying off it will happily offer to edit a game whose writes have closed.
    locksAt: g.locksAt ?? g.gameDate ?? null,
    editable: g.editable ?? null,
    status: g.status,
    // ESPN's human-readable state: the game clock while live ("10:08 - 4th
    // Quarter"), "Final" after, the kickoff time before.
    statusDetail: g.statusDetail ?? null,
    // null until kickoff. Passing the API's pre-game 0-0 through would read as a
    // live scoreless tie.
    score: NOT_STARTED.has(g.status) ? null : { home: g.homeScore ?? 0, away: g.awayScore ?? 0 },
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
  // One slate read for the whole fan-out (the slate does not vary by group). It
  // tells us which games the server considers closed, so a pick on a game that
  // has kicked off is dropped here and reported, instead of being posted and
  // taking every still-open pick in the batch down with it on a 409.
  //
  // A slate that cannot be read is not fatal: fall through with no filter and
  // let the server be the judge. Losing the optimisation beats refusing to save.
  let lockedIds = new Set();
  let slateKnown = false;
  try {
    const slate = await getSlate(client, { season, seasonType, week });
    lockedIds = new Set(slate.filter((g) => g.editable === false).map((g) => g.gameId));
    slateKnown = true;
  } catch {
    // keep going unfiltered
  }

  const submittable = slateKnown ? picks.filter((p) => !lockedIds.has(p.gameId)) : picks;
  const droppedLocked = slateKnown ? picks.filter((p) => lockedIds.has(p.gameId)).map((p) => p.gameId) : [];

  // Stable across the fan-out AND across retries of the same logical submission,
  // so a client that resends after a timeout is not racing itself. The server
  // serialises concurrent writes per user/group/week behind an advisory lock.
  const idempotencyKey = `w${season}-${seasonType}-${week}-${submittable
    .map((p) => `${p.gameId}:${p.pickedTeamId ?? ''}:${p.confidence ?? ''}`)
    .sort()
    .join('|')}`;

  const results = [];
  for (const group of groups) {
    try {
      const existing = await getMyPicks(client, { group, season, seasonType, week });
      const merged = mergeWeek(existing, submittable);
      const errors = validateWeek(merged);
      if (errors.length) {
        results.push({ group, ok: false, error: errors.join(' ') });
        continue;
      }
      const body = await client.post(
        `/api/groups/${encodeURIComponent(group)}/picks`,
        { season, seasonType, week, picks: merged, clearedGameIds: [] },
        { 'Idempotency-Key': idempotencyKey }
      );
      results.push({
        group,
        ok: true,
        count: merged.length,
        // Locked games the client withheld, plus any the server accepted only as
        // an unchanged no-op. Both mean "not applied", and a caller that cannot
        // see them has to diff the week to find out.
        ...(droppedLocked.length ? { skippedLocked: droppedLocked } : {}),
        ...(body?.skippedLocked?.length ? { serverSkippedLocked: body.skippedLocked } : {})
      });
    } catch (e) {
      results.push({ group, ok: false, error: e.message });
    }
  }
  const ok = results.filter((r) => r.ok).length;
  return {
    saved: ok,
    failed: results.length - ok,
    ...(droppedLocked.length ? { skippedLocked: droppedLocked } : {}),
    results
  };
}
