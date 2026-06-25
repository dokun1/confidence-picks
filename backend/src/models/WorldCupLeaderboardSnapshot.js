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
