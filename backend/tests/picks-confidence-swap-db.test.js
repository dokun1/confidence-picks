import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import pool from '../src/config/database.js';
import { UserPick } from '../src/models/UserPick.js';

// The mocked ordering test proves bulkUpsert ISSUES vacate-then-claim. This one
// proves the real partial unique index actually accepts it. It is the only test
// that would have caught the original bug, because the bug lived in how Postgres
// evaluated a multi-row INSERT against ux_user_picks_conf_per_week -- something
// no mock can reproduce.
//
// Skips (rather than fails) with no database, so `npm test` still works for a
// contributor who has not started Postgres.

let live = false;
let userId, groupId, gameA, gameB, gameC;
const SEASON = 2999, STYPE = 2, WEEK = 1;

before(async () => {
  try {
    await pool.query('SELECT 1');
    await pool.query(`SELECT 1 FROM user_picks LIMIT 1`);
    live = true;
  } catch { return; }

  const u = await pool.query(
    `INSERT INTO users (email, name, provider, google_id) VALUES ($1,$2,$3,$4)
     ON CONFLICT (email) DO UPDATE SET name=EXCLUDED.name RETURNING id`,
    [`swap-${Date.now()}@test.local`, 'Swap Tester', 'google', `swap-${Date.now()}`]
  );
  userId = u.rows[0].id;

  const g = await pool.query(
    `INSERT INTO groups (name, identifier, created_by) VALUES ($1,$2,$3) RETURNING id`,
    [`swap-grp-${Date.now()}`, `swap-grp-${Date.now()}`, userId]
  );
  groupId = g.rows[0].id;

  const mk = async (espn) => (await pool.query(
    `INSERT INTO games (espn_id, home_team, away_team, game_date, status, week, season, season_type)
     VALUES ($1,$2,$3,NOW(),'SCHEDULED',$4,$5,$6) RETURNING id`,
    [`swap-${espn}-${Date.now()}`, JSON.stringify({ id: '14' }), JSON.stringify({ id: '25' }), WEEK, SEASON, STYPE]
  )).rows[0].id;
  gameA = await mk('a'); gameB = await mk('b'); gameC = await mk('c');
});

after(async () => {
  if (!live) return;
  try {
    await pool.query('DELETE FROM user_picks WHERE user_id=$1', [userId]);
    await pool.query('DELETE FROM games WHERE id = ANY($1::int[])', [[gameA, gameB, gameC]]);
    await pool.query('DELETE FROM groups WHERE id=$1', [groupId]);
    await pool.query('DELETE FROM users WHERE id=$1', [userId]);
  } catch { /* best effort */ }
  await pool.end().catch(() => {});
});

describe('confidence permutations against the real partial unique index', () => {
  const put = (picks) => UserPick.bulkUpsert({ userId, groupId, season: SEASON, seasonType: STYPE, week: WEEK, picks });
  const read = async () => (await pool.query(
    `SELECT game_id, confidence_level FROM user_picks WHERE user_id=$1 AND group_id=$2 AND week=$3 AND season=$4 AND season_type=$5 ORDER BY game_id`,
    [userId, groupId, WEEK, SEASON, STYPE]
  )).rows.map((r) => [r.game_id, r.confidence_level]);

  test('a two-game swap commits instead of raising 23505', async (t) => {
    if (!live) return t.skip('no database');
    await put([
      { gameId: gameA, pickedTeamId: '14', confidence: 1 },
      { gameId: gameB, pickedTeamId: '25', confidence: 2 }
    ]);
    assert.deepStrictEqual(await read(), [[gameA, 1], [gameB, 2]]);

    // The exact operation that used to be impossible.
    await put([
      { gameId: gameA, pickedTeamId: '14', confidence: 2 },
      { gameId: gameB, pickedTeamId: '25', confidence: 1 }
    ]);
    assert.deepStrictEqual(await read(), [[gameA, 2], [gameB, 1]]);
  });

  test('a three-way rotation commits', async (t) => {
    if (!live) return t.skip('no database');
    await put([
      { gameId: gameA, pickedTeamId: '14', confidence: 1 },
      { gameId: gameB, pickedTeamId: '14', confidence: 2 },
      { gameId: gameC, pickedTeamId: '14', confidence: 3 }
    ]);
    await put([
      { gameId: gameA, pickedTeamId: '14', confidence: 2 },
      { gameId: gameB, pickedTeamId: '14', confidence: 3 },
      { gameId: gameC, pickedTeamId: '14', confidence: 1 }
    ]);
    assert.deepStrictEqual(await read(), [[gameA, 2], [gameB, 3], [gameC, 1]]);
  });

  test('a genuine duplicate is still rejected by the index', async (t) => {
    if (!live) return t.skip('no database');
    // Seed all three games so this case does not inherit the previous test's
    // ladder (gameC still held 1, which collided during setup).
    await put([
      { gameId: gameA, pickedTeamId: '14', confidence: 1 },
      { gameId: gameB, pickedTeamId: '14', confidence: 2 },
      { gameId: gameC, pickedTeamId: '14', confidence: 3 }
    ]);
    assert.deepStrictEqual(await read(), [[gameA, 1], [gameB, 2], [gameC, 3]]);

    await assert.rejects(
      () => put([
        { gameId: gameA, pickedTeamId: '14', confidence: 3 },
        { gameId: gameB, pickedTeamId: '14', confidence: 3 }
      ]),
      (e) => e.code === '23505',
      'the fix must not weaken the uniqueness guarantee'
    );

    // The transaction rolled back, so the vacate did not survive: the ladder is
    // exactly as it was. A half-applied week would be far worse than a refusal.
    assert.deepStrictEqual(await read(), [[gameA, 1], [gameB, 2], [gameC, 3]]);
  });
});
