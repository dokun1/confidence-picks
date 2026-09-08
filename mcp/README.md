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
| `get_slate` | Games for a week, with kickoff, status, team ids and odds |
| `get_my_picks` | Your existing picks for a group and week |
| `get_standings` | Season scoreboard for a group |
| `submit_week` | Submit picks to one or more groups at once |

## What a token can and cannot do

Scopes are `groups:read`, `picks:read`, `picks:write`. A token **cannot** delete
a group, leave a group, join a group, mark dues, post chat, or change another
member's picks — the server rejects those endpoints for MCP credentials
regardless of what the client asks for.

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
