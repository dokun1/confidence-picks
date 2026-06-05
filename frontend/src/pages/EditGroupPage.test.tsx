import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import EditGroupPage from './EditGroupPage';

// Mock the groups service so getGroup/updateGroup are controllable per test
// without touching the network or auth tokens (mirrors CreateGroupPage.test.tsx
// and JoinGroupPage.test.tsx).
vi.mock('../lib/groupsService.js', () => ({
  getGroup: vi.fn(),
  updateGroup: vi.fn(),
}));

// Keep the real react-router exports (MemoryRouter etc.); stub only useNavigate
// and useParams. The route identifier ('test-group') is what EditGroupPage
// passes to getGroup/updateGroup.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return {
    ...actual,
    useNavigate: () => mockNavigate,
    useParams: () => ({ identifier: 'test-group' }),
  };
});

import { getGroup, updateGroup } from '../lib/groupsService.js';
const mockGetGroup = vi.mocked(getGroup);
const mockUpdateGroup = vi.mocked(updateGroup);

const GROUP = {
  name: 'Test Group',
  identifier: 'test-group',
  description: 'A test group',
};

function renderPage() {
  return render(
    <MemoryRouter>
      <EditGroupPage />
    </MemoryRouter>
  );
}

describe('EditGroupPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads the group and pre-fills the form with the locked identifier', async () => {
    mockGetGroup.mockResolvedValue(GROUP);
    renderPage();

    // The async useEffect load resolves before the form renders, so await the
    // field appearing rather than asserting on the loading spinner.
    expect(await screen.findByLabelText(/Group Name/)).toHaveValue('Test Group');
    expect(mockGetGroup).toHaveBeenCalledWith('test-group');

    const idField = screen.getByLabelText(/Group ID/);
    expect(idField).toHaveValue('test-group');
    expect(idField).toBeDisabled();

    expect(screen.getByLabelText(/Description/)).toHaveValue('A test group');
  });

  it('calls updateGroup with (identifier, {name, description}) then navigates on success', async () => {
    mockGetGroup.mockResolvedValue(GROUP);
    mockUpdateGroup.mockResolvedValue(undefined);
    renderPage();

    // Wait for the load to populate the form before editing/submitting.
    await screen.findByLabelText(/Group Name/);

    fireEvent.change(screen.getByLabelText(/Group Name/), {
      target: { value: 'Renamed Group' },
    });
    fireEvent.change(screen.getByLabelText(/Description/), {
      target: { value: 'Updated description' },
    });

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
    });

    // The immutable identifier is the first arg; the payload carries only the
    // mutable name/description (no identifier).
    expect(mockUpdateGroup).toHaveBeenCalledWith('test-group', {
      name: 'Renamed Group',
      description: 'Updated description',
    });
    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/groups');
    });
  });

  it('renders a not-found message and no form when getGroup rejects', async () => {
    mockGetGroup.mockRejectedValue(new Error('Group not found'));
    renderPage();

    expect(await screen.findByText(/Group not found/)).toBeInTheDocument();
    expect(screen.queryByLabelText(/Group Name/)).toBeNull();
    expect(mockUpdateGroup).not.toHaveBeenCalled();
  });
});
