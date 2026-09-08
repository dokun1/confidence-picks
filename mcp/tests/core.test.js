import { test, describe } from 'node:test';
import assert from 'node:assert';
import { mergeWeek, validateWeek, nflGroups, submitWeek, listGroups, getSlate } from '../src/core.js';

// mergeWeek is the single most dangerous function in this package: get it wrong
// and an agent silently corrupts a user's whole week. These cases are the
// contract.

describe('mergeWeek', () => {
  test('a full slate on an empty week passes straight through', () => {
    const incoming = [
      { gameId: 1, pickedTeamId: '10', confidence: 2 },
      { gameId: 2, pickedTeamId: '20', confidence: 1 }
    ];
    assert.deepStrictEqual(mergeWeek([], incoming), incoming);
  });

  test('a partial update preserves picks it did not mention', () => {
    const existing = [
      { gameId: 1, pickedTeamId: '10', confidence: 3 },
      { gameId: 2, pickedTeamId: '20', confidence: 2 },
      { gameId: 3, pickedTeamId: '30', confidence: 1 }
    ];
    const merged = mergeWeek(existing, [{ gameId: 2, pickedTeamId: '21', confidence: 2 }]);
    assert.strictEqual(merged.length, 3);
    assert.deepStrictEqual(merged.find((p) => p.gameId === 1), { gameId: 1, pickedTeamId: '10', confidence: 3 });
    assert.strictEqual(merged.find((p) => p.gameId === 2).pickedTeamId, '21', 'the flip is applied');
    assert.deepStrictEqual(merged.find((p) => p.gameId === 3), { gameId: 3, pickedTeamId: '30', confidence: 1 });
  });

  test('a confidence collision strips the value from the previous holder, keeping its winner', () => {
    // This is the exact shape that makes the server return 400 Duplicate
    // confidence if it is not resolved client-side first.
    const existing = [
      { gameId: 1, pickedTeamId: '10', confidence: 5 },
      { gameId: 2, pickedTeamId: '20', confidence: 4 }
    ];
    const merged = mergeWeek(existing, [{ gameId: 2, pickedTeamId: '20', confidence: 5 }]);
    const g1 = merged.find((p) => p.gameId === 1);
    const g2 = merged.find((p) => p.gameId === 2);
    assert.strictEqual(g2.confidence, 5, 'the caller wins the contested value');
    assert.strictEqual(g1.confidence, null, 'the previous holder surrenders it');
    assert.strictEqual(g1.pickedTeamId, '10', 'but keeps its winner');
  });

  test('never emits a duplicate confidence, however tangled the input', () => {
    const existing = [
      { gameId: 1, pickedTeamId: 'a', confidence: 1 },
      { gameId: 2, pickedTeamId: 'b', confidence: 2 },
      { gameId: 3, pickedTeamId: 'c', confidence: 3 }
    ];
    const merged = mergeWeek(existing, [
      { gameId: 4, pickedTeamId: 'd', confidence: 1 },
      { gameId: 5, pickedTeamId: 'e', confidence: 3 }
    ]);
    const used = merged.filter((p) => p.confidence != null).map((p) => p.confidence);
    assert.strictEqual(new Set(used).size, used.length, `duplicate confidence in ${JSON.stringify(used)}`);
    assert.deepStrictEqual(validateWeek(merged), []);
  });

  test('an entry with only a confidence keeps the winner already on file', () => {
    const merged = mergeWeek([{ gameId: 1, pickedTeamId: '10', confidence: 1 }], [{ gameId: 1, confidence: 7 }]);
    assert.deepStrictEqual(merged[0], { gameId: 1, pickedTeamId: '10', confidence: 7 });
  });

  test('an entry with only a winner keeps the confidence already on file', () => {
    const merged = mergeWeek([{ gameId: 1, pickedTeamId: '10', confidence: 4 }], [{ gameId: 1, pickedTeamId: '11' }]);
    assert.deepStrictEqual(merged[0], { gameId: 1, pickedTeamId: '11', confidence: 4 });
  });

  test('drops entries carrying neither a winner nor a confidence', () => {
    const merged = mergeWeek([], [{ gameId: 1, pickedTeamId: null, confidence: null }, { gameId: 2, pickedTeamId: '20', confidence: 1 }]);
    assert.deepStrictEqual(merged.map((p) => p.gameId), [2]);
  });

  test('tolerates null and malformed input without throwing', () => {
    assert.deepStrictEqual(mergeWeek(null, null), []);
    assert.deepStrictEqual(mergeWeek(undefined, [null, { noGameId: true }]), []);
  });
});

