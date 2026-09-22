# admin.confidence-picks.com + MCP inspector page — design

Date: 2026-09-22
Status: approved direction (owner: "set it up, I will approve whatever you need")

## Problem

There is no way to exercise the confidence-picks MCP tools the way a Swagger
page exercises a REST API. The official MCP Inspector runs only on a developer's
machine (stdio transport = a local process) and cannot be hosted. The owner wants
a test page at `admin.confidence-picks.com`, behind Google sign-in, usable only
by two named people, following the pattern already proven at
`admin.findplayplace.app`.

## Decisions

| Question | Decision |
|---|---|
| Where | New `admin/` directory in this repo; its own Vercel project (Root Directory = `admin`), custom domain `admin.confidence-picks.com`. |
| Framework | Next.js App Router + Auth.js v5 (JWT session, no DB adapter) + Tailwind. Same as FPP. |
| Sign-in | Google only. No Apple (FPP needs it for iOS handoff; nothing here does). |
| Who may enter | Emails in the backend's existing `ADMIN_EMAILS` env var (two people). Checked in Auth.js's `signIn` callback against a new backend endpoint; **fails closed**. |
| Portal → backend | Server-side only, shared `ADMIN_API_SECRET` bearer, constant-time compare on the backend. Same as FPP. |
| Deploy | Vercel Git integration, **no GitHub Actions workflow**. Ignored-build-step so only `admin/**` changes build. |
| Running tools on the page | With a pasted `cp_live_` MCP token, held in page memory only. Requests go through the real token exchange so scope denials are testable. |
| Acting-as-the-signed-in-user | **Not built.** Would need a backend endpoint that issues a user session to anyone holding the shared secret, and would bypass the scope checks the page exists to test. |
| MCP protocol on the page | Real: the page's server side instantiates the published package's server and drives it with a real MCP `Client` over an in-memory transport. `tools/list` (with annotations) and `tools/call` are the real messages. |
| Writes | Real production writes. Write tools show the exact arguments and a confirmation before running. |

### Why reuse `ADMIN_EMAILS` rather than an `admins` table

FPP has a DB table because it has many staff and a reviewer sub-role. This is a
two-person list that already exists (it gates `POST /api/admin/recalculate-scoring-temp`,
`backend/src/routes/admin.js`) and is fail-closed when unset. A table would add a
schema, a self-heal and a seeding step for no benefit.

### Why the portal never holds a user session for the backend

The backend's OAuth callback redirects to a hardcoded frontend URL with tokens in
the query string (`routes/auth.js:25`); there is no return-to-a-second-site
support. Teaching it that is auth-surface work the inspector does not need. The
pasted-token model also means Candace acts as herself with her own groups and
admin rights — the page grants nobody access to anyone else's account.

## Backend (one PR, `backend/**` → `backend-tests` + `deploy-backend`)

- `requireAdminApi` middleware: `Authorization: Bearer <ADMIN_API_SECRET>`,
  `timingSafeEqual`, 401 on mismatch or when the env is unset (inert, not hidden).
- `GET /api/admin-portal/allowlist/check?email=…` → `{ allowed: boolean }`.
  Case-insensitive match against `ADMIN_EMAILS`. Unset list → `allowed: false`.
  Mounted router-wide behind `requireAdminApi`. Not in `MCP_ROUTE_POLICY`, so
  MCP tokens cannot reach it.
- Tests: correct secret + listed email → true; unlisted → false; unset list →
  false; wrong/missing secret → 401; env unset → 401; `matchPolicy` denies it.

## Admin app (`admin/`)

Mirrors FPP's load-bearing pieces, minus Apple and the app-handoff:

- `auth.config.ts` — edge-safe base (`providers: []`, JWT strategy, `adminEmail`
  carried on the token/session) for `middleware.ts`.
- `auth.ts` — `NextAuth` with `Google` and the `signIn` allowlist callback:
  `return isEmailAllowed(user?.email)`.
- `lib/allowlist.ts` — calls the backend check with the secret; `{ allowed: false }`
  on missing env, non-2xx, or empty email.
- `middleware.ts` — redirect to sign-in when no session; matcher excludes
  `api/auth`, static assets.
- `app/actions.ts` — every server action starts with `requireAdminEmail()`.
- Nav: `Inspector` only, for now. Pages are added by dropping `app/<route>/page.tsx`.
- Env (names): `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`,
  `SERVER_API_URL`, `ADMIN_API_SECRET`.
- Tests: `node --test` over pure helpers (allowlist fail-closed cases, guard
  decision, request builder). No DB, no network.

Phase 1 ships the sign-in gate with a placeholder home page, so Google OAuth,
the allowlist and the domain can be verified end to end before the inspector
exists.

## MCP package 0.4.0 (own PR, `mcp/**` → `mcp-ci` + manual `publish-mcp`)

- `src/server.js` exports `createServer(client)`; `stdio.js` uses it.
- `src/tools.js` exports `TOOLS` + `dispatch` with no Node-only imports.
- Tool annotations: `readOnlyHint: true` on `list_groups`, `get_slate`,
  `get_my_picks`, `get_standings`, `get_dues`; `readOnlyHint: false,
  idempotentHint: true` on the writes; `destructiveHint: true` on `submit_week`
  and `update_dues_settings` (they overwrite existing records).
- `package.json` `exports`: `.`, `./server`, `./tools`, `./client`.
- Tests: annotations arrive over the real protocol (bin test); `tools.js` and its
  imports contain no `node:`/SDK imports.

## Inspector page (`/inspector`, phase 2)

- Server side: `createServer(new ConfidencePicksClient({ token }))` + SDK `Client`
  + `InMemoryTransport.createLinkedPair()`, per request. The token comes from the
  form body and is never persisted.
- UI: tool list with read-only / writes badges (from annotations); one form per
  tool generated from `inputSchema` (string/number/boolean/enum/nullable; JSON
  textarea for arrays/objects; blank = not sent); result panel with the raw
  `tools/call` response, elapsed ms, and errors; write confirmation.
- Depends on the **published** package, not `../mcp` (the Vercel build context is
  `admin/` only, and the page should test what users install).

## Owner-only setup (in Chrome / dashboards)

1. **Vercel:** Add New → Project → import `dokun1/confidence-picks`, Root Directory
   `admin`, framework Next.js. Env vars above. Ignored build step:
   `git diff --quiet HEAD^ HEAD -- ./` (from the admin root). Domain
   `admin.confidence-picks.com`.
2. **Backend Vercel project:** `ADMIN_API_SECRET` (same value), `ADMIN_EMAILS`
   containing both addresses.
3. **Namecheap DNS:** `admin` CNAME → `cname.vercel-dns.com`.
4. **Google Cloud Console:** add
   `https://admin.confidence-picks.com/api/auth/callback/google` and
   `http://localhost:3000/api/auth/callback/google` to the OAuth client's redirect
   URIs (reusing the existing client), or create a new client.

Secrets are generated locally and piped into the dashboard/CLI; none pass
through a Claude session.

## Not in this change

- Apple sign-in; iOS→portal handoff.
- Acting as the signed-in user against the backend.
- Saving past inspector runs.
- Any other admin page.
