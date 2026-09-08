import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import Toggle from './Toggle';

describe('Toggle', () => {
  // role="switch" (not checkbox) is what tells a screen reader the change takes
  // effect immediately rather than on form submit — which is the real behavior.
  it('exposes itself as a switch', () => {
    render(<Toggle checked={false} onChange={() => {}} label="Require dues" />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('reflects the checked state to assistive tech', () => {
    const { rerender } = render(
      <Toggle checked={false} onChange={() => {}} label="Require dues" />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'false');

    rerender(<Toggle checked onChange={() => {}} label="Require dues" />);
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true');
  });

  it('renders the label and description', () => {
    render(
      <Toggle
        checked={false}
        onChange={() => {}}
        label="Require dues"
        description="Unpaid members see a banner."
      />,
    );
    expect(screen.getByText('Require dues')).toBeInTheDocument();
    expect(screen.getByText('Unpaid members see a banner.')).toBeInTheDocument();
  });

  it('requests the opposite state when clicked', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Require dues" />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });

  it('requests off when clicked while on', async () => {
    const onChange = vi.fn();
    render(<Toggle checked onChange={onChange} label="Require dues" />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(false);
  });

  it('does not fire when disabled', async () => {
    const onChange = vi.fn();
    render(<Toggle checked={false} onChange={onChange} label="Require dues" disabled />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('associates the description with the switch when an id is given', () => {
    render(
      <Toggle
        id="dues"
        checked={false}
        onChange={() => {}}
        label="Require dues"
        description="Unpaid members see a banner."
      />,
    );
    expect(screen.getByRole('switch')).toHaveAttribute('aria-describedby', 'dues-description');
  });
});
