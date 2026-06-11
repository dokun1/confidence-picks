import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageContainer from './PageContainer';

describe('PageContainer', () => {
  it('renders children centered at the default wide width', () => {
    const { container } = render(<PageContainer>content</PageContainer>);
    const el = container.firstChild as HTMLElement;
    expect(screen.getByText('content')).toBeInTheDocument();
    expect(el).toHaveClass('mx-auto');
    expect(el).toHaveClass('max-w-6xl');
  });

  it('maps width tiers to max-width classes', () => {
    const { container, rerender } = render(<PageContainer width="narrow">x</PageContainer>);
    expect(container.firstChild).toHaveClass('max-w-2xl');
    rerender(<PageContainer width="medium">x</PageContainer>);
    expect(container.firstChild).toHaveClass('max-w-4xl');
  });

  it('forwards extra className', () => {
    const { container } = render(<PageContainer className="space-y-lg">x</PageContainer>);
    expect(container.firstChild).toHaveClass('space-y-lg');
  });
});
