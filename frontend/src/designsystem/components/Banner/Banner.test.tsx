import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Banner from './Banner';

describe('Banner', () => {
  it('renders its message', () => {
    render(<Banner variant="warning">You have 3 picks to make</Banner>);
    expect(screen.getByText('You have 3 picks to make')).toBeInTheDocument();
  });

  it('applies the variant palette', () => {
    render(<Banner variant="warning">heads up</Banner>);
    expect(screen.getByRole('status')).toHaveClass('bg-warning-50');
  });

  it('renders a tappable action and fires its handler', () => {
    const onClick = vi.fn();
    render(
      <Banner variant="warning" action={{ label: 'Make your picks', onClick }}>
        You have picks to make
      </Banner>,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Make your picks' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('omits the action button when none is given', () => {
    render(<Banner>just info</Banner>);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('renders no dismiss control by default', () => {
    render(<Banner>heads up</Banner>);
    expect(screen.queryByRole('button', { name: 'Dismiss' })).not.toBeInTheDocument();
  });

  it('calls onDismiss when the dismiss control is clicked', () => {
    const onDismiss = vi.fn();
    render(<Banner onDismiss={onDismiss}>heads up</Banner>);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('does not hide itself on dismiss — the parent owns visibility', () => {
    render(<Banner onDismiss={vi.fn()}>heads up</Banner>);
    fireEvent.click(screen.getByRole('button', { name: 'Dismiss' }));
    expect(screen.getByText('heads up')).toBeInTheDocument();
  });

  it('keeps the action alongside the dismiss control', () => {
    const onClick = vi.fn();
    render(
      <Banner action={{ label: 'Open settings', onClick }} onDismiss={vi.fn()}>
        heads up
      </Banner>,
    );
    expect(screen.getByRole('button', { name: 'Open settings' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Dismiss' })).toBeInTheDocument();
  });
});
