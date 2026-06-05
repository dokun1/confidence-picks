import { test, describe } from 'node:test';
import assert from 'node:assert';
import {
  scoreSoccerPick,
  deriveActualResult,
  aggregateUserScore,
  tiebreakerComparator,
  buildLeaderboard,
  isKnockoutStage,
} from '../src/services/SoccerScoringService.js';

// Pure unit tests — no DB, no fixtures. Game objects are built inline to the
// documented contract (homeTeam.id / awayTeam.id, homeScore/awayScore, stage,
// status/completed, winnerTeamId). Source of truth for the numbers:
// frontend/docs/world-cup-picks-rules.md.

const HOME = { id: 'H' };
const AWAY = { id: 'A' };

// Group-stage match helper. status FINAL by default so it scores.
function groupGame({ homeScore, awayScore, status = 'FINAL' }) {
  return { homeTeam: HOME, awayTeam: AWAY, homeScore, awayScore, stage: 'group', status };
}

// Knockout match helper. winnerTeamId is the GameService-resolved advancer.
function knockoutGame({ homeScore, awayScore, winnerTeamId, stage = 'r16', status = 'FINAL' }) {
  return { homeTeam: HOME, awayTeam: AWAY, homeScore, awayScore, stage, status, winnerTeamId };
}

const pick = (picked_result) => ({ picked_result });

describe('isKnockoutStage', () => {
  test('the six FIFA round codes are knockouts', () => {
    for (const s of ['r32', 'r16', 'qf', 'sf', 'third', 'final']) {
      assert.strictEqual(isKnockoutStage(s), true, `${s} should be knockout`);
    }
  });

  test('group and NFL-shaped stages are not knockouts', () => {
    assert.strictEqual(isKnockoutStage('group'), false);
    assert.strictEqual(isKnockoutStage(null), false);
    assert.strictEqual(isKnockoutStage(undefined), false);
  });
});

describe('deriveActualResult', () => {
  test('group stage reads the scoreline (home win / away win / draw)', () => {
    assert.deepStrictEqual(deriveActualResult(groupGame({ homeScore: 2, awayScore: 0 })), { outcome: 'home', decided: true });
    assert.deepStrictEqual(deriveActualResult(groupGame({ homeScore: 0, awayScore: 1 })), { outcome: 'away', decided: true });
    assert.deepStrictEqual(deriveActualResult(groupGame({ homeScore: 1, awayScore: 1 })), { outcome: 'draw', decided: true });
  });

  test('an unfinished match is undecided', () => {
    assert.deepStrictEqual(
      deriveActualResult(groupGame({ homeScore: 0, awayScore: 0, status: 'IN_PROGRESS' })),
      { outcome: null, decided: false }
    );
  });

  test('knockout prefers winnerTeamId — a PK win on a level score advances that team', () => {
    // 1-1 after 120', away advances on penalties.
    const g = knockoutGame({ homeScore: 1, awayScore: 1, winnerTeamId: 'A' });
    assert.deepStrictEqual(deriveActualResult(g), { outcome: 'away', decided: true });
  });

  test('knockout falls back to the scoreline when no winner is resolved', () => {
    const g = knockoutGame({ homeScore: 3, awayScore: 1, winnerTeamId: null });
    assert.deepStrictEqual(deriveActualResult(g), { outcome: 'home', decided: true });
  });

  test('knockout level score with no resolved advancer is undecided (never a draw)', () => {
    const g = knockoutGame({ homeScore: 0, awayScore: 0, winnerTeamId: null });
    assert.deepStrictEqual(deriveActualResult(g), { outcome: null, decided: false });
  });
});

