// Dues tools: what a group admin can do on the dues section of the Settings tab.
//
// Reads need only groups:read. The two writes need the opt-in dues:write scope
// AND the token's owner to be an admin of the group -- the server enforces both;
// the role check here exists so a non-admin gets a sentence instead of a 403.
//
// Wire shapes differ between the two endpoints and this file is where that is
// absorbed: GET /groups/:id is camelCase, GET /groups/:id/members returns raw
// snake_case rows.

const groupPath = (group) => `/api/groups/${encodeURIComponent(group)}`;

// Integer cents <-> dollars without float drift (19.99 * 100 is 1998.9999...).
const toDollars = (cents) => (cents == null ? null : cents / 100);

function settingsOf(g) {
  return {
    enabled: Boolean(g.duesEnabled),
    amount: toDollars(g.duesAmountCents ?? null),
    amountCents: g.duesAmountCents ?? null,
    paymentMethod: g.duesPaymentMethod ?? null,
    venmoHandle: g.duesVenmoHandle ?? null,
    cashappHandle: g.duesCashappHandle ?? null,
    instructions: g.duesInstructions ?? null,
    payoutNotes: g.duesPayoutNotes ?? null,
    collector: g.duesCollectorUserId == null
      ? null
      : { userId: g.duesCollectorUserId, name: g.duesCollectorName ?? null }
  };
}

// Deliberately a whitelist: the members route can carry an email, and nothing
// here should ever hand one to a model.
function memberOf(m) {
  return {
    userId: m.id,
    name: m.name,
    role: m.role,
    paid: m.dues_paid_at != null,
    paidAt: m.dues_paid_at ?? null,
    markedBy: m.dues_marked_by_name ?? null,
    markedVia: m.dues_marked_via ?? null
  };
}

async function requireAdmin(client, group) {
  const g = await client.get(groupPath(group));
  if (g.userRole !== 'admin') {
    throw new Error(`You are not an admin of ${group}. Only a group's admins can change its dues settings or mark members paid.`);
  }
  return g;
}

export async function getDues(client, { group }) {
  const g = await client.get(groupPath(group));
  const base = { group, role: g.userRole ?? null, settings: settingsOf(g) };

  // Mirrors the page, where "Who has paid" is an admin-only section.
  if (g.userRole !== 'admin') {
    return { ...base, members: null, totals: null, note: 'Only group admins can see who has paid.' };
  }

  const members = (await client.get(`${groupPath(group)}/members`)).map(memberOf);
  const paid = members.filter((m) => m.paid).length;
  const unpaid = members.length - paid;
  const cents = g.duesAmountCents ?? null;
  return {
    ...base,
    members,
    totals: {
      members: members.length,
      paid,
      unpaid,
      collected: cents == null ? null : toDollars(paid * cents),
      outstanding: cents == null ? null : toDollars(unpaid * cents)
    }
  };
}

// Tool argument -> API field. `amount` is handled separately (unit conversion).
const SETTINGS_FIELDS = {
  enabled: 'duesEnabled',
  paymentMethod: 'duesPaymentMethod',
  venmoHandle: 'duesVenmoHandle',
  cashappHandle: 'duesCashappHandle',
  instructions: 'duesInstructions',
  payoutNotes: 'duesPayoutNotes',
  collectorUserId: 'duesCollectorUserId'
};

// The tool speaks dollars because a model told "$20" sends 20, and the API's
// unit is cents -- where 20 is twenty cents. Refuses to round: a third decimal
// is a mistake to surface, not to absorb.
function dollarsToCents(amount) {
  if (amount === null) return null;
  if (typeof amount !== 'number' || !Number.isFinite(amount) || amount <= 0) {
    throw new Error('amount must be a positive number of dollars (e.g. 20 or 25.50), or null to clear it.');
  }
  const cents = Math.round(amount * 100);
  if (Math.abs(amount * 100 - cents) > 1e-6) {
    throw new Error(`amount ${amount} has more than two decimal places; dues are whole cents.`);
  }
  return cents;
}

export async function updateDuesSettings(client, { group, ...fields }) {
  const body = {};
  if (fields.amount !== undefined) body.duesAmountCents = dollarsToCents(fields.amount);
  for (const [arg, apiKey] of Object.entries(SETTINGS_FIELDS)) {
    if (fields[arg] !== undefined) body[apiKey] = fields[arg];
  }
  if (Object.keys(body).length === 0) {
    throw new Error('Nothing to update: pass at least one of enabled, amount, paymentMethod, venmoHandle, cashappHandle, instructions, payoutNotes, collectorUserId.');
  }

  const before = settingsOf(await requireAdmin(client, group));
  const after = settingsOf(await client.put(`${groupPath(group)}/dues`, body));

  // Diff the whole form, not just what was sent: choosing a payment method
  // clears the other methods' fields server-side, and that should be visible.
  const changed = Object.keys(after)
    .filter((k) => k !== 'amountCents')
    .filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));

  return { group, changed, before, after };
}

export async function setDuesPaid(client, { group, members, paid }) {
  if (typeof paid !== 'boolean') {
    throw new Error('paid must be true or false.');
  }
  if (!Array.isArray(members) || members.length === 0) {
    throw new Error('members must be a non-empty array of user ids from get_dues.');
  }

  await requireAdmin(client, group);
  const ledger = new Map((await client.get(`${groupPath(group)}/members`)).map((m) => [String(m.id), memberOf(m)]));

  // All-or-nothing on the input: a typo'd id stops the batch before any write.
  const ids = [...new Set(members.map(String))];
  const unknown = ids.filter((id) => !ledger.has(id));
  if (unknown.length) {
    throw new Error(`Not a member of ${group}: ${unknown.join(', ')}. Use the userId values from get_dues.`);
  }

  // One request per member, so a partial failure is a real outcome and is
  // reported as one -- never silently swallowed.
  const results = [];
  for (const id of ids) {
    const m = ledger.get(id);
    const before = { paid: m.paid, paidAt: m.paidAt };
    // Re-marking would overwrite the original paid date and who recorded it.
    if (m.paid === paid) {
      results.push({ userId: m.userId, name: m.name, ok: true, unchanged: true, before, after: before });
      continue;
    }
    try {
      const res = await client.post(`${groupPath(group)}/members/${encodeURIComponent(id)}/dues`, { paid });
      results.push({ userId: m.userId, name: m.name, ok: true, before, after: { paid: res.duesPaidAt != null, paidAt: res.duesPaidAt ?? null } });
    } catch (e) {
      results.push({ userId: m.userId, name: m.name, ok: false, error: e.message });
    }
  }

  return { group, paid, ok: results.every((r) => r.ok), results };
}
