import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { McpToken, MCP_SCOPES } from '../models/McpToken.js';

const router = express.Router();

// Token management is deliberately a WEB-SESSION-ONLY surface: these routes are
// absent from MCP_ROUTE_POLICY, so the deny-by-default guard blocks a cp_live_
// token from reaching them. An MCP token therefore cannot mint another token,
// widen its own scopes, or revoke a sibling -- you must be in a real browser
// session to manage credentials.

router.get('/scopes', (req, res) => {
  res.json({ scopes: MCP_SCOPES });
});

router.get('/tokens', authenticateToken, async (req, res) => {
  try {
    const tokens = await McpToken.listForUser(req.user.id);
    res.json({ tokens });
  } catch (e) {
    console.error('[mcp] list tokens failed', e);
    res.status(500).json({ error: 'Failed to load tokens' });
  }
});

router.post('/tokens', authenticateToken, async (req, res) => {
  try {
    const { name, scopes, expiresInDays } = req.body || {};
    const trimmed = typeof name === 'string' ? name.trim() : '';
    if (!trimmed || trimmed.length > 64) {
      return res.status(400).json({ error: 'Name is required (1-64 characters)' });
    }
    const validScopes = McpToken.validateScopes(scopes);
    if (!validScopes) {
      return res.status(400).json({ error: 'Invalid scopes', allowed: MCP_SCOPES });
    }
    const { plaintext, token } = await McpToken.create({
      userId: req.user.id,
      name: trimmed,
      scopes: validScopes,
      expiresInDays
    });
    // The only time the plaintext is ever returned. It is not recoverable.
    res.status(201).json({ token, plaintext });
  } catch (e) {
    console.error('[mcp] create token failed', e);
    res.status(500).json({ error: 'Failed to create token' });
  }
});

router.delete('/tokens/:id', authenticateToken, async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid token id' });
    const revoked = await McpToken.revoke(id, req.user.id);
    if (!revoked) return res.status(404).json({ error: 'Token not found' });
    res.json({ revoked: true });
  } catch (e) {
    console.error('[mcp] revoke token failed', e);
    res.status(500).json({ error: 'Failed to revoke token' });
  }
});

export default router;
