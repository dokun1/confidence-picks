import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import JoinGroupPage from './JoinGroupPage';

// Mock the groups service so joinGroup is controllable per test without
// touching the network or auth tokens (mirrors CreateGroupPage.test.tsx).
vi.mock('../lib/groupsService.js', () => ({
  joinGroup: vi.fn(),
}));

// Keep the real react-router exports (MemoryRouter etc.), stub only useNavigate.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { joinGroup } from '../lib/groupsService.js';
const mockJoinGroup = vi.mocked(joinGroup);

function renderPage() {
  return render(
    <MemoryRouter>
      <JoinGroupPage />
    </MemoryRouter>
  );
}

describe('JoinGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the heading, identifier input, and submit button', () => {
    renderPage();
    expect(screen.getByRole('heading', { name: 'Join Group' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Group ID/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Join Group' })).toBeInTheDocument();
  });

  it('shows an inline validation message and skips the service for an invalid identifier', async () => {
    renderPage();

    fireEvent.change(screen.getByLabelText(/Group ID/), {
      target: { value: 'bad id!' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
    });

    expect(
      screen.getByText('Group ID can only contain letters, numbers, hyphens, and underscores')
    ).toBeInTheDocument();
    expect(mockJoinGroup).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('shows a required-field message and skips the service for a blank identifier', async () => {
    renderPage();

    // Whitespace satisfies the input's `required` constraint (so jsdom submits
    // the form) but trims to empty, exercising the explicit required-field check.
    fireEvent.change(screen.getByLabelText(/Group ID/), {
      target: { value: '   ' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
    });

    expect(screen.getByText('Group ID is required')).toBeInTheDocument();
    expect(mockJoinGroup).not.toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('calls joinGroup with the identifier then navigates to /groups on success', async () => {
    mockJoinGroup.mockResolvedValue(undefined);
    renderPage();

    fireEvent.change(screen.getByLabelText(/Group ID/), {
      target: { value: 'my-group' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
    });

    expect(mockJoinGroup).toHaveBeenCalledWith('my-group');
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });
  });

  it('surfaces an inline error and does not navigate when joinGroup rejects', async () => {
    mockJoinGroup.mockRejectedValue(new Error('Group not found'));
    renderPage();

    fireEvent.change(screen.getByLabelText(/Group ID/), {
      target: { value: 'missing-group' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
    });

    expect(await screen.findByText('Group not found')).toBeInTheDocument();
    expect(mockJoinGroup).toHaveBeenCalledWith('missing-group');
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
