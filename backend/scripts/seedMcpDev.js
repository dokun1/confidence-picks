#!/usr/bin/env node
/**
 * Seeds the minimum a local end-to-end MCP run needs: a user, a group they
 * belong to, a week of games, and a freshly minted token.
 *
 * Intended for a local backend pointed at the DEV database. It refuses to run
 * against production, and every row it creates is prefixed `mcp-seed-` so it can
 * be identified and removed.
 *
 *   node scripts/seedMcpDev.js          # create and print a token
 *   node scripts/seedMcpDev.js --clean  # remove everything it created
 */
import pool from '../src/config/database.js';
import { McpToken } from '../src/models/McpToken.js';

const SEED_EMAIL = 'mcp-seed@local.test';
const SEED_GROUP = 'mcp-seed-group';

function assertNotProduction() {
  const current = process.env.DATABASE_URL || '';
  const prod = process.env.PROD_DATABASE_URL || '';
  const host = (u) => (u.match(/@([^/]+)/) || [])[1] || '';
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Refusing to seed: NODE_ENV=production');
  }
  if (prod && host(current) && host(current) === host(prod)) {
    throw new Error(`Refusing to seed: DATABASE_URL points at the production host (${host(prod)})`);
  }
}

async function clean() {
  const { rows } = await pool.query('SELECT id FROM users WHERE email=$1', [SEED_EMAIL]);
  if (rows.length) {
    // Memberships, picks and tokens all cascade from these two deletes.
    await pool.query('DELETE FROM groups WHERE identifier=$1', [SEED_GROUP]);
    await pool.query('DELETE FROM users WHERE id=$1', [rows[0].id]);
  }
  await pool.query(`DELETE FROM games WHERE espn_id LIKE 'mcp-seed-%'`);
  console.log('Removed seed user, group and games.');
}

async function seed() {
  const { rows: u } = await pool.query(
    `INSERT INTO users (email, name, provider, google_id)
     VALUES ($1, 'MCP Seed User', 'google', 'mcp-seed-google-id')
     ON CONFLICT (email) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [SEED_EMAIL]
  );
  const userId = u[0].id;

  const { rows: g } = await pool.query(
    `INSERT INTO groups (name, identifier, description, is_public, pool_type, created_by)
     VALUES ('MCP Seed Group', $1, 'Scratch group for MCP end-to-end runs', false, 'nfl_weekly', $2)
     ON CONFLICT (identifier) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [SEED_GROUP, userId]
  );
  const groupId = g[0].id;

  await pool.query(
    `INSERT INTO group_memberships (group_id, user_id, role) VALUES ($1, $2, 'admin')
     ON CONFLICT (group_id, user_id) DO NOTHING`,
    [groupId, userId]
  );

  // Reuse the real slate if this database already has one; only fabricate games
  // when it does not, so a dev database with real data stays representative.
  const { rows: existing } = await pool.query(
    `SELECT COUNT(*)::int AS n FROM games WHERE season=2026 AND season_type=2 AND week=1 AND league='nfl'`
  );
  if (existing[0].n === 0) {
    const fixtures = [
      ['mcp-seed-1', 'SEA', 'NE'],
      ['mcp-seed-2', 'LAR', 'SF'],
      ['mcp-seed-3', 'PHI', 'WSH']
    ];
    for (const [espnId, home, away] of fixtures) {
      await pool.query(
        `INSERT INTO games (espn_id, home_team, away_team, game_date, status, week, season, season_type, league)
         VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', 'SCHEDULED', 1, 2026, 2, 'nfl')
         ON CONFLICT (espn_id) DO NOTHING`,
        [espnId,
         JSON.stringify({ id: `${espnId}-h`, abbreviation: home, displayName: home }),
         JSON.stringify({ id: `${espnId}-a`, abbreviation: away, displayName: away })]
      );
    }
    console.log(`Inserted ${fixtures.length} placeholder games for 2026 week 1.`);
  } else {
    console.log(`Reusing ${existing[0].n} existing games for 2026 week 1.`);
  }

  const { plaintext } = await McpToken.create({
    userId,
    name: 'local end-to-end',
    scopes: ['groups:read', 'picks:read', 'picks:write'],
    expiresInDays: 1
  });

  console.log('\nSeed ready.');
  console.log(`  user      ${SEED_EMAIL} (id ${userId})`);
  console.log(`  group     ${SEED_GROUP} (id ${groupId})`);
  console.log(`\n  CONFIDENCE_PICKS_TOKEN=${plaintext}\n`);
}

try {
  assertNotProduction();
  if (process.argv.includes('--clean')) await clean();
  else await seed();
} finally {
  await pool.end();
}
