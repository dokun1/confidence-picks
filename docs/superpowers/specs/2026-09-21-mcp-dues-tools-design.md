# MCP dues tools — design

Date: 2026-09-21
Status: approved design, pending spec review

## Problem

A group admin manages dues on the group's Settings tab: whether dues are on,
the amount, how members pay, payout notes, who collects, and who has paid. None
of it is reachable from the MCP. That was deliberate — `mcpAuth.js` names "the
dues ledger" among the routes kept "off limits no matter what an agent is talked
into trying", and the phase-1 auth spec lists "No delete, leave, dues, or
admin-override" under blast radius.

This design reverses that decision for dues, on purpose, and says what replaces
the blanket denial.

## Decisions

| Question | Decision |
|---|---|
| Who may write | Group **admins** only. A plain member cannot, whatever their token holds. |
| Scope | One new scope, `dues:write`, gating both write tools. Reads stay under `groups:read`. |
| Scope default | **Opt-in.** Unchecked when minting a token; existing tokens never gain it. |
| Settings write path | A dedicated `PUT /groups/:identifier/dues`. The general settings route stays unreachable by tokens. |
| Settings tool shape | One tool, whole form, every field optional — update one thing or several. |
| Audit | New `dues_marked_via` column (`'web'` \| `'mcp'`) beside `dues_marked_by`. No history table. |
| Amount unit at the tool | Dollars in, converted to cents. The API stays integer cents. |
| Reminders to unpaid members | Out of scope: no such endpoint exists; it would be a new feature. |

### Why admin-only needs no new mechanism

An MCP token is not an identity of its own. `mcpAuth` validates it, then rewrites
the request to a short-lived JWT **for the user who minted it**. Every downstream
admin check therefore runs against that person's real role in that group:

- `Group.setDuesPaid` reads the acting user's `group_memberships.role` and throws
  "Only group admins can update dues status" otherwise.
- `Group.update` has the equivalent check; the new dues route goes through it.

So `dues:write` answers "may this token touch dues at all", and the existing role
check answers "in this group". Both must pass. Tests pin the member-with-scope
case to 403.

### Why a dedicated route rather than allowlisting the general one

Dues settings are saved today through `PUT /groups/:identifier`, which also
updates `name`, `description`, `is_public`, `max_members` and `avatar_url`.
Allowlisting it would let a token rename a group or make it public. Filtering the
body inside `mcpAuth` would make the allowlist body-aware, and any group setting
added later would be exposed to tokens unless someone remembered to filter it —
the opposite of that file's deny-by-default rule.

`PUT /groups/:identifier/dues` accepts only the dues keys. The general route
remains denied to tokens, and a test says so.

### Why one scope

`update_dues_settings` is the riskier tool — it can change the Venmo/Cash App
handle and the collector, i.e. where members send money — and splitting scopes
was considered for that reason. The owner chose a single `dues:write`: admin-only
already bounds who can do this, and one scope is simpler to mint and explain.
The before/after echo on every write (below) is the compensating control.

## Backend

### 1. Scope

`McpToken.MCP_SCOPES` gains `'dues:write'`. `validateScopes` needs no change.
The header comment in `McpToken.js` ("no dues marking") and the deny-list comment
in `mcpAuth.js` are updated to describe the new boundary rather than the old one.

### 2. Route policy

Two rows added to `MCP_ROUTE_POLICY`, both `scope: 'dues:write'`:

| Method | Pattern |
|---|---|
| `POST` | `^/groups/[^/]+/members/[^/]+/dues/?$` |
| `PUT` | `^/groups/[^/]+/dues/?$` |

No existing row matches either (different methods from the `GET` rows), so
ordering is unaffected. `PUT /groups/:identifier` stays unlisted.

### 3. `PUT /groups/:identifier/dues`

