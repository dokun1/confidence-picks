# Phase 2 — CLI-initiated OAuth for the MCP server

Date: 2026-09-08
Status: approved to build

## Goal

`claude mcp add --transport http https://api.confidence-picks.com/mcp`, then
`/mcp` — browser opens, user approves, token lands in the CLI. No copy-paste.

## The decisive constraint

The MCP 2025-11-25 spec ranks client registration: Client ID Metadata Documents
(SHOULD), pre-registration (SHOULD), Dynamic Client Registration (MAY, "included
for backwards compatibility").

**Claude Code requires DCR anyway.** It fetches AS metadata, looks for
`registration_endpoint`, and aborts with "Incompatible auth server: does not
support dynamic client registration" even when a client_id is pre-configured
(anthropics/claude-code#67258, open as of June 2026).

So DCR is not optional for us. We implement it, and additionally advertise
`client_id_metadata_document_supported: true` so better-behaved clients can use
the preferred path.

## Architecture

The MCP server is the OAuth **resource server**; the same Express app is also the
**authorization server**. Both live at `api.confidence-picks.com`.

### Reuse, not reinvention

Phase 1 already shipped and proved in production: the `mcp_tokens` table, the
scope model, the deny-by-default route policy, and `mcpTokenExchange`, which
turns an opaque `cp_live_` token into a normal access JWT for downstream routes.

**OAuth issues into that same table.** An OAuth-issued access token is another
row in `mcp_tokens`; the existing middleware validates it unchanged. That means
revocation, expiry, scope enforcement and rate limiting all work on day one, and
the only genuinely new code is the minting path.

### New tables

```
oauth_clients(client_id, client_name, redirect_uris[], created_at, ...)
oauth_auth_codes(code_hash, client_id, user_id, redirect_uri,
                 code_challenge, code_challenge_method, scope, resource,
                 expires_at, used_at)
```

`mcp_tokens` gains nullable `client_id`, `resource`, `kind` ('pat' | 'oauth'),
`refresh_token_hash`, `refresh_expires_at`. All via the established static-latch
self-heal, since production runs with `INIT_DB` unset.

### Endpoints

| Endpoint | Purpose |
|---|---|
| `GET /.well-known/oauth-protected-resource` | RFC 9728 — points at the AS |
| `GET /.well-known/oauth-authorization-server` | RFC 8414 — endpoints + `code_challenge_methods_supported: ["S256"]` + `registration_endpoint` |
| `POST /oauth/register` | RFC 7591 DCR |
| `GET /oauth/authorize` | validates, redirects to the frontend consent page |
| `POST /api/oauth/authorize` | approves and mints the code (session-authenticated) |
| `POST /oauth/token` | code exchange with PKCE + refresh rotation |
| `POST`/`GET` `/mcp` | the MCP endpoint itself |

### Why consent lives on the frontend

`/oauth/authorize` needs an authenticated user. Rather than build a second login
path on the backend, it 302s to `https://www.confidence-picks.com/oauth/consent`,
which already knows how to authenticate via the existing AuthContext. Approving
POSTs to the backend with the normal session JWT and receives the redirect URL
containing the code.

This reuses the whole existing login stack — Google, Apple, silent refresh —
instead of duplicating it.

## Security requirements taken from the spec

- PKCE **S256 mandatory**; reject an authorization request without a challenge.
- Authorization codes: single-use, short TTL, hashed at rest, bound to
  client_id + redirect_uri + resource.
- Redirect URIs validated by **exact match** against the registration.
- Only `localhost`/`127.0.0.1` loopback or HTTPS redirect URIs accepted.
- RFC 8707 `resource` recorded on the code and the token; tokens are only valid
  for this MCP server (audience binding).
- 401 responses carry `WWW-Authenticate: Bearer resource_metadata="…", scope="…"`.
- 403 with `error="insufficient_scope"` for scope failures.
- Refresh tokens rotate on use (public clients).
- Scopes unchanged from phase 1: `groups:read`, `picks:read`, `picks:write`.
  Nothing destructive is reachable.

## Out of scope

Claude Desktop and the Codex GUI. They need the same OAuth work plus their own
packaging; deferred deliberately.
