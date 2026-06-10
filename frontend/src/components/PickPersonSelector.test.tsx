import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import PickPersonSelector, { type PickPersonOption } from './PickPersonSelector';

// PickPersonSelector is the single-select "whose picks am I looking at?" dropdown
// for the World Cup picks tab. These tests pin its contract: the caller is always
// listed first as "You", every member is selectable for VIEWING, and the per-row
// hint reflects whether the caller can edit (admin) or only view (non-admin) —
// but selection itself is never gated here (write authority is the parent's job).

const members: PickPersonOption[] = [
  { id: '1', name: 'Ada Lovelace', email: 'ada@example.com' },
  { id: '2', name: 'Bob Stone', email: 'bob@example.com' },
  { id: '3', name: 'Carol King', email: 'carol@example.com' },
];

function open() {
  fireEvent.click(screen.getByRole('button', { name: 'Choose whose picks to view or edit' }));
}

describe('PickPersonSelector', () => {
  it('labels the button with "You" when the caller is selected', () => {
    render(
      <PickPersonSelector
        members={members}
        selectedId="1"
        currentUserId="1"
        isAdmin={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Choose whose picks/ })).toHaveTextContent(
      'Picking for: You',
    );
  });

  it('labels the button with the member name when a teammate is selected', () => {
    render(
      <PickPersonSelector
        members={members}
        selectedId="2"
        currentUserId="1"
        isAdmin={false}
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('button', { name: /Choose whose picks/ })).toHaveTextContent(
      'Picking for: Bob Stone',
    );
  });

  it('lists the caller first as "(you)" regardless of roster order', () => {
    // Caller is id 3 (Carol) — last alphabetically — but must still float to the top.
    render(
      <PickPersonSelector
        members={members}
        selectedId="3"
        currentUserId="3"
        isAdmin={false}
        onChange={vi.fn()}
      />,
    );
    open();
    const options = screen.getAllByRole('radio');
    expect(within(options[0].closest('label') as HTMLElement).getByText(/\(you\)/)).toBeInTheDocument();
    // The selected caller radio is checked.
    expect(options[0]).toBeChecked();
  });

  it('shows an "edit" hint on teammates for an admin', () => {
    render(
      <PickPersonSelector
        members={members}
        selectedId="1"
        currentUserId="1"
        isAdmin
        onChange={vi.fn()}
      />,
    );
    open();
    // Two teammates -> two "edit" hints, none on the caller's own row.
    expect(screen.getAllByText('edit')).toHaveLength(2);
    expect(screen.queryByText('view only')).not.toBeInTheDocument();
  });

  it('shows a "view only" hint on teammates for a non-admin', () => {
    render(
      <PickPersonSelector
        members={members}
        selectedId="1"
        currentUserId="1"
        isAdmin={false}
        onChange={vi.fn()}
      />,
    );
    open();
    expect(screen.getAllByText('view only')).toHaveLength(2);
    expect(screen.queryByText('edit')).not.toBeInTheDocument();
  });

  it('reports the chosen member id and closes on selection', () => {
    const onChange = vi.fn();
    render(
      <PickPersonSelector
        members={members}
        selectedId="1"
        currentUserId="1"
        isAdmin
        onChange={onChange}
      />,
    );
    open();
    fireEvent.click(screen.getByRole('radio', { name: 'Bob Stone' }));
    expect(onChange).toHaveBeenCalledWith('2');
    // The popover closed after choosing.
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('does not open when disabled', () => {
    render(
      <PickPersonSelector
        members={members}
        selectedId="1"
        currentUserId="1"
        isAdmin
        onChange={vi.fn()}
        disabled
      />,
    );
    open();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });
});
