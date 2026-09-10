import { test, describe, before, after, beforeEach, afterEach, mock } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import picksRouter from '../src/routes/picks.js';
import { AuthService } from '../src/services/AuthService.js';
import { User } from '../src/models/User.js';
import { Group } from '../src/models/Group.js';
import { UserPick } from '../src/models/UserPick.js';
import { GameService } from '../src/services/GameService.js';
import pool from '../src/config/database.js';

// The picks matrix distinguishes "picked" from "not picked" before kickoff. That
// requires the payload to say WHETHER a member has picked -- while still never
// saying WHAT they picked, which is the whole reason picks are withheld until
// the game starts.
//
// These cases pin both halves of that. The leak test is the important one: if it
// ever fails, members can read each other's picks off the wire before lockout.

const AUTH = { Authorization: 'Bearer session' };
const VIEWER = 1;
const OTHER = 22;

function game(id, status) {
  return {
    id, status, espnId: `e${id}`,
    homeTeam: { id: '26', abbreviation: 'SEA' },
    awayTeam: { id: '17', abbreviation: 'NE' },
    homeScore: 0, awayScore: 0, week: 1, season: 2026, seasonType: 2
  };
}

describe('pre-kickoff pick redaction', () => {
  let server, baseURL;

  before(async () => {
    const app = express();
    app.use(express.json());
    app.use('/api/groups', picksRouter);
    await new Promise((r) => { server = app.listen(0, () => { baseURL = `http://localhost:${server.address().port}`; r(); }); });
  });
  after(async () => { await new Promise((r) => server.close(r)); });

  beforeEach(() => {
    mock.method(AuthService, 'verifyAccessToken', () => ({ userId: VIEWER }));
    mock.method(User, 'findById', async () => ({ id: VIEWER, name: 'Viewer', email: 'v@x.io' }));
    mock.method(Group, 'findByIdentifier', async () => ({ id: 9, userRole: 'member' }));
    mock.method(UserPick, 'ensureConfidenceIndex', async () => {});
    mock.method(UserPick, 'findForUserWeek', async () => []);
    mock.method(pool, 'query', async () => ({ rows: [], rowCount: 0 }));
  });
  afterEach(() => mock.restoreAll());

  const fetchPicks = () =>
    fetch(`${baseURL}/api/groups/squad/picks?season=2026&seasonType=2&week=1`, { headers: AUTH })
      .then(async (r) => ({ status: r.status, body: await r.json() }));

  test('another member on a SCHEDULED game is marked submitted with the selection stripped', async () => {
    mock.method(GameService, 'getGamesForWeek', async () => [game(101, 'SCHEDULED')]);
    mock.method(UserPick, 'findForGroupWeek', async () => ([
      { userId: OTHER, gameId: 101, pickedTeamId: '26', confidence: 9, won: null, points: null }
    ]));

    const { status, body } = await fetchPicks();
    assert.strictEqual(status, 200);
    const entry = body.picks.find((m) => m.memberId === String(OTHER)).picks[0];

    assert.strictEqual(entry.submitted, true, 'submission status must be visible');
    // THE LEAK GUARD.
    assert.strictEqual(entry.pickedTeamId, null, 'the selected team must not be sent');
    assert.strictEqual(entry.confidence, null, 'the confidence must not be sent');
    const wire = JSON.stringify(body.picks);
    assert.ok(!wire.includes('"pickedTeamId":"26"'), 'no team id anywhere in the member payload');
    assert.ok(!wire.includes('"confidence":9'), 'no confidence anywhere in the member payload');
  });

  test('another member with no pick produces no entry at all', async () => {
    mock.method(GameService, 'getGamesForWeek', async () => [game(101, 'SCHEDULED')]);
    mock.method(UserPick, 'findForGroupWeek', async () => []);
    const { body } = await fetchPicks();
    assert.strictEqual(body.picks.length, 0, 'absence is how the client reads "not picked"');
  });

  test('an incomplete pick is not reported as submitted', async () => {
    // A team with no confidence is not a submitted pick.
    mock.method(GameService, 'getGamesForWeek', async () => [game(101, 'SCHEDULED')]);
    mock.method(UserPick, 'findForGroupWeek', async () => ([
      { userId: OTHER, gameId: 101, pickedTeamId: '26', confidence: null, won: null, points: null }
    ]));
    const { body } = await fetchPicks();
    assert.strictEqual(body.picks.length, 0);
  });

  test('the viewer sees their own pre-kickoff pick in full, and marked submitted', async () => {
    mock.method(GameService, 'getGamesForWeek', async () => [game(101, 'SCHEDULED')]);
    mock.method(UserPick, 'findForGroupWeek', async () => ([
      { userId: VIEWER, gameId: 101, pickedTeamId: '26', confidence: 9, won: null, points: null }
    ]));
    const { body } = await fetchPicks();
    const entry = body.picks.find((m) => m.memberId === String(VIEWER)).picks[0];
    assert.strictEqual(entry.pickedTeamId, '26', 'your own pick is never withheld from you');
    assert.strictEqual(entry.confidence, 9);
    assert.strictEqual(entry.submitted, true);
  });

  test('once a game is IN_PROGRESS another member\'s pick is revealed as before', async () => {
    mock.method(GameService, 'getGamesForWeek', async () => [game(101, 'IN_PROGRESS')]);
    mock.method(UserPick, 'findForGroupWeek', async () => ([
      { userId: OTHER, gameId: 101, pickedTeamId: '26', confidence: 9, won: null, points: null }
    ]));
    const { body } = await fetchPicks();
    const entry = body.picks.find((m) => m.memberId === String(OTHER)).picks[0];
    assert.strictEqual(entry.pickedTeamId, '26', 'withholding ends at kickoff');
    assert.strictEqual(entry.confidence, 9);
  });
});
