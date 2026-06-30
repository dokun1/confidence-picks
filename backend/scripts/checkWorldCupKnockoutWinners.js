#!/usr/bin/env node
/**
 * checkWorldCupKnockoutWinners — diagnose (and optionally repair) World Cup
 * knockout games whose advancing team wasn't resolved, then report which group
 * leaderboards would change if recomputed.
 *
 * Why this exists: a knockout decided on penalties has a LEVEL regulation score
 * (e.g. GER 1-1 PAR). The advancing side is carried by `winner_team_id`, not the
 * scoreline. If that column is null on a FINAL knockout at a level score, the
 * match scores NOBODY (deriveActualResult → undecided) — so anyone who picked the
 * team that actually advanced is silently under-counted by 3 points. (Nobody is
 * ever over-counted: a wrong pick scores 0 either way.) The optional knockout
 * score bonus is independent and is awarded regardless, so it is never affected.
 *
 * What it does, in order:
 *   1. Lists every FINAL World Cup knockout game with its resolved/unresolved
 *      winner status. STUCK = level score + null winner (broken; scores nobody).
 *   2. For every `world_cup_2026` group, recomputes the leaderboard from the
 *      current games + picks and DIFFS it against the stored snapshot, printing
 *      any per-user point/rank change. This is the "check each leaderboard" sweep.
 *
 * Flags (default run mutates NOTHING — pure diagnosis):
 *   --force-resolve   Re-fetch every stage from ESPN (forceRefresh) before
 *                     computing, so a stuck `winner_team_id` is recovered and
 *                     persisted (this is what the deployed self-heal does on read).
 *   --recompute       Write the freshly-computed leaderboard back to the snapshot
 *                     cache (wc_leaderboard_cache) for every group, so the new
 *                     board is served immediately instead of on next natural read.
 *
 * Typical SEV usage (run where DATABASE_URL + ESPN egress exist, e.g. ops shell):
 *   node scripts/checkWorldCupKnockoutWinners.js                 # diagnose only
 *   node scripts/checkWorldCupKnockoutWinners.js --force-resolve # repair winners, preview board diffs
 *   node scripts/checkWorldCupKnockoutWinners.js --force-resolve --recompute  # repair + persist boards
 */
import 'dotenv/config';
import pool from '../src/config/database.js';
import { GameService } from '../src/services/GameService.js';
import {
  buildGroupLeaderboard,
  getLeaderboardVersion,
} from '../src/services/WorldCupLeaderboardService.js';
import { readSnapshot, writeSnapshot } from '../src/models/WorldCupLeaderboardSnapshot.js';

const KNOCKOUT = new Set(['r32', 'r16', 'qf', 'sf', 'third', 'final']);

const args = new Set(process.argv.slice(2));
const FORCE_RESOLVE = args.has('--force-resolve');
const RECOMPUTE = args.has('--recompute');

function teamId(t) { return t?.id != null ? String(t.id) : null; }

function winnerStatus(g) {
  const home = teamId(g.homeTeam);
  const away = teamId(g.awayTeam);
  const w = g.winnerTeamId != null ? String(g.winnerTeamId) : null;
  if (w && w === home) return { state: 'RESOLVED', side: `home/${g.homeTeam?.abbreviation}` };
  if (w && w === away) return { state: 'RESOLVED', side: `away/${g.awayTeam?.abbreviation}` };
  if (w) return { state: 'WINNER_UNKNOWN_TEAM', side: w };
  // No winner_team_id.
  if (Number(g.homeScore) !== Number(g.awayScore)) {
    return { state: 'NULL_BUT_REGULATION', side: '(scoreline still decides it)' };
  }
  return { state: 'STUCK', side: '(level score → scores NOBODY)' };
}

