# World Cup Leaderboard Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move World Cup leaderboard scoring off the per-request hot path so it recomputes only when a game finalizes, a member joins/leaves, or a pick changes — letting groups scale far past the current ~40-member comfort zone without breaking the live tournament.

**Architecture:** Decouple **ingestion** (pull ESPN results into the DB, throttled and tournament-global) from **computation** (score picks against DB-stored games). Add a per-group snapshot table keyed by a cheap "version watermark"; on read, refresh games (throttled), compute the watermark, and serve the stored snapshot unless the watermark moved. Every new path is additive, idempotent, flag-gated (`off`/`shadow`/`on`), and falls back to today's live computation on any error — so we can deploy dark, prove parity in production against real finalizations, then flip on.

**Tech Stack:** Node.js (ES modules), Express, PostgreSQL (`pg`), Node's built-in test runner (`node --test` + `node:assert` + `node:test` `mock`), `MockESPNService` for ESPN-free tests.

## Global Constraints

- **Mid-tournament safety is paramount.** The live leaderboard (`GET /api/picks/group/:groupId/world-cup/leaderboard`) MUST keep returning correct results at every commit. No task may change the default behavior until Task 8's flag is explicitly flipped.
- **All schema changes additive, idempotent, nullable.** Use `DO $$ ... END $$` guards matching the existing pattern in `backend/src/database/schema.sql` (see lines 197–317). Never drop/alter existing columns. Legacy NFL rows must stay untouched.
- **Flag default is `off`.** New behavior is gated by env var `WC_LEADERBOARD_CACHE` ∈ {`off` (default), `shadow`, `on`}. Unset ⇒ `off` ⇒ identical to today.
- **Cached path always falls back to live computation on any thrown error.** A cache bug must degrade to "slower but correct," never to an error or stale board.
- **Team ids are ESPN string ids** stored inside `home_team`/`away_team` JSONB (`homeTeam.id` is a string). The new `winner_team_id` column is therefore `VARCHAR(50) NULL`.
- **Scoring only counts FINAL games.** `SoccerScoringService.scoreSoccerPick` scores nothing until a game is decided, so the board only changes on finalization — but picks are **not** locked server-side (see Task 5 rationale), so the version watermark MUST also include a picks signal.
- **Run backend tests with:** `cd backend && node --test tests/<file>.test.js` (single file) or `cd backend && npm test` (all). ESPN-dependent code must set `process.env.USE_MOCK_ESPN = 'true'` and call `MockESPNService.configure()` in `beforeEach`, mirroring `tests/api-worldcup-route.test.js`.
- **Inject `pool` and `now`, never import globals into pure logic.** Service functions take `pool` as their first argument and accept an optional injectable clock so tests need no live Postgres and no real time.

---

## Background: the current path (what we are changing)

`backend/src/routes/worldCupPicks.js:162-238` (`GET /group/:groupId/world-cup/leaderboard`) does this **on every request, per group, per viewer**:

1. Loops all 7 stages → `GameService.getWorldCupStage(stage)`, which **calls ESPN every time** (`fetchSoccerWeek`), diffs each event vs the DB, writes back if changed/stale, and grafts `winnerTeamId` **in memory only** (never persisted).
2. `SELECT` all members of the group.
3. `SELECT` all `user_picks` for the group's WC games.
4. Builds `scoringRows` and calls `SoccerScoringService.buildLeaderboard(...)` (pure) → `[{ userId, name, pictureUrl, rank, tied, points, wins_correct, losses, draws_correct, draws_incorrect }]`.
5. `res.json({ leaderboard })`.

Two scaling problems: (a) 7 ESPN round-trips per viewer, (b) O(members × games) scan+aggregate per viewer, with **no server-side cache**. Two correctness facts that shape the design: `winnerTeamId` for penalty-shootout knockout winners exists **only** in the ESPN payload, not the DB (so DB-only compute needs it persisted — Task 2); and WC picks have **no backend lock** (so editing a pick after kickoff is possible and must invalidate the cache — Task 5).

---

## File Structure

- **Create** `backend/src/services/WorldCupLeaderboardService.js` — pure-ish computation + version + cached orchestration. Takes `pool` as an argument; never owns its own connection.
- **Create** `backend/src/models/WorldCupLeaderboardSnapshot.js` — read/write of the `wc_leaderboard_cache` table.
- **Modify** `backend/src/services/GameService.js` — persist `winner_team_id`; add `getWorldCupGamesFromDB()` and throttled `ensureWorldCupGamesFresh()`.
- **Modify** `backend/src/database/schema.sql` — additive `winner_team_id` column + `wc_leaderboard_cache` table + indexes.
- **Modify** `backend/src/routes/worldCupPicks.js` — route delegates to the service; flag selects live/shadow/cached path.
- **Create tests:** `tests/worldcup-leaderboard-service.test.js`, `tests/worldcup-leaderboard-snapshot.test.js`, `tests/gameservice-wc-persist.test.js`, `tests/gameservice-wc-fresh.test.js`. **Extend** `tests/worldcup-picks-route.test.js` for flag behavior.
- **Create** `docs/superpowers/plans/2026-06-24-world-cup-leaderboard-caching-runbook.md` is unnecessary — the rollout runbook is Task 9 of this document.

---

### Task 1: Extract leaderboard computation into a service (pure refactor, behavior-identical)

Pull the member/pick/scoring glue out of the route into a testable service function that takes the games list as input. The route keeps fetching games exactly as today; only the "given games, build the board" half moves. This is a no-behavior-change refactor that gives every later task a single, tested computation entry point.

**Files:**
- Create: `backend/src/services/WorldCupLeaderboardService.js`
- Create: `backend/tests/worldcup-leaderboard-service.test.js`
- Modify: `backend/src/routes/worldCupPicks.js:162-238`

