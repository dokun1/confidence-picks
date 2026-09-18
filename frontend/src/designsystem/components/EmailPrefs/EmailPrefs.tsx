import { useState } from 'react';
import Button from '../Button';
import Card from '../Card';
import Toggle from '../Toggle';

export interface EmailPrefsValues {
  emailReminders: boolean;
  emailSummaries: boolean;
}

export interface EmailPrefsProps {
  /** Current persisted preferences for the viewing member. */
  values: EmailPrefsValues;
  /** Persist the member's edits. Rejects with an Error whose message is shown. */
  onSave: (values: EmailPrefsValues) => Promise<void>;
}

/**
 * Per-member email preferences for one group.
 *
 * Save-on-button rather than save-on-toggle, matching DuesSettings: two related
 * switches read as one decision, and a single Save makes it obvious when that
 * decision has been recorded. Both default off -- nothing is ever sent to a
 * member who has not acted.
 *
 * Every member sees this regardless of role: these are their own preferences,
 * not group configuration.
 */
export default function EmailPrefs({ values, onSave }: EmailPrefsProps) {
  const [draft, setDraft] = useState<EmailPrefsValues>(values);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [savedAt, setSavedAt] = useState<number | null>(null);

  function patch(next: Partial<EmailPrefsValues>) {
    setDraft((d) => ({ ...d, ...next }));
    setSavedAt(null);
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      await onSave(draft);
      setSavedAt(Date.now());
    } catch (err) {
      // The draft is deliberately left as-is, so a failed save does not throw
      // away what the member just chose.
      setError(err instanceof Error ? err.message : 'Failed to save email settings');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card as="section" padding="lg" className="space-y-md" id="email-prefs">
      <h2 className="text-lg font-heading font-semibold text-[var(--color-text-primary)]">Email</h2>

      <Toggle
        id="email-reminders"
        checked={draft.emailReminders}
        onChange={(next) => patch({ emailReminders: next })}
        label="Send me pick reminders"
        description="One email on game days, about four hours before the first kickoff, if you still have picks to make."
      />

      <Toggle
        id="email-summaries"
        checked={draft.emailSummaries}
        onChange={(next) => patch({ emailSummaries: next })}
        label="Send me weekly summaries"
        description="How everyone did and where the standings landed, the morning after the week's last game."
      />

      <div className="flex items-center gap-sm">
        <Button variant="primary" size="md" loading={saving} onClick={handleSave}>
          Save email settings
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
    </Card>
  );
}
