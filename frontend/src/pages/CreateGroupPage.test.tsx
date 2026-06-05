import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateGroupPage from './CreateGroupPage';

// Mock the groups service so createGroup is controllable per test without
// touching the network or auth tokens (mirrors GroupsPage.test.tsx).
vi.mock('../lib/groupsService.js', () => ({
  createGroup: vi.fn(),
}));

// Keep the real react-router exports (MemoryRouter etc.), stub only useNavigate.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { createGroup } from '../lib/groupsService.js';
const mockCreateGroup = vi.mocked(createGroup);

function renderPage() {
  return render(
    <MemoryRouter>
      <CreateGroupPage />
    </MemoryRouter>
  );
}

describe('CreateGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the page heading and the CreateGroupForm', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Create Group' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Group Name/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
  });

  it('calls createGroup with the form values then navigates to /groups on success', async () => {
    mockCreateGroup.mockResolvedValue(undefined);
    renderPage();

    // The identifier auto-slugs from the name ('My Group' -> 'my-group').
    fireEvent.change(screen.getByLabelText(/Group Name/), {
      target: { value: 'My Group' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    });

    expect(mockCreateGroup).toHaveBeenCalledWith({
      name: 'My Group',
      identifier: 'my-group',
      description: '',
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });
  });

  it('navigates back to /groups when the form is cancelled', () => {
    renderPage();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(mockNavigate).toHaveBeenCalledWith('/groups');
    expect(mockCreateGroup).not.toHaveBeenCalled();
  });

  it('surfaces the form error toast and does not navigate when createGroup rejects', async () => {
    mockCreateGroup.mockRejectedValue(new Error('Name already taken'));
    renderPage();

    fireEvent.change(screen.getByLabelText(/Group Name/), {
      target: { value: 'My Group' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    });

    const toast = await screen.findByRole('status');
    expect(toast).toBeInTheDocument();
    expect(screen.getByText('Name already taken')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
