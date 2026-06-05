import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { generateMockWorldCupStage, WORLD_CUP_2026_TEAMS } from '../src/mocks/espnWorldCupData.js';
import { Game } from '../src/models/Game.js';
import {
  scoreSoccerPick,
  aggregateUserScore,
  tiebreakerComparator,
  buildLeaderboard,
} from '../src/services/SoccerScoringService.js';

// World Cup 2026 backend suite. This file is the shared home for every World Cup
// test (ingestion, scoring, leaderboard, ...). The scaffolding below — the mock
// imports and the reset hooks — is reused by each later describe block.
//
// Coverage in this file stays on the pure, in-memory parsing path
// (Game.fromESPNData / mock generators). The save()/find* persistence paths need
// a live Postgres pool, so they are out of scope here and exercised elsewhere.

// MockESPNService holds module-level state (config + generated games). Resetting
// before and after every test keeps suites independent and leaves no mock state
// behind once the run finishes — there are no spawned processes to reap.
beforeEach(() => {
  MockESPNService.reset();
});

afterEach(() => {
  MockESPNService.reset();
});

describe('soccer game ingestion', () => {
  describe('group-stage fixtures', () => {
    test('parses the MEX 1-1 USA draw into a world_cup group Game', () => {
      // Match 1 of the group slate: MEX (home) 1-1 USA (away), a regulation draw.
      const [drawMatch] = generateMockWorldCupStage({ stage: 'group' });
      const game = Game.fromESPNData(drawMatch, { league: 'world_cup', stage: 'group' });

      assert.strictEqual(game.league, 'world_cup', 'league should be stamped world_cup');
      assert.strictEqual(game.stage, 'group', 'stage should be stamped group');
      assert.strictEqual(game.homeTeam.abbreviation, 'MEX', 'home should be MEX via homeAway');
      assert.strictEqual(game.awayTeam.abbreviation, 'USA', 'away should be USA via homeAway');
      assert.strictEqual(game.homeScore, 1, 'home score should parse to 1');
      assert.strictEqual(game.awayScore, 1, 'away score should parse to 1');
    });

    test('parses the BRA 2-0 CAN regulation win into a completed Game', () => {
      // Match 2 of the group slate: BRA (home) 2-0 CAN (away), a final win.
      const [, winnerMatch] = generateMockWorldCupStage({ stage: 'group' });
      const game = Game.fromESPNData(winnerMatch, { league: 'world_cup', stage: 'group' });

      assert.strictEqual(game.league, 'world_cup');
      assert.strictEqual(game.stage, 'group');
      assert.strictEqual(game.homeTeam.abbreviation, 'BRA');
      assert.strictEqual(game.awayTeam.abbreviation, 'CAN');
      assert.strictEqual(game.homeScore, 2);
      assert.strictEqual(game.awayScore, 0);
      assert.strictEqual(game.status, 'FINAL', 'completed group win should normalize to FINAL');
    });

    test('stamps league/stage on every group fixture and keeps a valid World Cup team pair', () => {
      const validAbbrs = new Set(Object.values(WORLD_CUP_2026_TEAMS).map(t => t.abbreviation));
      const games = generateMockWorldCupStage({ stage: 'group' })
        .map(event => Game.fromESPNData(event, { league: 'world_cup', stage: 'group' }));

      assert.strictEqual(games.length, 3, 'group stage should ingest 3 fixtures');
      games.forEach(game => {
        assert.strictEqual(game.league, 'world_cup');
        assert.strictEqual(game.stage, 'group');
        assert.ok(validAbbrs.has(game.homeTeam.abbreviation), `${game.homeTeam.abbreviation} should be a World Cup team`);
        assert.ok(validAbbrs.has(game.awayTeam.abbreviation), `${game.awayTeam.abbreviation} should be a World Cup team`);
      });
    });
  });

  describe('knockout fixtures', () => {
    test('parses the ENG 2-0 GER round-of-16 win into a world_cup r16 Game', () => {
      // Match 1 of the knockout slate: ENG (home) 2-0 GER (away), R16, home advances.
      const [r16Match] = generateMockWorldCupStage({ stage: 'knockout' });
      const game = Game.fromESPNData(r16Match, { league: 'world_cup', stage: 'r16' });

      assert.strictEqual(game.league, 'world_cup', 'league should be stamped world_cup');
      assert.strictEqual(game.stage, 'r16', 'stage should carry the knockout code from opts');
      assert.strictEqual(game.homeTeam.abbreviation, 'ENG', 'home should be ENG via homeAway');
      assert.strictEqual(game.awayTeam.abbreviation, 'GER', 'away should be GER via homeAway');
      assert.strictEqual(game.homeScore, 2, 'home score should parse to 2');
      assert.strictEqual(game.awayScore, 0, 'away score should parse to 0');
      assert.strictEqual(game.status, 'FINAL', 'completed knockout should normalize to FINAL');
    });

    test('parses the MEX 1-1 USA penalty-shootout quarter-final at a level scoreline', () => {
      // Match 2 of the knockout slate: MEX (home) 1-1 USA (away), QF decided on PKs.
      // The 90' scoreline is level; Game ingestion keeps the level score, with the
      // advancing-winner resolution left to downstream soccer scoring.
      const [, pkMatch] = generateMockWorldCupStage({ stage: 'knockout' });
      const game = Game.fromESPNData(pkMatch, { league: 'world_cup', stage: 'qf' });

      assert.strictEqual(game.league, 'world_cup');
      assert.strictEqual(game.stage, 'qf');
      assert.strictEqual(game.homeTeam.abbreviation, 'MEX');
      assert.strictEqual(game.awayTeam.abbreviation, 'USA');
      assert.strictEqual(game.homeScore, 1, 'home score should be level at 1');
      assert.strictEqual(game.awayScore, 1, 'away score should be level at 1');
    });

    test('stamps league and the per-match knockout code across the knockout slate', () => {
      const validAbbrs = new Set(Object.values(WORLD_CUP_2026_TEAMS).map(t => t.abbreviation));
      const events = generateMockWorldCupStage({ stage: 'knockout' });
      // The mock tags each competition with its real knockout code; the ingestion
      // caller mirrors that into opts.stage. Pair them up to assert the wiring.
      const stages = events.map(e => e.competitions[0].stage);
      const games = events.map((event, i) => Game.fromESPNData(event, { league: 'world_cup', stage: stages[i] }));

      assert.strictEqual(games.length, 3, 'knockout slate should ingest 3 fixtures');
      games.forEach((game, i) => {
        assert.strictEqual(game.league, 'world_cup');
        assert.strictEqual(game.stage, stages[i], 'stage should match the competition knockout code');
        assert.ok(validAbbrs.has(game.homeTeam.abbreviation), `${game.homeTeam.abbreviation} should be a World Cup team`);
        assert.ok(validAbbrs.has(game.awayTeam.abbreviation), `${game.awayTeam.abbreviation} should be a World Cup team`);
      });
    });
  });
});

