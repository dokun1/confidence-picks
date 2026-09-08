import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DuesBanner from './DuesBanner';

const BASE = {
  amountCents: 2000,
  collectorName: 'Dana Reyes',
  paymentMethod: null,
  venmoHandle: null,
  cashappHandle: null,
  instructions: null,
  onViewDetails: () => {},
};

describe('DuesBanner', () => {
  it('states the amount owed', () => {
    render(<DuesBanner {...BASE} />);
    expect(screen.getByText(/\$20\.00/)).toBeInTheDocument();
  });

  it('names the collector so the payer knows who they are paying', () => {
    render(<DuesBanner {...BASE} />);
    expect(screen.getByText(/Dana Reyes/)).toBeInTheDocument();
  });

  it('omits the collector clause when no collector is set', () => {
    render(<DuesBanner {...BASE} collectorName={null} />);
    expect(screen.getByText(/You owe \$20\.00 in dues/)).toBeInTheDocument();
  });

  it('renders a Venmo button when Venmo is the chosen method', () => {
    render(<DuesBanner {...BASE} paymentMethod="venmo" venmoHandle="dana-reyes" />);
    const link = screen.getByRole('link', { name: /Venmo/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('venmo.com/dana-reyes'));
    expect(link).toHaveAttribute('href', expect.stringContaining('amount=20.00'));
  });

  it('renders a Cash App button when Cash App is the chosen method', () => {
    render(<DuesBanner {...BASE} paymentMethod="cashapp" cashappHandle="danareyes" />);
    const link = screen.getByRole('link', { name: /Cash App/i });
    expect(link).toHaveAttribute('href', 'https://cash.app/$danareyes/20.00');
  });

  // A group collects dues one way. Even with a stale handle left over from a
  // previously-selected method, only the chosen method's button may appear.
  it('renders exactly one payment button, never both', () => {
    render(
      <DuesBanner {...BASE} paymentMethod="venmo" venmoHandle="dana" cashappHandle="dana" />,
    );
    expect(screen.getByRole('link', { name: /Venmo/i })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Cash App/i })).not.toBeInTheDocument();
  });

  it('renders no payment button for the free-text method', () => {
    render(
      <DuesBanner {...BASE} paymentMethod="other" instructions="Zelle me at 555-0100" />,
    );
    expect(screen.queryByRole('link', { name: /Venmo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Cash App/i })).not.toBeInTheDocument();
    expect(screen.getByText(/See details for how to pay/)).toBeInTheDocument();
  });

  it('renders no payment button when no method is chosen', () => {
    render(<DuesBanner {...BASE} venmoHandle="dana" />);
    expect(screen.queryByRole('link', { name: /Venmo/i })).not.toBeInTheDocument();
  });

  it('always offers a way through to the details', async () => {
    const onViewDetails = vi.fn();
    render(<DuesBanner {...BASE} onViewDetails={onViewDetails} />);
    await userEvent.click(screen.getByRole('button', { name: /details/i }));
    expect(onViewDetails).toHaveBeenCalledOnce();
  });

  it('renders nothing when there is no amount to collect', () => {
    const { container } = render(<DuesBanner {...BASE} amountCents={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});
