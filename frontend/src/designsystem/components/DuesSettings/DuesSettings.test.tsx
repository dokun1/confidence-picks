import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DuesSettings from './DuesSettings';
import type { DuesSettingsValues } from './DuesSettings';

const MEMBERS = [
  { id: '1', name: 'Dana Reyes', pictureUrl: null, duesPaidAt: '2026-09-01T00:00:00Z' },
  { id: '2', name: 'Sam Cole', pictureUrl: null, duesPaidAt: null },
];

const ON: DuesSettingsValues = {
  duesEnabled: true,
  duesPaymentMethod: 'venmo',
  duesAmountCents: 2000,
  duesVenmoHandle: 'dana-reyes',
  duesCashappHandle: null,
  duesInstructions: null,
  duesCollectorUserId: 1,
};

const OFF: DuesSettingsValues = {
  duesEnabled: false,
  duesPaymentMethod: null,
  duesAmountCents: null,
  duesVenmoHandle: null,
  duesCashappHandle: null,
  duesInstructions: null,
  duesCollectorUserId: null,
};

function setup(overrides: Partial<React.ComponentProps<typeof DuesSettings>> = {}) {
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onToggleMemberPaid = vi.fn().mockResolvedValue(undefined);
  render(
    <DuesSettings
      isAdmin
      values={ON}
      collectorName="Dana Reyes"
      members={MEMBERS}
      onSave={onSave}
      onToggleMemberPaid={onToggleMemberPaid}
      {...overrides}
    />,
  );
  return { onSave, onToggleMemberPaid };
}