describe('scoreSoccerPick — group stage', () => {
  test('picked team won → 3 (wins_correct)', () => {
    const r = scoreSoccerPick(pick('home'), groupGame({ homeScore: 2, awayScore: 0 }));
    assert.deepStrictEqual(r, { points: 3, bucket: 'wins_correct', scored: true });
  });

  test('picked team lost → 0 (losses)', () => {
    const r = scoreSoccerPick(pick('home'), groupGame({ homeScore: 0, awayScore: 2 }));
    assert.deepStrictEqual(r, { points: 0, bucket: 'losses', scored: true });
  });

  test('picked team, match drew → 1 (draws_incorrect)', () => {
    const r = scoreSoccerPick(pick('away'), groupGame({ homeScore: 1, awayScore: 1 }));
    assert.deepStrictEqual(r, { points: 1, bucket: 'draws_incorrect', scored: true });
  });

  test('picked draw, match drew → 2 (draws_correct)', () => {
    const r = scoreSoccerPick(pick('draw'), groupGame({ homeScore: 0, awayScore: 0 }));
    assert.deepStrictEqual(r, { points: 2, bucket: 'draws_correct', scored: true });
  });

  test('picked draw, a team won → 1 (draws_incorrect)', () => {
    const r = scoreSoccerPick(pick('draw'), groupGame({ homeScore: 3, awayScore: 1 }));
    assert.deepStrictEqual(r, { points: 1, bucket: 'draws_incorrect', scored: true });
  });

  test('away pick is symmetric with home pick', () => {
    const r = scoreSoccerPick(pick('away'), groupGame({ homeScore: 0, awayScore: 1 }));
    assert.deepStrictEqual(r, { points: 3, bucket: 'wins_correct', scored: true });
  });
});

describe('scoreSoccerPick — knockout stage', () => {
  test('picked advancing team → 3 (wins_correct), even via PKs on a level score', () => {
    const g = knockoutGame({ homeScore: 1, awayScore: 1, winnerTeamId: 'H' });
    const r = scoreSoccerPick(pick('home'), g);
    assert.deepStrictEqual(r, { points: 3, bucket: 'wins_correct', scored: true });
  });

  test('picked eliminated team → 0 (losses)', () => {
    const g = knockoutGame({ homeScore: 1, awayScore: 1, winnerTeamId: 'H' });
    const r = scoreSoccerPick(pick('away'), g);
    assert.deepStrictEqual(r, { points: 0, bucket: 'losses', scored: true });
  });

  test('draw pick on a knockout → 0 (draws_incorrect), special case', () => {
    const g = knockoutGame({ homeScore: 2, awayScore: 0, winnerTeamId: 'H' });
    const r = scoreSoccerPick(pick('draw'), g);
    assert.deepStrictEqual(r, { points: 0, bucket: 'draws_incorrect', scored: true });
  });
});

describe('scoreSoccerPick — unscored cases', () => {
  test('missing / invalid picked_result is unscored', () => {
    const g = groupGame({ homeScore: 1, awayScore: 0 });
    assert.deepStrictEqual(scoreSoccerPick({}, g), { points: 0, bucket: null, scored: false });
    assert.deepStrictEqual(scoreSoccerPick(pick(null), g), { points: 0, bucket: null, scored: false });
    assert.deepStrictEqual(scoreSoccerPick(pick('nonsense'), g), { points: 0, bucket: null, scored: false });
  });

  test('undecided match is unscored', () => {
    const g = groupGame({ homeScore: 0, awayScore: 0, status: 'SCHEDULED' });
    assert.deepStrictEqual(scoreSoccerPick(pick('draw'), g), { points: 0, bucket: null, scored: false });
  });
});

