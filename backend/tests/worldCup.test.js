import { test, describe, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert';
import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { generateMockWorldCupStage, WORLD_CUP_2026_TEAMS } from '../src/mocks/espnWorldCupData.js';
import { Game } from '../src/models/Game.js';
import { scoreSoccerPick } from '../src/services/SoccerScoringService.js';

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
