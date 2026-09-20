#!/usr/bin/env node
import { readFileSync } from 'node:fs';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { ConfidencePicksClient } from './client.js';
import * as core from './core.js';

// stdio transport: the server runs on the user's own machine and reads its
// credential from the environment. This sidesteps claude-code#50464 (configured
// --header not attached on HTTP tool calls) and needs no hosting at all.

// Built lazily so that importing this module (in tests, or to inspect TOOLS)
// does not require a credential to be present in the environment.
let _client = null;
function defaultClient() {
  if (!_client) {
    _client = new ConfidencePicksClient({
      baseUrl: process.env.CONFIDENCE_PICKS_API,
      token: process.env.CONFIDENCE_PICKS_TOKEN
    });
  }
  return _client;
}

const week = { type: 'number', description: 'NFL week number, 1-18' };
const season = { type: 'number', description: 'Season year, e.g. 2026' };
const seasonType = { type: 'number', description: '1 = preseason, 2 = regular season. Defaults to 2.' };

export const TOOLS = [
  {
    name: 'list_groups',
    description: 'List the NFL confidence pools you belong to. World Cup pools are excluded.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_slate',
    description: 'Get the games for a week, with kickoff times, status, live score and game clock (score is null before kickoff; in-progress scores are at most about a minute old), team ids and betting odds. Use the returned gameId and team ids when submitting picks.',
    inputSchema: { type: 'object', properties: { season, seasonType, week }, required: ['season', 'week'] }
  },
  {
    name: 'get_my_picks',
    description: 'Get your existing picks for one group and week.',
    inputSchema: {
      type: 'object',
      properties: { group: { type: 'string', description: 'Group identifier, e.g. okun-family-picks' }, season, seasonType, week },
      required: ['group', 'season', 'week']
    }
  },
  {
    name: 'get_standings',
    description: 'Get the season scoreboard for a group.',
    inputSchema: {
      type: 'object',
      properties: { group: { type: 'string' }, season, seasonType },
      required: ['group', 'season']
    }
  },
  {
    name: 'submit_week',
    description: 'Submit confidence picks for a week to one or more groups. Picks are merged with any picks you already have, and confidence collisions are resolved before sending. Confidence must be unique across the week; the highest value is your surest pick. Games that have kicked off are locked and will fail.',
    inputSchema: {
      type: 'object',
      properties: {
        groups: { type: 'array', items: { type: 'string' }, description: 'Group identifiers to save to. The same picks go to every one.' },
        season, seasonType, week,
        picks: {
          type: 'array',
          description: 'One entry per game you are picking.',
          items: {
            type: 'object',
            properties: {
              gameId: { type: 'number' },
              pickedTeamId: { type: 'string', description: 'Team id of the winner, from get_slate.' },
              confidence: { type: 'number', description: 'Points wagered; unique across the week.' }
            },
            required: ['gameId']
          }
        }
      },
      required: ['groups', 'season', 'week', 'picks']
    }
  }
];

export async function dispatch(name, args, c) {
  if (!c) c = defaultClient();
  switch (name) {
    case 'list_groups': return core.listGroups(c);
    case 'get_slate': return core.getSlate(c, args);
    case 'get_my_picks': return core.getMyPicks(c, args);
    case 'get_standings': return core.getStandings(c, args);
    case 'submit_week': return core.submitWeek(c, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}

// Announce the version that was actually published, not a literal that drifts.
const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

const server = new Server(
  { name: 'confidence-picks', version },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  try {
    const result = await dispatch(req.params.name, req.params.arguments || {});
    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e) {
    // Surface the failure to the model as tool output rather than a protocol
    // error, so it can explain or retry instead of the call simply vanishing.
    return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
  }
});

// Deliberately NOT guarded by an `import.meta.url === process.argv[1]` check.
// npm installs bins as symlinks in node_modules/.bin, and import.meta.url
// resolves symlinks while process.argv[1] does not -- so under npx that
// comparison is always false and the server silently never starts. bin/cli.js
// calls this explicitly instead, which cannot drift.
export async function startStdioServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('confidence-picks MCP server ready on stdio');
  return server;
}

export { server };
