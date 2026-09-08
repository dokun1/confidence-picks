import crypto from 'crypto';
import pool from '../config/database.js';

// Dynamically registered OAuth clients (RFC 7591).
//
// The MCP spec ranks DCR last among registration mechanisms, but Claude Code
// requires it: it reads the authorization server metadata, looks for
// registration_endpoint, and refuses to proceed without one -- even when a
// client_id is pre-configured (anthropics/claude-code#67258). So this exists
// because the client demands it, not because the spec prefers it.

const REDIRECT_MAX = 10;

export class OAuthClient {
  static _schemaEnsured = false;

  static async ensureSchema() {
    if (this._schemaEnsured) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS oauth_clients (
          id SERIAL PRIMARY KEY,
          client_id VARCHAR(64) NOT NULL UNIQUE,
          client_name VARCHAR(255) NOT NULL,
          redirect_uris TEXT[] NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `);
      await pool.query(
        `CREATE INDEX IF NOT EXISTS idx_oauth_clients_client_id ON oauth_clients(client_id)`
      );
      this._schemaEnsured = true;
    } catch (e) {
      console.error('[oauth] client ensureSchema failed', e.message);
      throw e;
    }
  }

  // Only loopback and HTTPS are acceptable. A CLI completing the flow binds a
  // local port, so http://127.0.0.1:PORT/... is the normal case; anything else
  // over plain http would leak the code in transit.
  static isAllowedRedirect(uri) {
    let u;
    try { u = new URL(uri); } catch { return false; }
    if (u.hash) return false; // a fragment cannot be matched exactly
    if (u.protocol === 'https:') return true;
    if (u.protocol === 'http:') return u.hostname === 'localhost' || u.hostname === '127.0.0.1' || u.hostname === '[::1]';
    return false;
  }

  static validateRedirectUris(uris) {
    if (!Array.isArray(uris) || uris.length === 0 || uris.length > REDIRECT_MAX) return null;
    if (!uris.every((u) => typeof u === 'string' && this.isAllowedRedirect(u))) return null;
    return [...new Set(uris)];
  }

  static async register({ clientName, redirectUris }) {
    await this.ensureSchema();
    const clientId = `cpc_${crypto.randomBytes(16).toString('hex')}`;
    const name = (typeof clientName === 'string' && clientName.trim()) ? clientName.trim().slice(0, 255) : 'MCP Client';
    const { rows } = await pool.query(
      `INSERT INTO oauth_clients (client_id, client_name, redirect_uris)
       VALUES ($1, $2, $3)
       RETURNING client_id, client_name, redirect_uris, created_at`,
      [clientId, name, redirectUris]
    );
    return this._row(rows[0]);
  }

  static async findByClientId(clientId) {
    if (!clientId || typeof clientId !== 'string') return null;
    await this.ensureSchema();
    const { rows } = await pool.query(
      `SELECT client_id, client_name, redirect_uris, created_at FROM oauth_clients WHERE client_id = $1`,
      [clientId]
    );
    return rows.length ? this._row(rows[0]) : null;
  }

  // Exact match, per OAuth 2.1: no prefix or wildcard matching, which is what
  // makes open-redirect attacks possible.
  static redirectAllowed(client, redirectUri) {
    return !!client && Array.isArray(client.redirectUris) && client.redirectUris.includes(redirectUri);
  }

  static _row(r) {
    return {
      clientId: r.client_id,
      clientName: r.client_name,
      redirectUris: r.redirect_uris,
      createdAt: r.created_at
    };
  }
}

export default OAuthClient;
