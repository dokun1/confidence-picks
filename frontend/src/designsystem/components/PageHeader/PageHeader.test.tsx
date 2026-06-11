import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import PageHeader from './PageHeader';

describe('PageHeader', () => {
  it('renders the title as a level-1 heading', () => {
    render(<PageHeader title="My Groups" />);
    expect(screen.getByRole('heading', { level: 1, name: 'My Groups' })).toBeInTheDocument();
  });

  it('renders the description when provided', () => {
    render(<PageHeader title="T" description="Manage your groups" />);
    expect(screen.getByText('Manage your groups')).toBeInTheDocument();
  });

  it('renders eyebrow and actions slots', () => {
    render(
      <PageHeader
        title="T"
        eyebrow={<a href="/groups">Back</a>}
        actions={<button type="button">New</button>}
      />
    );
    expect(screen.getByRole('link', { name: 'Back' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New' })).toBeInTheDocument();
  });

  it('omits description, eyebrow and actions when not given', () => {
    render(<PageHeader title="T" />);
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