describe('scoreSoccerPick — group stage', () => {
  // Group-stage matches are scored straight off the final scoreline (no
  // winnerTeamId, no PK resolution). Game objects are built inline to the
  // SoccerScoringService contract: homeTeam.id / awayTeam.id, homeScore /
  // awayScore, stage 'group', status 'FINAL' so the match is complete and
  // scoreable. Source of truth for the points/buckets:
  // frontend/docs/world-cup-picks-rules.md. Mirrors the inline-game pattern in
  // tests/soccer-scoring.test.js.
  const HOME = { id: 'H' };
  const AWAY = { id: 'A' };

  function groupGame({ homeScore, awayScore }) {
    return { homeTeam: HOME, awayTeam: AWAY, homeScore, awayScore, stage: 'group', status: 'FINAL' };
  }

  const pick = (picked_result) => ({ picked_result });

  // (1) Picked the team that won → 3 points, wins_correct.
  test('picked the winning team → 3 (wins_correct)', () => {
    const r = scoreSoccerPick(pick('home'), groupGame({ homeScore: 2, awayScore: 0 }));
    assert.deepStrictEqual(r, { points: 3, bucket: 'wins_correct', scored: true });
  });

  // (2) Picked the team that lost → 0 points, losses.
  test('picked the losing team → 0 (losses)', () => {
    const r = scoreSoccerPick(pick('home'), groupGame({ homeScore: 0, awayScore: 2 }));
    assert.deepStrictEqual(r, { points: 0, bucket: 'losses', scored: true });
  });

  // (3) Picked a team but the match drew → 1 point, draws_incorrect.
  test('picked a team that drew (match drew) → 1 (draws_incorrect)', () => {
    const r = scoreSoccerPick(pick('away'), groupGame({ homeScore: 1, awayScore: 1 }));
    assert.deepStrictEqual(r, { points: 1, bucket: 'draws_incorrect', scored: true });
  });

  // (4) Picked 'draw' and the match drew → 2 points, draws_correct.
  test("picked 'draw' and the match drew → 2 (draws_correct)", () => {
    const r = scoreSoccerPick(pick('draw'), groupGame({ homeScore: 0, awayScore: 0 }));
    assert.deepStrictEqual(r, { points: 2, bucket: 'draws_correct', scored: true });
  });

  // (5) Picked 'draw' but a team won → 1 point, draws_incorrect.
  test("picked 'draw' but a team won → 1 (draws_incorrect)", () => {
    const r = scoreSoccerPick(pick('draw'), groupGame({ homeScore: 3, awayScore: 1 }));
    assert.deepStrictEqual(r, { points: 1, bucket: 'draws_incorrect', scored: true });
  });
});

