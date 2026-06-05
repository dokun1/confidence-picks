import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import GroupsList from './GroupsList';
import type { GroupData } from '../GroupCard/GroupCard';

// window.confirm is called by handleLeaveGroup; stub it for tests
beforeEach(() => {
  vi.spyOn(window, 'confirm').mockReturnValue(true);
});

const GROUP_A: GroupData = {
  id: '1',
  name: 'Alpha League',
  identifier: 'alpha-league',
  description: 'First group description.',
  memberCount: 5,
  isOwner: true,
  createdAt: '2024-09-01T00:00:00Z',
};

const GROUP_B: GroupData = {
  id: '2',
  name: 'Beta Squad',
  identifier: 'beta-squad',
  memberCount: 12,
  isOwner: false,
  createdAt: '2024-09-15T00:00:00Z',
};

describe('GroupsList', () => {
  describe('loading state', () => {
    it('renders the loading spinner when isLoading is true', () => {
      render(<GroupsList isLoading />);
      expect(screen.getByText('Loading groups...')).toBeInTheDocument();
    });

    it('renders the spinner element when isLoading is true', () => {
      const { container } = render(<GroupsList isLoading />);
      const spinner = container.querySelector('.animate-spin');
      expect(spinner).toBeInTheDocument();
    });

    it('does not render group cards while loading', () => {
      render(<GroupsList groups={[GROUP_A]} isLoading />);
      expect(screen.queryByText('Alpha League')).toBeNull();
    });

    it('does not render the empty state while loading', () => {
      render(<GroupsList groups={[]} isLoading />);
      expect(screen.queryByText('No groups found')).toBeNull();
    });
  });

  describe('empty state', () => {
    it('renders "No groups found" heading when groups array is empty', () => {
      render(<GroupsList groups={[]} />);
      expect(screen.getByText('No groups found')).toBeInTheDocument();
    });

    it('renders the helpful description text', () => {
      render(<GroupsList groups={[]} />);
      expect(
        screen.getByText('Get started by creating a new group or joining an existing one.')
      ).toBeInTheDocument();
    });

    it('renders "Create Your First Group" button in empty state', () => {
      render(<GroupsList groups={[]} />);
      expect(screen.getByRole('button', { name: 'Create Your First Group' })).toBeInTheDocument();
    });

    it('renders "Join a Group" button in empty state', () => {
      render(<GroupsList groups={[]} />);
      expect(screen.getByRole('button', { name: 'Join a Group' })).toBeInTheDocument();
    });

    it('calls onCreateNew when "Create Your First Group" is clicked', () => {
      const onCreateNew = vi.fn();
      render(<GroupsList groups={[]} onCreateNew={onCreateNew} />);
      fireEvent.click(screen.getByRole('button', { name: 'Create Your First Group' }));
      expect(onCreateNew).toHaveBeenCalledOnce();
    });

    it('calls onJoinExisting when "Join a Group" is clicked', () => {
      const onJoinExisting = vi.fn();
      render(<GroupsList groups={[]} onJoinExisting={onJoinExisting} />);
      fireEvent.click(screen.getByRole('button', { name: 'Join a Group' }));
      expect(onJoinExisting).toHaveBeenCalledOnce();
    });
  });

  describe('list rendering', () => {
    it('renders a GroupCard for each group', () => {
      render(<GroupsList groups={[GROUP_A, GROUP_B]} />);
      expect(screen.getByRole('heading', { name: 'Alpha League' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Beta Squad' })).toBeInTheDocument();
    });

    it('does not render the empty state when groups are present', () => {
      render(<GroupsList groups={[GROUP_A]} />);
      expect(screen.queryByText('No groups found')).toBeNull();
    });

    it('does not render the loading spinner when not loading', () => {
      render(<GroupsList groups={[GROUP_A]} />);
      expect(screen.queryByText('Loading groups...')).toBeNull();
    });

    it('renders correct number of group cards', () => {
      render(<GroupsList groups={[GROUP_A, GROUP_B]} />);
      // Each GroupCard renders a "View Group" button
      const viewButtons = screen.getAllByRole('button', { name: 'View Group' });
      expect(viewButtons).toHaveLength(2);
    });
  });

  describe('header (showHeader=true)', () => {
    it('renders the "My Groups" heading when showHeader is true', () => {
      render(<GroupsList groups={[GROUP_A]} />);
      expect(screen.getByRole('heading', { name: 'My Groups' })).toBeInTheDocument();
    });

    it('renders the subtitle text', () => {
      render(<GroupsList groups={[GROUP_A]} />);
      expect(screen.getByText('Manage your confidence picks groups')).toBeInTheDocument();
    });

    it('renders "Create Group" button in header', () => {
      render(<GroupsList groups={[GROUP_A]} />);
      expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
    });

    it('renders "Join Group" button in header', () => {
      render(<GroupsList groups={[GROUP_A]} />);
      expect(screen.getByRole('button', { name: 'Join Group' })).toBeInTheDocument();
    });

    it('renders "Refresh" button in header', () => {
      render(<GroupsList groups={[GROUP_A]} />);
      expect(screen.getByRole('button', { name: /Refresh/ })).toBeInTheDocument();
    });

    it('disables the Refresh button when isLoading is true', () => {
      render(<GroupsList isLoading />);
      // Refresh is in header; loading spinner is in body
      const refreshBtn = screen.getByRole('button', { name: /Refresh/ });
      expect(refreshBtn).toBeDisabled();
    });

    it('calls onRefresh when Refresh is clicked', () => {
      const onRefresh = vi.fn();
      render(<GroupsList groups={[GROUP_A]} onRefresh={onRefresh} />);
      fireEvent.click(screen.getByRole('button', { name: /Refresh/ }));
      expect(onRefresh).toHaveBeenCalledOnce();
    });

    it('calls onCreateNew when "Create Group" header button is clicked', () => {
      const onCreateNew = vi.fn();
      render(<GroupsList groups={[GROUP_A]} onCreateNew={onCreateNew} />);
      fireEvent.click(screen.getByRole('button', { name: 'Create Group' }));
      expect(onCreateNew).toHaveBeenCalledOnce();
    });

    it('calls onJoinExisting when "Join Group" header button is clicked', () => {
      const onJoinExisting = vi.fn();
      render(<GroupsList groups={[GROUP_A]} onJoinExisting={onJoinExisting} />);
      fireEvent.click(screen.getByRole('button', { name: 'Join Group' }));
      expect(onJoinExisting).toHaveBeenCalledOnce();
    });
  });

  describe('header (showHeader=false)', () => {
    it('does not render the "My Groups" heading', () => {
      render(<GroupsList groups={[GROUP_A]} showHeader={false} />);
      expect(screen.queryByRole('heading', { name: 'My Groups' })).toBeNull();
    });

    it('does not render the subtitle text', () => {
      render(<GroupsList groups={[GROUP_A]} showHeader={false} />);
      expect(screen.queryByText('Manage your confidence picks groups')).toBeNull();
    });

    it('does not render the Refresh button', () => {
      render(<GroupsList groups={[GROUP_A]} showHeader={false} />);
      expect(screen.queryByRole('button', { name: /Refresh/ })).toBeNull();
    });

    it('still renders "Create Group" and "Join Group" action buttons', () => {
      render(<GroupsList groups={[GROUP_A]} showHeader={false} />);
      expect(screen.getByRole('button', { name: 'Create Group' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Join Group' })).toBeInTheDocument();
    });
  });

  describe('click propagation from GroupCard', () => {
    it('calls onViewGroup with the correct group when View Group is clicked', () => {
      const onViewGroup = vi.fn();
      render(<GroupsList groups={[GROUP_A, GROUP_B]} onViewGroup={onViewGroup} />);
      const viewButtons = screen.getAllByRole('button', { name: 'View Group' });
      fireEvent.click(viewButtons[0]);
      expect(onViewGroup).toHaveBeenCalledOnce();
      expect(onViewGroup).toHaveBeenCalledWith(GROUP_A);
    });

    it('calls onViewGroup with the second group when its View Group is clicked', () => {
      const onViewGroup = vi.fn();
      render(<GroupsList groups={[GROUP_A, GROUP_B]} onViewGroup={onViewGroup} />);
      const viewButtons = screen.getAllByRole('button', { name: 'View Group' });
      fireEvent.click(viewButtons[1]);
      expect(onViewGroup).toHaveBeenCalledWith(GROUP_B);
    });

    it('calls onEditGroup with the correct group when Edit is clicked', () => {
      const onEditGroup = vi.fn();
      render(<GroupsList groups={[GROUP_A]} onEditGroup={onEditGroup} />);
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(onEditGroup).toHaveBeenCalledOnce();
      expect(onEditGroup).toHaveBeenCalledWith(GROUP_A);
    });

    it('calls onDeleteGroup with the correct group when Delete is clicked', () => {
      const onDeleteGroup = vi.fn();
      render(<GroupsList groups={[GROUP_A]} onDeleteGroup={onDeleteGroup} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onDeleteGroup).toHaveBeenCalledOnce();
      expect(onDeleteGroup).toHaveBeenCalledWith(GROUP_A);
    });

    it('calls onLeaveGroup with the correct group after confirm resolves true', () => {
      const onLeaveGroup = vi.fn();
      render(<GroupsList groups={[GROUP_B]} onLeaveGroup={onLeaveGroup} />);
      fireEvent.click(screen.getByRole('button', { name: 'Leave Group' }));
      expect(window.confirm).toHaveBeenCalledWith(
        `Are you sure you want to leave "${GROUP_B.name}"?`
      );
      expect(onLeaveGroup).toHaveBeenCalledOnce();
      expect(onLeaveGroup).toHaveBeenCalledWith(GROUP_B);
    });

    it('does not call onLeaveGroup when confirm returns false', () => {
      vi.spyOn(window, 'confirm').mockReturnValue(false);
      const onLeaveGroup = vi.fn();
      render(<GroupsList groups={[GROUP_B]} onLeaveGroup={onLeaveGroup} />);
      fireEvent.click(screen.getByRole('button', { name: 'Leave Group' }));
      expect(onLeaveGroup).not.toHaveBeenCalled();
    });
  });

  describe('default props', () => {
    it('renders without crashing when no props are provided', () => {
      expect(() => render(<GroupsList />)).not.toThrow();
    });

    it('shows the empty state by default (no groups)', () => {
      render(<GroupsList />);
      expect(screen.getByText('No groups found')).toBeInTheDocument();
    });
  });
});
