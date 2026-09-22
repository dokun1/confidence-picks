#!/usr/bin/env node
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ConfidencePicksClient } from './client.js';
import { createServer } from './server.js';
import { TOOLS, dispatch } from './tools.js';

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

// Kept for callers (and tests) that dispatch by name without supplying a client.
function dispatchDefault(name, args, c) {
  return dispatch(name, args, c || defaultClient());
}
export { TOOLS, dispatchDefault as dispatch };

// Deliberately NOT guarded by an `import.meta.url === process.argv[1]` check.
// npm installs bins as symlinks in node_modules/.bin, and import.meta.url
// resolves symlinks while process.argv[1] does not -- so under npx that
// comparison is always false and the server silently never starts. bin/cli.js
// calls this explicitly instead, which cannot drift.
export async function startStdioServer() {
  const server = createServer(defaultClient());
  await server.connect(new StdioServerTransport());
  console.error('confidence-picks MCP server ready on stdio');
  return server;
}