describe('DuesSettings', () => {
  describe('visibility', () => {
    // An empty "Dues" heading on a group that doesn't collect them is noise.
    it('renders nothing for a member when dues are off', () => {
      const { container } = render(
        <DuesSettings
          isAdmin={false}
          values={OFF}
          collectorName={null}
          members={MEMBERS}
          onSave={vi.fn()}
          onToggleMemberPaid={vi.fn()}
        />,
      );
      expect(container).toBeEmptyDOMElement();
    });

    it('still renders for an admin when dues are off, so they can turn them on', () => {
      setup({ values: OFF });
      expect(screen.getByRole('switch', { name: /Require dues/i })).toBeInTheDocument();
    });

    it('hides the config form from non-admins', () => {
      setup({ isAdmin: false });
      expect(screen.queryByRole('switch')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Save dues/i })).not.toBeInTheDocument();
    });
  });

  describe('single payment method', () => {
    it('shows only the Venmo field when Venmo is selected', () => {
      setup();
      expect(screen.getByLabelText('Venmo username')).toBeInTheDocument();
      expect(screen.queryByLabelText('Cash App cashtag')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Payment instructions')).not.toBeInTheDocument();
    });

    it('swaps to the Cash App field when the method changes', async () => {
      setup();
      await userEvent.selectOptions(screen.getByLabelText('How do members pay?'), 'cashapp');
      expect(screen.getByLabelText('Cash App cashtag')).toBeInTheDocument();
      expect(screen.queryByLabelText('Venmo username')).not.toBeInTheDocument();
    });

    it('swaps to free-text instructions for the "other" method', async () => {
      setup();
      await userEvent.selectOptions(screen.getByLabelText('How do members pay?'), 'other');
      expect(screen.getByLabelText('Payment instructions')).toBeInTheDocument();
      expect(screen.queryByLabelText('Venmo username')).not.toBeInTheDocument();
    });

    it('renders exactly one payment button, matching the saved method', () => {
      setup();
      expect(screen.getByRole('link', { name: /Venmo/i })).toBeInTheDocument();
      expect(screen.queryByRole('link', { name: /Cash App/i })).not.toBeInTheDocument();
    });

    // Asserted from the member's view: an admin sees the same string twice
    // (once as the textarea's value, once in the read-only block), and it is
    // the read-only block that members actually rely on.
    it('renders instructions and no payment button for the free-text method', () => {
      setup({
        isAdmin: false,
        values: { ...ON, duesPaymentMethod: 'other', duesVenmoHandle: null, duesInstructions: 'Zelle 555-0100' },
      });
      expect(screen.queryByRole('link', { name: /Venmo|Cash App/i })).not.toBeInTheDocument();
      expect(screen.getByText('Zelle 555-0100')).toBeInTheDocument();
    });

    it('tells members when no method is configured yet', () => {
      setup({ values: { ...ON, duesPaymentMethod: null, duesVenmoHandle: null } });
      expect(screen.getByText(/has not set up a payment method/i)).toBeInTheDocument();
    });
  });

  describe('saving', () => {
    it('converts the dollar input to integer cents', async () => {
      const { onSave } = setup();
      const amount = screen.getByLabelText('Amount per member (USD)');
      await userEvent.clear(amount);
      await userEvent.type(amount, '35.50');
      await userEvent.click(screen.getByRole('button', { name: /Save dues/i }));
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ duesAmountCents: 3550 })),
      );
    });

    it('accepts a bare dollar amount with no cents', async () => {
      const { onSave } = setup();
      const amount = screen.getByLabelText('Amount per member (USD)');
      await userEvent.clear(amount);
      await userEvent.type(amount, '20');
      await userEvent.click(screen.getByRole('button', { name: /Save dues/i }));
      await waitFor(() =>
        expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ duesAmountCents: 2000 })),
      );
    });

    it('rejects a non-numeric amount without calling onSave', async () => {
      const { onSave } = setup();
      const amount = screen.getByLabelText('Amount per member (USD)');
      await userEvent.clear(amount);
      await userEvent.type(amount, 'twenty');
      await userEvent.click(screen.getByRole('button', { name: /Save dues/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/as a number/i);
      expect(onSave).not.toHaveBeenCalled();
    });

    it('rejects a zero or negative amount', async () => {
      const { onSave } = setup();
      const amount = screen.getByLabelText('Amount per member (USD)');
      await userEvent.clear(amount);
      await userEvent.type(amount, '0');
      await userEvent.click(screen.getByRole('button', { name: /Save dues/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent(/greater than zero/i);
      expect(onSave).not.toHaveBeenCalled();
    });

    it('surfaces a save failure to the admin', async () => {
      const onSave = vi.fn().mockRejectedValue(new Error('Venmo username is invalid'));
      render(
        <DuesSettings
          isAdmin
          values={ON}
          collectorName="Dana Reyes"
          members={MEMBERS}
          onSave={onSave}
          onToggleMemberPaid={vi.fn()}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: /Save dues/i }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Venmo username is invalid');
    });
  });

  describe('who has paid', () => {
    it('shows each member with their paid state', () => {
      setup();
      expect(screen.getByText('Paid')).toBeInTheDocument();
      expect(screen.getByText('Unpaid')).toBeInTheDocument();
    });

    // Unpaid is the row an admin has to act on, so it must be scannable at a
    // glance rather than sitting in the same neutral grey as Paid.
    it('gives the unpaid badge a destructive tone that paid does not have', () => {
      setup();
      const unpaid = screen.getByText('Unpaid');
      const paid = screen.getByText('Paid');
      expect(unpaid.className).toMatch(/bg-error-/);
      expect(paid.className).not.toMatch(/bg-error-/);
    });

    // The word carries the meaning, so a viewer who cannot distinguish the
    // colours still reads the state.
    it('states the status in text, not colour alone', () => {
      setup();
      expect(screen.getByText('Unpaid')).toHaveTextContent('Unpaid');
    });

    it('summarises how many have paid', () => {
      setup();
      expect(screen.getByText('1 of 2 paid')).toBeInTheDocument();
    });

    it('lets an admin mark an unpaid member paid', async () => {
      const { onToggleMemberPaid } = setup();
      await userEvent.click(screen.getByRole('button', { name: 'Mark Sam Cole paid' }));
      expect(onToggleMemberPaid).toHaveBeenCalledWith('2', true);
    });

    it('lets an admin reverse a paid member', async () => {
      const { onToggleMemberPaid } = setup();
      await userEvent.click(screen.getByRole('button', { name: 'Mark Dana Reyes unpaid' }));
      expect(onToggleMemberPaid).toHaveBeenCalledWith('1', false);
    });

    it('gives members no way to mark anyone paid', () => {
      setup({ isAdmin: false });
      expect(screen.queryByRole('button', { name: /Mark .* paid/i })).not.toBeInTheDocument();
    });

    it('marks the viewer\'s own row', () => {
      setup({ currentUserId: '2' });
      expect(screen.getByText('(you)')).toBeInTheDocument();
    });

    it('surfaces a failure to flip a member', async () => {
      const onToggleMemberPaid = vi.fn().mockRejectedValue(new Error('Not authorized'));
      render(
        <DuesSettings
          isAdmin
          values={ON}
          collectorName="Dana Reyes"
          members={MEMBERS}
          onSave={vi.fn()}
          onToggleMemberPaid={onToggleMemberPaid}
        />,
      );
      await userEvent.click(screen.getByRole('button', { name: 'Mark Sam Cole paid' }));
      expect(await screen.findByRole('alert')).toHaveTextContent('Not authorized');
    });
  });
});
