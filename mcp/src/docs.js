// Documentation the server publishes over MCP, beyond tool descriptions:
//
//   INSTRUCTIONS  -- sent at initialize; clients put it in the model's context
//                    before the first tool call. The single most-read text here.
//   RESOURCES     -- read-only markdown docs a client can pull on demand
//                    (confidence-picks://docs/...). The tools reference is
//                    generated from TOOLS so it cannot drift.
//   PROMPTS       -- named, parameterised workflows (slash-commands in Claude
//                    Code, pickers elsewhere).
//
// No Node-only imports: hosts that bundle this package (the admin inspector)
// load it too.
import { TOOLS } from './tools.js';

export const INSTRUCTIONS = `confidence-picks: NFL confidence-pool picks, standings and dues for the pools the token's owner belongs to.

How to work:
- Start with list_groups, then get_slate for the week. Use the gameId and team ids from the slate when submitting picks.
- Editability comes from the slate's locksAt/editable fields, which the server resolves. Never infer it from status (ESPN's status lags kickoff) or from the current time.
- submit_week merges into the saved week: picks you send replace those games; games you omit keep their saved pick; a game that has already kicked off is skipped, not rejected. Confidence values are 1..N (N = games that week) and must be unique across the week.
- Money amounts at this interface are DOLLARS (amount: 20), never cents.
- update_dues_settings and set_dues_paid need the opt-in dues:write permission on the token AND the owner must be an admin of that group. Both return before/after; show the user what changed. set_dues_paid records a manual ledger -- mark someone paid only when the user says the money arrived.
- Every write answers with what it did. If a result says a pick was skipped or a member was unchanged, report it rather than retrying.

Docs (resources): confidence-picks://docs/tools, /pick-locking, /scoring, /dues.`;

const md = {
  tools: () => {
    const lines = ['# Tool reference', '', 'Generated from the server\'s own tool definitions.', ''];
    for (const t of TOOLS) {
      const a = t.annotations ?? {};
      const kind = a.readOnlyHint ? 'read-only' : a.destructiveHint ? 'writes, overwrites existing records' : 'writes';
      lines.push(`## ${t.title} (\`${t.name}\`)`, '', `*${kind}.* ${t.description}`, '');
      const props = t.inputSchema?.properties ?? {};
      const req = new Set(t.inputSchema?.required ?? []);
      if (Object.keys(props).length === 0) lines.push('No arguments.', '');
      else {
        lines.push('| Argument | Type | Required | Notes |', '|---|---|---|---|');
        for (const [k, p] of Object.entries(props)) {
          const type = Array.isArray(p.type) ? p.type.join(' \\| ') : (p.type ?? 'any');
          lines.push(`| \`${k}\` | ${type}${p.enum ? ` (${p.enum.join(', ')})` : ''} | ${req.has(k) ? 'yes' : 'no'} | ${(p.description ?? '').replace(/\|/g, '\\|')} |`);
        }
        lines.push('');
      }
      const out = t.outputSchema?.properties ?? {};
      if (Object.keys(out).length) {
        lines.push('Returns: ' + Object.entries(out).map(([k, p]) => `\`${k}\`${p.description ? ` (${p.description})` : ''}`).join(', ') + '.', '');
      }
    }
    return lines.join('\n');
  },

  'pick-locking': () => `# When a pick can be changed

A pick on a game is open until the game's **scheduled kickoff instant**, or earlier if ESPN already reports it started. Postponed games stay open.

The server owns the clock. \`get_slate\` reports, per game:

- \`locksAt\` -- the kickoff instant, when writes close.
- \`editable\` -- the server's own answer, resolved at request time.

Do not derive editability from \`status\`: ESPN's status trails the real kickoff by minutes, so a game can read \`SCHEDULED\` after it has already locked. Do not derive it from the client's clock either: a fast device would lock games early.

## What \`submit_week\` does with a locked game

- An **unchanged** re-send of a saved pick on a locked game is accepted as a no-op and reported in \`skippedLocked\`.
- A **changed** pick on a locked game is rejected by the server (409). The client withholds picks on started games before sending, so one kicked-off game cannot sink an otherwise valid batch.

## Confidence values

Each week's picks use each value 1..N exactly once, where N is the number of games that week. Reordering a saved ladder is a permutation, which the server applies atomically -- you can swap two games' values in a single \`submit_week\`.
`,

  scoring: () => `# Scoring

A correct pick earns **+confidence**; an incorrect pick earns **−confidence**. A game that ends in a tie scores 0. Unpicked games score 0.

Weekly points are the sum over that week's games. Season points are the sum of weekly points. \`get_standings\` returns both per member: \`weekly\` (one entry per week played) and \`totalPoints\`.

Only **FINAL** games are scored, so standings move as games finish, not as scores change. \`get_slate\` carries live \`score\` and \`statusDetail\` for games in progress, if you want to project.

Because the pool is confidence-weighted, ranking your confidence well matters more than the number of correct picks: one wrong 16 costs more than four wrong 1s earn.
`,

  dues: () => `# Dues

A group admin can turn dues on, set an amount, choose how members pay, describe how the pot is paid out, and name a collector. Members are marked paid by hand -- neither Venmo nor Cash App confirms payments to third parties -- so the ledger is the admin's word.

## Reading

\`get_dues\` returns the settings for anyone in the group. For an **admin** of the group it also returns every member's status (with who marked them and whether via the web app or an AI client) and totals collected / outstanding.

## Writing

\`update_dues_settings\` and \`set_dues_paid\` require two things at once:

1. The token holds the opt-in **dues:write** permission ("Manage dues" when minting).
2. The token's owner is an **admin** of that group. A plain member is refused even with the permission.

\`update_dues_settings\` changes only the fields you send. Choosing a \`paymentMethod\` clears the other methods' fields server-side; the result lists every field that changed, including those. Amounts are in **dollars**.

\`set_dues_paid\` takes one or more member ids from \`get_dues\`. Unknown ids abort the batch before any write. A member already in the requested state is left untouched, so re-marking never overwrites the original paid date. Each member's before/after is reported; one failure does not stop the others.
`
};

