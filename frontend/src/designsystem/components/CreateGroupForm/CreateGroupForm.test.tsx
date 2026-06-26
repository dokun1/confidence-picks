import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateGroupForm from './CreateGroupForm';

function renderForm(props: Partial<React.ComponentProps<typeof CreateGroupForm>> = {}) {
  const onSubmit = props.onSubmit ?? vi.fn().mockResolvedValue(undefined);
  const onCancel = props.onCancel ?? vi.fn();
  return render(<CreateGroupForm onSubmit={onSubmit} onCancel={onCancel} {...props} />);
}

describe('CreateGroupForm', () => {
  describe('structure', () => {
    it('renders the form heading', () => {
      renderForm();
      expect(screen.getByRole('heading', { name: 'Create New Group' })).toBeInTheDocument();
    });

    it('renders Group Name field', () => {
      renderForm();
      expect(screen.getByLabelText(/Group Name/)).toBeInTheDocument();
    });

    it('renders Group ID field', () => {
      renderForm();
      expect(screen.getByLabelText(/Group ID/)).toBeInTheDocument();
    });

    it('renders Description field', () => {
      renderForm();
      expect(screen.getByLabelText(/Description/)).toBeInTheDocument();
    });

    it('renders Create Group submit button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
    });

    it('renders Cancel button', () => {
      renderForm();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('renders container with correct classes', () => {
      const { container } = renderForm();
      const wrapper = container.firstChild as HTMLElement;
      expect(wrapper).toHaveClass('bg-neutral-0');
      expect(wrapper).toHaveClass('border');
      expect(wrapper).toHaveClass('border-secondary-200');
      expect(wrapper).toHaveClass('rounded-lg');
      expect(wrapper).toHaveClass('p-6');
    });
  });

  describe('member limit', () => {
    it('renders the Member limit field defaulting to 50', () => {
      renderForm();
      expect(screen.getByLabelText('Member limit')).toHaveValue(50);
    });

    it('prefills the Member limit from initialValues (edit mode)', () => {
      renderForm({ initialValues: { maxMembers: 120 } });
      expect(screen.getByLabelText('Member limit')).toHaveValue(120);
    });

    it('submits the chosen member limit', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '250' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ maxMembers: 250 }));
    });

    it('blocks submission and shows an error when the limit exceeds 500', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '600' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/between 2 and 500/)).toBeInTheDocument();
    });

    it('blocks submission and shows an error for a non-integer limit', async () => {
      // step="any" lets a value like 12.5 through native validation so the form's
      // own integer check runs and surfaces the inline error.
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '12.5' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).not.toHaveBeenCalled();
      expect(screen.getByText(/between 2 and 500/)).toBeInTheDocument();
    });

    it('blocks submission when the limit is below 2', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText('Member limit'), { target: { value: '1' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('edit mode locks immutable pool fields', () => {
    it('reflects the World Cup pool type and disables the select', () => {
      renderForm({ initialValues: { identifier: 'g', poolType: 'world_cup_2026' } });
      const select = screen.getByLabelText('Pool Type');
      expect(select).toHaveValue('world_cup_2026');
      expect(select).toBeDisabled();
      expect(screen.getByText(/Pool type can.t be changed after creation/)).toBeInTheDocument();
    });

    it('reflects and locks the knockout-only setting', () => {
      renderForm({ initialValues: { identifier: 'g', poolType: 'world_cup_2026', knockoutOnly: true } });
      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toBeChecked();
      expect(checkbox).toBeDisabled();
    });

    it('keeps the pool type editable when creating a new group', () => {
      renderForm();
      expect(screen.getByLabelText('Pool Type')).not.toBeDisabled();
    });
  });

  describe('auto-slug from name', () => {
    it('auto-fills Group ID from name', () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), {
        target: { value: 'My Awesome Group' },
      });
      expect(screen.getByLabelText(/Group ID/)).toHaveValue('my-awesome-group');
    });

    it('strips invalid characters from auto slug', () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), {
        target: { value: 'Hello! World#' },
      });
      expect(screen.getByLabelText(/Group ID/)).toHaveValue('hello-world');
    });

    it('truncates auto slug to 30 characters', () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), {
        target: { value: 'This is a very long group name that exceeds thirty characters' },
      });
      const identifierValue = (screen.getByLabelText(/Group ID/) as HTMLInputElement).value;
      expect(identifierValue.length).toBeLessThanOrEqual(30);
    });

    it('stops auto-syncing when identifier is manually changed', () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), {
        target: { value: 'Original Name' },
      });
      fireEvent.change(screen.getByLabelText(/Group ID/), {
        target: { value: 'custom-id' },
      });
      fireEvent.change(screen.getByLabelText(/Group Name/), {
        target: { value: 'Updated Name' },
      });
      expect(screen.getByLabelText(/Group ID/)).toHaveValue('custom-id');
    });
  });

  describe('validation', () => {
    function submitForm() {
      // fireEvent.click on a submit button does not reliably trigger form
      // submission in jsdom; submit the form element directly instead.
      const btn = screen.getByRole('button', { name: 'Create Group' });
      fireEvent.submit(btn.closest('form')!);
    }

    it('shows error when name is empty on submit', async () => {
      renderForm();
      submitForm();
      await waitFor(() => {
        expect(screen.getByText('Group name is required')).toBeInTheDocument();
      });
    });

    it('shows error when name is shorter than 3 characters', async () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'ab' } });
      submitForm();
      await waitFor(() => {
        expect(
          screen.getByText('Group name must be at least 3 characters')
        ).toBeInTheDocument();
      });
    });

    it('shows error when name exceeds 50 characters', async () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), {
        target: { value: 'a'.repeat(51) },
      });
      submitForm();
      await waitFor(() => {
        expect(
          screen.getByText('Group name must be 50 characters or less')
        ).toBeInTheDocument();
      });
    });

    it('shows error when identifier is empty on submit', async () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText(/Group ID/), { target: { value: '' } });
      submitForm();
      await waitFor(() => {
        expect(screen.getByText('Group ID is required')).toBeInTheDocument();
      });
    });

    it('shows error when identifier contains invalid characters', async () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText(/Group ID/), { target: { value: 'invalid id!' } });
      submitForm();
      await waitFor(() => {
        expect(
          screen.getByText(
            'Group ID can only contain letters, numbers, hyphens, and underscores'
          )
        ).toBeInTheDocument();
      });
    });

    it('shows error when identifier is shorter than 3 characters', async () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText(/Group ID/), { target: { value: 'ab' } });
      submitForm();
      await waitFor(() => {
        expect(
          screen.getByText('Group ID must be at least 3 characters')
        ).toBeInTheDocument();
      });
    });

    it('shows error when identifier exceeds 30 characters', async () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText(/Group ID/), {
        target: { value: 'a'.repeat(31) },
      });
      submitForm();
      await waitFor(() => {
        expect(
          screen.getByText('Group ID must be 30 characters or less')
        ).toBeInTheDocument();
      });
    });

    it('shows error when description exceeds 200 characters', async () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'Valid Name' } });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'a'.repeat(201) },
      });
      submitForm();
      await waitFor(() => {
        expect(
          screen.getByText('Description must be 200 characters or less')
        ).toBeInTheDocument();
      });
    });

    it('does not call onSubmit when validation fails', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      submitForm();
      await waitFor(() => {
        expect(screen.getByText('Group name is required')).toBeInTheDocument();
      });
      expect(onSubmit).not.toHaveBeenCalled();
    });
  });

  describe('successful submission', () => {
    it('calls onSubmit with form values on valid submit', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText(/Description/), {
        target: { value: 'A cool group' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).toHaveBeenCalledWith({
        name: 'My Group',
        identifier: 'my-group',
        description: 'A cool group',
        poolType: 'nfl_weekly',
        knockoutOnly: false,
        maxMembers: 50,
      });
    });

    it('shows success toast after successful submission', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('Group created!')).toBeInTheDocument();
      });
    });
  });

  describe('pool type selector', () => {
    it('renders the Pool Type selector defaulting to nfl_weekly', () => {
      renderForm();
      expect(screen.getByLabelText(/Pool Type/)).toHaveValue('nfl_weekly');
    });

    it('honors initialValues.poolType', () => {
      renderForm({ initialValues: { poolType: 'world_cup_2026' } });
      expect(screen.getByLabelText(/Pool Type/)).toHaveValue('world_cup_2026');
    });

    it('switches to world_cup_2026 when selected', () => {
      renderForm();
      fireEvent.change(screen.getByLabelText(/Pool Type/), {
        target: { value: 'world_cup_2026' },
      });
      expect(screen.getByLabelText(/Pool Type/)).toHaveValue('world_cup_2026');
    });

    it('includes the default poolType in the onSubmit payload', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ poolType: 'nfl_weekly' })
      );
    });

    it('includes the switched poolType in the onSubmit payload', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.change(screen.getByLabelText(/Pool Type/), {
        target: { value: 'world_cup_2026' },
      });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ poolType: 'world_cup_2026' })
      );
    });
  });

  describe('knockout-only setting (World Cup sub-setting)', () => {
    const knockoutLabel = /Knockout stage picks only/;

    it('is hidden for an NFL pool', () => {
      renderForm();
      expect(screen.queryByLabelText(knockoutLabel)).not.toBeInTheDocument();
    });

    it('appears only after switching the pool type to World Cup', () => {
      renderForm();
      expect(screen.queryByLabelText(knockoutLabel)).not.toBeInTheDocument();
      fireEvent.change(screen.getByLabelText(/Pool Type/), {
        target: { value: 'world_cup_2026' },
      });
      expect(screen.getByLabelText(knockoutLabel)).toBeInTheDocument();
    });

    it('shows the toggle (unchecked) when initialValues select World Cup', () => {
      renderForm({ initialValues: { poolType: 'world_cup_2026' } });
      const checkbox = screen.getByLabelText(knockoutLabel) as HTMLInputElement;
      expect(checkbox).toBeInTheDocument();
      expect(checkbox.checked).toBe(false);
    });

    it('honors initialValues.knockoutOnly', () => {
      renderForm({ initialValues: { poolType: 'world_cup_2026', knockoutOnly: true } });
      expect((screen.getByLabelText(knockoutLabel) as HTMLInputElement).checked).toBe(true);
    });

    it('submits knockoutOnly=true when checked for a World Cup pool', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'KO Crew' } });
      fireEvent.change(screen.getByLabelText(/Pool Type/), {
        target: { value: 'world_cup_2026' },
      });
      fireEvent.click(screen.getByLabelText(knockoutLabel));
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ poolType: 'world_cup_2026', knockoutOnly: true }),
      );
    });

    it('clears knockoutOnly when switching back to NFL after checking it', async () => {
      const onSubmit = vi.fn().mockResolvedValue(undefined);
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'Switcher' } });
      fireEvent.change(screen.getByLabelText(/Pool Type/), {
        target: { value: 'world_cup_2026' },
      });
      fireEvent.click(screen.getByLabelText(knockoutLabel));
      // Switch back to NFL — the toggle disappears and must not travel with the pool.
      fireEvent.change(screen.getByLabelText(/Pool Type/), {
        target: { value: 'nfl_weekly' },
      });
      expect(screen.queryByLabelText(knockoutLabel)).not.toBeInTheDocument();
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      expect(onSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ poolType: 'nfl_weekly', knockoutOnly: false }),
      );
    });
  });

  describe('failed submission', () => {
    it('shows error toast when onSubmit rejects', async () => {
      const onSubmit = vi.fn().mockRejectedValue(new Error('Name already taken'));
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      await act(async () => {
        fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      });
      await waitFor(() => {
        expect(screen.getByRole('status')).toBeInTheDocument();
        expect(screen.getByText('Name already taken')).toBeInTheDocument();
      });
    });
  });

  describe('loading state', () => {
    it('disables buttons while loading', async () => {
      let resolveSubmit!: () => void;
      const onSubmit = vi.fn(
        () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
      );
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

      await waitFor(() => {
        expect(screen.getByRole('button', { name: /Creating/ })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
      });

      await act(async () => { resolveSubmit(); });
    });

    it('shows "Creating..." text while loading', async () => {
      let resolveSubmit!: () => void;
      const onSubmit = vi.fn(
        () => new Promise<void>((resolve) => { resolveSubmit = resolve; })
      );
      renderForm({ onSubmit });
      fireEvent.change(screen.getByLabelText(/Group Name/), { target: { value: 'My Group' } });
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));

      await waitFor(() => {
        expect(screen.getByText('Creating...')).toBeInTheDocument();
      });

      await act(async () => { resolveSubmit(); });
    });
  });

  describe('cancel behavior', () => {
    it('calls onCancel when Cancel is clicked', () => {
      const onCancel = vi.fn();
      renderForm({ onCancel });
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onCancel).toHaveBeenCalledOnce();
    });
  });

  describe('initialValues', () => {
    it('pre-fills the name field', () => {
      renderForm({ initialValues: { name: 'Pre-filled Name' } });
      expect(screen.getByLabelText(/Group Name/)).toHaveValue('Pre-filled Name');
    });

    it('pre-fills the identifier field', () => {
      renderForm({ initialValues: { name: 'My Group', identifier: 'locked-id' } });
      expect(screen.getByLabelText(/Group ID/)).toHaveValue('locked-id');
    });

    it('pre-fills the description field', () => {
      renderForm({ initialValues: { name: 'My Group', description: 'Pre-filled description' } });
      expect(screen.getByLabelText(/Description/)).toHaveValue('Pre-filled description');
    });

    it('disables Group ID field when initialValues.identifier is set', () => {
      renderForm({ initialValues: { name: 'My Group', identifier: 'locked-id' } });
      expect(screen.getByLabelText(/Group ID/)).toBeDisabled();
    });

    it('shows locked hint when initialValues.identifier is set', () => {
      renderForm({ initialValues: { name: 'My Group', identifier: 'locked-id' } });
      expect(
        screen.getByText('Group ID cannot be changed after creation.')
      ).toBeInTheDocument();
    });

    it('shows share hint when initialValues.identifier is not set', () => {
      renderForm();
      expect(
        screen.getByText('This will be used to share your group with others. It must be unique.')
      ).toBeInTheDocument();
    });

    it('does not auto-sync identifier from name when initialValues.identifier is set', () => {
      renderForm({ initialValues: { name: 'My Group', identifier: 'locked-id' } });
      fireEvent.change(screen.getByLabelText(/Group Name/), {
        target: { value: 'Updated Name' },
      });
      expect(screen.getByLabelText(/Group ID/)).toHaveValue('locked-id');
    });
  });
});
