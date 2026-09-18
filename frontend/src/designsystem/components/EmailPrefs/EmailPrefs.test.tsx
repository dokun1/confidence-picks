import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import EmailPrefs from './EmailPrefs';

// Props-in / callback-out, no service mocking — the CreateGroupForm.test.tsx
// model for a presentational settings panel.

function renderPanel(props: Partial<React.ComponentProps<typeof EmailPrefs>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const utils = render(
    <EmailPrefs
      values={{ emailReminders: false, emailSummaries: false }}
      onSave={onSave}
      {...props}
    />,
  );
  return { onSave, ...utils };
}

describe('EmailPrefs', () => {
  it('reflects the persisted values', () => {
    renderPanel({ values: { emailReminders: true, emailSummaries: false } });
    expect(screen.getByRole('switch', { name: /pick reminders/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
    expect(screen.getByRole('switch', { name: /weekly summaries/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('defaults both switches off', () => {
    renderPanel();
    expect(screen.getByRole('switch', { name: /pick reminders/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
    expect(screen.getByRole('switch', { name: /weekly summaries/i })).toHaveAttribute(
      'aria-checked',
      'false',
    );
  });

  it('does not save until the button is pressed', () => {
    const { onSave } = renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: /pick reminders/i }));
    expect(onSave).not.toHaveBeenCalled();
  });

  it('saves the edited draft', async () => {
    const { onSave } = renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: /pick reminders/i }));
    fireEvent.click(screen.getByRole('button', { name: /save email settings/i }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ emailReminders: true, emailSummaries: false }),
    );
  });

  it('saves both switches together', async () => {
    const { onSave } = renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: /pick reminders/i }));
    fireEvent.click(screen.getByRole('switch', { name: /weekly summaries/i }));
    fireEvent.click(screen.getByRole('button', { name: /save email settings/i }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ emailReminders: true, emailSummaries: true }),
    );
  });

  it('shows a confirmation after a successful save', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('switch', { name: /weekly summaries/i }));
    fireEvent.click(screen.getByRole('button', { name: /save email settings/i }));
    expect(await screen.findByText('Saved')).toBeInTheDocument();
  });

  it('clears the confirmation once the draft changes again', async () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: /save email settings/i }));
    await screen.findByText('Saved');
    fireEvent.click(screen.getByRole('switch', { name: /pick reminders/i }));
    expect(screen.queryByText('Saved')).not.toBeInTheDocument();
  });

  it('surfaces a save failure without losing the draft', async () => {
    const onSave = vi.fn().mockRejectedValue(new Error('Network down'));
    render(
      <EmailPrefs values={{ emailReminders: false, emailSummaries: false }} onSave={onSave} />,
    );

    fireEvent.click(screen.getByRole('switch', { name: /pick reminders/i }));
    fireEvent.click(screen.getByRole('button', { name: /save email settings/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Network down');
    expect(screen.getByRole('switch', { name: /pick reminders/i })).toHaveAttribute(
      'aria-checked',
      'true',
    );
  });

  it('anchors the section so the announcement banner can deeplink to it', () => {
    const { container } = renderPanel();
    expect(container.querySelector('#email-prefs')).not.toBeNull();
  });
});
