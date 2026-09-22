import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import pkg from '../package.json' with { type: 'json' };
import { TOOLS, dispatch } from './tools.js';

// Announce the version that was actually published, not a literal that drifts.
// Imported through the module graph, NOT read from disk at runtime: when a host
// bundles this package (the admin portal's Next.js server bundle), a runtime
// readFileSync(new URL('../package.json', import.meta.url)) points at a file
// that was never shipped, and createServer() throws on first use.
const { version } = pkg;

// Build an MCP server bound to one API client. The stdio binary calls this with
// a client built from the environment; the admin portal's inspector calls it
// per request with a client built from a pasted token and connects over an
// in-memory transport. Same server, same tools, same behaviour either way.
export function createServer(client) {
  if (!client) throw new Error('createServer requires a client');
  const server = new Server({ name: 'confidence-picks', version }, { capabilities: { tools: {} } });

  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

  server.setRequestHandler(CallToolRequestSchema, async (req) => {
    try {
      const result = await dispatch(req.params.name, req.params.arguments || {}, client);
      return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
    } catch (e) {
      // Surface the failure to the model as tool output rather than a protocol
      // error, so it can explain or retry instead of the call simply vanishing.
      return { content: [{ type: 'text', text: `Error: ${e.message}` }], isError: true };
    }
  });

  return server;
}