describe('aggregateUserScore', () => {
  test('partitions scored picks across the four buckets and sums points', () => {
    const entries = [
      { pick: pick('home'), game: groupGame({ homeScore: 2, awayScore: 0 }) },   // 3, wins_correct
      { pick: pick('away'), game: groupGame({ homeScore: 2, awayScore: 0 }) },   // 0, losses
      { pick: pick('draw'), game: groupGame({ homeScore: 1, awayScore: 1 }) },   // 2, draws_correct
      { pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 1 }) },   // 1, draws_incorrect
      { pick: pick('home'), game: knockoutGame({ homeScore: 0, awayScore: 0, winnerTeamId: 'H' }) }, // 3, wins_correct
      { pick: pick('home'), game: groupGame({ homeScore: 0, awayScore: 0, status: 'IN_PROGRESS' }) }, // unscored
    ];
    const row = aggregateUserScore(entries);
    assert.deepStrictEqual(row, {
      points: 9,
      wins_correct: 2,
      losses: 1,
      draws_correct: 1,
      draws_incorrect: 1,
    });
    // Buckets partition the decided picks (5 decided here).
    assert.strictEqual(row.wins_correct + row.losses + row.draws_correct + row.draws_incorrect, 5);
  });

  test('empty input yields a zeroed row', () => {
    assert.deepStrictEqual(aggregateUserScore(), {
      points: 0, wins_correct: 0, losses: 0, draws_correct: 0, draws_incorrect: 0,
    });
  });
});

describe('tiebreakerComparator', () => {
  const base = { points: 10, wins_correct: 3, losses: 1, draws_correct: 2, draws_incorrect: 1 };

  test('points desc dominates', () => {
    assert.ok(tiebreakerComparator({ ...base, points: 11 }, base) < 0);
    assert.ok(tiebreakerComparator(base, { ...base, points: 11 }) > 0);
  });

  test('then wins_correct desc', () => {
    assert.ok(tiebreakerComparator({ ...base, wins_correct: 4 }, base) < 0);
  });

  test('then losses asc', () => {
    assert.ok(tiebreakerComparator({ ...base, losses: 0 }, base) < 0);
    assert.ok(tiebreakerComparator({ ...base, losses: 5 }, base) > 0);
  });

  test('then draws_correct desc', () => {
    assert.ok(tiebreakerComparator({ ...base, draws_correct: 3 }, base) < 0);
  });

  test('then draws_incorrect asc', () => {
    assert.ok(tiebreakerComparator({ ...base, draws_incorrect: 0 }, base) < 0);
  });

  test('fully equal → 0 (split pot)', () => {
    assert.strictEqual(tiebreakerComparator({ ...base }, { ...base }), 0);
  });

  test('earlier criteria win over later ones', () => {
    // A has fewer wins but more points → A still ranks first.
    const a = { points: 12, wins_correct: 0, losses: 9, draws_correct: 0, draws_incorrect: 9 };
    const b = { points: 11, wins_correct: 9, losses: 0, draws_correct: 9, draws_incorrect: 0 };
    assert.ok(tiebreakerComparator(a, b) < 0);
  });
});

