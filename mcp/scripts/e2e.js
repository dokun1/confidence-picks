#!/usr/bin/env node
/**
 * End-to-end check: spawns the real MCP server over stdio, speaks real MCP, and
 * drives it against a running backend. Proves the whole chain -- MCP client ->
 * stdio transport -> tool layer -> HTTP -> token exchange -> Express -> Postgres.
 *
 *   CONFIDENCE_PICKS_API=http://localhost:3099 \
 *   CONFIDENCE_PICKS_TOKEN=cp_live_... \
 *   node scripts/e2e.js <group-identifier>
 */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const group = process.argv[2] || 'mcp-seed-group';
const here = path.dirname(fileURLToPath(import.meta.url));
const serverPath = path.join(here, '..', 'src', 'stdio.js');

let failures = 0;
function check(label, condition, detail = '') {
  const mark = condition ? 'PASS' : 'FAIL';
  if (!condition) failures += 1;
  console.log(`  [${mark}] ${label}${detail ? ` -- ${detail}` : ''}`);
}

const transport = new StdioClientTransport({
  command: 'node',
  args: [serverPath],
  env: {
    ...process.env,
    CONFIDENCE_PICKS_API: process.env.CONFIDENCE_PICKS_API,
    CONFIDENCE_PICKS_TOKEN: process.env.CONFIDENCE_PICKS_TOKEN
  }
});

const client = new Client({ name: 'e2e', version: '1.0.0' }, { capabilities: {} });
await client.connect(transport);
console.log('\nconnected to the MCP server over stdio\n');

const call = async (name, args = {}) => {
  const res = await client.callTool({ name, arguments: args });
  const text = res.content?.[0]?.text ?? '';
  if (res.isError) return { error: text };
  try { return JSON.parse(text); } catch { return { raw: text }; }
};

// 1. Protocol handshake and tool discovery
const { tools } = await client.listTools();
console.log('tools/list');
check('advertises 5 tools', tools.length === 5, tools.map((t) => t.name).join(', '));

// 2. Reads
console.log('\nreads');
const groups = await call('list_groups');
check('list_groups returns the seeded group', Array.isArray(groups) && groups.some((g) => g.identifier === group));

const slate = await call('get_slate', { season: 2026, seasonType: 2, week: 1 });
check('get_slate returns games', Array.isArray(slate) && slate.length > 0, `${slate.length} games`);
const usable = slate.filter((g) => g.status === 'SCHEDULED' && g.homeTeam?.id).slice(0, 3);
check('at least 3 schedulable games', usable.length === 3);

const before = await call('get_my_picks', { group, season: 2026, seasonType: 2, week: 1 });
check('get_my_picks responds', Array.isArray(before), `${before.length} existing`);

// 3. Write: submit a small week
console.log('\nwrite');
const picks = usable.map((g, i) => ({ gameId: g.gameId, pickedTeamId: g.homeTeam.id, confidence: i + 1 }));
const submitted = await call('submit_week', { groups: [group], season: 2026, seasonType: 2, week: 1, picks });
check('submit_week saved to the group', submitted.saved === 1, JSON.stringify(submitted.results));

const after = await call('get_my_picks', { group, season: 2026, seasonType: 2, week: 1 });
check('picks persisted and read back', after.length >= 3, `${after.length} picks`);
for (const p of picks) {
  const found = after.find((a) => a.gameId === p.gameId);
  check(`game ${p.gameId} stored with confidence ${p.confidence}`,
    !!found && found.confidence === p.confidence && String(found.pickedTeamId) === String(p.pickedTeamId));
}

// 4. The merge path: change ONE pick, confirm the others survive
console.log('\nmerge (the read-modify-write guard)');
const flip = usable[0];
const changed = await call('submit_week', {
  groups: [group], season: 2026, seasonType: 2, week: 1,
  picks: [{ gameId: flip.gameId, pickedTeamId: flip.awayTeam.id, confidence: 1 }]
});
check('partial submit succeeded', changed.saved === 1);
const merged = await call('get_my_picks', { group, season: 2026, seasonType: 2, week: 1 });
check('the flipped game changed side',
  String(merged.find((m) => m.gameId === flip.gameId)?.pickedTeamId) === String(flip.awayTeam.id));
check('the untouched picks survived the partial submit',
  picks.slice(1).every((p) => merged.find((m) => m.gameId === p.gameId)?.confidence === p.confidence));
const confs = merged.filter((m) => m.confidence != null).map((m) => m.confidence);
check('no duplicate confidence after merge', new Set(confs).size === confs.length, confs.join(','));

// 5. Confidence collision: steal a value already held by another game
console.log('\ncollision handling');
const steal = await call('submit_week', {
  groups: [group], season: 2026, seasonType: 2, week: 1,
  picks: [{ gameId: usable[2].gameId, pickedTeamId: usable[2].homeTeam.id, confidence: 1 }]
});
check('collision submit succeeded rather than 400ing', steal.saved === 1, JSON.stringify(steal.results));
const post = await call('get_my_picks', { group, season: 2026, seasonType: 2, week: 1 });
const postConfs = post.filter((m) => m.confidence != null).map((m) => m.confidence);
check('still no duplicate confidence', new Set(postConfs).size === postConfs.length, postConfs.join(','));
check('the value moved to the claiming game',
  post.find((m) => m.gameId === usable[2].gameId)?.confidence === 1);

await client.close();
console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}\n`);
process.exit(failures === 0 ? 0 : 1);