- Picks exactly these keys from the body and ignores everything else:
  `duesEnabled`, `duesPaymentMethod`, `duesAmountCents`, `duesVenmoHandle`,
  `duesCashappHandle`, `duesInstructions`, `duesPayoutNotes`,
  `duesCollectorUserId`.
- Partial by construction: `validateDuesUpdates` already acts only on keys that
  are present. The existing rule carries over — setting `duesPaymentMethod`
  clears the columns belonging to the other methods.
- A body with none of those keys is `400 { error: 'No dues fields to update' }`.
- Validation plus the collector-must-be-a-member check move into one shared
  helper, called by both this route and the existing general route, so the two
  cannot drift.
- Admin-only via `Group.update`; errors map as the general route does
  (403 not admin, 404 no group, 400 validation).
- Responds with the group's dues fields (same camelCase names), including
  `duesCollectorName`.

Registered before `PUT /:identifier` is irrelevant (distinct path depth), but it
sits next to the member-dues route for readability.

### 4. `dues_marked_via`

- `group_memberships.dues_marked_via VARCHAR(8) NULL`, values `'web'` | `'mcp'`.
  `NULL` for unpaid rows and for rows marked before this shipped.
- `schema.sql`: idempotent `ADD COLUMN IF NOT EXISTS` block.
- **Own self-heal latch.** `ensureDuesSchema` short-circuits on the presence of
  `dues_enabled`, which production already has, so it would never add this
  column. A separate `Group.ensureDuesMarkedViaColumn()` with its own static
  latch (the `ensureKnockoutOnlyColumn` pattern) is called by `setDuesPaid` and
  `getMembers`.
- `setDuesPaid(groupId, targetUserId, paid, actingUserId, via = 'web')` writes
  `via` when marking paid and `NULL` when un-marking, matching how
  `dues_marked_by` is already cleared.
- The route passes `req.mcpToken ? 'mcp' : 'web'`.
- `getMembers` additionally selects `gm.dues_marked_via` and the marking admin's
  name (`LEFT JOIN users` on `dues_marked_by`, as `dues_marked_by_name`).
- Note the wire shape: `GET /members` returns the **raw rows**, snake_case
  (`dues_paid_at`, `picture_url`, `joined_at`), unlike `GET /groups/:id`, which is
  camelCase. The new columns follow suit, and the MCP's `get_dues` does the
  mapping. Fixtures must encode this.

### 5. Member emails

`GET /groups/:identifier/members` omits `email` when `req.mcpToken` is set. Tokens
can reach this route today under `groups:read`; no MCP tool needs addresses.
Browser sessions are unchanged.

## Frontend

`McpTokensCard.tsx`:

- `SCOPES` gains `{ id: 'dues:write', label: 'Manage dues', hint: 'Change dues
  settings and mark members paid, in groups you admin' }`.
- `DEFAULT_SCOPES` is currently every scope. It becomes the three existing scopes
  only, so `dues:write` is **unchecked by default** and must be chosen.

No other frontend change. The Settings tab's dues form keeps using the general
`PUT /groups/:identifier`.

## MCP package — 0.3.0

Three tools; tool count 5 → 8.

### `get_dues(group)`

Reads `GET /groups/:id` and `GET /groups/:id/members`. No new scope.

```jsonc
{
  "group": "okun-family-picks",
  "role": "admin",
  "settings": {
    "enabled": true, "amount": 20, "amountCents": 2000,
    "paymentMethod": "venmo", "venmoHandle": "…", "cashappHandle": null,
    "instructions": null, "payoutNotes": "…",
    "collector": { "userId": 36, "name": "…" }
  },
  "members": [
    { "userId": 36, "name": "…", "role": "admin", "paid": true,
      "paidAt": "…", "markedBy": "…", "markedVia": "web" }
  ],
  "totals": { "members": 7, "paid": 4, "unpaid": 3,
              "collected": 80, "outstanding": 60 }
}
```

- **Admins** get the full ledger. **Non-admins** get `settings` plus a `members`
  array containing only themselves, and no `totals` — mirroring the page, where
  "Who has paid" is admin-only.
