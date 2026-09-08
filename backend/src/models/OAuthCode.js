import crypto from 'crypto';
import pool from '../config/database.js';

// Authorization codes for the OAuth 2.1 code flow.
//
// Codes are hashed at rest, single-use, short-lived, and bound to the exact
// client_id, redirect_uri and resource they were issued for. PKCE S256 is
// mandatory -- an authorization request without a challenge is rejected outright
// rather than downgraded, since a public CLI client has no secret to fall back on.

const CODE_TTL_SECONDS = 120;

export class OAuthCode {
  static _schemaEnsured = false;

  static async ensureSchema() {
    if (this._schemaEnsured) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS oauth_auth_codes (
          id SERIAL PRIMARY KEY,
          code_hash CHAR(64) NOT NULL UNIQUE,
          client_id VARCHAR(64) NOT NULL,
          user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          redirect_uri TEXT NOT NULL,
          code_challenge VARCHAR(128) NOT NULL,
          code_challenge_method VARCHAR(10) NOT NULL,
          scope TEXT[] NOT NULL,
          resource TEXT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(`CREATE INDEX IF NOT EXISTS idx_oauth_codes_hash ON oauth_auth_codes(code_hash)`);
      this._schemaEnsured = true;
    } catch (e) {
      console.error('[oauth] code ensureSchema failed', e.message);
      throw e;
    }
  }

  static hash(value) {
    return crypto.createHash('sha256').update(value).digest('hex');
  }

  // S256 only. `plain` is permitted by PKCE but forbidden by OAuth 2.1 for
  // clients capable of S256, and every MCP client is.
  static verifyChallenge({ codeChallenge, codeChallengeMethod, codeVerifier }) {
    if (codeChallengeMethod !== 'S256') return false;
    if (typeof codeVerifier !== 'string' || codeVerifier.length < 43 || codeVerifier.length > 128) return false;
    const computed = crypto.createHash('sha256').update(codeVerifier).digest('base64url');
    // Constant-time compare so a mismatch cannot be probed by timing.
    const a = Buffer.from(computed);
    const b = Buffer.from(String(codeChallenge));
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }

  static async issue({ clientId, userId, redirectUri, codeChallenge, codeChallengeMethod, scope, resource }) {
    await this.ensureSchema();
    const code = crypto.randomBytes(32).toString('base64url');
    await pool.query(
      `INSERT INTO oauth_auth_codes
         (code_hash, client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource, expires_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8, NOW() + ($9 || ' seconds')::interval)`,
      [this.hash(code), clientId, userId, redirectUri, codeChallenge, codeChallengeMethod, scope, resource || null, String(CODE_TTL_SECONDS)]
    );
    return code;
  }

  // Redeeming marks the code used in the same statement that reads it, so a
  // replayed code cannot be exchanged twice even under concurrent requests.
  // Expiry is evaluated by Postgres, never by comparing timestamps in JS.
  static async redeem(code) {
    if (!code || typeof code !== 'string') return null;
    await this.ensureSchema();
    const { rows } = await pool.query(
      `UPDATE oauth_auth_codes SET used_at = NOW()
       WHERE code_hash = $1 AND used_at IS NULL AND expires_at > NOW()
       RETURNING client_id, user_id, redirect_uri, code_challenge, code_challenge_method, scope, resource`,
      [this.hash(code)]
    );
    if (rows.length === 0) return null;
    const r = rows[0];
    return {
      clientId: r.client_id,
      userId: r.user_id,
      redirectUri: r.redirect_uri,
      codeChallenge: r.code_challenge,
      codeChallengeMethod: r.code_challenge_method,
      scope: r.scope,
      resource: r.resource
    };
  }
}

export default OAuthCode;