describe('buildLeaderboard', () => {
  test('orders users and applies the full tiebreaker chain', () => {
    const rows = [
      // u1: one win (3) + one loss → 3 points, wins_correct 1, losses 1
      { userId: 'u1', pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) },
      { userId: 'u1', pick: pick('home'), game: groupGame({ homeScore: 0, awayScore: 1 }) },
      // u2: one win → 3 points, wins_correct 1, losses 0 (beats u1 on losses asc)
      { userId: 'u2', pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) },
      // u3: top scorer → 6 points (group win + knockout win)
      { userId: 'u3', pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) },
      { userId: 'u3', pick: pick('home'), game: knockoutGame({ homeScore: 1, awayScore: 1, winnerTeamId: 'H' }) },
    ];
    const lb = buildLeaderboard(rows);
    assert.deepStrictEqual(lb.map((u) => u.userId), ['u3', 'u2', 'u1']);
    assert.deepStrictEqual(lb.map((u) => u.rank), [1, 2, 3]);
    assert.strictEqual(lb[0].points, 6);
    // u2 and u1 tie on points + wins_correct; losses asc breaks it for u2.
    assert.strictEqual(lb[1].userId, 'u2');
    assert.strictEqual(lb[1].losses, 0);
    assert.strictEqual(lb[2].losses, 1);
  });

  test('fully-tied users share a rank and are flagged tied (split pot)', () => {
    const rows = [
      { userId: 'b', pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) },
      { userId: 'a', pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) },
    ];
    const lb = buildLeaderboard(rows);
    assert.deepStrictEqual(lb.map((u) => u.rank), [1, 1]);
    assert.ok(lb.every((u) => u.tied === true));
    // Deterministic order among ties: pre-sorted by userId.
    assert.deepStrictEqual(lb.map((u) => u.userId), ['a', 'b']);
  });

  test('competition ranking skips after a tie (1, 1, 3)', () => {
    const rows = [
      { userId: 'a', pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) }, // 3
      { userId: 'b', pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) }, // 3
      { userId: 'c', pick: pick('home'), game: groupGame({ homeScore: 0, awayScore: 1 }) }, // 0
    ];
    const lb = buildLeaderboard(rows);
    assert.deepStrictEqual(lb.map((u) => u.rank), [1, 1, 3]);
    assert.deepStrictEqual(
      lb.map((u) => u.tied),
      [true, true, false]
    );
  });

  test('empty input yields an empty leaderboard', () => {
    assert.deepStrictEqual(buildLeaderboard(), []);
  });

  // Multi-user fixture that forces each realizable tiebreaker level to decide an
  // adjacent pair, in order. Points are pinned by the counts
  // (points = 3*wins_correct + 2*draws_correct + 1*draws_incorrect; losses add 0),
  // so points, wins_correct, losses, and draws_correct can each be made the sole
  // decider, but draws_incorrect cannot be isolated from real picks — once the
  // earlier criteria tie it is pinned equal too (covered in tiebreakerComparator
  // above). Mirrors the buildLeaderboard fixture in tests/worldCup.test.js.
  test('each realizable tiebreaker level decides an adjacent pair in turn', () => {
    const win = (userId) => ({ userId, pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) });     // +3 wins_correct
    const loss = (userId) => ({ userId, pick: pick('home'), game: groupGame({ homeScore: 0, awayScore: 1 }) });    // +0 losses
    const drawRight = (userId) => ({ userId, pick: pick('draw'), game: groupGame({ homeScore: 0, awayScore: 0 }) }); // +2 draws_correct
    const drawWrong = (userId) => ({ userId, pick: pick('home'), game: groupGame({ homeScore: 1, awayScore: 1 }) }); // +1 draws_incorrect

    const rows = [
      win('A'), win('A'), win('A'),                                                  // points 9
      win('B'), win('B'),                                                            // points 6, wins 2
      win('C'), drawRight('C'), drawWrong('C'),                                      // points 6, wins 1, losses 0
      win('D'), drawRight('D'), drawWrong('D'), loss('D'), loss('D'),                // points 6, wins 1, losses 2, dc 1
      win('E'), drawWrong('E'), drawWrong('E'), drawWrong('E'), loss('E'), loss('E'),// points 6, wins 1, losses 2, dc 0
      win('F'),                                                                       // points 3
      win('G'),                                                                       // points 3 (ties F)
    ];

    const lb = buildLeaderboard(rows);
    const byId = Object.fromEntries(lb.map((u) => [u.userId, u]));

    assert.deepStrictEqual(lb.map((u) => u.userId), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
    assert.deepStrictEqual(lb.map((u) => u.rank), [1, 2, 3, 4, 5, 6, 6]);
    assert.deepStrictEqual(lb.map((u) => u.tied), [false, false, false, false, false, true, true]);

    assert.ok(byId.A.points > byId.B.points);                                        // points decides A/B
    assert.strictEqual(byId.B.points, byId.C.points);
    assert.ok(byId.B.wins_correct > byId.C.wins_correct);                            // wins_correct decides B/C
    assert.strictEqual(byId.C.wins_correct, byId.D.wins_correct);
    assert.ok(byId.C.losses < byId.D.losses);                                        // losses decides C/D
    assert.strictEqual(byId.D.losses, byId.E.losses);
    assert.ok(byId.D.draws_correct > byId.E.draws_correct);                          // draws_correct decides D/E
    assert.strictEqual(tiebreakerComparator(byId.F, byId.G), 0);                     // F/G split the pot
  });
});
