import { useState } from 'react';
import Avatar from '../Avatar';
import Button from '../Button';
import Card from '../Card';
import PaymentButton from '../PaymentButton';
import Select from '../Select';
import TextField from '../TextField';
import Toggle from '../Toggle';
import { buildVenmoLink, buildCashAppLink, formatCents } from '../../../lib/paymentLinks';

export interface DuesMember {
  id: string;
  name: string;
  pictureUrl: string | null;
  duesPaidAt: string | null;
}

export interface DuesSettingsValues {
  duesEnabled: boolean;
  duesAmountCents: number | null;
  duesVenmoHandle: string | null;
  duesCashappHandle: string | null;
  duesInstructions: string | null;
  duesCollectorUserId: number | null;
}

export interface DuesSettingsProps {
  /** Admins get the edit form and the per-member paid toggles. */
  isAdmin: boolean;
  /** Current persisted dues configuration. */
  values: DuesSettingsValues;
  /** Display name of the current collector, for the read-only view. */
  collectorName: string | null;
  members: DuesMember[];
  /** The viewer, so their own row can be highlighted. */
  currentUserId?: string;
  groupName?: string;
  /** Persist the admin's edits. Rejects with an Error whose message is shown. */
  onSave: (values: DuesSettingsValues) => Promise<void>;
  /** Flip one member's paid flag. Rejects with an Error whose message is shown. */
  onToggleMemberPaid: (userId: string, paid: boolean) => Promise<void>;
}

/** "$20.00" <-> 2000. Kept local: only this form speaks the dollar-string dialect. */
function centsToInput(cents: number | null): string {
  return cents === null || cents === undefined ? '' : (cents / 100).toFixed(2);
}

function inputToCents(input: string): number | null {
  const trimmed = input.trim().replace(/^\$/, '');
  if (trimmed === '') return null;
  const dollars = Number(trimmed);
  if (!Number.isFinite(dollars)) return NaN;
  // Round rather than truncate so "19.999" becomes $20.00 instead of $19.99.
  return Math.round(dollars * 100);
}

/**
 * The dues panel inside a group's settings tab.
 *
 * Two audiences share one component because they share one layout: an admin
 * sees the configuration form above the roster, a member sees a read-only
 * summary above the same roster. Splitting them would duplicate the roster and
 * the "how to pay" block, which are identical for both.
 *
 * Paid status is admin-set. Neither Venmo nor Cash App exposes a payment
 * confirmation API to third parties, so there is no automatic path from "money
 * moved" to "marked paid" — an admin ticking the box IS the ledger.
 */
