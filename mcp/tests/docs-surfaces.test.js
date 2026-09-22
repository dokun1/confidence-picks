import { test, describe } from 'node:test';
import assert from 'node:assert';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createServer } from '../src/server.js';
import { TOOLS } from '../src/tools.js';
import { INSTRUCTIONS, RESOURCES, PROMPTS } from '../src/docs.js';

// The documentation surfaces MCP offers beyond a tool description: server
// instructions, tool titles + output schemas + structured results, resources,
// prompts. These are driven over a real transport with the SDK client, which
// VALIDATES structuredContent against each tool's outputSchema on every call --
// so a schema that does not match real output fails here, not in a user's
// client.

const GROUP = { id: 9, name: 'Squad', identifier: 'squad', userRole: 'admin', memberCount: 2, poolType: 'nfl',
  duesEnabled: true, duesPaymentMethod: 'venmo', duesAmountCents: 2000, duesVenmoHandle: 'dana', duesCashappHandle: null,
  duesInstructions: null, duesPayoutNotes: 'Winner takes all', duesCollectorUserId: 1, duesCollectorName: 'Dana' };
const MEMBERS = [
  { id: 1, name: 'Dana', role: 'admin', dues_paid_at: '2026-09-01T00:00:00.000Z', dues_marked_via: 'web', dues_marked_by_name: 'Dana' },
  { id: 2, name: 'Sam', role: 'member', dues_paid_at: null, dues_marked_via: null, dues_marked_by_name: null }
];
const GAME = { id: 55, gameDate: '2026-09-13T16:00:00Z', status: 'IN_PROGRESS', statusDetail: '3:00 - 4th Quarter', homeScore: 10, awayScore: 7,
  locksAt: '2026-09-13T16:00:00Z', editable: false, homeTeam: { id: '1', abbreviation: 'SEA' }, awayTeam: { id: '2', abbreviation: 'NE' }, odds: null };

const fakeClient = () => ({
  get: async (p) => {
    if (p === '/api/groups/my-groups') return [{ identifier: 'squad', name: 'Squad', memberCount: 2, userRole: 'admin' }];
    if (p.endsWith('/members')) return MEMBERS;
    if (p.startsWith('/api/games/')) return { games: [GAME] };
    if (p.includes('/picks/me')) return { picks: [{ gameId: 55, pickedTeamId: '1', confidence: 1 }] };
    if (p.includes('/scoreboard')) return { season: 2026, seasonType: 2, weeks: [1], users: [{ userId: 1, name: 'Dana', pictureUrl: null, weekly: [{ week: 1, points: 5 }], totalPoints: 5 }] };
    return GROUP;
  },
  post: async (p, b) => (p.endsWith('/dues') ? { userId: 2, duesPaidAt: '2026-09-21T00:00:00.000Z' } : { ok: true }),
  put: async () => ({ ...GROUP, duesPayoutNotes: 'changed' })
});

async function connected() {
  const [a, b] = InMemoryTransport.createLinkedPair();
  const server = createServer(fakeClient());
  await server.connect(a);
  const c = new Client({ name: 't', version: '0' }, { capabilities: {} });
  await c.connect(b);
  return { c, close: async () => { await c.close(); await server.close(); } };
}

describe('server instructions', () => {
  test('are sent at initialize and cover the rules a model must know', async () => {
    const { c, close } = await connected();
    try {
      const i = c.getInstructions();
      assert.strictEqual(i, INSTRUCTIONS);
      for (const must of ['locksAt', 'DOLLARS', 'dues:write', 'admin', 'submit_week', 'get_slate']) {
        assert.ok(i.includes(must), `instructions mention ${must}`);
      }
      assert.ok(i.length < 2500, 'instructions stay short enough to sit in every conversation');
    } finally { await close(); }
  });
});

