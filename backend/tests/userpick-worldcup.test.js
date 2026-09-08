import { test, describe } from 'node:test';
import assert from 'node:assert';
import { UserPick, buildWorldCupUpsert, WORLD_CUP_RESULTS } from '../src/models/UserPick.js';

// Pure unit tests — no DB. Importing UserPick constructs a pg Pool object but
// never connects (no query is issued), so these run offline. They cover the two
// offline seams: the constructor's field mapping and the pure SQL/param builder.

describe('UserPick constructor serialization', () => {
  test('surfaces picked_result as pickedResult for a World Cup row', () => {
    const p = new UserPick({
      id: 1, user_id: 7, group_id: 3, game_id: 42,
      picked_team_id: null, confidence_level: null, picked_result: 'draw',
      week: 1, season: 2026, season_type: 5,
    });
    assert.strictEqual(p.pickedResult, 'draw');
    assert.strictEqual(p.pickedTeamId, null);
    assert.strictEqual(p.confidence, null);
  });

  test('preserves NFL pick shape with picked_result NULL', () => {
    const p = new UserPick({
      id: 2, user_id: 7, group_id: 3, game_id: 99,
      picked_team_id: '12', confidence_level: 8, picked_result: null,
      week: 4, season: 2025, season_type: 2, won: true, points: 8,
    });
    assert.strictEqual(p.pickedTeamId, '12');
    assert.strictEqual(p.confidence, 8);
    assert.strictEqual(p.won, true);
    assert.strictEqual(p.points, 8);
    assert.strictEqual(p.pickedResult, null);
  });

  test('defaults pickedResult to null when the column is absent', () => {
    const p = new UserPick({ id: 3, user_id: 1, group_id: 1, game_id: 1, week: 1, season: 2024, season_type: 2 });
    assert.strictEqual(p.pickedResult, null);
  });
});

describe('buildWorldCupUpsert', () => {
  const base = { userId: 7, groupId: 3, season: 2026, seasonType: 5, week: 1 };

  test('emits 9 contiguous params per pick in column order (including score prediction columns)', () => {
    const { sql, values } = buildWorldCupUpsert({
      ...base,
      picks: [
        { gameId: 10, pickedResult: 'home' },
        { gameId: 11, pickedResult: 'draw' },
      ],
    });
    assert.match(sql, /INSERT INTO user_picks \(user_id, group_id, game_id, picked_result, week, season, season_type, predicted_home_score, predicted_away_score\)/);
    assert.match(sql, /\(\$1,\$2,\$3,\$4,\$5,\$6,\$7,\$8,\$9\),\(\$10,\$11,\$12,\$13,\$14,\$15,\$16,\$17,\$18\)/);
    assert.deepStrictEqual(values, [
      7, 3, 10, 'home', 1, 2026, 5, null, null,
      7, 3, 11, 'draw', 1, 2026, 5, null, null,
    ]);
  });

  test('forces picked_team_id and confidence_level NULL on conflict', () => {
    const { sql } = buildWorldCupUpsert({ ...base, picks: [{ gameId: 10, pickedResult: 'away' }] });
    assert.match(sql, /ON CONFLICT \(user_id, group_id, game_id\) DO UPDATE SET/);
    assert.match(sql, /picked_result = EXCLUDED\.picked_result/);
    assert.match(sql, /picked_team_id = NULL/);
    assert.match(sql, /confidence_level = NULL/);
  });

  test('rejects an out-of-domain picked_result', () => {
    assert.throws(
      () => buildWorldCupUpsert({ ...base, picks: [{ gameId: 10, pickedResult: 'tie' }] }),
      /Invalid picked_result: tie/,
    );
  });

  test('rejects a pick missing gameId', () => {
    assert.throws(
      () => buildWorldCupUpsert({ ...base, picks: [{ pickedResult: 'home' }] }),
      /missing gameId/,
    );
  });

  test('exports the three valid outcomes', () => {
    assert.deepStrictEqual(WORLD_CUP_RESULTS, ['home', 'away', 'draw']);
  });
});