describe('scoreSoccerPick — knockout stage', () => {
  // Knockout matches always advance exactly one team — there is no draw result.
  // The GameService-resolved `winnerTeamId` names the advancing side; on a PK
  // shootout it is the only signal, since the 90'/120' scoreline can be level.
  // Games are built inline to the SoccerScoringService contract (homeTeam.id /
  // awayTeam.id, homeScore/awayScore, stage 'r16', status 'FINAL', winnerTeamId).
  // Mirrors the knockout block in tests/soccer-scoring.test.js. Source of truth
  // for the points/buckets: frontend/docs/world-cup-picks-rules.md.
  const HOME = { id: 'H' };
  const AWAY = { id: 'A' };

  function knockoutGame({ homeScore, awayScore, winnerTeamId }) {
    return { homeTeam: HOME, awayTeam: AWAY, homeScore, awayScore, stage: 'r16', status: 'FINAL', winnerTeamId };
  }

  const pick = (picked_result) => ({ picked_result });

  // Picked the advancing team on a regulation win → 3, wins_correct.
  test('picked the advancing team (regulation win) → 3 (wins_correct)', () => {
    const r = scoreSoccerPick(pick('home'), knockoutGame({ homeScore: 2, awayScore: 0, winnerTeamId: 'H' }));
    assert.deepStrictEqual(r, { points: 3, bucket: 'wins_correct', scored: true });
  });

  // Picked the advancing team on a PK shootout (level 1-1 score, winnerTeamId
  // names the side that advanced) → 3, wins_correct.
  test('picked the advancing team via PK shootout on a level score → 3 (wins_correct)', () => {
    const r = scoreSoccerPick(pick('away'), knockoutGame({ homeScore: 1, awayScore: 1, winnerTeamId: 'A' }));
    assert.deepStrictEqual(r, { points: 3, bucket: 'wins_correct', scored: true });
  });

  // Picked the eliminated team → 0, losses (including the level-score PK case).
  test('picked the eliminated team → 0 (losses)', () => {
    const r = scoreSoccerPick(pick('home'), knockoutGame({ homeScore: 1, awayScore: 1, winnerTeamId: 'A' }));
    assert.deepStrictEqual(r, { points: 0, bucket: 'losses', scored: true });
  });

  // A 'draw' pick can never score on a knockout — there is always an advancer.
  test("picked 'draw' on a knockout → 0 (draws_incorrect)", () => {
    const r = scoreSoccerPick(pick('draw'), knockoutGame({ homeScore: 2, awayScore: 0, winnerTeamId: 'H' }));
    assert.deepStrictEqual(r, { points: 0, bucket: 'draws_incorrect', scored: true });
  });
});

