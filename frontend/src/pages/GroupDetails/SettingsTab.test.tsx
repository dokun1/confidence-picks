import { render, screen, fireEvent, waitFor, within, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import SettingsTab from './SettingsTab';
import type { GroupDetail, GroupMember } from '../../lib/groupsService';

// Mock the groups service so leave/delete are controllable per test without
// touching the network or auth tokens.
vi.mock('../../lib/groupsService.js', () => ({
  deleteGroup: vi.fn(),
  leaveGroup: vi.fn(),
}));

// Mock the invites service so invite-link creation is controllable per test.
vi.mock('../../lib/invitesService.js', () => ({
  createLinkInvite: vi.fn(),
}));

// Keep the real react-router exports, stub only useNavigate so navigation
// targets are assertable.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import { deleteGroup, leaveGroup } from '../../lib/groupsService.js';
import { createLinkInvite } from '../../lib/invitesService.js';

const mockDeleteGroup = vi.mocked(deleteGroup);
const mockLeaveGroup = vi.mocked(leaveGroup);
const mockCreateLinkInvite = vi.mocked(createLinkInvite);

const identifier = 'sunday-squad';

const group: GroupDetail = {
  id: '1',
  name: 'Sunday Squad',
  identifier,
  description: 'A friendly competition',
  memberCount: 2,
};

const members: GroupMember[] = [
  {
    id: 'm1',
    name: 'Alice Owner',
    email: 'alice@example.com',
    isOwner: true,
    joinedAt: '2026-01-01T00:00:00.000Z',
    // A picture URL makes the Avatar render as an <img> we can assert on by alt.
    pictureUrl: 'https://example.com/alice.jpg',
  },
  {
    id: 'm2',
    name: 'Bob Member',
    email: 'bob@example.com',
    isOwner: false,
    joinedAt: '2026-02-15T00:00:00.000Z',
    pictureUrl: null,
  },
];

function renderSettings(isOwner = true) {
  return render(
    <SettingsTab
      group={group}
      isOwner={isOwner}
      identifier={identifier}
      members={members}
    />
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  // navigator.clipboard is not implemented in jsdom; provide a stub the copy
  // handler can call.
  Object.defineProperty(navigator, 'clipboard', {
    configurable: true,
    value: { writeText: vi.fn() },
  });
});

describe('SettingsTab member roster', () => {
  it('renders each member name, avatar, and a localized joined date — but not their email', () => {
    renderSettings();

    for (const member of members) {
      expect(screen.getByText(member.name)).toBeInTheDocument();
      // Emails were intentionally removed from the roster for privacy (#105);
      // assert they never leak back in.
      expect(screen.queryByText(member.email)).not.toBeInTheDocument();
    }

    // Avatar with a picture URL renders an <img> whose alt is the member name.
    expect(screen.getByRole('img', { name: 'Alice Owner' })).toBeInTheDocument();

    // Joined dates are formatted via Date#toLocaleDateString.
    expect(
      screen.getByText(`Joined ${new Date(members[0].joinedAt).toLocaleDateString()}`)
    ).toBeInTheDocument();
    expect(
      screen.getByText(`Joined ${new Date(members[1].joinedAt).toLocaleDateString()}`)
    ).toBeInTheDocument();
  });

  it('shows the Owner badge only for owner members', () => {
    renderSettings();
    // Exactly one member is an owner in the fixture.
    expect(screen.getAllByText('Owner')).toHaveLength(1);
  });

  it('renders the roster bare while Invite Link and Manage Group keep their cards', () => {
    renderSettings();

    // The member list flows with the page — its section carries no card styling.
    const membersSection = screen
      .getByRole('heading', { name: 'Members' })
      .closest('section') as HTMLElement;
    expect(membersSection.className).toBe('');

    // The other two sections remain bordered cards (now the shared Card primitive).
    for (const name of ['Invite Link', 'Manage Group']) {
      const section = screen.getByRole('heading', { name }).closest('section') as HTMLElement;
      expect(section.className).toContain('border');
      expect(section.className).toContain('bg-neutral-0');
    }
  });
});

describe('SettingsTab invite link', () => {
  it('calls createLinkInvite and renders the returned joinUrl', async () => {
    const joinUrl = 'https://confidence.picks/invite/abc123';
    mockCreateLinkInvite.mockResolvedValue({ joinUrl });

    renderSettings();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Invite Link' }));
    });

    expect(mockCreateLinkInvite).toHaveBeenCalledWith(identifier);
    expect(screen.getByDisplayValue(joinUrl)).toBeInTheDocument();
  });

  it('copies the joinUrl to the clipboard when Copy is clicked', async () => {
    const joinUrl = 'https://confidence.picks/invite/xyz789';
    mockCreateLinkInvite.mockResolvedValue({ joinUrl });

    renderSettings();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Invite Link' }));
    });

    fireEvent.click(screen.getByRole('button', { name: 'Copy' }));
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(joinUrl);
  });

  it('surfaces an inline error when createLinkInvite rejects', async () => {
    mockCreateLinkInvite.mockRejectedValue(new Error('Invite limit reached'));

    renderSettings();
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Invite Link' }));
    });

    expect(await screen.findByText('Invite limit reached')).toBeInTheDocument();
  });
});

describe('SettingsTab owner actions', () => {
  it('navigates to the edit route when Edit is clicked', () => {
    renderSettings(true);
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
    expect(mockNavigate).toHaveBeenCalledWith(`/edit-group/${identifier}`);
  });

  it('opens the confirm modal and deletes the group, then navigates to /groups', async () => {
    mockDeleteGroup.mockResolvedValue(true);

    renderSettings(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Delete Group?')).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Delete Group' }));
    });

    expect(mockDeleteGroup).toHaveBeenCalledWith(identifier);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/groups'));
    expect(mockLeaveGroup).not.toHaveBeenCalled();
  });

  it('does not delete when the confirm modal is cancelled', () => {
    renderSettings(true);
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }));

    const dialog = screen.getByRole('dialog');
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));

    expect(mockDeleteGroup).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });
});

describe('SettingsTab member actions', () => {
  it('shows Leave Group (not Edit/Delete) for a non-owner', () => {
    renderSettings(false);
    expect(screen.getByRole('button', { name: 'Leave Group' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('opens the confirm modal and leaves the group, then navigates to /groups', async () => {
    mockLeaveGroup.mockResolvedValue(undefined);

    renderSettings(false);
    fireEvent.click(screen.getByRole('button', { name: 'Leave Group' }));

    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText('Leave Group?')).toBeInTheDocument();

    // The trigger and the confirm button share the label "Leave Group"; scope to
    // the dialog to drive the confirm flow.
    await act(async () => {
      fireEvent.click(within(dialog).getByRole('button', { name: 'Leave Group' }));
    });

    expect(mockLeaveGroup).toHaveBeenCalledWith(identifier);
    await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/groups'));
    expect(mockDeleteGroup).not.toHaveBeenCalled();
  });
});
