import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import InlineToast from './InlineToast';

describe('InlineToast', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('visibility', () => {
    it('renders nothing when open is false', () => {
      const { container } = render(<InlineToast open={false} message="Hello" />);
      expect(container.firstChild).toBeNull();
    });

    it('renders the toast when open is true', () => {
      render(<InlineToast open message="Hello" />);
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('defaults to hidden when open prop is omitted', () => {
      const { container } = render(<InlineToast message="Hello" />);
      expect(container.firstChild).toBeNull();
    });
  });

  describe('message display', () => {
    it('displays the message text', () => {
      render(<InlineToast open message="Saved successfully" />);
      expect(screen.getByText('Saved successfully')).toBeInTheDocument();
    });

    it('displays an empty message when message prop is omitted', () => {
      render(<InlineToast open />);
      const status = screen.getByRole('status');
      // SVG icon is rendered; text content is just whitespace/empty
      expect(status).toBeInTheDocument();
    });

    it('has aria-live="polite" for accessibility', () => {
      render(<InlineToast open message="Hello" />);
      expect(screen.getByRole('status')).toHaveAttribute('aria-live', 'polite');
    });
  });

  describe('variants', () => {
    it('info variant applies bg-secondary-900 class', () => {
      render(<InlineToast open message="Info" variant="info" />);
      expect(screen.getByRole('status')).toHaveClass('bg-secondary-900');
    });

    it('info variant applies dark:bg-secondary-100 class', () => {
      render(<InlineToast open message="Info" variant="info" />);
      expect(screen.getByRole('status')).toHaveClass('dark:bg-secondary-100');
    });

    it('success variant applies bg-success-600 class', () => {
      render(<InlineToast open message="Done" variant="success" />);
      expect(screen.getByRole('status')).toHaveClass('bg-success-600');
    });

    it('success variant applies dark:bg-success-500 class', () => {
      render(<InlineToast open message="Done" variant="success" />);
      expect(screen.getByRole('status')).toHaveClass('dark:bg-success-500');
    });

    it('warning variant applies bg-warning-600 class', () => {
      render(<InlineToast open message="Watch out" variant="warning" />);
      expect(screen.getByRole('status')).toHaveClass('bg-warning-600');
    });

    it('warning variant applies dark:bg-warning-500 class', () => {
      render(<InlineToast open message="Watch out" variant="warning" />);
      expect(screen.getByRole('status')).toHaveClass('dark:bg-warning-500');
    });

    it('error variant applies bg-error-600 class', () => {
      render(<InlineToast open message="Failed" variant="error" />);
      expect(screen.getByRole('status')).toHaveClass('bg-error-600');
    });

    it('error variant applies dark:bg-error-500 class', () => {
      render(<InlineToast open message="Failed" variant="error" />);
      expect(screen.getByRole('status')).toHaveClass('dark:bg-error-500');
    });

    it('defaults to info variant when variant prop is omitted', () => {
      render(<InlineToast open message="Default" />);
      expect(screen.getByRole('status')).toHaveClass('bg-secondary-900');
    });

    it('applies text-neutral-0 to all variants', () => {
      const variants = ['info', 'success', 'warning', 'error'] as const;
      for (const variant of variants) {
        const { unmount } = render(<InlineToast open message="Test" variant={variant} />);
        expect(screen.getByRole('status')).toHaveClass('text-neutral-0');
        unmount();
      }
    });
  });

  describe('layout classes', () => {
    it('applies pointer-events-none', () => {
      render(<InlineToast open message="Hi" />);
      expect(screen.getByRole('status')).toHaveClass('pointer-events-none');
    });

    it('applies absolute positioning', () => {
      render(<InlineToast open message="Hi" />);
      expect(screen.getByRole('status')).toHaveClass('absolute');
    });

    it('applies -top-9 offset', () => {
      render(<InlineToast open message="Hi" />);
      expect(screen.getByRole('status')).toHaveClass('-top-9');
    });

    it('applies left-1/2 and -translate-x-1/2 for horizontal centering', () => {
      render(<InlineToast open message="Hi" />);
      const el = screen.getByRole('status');
      expect(el).toHaveClass('left-1/2');
      expect(el).toHaveClass('-translate-x-1/2');
    });

    it('applies z-20 stacking', () => {
      render(<InlineToast open message="Hi" />);
      expect(screen.getByRole('status')).toHaveClass('z-20');
    });

    it('applies text-xs size', () => {
      render(<InlineToast open message="Hi" />);
      expect(screen.getByRole('status')).toHaveClass('text-xs');
    });

    it('applies transition-all duration-150 animation classes', () => {
      render(<InlineToast open message="Hi" />);
      const el = screen.getByRole('status');
      expect(el).toHaveClass('transition-all');
      expect(el).toHaveClass('duration-150');
    });

    it('applies flex items-center gap-1 layout', () => {
      render(<InlineToast open message="Hi" />);
      const el = screen.getByRole('status');
      expect(el).toHaveClass('flex');
      expect(el).toHaveClass('items-center');
      expect(el).toHaveClass('gap-1');
    });

    it('applies whitespace-nowrap', () => {
      render(<InlineToast open message="Hi" />);
      expect(screen.getByRole('status')).toHaveClass('whitespace-nowrap');
    });

    it('applies shadow-md and rounded', () => {
      render(<InlineToast open message="Hi" />);
      const el = screen.getByRole('status');
      expect(el).toHaveClass('shadow-md');
      expect(el).toHaveClass('rounded');
    });
  });

  describe('icon rendering', () => {
    it('renders an svg icon inside the toast', () => {
      const { container } = render(<InlineToast open message="Hello" variant="info" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('applies w-3.5 h-3.5 to the icon svg', () => {
      const { container } = render(<InlineToast open message="Hello" variant="info" />);
      const svg = container.querySelector('svg');
      expect(svg).toHaveClass('w-3.5');
      expect(svg).toHaveClass('h-3.5');
    });

    it('renders an icon for success variant', () => {
      const { container } = render(<InlineToast open message="Done" variant="success" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders an icon for warning variant', () => {
      const { container } = render(<InlineToast open message="Warning" variant="warning" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders an icon for error variant', () => {
      const { container } = render(<InlineToast open message="Error" variant="error" />);
      expect(container.querySelector('svg')).toBeInTheDocument();
    });

    it('renders no svg when open is false', () => {
      const { container } = render(<InlineToast open={false} message="Hello" />);
      expect(container.querySelector('svg')).toBeNull();
    });
  });

  describe('auto-dismiss behavior', () => {
    it('calls onClose after the default timeout of 2000ms', () => {
      const onClose = vi.fn();
      render(<InlineToast open message="Auto" onClose={onClose} />);
      expect(onClose).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('calls onClose after a custom timeout', () => {
      const onClose = vi.fn();
      render(<InlineToast open message="Custom" timeout={500} onClose={onClose} />);
      act(() => { vi.advanceTimersByTime(499); });
      expect(onClose).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('does not call onClose when open is false', () => {
      const onClose = vi.fn();
      render(<InlineToast open={false} message="Hidden" onClose={onClose} />);
      act(() => { vi.advanceTimersByTime(5000); });
      expect(onClose).not.toHaveBeenCalled();
    });

    it('resets the timer when open transitions from false to true', () => {
      const onClose = vi.fn();
      const { rerender } = render(
        <InlineToast open={false} message="Test" timeout={1000} onClose={onClose} />
      );
      rerender(<InlineToast open message="Test" timeout={1000} onClose={onClose} />);
      act(() => { vi.advanceTimersByTime(999); });
      expect(onClose).not.toHaveBeenCalled();
      act(() => { vi.advanceTimersByTime(1); });
      expect(onClose).toHaveBeenCalledOnce();
    });

    it('clears the timer on unmount', () => {
      const onClose = vi.fn();
      const { unmount } = render(
        <InlineToast open message="Test" timeout={1000} onClose={onClose} />
      );
      unmount();
      act(() => { vi.advanceTimersByTime(2000); });
      expect(onClose).not.toHaveBeenCalled();
    });
  });
});
