import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readSnapshot, writeSnapshot } from '../src/models/WorldCupLeaderboardSnapshot.js';

describe('WorldCupLeaderboardSnapshot model', () => {
  test('readSnapshot returns null when absent', async () => {
    const pool = { query: async () => ({ rows: [] }) };
    assert.equal(await readSnapshot(pool, 7), null);
  });

  test('readSnapshot maps a stored row', async () => {
    const pool = { query: async () => ({ rows: [
      { source_version: 'v1', payload: [{ userId: 1, rank: 1 }], computed_at: '2026-06-20T00:00:00.000Z' },
    ] }) };
    const snap = await readSnapshot(pool, 7);
    assert.equal(snap.version, 'v1');
    assert.equal(snap.payload[0].userId, 1);
  });

  test('writeSnapshot upserts with version + payload params', async () => {
    const calls = [];
    const pool = { query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] }; } };
    await writeSnapshot(pool, 7, 'v2', [{ userId: 9, rank: 1 }]);
    assert.equal(calls.length, 1);
    assert.match(calls[0].sql, /INSERT INTO wc_leaderboard_cache/i);
    assert.match(calls[0].sql, /ON CONFLICT/i);
    assert.equal(calls[0].params[0], 7);
    assert.equal(calls[0].params[1], 'v2');
  });
});
