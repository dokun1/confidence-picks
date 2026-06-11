import { createRef } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import Button from './Button';

describe('Button', () => {
  describe('variants', () => {
    it('renders primary variant by default', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-accent');
    });

    it('renders secondary variant', () => {
      render(<Button variant="secondary">Click me</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-secondary-100');
    });

    it('renders tertiary variant', () => {
      render(<Button variant="tertiary">Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-transparent');
      expect(button).toHaveClass('text-primary-600');
    });

    it('renders destructive variant', () => {
      render(<Button variant="destructive">Click me</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-error-500');
    });

    it('falls back to primary classes for an unknown variant', () => {
      // @ts-expect-error intentionally passing an invalid variant
      render(<Button variant="unknown">Click me</Button>);
      expect(screen.getByRole('button')).toHaveClass('bg-accent');
    });
  });

  describe('sizes', () => {
    it('renders md size by default', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-lg');
      expect(button).toHaveClass('py-xs');
      expect(button).toHaveClass('text-base');
    });

    it('renders sm size', () => {
      render(<Button size="sm">Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-sm');
      expect(button).toHaveClass('py-xxxs');
      expect(button).toHaveClass('text-sm');
      expect(button).toHaveClass('rounded-pill');
    });

    it('renders lg size', () => {
      render(<Button size="lg">Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('px-xl');
      expect(button).toHaveClass('py-sm');
      expect(button).toHaveClass('text-lg');
    });
  });

  describe('disabled state', () => {
    it('sets the disabled attribute', () => {
      render(<Button disabled>Click me</Button>);
      expect(screen.getByRole('button')).toBeDisabled();
    });

    it('sets aria-disabled attribute', () => {
      render(<Button disabled>Click me</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('aria-disabled', 'true');
    });

    it('applies disabled variant classes for primary when disabled', () => {
      render(<Button variant="primary" disabled>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary-200');
      expect(button).toHaveClass('text-secondary-500');
    });

    it('applies disabled variant classes for secondary when disabled', () => {
      render(<Button variant="secondary" disabled>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary-50');
      expect(button).toHaveClass('text-secondary-400');
    });

    it('applies disabled variant classes for tertiary when disabled', () => {
      render(<Button variant="tertiary" disabled>Click me</Button>);
      expect(screen.getByRole('button')).toHaveClass('text-secondary-400');
    });

    it('applies disabled variant classes for destructive when disabled', () => {
      render(<Button variant="destructive" disabled>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('bg-secondary-200');
      expect(button).toHaveClass('text-secondary-500');
    });

    it('does not call onClick when disabled', () => {
      const handleClick = vi.fn();
      render(<Button disabled onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });
  });

  describe('loading state', () => {
    it('renders the spinner SVG when loading', () => {
      render(<Button loading>Submit</Button>);
      const button = screen.getByRole('button');
      const svg = button.querySelector('svg');
      expect(svg).toBeInTheDocument();
    });

    it('spinner has animate-spin class', () => {
      render(<Button loading>Submit</Button>);
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveClass('animate-spin');
    });

    it('spinner has aria-hidden="true"', () => {
      render(<Button loading>Submit</Button>);
      const svg = screen.getByRole('button').querySelector('svg');
      expect(svg).toHaveAttribute('aria-hidden', 'true');
    });

    it('does not render spinner when not loading', () => {
      render(<Button>Submit</Button>);
      expect(screen.getByRole('button').querySelector('svg')).toBeNull();
    });

    it('does not call onClick when loading', () => {
      const handleClick = vi.fn();
      render(<Button loading onClick={handleClick}>Submit</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('still renders children alongside spinner when loading', () => {
      render(<Button loading>Loading text</Button>);
      expect(screen.getByText('Loading text')).toBeInTheDocument();
    });
  });

  describe('click handler', () => {
    it('calls onClick when clicked in default state', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Click me</Button>);
      fireEvent.click(screen.getByRole('button'));
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('does not throw when no onClick is provided', () => {
      render(<Button>Click me</Button>);
      expect(() => fireEvent.click(screen.getByRole('button'))).not.toThrow();
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to the underlying button element', () => {
      const ref = createRef<HTMLButtonElement>();
      render(<Button ref={ref}>Click me</Button>);
      expect(ref.current).not.toBeNull();
      expect(ref.current?.tagName).toBe('BUTTON');
    });

    it('ref is null before mount and defined after', () => {
      const ref = createRef<HTMLButtonElement>();
      const { unmount } = render(<Button ref={ref}>Click me</Button>);
      expect(ref.current).not.toBeNull();
      unmount();
      expect(ref.current).toBeNull();
    });
  });

  describe('icon slot (children)', () => {
    it('renders icon elements passed as children', () => {
      render(
        <Button>
          <span data-testid="icon">★</span>
          Save
        </Button>
      );
      expect(screen.getByTestId('icon')).toBeInTheDocument();
      expect(screen.getByText('Save')).toBeInTheDocument();
    });

    it('renders icon before and after text', () => {
      render(
        <Button>
          <span data-testid="icon-left">←</span>
          Go Back
          <span data-testid="icon-right">→</span>
        </Button>
      );
      expect(screen.getByTestId('icon-left')).toBeInTheDocument();
      expect(screen.getByTestId('icon-right')).toBeInTheDocument();
    });
  });

  describe('type prop', () => {
    it('defaults to type="button"', () => {
      render(<Button>Click me</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
    });

    it('sets type="submit" when specified', () => {
      render(<Button type="submit">Submit</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
    });

    it('sets type="reset" when specified', () => {
      render(<Button type="reset">Reset</Button>);
      expect(screen.getByRole('button')).toHaveAttribute('type', 'reset');
    });
  });

  describe('href (link rendering)', () => {
    it('renders an anchor tag when href is provided and not disabled', () => {
      render(<Button href="/dashboard">Go</Button>);
      const link = screen.getByRole('button'); // role="button" on <a>
      expect(link.tagName).toBe('A');
      expect(link).toHaveAttribute('href', '/dashboard');
    });

    it('renders a button tag when href is provided but disabled', () => {
      render(<Button href="/dashboard" disabled>Go</Button>);
      expect(screen.getByRole('button').tagName).toBe('BUTTON');
    });

    it('renders a button tag when href is null', () => {
      render(<Button href={null}>Go</Button>);
      expect(screen.getByRole('button').tagName).toBe('BUTTON');
    });
  });

  describe('base classes', () => {
    it('includes inline-flex and font-medium on all buttons', () => {
      render(<Button>Click me</Button>);
      const button = screen.getByRole('button');
      expect(button).toHaveClass('inline-flex');
      expect(button).toHaveClass('font-medium');
    });

    it('applies additional className prop', () => {
      render(<Button className="my-custom-class">Click me</Button>);
      expect(screen.getByRole('button')).toHaveClass('my-custom-class');
    });
  });
});
