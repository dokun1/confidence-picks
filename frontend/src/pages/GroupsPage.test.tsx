import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GroupsPage from './GroupsPage';
import type { GroupData } from '../designsystem/components/GroupCard/GroupCard';

// Mock the groups service so getMyGroups (and the action calls GroupsPage may
// reach) are controllable per test without touching the network or auth tokens.
vi.mock('../lib/groupsService.js', () => ({
  getMyGroups: vi.fn(),
  leaveGroup: vi.fn(),
  deleteGroup: vi.fn(),
}));

// Keep the real react-router exports (MemoryRouter etc.), stub only useNavigate.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { getMyGroups, leaveGroup, deleteGroup } from '../lib/groupsService.js';
const mockGetMyGroups = vi.mocked(getMyGroups);
const mockLeaveGroup = vi.mocked(leaveGroup);
const mockDeleteGroup = vi.mocked(deleteGroup);

const groupA: GroupData = {
  id: '1',
  name: 'Sunday Squad',
  identifier: 'sunday-squad',
  memberCount: 4,
  isOwner: true,
  createdAt: '2026-01-01T00:00:00.000Z',
};

const groupB: GroupData = {
  id: '2',
  name: 'Monday Misfits',
  identifier: 'monday-misfits',
  memberCount: 7,
  isOwner: false,
  createdAt: '2026-02-02T00:00:00.000Z',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <GroupsPage />
    </MemoryRouter>
  );
}

describe('GroupsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders a card for each group once getMyGroups resolves', async () => {
    mockGetMyGroups.mockResolvedValue([groupA, groupB]);

    renderPage();

    // GroupCard renders each group name as an <h3> heading.
    expect(
      await screen.findByRole('heading', { name: groupA.name })
    ).toBeInTheDocument();
    expect(
      screen.getByRole('heading', { name: groupB.name })
    ).toBeInTheDocument();
    expect(mockGetMyGroups).toHaveBeenCalledTimes(1);
  });

  it('routes header/card actions through navigate and the group services', async () => {
    mockGetMyGroups.mockResolvedValue([groupA, groupB]);
    mockLeaveGroup.mockResolvedValue(undefined);
    mockDeleteGroup.mockResolvedValue(true);
    // GroupsList guards Leave behind a confirm(); auto-confirm so it proceeds.
    vi.spyOn(window, 'confirm').mockReturnValue(true);

    renderPage();
    await screen.findByRole('heading', { name: groupA.name });

    // Header actions (GroupsList renders Create/Join even with showHeader=false).
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/create-group');
    fireEvent.click(screen.getByRole('button', { name: /join group/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/join-group');

    // View Group (one per card) → /group-details.
    fireEvent.click(screen.getAllByRole('button', { name: /view group/i })[0]);
    expect(mockNavigate).toHaveBeenCalledWith('/group-details');

    // groupA is owner → Edit + Delete; Edit routes to the parameterized path.
    fireEvent.click(screen.getByRole('button', { name: /^edit$/i }));
    expect(mockNavigate).toHaveBeenCalledWith(`/edit-group/${groupA.identifier}`);

    // Delete invokes deleteGroup for the owned group.
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }));
    await waitFor(() =>
      expect(mockDeleteGroup).toHaveBeenCalledWith(groupA.identifier)
    );

    // groupB is a member → Leave invokes leaveGroup (after the confirm).
    fireEvent.click(screen.getByRole('button', { name: /leave group/i }));
    await waitFor(() =>
      expect(mockLeaveGroup).toHaveBeenCalledWith(groupB.identifier)
    );
  });

  it('shows a friendly error and reloads the list when Retry is clicked', async () => {
    // First call rejects (error state), the Retry-triggered call resolves.
    mockGetMyGroups
      .mockRejectedValueOnce(new Error('Network down'))
      .mockResolvedValueOnce([groupA]);

    renderPage();

    expect(
      await screen.findByText('Error Loading Groups')
    ).toBeInTheDocument();
    expect(screen.getByText('Network down')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /retry/i }));

    // Retry re-runs the load effect; the second resolution renders the list.
    expect(
      await screen.findByRole('heading', { name: groupA.name })
    ).toBeInTheDocument();
    expect(mockGetMyGroups).toHaveBeenCalledTimes(2);
  });

  it('shows the empty state when getMyGroups resolves to no groups', async () => {
    mockGetMyGroups.mockResolvedValue([]);

    renderPage();

    expect(
      await screen.findByText(/No groups yet/i)
    ).toBeInTheDocument();

    // The empty state's own Create/Join buttons route to their pages.
    fireEvent.click(screen.getByRole('button', { name: /create group/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/create-group');
    fireEvent.click(screen.getByRole('button', { name: /join group/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/join-group');
  });

  it('shows a loading indicator before getMyGroups resolves', async () => {
    // A never-resolving promise keeps the page in its loading state.
    mockGetMyGroups.mockReturnValue(new Promise<GroupData[]>(() => {}));

    renderPage();

    expect(await screen.findByText(/Loading groups/i)).toBeInTheDocument();
  });
});