- Never returns email addresses.
- `totals.collected` / `outstanding` are `null` when no amount is set.

### `update_dues_settings(group, …)`

All optional: `enabled`, `amount` (dollars; at most 2 decimals; `null` clears),
`paymentMethod` (`venmo` | `cashapp` | `other`), `venmoHandle`, `cashappHandle`,
`instructions`, `payoutNotes`, `collectorUserId` (`null` clears).

- Sends only the fields supplied. No fields supplied is a client-side error.
- `amount` → `duesAmountCents` via `Math.round(amount * 100)`, rejecting more
  than two decimals rather than rounding silently.
- Reads settings first and returns `{ before, after }` so a changed handle or
  collector is visible in the tool result.

### `set_dues_paid(group, members, paid)`

- `members`: non-empty array of user ids from `get_dues`. `paid`: boolean.
- Reads the ledger first; rejects ids that are not members before writing
  anything.
- One `POST` per member, sequentially. Returns a per-member result —
  `{ userId, name, before, after }` or `{ userId, error }` — so a partial failure
  is a reported outcome, as in `submitWeek`.

### Shared behaviour

- Both write tools look up the caller's role for the group first and fail with
  "You are not an admin of <group>" rather than surfacing a bare 403.
- A 403 for a missing scope keeps the existing client message, which already
  names the scope problem; the README says to mint a token with **Manage dues**.
- Tool descriptions state plainly that these change real money-handling settings
  and that the tool result echoes what changed.

## Testing

Backend:

- Route: admin + `dues:write` succeeds on both writes; **member + `dues:write` is
  403 on both**; token without the scope is denied by policy; non-dues keys in a
  `/dues` body are ignored (name unchanged); empty dues body is 400;
  `PUT /groups/:id` is still denied to tokens.
- `via`: a token-authenticated mark stores `'mcp'`, a browser mark `'web'`,
  un-marking stores `NULL`.
- `GET /members` omits `email` for tokens and keeps it for browser sessions.
- `matchPolicy` unit cases for the two new rows.
- Existing `duesValidation` tests must pass untouched — the helper extraction
  moves code, it does not change rules.

Frontend: `McpTokensCard` renders **Manage dues** unchecked; a token minted
without touching it omits `dues:write`.

MCP: core tests for the three tools with fixtures copied from real API responses
(the `date`/`gameDate` lesson); dollars→cents and the two-decimal rejection;
non-admin shape of `get_dues`; partial-failure reporting in `set_dues_paid`;
bin test tool count 8.

## Rollout

One PR touching `backend/`, `frontend/` and `mcp/`. GitHub Actions cost — each
needs the owner's go-ahead before it is triggered:

| Run | Trigger |
|---|---|
| `backend-tests` | PR, `backend/**` (Postgres service container) |
| `frontend-ci` | PR, `frontend/**` |
| `mcp-ci` | PR, `mcp/**` |
| `deploy-backend` | push to `main`, `backend/**` — this is the real Vercel prod deploy |
| `deploy-frontend` | push to `main`, `frontend/**` |
| `publish-mcp` | manual dispatch, after merge |

Order after merge: backend deploy lands → dispatch `publish-mcp` for 0.3.0 → mint
a new token with **Manage dues** in the browser → update the user-scope pin to
`@0.3.0` and swap the token. The column self-heals on the first `setDuesPaid` or
`getMembers` call; no `INIT_DB`, no migration script.

Publishing 0.3.0 before the backend deploy is harmless: the new tools would get
"off-limits to MCP tokens" until the routes are allowlisted.

## Not in this change

- Reminders/emails to unpaid members.
- A dues history table, or any log of settings changes.
- A tool for other members' picks (`get_group_picks`) — separate change.
- Splitting `dues:write` into ledger and settings scopes; revisit if an admin
  wants an agent that can keep the books but not touch the payment handle.
