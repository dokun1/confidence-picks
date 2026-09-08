import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import DuesBanner from './DuesBanner';

const BASE = {
  amountCents: 2000,
  collectorName: 'Dana Reyes',
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

  it('renders a Venmo button when a Venmo handle is configured', () => {
    render(<DuesBanner {...BASE} venmoHandle="dana-reyes" />);
    const link = screen.getByRole('link', { name: /Venmo/i });
    expect(link).toHaveAttribute('href', expect.stringContaining('venmo.com/dana-reyes'));
    expect(link).toHaveAttribute('href', expect.stringContaining('amount=20.00'));
  });

  it('renders a Cash App button when a cashtag is configured', () => {
    render(<DuesBanner {...BASE} cashappHandle="danareyes" />);
    const link = screen.getByRole('link', { name: /Cash App/i });
    expect(link).toHaveAttribute('href', 'https://cash.app/$danareyes/20.00');
  });

  it('renders both payment buttons when both are configured', () => {
    render(<DuesBanner {...BASE} venmoHandle="dana" cashappHandle="dana" />);
    expect(screen.getByRole('link', { name: /Venmo/i })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Cash App/i })).toBeInTheDocument();
  });

  it('renders no payment buttons when only free-text instructions exist', () => {
    render(<DuesBanner {...BASE} instructions="Zelle me at 555-0100" />);
    expect(screen.queryByRole('link', { name: /Venmo/i })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /Cash App/i })).not.toBeInTheDocument();
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
