import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PaymentButton from './PaymentButton';

describe('PaymentButton', () => {
  it('renders a Venmo link', () => {
    render(<PaymentButton provider="venmo" href="https://venmo.com/dana?txn=pay" />);
    const link = screen.getByRole('link', { name: /Venmo/i });
    expect(link).toHaveAttribute('href', 'https://venmo.com/dana?txn=pay');
  });

  it('renders a Cash App link', () => {
    render(<PaymentButton provider="cashapp" href="https://cash.app/$dana/20.00" />);
    expect(screen.getByRole('link', { name: /Cash App/i })).toHaveAttribute(
      'href',
      'https://cash.app/$dana/20.00',
    );
  });

  // A disabled-looking button would imply the option exists but is broken.
  // Rendering nothing correctly says "this group does not take Venmo".
  it('renders nothing when there is no link', () => {
    const { container } = render(<PaymentButton provider="venmo" href={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('names the amount in the accessible label when given', () => {
    render(<PaymentButton provider="venmo" href="https://venmo.com/dana" amountLabel="$20.00" />);
    expect(
      screen.getByRole('link', { name: 'Pay $20.00 with Venmo' }),
    ).toBeInTheDocument();
  });

  it('falls back to a generic label without an amount', () => {
    render(<PaymentButton provider="cashapp" href="https://cash.app/$dana" />);
    expect(screen.getByRole('link', { name: 'Pay with Cash App' })).toBeInTheDocument();
  });

  // Opening in a new tab keeps the pool page the user was on; noopener is
  // required whenever target="_blank" points at a third party.
  it('opens in a new tab without leaking the opener', () => {
    render(<PaymentButton provider="venmo" href="https://venmo.com/dana" />);
    const link = screen.getByRole('link', { name: /Venmo/i });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'));
  });

  it('shows the provider name as visible text, not only in the label', () => {
    render(<PaymentButton provider="cashapp" href="https://cash.app/$dana" />);
    expect(screen.getByText('Cash App')).toBeInTheDocument();
  });
});
