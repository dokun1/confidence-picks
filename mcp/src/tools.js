// Tool definitions and dispatch, with NO Node-only or SDK imports. Hosts other
// than the stdio binary -- the admin portal's inspector page -- import this to
// build forms from the schemas and to route calls, so it has to load anywhere.
//
// Annotations follow the MCP spec's hints: readOnlyHint for the five reads;
// destructiveHint on the two writes that overwrite existing records
// (submit_week replaces the saved week, update_dues_settings replaces the
// payment handle / collector). set_dues_paid skips members already in the
// requested state, so nothing is lost and it is not marked destructive. They are
// hints for a client's confirmation UX, not a security control -- the token
// scopes and the backend's admin checks are.
import * as core from './core.js';
import * as dues from './dues.js';

const week = { type: 'number', description: 'NFL week number, 1-18' };
const groupArg = { type: 'string', description: 'Group identifier, e.g. okun-family-picks' };
const season = { type: 'number', description: 'Season year, e.g. 2026' };
const seasonType = { type: 'number', description: '1 = preseason, 2 = regular season. Defaults to 2.' };

export const TOOLS = [
  {
    name: 'list_groups',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'List the NFL confidence pools you belong to. World Cup pools are excluded.',
    inputSchema: { type: 'object', properties: {} }
  },
  {
    name: 'get_slate',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'Get the games for a week, with kickoff times, status, live score and game clock (score is null before kickoff; in-progress scores are at most about a minute old), team ids and betting odds. Use the returned gameId and team ids when submitting picks.',
    inputSchema: { type: 'object', properties: { season, seasonType, week }, required: ['season', 'week'] }
  },
  {
    name: 'get_my_picks',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'Get your existing picks for one group and week.',
    inputSchema: {
      type: 'object',
      properties: { group: { type: 'string', description: 'Group identifier, e.g. okun-family-picks' }, season, seasonType, week },
      required: ['group', 'season', 'week']
    }
  },
  {
    name: 'get_standings',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'Get the season scoreboard for a group.',
    inputSchema: {
      type: 'object',
      properties: { group: { type: 'string' }, season, seasonType },
      required: ['group', 'season']
    }
  },
  {
    name: 'submit_week',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
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
  },
  {
    name: 'get_dues',
    annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'Get a group\'s dues: whether dues are on, the amount, how members pay, payout notes and the collector. If you are an admin of the group it also lists every member with whether they have paid (and who marked them, via the web app or an AI client) plus totals collected and outstanding. Non-admins get the settings only.',
    inputSchema: { type: 'object', properties: { group: groupArg }, required: ['group'] }
  },
  {
    name: 'update_dues_settings',
    annotations: { readOnlyHint: false, destructiveHint: true, idempotentHint: true, openWorldHint: false },
    description: 'Change a group\'s dues settings. Group admins only, and the token needs the opt-in "Manage dues" (dues:write) permission. Every field is optional: pass only what should change and everything else is left alone. CAUTION: venmoHandle, cashappHandle, instructions and collectorUserId control where members send real money -- change them only when the user asked for exactly that. Choosing a paymentMethod clears the other methods\' fields. Returns the settings before and after, and the list of fields that changed; show the user what changed.',
    inputSchema: {
      type: 'object',
      properties: {
        group: groupArg,
        enabled: { type: 'boolean', description: 'Whether dues are required for this group.' },
        amount: { type: ['number', 'null'], description: 'Dues per member in DOLLARS, e.g. 20 or 25.50 (not cents). null clears it.' },
        paymentMethod: { type: 'string', enum: ['venmo', 'cashapp', 'other'], description: 'How members pay. Exactly one per group.' },
        venmoHandle: { type: ['string', 'null'], description: 'Venmo username, used when paymentMethod is venmo. A leading @ is fine.' },
        cashappHandle: { type: ['string', 'null'], description: 'Cash App cashtag, used when paymentMethod is cashapp. A leading $ is fine.' },
        instructions: { type: ['string', 'null'], description: 'Free-text payment instructions (Zelle, cash, check), used when paymentMethod is other. Max 1000 characters.' },
        payoutNotes: { type: ['string', 'null'], description: 'How the pot is paid out, shown to members and invitees. Max 1000 characters.' },
        collectorUserId: { type: ['number', 'null'], description: 'userId (from get_dues) of the member who collects the money. Must be a member of the group. null clears it.' }
      },
      required: ['group']
    }
  },
  {
    name: 'set_dues_paid',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false },
    description: 'Mark one or more members of a group as having paid their dues, or as unpaid. Group admins only, and the token needs the opt-in "Manage dues" (dues:write) permission. This is a manual ledger -- nothing verifies the payment -- so only mark someone paid when the user says the money arrived. Members already in the requested state are left untouched. Returns each member\'s status before and after; a failure for one member does not stop the others.',
    inputSchema: {
      type: 'object',
      properties: {
        group: groupArg,
        members: { type: 'array', minItems: 1, items: { type: 'number' }, description: 'userId values from get_dues.' },
        paid: { type: 'boolean', description: 'true = paid, false = unpaid.' }
      },
      required: ['group', 'members', 'paid']
    }
  }
];

export async function dispatch(name, args, client) {
  if (!client) throw new Error('dispatch requires a client');
  switch (name) {
    case 'list_groups': return core.listGroups(client);
    case 'get_slate': return core.getSlate(client, args);
    case 'get_my_picks': return core.getMyPicks(client, args);
    case 'get_standings': return core.getStandings(client, args);
    case 'submit_week': return core.submitWeek(client, args);
    case 'get_dues': return dues.getDues(client, args);
    case 'update_dues_settings': return dues.updateDuesSettings(client, args);
    case 'set_dues_paid': return dues.setDuesPaid(client, args);
    default: throw new Error(`Unknown tool: ${name}`);
  }
}
