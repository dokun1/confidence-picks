import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Card from './Card';

describe('Card', () => {
  it('renders children', () => {
    render(<Card>Card body</Card>);
    expect(screen.getByText('Card body')).toBeInTheDocument();
  });

  it('applies surface, border, and rounding classes', () => {
    const { container } = render(<Card>x</Card>);
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('bg-neutral-0');
    expect(el).toHaveClass('border');
    expect(el).toHaveClass('border-border');
    expect(el).toHaveClass('rounded-xl');
  });

  it('applies the default lg padding and overrides via prop', () => {
    const { container, rerender } = render(<Card>x</Card>);
    expect(container.firstChild).toHaveClass('p-lg');
    rerender(<Card padding="none">x</Card>);
    expect(container.firstChild).not.toHaveClass('p-lg');
  });

  it('renders the requested element via `as`', () => {
    const { container } = render(<Card as="section">x</Card>);
    expect((container.firstChild as HTMLElement).tagName).toBe('SECTION');
  });

  it('forwards extra className and props', () => {
    const { container } = render(
      <Card className="custom" data-testid="c">
        x
      </Card>
    );
    const el = container.firstChild as HTMLElement;
    expect(el).toHaveClass('custom');
    expect(el).toHaveAttribute('data-testid', 'c');
  });
});
