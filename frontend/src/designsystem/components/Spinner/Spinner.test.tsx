import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Spinner from './Spinner';

describe('Spinner', () => {
  it('renders an accessible status region', () => {
    render(<Spinner />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('announces a default sr-only label when none is given', () => {
    render(<Spinner />);
    expect(screen.getByText('Loading…')).toBeInTheDocument();
  });

  it('renders a visible label when provided', () => {
    render(<Spinner label="Loading groups…" />);
    expect(screen.getByText('Loading groups…')).toBeInTheDocument();
  });

  it('applies size classes to the ring', () => {
    const { container } = render(<Spinner size="lg" />);
    const ring = container.querySelector('[aria-hidden="true"]');
    expect(ring).toHaveClass('h-12');
    expect(ring).toHaveClass('animate-spin');
  });
});
