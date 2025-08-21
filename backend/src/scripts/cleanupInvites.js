#!/usr/bin/env node
/**
 * Prune expired / exhausted / revoked group invites.
 *
 * Retention strategy:
 *  - Delete invites whose expires_at < now minus INVITE_RETENTION_DAYS (grace window)
 *  - Also delete any invite already expired AND (max_uses reached OR revoked)
 *
 * Environment variables:
 *  INVITE_RETENTION_DAYS (default: 0)  -> days AFTER expiration to keep for audit.
 *  DRY_RUN=true                         -> log what would be deleted, but don't delete.
 *
 * Exit codes: 0 success, 1 failure.
 */
import '../config/database.js'; // loads env + pool listeners
import pool from '../config/database.js';

async function main() {
  const retentionDays = parseInt(process.env.INVITE_RETENTION_DAYS || '0', 10);
  const dryRun = /^true$/i.test(process.env.DRY_RUN || '');

  const now = new Date();
  const retentionCutoff = new Date(now.getTime() - retentionDays * 24 * 60 * 60 * 1000);

  const params = [retentionCutoff];
  // We use CTE to collect candidates for reporting.
  const sql = `WITH candidates AS (
    SELECT id, token, expires_at, max_uses, uses, revoked_at
    FROM group_invitations
    WHERE (
      expires_at < $1  -- beyond retention window (expires_at < cutoff => expires_at + retentionDays < now)
    )
    OR (
      expires_at < NOW() AND (
         (max_uses IS NOT NULL AND uses >= max_uses) OR revoked_at IS NOT NULL
      )
    )
  )
  ${dryRun ? 'SELECT * FROM candidates' : 'DELETE FROM group_invitations WHERE id IN (SELECT id FROM candidates) RETURNING *'};`;

  const start = Date.now();
  const res = await pool.query(sql, params);
  const ms = Date.now() - start;

  if (dryRun) {
    console.log(`[DRY RUN] Would delete ${res.rows.length} invitations`);
  } else {
    console.log(`Deleted ${res.rows.length} invitations in ${ms}ms`);
  }

  // Optionally vacuum (skipped here to avoid requiring elevated perms)
}

main().then(()=> pool.end()).catch(err => { console.error('Cleanup failed', err); pool.end(()=> process.exit(1)); });
