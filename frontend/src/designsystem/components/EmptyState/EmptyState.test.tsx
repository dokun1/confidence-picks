import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import EmptyState from './EmptyState';

describe('EmptyState', () => {
  it('renders the title as a heading', () => {
    render(<EmptyState title="No groups yet" />);
    expect(screen.getByRole('heading', { name: 'No groups yet' })).toBeInTheDocument();
  });

  it('renders description and action when provided', () => {
    render(
      <EmptyState
        title="No groups yet"
        description="Create one to get started."
        action={<button type="button">Create Group</button>}
      />
    );
    expect(screen.getByText('Create one to get started.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
  });

  it('renders an icon badge when provided', () => {
    render(<EmptyState title="Empty" icon={<svg data-testid="ico" />} />);
    expect(screen.getByTestId('ico')).toBeInTheDocument();
  });

  it('omits action when not provided', () => {
    render(<EmptyState title="Empty" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });
});