describe('tiebreaker comparator', () => {
  // The leaderboard order is decided by `tiebreakerComparator`, consulted level by
  // level: points desc → wins_correct desc → losses asc → draws_correct desc →
  // draws_incorrect asc → fully equal (0, split pot). Source of truth for the order:
  // frontend/docs/world-cup-picks-rules.md § Tiebreakers. Mirrors the comparator +
  // buildLeaderboard assertions in tests/soccer-scoring.test.js.

  // --- Comparator on hand-built aggregate rows -----------------------------------
  // These call the comparator directly on { points, wins_correct, losses,
  // draws_correct, draws_incorrect } rows so each level can be isolated — including
  // draws_incorrect, which cannot be isolated through real picks (see the note on
  // the buildLeaderboard fixture below).
  describe('on aggregate rows, each level decides in order', () => {
    const base = { points: 10, wins_correct: 3, losses: 2, draws_correct: 2, draws_incorrect: 2 };

    test('points desc dominates', () => {
      assert.ok(tiebreakerComparator({ ...base, points: 11 }, base) < 0, 'more points ranks first');
      assert.ok(tiebreakerComparator(base, { ...base, points: 11 }) > 0, 'fewer points ranks last');
    });

    test('wins_correct desc when points tie', () => {
      assert.ok(tiebreakerComparator({ ...base, wins_correct: 4 }, base) < 0, 'more wins ranks first');
      assert.ok(tiebreakerComparator(base, { ...base, wins_correct: 4 }) > 0);
    });

    test('losses asc when points + wins tie', () => {
      assert.ok(tiebreakerComparator({ ...base, losses: 0 }, base) < 0, 'fewer losses ranks first');
      assert.ok(tiebreakerComparator(base, { ...base, losses: 0 }) > 0);
    });

    test('draws_correct desc when points + wins + losses tie', () => {
      assert.ok(tiebreakerComparator({ ...base, draws_correct: 3 }, base) < 0, 'more correct draws ranks first');
      assert.ok(tiebreakerComparator(base, { ...base, draws_correct: 3 }) > 0);
    });

    test('draws_incorrect asc when all earlier criteria tie', () => {
      assert.ok(tiebreakerComparator({ ...base, draws_incorrect: 0 }, base) < 0, 'fewer wrong draws ranks first');
      assert.ok(tiebreakerComparator(base, { ...base, draws_incorrect: 0 }) > 0);
    });

    test('fully equal → 0 (split pot)', () => {
      assert.strictEqual(tiebreakerComparator({ ...base }, { ...base }), 0);
    });

    test('an earlier level outranks a worse later level', () => {
      // A trails on every later criterion but leads on points → A still ranks first.
      const a = { points: 12, wins_correct: 0, losses: 9, draws_correct: 0, draws_incorrect: 9 };
      const b = { points: 11, wins_correct: 9, losses: 0, draws_correct: 9, draws_incorrect: 0 };
      assert.ok(tiebreakerComparator(a, b) < 0);
    });
  });

  // --- Multi-user fixture through buildLeaderboard --------------------------------
  // Picks are scored to real aggregates, so points are pinned by the counts:
  // points = 3*wins_correct + 2*draws_correct + 1*draws_incorrect (losses add 0).
  // That coupling means points, wins_correct, losses, and draws_correct can each be
  // forced to decide an adjacent pair, but draws_incorrect cannot be isolated as a
  // tiebreaker from real data: once points, wins_correct, and draws_correct all tie,
  // draws_incorrect is pinned equal too. It is covered at the comparator level above.
  describe('buildLeaderboard forces each realizable level to decide in turn', () => {
    const HOME = { id: 'H' };
    const AWAY = { id: 'A' };
    const groupGame = ({ homeScore, awayScore }) =>
      ({ homeTeam: HOME, awayTeam: AWAY, homeScore, awayScore, stage: 'group', status: 'FINAL' });
    const pickFor = (picked_result) => ({ picked_result });

    // Per-user pick building blocks, each contributing to exactly one bucket.
    const win = (userId) => ({ userId, pick: pickFor('home'), game: groupGame({ homeScore: 1, awayScore: 0 }) });     // +3 wins_correct
    const loss = (userId) => ({ userId, pick: pickFor('home'), game: groupGame({ homeScore: 0, awayScore: 1 }) });    // +0 losses
    const drawRight = (userId) => ({ userId, pick: pickFor('draw'), game: groupGame({ homeScore: 0, awayScore: 0 }) }); // +2 draws_correct
    const drawWrong = (userId) => ({ userId, pick: pickFor('home'), game: groupGame({ homeScore: 1, awayScore: 1 }) }); // +1 draws_incorrect

    // Sanity-check the building blocks via aggregateUserScore so the fixture's intent
    // is verifiable, not just asserted at the end.
    test('building blocks aggregate to the expected bucket counts', () => {
      assert.deepStrictEqual(
        aggregateUserScore([win('x'), drawRight('x'), drawWrong('x'), loss('x')]),
        { points: 6, wins_correct: 1, losses: 1, draws_correct: 1, draws_incorrect: 1 }
      );
    });

    test('points → wins_correct → losses → draws_correct decide adjacent pairs; full tie splits the pot', () => {
      const rows = [
        // A: 3 wins → points 9 (leads on points)
        win('A'), win('A'), win('A'),
        // B: 2 wins → points 6, wins_correct 2
        win('B'), win('B'),
        // C: win + drawRight + drawWrong → points 6, wins_correct 1, losses 0
        win('C'), drawRight('C'), drawWrong('C'),
        // D: same as C plus 2 losses → points 6, wins_correct 1, losses 2, draws_correct 1
        win('D'), drawRight('D'), drawWrong('D'), loss('D'), loss('D'),
        // E: win + 3 drawWrong + 2 losses → points 6, wins_correct 1, losses 2, draws_correct 0
        win('E'), drawWrong('E'), drawWrong('E'), drawWrong('E'), loss('E'), loss('E'),
        // F, G: one win each → points 3, identical → fully tied (split pot)
        win('F'),
        win('G'),
      ];

      const lb = buildLeaderboard(rows);
      const byId = Object.fromEntries(lb.map((u) => [u.userId, u]));

      // Final order and competition ranks (skips after the F/G tie).
      assert.deepStrictEqual(lb.map((u) => u.userId), ['A', 'B', 'C', 'D', 'E', 'F', 'G']);
      assert.deepStrictEqual(lb.map((u) => u.rank), [1, 2, 3, 4, 5, 6, 6]);
      assert.deepStrictEqual(lb.map((u) => u.tied), [false, false, false, false, false, true, true]);

      // A > B: points is the deciding factor.
      assert.ok(byId.A.points > byId.B.points, 'A leads on points');

      // B > C: points tie, wins_correct decides.
      assert.strictEqual(byId.B.points, byId.C.points);
      assert.ok(byId.B.wins_correct > byId.C.wins_correct, 'wins_correct breaks the B/C points tie');

      // C > D: points + wins_correct tie, losses decides.
      assert.strictEqual(byId.C.points, byId.D.points);
      assert.strictEqual(byId.C.wins_correct, byId.D.wins_correct);
      assert.ok(byId.C.losses < byId.D.losses, 'fewer losses breaks the C/D tie');

      // D > E: points + wins_correct + losses tie, draws_correct decides.
      assert.strictEqual(byId.D.points, byId.E.points);
      assert.strictEqual(byId.D.wins_correct, byId.E.wins_correct);
      assert.strictEqual(byId.D.losses, byId.E.losses);
      assert.ok(byId.D.draws_correct > byId.E.draws_correct, 'more correct draws breaks the D/E tie');

      // F / G: identical on every criterion → shared rank, both flagged tied.
      assert.strictEqual(tiebreakerComparator(byId.F, byId.G), 0);
      assert.strictEqual(byId.F.rank, byId.G.rank);
      assert.ok(byId.F.tied && byId.G.tied);

      // The four tiebreaker counts ride along on every leaderboard row (payload shape).
      for (const u of lb) {
        for (const k of ['points', 'wins_correct', 'losses', 'draws_correct', 'draws_incorrect']) {
          assert.strictEqual(typeof u[k], 'number', `${u.userId}.${k} should be a number`);
        }
      }
    });
  });
});
