# MCP auth for confidence-picks — design

Date: 2026-09-08
Status: approved for phase 1 implementation

## Problem

Confidence-picks has a complete REST API, but the only way to obtain a
credential is the Google/Apple OAuth browser flow, which mints a 15-minute
access token into `localStorage`. There is no headless path, so an MCP
server — or any agent — cannot hold an identity.

The goal is for any account holder to connect Claude Code or Codex to their
own confidence-picks identity and manage picks without a browser.

## Decisions

| Question | Decision |
|---|---|
| Audience | Any account holder. First-party MCP resource, **not** a third-party app platform. |
| Blast radius | `groups:read`, `picks:read`, `picks:write`. No delete, leave, dues, or admin-override. |
| Auth server | Free, self-hosted. No managed IdP, no new recurring cost. |
| Strategy | Staged. Phase 1 = scoped personal access tokens. Phase 2 = OAuth 2.1 AS on the same token substrate. |
| Phase-1 transport | stdio, not remote HTTP. |
| Integration point | Existing `frontend/src/pages/ProfilePage.tsx`. |
| Test data | Seed script. Production data stays off the laptop. |

### Why staged

The OAuth authorization server is roughly 30% of the work. The MCP tool
layer, scope enforcement, token→identity mapping, `submit_week`
read-modify-write logic, and revocation UI are the other 70%, and they are
identical whether the token arrives from a paste or from `/authorize`. Only
the minting step differs. Building the risky, security-critical half second —
against a system already proven to work — is materially safer.

Deferring also lets the DCR-vs-Client-ID-Metadata-Documents question settle;
RFC 7591 dynamic client registration now carries a deprecation warning.

### Why stdio first

Claude Code supports `--header "Authorization: Bearer …"` on HTTP transport,
but open bug anthropics/claude-code#50464 reports the configured header not
being attached on tool calls — it connects, then fails. stdio sidesteps it
entirely, needs no hosting, and avoids the Vercel-serverless session
question. Both clients support stdio in one line.

## Architecture

Three pieces, deliberately separated:

1. **Core tool layer** (`mcp/src/core.js`) — plain JS ESM, matching the
   backend. Owns the API contract and the read-modify-write logic. Takes an
   already-authenticated HTTP client, so it has no MCP imports and needs no
   network in tests. (Chosen over TypeScript to avoid adding a build step: the
   package runs straight from source, which also keeps the L4 command a plain
   `node mcp/src/stdio.js` with no `dist/`.)
2. **Transport adapter** (`mcp/src/stdio.js`) — thin wrapper. Phase 2 adds an
   HTTP sibling against the same core.
3. **Auth substrate** (backend) — `mcp_tokens` table, `authenticateMcpToken`
   middleware, token CRUD routes, minting UI on ProfilePage.

`authenticateToken` is **not modified**. MCP tokens travel a parallel path so
a defect in the new code cannot weaken web session auth.

## Token model

- Format `cp_live_<43 char base64url>` (32 random bytes).
- Stored as SHA-256 hash only. Plaintext shown once at mint, never retrievable.
- Default expiry 90 days, re-mintable, revocable.
- Bearer credential: `Authorization: Bearer cp_live_…`.

```
mcp_tokens(
  id, user_id, name, token_hash UNIQUE, scopes TEXT[],
  created_at, last_used_at, expires_at, revoked_at
)
```

Prod runs with `INIT_DB` unset, so `schema.sql` never syncs on deploy.
`McpToken.ensureSchema()` uses the static-latch self-heal pattern already
established by `Group.ensureDuesSchema` and `ensureKnockoutOnlyColumn`:
create-if-missing on first use, latch on success only, never latch on failure.

## Scope enforcement

One middleware, not per-route logic. `requireScope('picks:write')` returns 403
with a machine-readable body. A token that is revoked, expired, or unknown
fails closed with 401 — never a fall-through to anonymous access.

## Rate limiting

The backend has no rate limiting today, which is acceptable while every client
is a human clicking a UI. Agent traffic changes that shape. Phase 1 adds a
per-token fixed-window counter, in-process, sized for Vercel serverless (a
cold start resets it — acceptable, since the goal is bounding runaway loops,
not precise quota).

## MCP tool surface (phase 1)

| Tool | Scope | Notes |
|---|---|---|
| `list_groups` | `groups:read` | NFL pools, excludes World Cup |
| `get_slate` | none | Games + odds for a week |
| `get_my_picks` | `picks:read` | One group, one week |
| `get_standings` | `groups:read` | Scoreboard |
| `submit_week` | `picks:write` | Multi-group fan-out, read-modify-write |

`submit_week` is the reason the core layer exists. `POST /picks` is a
whole-week upsert with confidence-permutation semantics: confidence must be
unique across the week, assigning a used value implicitly clears it from its
prior game, and a started game returns 409. A naive per-pick setter corrupts
the week. The core always reads current picks, merges, and posts the full
array.

## Test strategy

| Layer | What it proves | Needs |
|---|---|---|
| L1 | Core tool logic, RMW correctness, scope gating | nothing |
| L2 | Middleware + routes, self-heal fires, fails closed | nothing (pool stubbed) |
| L3 | Real SQL: hashing, lookup, revocation | Docker Postgres |
| L4 | Real Claude, real protocol, local branch + local DB | seed script |

L4 command shape:

```
CONFIDENCE_PICKS_API=http://localhost:3001 \
CONFIDENCE_PICKS_TOKEN=cp_live_… \
claude mcp add cp-dev -- node ./mcp/src/stdio.js
```

### Not provable off-prod

Vercel cold-start behavior, and the self-heal latch firing against the real
production schema on first deploy. Both are risks the codebase already
carries with the dues and knockout-only columns.

## Safety properties for review

1. `authenticateToken` untouched — web sessions cannot regress.
2. New tables only; no column added to an existing table.
3. All new routes namespaced under `/api/mcp`.
4. Scope set excludes every destructive operation.
5. Baseline of 418 backend tests must stay green.

## Phase 2 (not in this PR)

OAuth 2.1 AS on the same `mcp_tokens` substrate: RFC 9728 protected-resource
metadata, RFC 8414 AS metadata, `/oauth/authorize` with consent, `/oauth/token`
with PKCE S256, RFC 8707 resource binding. The human login step reuses the
existing Passport Google/Apple flow.
