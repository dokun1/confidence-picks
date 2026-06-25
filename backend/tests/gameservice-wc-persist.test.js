import { test, describe, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import { GameService } from '../src/services/GameService.js';
import { Game } from '../src/models/Game.js';
import { MockESPNService } from '../src/mocks/MockESPNService.js';
import { WORLD_CUP_2026_TEAMS } from '../src/mocks/espnWorldCupData.js';

// These tests verify that winner_team_id is resolved and assigned BEFORE save()
// is called, so it persists with the row rather than being grafted in-memory
// after the INSERT returns. The core invariant: a decisive FINAL game handed to
// save() must already carry a non-null winnerTeamId on the object.
//
// The mock group stage fixture has exactly one decisive FINAL: BRA 2-0 CAN
// (id '760602', home wins on regulation scores). That game is the anchor for
// the timing assertion.

describe('getWorldCupStage persists winner_team_id', () => {
  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();

    // Force the ESPN refresh path: empty stage cache so getWorldCupStage always
    // hits ESPN and calls save() for every event in the fixture.
    mock.method(Game, 'findByLeagueStage', async () => []);
    mock.method(Game, 'findByESPNIds', async () => new Map());
  });

  afterEach(() => {
    mock.restoreAll();
    MockESPNService.reset();
    delete process.env.USE_MOCK_ESPN;
  });

  test('a decisive FINAL game is saved with a non-null winnerTeamId equal to resolveWinnerTeamId', async () => {
    // Snapshot each Game instance at the moment save() is called.  The key
    // question is whether winnerTeamId was set ON THE OBJECT before save() ran —
    // not whether the returned game later carries the value (which it does even
    // in the old broken path, via a post-save graft).  We capture a shallow copy
    // of the winnerTeamId at save time so a post-save mutation cannot mask the
    // failure.
    const savedSnapshots = []; // { espnId, winnerTeamIdAtSaveTime }
    mock.method(Game.prototype, 'save', async function save() {
      this.id = this.id || 1;
      savedSnapshots.push({
        espnId: this.espnId,
        winnerTeamIdAtSaveTime: this.winnerTeamId,
        homeScore: this.homeScore,
        awayScore: this.awayScore,
        status: this.status,
        completed: this.completed,
        homeTeamId: this.homeTeam?.id ?? null,
        awayTeamId: this.awayTeam?.id ?? null,
        stage: this.stage,
      });
      return this;
    });

    const games = await GameService.getWorldCupStage('group');
    assert.ok(games.length > 0, 'should return at least one game');
    assert.ok(savedSnapshots.length > 0, 'save() should have been called at least once');

    // Every instance handed to save() must have winnerTeamId as an OWN property
    // (set before the call), not undefined.  This catches the case where the
    // property is only added post-save.
    for (const snap of savedSnapshots) {
      assert.ok(
        'winnerTeamIdAtSaveTime' in snap,
        `espnId=${snap.espnId}: winnerTeamId must be present on the object at save() time`,
      );
    }

    // Locate the snapshot for the decisive FINAL: BRA 2-0 CAN (id '760602').
    // This is the group-stage fixture with a clear winner and completed=true.
    const braCanSnap = savedSnapshots.find(s => s.espnId === '760602');
    assert.ok(braCanSnap, 'BRA vs CAN (id 760602) should have been saved');
    assert.strictEqual(braCanSnap.status, 'FINAL', 'BRA vs CAN should be FINAL');
    assert.ok(braCanSnap.homeScore > braCanSnap.awayScore, 'BRA should be winning');

    // THE CORE TIMING ASSERTION: winnerTeamId was non-null when save() ran.
    // If the code assigns winnerTeamId *after* save(), this value would be null
    // (or undefined) in the snapshot, and this assertion would fail.
    assert.notStrictEqual(
      braCanSnap.winnerTeamIdAtSaveTime,
      null,
      'winnerTeamId must be non-null at save() time for a decisive FINAL game',
    );
    assert.notStrictEqual(
      braCanSnap.winnerTeamIdAtSaveTime,
      undefined,
      'winnerTeamId must be defined at save() time',
    );

    // The resolved value must equal what GameService.resolveWinnerTeamId computes
    // from the game's own data — BRA is the home side with id '205'.
    const expectedWinner = WORLD_CUP_2026_TEAMS.BRA.id; // '205'
    assert.strictEqual(
      braCanSnap.winnerTeamIdAtSaveTime,
      expectedWinner,
      `winnerTeamId at save() time should be BRA's id (${expectedWinner}), got ${braCanSnap.winnerTeamIdAtSaveTime}`,
    );

    // Cross-check: the returned game object agrees with the saved snapshot.
    const braCanGame = games.find(g => g.espnId === '760602');
    assert.ok(braCanGame, 'BRA vs CAN should be in the returned games array');
    assert.strictEqual(
      braCanGame.winnerTeamId,
      expectedWinner,
      'returned game winnerTeamId should match what was saved',
    );
  });

  test('a group-stage draw is saved with winnerTeamId null (no winner)', async () => {
    const savedSnapshots = [];
    mock.method(Game.prototype, 'save', async function save() {
      this.id = this.id || 1;
      savedSnapshots.push({ espnId: this.espnId, winnerTeamIdAtSaveTime: this.winnerTeamId });
      return this;
    });

    await GameService.getWorldCupStage('group');

    // MEX 1-1 USA (id '760601') is the regulation draw fixture.
    const drawSnap = savedSnapshots.find(s => s.espnId === '760601');
    assert.ok(drawSnap, 'MEX vs USA draw (id 760601) should have been saved');
    assert.strictEqual(
      drawSnap.winnerTeamIdAtSaveTime,
      null,
      'a group-stage draw should be saved with winnerTeamId = null',
    );
  });

  test('a knockout FINAL with explicit winner flag is saved with the correct winnerTeamId', async () => {
    // The knockout fixture for stage 'r16' includes ENG 2-0 GER (winner: home)
    // and MEX 1-1 USA on penalties (winner: away → USA id '660').
    const savedSnapshots = [];
    mock.method(Game.prototype, 'save', async function save() {
      this.id = this.id || 1;
      savedSnapshots.push({
        espnId: this.espnId,
        winnerTeamIdAtSaveTime: this.winnerTeamId,
      });
      return this;
    });

    await GameService.getWorldCupStage('r16');

    // ENG 2-0 GER (id '760611'): regulation win, home advances.
    const engGerSnap = savedSnapshots.find(s => s.espnId === '760611');
    assert.ok(engGerSnap, 'ENG vs GER (id 760611) should have been saved');
    assert.strictEqual(
      engGerSnap.winnerTeamIdAtSaveTime,
      WORLD_CUP_2026_TEAMS.ENG.id,
      'ENG (home) should be winner at save() time',
    );

    // MEX 1-1 USA on PKs (id '760612'): away (USA) advances via winner flag.
    const pkSnap = savedSnapshots.find(s => s.espnId === '760612');
    assert.ok(pkSnap, 'MEX vs USA PK (id 760612) should have been saved');
    assert.strictEqual(
      pkSnap.winnerTeamIdAtSaveTime,
      WORLD_CUP_2026_TEAMS.USA.id,
      'USA (away) should be winner at save() time for the PK shootout',
    );
  });
});
