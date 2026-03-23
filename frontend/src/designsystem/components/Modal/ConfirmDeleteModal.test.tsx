import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ConfirmDeleteModal from './ConfirmDeleteModal';
import type { ConfirmDeleteModalProps } from './ConfirmDeleteModal';

function makeProps(overrides?: Partial<ConfirmDeleteModalProps>): ConfirmDeleteModalProps {
  return {
    isOpen: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Delete group?',
    body: 'This action cannot be undone.',
    confirmLabel: 'Delete',
    cancelLabel: 'Cancel',
    ...overrides,
  };
}

describe('ConfirmDeleteModal', () => {
  describe('rendering', () => {
    it('renders nothing when isOpen is false', () => {
      render(<ConfirmDeleteModal {...makeProps({ isOpen: false })} />);
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('renders the dialog when isOpen is true', () => {
      render(<ConfirmDeleteModal {...makeProps()} />);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('renders the title text', () => {
      render(<ConfirmDeleteModal {...makeProps()} />);
      expect(screen.getByText('Delete group?')).toBeInTheDocument();
    });

    it('renders the body text', () => {
      render(<ConfirmDeleteModal {...makeProps()} />);
      expect(screen.getByText('This action cannot be undone.')).toBeInTheDocument();
    });

    it('renders the cancel button with provided cancelLabel', () => {
      render(<ConfirmDeleteModal {...makeProps({ cancelLabel: 'Go back' })} />);
      expect(screen.getByRole('button', { name: 'Go back' })).toBeInTheDocument();
    });

    it('renders the confirm button with provided confirmLabel', () => {
      render(<ConfirmDeleteModal {...makeProps({ confirmLabel: 'Delete forever' })} />);
      expect(screen.getByRole('button', { name: 'Delete forever' })).toBeInTheDocument();
    });

    it('defaults confirmLabel to "Confirm"', () => {
      render(
        <ConfirmDeleteModal
          isOpen
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Delete?"
          body="Are you sure?"
        />
      );
      expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    });

    it('defaults cancelLabel to "Cancel"', () => {
      render(
        <ConfirmDeleteModal
          isOpen
          onClose={vi.fn()}
          onConfirm={vi.fn()}
          title="Delete?"
          body="Are you sure?"
        />
      );
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('confirm button uses destructive variant', () => {
      render(<ConfirmDeleteModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-error-500');
    });

    it('cancel button uses secondary variant', () => {
      render(<ConfirmDeleteModal {...makeProps()} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveClass('bg-secondary-100');
    });

    it('title has error color class', () => {
      render(<ConfirmDeleteModal {...makeProps()} />);
      const heading = screen.getByRole('heading');
      expect(heading).toHaveClass('text-error-600');
    });
  });

  describe('cancel handler', () => {
    it('calls onClose when cancel button is clicked', () => {
      const onClose = vi.fn();
      render(<ConfirmDeleteModal {...makeProps({ onClose })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose via cancel button when loading', () => {
      const onClose = vi.fn();
      render(<ConfirmDeleteModal {...makeProps({ onClose, loading: true })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
      expect(onClose).not.toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
      const onClose = vi.fn();
      render(<ConfirmDeleteModal {...makeProps({ onClose })} />);
      const backdrop = screen.getByRole('dialog').querySelector('[aria-hidden="true"]');
      fireEvent.click(backdrop!);
      expect(onClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('confirm handler', () => {
    it('calls onConfirm when confirm button is clicked', () => {
      const onConfirm = vi.fn();
      render(<ConfirmDeleteModal {...makeProps({ onConfirm })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onConfirm).toHaveBeenCalledTimes(1);
    });

    it('does not call onConfirm when loading', () => {
      const onConfirm = vi.fn();
      render(<ConfirmDeleteModal {...makeProps({ onConfirm, loading: true })} />);
      fireEvent.click(screen.getByRole('button', { name: 'Delete' }));
      expect(onConfirm).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('confirm button shows spinner SVG when loading', () => {
      render(<ConfirmDeleteModal {...makeProps({ loading: true })} />);
      const confirmBtn = screen.getByRole('button', { name: 'Delete' });
      expect(confirmBtn.querySelector('svg')).toBeInTheDocument();
    });

    it('confirm button has no spinner when not loading', () => {
      render(<ConfirmDeleteModal {...makeProps({ loading: false })} />);
      const confirmBtn = screen.getByRole('button', { name: 'Delete' });
      expect(confirmBtn.querySelector('svg')).toBeNull();
    });

    it('cancel button is disabled when loading', () => {
      render(<ConfirmDeleteModal {...makeProps({ loading: true })} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    });

    it('cancel button is enabled when not loading', () => {
      render(<ConfirmDeleteModal {...makeProps({ loading: false })} />);
      expect(screen.getByRole('button', { name: 'Cancel' })).not.toBeDisabled();
    });
  });

  describe('escape-key close (inherited from Modal)', () => {
    it('calls onClose when Escape key is pressed', () => {
      const onClose = vi.fn();
      render(<ConfirmDeleteModal {...makeProps({ onClose })} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not call onClose for non-Escape keys', () => {
      const onClose = vi.fn();
      render(<ConfirmDeleteModal {...makeProps({ onClose })} />);
      fireEvent.keyDown(document, { key: 'Enter' });
      fireEvent.keyDown(document, { key: 'Space' });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('does not call onClose via Escape when modal is closed', () => {
      const onClose = vi.fn();
      render(<ConfirmDeleteModal {...makeProps({ onClose, isOpen: false })} />);
      fireEvent.keyDown(document, { key: 'Escape' });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
