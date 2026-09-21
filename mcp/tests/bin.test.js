import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { mkdtempSync, symlinkSync, rmSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

// Regression guard for the 0.1.0 bug.
//
// The entrypoint used to be gated on `import.meta.url === file://${process.argv[1]}`.
// import.meta.url resolves symlinks and process.argv[1] does not, and npm installs
// bins as symlinks in node_modules/.bin -- so under npx the condition was always
// false, the server was never created, and the process exited 0 in silence.
// `npx -y confidence-picks-mcp` did nothing at all.
//
// Every earlier test invoked src/stdio.js by its real path, which is precisely why
// none of them caught it. This one goes through a symlink on purpose.

const here = path.dirname(fileURLToPath(import.meta.url));
const realBin = path.join(here, '..', 'bin', 'cli.js');

describe('published bin entrypoint', () => {
  let dir, link, client;

  before(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'cp-mcp-bin-'));
    link = path.join(dir, 'confidence-picks-mcp');
    symlinkSync(realBin, link); // mimics node_modules/.bin
  });

  after(() => {
    try { rmSync(dir, { recursive: true, force: true }); } catch { /* best effort */ }
  });

  test('starts and serves MCP when invoked through a bin symlink', async () => {
    const transport = new StdioClientTransport({
      command: 'node',
      args: [link],
      env: { ...process.env, CONFIDENCE_PICKS_TOKEN: 'cp_live_symlinktest' }
    });
    client = new Client({ name: 'bin-test', version: '1.0.0' }, { capabilities: {} });

    // Before the fix this rejected with "Connection closed" -- the process exited
    // before it ever spoke the protocol.
    await client.connect(transport);

    // Close in `finally`: a failed assertion that skips close() leaves the spawned
    // server alive, and the test runner then hangs waiting on it.
    try {
      const { tools } = await client.listTools();
      assert.strictEqual(tools.length, 8, `expected 8 tools, got ${tools.map(t => t.name)}`);
      assert.ok(tools.some((t) => t.name === 'submit_week'));

      // The server used to announce a hardcoded '0.1.0' long after the package had
      // moved on, so a client could not tell which build it was talking to.
      const pkg = JSON.parse(readFileSync(path.join(here, '..', 'package.json'), 'utf8'));
      assert.strictEqual(client.getServerVersion().version, pkg.version);
    } finally {
      await client.close();
    }
  });
});