async function main() {
  console.log('=== World Cup knockout winner audit ===');
  console.log(`flags: ${FORCE_RESOLVE ? '--force-resolve ' : ''}${RECOMPUTE ? '--recompute' : ''}`.trim() || 'flags: (diagnose only, no writes)');
  if (FORCE_RESOLVE) console.log('Re-fetching all stages from ESPN (forceRefresh) to recover unresolved winners…');

  // getAllWorldCupStages returns Game objects with winner_team_id grafted on.
  // forceRefresh=true re-hits ESPN and persists any recovered winner.
  const games = await GameService.getAllWorldCupStages(FORCE_RESOLVE);

  // ---- Phase 1: knockout winner status ----
  const knockouts = games
    .filter((g) => KNOCKOUT.has(g.stage) && (g.status === 'FINAL' || g.completed === true))
    .sort((a, b) => new Date(a.gameDate) - new Date(b.gameDate));

  console.log(`\n--- FINAL knockout games (${knockouts.length}) ---`);
  const stuck = [];
  for (const g of knockouts) {
    const s = winnerStatus(g);
    const line = `[${g.stage}] ${g.homeTeam?.abbreviation} ${g.homeScore}-${g.awayScore} ${g.awayTeam?.abbreviation}  →  ${s.state} ${s.side}`;
    console.log('  ' + line);
    if (s.state === 'STUCK' || s.state === 'WINNER_UNKNOWN_TEAM') stuck.push(g);
  }
  if (stuck.length) {
    console.log(`\n  ⚠ ${stuck.length} game(s) still unresolved.`);
    if (!FORCE_RESOLVE) console.log('    Re-run with --force-resolve to recover the advancing side from ESPN.');
  } else {
    console.log('\n  ✓ Every FINAL knockout has a usable result (resolved winner or a decisive scoreline).');
  }

  // ---- Phase 2: per-group leaderboard diff ----
  const { rows: groups } = await pool.query(
    `SELECT id, name, identifier FROM groups WHERE pool_type = 'world_cup_2026' ORDER BY id`,
  );
  console.log(`\n--- World Cup groups (${groups.length}) ---`);

  let changedCount = 0;
  for (const grp of groups) {
    const group = { id: grp.id };
    let fresh;
    try {
      fresh = await buildGroupLeaderboard(pool, group, games);
    } catch (err) {
      console.log(`  [${grp.id}] ${grp.name}: ERROR computing — ${err.message}`);
      continue;
    }
    const snap = await readSnapshot(pool, grp.id);
    const old = snap?.payload ?? null;

    const oldById = new Map((old ?? []).map((r) => [r.userId, r]));
    const deltas = [];
    for (const r of fresh) {
      const prev = oldById.get(r.userId);
      const prevPts = prev?.points ?? null;
      const prevRank = prev?.rank ?? null;
      if (prevPts !== r.points || prevRank !== r.rank) {
        deltas.push(`${r.name ?? r.userId}: ${prevPts ?? '—'}→${r.points} pts, rank ${prevRank ?? '—'}→${r.rank}`);
      }
    }

    if (!old) {
      console.log(`  [${grp.id}] ${grp.name}: no cached snapshot yet (will compute on first read).`);
    } else if (deltas.length === 0) {
      console.log(`  [${grp.id}] ${grp.name}: ✓ unchanged (${fresh.length} members)`);
    } else {
      changedCount++;
      console.log(`  [${grp.id}] ${grp.name}: ⚠ ${deltas.length} change(s)`);
      for (const d of deltas) console.log(`        ${d}`);
    }

    if (RECOMPUTE) {
      const version = await getLeaderboardVersion(pool, group);
      await writeSnapshot(pool, grp.id, version, fresh);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`  unresolved knockouts : ${stuck.length}`);
  console.log(`  leaderboards changed : ${changedCount} / ${groups.length}`);
  if (RECOMPUTE) console.log('  snapshots rewritten  : yes (boards serve the recomputed values now)');
  else if (changedCount > 0) console.log('  snapshots rewritten  : NO — re-run with --recompute to persist, or just let them recompute on next natural read.');
  console.log('\nDone.');
}

main()
  .then(() => pool.end())
  .catch((err) => {
    console.error('Fatal:', err);
    return pool.end().finally(() => process.exit(1));
  });