**Interfaces:**
- Consumes: `SoccerScoringService.buildLeaderboard(rows)` from `backend/src/services/SoccerScoringService.js` (existing, pure).
- Produces:
  - `buildGroupLeaderboard(pool, group, games) => Promise<LeaderboardRow[]>` where `group` is `{ id: number }`, `games` is an array of objects each having at least `{ id, status, homeScore, awayScore, stage, winnerTeamId, homeTeam, awayTeam }`, and `LeaderboardRow` is `{ userId, name, pictureUrl, rank, tied, points, wins_correct, losses, draws_correct, draws_incorrect }` (identical to today's `res.json({ leaderboard })`).

- [ ] **Step 1: Write the failing test**

Create `backend/tests/worldcup-leaderboard-service.test.js`:

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { buildGroupLeaderboard } from '../src/services/WorldCupLeaderboardService.js';

// Minimal fake pool: returns canned rows per call, in order.
function fakePool(resultsInOrder) {
  let i = 0;
  return { query: async () => ({ rows: resultsInOrder[i++] ?? [] }) };
}

describe('buildGroupLeaderboard', () => {
  test('scores members against finalized games and ranks them', async () => {
    const group = { id: 7 };
    const games = [
      { id: 100, status: 'FINAL', homeScore: 2, awayScore: 0, stage: 'group',
        winnerTeamId: 'H', homeTeam: { id: 'H' }, awayTeam: { id: 'A' } },
    ];
    // 1st query => members, 2nd query => picks
    const pool = fakePool([
      [{ id: 1, name: 'Ann', picture_url: null }, { id: 2, name: 'Bob', picture_url: null }],
      [{ user_id: 1, game_id: 100, picked_result: 'home' },
       { user_id: 2, game_id: 100, picked_result: 'away' }],
    ]);

    const board = await buildGroupLeaderboard(pool, group, games);

    assert.equal(board.length, 2);
    assert.equal(board[0].userId, 1);          // Ann picked correctly -> top
    assert.equal(board[0].rank, 1);
    assert.ok(board[0].points > board[1].points);
    assert.equal(board[1].userId, 2);
  });

  test('members with no picks still appear with a zero row', async () => {
    const group = { id: 7 };
    const games = [{ id: 100, status: 'FINAL', homeScore: 1, awayScore: 1, stage: 'group',
      winnerTeamId: null, homeTeam: { id: 'H' }, awayTeam: { id: 'A' } }];
    const pool = fakePool([
      [{ id: 9, name: 'Cy', picture_url: null }],
      [], // no picks
    ]);
    const board = await buildGroupLeaderboard(pool, group, games);
    assert.equal(board.length, 1);
    assert.equal(board[0].userId, 9);
    assert.equal(board[0].points, 0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/worldcup-leaderboard-service.test.js`
Expected: FAIL — `Cannot find module '../src/services/WorldCupLeaderboardService.js'`.

- [ ] **Step 3: Write minimal implementation**

Create `backend/src/services/WorldCupLeaderboardService.js`. Copy the glue verbatim from `worldCupPicks.js:177-231` so output is byte-identical:

```javascript
import { buildLeaderboard } from './SoccerScoringService.js';

/**
 * Given an already-fetched set of World Cup games, build the ranked leaderboard
 * for one group. DB reads (members + picks) happen here; game fetching does NOT —
 * games are passed in so callers control freshness (live ESPN vs DB snapshot).
 * Output shape is identical to the legacy inline route logic.
 */
export async function buildGroupLeaderboard(pool, group, games) {
  const gameById = new Map(games.map(g => [g.id, g]));
  const wcGameIds = [...gameById.keys()];

  const { rows: members } = await pool.query(
    `SELECT u.id, u.name, u.picture_url
       FROM group_memberships gm
       JOIN users u ON u.id = gm.user_id
      WHERE gm.group_id = $1`,
    [group.id]
  );

  let pickRows = [];
  if (wcGameIds.length > 0) {
    const result = await pool.query(
      `SELECT user_id, game_id, picked_result
         FROM user_picks
        WHERE group_id = $1 AND picked_result IS NOT NULL AND game_id = ANY($2::int[])`,
      [group.id, wcGameIds]
    );
    pickRows = result.rows;
  }

  const scoringRows = [];
  const usersWithPicks = new Set();
  for (const pr of pickRows) {
    const game = gameById.get(pr.game_id);
    if (!game) continue;
    scoringRows.push({ userId: pr.user_id, pick: { picked_result: pr.picked_result }, game });
    usersWithPicks.add(pr.user_id);
  }
  for (const m of members) {
    if (!usersWithPicks.has(m.id)) {
      scoringRows.push({ userId: m.id, pick: null, game: null });
    }
  }

  const memberById = new Map(members.map(m => [m.id, m]));
  return buildLeaderboard(scoringRows).map(row => {
    const u = memberById.get(row.userId) || {};
    return {
      userId: row.userId,
      name: u.name ?? null,
      pictureUrl: u.picture_url ?? null,
      rank: row.rank,
      tied: row.tied,
      points: row.points,
      wins_correct: row.wins_correct,
      losses: row.losses,
      draws_correct: row.draws_correct,
      draws_incorrect: row.draws_incorrect,
    };
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/worldcup-leaderboard-service.test.js`
Expected: PASS (2 tests).

- [ ] **Step 5: Refactor the route to call the service (still fetching games inline)**

In `backend/src/routes/worldCupPicks.js`, add the import near the top:

```javascript
import { buildGroupLeaderboard } from '../services/WorldCupLeaderboardService.js';
```

Replace the body of the leaderboard route's `try` block (lines 167–231) so the games fetch stays but the member/pick/scoring block becomes one call:

```javascript
    // Resolved games for every stage (unchanged live behavior).
    const games = [];
    for (const stage of WORLD_CUP_STAGES) {
      const stageGames = await GameService.getWorldCupStage(stage);
      games.push(...stageGames);
    }

    const leaderboard = await buildGroupLeaderboard(pool, group, games);
    res.json({ leaderboard });
```

- [ ] **Step 6: Run the existing route test to verify identical behavior**

Run: `cd backend && node --test tests/worldcup-picks-route.test.js`
Expected: PASS — unchanged from before the refactor.

- [ ] **Step 7: Commit**

```bash
git add backend/src/services/WorldCupLeaderboardService.js \
        backend/tests/worldcup-leaderboard-service.test.js \
        backend/src/routes/worldCupPicks.js
git commit -m "refactor: extract WC leaderboard computation into service (no behavior change)"
```

---

### Task 2: Persist `winner_team_id` on games

Add a nullable column and write the GameService-resolved winner to it during stage ingestion. This is the one piece of scoring state that today lives only in memory; persisting it lets later tasks compute the board from the DB alone. Leaderboard output is unchanged (the live path still grafts in memory; we now *also* persist).

**Files:**
- Modify: `backend/src/database/schema.sql` (additive column block + index)
- Modify: `backend/src/services/GameService.js` (write column inside `getWorldCupStage`)
- Create: `backend/tests/gameservice-wc-persist.test.js`

**Interfaces:**
- Produces: persisted `games.winner_team_id VARCHAR(50) NULL`, written equal to `GameService.resolveWinnerTeamId(game, stage, winnerHomeAway)` whenever a WC game is saved.

- [ ] **Step 1: Add the additive schema block**

In `backend/src/database/schema.sql`, after the existing live-fields block (the `status_detail` block around line 315), append:

```sql
-- World Cup leaderboard caching: persist the resolved knockout/advancing winner so
-- the leaderboard can be scored from the DB without re-fetching ESPN. Nullable; NFL
-- and pre-existing rows stay NULL.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'games' AND column_name = 'winner_team_id'
  ) THEN
    ALTER TABLE games ADD COLUMN winner_team_id VARCHAR(50) NULL;
  END IF;
END $$;

-- Cheap watermark lookup: max change-time among FINAL World Cup games.
CREATE INDEX IF NOT EXISTS idx_games_wc_final
  ON games(league, status, last_updated)
  WHERE league = 'world_cup';
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/gameservice-wc-persist.test.js`:

```javascript
import { test, describe, beforeEach, mock } from 'node:test';
import assert from 'node:assert';
import { GameService } from '../src/services/GameService.js';
import { Game } from '../src/models/Game.js';
import { MockESPNService } from '../src/mocks/MockESPNService.js';

describe('getWorldCupStage persists winner_team_id', () => {
  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();
    mock.restoreAll();
  });

  test('a saved WC game carries winner_team_id equal to resolveWinnerTeamId', async () => {
    mock.method(Game, 'findByESPNId', async () => null); // force the create-and-save branch
    const saved = [];
    mock.method(Game.prototype, 'save', async function save() {
      this.id = this.id || 1;
      saved.push(this);
      return this;
    });

    const games = await GameService.getWorldCupStage('group');
    assert.ok(games.length > 0);
    for (const g of games) {
      // The persisted value must match what the resolver computes for that game.
      assert.equal(g.winnerTeamId ?? null, g.winnerTeamId ?? null); // resolved value present on object
    }
    // Every object handed to save() must have winner_team_id set on it for the INSERT.
    for (const s of saved) {
      assert.ok('winnerTeamId' in s);
    }
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && node --test tests/gameservice-wc-persist.test.js`
Expected: FAIL — `save()` is called before `winnerTeamId` is assigned, so the asserted ordering/`in` check fails (winner is grafted *after* save today).

- [ ] **Step 4: Implement — assign winner before save and include it in the INSERT**

In `backend/src/services/GameService.js` `getWorldCupStage`, move the `resolveWinnerTeamId` call to **before** each `freshGame.save()` and set it on the instance so `save()` can persist it. For the three save branches (new game, force/stale/different), change e.g.:

```javascript
      if (!cachedGame) {
        freshGame.winnerTeamId = GameService.resolveWinnerTeamId(freshGame, stage, winnerHomeAway);
        await freshGame.save();
        games.push(freshGame);
        continue;
      }
      if (forceRefresh || cachedGame.isStale() || freshGame.isDifferentFrom(cachedGame)) {
        freshGame.winnerTeamId = GameService.resolveWinnerTeamId(freshGame, stage, winnerHomeAway);
        await freshGame.save();
        games.push(freshGame);
      } else {
        cachedGame.winnerTeamId = GameService.resolveWinnerTeamId(cachedGame, stage, winnerHomeAway);
        games.push(cachedGame);
      }
```

Then in `backend/src/models/Game.js` `save()` (the `INSERT ... ON CONFLICT` around lines 196–256), add `winner_team_id` to the column list, values, and the `DO UPDATE SET` clause:

```javascript
    // columns: ... , winner_team_id
    // values:  ... , this.winnerTeamId ?? null
    // ON CONFLICT update: winner_team_id = EXCLUDED.winner_team_id
```

(Match the existing parameter-placeholder numbering in that query exactly; add `this.winnerTeamId ?? null` as the new bound parameter.)

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && node --test tests/gameservice-wc-persist.test.js`
Expected: PASS.

- [ ] **Step 6: Verify no regression in existing game tests**

Run: `cd backend && node --test tests/gameservice-worldcup.test.js tests/game-soccer.test.js tests/api-worldcup-route.test.js`
Expected: PASS (all).

- [ ] **Step 7: Commit**

```bash
git add backend/src/database/schema.sql backend/src/services/GameService.js \
        backend/src/models/Game.js backend/tests/gameservice-wc-persist.test.js
git commit -m "feat: persist resolved winner_team_id on World Cup games"
```

---

### Task 3: Read World Cup games from the DB

Add a reader that returns the full WC game slate from Postgres (no ESPN), reconstructing `winnerTeamId` from the persisted column. This is the input source the cached compute path uses on a recompute.

**Files:**
- Modify: `backend/src/services/GameService.js`
- Create: `backend/tests/gameservice-wc-fresh.test.js` (shared with Task 4; create here, extend there)

**Interfaces:**
- Produces: `GameService.getWorldCupGamesFromDB(pool) => Promise<Game[]>` — every Game has `.winnerTeamId` set from the `winner_team_id` column; returns games for `league = 'world_cup'` across all stages.

- [ ] **Step 1: Write the failing test**

Create `backend/tests/gameservice-wc-fresh.test.js`:

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { GameService } from '../src/services/GameService.js';

function fakePool(rows) {
  return { query: async () => ({ rows }) };
}

describe('getWorldCupGamesFromDB', () => {
  test('returns games with winnerTeamId grafted from the column', async () => {
    const pool = fakePool([
      { id: 1, status: 'FINAL', home_score: 2, away_score: 1, stage: 'r16',
        home_team: { id: 'H' }, away_team: { id: 'A' }, winner_team_id: 'H',
        game_date: new Date().toISOString(), espn_id: 'e1', league: 'world_cup' },
    ]);
    const games = await GameService.getWorldCupGamesFromDB(pool);
    assert.equal(games.length, 1);
    assert.equal(games[0].id, 1);
    assert.equal(games[0].winnerTeamId, 'H');
    assert.equal(games[0].status, 'FINAL');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/gameservice-wc-fresh.test.js`
Expected: FAIL — `GameService.getWorldCupGamesFromDB is not a function`.

- [ ] **Step 3: Implement**

In `backend/src/services/GameService.js` add:

```javascript
  /**
   * Read the full World Cup slate straight from Postgres (no ESPN). Reconstructs
   * Game instances and grafts the persisted winner_team_id so the leaderboard can
   * be scored without a live fetch. Used by the cached leaderboard path.
   */
  static async getWorldCupGamesFromDB(pool) {
    const { rows } = await pool.query(
      `SELECT * FROM games WHERE league = 'world_cup'`
    );
    return rows.map(row => {
      const game = Game.fromDatabaseRow(row); // existing mapper (used by findByESPNId)
      game.winnerTeamId = row.winner_team_id ?? null;
      return game;
    });
  }
```

If the existing row→Game mapper has a different name, use that name (grep `fromDatabaseRow`/`fromRow` in `backend/src/models/Game.js`); the test's fake row shape matches the columns that mapper reads.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/gameservice-wc-fresh.test.js`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/GameService.js backend/tests/gameservice-wc-fresh.test.js
git commit -m "feat: add DB-sourced World Cup game reader for cached scoring"
```

---

### Task 4: Throttled, tournament-global game refresh

Wrap the 7-stage ESPN ingest behind a single module-level throttle so it hits ESPN at most once per interval for the **whole** tournament (not once per group per viewer). Returns the current games either way: fresh from ESPN, or DB-read when throttled.

**Files:**
- Modify: `backend/src/services/GameService.js`
- Modify: `backend/tests/gameservice-wc-fresh.test.js`

**Interfaces:**
- Consumes: `GameService.getWorldCupStage(stage)` (Task 2), `GameService.getWorldCupGamesFromDB(pool)` (Task 3).
- Produces: `GameService.ensureWorldCupGamesFresh(pool, { now, intervalMs, force } = {}) => Promise<Game[]>`. Hits ESPN (all 7 stages) only if `force` or `now - lastRefreshAt >= intervalMs` (default `intervalMs` = `Number(process.env.WC_REFRESH_INTERVAL_MS) || 30000`, default `now` = `Date.now()`); otherwise returns `getWorldCupGamesFromDB(pool)` without touching ESPN. Resets/advances an internal `lastRefreshAt` on a real refresh.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/gameservice-wc-fresh.test.js`:

```javascript
import { mock, beforeEach } from 'node:test';
import { MockESPNService } from '../src/mocks/MockESPNService.js';

describe('ensureWorldCupGamesFresh throttling', () => {
  beforeEach(() => {
    process.env.USE_MOCK_ESPN = 'true';
    MockESPNService.configure();
    mock.restoreAll();
    GameService.__resetWcRefreshThrottle(); // test-only reset, added in impl
  });

  test('refreshes on first call, skips ESPN within the interval, refreshes after', async () => {
    let stageCalls = 0;
    mock.method(GameService, 'getWorldCupStage', async () => { stageCalls++; return []; });
    mock.method(GameService, 'getWorldCupGamesFromDB', async () => [{ id: 1 }]);

    const pool = { query: async () => ({ rows: [] }) };
    const opts = { intervalMs: 1000 };

    await GameService.ensureWorldCupGamesFresh(pool, { ...opts, now: 0 });
    const afterFirst = stageCalls;                         // 7 stage fetches
    assert.ok(afterFirst >= 1);

    await GameService.ensureWorldCupGamesFresh(pool, { ...opts, now: 500 });
    assert.equal(stageCalls, afterFirst);                  // throttled: no new ESPN calls

    await GameService.ensureWorldCupGamesFresh(pool, { ...opts, now: 2000 });
    assert.ok(stageCalls > afterFirst);                    // interval elapsed: refreshed
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/gameservice-wc-fresh.test.js`
Expected: FAIL — `ensureWorldCupGamesFresh is not a function`.

- [ ] **Step 3: Implement**

In `backend/src/services/GameService.js`, add a module-scoped throttle variable above the class (or a static field) and the method. Also reference the existing `WORLD_CUP_STAGES`/stage-order constant used elsewhere:

```javascript
let __wcLastRefreshAt = -Infinity;

// inside class GameService:
  static __resetWcRefreshThrottle() { __wcLastRefreshAt = -Infinity; }

  static async ensureWorldCupGamesFresh(pool, { now = Date.now(), intervalMs, force = false } = {}) {
    const interval = intervalMs ?? (Number(process.env.WC_REFRESH_INTERVAL_MS) || 30000);
    if (force || now - __wcLastRefreshAt >= interval) {
      __wcLastRefreshAt = now;
      const games = [];
      for (const stage of GameService.WORLD_CUP_STAGE_ORDER) {     // existing ordered stage list
        const stageGames = await GameService.getWorldCupStage(stage);
        games.push(...stageGames);
      }
      return games;
    }
    return GameService.getWorldCupGamesFromDB(pool);
  }
```

If the canonical stage list is exported from a constants module rather than `GameService.WORLD_CUP_STAGE_ORDER`, import and use that exact name (grep `WORLD_CUP_STAGE` in `backend/src/`).

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/gameservice-wc-fresh.test.js`
Expected: PASS (both describe blocks).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/GameService.js backend/tests/gameservice-wc-fresh.test.js
git commit -m "feat: throttled tournament-global World Cup game refresh"
```

---

### Task 5: The version watermark

Compute a cheap string that changes exactly when the leaderboard could change: a finalized-game watermark **plus** a member-set signal **plus** a picks signal. The picks signal is mandatory — WC picks are not locked server-side (`worldCupPicks.js` POST has no `status === 'SCHEDULED'` guard, unlike NFL `picks.js:309`), so a pick edited after kickoff must bust the cache.

**Files:**
- Modify: `backend/src/services/WorldCupLeaderboardService.js`
- Modify: `backend/tests/worldcup-leaderboard-service.test.js`

**Interfaces:**
- Produces:
  - `buildVersionString({ gameWatermark, memberCount, memberMaxId, picksWatermark }) => string` (pure).
  - `getLeaderboardVersion(pool, group) => Promise<string>` — runs three cheap queries and returns `buildVersionString(...)`.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/worldcup-leaderboard-service.test.js`:

```javascript
import { buildVersionString, getLeaderboardVersion } from '../src/services/WorldCupLeaderboardService.js';

describe('version watermark', () => {
  test('buildVersionString is stable for equal inputs and changes on any field', () => {
    const base = { gameWatermark: '2026-06-20T18:00:00.000Z', memberCount: 3, memberMaxId: 42, picksWatermark: '2026-06-20T17:00:00.000Z' };
    const v0 = buildVersionString(base);
    assert.equal(v0, buildVersionString({ ...base }));                       // stable
    assert.notEqual(v0, buildVersionString({ ...base, memberCount: 4 }));    // member joined
    assert.notEqual(v0, buildVersionString({ ...base, memberMaxId: 43 }));   // member churn
    assert.notEqual(v0, buildVersionString({ ...base, gameWatermark: '2026-06-21T00:00:00.000Z' })); // game finalized
    assert.notEqual(v0, buildVersionString({ ...base, picksWatermark: '2026-06-20T19:00:00.000Z' })); // pick edited
  });

  test('getLeaderboardVersion assembles from three queries', async () => {
    let i = 0;
    const pool = { query: async () => {
      const results = [
        [{ watermark: '2026-06-20T18:00:00.000Z' }],   // games
        [{ cnt: '3', maxid: '42' }],                    // members
        [{ watermark: '2026-06-20T17:00:00.000Z' }],   // picks
      ];
      return { rows: results[i++] };
    }};
    const v = await getLeaderboardVersion(pool, { id: 7 });
    assert.equal(typeof v, 'string');
    assert.ok(v.includes('42'));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/worldcup-leaderboard-service.test.js`
Expected: FAIL — `buildVersionString` / `getLeaderboardVersion` not exported.

- [ ] **Step 3: Implement**

Add to `backend/src/services/WorldCupLeaderboardService.js`:

```javascript
export function buildVersionString({ gameWatermark, memberCount, memberMaxId, picksWatermark }) {
  return [gameWatermark ?? 'none', memberCount ?? 0, memberMaxId ?? 0, picksWatermark ?? 'none'].join('|');
}

export async function getLeaderboardVersion(pool, group) {
  // Finalized-game watermark: the latest change-time among FINAL World Cup games.
  const { rows: gw } = await pool.query(
    `SELECT MAX(last_updated) AS watermark
       FROM games WHERE league = 'world_cup' AND status = 'FINAL'`
  );
  // Member-set signal: count + highest membership id (catches joins AND leaves/rejoins).
  const { rows: mr } = await pool.query(
    `SELECT COUNT(*) AS cnt, MAX(id) AS maxid
       FROM group_memberships WHERE group_id = $1`,
    [group.id]
  );
  // Picks signal: latest pick edit in this group (picks are NOT server-locked).
  const { rows: pw } = await pool.query(
    `SELECT MAX(updated_at) AS watermark
       FROM user_picks WHERE group_id = $1 AND picked_result IS NOT NULL`,
    [group.id]
  );
  return buildVersionString({
    gameWatermark: gw[0]?.watermark ? new Date(gw[0].watermark).toISOString() : null,
    memberCount: Number(mr[0]?.cnt ?? 0),
    memberMaxId: Number(mr[0]?.maxid ?? 0),
    picksWatermark: pw[0]?.watermark ? new Date(pw[0].watermark).toISOString() : null,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/worldcup-leaderboard-service.test.js`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/WorldCupLeaderboardService.js backend/tests/worldcup-leaderboard-service.test.js
git commit -m "feat: World Cup leaderboard version watermark (games + members + picks)"
```

---

### Task 6: Snapshot table + read/write model

Add the `wc_leaderboard_cache` table and a tiny model to read/write a group's stored board keyed by version.

**Files:**
- Modify: `backend/src/database/schema.sql`
- Create: `backend/src/models/WorldCupLeaderboardSnapshot.js`
- Create: `backend/tests/worldcup-leaderboard-snapshot.test.js`

**Interfaces:**
- Produces:
  - `readSnapshot(pool, groupId) => Promise<{ version: string, payload: LeaderboardRow[], computedAt: string } | null>`
  - `writeSnapshot(pool, groupId, version, payload) => Promise<void>`

- [ ] **Step 1: Add the schema block**

In `backend/src/database/schema.sql`, after the games `winner_team_id` block from Task 2, append:

```sql
-- Per-group cached World Cup leaderboard. payload is the full ranked board (JSONB);
-- source_version is the watermark it was computed against (see getLeaderboardVersion).
CREATE TABLE IF NOT EXISTS wc_leaderboard_cache (
  group_id INTEGER PRIMARY KEY REFERENCES groups(id) ON DELETE CASCADE,
  source_version TEXT NOT NULL,
  payload JSONB NOT NULL,
  computed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

- [ ] **Step 2: Write the failing test**

Create `backend/tests/worldcup-leaderboard-snapshot.test.js`:

```javascript
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
```

- [ ] **Step 3: Run test to verify it fails**

Run: `cd backend && node --test tests/worldcup-leaderboard-snapshot.test.js`
Expected: FAIL — module not found.

- [ ] **Step 4: Implement**

Create `backend/src/models/WorldCupLeaderboardSnapshot.js`:

```javascript
export async function readSnapshot(pool, groupId) {
  const { rows } = await pool.query(
    `SELECT source_version, payload, computed_at
       FROM wc_leaderboard_cache WHERE group_id = $1`,
    [groupId]
  );
  if (rows.length === 0) return null;
  const r = rows[0];
  const payload = typeof r.payload === 'string' ? JSON.parse(r.payload) : r.payload;
  return { version: r.source_version, payload, computedAt: r.computed_at };
}

export async function writeSnapshot(pool, groupId, version, payload) {
  await pool.query(
    `INSERT INTO wc_leaderboard_cache (group_id, source_version, payload, computed_at)
     VALUES ($1, $2, $3::jsonb, NOW())
     ON CONFLICT (group_id) DO UPDATE SET
       source_version = EXCLUDED.source_version,
       payload = EXCLUDED.payload,
       computed_at = NOW()`,
    [groupId, version, JSON.stringify(payload)]
  );
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && node --test tests/worldcup-leaderboard-snapshot.test.js`
Expected: PASS (3 tests).

- [ ] **Step 6: Commit**

```bash
git add backend/src/database/schema.sql backend/src/models/WorldCupLeaderboardSnapshot.js \
        backend/tests/worldcup-leaderboard-snapshot.test.js
git commit -m "feat: wc_leaderboard_cache snapshot table + model"
```

---

### Task 7: Cached orchestration with fallback

Tie it together: refresh games (throttled), compute the version, serve the snapshot on a hit, recompute + store on a miss — and on **any** thrown error, fall back to live computation so the endpoint can never error or go stale due to a cache bug.

**Files:**
- Modify: `backend/src/services/WorldCupLeaderboardService.js`
- Modify: `backend/tests/worldcup-leaderboard-service.test.js`

**Interfaces:**
- Consumes: `GameService.ensureWorldCupGamesFresh` (Task 4), `getLeaderboardVersion`/`buildGroupLeaderboard` (Tasks 1, 5), `readSnapshot`/`writeSnapshot` (Task 6).
- Produces:
  - `computeLive(pool, group, gameService) => Promise<LeaderboardRow[]>` — the legacy 7-stage-ESPN compute, used as the fallback and the shadow baseline.
  - `getGroupLeaderboardCached(pool, group, deps?) => Promise<{ leaderboard: LeaderboardRow[], source: 'hit'|'miss'|'fallback' }>` where `deps` allows injecting `{ gameService, readSnapshot, writeSnapshot, getLeaderboardVersion, buildGroupLeaderboard }` for tests.

- [ ] **Step 1: Write the failing test**

Append to `backend/tests/worldcup-leaderboard-service.test.js`:

```javascript
import { getGroupLeaderboardCached } from '../src/services/WorldCupLeaderboardService.js';

describe('getGroupLeaderboardCached', () => {
  const group = { id: 7 };
  const board = [{ userId: 1, rank: 1, points: 5 }];

  function deps(overrides = {}) {
    return {
      gameService: { ensureWorldCupGamesFresh: async () => [{ id: 1 }] },
      getLeaderboardVersion: async () => 'v1',
      buildGroupLeaderboard: async () => board,
      readSnapshot: async () => null,
      writeSnapshot: async () => {},
      ...overrides,
    };
  }

  test('cold miss computes and stores', async () => {
    let wrote = null;
    const d = deps({ writeSnapshot: async (_p, _g, v, p) => { wrote = { v, p }; } });
    const res = await getGroupLeaderboardCached({}, group, d);
    assert.equal(res.source, 'miss');
    assert.deepEqual(res.leaderboard, board);
    assert.equal(wrote.v, 'v1');
  });

  test('warm hit serves snapshot WITHOUT recomputing', async () => {
    let built = 0;
    const d = deps({
      readSnapshot: async () => ({ version: 'v1', payload: board, computedAt: 'x' }),
      buildGroupLeaderboard: async () => { built++; return board; },
    });
    const res = await getGroupLeaderboardCached({}, group, d);
    assert.equal(res.source, 'hit');
    assert.equal(built, 0);                 // the whole point: no O(members*games) work
    assert.deepEqual(res.leaderboard, board);
  });

  test('stale snapshot (version moved) recomputes', async () => {
    const d = deps({ readSnapshot: async () => ({ version: 'OLD', payload: [], computedAt: 'x' }) });
    const res = await getGroupLeaderboardCached({}, group, d);
    assert.equal(res.source, 'miss');
    assert.deepEqual(res.leaderboard, board);
  });

  test('any error falls back to live compute', async () => {
    const d = deps({ getLeaderboardVersion: async () => { throw new Error('boom'); } });
    // computeLive is injected via gameService + buildGroupLeaderboard; force it to return a known board.
    const res = await getGroupLeaderboardCached({}, group, d);
    assert.equal(res.source, 'fallback');
    assert.ok(Array.isArray(res.leaderboard));
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/worldcup-leaderboard-service.test.js`
Expected: FAIL — `getGroupLeaderboardCached` not exported.

- [ ] **Step 3: Implement**

Add to `backend/src/services/WorldCupLeaderboardService.js`:

```javascript
import { GameService } from './GameService.js';
import { readSnapshot as readSnap, writeSnapshot as writeSnap } from '../models/WorldCupLeaderboardSnapshot.js';

/** Legacy compute: fetch all stages live from ESPN and score. Fallback + shadow baseline. */
export async function computeLive(pool, group, gameService = GameService) {
  const games = [];
  for (const stage of gameService.WORLD_CUP_STAGE_ORDER) {
    const stageGames = await gameService.getWorldCupStage(stage);
    games.push(...stageGames);
  }
  return buildGroupLeaderboard(pool, group, games);
}

export async function getGroupLeaderboardCached(pool, group, deps = {}) {
  const {
    gameService = GameService,
    getLeaderboardVersion: getVersion = getLeaderboardVersion,
    buildGroupLeaderboard: build = buildGroupLeaderboard,
    readSnapshot: read = readSnap,
    writeSnapshot: write = writeSnap,
  } = deps;
  try {
    const games = await gameService.ensureWorldCupGamesFresh(pool);
    const version = await getVersion(pool, group);
    const snap = await read(pool, group.id);
    if (snap && snap.version === version) {
      return { leaderboard: snap.payload, source: 'hit' };
    }
    const leaderboard = await build(pool, group, games);
    await write(pool, group.id, version, leaderboard);
    return { leaderboard, source: 'miss' };
  } catch (err) {
    console.error('[wc-leaderboard-cache] falling back to live compute:', err);
    const leaderboard = await computeLive(pool, group, deps.gameService);
    return { leaderboard, source: 'fallback' };
  }
}
```

Note for the "error falls back" test: with `getVersion` throwing, the catch runs `computeLive`, which uses the injected `deps.gameService` (the fake returning `[{id:1}]`) and the module's `buildGroupLeaderboard` against the fake `pool`. To keep that test hermetic, the fake `pool` in that single case should return `{ rows: [] }` for member/pick queries so `buildGroupLeaderboard` yields `[]` — adjust the test's `pool` arg from `{}` to `{ query: async () => ({ rows: [] }) }`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/worldcup-leaderboard-service.test.js`
Expected: PASS (all describe blocks).

- [ ] **Step 5: Commit**

```bash
git add backend/src/services/WorldCupLeaderboardService.js backend/tests/worldcup-leaderboard-service.test.js
git commit -m "feat: cached World Cup leaderboard orchestration with live fallback"
```

---

### Task 8: Wire the flag into the route (off / shadow / on)

Select the path by `WC_LEADERBOARD_CACHE`. `off` is byte-identical to today. `shadow` computes both, **serves live**, and logs any mismatch (the production parity gate). `on` serves the cached path.

**Files:**
- Modify: `backend/src/routes/worldCupPicks.js`
- Modify: `backend/tests/worldcup-picks-route.test.js`

**Interfaces:**
- Consumes: `computeLive`, `getGroupLeaderboardCached` (Task 7), `buildGroupLeaderboard` (Task 1).

- [ ] **Step 1: Write the failing test**

Add a describe block to `backend/tests/worldcup-picks-route.test.js` (follow the file's existing harness for mounting the router and stubbing membership/DB). Assert all three modes return a `leaderboard` array and `shadow` does not throw on a mismatch:

```javascript
describe('leaderboard flag modes', () => {
  for (const mode of ['off', 'shadow', 'on']) {
    test(`WC_LEADERBOARD_CACHE=${mode} returns a leaderboard`, async () => {
      process.env.WC_LEADERBOARD_CACHE = mode;
      const res = await fetch(`${baseURL}/group/test-group/world-cup/leaderboard`, {
        headers: { Authorization: 'Bearer test' },
      });
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.ok(Array.isArray(body.leaderboard));
    });
  }
});
```

(Use whatever auth/membership stubbing the existing tests in this file already set up; mirror them exactly.)

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && node --test tests/worldcup-picks-route.test.js`
Expected: FAIL — `on`/`shadow` behave like `off` today (no flag handling), or the new assertions error because the modes aren't wired.

- [ ] **Step 3: Implement**

In `backend/src/routes/worldCupPicks.js`, import the orchestrators and replace the leaderboard route body:

```javascript
import { buildGroupLeaderboard, computeLive, getGroupLeaderboardCached }
  from '../services/WorldCupLeaderboardService.js';

// inside the route handler, after `const group = await ensureMembership(...)`:
    const mode = process.env.WC_LEADERBOARD_CACHE || 'off';

    if (mode === 'on') {
      const { leaderboard } = await getGroupLeaderboardCached(pool, group);
      return res.json({ leaderboard });
    }

    if (mode === 'shadow') {
      const live = await computeLive(pool, group);
      try {
        const { leaderboard: cached, source } = await getGroupLeaderboardCached(pool, group);
        if (JSON.stringify(cached) !== JSON.stringify(live)) {
          console.warn('[wc-leaderboard-shadow] MISMATCH', {
            groupId: group.id, source,
            liveLen: live.length, cachedLen: cached.length,
          });
        } else {
          console.log('[wc-leaderboard-shadow] match', { groupId: group.id, source, n: live.length });
        }
      } catch (err) {
        console.error('[wc-leaderboard-shadow] cached path threw', err);
      }
      return res.json({ leaderboard: live }); // always serve the trusted live result
    }

    // mode === 'off' (default): unchanged legacy path
    const leaderboard = await computeLive(pool, group);
    return res.json({ leaderboard });
```

(`computeLive` reproduces the exact legacy loop, so `off` is behavior-identical to Task 1's route.)

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && node --test tests/worldcup-picks-route.test.js`
Expected: PASS (all modes).

- [ ] **Step 5: Run the full backend suite**

Run: `cd backend && npm test`
Expected: PASS (no regressions across all `tests/*.test.js`).

- [ ] **Step 6: Commit**

```bash
git add backend/src/routes/worldCupPicks.js backend/tests/worldcup-picks-route.test.js
git commit -m "feat: flag-gated World Cup leaderboard cache (off/shadow/on) with shadow parity logging"
```

---

### Task 9: Production rollout & validation runbook (no code)

This is the deploy gate. Execute it in order; do **not** advance a stage until its check passes. Each stage is independently reversible (the flag is the kill switch).

- [ ] **Step 1: Pre-deploy local full-stack check**

Run the Postgres-backed suite so the new schema blocks + queries exercise real SQL:

```bash
cd backend && npm run test:full
```
Expected: containers come up, `db:init` applies the additive `winner_team_id` column and `wc_leaderboard_cache` table without error, all tests pass, teardown succeeds.

- [ ] **Step 2: Deploy with flag OFF; verify schema landed**

Deploy with `WC_LEADERBOARD_CACHE` unset (or `off`). After boot, confirm the migration ran and changed nothing observable:

```sql
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'games' AND column_name = 'winner_team_id';        -- 1 row
SELECT to_regclass('public.wc_leaderboard_cache');                      -- not null
```
Check: the live leaderboard endpoint returns the same results it did before deploy (spot-check 2–3 real groups). **Gate: identical output.**

- [ ] **Step 3: Confirm `winner_team_id` is populating**

Let the throttled refresh run (or hit any group's leaderboard once). Then:

```sql
SELECT id, stage, status, home_score, away_score, winner_team_id
  FROM games WHERE league = 'world_cup' AND status = 'FINAL'
  ORDER BY last_updated DESC LIMIT 20;
```
Check: finalized games have a non-null `winner_team_id`, and for any **penalty-shootout** knockout result it names the side that actually advanced (cross-check against the bracket). **Gate: winners correct, especially PK games.**

- [ ] **Step 4: Flip to SHADOW; watch parity across a real finalization**

Set `WC_LEADERBOARD_CACHE=shadow` and redeploy. Shadow serves the trusted live board and logs `[wc-leaderboard-shadow] match` / `MISMATCH`. Monitor logs through **at least one real match finalizing** (ideally a knockout/PK game) and across a member-join and a pick-edit if observable.
Check: zero `MISMATCH` lines over a meaningful window (target: a full match day, including ≥1 finalization). Investigate any mismatch before proceeding. **Gate: clean parity in production.**

- [ ] **Step 5: Flip to ON; verify hits and correctness**

Set `WC_LEADERBOARD_CACHE=on` and redeploy. The cached path now serves reads.
Checks:
- Endpoint returns correct standings for spot-checked groups (compare to the bracket and to a known member's rank).
- `SELECT group_id, source_version, computed_at FROM wc_leaderboard_cache ORDER BY computed_at DESC LIMIT 20;` shows rows, and `computed_at` advances **only** around finalizations / pick edits / membership changes — not on every request.
- Observe latency/DB load drop on the leaderboard route.
**Gate: correct results + cache visibly serving hits.**

- [ ] **Step 6: Rollback procedure (keep ready, no deploy needed to trigger)**

If anything looks wrong at any stage: set `WC_LEADERBOARD_CACHE=off` and redeploy (or hot-reload env if supported). This instantly restores the legacy live path; the extra column and table are inert when off. To fully reset cached data: `TRUNCATE wc_leaderboard_cache;` (it repopulates on demand). Document the observed issue before re-attempting.

- [ ] **Step 7: Commit the runbook reference**

```bash
git add docs/superpowers/plans/2026-06-24-world-cup-leaderboard-caching.md
git commit -m "docs: World Cup leaderboard caching rollout runbook"
```

---

## Out of scope (flagged, not built here)

- **WC picks have no server-side lock.** A user can `POST` a pick for an already-kicked-off/final game (`worldCupPicks.js` POST lacks the `status === 'SCHEDULED'` guard that NFL `picks.js:309` has). This plan's version watermark *tolerates* that (a late edit busts the cache and recomputes correctly), but the underlying integrity hole — changing a pick after seeing the result — is a separate bug worth its own fix. Do **not** fold a pick-lock change into this work; it alters user-facing behavior mid-tournament and needs its own validation.
- **Pagination + sticky "my rank" row.** Caching makes reads O(1) and turns the board into a stored JSONB payload, which is the right substrate for paginating and serving a `me` row — but that's a follow-on frontend+endpoint change, not part of this backend caching work.
- **NFL scoreboard** (`picks.js:440-502`) has the identical "fetch-all, aggregate-in-JS, return-everything" shape and could reuse this exact pattern later. Not touched here.

## Self-Review notes

- **Spec coverage:** lazy/result-based invalidation (Tasks 5+7), decoupled throttled ingestion (Task 4), DB-only compute requiring persisted winner (Tasks 2–3), snapshot store (Task 6), and "validation at every turn" (flag gating in Task 8 + the staged runbook in Task 9). All covered.
- **Type consistency:** `LeaderboardRow` shape is fixed in Task 1 and reused unchanged through Tasks 7–8; `getGroupLeaderboardCached` returns `{ leaderboard, source }` consistently; `ensureWorldCupGamesFresh(pool, opts)` and `getLeaderboardVersion(pool, group)` signatures match every call site.
- **Verify-before-build assumptions baked in:** Task 3 Step 3 and Task 4 Step 3 each say to grep for the real existing symbol name (`fromDatabaseRow`, `WORLD_CUP_STAGE_ORDER`) rather than assume it — the only two spots where the plan depends on an existing identifier whose exact name should be confirmed at implementation time.
```
