import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InvitePage from './InvitePage';
import type { InviteDetails } from '../lib/types';
import type { AcceptInviteResult } from '../lib/invitesService';

// Control the invite service per test without touching the network.
vi.mock('../lib/invitesService.js', () => ({
  getInvite: vi.fn(),
  acceptInvite: vi.fn(),
}));

// Keep the real react-router exports (MemoryRouter, Routes, useParams) so the
// :token param resolves naturally; stub only useNavigate.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Control the signed-in state directly rather than wiring AuthService/storage.
let mockIsAuthenticated = false;
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

import { getInvite, acceptInvite } from '../lib/invitesService.js';
const mockGetInvite = vi.mocked(getInvite);
const mockAcceptInvite = vi.mocked(acceptInvite);

const TOKEN = 'tok-123';

function validInvite(overrides: Partial<InviteDetails> = {}): InviteDetails {
  return {
    valid: true,
    alreadyMember: false,
    group: {
      identifier: 'cool-group',
      name: 'Cool Group',
      description: 'A friendly competition',
      memberCount: 3,
      maxMembers: 10,
      ownerName: 'Ada Lovelace',
      ownerPictureUrl: '',
    },
    invite: {
      token: TOKEN,
      expiresAt: '2099-01-01T00:00:00Z',
      maxUses: 5,
      uses: 2,
      remainingUses: 3,
    },
    ...overrides,
  };
}

function renderPage() {
  return render(
    <MemoryRouter initialEntries={[`/invite/${TOKEN}`]}>
      <Routes>
        <Route path="/invite/:token" element={<InvitePage />} />
      </Routes>
    </MemoryRouter>
  );
}

describe('InvitePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
  });

  it('fetches the invite for the :token from the URL', async () => {
    mockGetInvite.mockResolvedValue(validInvite());
    renderPage();
    await waitFor(() => expect(mockGetInvite).toHaveBeenCalledWith(TOKEN));
  });

  it('shows the fetch-error state with a Go to Groups CTA when getInvite rejects', async () => {
    mockGetInvite.mockRejectedValue(new Error('Invitation not found'));
    renderPage();

    expect(await screen.findByText('Invitation not found')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Invitation Error' })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to Groups' }));
    expect(mockNavigate).toHaveBeenCalledWith('/groups');
  });

  it('renders an Invite Unavailable message for an invalid invite', async () => {
    mockGetInvite.mockResolvedValue(validInvite({ valid: false, reason: 'expired' }));
    renderPage();

    expect(await screen.findByRole('heading', { name: 'Invite Unavailable' })).toBeInTheDocument();
    expect(screen.getByText('This invitation has expired.')).toBeInTheDocument();
    expect(mockAcceptInvite).not.toHaveBeenCalled();
  });

  it("shows the already-a-member state with a Go to Group CTA", async () => {
    mockGetInvite.mockResolvedValue(validInvite({ alreadyMember: true }));
    mockIsAuthenticated = true;
    renderPage();

    expect(await screen.findByText("You're already a member of Cool Group.")).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Accept Invite' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Go to Group' }));
    expect(mockNavigate).toHaveBeenCalledWith('/group-details?group=cool-group');
  });

  it('accepts the invite and navigates to the new group when signed in', async () => {
    mockGetInvite.mockResolvedValue(validInvite());
    const result: AcceptInviteResult = {
      joined: true,
      alreadyMember: false,
      groupIdentifier: 'cool-group',
    };
    mockAcceptInvite.mockResolvedValue(result);
    mockIsAuthenticated = true;
    renderPage();

    const acceptBtn = await screen.findByRole('button', { name: 'Accept Invite' });
    fireEvent.click(acceptBtn);

    await waitFor(() => expect(mockAcceptInvite).toHaveBeenCalledWith(TOKEN));
    await waitFor(() =>
      expect(mockNavigate).toHaveBeenCalledWith('/group-details?group=cool-group')
    );
  });

  it('surfaces an inline error and does not navigate when acceptInvite rejects', async () => {
    mockGetInvite.mockResolvedValue(validInvite());
    mockAcceptInvite.mockRejectedValue(new Error('Group is full'));
    mockIsAuthenticated = true;
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Accept Invite' }));

    expect(await screen.findByText('Group is full')).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('routes a signed-out user to /login with the invite token preserved in next', async () => {
    mockGetInvite.mockResolvedValue(validInvite());
    mockIsAuthenticated = false;
    renderPage();

    fireEvent.click(await screen.findByRole('button', { name: 'Sign in to join' }));
    expect(mockNavigate).toHaveBeenCalledWith(
      `/login?next=${encodeURIComponent(`/invite/${TOKEN}`)}`
    );
    expect(mockAcceptInvite).not.toHaveBeenCalled();
  });
});
