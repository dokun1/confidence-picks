import { test, describe } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { TOOLS, dispatch } from '../src/tools.js';

// 0.4.0 exists so that a host other than the stdio binary -- the admin
// portal's inspector page -- can run this exact server in-process, over an
// in-memory transport, against a client it supplies. These cases drive it the
// way that host will: real MCP messages, real tool calls.

const fakeClient = (routes = {}) => ({
  calls: [],
  get: async (p) => (routes.get ? routes.get(p) : { games: [] }),
  post: async (p, b) => (routes.post ? routes.post(p, b) : {}),
  put: async (p, b) => (routes.put ? routes.put(p, b) : {})
});

async function connected(client) {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createServer(client);
  await server.connect(a);
  const c = new Client({ name: 'test', version: '0' }, { capabilities: {} });
  await c.connect(b);
  return { c, close: async () => { await c.close(); await server.close(); } };
}

describe('createServer', () => {
  test('announces the package version and lists the eight tools with annotations', async () => {
    const { c, close } = await connected(fakeClient());
    try {
      const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
      assert.strictEqual(c.getServerVersion().version, pkg.version);
      const { tools } = await c.listTools();
      assert.strictEqual(tools.length, 8);
      for (const t of tools) {
        assert.ok(t.annotations, `${t.name} has annotations`);
        assert.strictEqual(typeof t.annotations.readOnlyHint, 'boolean', `${t.name} readOnlyHint`);
      }
      const ro = tools.filter((t) => t.annotations.readOnlyHint).map((t) => t.name).sort();
      assert.deepStrictEqual(ro, ['get_dues', 'get_my_picks', 'get_slate', 'get_standings', 'list_groups']);
      const writes = tools.filter((t) => !t.annotations.readOnlyHint).map((t) => t.name).sort();
      assert.deepStrictEqual(writes, ['set_dues_paid', 'submit_week', 'update_dues_settings']);
      // The two that overwrite existing records say so; marking paid does not
      // (an already-paid member is skipped, nothing is lost).
      assert.strictEqual(tools.find((t) => t.name === 'submit_week').annotations.destructiveHint, true);
      assert.strictEqual(tools.find((t) => t.name === 'update_dues_settings').annotations.destructiveHint, true);
      assert.strictEqual(tools.find((t) => t.name === 'set_dues_paid').annotations.destructiveHint, false);
    } finally { await close(); }
  });

  test('routes tools/call through the supplied client, not the environment', async () => {
    const client = fakeClient({ get: async () => [{ identifier: 'g', name: 'G', memberCount: 2, userRole: 'admin' }] });
    const { c, close } = await connected(client);
    try {
      const res = await c.callTool({ name: 'list_groups', arguments: {} });
      assert.strictEqual(res.isError, undefined);
      assert.deepStrictEqual(JSON.parse(res.content[0].text), [{ identifier: 'g', name: 'G', memberCount: 2, role: 'admin' }]);
    } finally { await close(); }
  });

  test('surfaces a tool failure as isError output, not a protocol error', async () => {
    const client = fakeClient({ get: async () => { throw new Error('Token rejected (401).'); } });
    const { c, close } = await connected(client);
    try {
      const res = await c.callTool({ name: 'list_groups', arguments: {} });
      assert.strictEqual(res.isError, true);
      assert.match(res.content[0].text, /Token rejected/);
    } finally { await close(); }
  });

  test('two servers from two clients are independent', async () => {
    const a = await connected(fakeClient({ get: async () => [{ identifier: 'a' }] }));
    const b = await connected(fakeClient({ get: async () => [{ identifier: 'b' }] }));
    try {
      assert.strictEqual(JSON.parse((await a.c.callTool({ name: 'list_groups', arguments: {} })).content[0].text)[0].identifier, 'a');
      assert.strictEqual(JSON.parse((await b.c.callTool({ name: 'list_groups', arguments: {} })).content[0].text)[0].identifier, 'b');
    } finally { await a.close(); await b.close(); }
  });
});

describe('tools.js is host-agnostic', () => {
  // The inspector page imports TOOLS to build its forms. That import must not
  // drag in the stdio transport, node:fs, or anything else a non-Node host lacks.
  test('tools.js and the modules it imports contain no node: or SDK imports', () => {
    const seen = new Set();
    const walk = (url) => {
      if (seen.has(url.href)) return; seen.add(url.href);
      const src = readFileSync(url, 'utf8');
      for (const m of src.matchAll(/^\s*import\s[^'"]*['"]([^'"]+)['"]/gm)) {
        const spec = m[1];
        assert.ok(!spec.startsWith('node:'), `${url.pathname} imports ${spec}`);
        assert.ok(!spec.startsWith('@modelcontextprotocol'), `${url.pathname} imports ${spec}`);
        if (spec.startsWith('.')) walk(new URL(spec, url));
      }
    };
    walk(new URL('../src/tools.js', import.meta.url));
  });

  test('dispatch requires an explicit client', async () => {
    await assert.rejects(() => dispatch('list_groups', {}), /client/i);
  });

  test('TOOLS is the same list the server serves', () => {
    assert.strictEqual(TOOLS.length, 8);
    assert.ok(TOOLS.every((t) => t.annotations && t.inputSchema && t.description));
  });
});
