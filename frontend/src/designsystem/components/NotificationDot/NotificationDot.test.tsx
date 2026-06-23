import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import NotificationDot from './NotificationDot';

describe('NotificationDot', () => {
  it('exposes its label to assistive tech', () => {
    render(<NotificationDot label="Picks available to make" />);
    expect(screen.getByRole('status', { name: 'Picks available to make' })).toBeInTheDocument();
  });

  it('defaults to the small size and the error color token', () => {
    render(<NotificationDot label="Unread messages" />);
    const dot = screen.getByRole('status');
    expect(dot).toHaveClass('h-2', 'w-2', 'rounded-full', 'bg-error-500');
  });

  it('renders the medium size when asked', () => {
    render(<NotificationDot label="Unread messages" size="md" />);
    expect(screen.getByRole('status')).toHaveClass('h-2.5', 'w-2.5');
  });

  it('merges positioning classes and a test id', () => {
    render(
      <NotificationDot
        label="Unread messages"
        className="absolute -top-0.5 -right-1.5"
        data-testid="chat-unread-indicator"
      />,
    );
    const dot = screen.getByTestId('chat-unread-indicator');
    expect(dot).toHaveClass('absolute', '-top-0.5', '-right-1.5', 'bg-error-500');
  });
});