describe('validateWeek', () => {
  test('accepts a clean week', () => {
    assert.deepStrictEqual(validateWeek([{ gameId: 1, pickedTeamId: 'a', confidence: 1 }]), []);
  });
  test('flags a confidence with no winner', () => {
    const errs = validateWeek([{ gameId: 1, pickedTeamId: null, confidence: 3 }]);
    assert.strictEqual(errs.length, 1);
    assert.match(errs[0], /no winner/);
  });
  test('flags a duplicate confidence', () => {
    const errs = validateWeek([
      { gameId: 1, pickedTeamId: 'a', confidence: 2 },
      { gameId: 2, pickedTeamId: 'b', confidence: 2 }
    ]);
    assert.match(errs[0], /Confidence 2 is used by both/);
  });
});

describe('nflGroups', () => {
  test('excludes World Cup pools and tolerates legacy null poolType', () => {
    const out = nflGroups([
      { identifier: 'a', poolType: 'nfl_weekly' },
      { identifier: 'b', poolType: 'world_cup_2026' },
      { identifier: 'c', poolType: null }
    ]);
    assert.deepStrictEqual(out.map((g) => g.identifier), ['a', 'c']);
  });
  test('tolerates a non-array', () => {
    assert.deepStrictEqual(nflGroups(undefined), []);
  });
});

// A fake client keeps these honest without a network.
function fakeClient({ get = async () => ({}), post = async () => ({}) } = {}) {
  const calls = [];
  return {
    calls,
    get: async (p) => { calls.push(['GET', p]); return get(p); },
    post: async (p, b) => { calls.push(['POST', p, b]); return post(p, b); }
  };
}

describe('listGroups', () => {
  test('returns a compact NFL-only listing', async () => {
    const c = fakeClient({ get: async () => ([
      { identifier: 'okun-family-picks', name: 'Okun Family Picks', memberCount: 7, userRole: 'admin', poolType: 'nfl_weekly' },
      { identifier: 'wc', name: 'WC', poolType: 'world_cup_2026' }
    ]) });
    const out = await listGroups(c);
    assert.deepStrictEqual(out, [{ identifier: 'okun-family-picks', name: 'Okun Family Picks', memberCount: 7, role: 'admin' }]);
  });
});

describe('getSlate', () => {
  test('flattens games into what a model needs to pick', async () => {
    const c = fakeClient({ get: async () => ({ games: [{
      id: 55, date: '2026-09-13T16:00:00Z', status: 'SCHEDULED',
      homeTeam: { id: '1', abbreviation: 'SEA' }, awayTeam: { id: '2', abbreviation: 'NE' }, odds: { spread: 'SEA -3' }
    }] }) });
    const out = await getSlate(c, { season: 2026, week: 1 });
    assert.deepStrictEqual(out[0], {
      gameId: 55, matchup: 'NE@SEA', kickoff: '2026-09-13T16:00:00Z', status: 'SCHEDULED',
      homeTeam: { id: '1', abbreviation: 'SEA' }, awayTeam: { id: '2', abbreviation: 'NE' }, odds: { spread: 'SEA -3' }
    });
  });
});

describe('submitWeek', () => {
  test('reads, merges and posts a full week per group', async () => {
    const c = fakeClient({
      get: async () => ({ picks: [{ gameId: 1, pickedTeamId: '10', confidence: 1 }] }),
      post: async () => ({ ok: true })
    });
    const res = await submitWeek(c, {
      groups: ['g1', 'g2'], season: 2026, week: 1,
      picks: [{ gameId: 2, pickedTeamId: '20', confidence: 2 }]
    });
    assert.strictEqual(res.saved, 2);
    assert.strictEqual(res.failed, 0);
    const posts = c.calls.filter((c2) => c2[0] === 'POST');
    assert.strictEqual(posts.length, 2);
    // The merge must have carried the pre-existing pick along, not replaced it.
    assert.strictEqual(posts[0][2].picks.length, 2);
    assert.deepStrictEqual(posts[0][2].clearedGameIds, []);
  });

  test('reports a partial failure honestly instead of swallowing it', async () => {
    let n = 0;
    const c = fakeClient({
      get: async () => ({ picks: [] }),
      post: async () => { n += 1; if (n === 2) throw new Error('Conflict (409) — game locked'); return {}; }
    });
    const res = await submitWeek(c, {
      groups: ['g1', 'g2', 'g3'], season: 2026, week: 1,
      picks: [{ gameId: 1, pickedTeamId: '10', confidence: 1 }]
    });
    assert.strictEqual(res.saved, 2);
    assert.strictEqual(res.failed, 1);
    assert.strictEqual(res.results[1].ok, false);
    assert.match(res.results[1].error, /409/);
  });

  test('refuses to post a week it knows the server would reject', async () => {
    const c = fakeClient({ get: async () => ({ picks: [] }), post: async () => { throw new Error('should not post'); } });
    const res = await submitWeek(c, {
      groups: ['g1'], season: 2026, week: 1,
      picks: [{ gameId: 1, confidence: 3 }] // confidence with no winner
    });
    assert.strictEqual(res.failed, 1);
    assert.match(res.results[0].error, /no winner/);
    assert.strictEqual(c.calls.filter((x) => x[0] === 'POST').length, 0);
  });
});