export default function DuesSettings({
  isAdmin,
  values,
  collectorName,
  members,
  currentUserId,
  groupName,
  onSave,
  onToggleMemberPaid,
}: DuesSettingsProps) {
  const [draft, setDraft] = useState<DuesSettingsValues>(values);
  const [amountInput, setAmountInput] = useState(centsToInput(values.duesAmountCents));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Which member rows have an in-flight toggle, so each spinner is independent.
  const [pendingMembers, setPendingMembers] = useState<Set<string>>(new Set());

  function patch(next: Partial<DuesSettingsValues>) {
    setDraft((d) => ({ ...d, ...next }));
    setSavedAt(null);
  }

  async function handleSave() {
    const cents = inputToCents(amountInput);
    if (Number.isNaN(cents)) {
      setError('Enter the dues amount as a number, e.g. 20 or 20.00');
      return;
    }
    if (cents !== null && cents <= 0) {
      setError('Dues amount must be greater than zero');
      return;
    }

    setError(null);
    setSaving(true);
    try {
      const payload = { ...draft, duesAmountCents: cents };
      await onSave(payload);
      setDraft(payload);
      setSavedAt(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dues settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleMember(member: DuesMember) {
    const nextPaid = member.duesPaidAt === null;
    setPendingMembers((prev) => new Set(prev).add(member.id));
    setError(null);
    try {
      await onToggleMemberPaid(member.id, nextPaid);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update dues status');
    } finally {
      setPendingMembers((prev) => {
        const next = new Set(prev);
        next.delete(member.id);
        return next;
      });
    }
  }

  // The read-only "how to pay" block uses the SAVED values, not the draft: it
  // must reflect what members can actually act on right now.
  const amountLabel = formatCents(values.duesAmountCents);
  const note = groupName ? `${groupName} dues` : 'Pool dues';
  const venmoUrl = buildVenmoLink(values.duesVenmoHandle, values.duesAmountCents, note);
  const cashAppUrl = buildCashAppLink(values.duesCashappHandle, values.duesAmountCents);

  const paidCount = members.filter((m) => m.duesPaidAt !== null).length;

  const collectorOptions = members.map((m) => ({ value: String(m.id), label: m.name }));

  // Members see nothing at all when dues are off — an empty "Dues" heading on a
  // group that does not collect them is just noise.
  if (!isAdmin && !values.duesEnabled) return null;

  return (
    <Card as="section" padding="lg" className="space-y-md">
      <div className="flex items-baseline justify-between gap-md">
        <h2 className="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
          Dues
        </h2>
        {values.duesEnabled && (
          <span className="text-sm text-[var(--color-text-secondary)]">
            {paidCount} of {members.length} paid
          </span>
        )}
      </div>

      {isAdmin && (
        <div className="space-y-md">
          <Toggle
            id="dues-enabled"
            checked={draft.duesEnabled}
            onChange={(next) => patch({ duesEnabled: next })}
            label="Require dues"
            description="Members who have not paid see a reminder banner on the group page."
          />

          {draft.duesEnabled && (
            <div className="space-y-md border-t border-secondary-200 pt-md dark:border-secondary-700">
              <TextField
                id="dues-amount"
                label="Amount per member (USD)"
                value={amountInput}
                onChange={setAmountInput}
                placeholder="20.00"
                size="md"
              />

              <Select
                id="dues-collector"
                label="Who collects the dues?"
                value={draft.duesCollectorUserId === null ? '' : String(draft.duesCollectorUserId)}
                onChange={(v) => patch({ duesCollectorUserId: v === '' ? null : Number(v) })}
                options={collectorOptions}
                placeholder="Select a member…"
                helperText="Payment links point at this member. It does not have to be you."
              />

              <TextField
                id="dues-venmo"
                label="Venmo username (optional)"
                value={draft.duesVenmoHandle ?? ''}
                onChange={(v) => patch({ duesVenmoHandle: v || null })}
                placeholder="dana-reyes"
                size="md"
              />

              <TextField
                id="dues-cashapp"
                label="Cash App cashtag (optional)"
                value={draft.duesCashappHandle ?? ''}
                onChange={(v) => patch({ duesCashappHandle: v || null })}
                placeholder="danareyes"
                size="md"
              />

              <TextField
                id="dues-instructions"
                label="Other payment instructions (optional)"
                value={draft.duesInstructions ?? ''}
                onChange={(v) => patch({ duesInstructions: v || null })}
                placeholder="Zelle 555-0100, or cash at the Week 1 party."
                multiline
                rows={3}
                size="md"
              />
              <p className="text-sm text-[var(--color-text-secondary)]">
                Use this if you collect some other way. It is shown to members alongside
                any payment buttons.
              </p>
            </div>
          )}

          <div className="flex items-center gap-sm">
            <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
              Save dues settings
            </Button>
            {savedAt !== null && (
              <span className="text-sm text-success-600 dark:text-success-400">Saved</span>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-error-600 dark:text-error-400">
              {error}
            </p>
          )}
        </div>
      )}

      {values.duesEnabled && (
        <div className="space-y-sm border-t border-secondary-200 pt-md dark:border-secondary-700">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">How to pay</h3>
          <p className="text-sm text-[var(--color-text-secondary)]">
            {amountLabel ? `${amountLabel} per member` : 'Amount not set yet'}
            {collectorName ? `, collected by ${collectorName}` : ''}.
          </p>

          {(venmoUrl || cashAppUrl) && (
            <div className="flex flex-wrap gap-sm">
              <PaymentButton provider="venmo" href={venmoUrl} amountLabel={amountLabel} />
              <PaymentButton provider="cashapp" href={cashAppUrl} amountLabel={amountLabel} />
            </div>
          )}

          {values.duesInstructions && (
            <p className="whitespace-pre-line rounded-base bg-secondary-50 p-sm text-sm text-[var(--color-text-secondary)] dark:bg-secondary-900/40">
              {values.duesInstructions}
            </p>
          )}

          {!venmoUrl && !cashAppUrl && !values.duesInstructions && (
            <p className="text-sm text-[var(--color-text-secondary)]">
              The group admin has not set up a payment method yet.
            </p>
          )}
        </div>
      )}

      {values.duesEnabled && (
        <div className="space-y-xs border-t border-secondary-200 pt-md dark:border-secondary-700">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)]">Who has paid</h3>
          <ul className="divide-y divide-secondary-200 dark:divide-secondary-700">
            {members.map((member) => {
              const paid = member.duesPaidAt !== null;
              const pending = pendingMembers.has(member.id);
              const isSelf = currentUserId !== undefined && String(member.id) === String(currentUserId);
              return (
                <li key={member.id} className="flex items-center gap-sm py-xs">
                  <Avatar name={member.name} pictureUrl={member.pictureUrl} variant="sm" />
                  <span className="flex-1 truncate text-sm text-[var(--color-text-primary)]">
                    {member.name}
                    {isSelf && (
                      <span className="ml-xxs text-[var(--color-text-secondary)]">(you)</span>
                    )}
                  </span>
                  <span
                    className={[
                      'inline-flex items-center rounded-pill px-2.5 py-0.5 text-xs font-medium',
                      paid
                        ? 'bg-success-100 text-success-800 dark:bg-success-900/30 dark:text-success-200'
                        : 'bg-secondary-100 text-secondary-700 dark:bg-secondary-800 dark:text-secondary-300',
                    ].join(' ')}
                  >
                    {paid ? 'Paid' : 'Unpaid'}
                  </span>
                  {isAdmin && (
                    <Button
                      variant="tertiary"
                      size="sm"
                      loading={pending}
                      onClick={() => handleToggleMember(member)}
                      aria-label={
                        paid ? `Mark ${member.name} unpaid` : `Mark ${member.name} paid`
                      }
                    >
                      {paid ? 'Mark unpaid' : 'Mark paid'}
                    </Button>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </Card>
  );
}
