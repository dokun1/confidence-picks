import crypto from 'crypto';
import pool from '../config/database.js';

// Scopes an MCP token may hold. Deliberately excludes every destructive
// operation -- no group delete, no leave, no admin override of another member's
// picks. An agent bug or prompt injection can cost a bad pick, never a destroyed
// pool.
//
// `dues:write` is the one scope that reaches money-handling settings (the
// payment handle, the collector, who is marked paid). It is opt-in when minting
// -- never part of the default set -- and it only answers "may this token touch
// dues at all": the dues routes still require the token's owner to be an ADMIN
// of the group in question.
export const MCP_SCOPES = ['groups:read', 'picks:read', 'picks:write', 'dues:write'];

const TOKEN_PREFIX = 'cp_live_';
const DEFAULT_EXPIRY_DAYS = 90;

export class McpToken {
  // Latched like Group._duesSchemaEnsured: production runs with INIT_DB unset,
  // so schema.sql never syncs on deploy and this table would not otherwise
  // exist. First call after a deploy creates it; every later call is a
  // zero-query no-op.
  static _schemaEnsured = false;

  static async ensureSchema() {
    if (this._schemaEnsured) return; // warm-instance fast path: no query
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS mcp_tokens (
          id SERIAL PRIMARY KEY,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          name VARCHAR(64) NOT NULL,
          token_hash CHAR(64) NOT NULL UNIQUE,
          scopes TEXT[] NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          last_used_at TIMESTAMPTZ NULL,
          expires_at TIMESTAMPTZ NULL,
          revoked_at TIMESTAMPTZ NULL
        )
      `);
      // Lookup is by hash on every authenticated MCP call, so it must be indexed.
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_mcp_tokens_hash ON mcp_tokens(token_hash)`
      );
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_mcp_tokens_user ON mcp_tokens(user_id)`
      );
      // Latch only after a confirmed create, so the next call takes the fast path.
      this._schemaEnsured = true;
    } catch (e) {
      // Do NOT latch on failure -- a transient error must let the next call retry.
      console.error('[mcp] ensureSchema failed', e.message);
      throw e;
    }
  }

  // SHA-256 is the right primitive here rather than bcrypt/argon2: the token is
  // 32 bytes of CSPRNG output, not a human-chosen password, so there is no
  // dictionary to slow down and per-request hashing stays cheap.
  static hash(plaintext) {
    return crypto.createHash('sha256').update(plaintext).digest('hex');
  }

  static generatePlaintext() {
    return TOKEN_PREFIX + crypto.randomBytes(32).toString('base64url');
  }

  static isWellFormed(value) {
    return typeof value === 'string' && value.startsWith(TOKEN_PREFIX) && value.length > TOKEN_PREFIX.length + 20;
  }

  static validateScopes(scopes) {
    if (!Array.isArray(scopes) || scopes.length === 0) return null;
    const unique = [...new Set(scopes)];
    if (unique.some((s) => !MCP_SCOPES.includes(s))) return null;
    return unique;
  }

  // Returns { plaintext, token }. plaintext is shown to the user exactly once
  // and never persisted -- only its hash is stored.
  static async create({ userId, name, scopes, expiresInDays = DEFAULT_EXPIRY_DAYS }) {
    await this.ensureSchema();
    const plaintext = this.generatePlaintext();
    const tokenHash = this.hash(plaintext);
    const days = Number.isFinite(expiresInDays) && expiresInDays > 0 ? Math.min(expiresInDays, 365) : DEFAULT_EXPIRY_DAYS;
    const { rows } = await pool.query(
      `INSERT INTO mcp_tokens (user_id, name, token_hash, scopes, expires_at)
       VALUES ($1, $2, $3, $4, NOW() + ($5 || ' days')::interval)
       RETURNING id, name, scopes, created_at, last_used_at, expires_at, revoked_at`,
      [userId, name, tokenHash, scopes, String(days)]
    );
    return { plaintext, token: this._row(rows[0]) };
  }

  // Resolves a bearer credential to its owner. Returns null for unknown,
  // revoked, or expired tokens -- callers must fail closed on null, never fall
  // through to anonymous access.
  static async findByPlaintext(plaintext) {
    if (!this.isWellFormed(plaintext)) return null;
    await this.ensureSchema();
    // Revocation and expiry are evaluated BY POSTGRES, not in JS. The pg driver
    // parses `timestamp without time zone` as local time, so comparing such a
    // value against Date.now() silently shifts the deadline by the server's UTC
    // offset -- on a UTC-5 host an expired token stayed valid for five more
    // hours. Letting the database compare its own clock removes that entirely,
    // and holds even if this table predates the timestamptz columns above.
    const { rows } = await pool.query(
      `SELECT id, user_id, name, scopes, created_at, last_used_at, expires_at, revoked_at,
              (revoked_at IS NOT NULL) AS is_revoked,
              (expires_at IS NOT NULL AND expires_at <= NOW()) AS is_expired
       FROM mcp_tokens WHERE token_hash = $1`,
      [this.hash(plaintext)]
    );
    if (rows.length === 0) return null;
    const row = rows[0];
    if (row.is_revoked || row.is_expired) return null;
    return { ...this._row(row), userId: row.user_id };
  }

  static async listForUser(userId) {
    await this.ensureSchema();
    const { rows } = await pool.query(
      `SELECT id, name, scopes, created_at, last_used_at, expires_at, revoked_at
       FROM mcp_tokens WHERE user_id = $1 AND revoked_at IS NULL
       ORDER BY created_at DESC`,
      [userId]
    );
    return rows.map((r) => this._row(r));
  }

  // Scoped by user_id as well as id so one user can never revoke another's token.
  static async revoke(id, userId) {
    await this.ensureSchema();
    const { rows } = await pool.query(
      `UPDATE mcp_tokens SET revoked_at = NOW()
       WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
       RETURNING id`,
      [id, userId]
    );
    return rows.length > 0;
  }

  // Best-effort telemetry so a user can spot a token they forgot about. Never
  // allowed to fail a request.
  static async touch(id) {
    try {
      await pool.query(`UPDATE mcp_tokens SET last_used_at = NOW() WHERE id = $1`, [id]);
    } catch (e) {
      console.warn('[mcp] touch failed', e.message);
    }
  }

  static _row(r) {
    return {
      id: r.id,
      name: r.name,
      scopes: r.scopes,
      createdAt: r.created_at,
      lastUsedAt: r.last_used_at,
      expiresAt: r.expires_at,
      revokedAt: r.revoked_at
    };
  }
}

export default McpToken;
