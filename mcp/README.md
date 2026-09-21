# confidence-picks-mcp

MCP server for [confidence-picks](https://www.confidence-picks.com). Lets Claude
Code or Codex read your pools and standings and make NFL confidence picks on
your behalf.

## Setup

1. Sign in at confidence-picks.com, open **Profile → AI client access**, and
   create a token. It is shown once.
2. Register the server:

```bash
# Claude Code
claude mcp add confidence-picks \
  --env CONFIDENCE_PICKS_TOKEN=cp_live_... \
  -- npx -y confidence-picks-mcp

# Codex CLI
codex mcp add confidence-picks \
  --env CONFIDENCE_PICKS_TOKEN=cp_live_... \
  -- npx -y confidence-picks-mcp
```

## Tools

| Tool | Purpose |
|---|---|
| `list_groups` | Your NFL pools (World Cup pools excluded) |
| `get_slate` | Games for a week, with kickoff, `locksAt`, `editable`, status, live `score` and `statusDetail` (game clock), team ids and odds |
| `get_my_picks` | Your existing picks for a group and week |
| `get_standings` | Season scoreboard for a group |
| `submit_week` | Submit picks to one or more groups at once |
| `get_dues` | A group's dues settings; for admins, also who has paid and totals collected / outstanding |
| `update_dues_settings` | **Admins, needs Manage dues.** Turn dues on/off, set the amount, payment method, handle or instructions, payout notes, collector — any one field or several |
| `set_dues_paid` | **Admins, needs Manage dues.** Mark one or more members paid or unpaid |

## What a token can and cannot do

Default scopes are `groups:read`, `picks:read`, `picks:write`. A token **cannot**
delete a group, leave a group, join a group, rename a group or change its
visibility, post chat, or change another member's picks — the server rejects
those endpoints for MCP credentials regardless of what the client asks for.

### Managing dues

Dues are off limits unless you tick **Manage dues** (`dues:write`) when creating
the token. It is unchecked by default, and tokens created before it existed do
not have it — create a new one.

Even with it, the two dues write tools only work in groups where **you are an
admin**; a member's token is refused by the server. The permission covers where
members send money (the Venmo / Cash App handle and the collector) as well as who
is marked paid, so grant it only to a client you would trust with both. Every
write returns the state before and after, and marks made through a token are
recorded as such (`markedVia: "mcp"` in `get_dues`).

Amounts are in dollars at the tool (`amount: 20`), not cents.

Tokens expire after 90 days and can be revoked at any time from your profile.

## Environment

| Variable | Required | Default |
|---|---|---|
| `CONFIDENCE_PICKS_TOKEN` | yes | — |
| `CONFIDENCE_PICKS_API` | no | `https://api.confidence-picks.com` |

## Development

```bash
npm install
npm test
```

Point at a local backend with `CONFIDENCE_PICKS_API=http://localhost:3001`.

## Editing up to the deadline

`get_slate` reports a pick window per game:

- `kickoff` / `locksAt` — the scheduled kickoff instant, which is when writes
  close. Read it from here, not from `status`: ESPN's status trails the real
  kickoff by minutes, so a game can still say `SCHEDULED` after it stops
  accepting picks.
- `editable` — resolved by the server, which owns the clock. `null` means an
  older server did not answer; treat that as unknown, never as permission.

`submit_week` uses that window to withhold picks on games that have already
started, so one kicked-off game cannot sink the still-open picks in the same
batch. Anything withheld comes back in `skippedLocked` (client-side) or
`serverSkippedLocked` (accepted by the server as an unchanged no-op) rather than
failing silently.

Reordering a ladder — swapping two confidences, rotating three — is a normal
edit and is accepted. Every submission carries an `Idempotency-Key`, and the
server serialises concurrent writes per user/group/week, so retrying after a
timeout converges on the same week instead of racing itself.