describe('tool titles and output schemas', () => {
  test('every tool has a human title and an object outputSchema', () => {
    for (const t of TOOLS) {
      assert.ok(t.title && t.title !== t.name, `${t.name} has a title`);
      assert.strictEqual(t.outputSchema?.type, 'object', `${t.name} outputSchema is an object`);
    }
  });

  // The SDK client throws if structuredContent does not validate against the
  // tool's outputSchema, so every call here is a schema-vs-reality check.
  const calls = [
    ['list_groups', {}],
    ['get_slate', { season: 2026, week: 1 }],
    ['get_my_picks', { group: 'squad', season: 2026, week: 1 }],
    ['get_standings', { group: 'squad', season: 2026 }],
    ['get_dues', { group: 'squad' }],
    ['update_dues_settings', { group: 'squad', payoutNotes: 'changed' }],
    ['set_dues_paid', { group: 'squad', members: [2], paid: true }],
    ['submit_week', { groups: ['squad'], season: 2026, week: 1, picks: [{ gameId: 55, pickedTeamId: '1', confidence: 1 }] }]
  ];
  for (const [name, args] of calls) {
    test(`${name} returns structuredContent that validates against its outputSchema`, async () => {
      const { c, close } = await connected();
      try {
        const res = await c.callTool({ name, arguments: args });
        assert.notStrictEqual(res.isError, true, res.content?.[0]?.text);
        assert.ok(res.structuredContent, 'structuredContent present');
        // The text form is kept for clients that predate structured output.
        assert.deepStrictEqual(JSON.parse(res.content[0].text), res.structuredContent);
      } finally { await close(); }
    });
  }

  test('a tool error carries no structuredContent and is still isError', async () => {
    const { c, close } = await connected();
    try {
      const res = await c.callTool({ name: 'set_dues_paid', arguments: { group: 'squad', members: [999], paid: true } });
      assert.strictEqual(res.isError, true);
      assert.strictEqual(res.structuredContent, undefined);
    } finally { await close(); }
  });

  // Arrays are not valid top-level structuredContent (it must be an object), so
  // list-shaped tools wrap their array. The text form mirrors that wrapper.
  test('list-shaped results are wrapped in an object', async () => {
    const { c, close } = await connected();
    try {
      const res = await c.callTool({ name: 'list_groups', arguments: {} });
      assert.ok(Array.isArray(res.structuredContent.groups));
      const slate = await c.callTool({ name: 'get_slate', arguments: { season: 2026, week: 1 } });
      assert.ok(Array.isArray(slate.structuredContent.games));
      assert.strictEqual(slate.structuredContent.games[0].score.home, 10);
    } finally { await close(); }
  });
});

describe('resources', () => {
  test('lists the docs and every one reads back as markdown', async () => {
    const { c, close } = await connected();
    try {
      const { resources } = await c.listResources();
      const uris = resources.map((r) => r.uri).sort();
      assert.deepStrictEqual(uris, RESOURCES.map((r) => r.uri).sort());
      assert.ok(uris.includes('confidence-picks://docs/tools'));
      assert.ok(uris.includes('confidence-picks://docs/pick-locking'));
      assert.ok(uris.includes('confidence-picks://docs/dues'));
      assert.ok(uris.includes('confidence-picks://docs/scoring'));
      for (const r of resources) {
        assert.strictEqual(r.mimeType, 'text/markdown');
        const { contents } = await c.readResource({ uri: r.uri });
        assert.ok(contents[0].text.length > 200, `${r.uri} has real content`);
        assert.match(contents[0].text, /^# /m);
      }
    } finally { await close(); }
  });

  test('the tools reference is generated from TOOLS, so it cannot drift', async () => {
    const { c, close } = await connected();
    try {
      const { contents } = await c.readResource({ uri: 'confidence-picks://docs/tools' });
      for (const t of TOOLS) {
        assert.ok(contents[0].text.includes(`\`${t.name}\``), `reference documents ${t.name}`);
        assert.ok(contents[0].text.includes(t.title), `reference uses ${t.name}'s title`);
      }
    } finally { await close(); }
  });

  test('an unknown uri is a clean error', async () => {
    const { c, close } = await connected();
    try { await assert.rejects(() => c.readResource({ uri: 'confidence-picks://docs/nope' }), /not found|unknown/i); }
    finally { await close(); }
  });
});

describe('prompts', () => {
  test('lists make-picks and dues-status with their arguments', async () => {
    const { c, close } = await connected();
    try {
      const { prompts } = await c.listPrompts();
      assert.deepStrictEqual(prompts.map((p) => p.name).sort(), PROMPTS.map((p) => p.name).sort());
      const mp = prompts.find((p) => p.name === 'make-picks');
      assert.deepStrictEqual(mp.arguments.map((a) => a.name), ['week', 'group']);
      assert.strictEqual(mp.arguments.find((a) => a.name === 'week').required, true);
    } finally { await close(); }
  });

  test('renders make-picks with its arguments substituted', async () => {
    const { c, close } = await connected();
    try {
      const { messages } = await c.getPrompt({ name: 'make-picks', arguments: { week: '3', group: 'squad' } });
      assert.strictEqual(messages[0].role, 'user');
      const text = messages[0].content.text;
      assert.ok(text.includes('week 3') || text.includes('Week 3'));
      assert.ok(text.includes('squad'));
      assert.ok(text.includes('get_slate') && text.includes('submit_week'));
    } finally { await close(); }
  });

  test('renders dues-status', async () => {
    const { c, close } = await connected();
    try {
      const { messages } = await c.getPrompt({ name: 'dues-status', arguments: { group: 'squad' } });
      assert.ok(messages[0].content.text.includes('get_dues'));
    } finally { await close(); }
  });

  test('a missing required argument is a clean error', async () => {
    const { c, close } = await connected();
    try { await assert.rejects(() => c.getPrompt({ name: 'make-picks', arguments: {} }), /week/); }
    finally { await close(); }
  });
});
