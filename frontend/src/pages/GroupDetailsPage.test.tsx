import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GroupDetailsPage from './GroupDetailsPage';
import type {
  GroupDetail,
  GroupMember,
  GroupMessage,
} from '../lib/groupsService';

// Mock the groups service so the three mount fetches are controllable per test
// without touching the network or auth tokens.
vi.mock('../lib/groupsService.js', () => ({
  getGroup: vi.fn(),
  getMembers: vi.fn(),
  getMessages: vi.fn(),
}));

// PicksTab owns its own fetch (season -> closest week -> picks). Mock those so the
// picks tab renders deterministically; getClosestWeek is left pending in the tab-
// switching test so the tab sits in its loading state.
vi.mock('../lib/nflSeasonUtils.js', () => ({ getCurrentNFLSeason: vi.fn(() => 2025) }));
vi.mock('../lib/picksService.js', () => ({
  getClosestWeek: vi.fn(),
  getPicks: vi.fn(),
}));

// Keep the real react-router exports (MemoryRouter, useSearchParams), stub only
// useNavigate so navigation targets are assertable.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { getGroup, getMembers, getMessages } from '../lib/groupsService.js';
import { getClosestWeek } from '../lib/picksService.js';
const mockGetGroup = vi.mocked(getGroup);
const mockGetMembers = vi.mocked(getMembers);
const mockGetMessages = vi.mocked(getMessages);
const mockGetClosestWeek = vi.mocked(getClosestWeek);

const ownerGroup: GroupDetail = {
  id: '1',
  name: 'Sunday Squad',
  identifier: 'sunday-squad',
  description: 'A friendly competition',
  memberCount: 4,
  userRole: 'admin',
};

const memberGroup: GroupDetail = {
  ...ownerGroup,
  userRole: 'member',
};

const members: GroupMember[] = [
  {
    id: 'm1',
    name: 'Alice',
    email: 'alice@example.com',
    isOwner: true,
    joinedAt: '2026-01-01T00:00:00.000Z',
    pictureUrl: null,
  },
];

const messages: GroupMessage[] = [
  {
    id: 'msg1',
    authorId: 'm1',
    authorName: 'Alice',
    authorPictureUrl: null,
    content: 'Welcome!',
    createdAt: '2026-01-02T00:00:00.000Z',
  },
];

function renderPage(query = '?group=sunday-squad') {
  return render(
    <MemoryRouter initialEntries={[`/group-details${query}`]}>
      <GroupDetailsPage />
    </MemoryRouter>
  );
}

describe('GroupDetailsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Hold the picks fetch open so the picks tab stays in its loading state for
    // the tab-switching assertions (this suite covers navigation, not picks data).
    mockGetClosestWeek.mockReturnValue(new Promise(() => {}));
  });

  it('renders the group name as the heading once the parallel fetch resolves', async () => {
    mockGetGroup.mockResolvedValue(ownerGroup);
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);

    renderPage();

    expect(
      await screen.findByRole('heading', { name: ownerGroup.name })
    ).toBeInTheDocument();
    // All three mount fetches run with the query-string identifier.
    expect(mockGetGroup).toHaveBeenCalledWith('sunday-squad');
    expect(mockGetMembers).toHaveBeenCalledWith('sunday-squad');
    expect(mockGetMessages).toHaveBeenCalledWith('sunday-squad');
  });

  it('shows the Owner badge for an admin and switches between tab bodies', async () => {
    mockGetGroup.mockResolvedValue(ownerGroup);
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);

    renderPage();
    await screen.findByRole('heading', { name: ownerGroup.name });

    expect(screen.getByText('Owner')).toBeInTheDocument();
    // Default tab is leaderboard.
    expect(screen.getByText(/Leaderboard coming soon/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /picks/i }));
    // PicksTab owns its fetch; with getClosestWeek pending it shows the loader.
    expect(screen.getByText('Loading picks…')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /chat/i }));
    // ChatTab renders the seeded messages passed from the page mount.
    expect(screen.getByText('Welcome!')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('tab', { name: /settings/i }));
    // SettingsTab leads with the Members roster section.
    expect(screen.getByRole('heading', { name: 'Members' })).toBeInTheDocument();
  });

  it('hides the Owner badge for a non-admin member', async () => {
    mockGetGroup.mockResolvedValue(memberGroup);
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);

    renderPage();
    await screen.findByRole('heading', { name: memberGroup.name });

    expect(screen.queryByText('Owner')).not.toBeInTheDocument();
  });

  it('shows a single Group Not Found UI when any fetch rejects', async () => {
    mockGetGroup.mockRejectedValue(new Error('Group not found'));
    mockGetMembers.mockResolvedValue(members);
    mockGetMessages.mockResolvedValue(messages);

    renderPage();

    expect(
      await screen.findByRole('heading', { name: /Group Not Found/i })
    ).toBeInTheDocument();
    expect(screen.getByText('Group not found')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /back to groups/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });

  it('shows the Group Not Found UI without fetching when the query param is absent', () => {
    renderPage('');

    expect(
      screen.getByRole('heading', { name: /Group Not Found/i })
    ).toBeInTheDocument();
    expect(mockGetGroup).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: /back to groups/i }));
    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });

  it('shows a loading indicator before the fetch resolves', async () => {
    mockGetGroup.mockReturnValue(new Promise<GroupDetail>(() => {}));
    mockGetMembers.mockReturnValue(new Promise<GroupMember[]>(() => {}));
    mockGetMessages.mockReturnValue(new Promise<GroupMessage[]>(() => {}));

    renderPage();

    expect(await screen.findByText(/Loading group/i)).toBeInTheDocument();
  });
});
