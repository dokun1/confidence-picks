import { AuthService } from '../services/AuthService.js';
import { User } from '../models/User.js';
import { McpToken } from '../models/McpToken.js';

// Edge guard that lets an MCP personal access token stand in for a web session
// WITHOUT touching authenticateToken.
//
// The trick is a token exchange at the boundary: when the caller presents a
// `cp_live_` bearer we validate it, check the route against a deny-by-default
// scope policy, then rewrite the Authorization header to a freshly minted,
// short-lived access JWT for that user. Every downstream route -- and
// authenticateToken itself -- runs completely unmodified and cannot tell the
// difference. A defect in this file therefore cannot weaken web session auth:
// requests without a cp_live_ bearer take an early `return next()` and never
// enter any of this logic.

const MCP_PREFIX = 'cp_live_';

// Deny by default. A route reaches the real API only if it matches an entry
// here, so newly added endpoints are unreachable by MCP tokens until someone
// deliberately lists them. This is what keeps DELETE /api/groups/:id,
// POST /leave, POST /join, chat, and admin pick-override off limits no matter
// what an agent is talked into trying.
//
// Dues are reachable, but narrowly: only the two routes below, only with the
// opt-in dues:write scope. Note what is NOT here -- PUT /groups/:id, the general
// settings route, which also renames a group and flips is_public. Dues settings
// have their own route (PUT /groups/:id/dues) so that one never needs listing.
export const MCP_ROUTE_POLICY = [
  { method: 'GET', pattern: /^\/groups\/my-groups\/?$/, scope: 'groups:read' },
  { method: 'GET', pattern: /^\/groups\/[^/]+\/members\/?$/, scope: 'groups:read' },
  { method: 'GET', pattern: /^\/groups\/[^/]+\/scoreboard\/?$/, scope: 'groups:read' },
  { method: 'GET', pattern: /^\/groups\/[^/]+\/picks\/me\/?$/, scope: 'picks:read' },
  { method: 'GET', pattern: /^\/groups\/[^/]+\/picks\/seasons\/?$/, scope: 'picks:read' },
  { method: 'GET', pattern: /^\/groups\/[^/]+\/picks\/closest\/?$/, scope: 'picks:read' },
  { method: 'GET', pattern: /^\/groups\/[^/]+\/picks\/?$/, scope: 'picks:read' },
  { method: 'POST', pattern: /^\/groups\/[^/]+\/picks\/?$/, scope: 'picks:write' },
  { method: 'POST', pattern: /^\/groups\/[^/]+\/picks\/clear\/?$/, scope: 'picks:write' },
  { method: 'PUT', pattern: /^\/groups\/[^/]+\/dues\/?$/, scope: 'dues:write' },
  { method: 'POST', pattern: /^\/groups\/[^/]+\/members\/[^/]+\/dues\/?$/, scope: 'dues:write' },
  { method: 'GET', pattern: /^\/games\/.+/, scope: null }, // slate is public anyway
  // Group detail last: its pattern is the broadest, so the specific
  // /groups/:id/... routes above must be tested first.
  { method: 'GET', pattern: /^\/groups\/[^/]+\/?$/, scope: 'groups:read' }
];

export function matchPolicy(method, path) {
  return MCP_ROUTE_POLICY.find((r) => r.method === method && r.pattern.test(path)) || null;
}

// Per-token fixed-window limiter. In-process, so a serverless cold start resets
// it -- acceptable, because the goal is bounding a runaway agent loop rather
// than enforcing a precise quota.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 120;
const buckets = new Map();

export function checkRateLimit(tokenId, now = Date.now()) {
  const b = buckets.get(tokenId);
  if (!b || now - b.start >= WINDOW_MS) {
    buckets.set(tokenId, { start: now, count: 1 });
    return { allowed: true, remaining: MAX_PER_WINDOW - 1 };
  }
  b.count += 1;
  if (b.count > MAX_PER_WINDOW) {
    return { allowed: false, retryAfter: Math.ceil((b.start + WINDOW_MS - now) / 1000) };
  }
  return { allowed: true, remaining: MAX_PER_WINDOW - b.count };
}

export function _resetRateLimit() { buckets.clear(); }

export const mcpTokenExchange = async (req, res, next) => {
  const header = req.headers['authorization'];
  const raw = header && header.split(' ')[1];

  // Not an MCP credential -> this middleware is a no-op and existing behaviour
  // is bit-for-bit unchanged.
  if (!raw || !raw.startsWith(MCP_PREFIX)) return next();

  try {
    const token = await McpToken.findByPlaintext(raw);
    // Unknown, revoked, or expired: fail closed. Never fall through to
    // anonymous access or to authenticateToken.
    if (!token) {
      return res.status(401).json({ error: 'Invalid or revoked MCP token' });
    }

    const limit = checkRateLimit(token.id);
    if (!limit.allowed) {
      res.set('Retry-After', String(limit.retryAfter));
      return res.status(429).json({ error: 'Rate limit exceeded for this token', retryAfter: limit.retryAfter });
    }

    const rule = matchPolicy(req.method, req.path);
    if (!rule) {
      return res.status(403).json({
        error: 'This endpoint is not available to MCP tokens',
        method: req.method,
        path: req.path
      });
    }
    if (rule.scope && !token.scopes.includes(rule.scope)) {
      return res.status(403).json({
        error: 'Missing required scope',
        required: rule.scope,
        granted: token.scopes
      });
    }

    const user = await User.findById(token.userId);
    if (!user) return res.status(401).json({ error: 'User not found' });

    // Exchange: hand downstream a normal access JWT. authenticateToken then
    // behaves exactly as it does for a browser session.
    req.headers['authorization'] = `Bearer ${AuthService.generateAccessToken(user)}`;
    req.mcpToken = { id: token.id, scopes: token.scopes };
    McpToken.touch(token.id); // fire-and-forget telemetry
    return next();
  } catch (e) {
    console.error('[mcp] token exchange failed', e.message);
    return res.status(500).json({ error: 'MCP authentication failed' });
  }
};

export default mcpTokenExchange;