export const RESOURCES = [
  { uri: 'confidence-picks://docs/tools', name: 'Tool reference', title: 'Tool reference', description: 'Every tool, its arguments and what it returns. Generated from the server\'s definitions.', mimeType: 'text/markdown', render: md.tools },
  { uri: 'confidence-picks://docs/pick-locking', name: 'Pick locking', title: 'When a pick can be changed', description: 'locksAt / editable, what happens to a pick on a started game, confidence uniqueness.', mimeType: 'text/markdown', render: md['pick-locking'] },
  { uri: 'confidence-picks://docs/scoring', name: 'Scoring', title: 'How picks are scored', description: '+confidence / −confidence, when standings update.', mimeType: 'text/markdown', render: md.scoring },
  { uri: 'confidence-picks://docs/dues', name: 'Dues', title: 'Dues settings and the paid ledger', description: 'Who can read and write dues, and what each write does.', mimeType: 'text/markdown', render: md.dues }
];

export function readResource(uri) {
  const r = RESOURCES.find((x) => x.uri === uri);
  if (!r) throw new Error(`Resource not found: ${uri}`);
  return { uri: r.uri, mimeType: r.mimeType, text: r.render() };
}

export const PROMPTS = [
  {
    name: 'make-picks',
    title: 'Make this week\'s picks',
    description: 'Walk through a week: read the slate, propose a confidence ladder, confirm, submit.',
    arguments: [
      { name: 'week', description: 'NFL week number, 1-18', required: true },
      { name: 'group', description: 'Group identifier to submit to. Omit to submit to every group.', required: false }
    ],
    render: ({ week, group }) => `Help me make my NFL confidence picks for week ${week}${group ? ` in the group "${group}"` : ' in all of my groups'}.

1. Call get_slate for week ${week} of the current season. Only games with editable = true can be picked; tell me which are already locked.
2. Call get_my_picks${group ? ` for "${group}"` : ' for each group'} so you know what is already saved.
3. Propose a full ladder: every open game, a winner, and a unique confidence from N down to 1 (N = games this week). Use the odds from the slate as a starting point and explain any pick that goes against the favourite.
4. Show me the ladder as a table and wait for my confirmation.
5. Only after I confirm, call submit_week${group ? ` with groups: ["${group}"]` : ' with every group from list_groups'}. Report exactly what the result says, including any picks it skipped.`
  },
  {
    name: 'dues-status',
    title: 'Who still owes dues?',
    description: 'Summarise a group\'s dues: who has paid, who has not, and the totals.',
    arguments: [{ name: 'group', description: 'Group identifier', required: true }],
    render: ({ group }) => `Call get_dues for the group "${group}" and summarise it: the amount and payment method, who has paid (with dates), who still owes, and the totals collected and outstanding. If I am not an admin of the group, say so and show only the settings. Do not mark anyone paid unless I explicitly ask.`
  }
];

export function getPrompt(name, args = {}) {
  const p = PROMPTS.find((x) => x.name === name);
  if (!p) throw new Error(`Prompt not found: ${name}`);
  for (const a of p.arguments) {
    if (a.required && (args[a.name] === undefined || args[a.name] === '')) throw new Error(`Prompt ${name} requires argument "${a.name}"`);
  }
  return { description: p.description, messages: [{ role: 'user', content: { type: 'text', text: p.render(args) } }] };
}
