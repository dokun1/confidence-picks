import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import GroupCard from './GroupCard';
import type { GroupData } from './GroupCard';

const BASE_GROUP: GroupData = {
  id: '1',
  name: 'Fantasy Friends',
  identifier: 'fantasy-friends-2024',
  description: 'Our yearly confidence pool with college friends.',
  memberCount: 8,
  isOwner: true,
  createdAt: '2024-08-01T10:00:00Z',
};

const MEMBER_GROUP: GroupData = {
  id: '2',
  name: 'Office Championship',
  identifier: 'office-champs',
  memberCount: 24,
  isOwner: false,
  createdAt: '2024-07-15T14:30:00Z',
};

describe('GroupCard', () => {
  describe('full data rendering (owner)', () => {
    it('renders the group name', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.getByRole('heading', { name: 'Fantasy Friends' })).toBeInTheDocument();
    });

    it('renders the group identifier', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.getByText('ID: fantasy-friends-2024')).toBeInTheDocument();
    });

    it('renders the description when provided', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.getByText(BASE_GROUP.description!)).toBeInTheDocument();
    });

    it('renders the member count', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.getByText('8')).toBeInTheDocument();
      expect(screen.getByText('members')).toBeInTheDocument();
    });

    it('renders the formatted creation date', () => {
      render(<GroupCard group={BASE_GROUP} />);
      const expected = new Date('2024-08-01T10:00:00Z').toLocaleDateString();
      expect(screen.getByText(`Created ${expected}`)).toBeInTheDocument();
    });

    it('renders View Group button', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.getByRole('button', { name: 'View Group' })).toBeInTheDocument();
    });

    it('renders Edit button for owner', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('renders Delete button for owner', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
    });

    it('does not render Leave Group button for owner', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.queryByRole('button', { name: 'Leave Group' })).toBeNull();
    });
  });

  describe('commissioner (owner) badge', () => {
    it('shows Owner badge when isOwner is true', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.getByText('Owner')).toBeInTheDocument();
    });

    it('applies blue badge classes for owner', () => {
      render(<GroupCard group={BASE_GROUP} />);
      const badge = screen.getByText('Owner');
      expect(badge).toHaveClass('bg-blue-100');
      expect(badge).toHaveClass('text-blue-800');
    });

    it('shows Member badge when isOwner is false', () => {
      render(<GroupCard group={MEMBER_GROUP} />);
      expect(screen.getByText('Member')).toBeInTheDocument();
    });

    it('applies green badge classes for member', () => {
      render(<GroupCard group={MEMBER_GROUP} />);
      const badge = screen.getByText('Member');
      expect(badge).toHaveClass('bg-green-100');
      expect(badge).toHaveClass('text-green-800');
    });

    it('does not show Member badge for owner', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.queryByText('Member')).toBeNull();
    });

    it('does not show Owner badge for member', () => {
      render(<GroupCard group={MEMBER_GROUP} />);
      expect(screen.queryByText('Owner')).toBeNull();
    });
  });

  describe('member view', () => {
    it('renders Leave Group button for non-owner', () => {
      render(<GroupCard group={MEMBER_GROUP} />);
      expect(screen.getByRole('button', { name: 'Leave Group' })).toBeInTheDocument();
    });

    it('does not render Edit or Delete buttons for non-owner', () => {
      render(<GroupCard group={MEMBER_GROUP} />);
      expect(screen.queryByRole('button', { name: 'Edit' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Delete' })).toBeNull();
    });
  });

  describe('missing optional fields', () => {
    it('does not render description section when description is absent', () => {
      render(<GroupCard group={MEMBER_GROUP} />);
      expect(screen.queryByText('Our yearly confidence pool with college friends.')).toBeNull();
    });

    it('does not render creator row when createdByName is absent', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(screen.queryByText('Created by')).toBeNull();
    });

    it('does not render creator row when isOwner is true (even with createdByName)', () => {
      const group: GroupData = { ...BASE_GROUP, createdByName: 'Alice', createdByPictureUrl: null };
      render(<GroupCard group={group} />);
      expect(screen.queryByText('Created by')).toBeNull();
    });

    it('renders creator avatar and name when createdByName is set and not owner', () => {
      const group: GroupData = {
        ...MEMBER_GROUP,
        createdByName: 'Alice Johnson',
        createdByPictureUrl: null,
      };
      render(<GroupCard group={group} />);
      expect(screen.getByText('Created by')).toBeInTheDocument();
      expect(screen.getByText('Alice Johnson')).toBeInTheDocument();
    });
  });

  describe('click handlers', () => {
    it('calls onView when View Group is clicked', () => {
      const onView = vi.fn();
      render(<GroupCard group={BASE_GROUP} onView={onView} />);
      fireEvent.click(screen.getByRole('button', { name: 'View Group' }));
      expect(onView).toHaveBeenCalledOnce();
    });

    it('calls onEdit when Edit is clicked', () => {
      const onEdit = vi.fn();
      render(<GroupCard group={BASE_GROUP} onEdit={onEdit} />);
      fireEvent.click(screen.getByRole('button', { name: 'Edit' }));
      expect(onEdit).toHaveBeenCalledOnce();
    });

    it('calls onDelete when Delete is clicked', () => {
      const onDelete = vi.fn();
      render(<GroupCard group={BASE_GROUP} onDelete={onDelete} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onDelete).toHaveBeenCalledOnce();
    });

    it('calls onLeave when Leave Group is clicked', () => {
      const onLeave = vi.fn();
      render(<GroupCard group={MEMBER_GROUP} onLeave={onLeave} />);
      fireEvent.click(screen.getByRole('button', { name: 'Leave Group' }));
      expect(onLeave).toHaveBeenCalledOnce();
    });

    it('does not throw when onView is not provided', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(() => fireEvent.click(screen.getByRole('button', { name: 'View Group' }))).not.toThrow();
    });

    it('does not throw when onEdit is not provided', () => {
      render(<GroupCard group={BASE_GROUP} />);
      expect(() => fireEvent.click(screen.getByRole('button', { name: 'Edit' }))).not.toThrow();
    });
  });

  describe('card structure', () => {
    it('applies card container classes', () => {
      const { container } = render(<GroupCard group={BASE_GROUP} />);
      const card = container.firstChild as HTMLElement;
      expect(card).toHaveClass('bg-white');
      expect(card).toHaveClass('border');
      expect(card).toHaveClass('border-gray-200');
      expect(card).toHaveClass('rounded-lg');
      expect(card).toHaveClass('p-6');
      expect(card).toHaveClass('shadow-sm');
    });
  });
});
