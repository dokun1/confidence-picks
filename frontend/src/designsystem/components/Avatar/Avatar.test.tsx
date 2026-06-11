import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import Avatar from './Avatar';

// A URL that has no special size params → produces exactly 2 sources:
// [base, base + '?sz={2x}'] which allows us to test source cycling in a predictable way.
const PLAIN_URL = 'https://example.com/avatar.jpg';

// A URL that already has a sz param → produces exactly 1 source (no extra variant added).
const SZ_URL = 'https://example.com/avatar.jpg?sz=100';

// A Google-style profile URL → produces 4 sources.
const GOOGLE_URL = 'https://lh3.googleusercontent.com/photo=s96-c';

describe('Avatar', () => {
  describe('image rendering', () => {
    it('renders an img element when pictureUrl is provided', () => {
      render(<Avatar name="Jane Smith" pictureUrl={SZ_URL} />);
      expect(screen.getByRole('img')).toBeInTheDocument();
    });

    it('sets src to the first source URL', () => {
      render(<Avatar name="Jane Smith" pictureUrl={SZ_URL} />);
      expect(screen.getByRole('img')).toHaveAttribute('src', SZ_URL);
    });

    it('sets alt to the name when provided', () => {
      render(<Avatar name="Jane Smith" pictureUrl={SZ_URL} />);
      expect(screen.getByRole('img')).toHaveAttribute('alt', 'Jane Smith');
    });

    it('sets alt to the email when name is absent', () => {
      render(<Avatar email="jane@example.com" pictureUrl={SZ_URL} />);
      expect(screen.getByRole('img')).toHaveAttribute('alt', 'jane@example.com');
    });

    it('sets referrerPolicy="no-referrer"', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} />);
      expect(screen.getByRole('img')).toHaveAttribute('referrerpolicy', 'no-referrer');
    });

    it('sets crossOrigin="anonymous"', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} />);
      expect(screen.getByRole('img')).toHaveAttribute('crossorigin', 'anonymous');
    });

    it('applies object-cover class to image', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} />);
      expect(screen.getByRole('img')).toHaveClass('object-cover');
    });

    it('applies border classes to image', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} />);
      const img = screen.getByRole('img');
      expect(img).toHaveClass('border');
      expect(img).toHaveClass('border-primary-100');
      expect(img).toHaveClass('dark:border-primary-800');
    });

    it('applies className prop to the image element', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} className="ring-2 ring-offset-2" />);
      const img = screen.getByRole('img');
      expect(img).toHaveClass('ring-2');
      expect(img).toHaveClass('ring-offset-2');
    });
  });

  describe('initials fallback', () => {
    it('renders a div (not img) when pictureUrl is absent', () => {
      render(<Avatar name="Jane Smith" />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('JS')).toBeInTheDocument();
    });

    it('renders a div (not img) when pictureUrl is null', () => {
      render(<Avatar name="Jane Smith" pictureUrl={null} />);
      expect(screen.queryByRole('img')).toBeNull();
    });

    it('computes initials from first two words of name', () => {
      render(<Avatar name="Jane Smith" />);
      expect(screen.getByText('JS')).toBeInTheDocument();
    });

    it('uses only the first two words for names with more than two parts', () => {
      render(<Avatar name="John Michael Doe" />);
      expect(screen.getByText('JM')).toBeInTheDocument();
    });

    it('computes a single initial from a single-word name', () => {
      render(<Avatar name="Jane" />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('falls back to email initial when name is empty', () => {
      render(<Avatar email="jane@example.com" />);
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('shows "?" when neither name nor email is provided', () => {
      render(<Avatar />);
      expect(screen.getByText('?')).toBeInTheDocument();
    });

    it('applies bg-accent to initials div', () => {
      const { container } = render(<Avatar name="Jane" />);
      expect(container.firstChild).toHaveClass('bg-accent');
    });

    it('applies text-accent-fg and font-medium to initials div', () => {
      const { container } = render(<Avatar name="Jane" />);
      expect(container.firstChild).toHaveClass('text-accent-fg');
      expect(container.firstChild).toHaveClass('font-medium');
    });

    it('applies flex and items-center to initials div', () => {
      const { container } = render(<Avatar name="Jane" />);
      expect(container.firstChild).toHaveClass('flex');
      expect(container.firstChild).toHaveClass('items-center');
      expect(container.firstChild).toHaveClass('justify-center');
    });

    it('applies className prop to the initials div', () => {
      render(<Avatar name="Jane" className="ring-2" />);
      const div = screen.getByText('J').closest('div');
      expect(div).toHaveClass('ring-2');
    });
  });

  describe('size variants', () => {
    it('defaults to md (32px) dimensions', () => {
      render(<Avatar name="Jane" />);
      const el = screen.getByText('J').closest('div');
      expect(el).toHaveClass('w-[32px]');
      expect(el).toHaveClass('h-[32px]');
    });

    it('sm variant applies 16px dimensions', () => {
      render(<Avatar name="Jane" variant="sm" />);
      const el = screen.getByText('J').closest('div');
      expect(el).toHaveClass('w-[16px]');
      expect(el).toHaveClass('h-[16px]');
    });

    it('md variant applies 32px dimensions', () => {
      render(<Avatar name="Jane" variant="md" />);
      const el = screen.getByText('J').closest('div');
      expect(el).toHaveClass('w-[32px]');
      expect(el).toHaveClass('h-[32px]');
    });

    it('lg variant applies 48px dimensions', () => {
      render(<Avatar name="Jane" variant="lg" />);
      const el = screen.getByText('J').closest('div');
      expect(el).toHaveClass('w-[48px]');
      expect(el).toHaveClass('h-[48px]');
    });

    it('size prop overrides variant dimensions', () => {
      render(<Avatar name="Jane" variant="sm" size={64} />);
      const el = screen.getByText('J').closest('div');
      expect(el).toHaveClass('w-[64px]');
      expect(el).toHaveClass('h-[64px]');
    });

    it('applies correct dimension classes to image element', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} variant="lg" />);
      const img = screen.getByRole('img');
      expect(img).toHaveClass('w-[48px]');
      expect(img).toHaveClass('h-[48px]');
    });
  });

  describe('rounded prop', () => {
    it('defaults to rounded-full on initials div', () => {
      const { container } = render(<Avatar name="Jane" />);
      expect(container.firstChild).toHaveClass('rounded-full');
    });

    it('applies rounded-full to image', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} rounded="full" />);
      expect(screen.getByRole('img')).toHaveClass('rounded-full');
    });

    it('applies rounded-base to initials div', () => {
      const { container } = render(<Avatar name="Jane" rounded="base" />);
      expect(container.firstChild).toHaveClass('rounded-base');
    });

    it('applies rounded-base to image', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} rounded="base" />);
      expect(screen.getByRole('img')).toHaveClass('rounded-base');
    });
  });

  describe('image error handling', () => {
    it('advances to next source on first error', () => {
      render(<Avatar name="Jane" pictureUrl={PLAIN_URL} variant="md" />);
      const img = screen.getByRole('img');
      // First source is the original URL
      expect(img).toHaveAttribute('src', PLAIN_URL);
      fireEvent.error(img);
      // Second source is the sz-suffixed URL (actualSize=32, so sz=64)
      expect(screen.getByRole('img')).toHaveAttribute('src', `${PLAIN_URL}?sz=64`);
    });

    it('falls back to initials after all sources are exhausted', () => {
      render(<Avatar name="Jane" pictureUrl={PLAIN_URL} variant="md" />);
      fireEvent.error(screen.getByRole('img')); // try source[1]
      fireEvent.error(screen.getByRole('img')); // all sources failed
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('immediately shows initials when single source fails', () => {
      render(<Avatar name="Jane" pictureUrl={SZ_URL} variant="md" />);
      fireEvent.error(screen.getByRole('img'));
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('J')).toBeInTheDocument();
    });

    it('builds multiple source variants for Google profile URLs', () => {
      render(<Avatar name="Jane" pictureUrl={GOOGLE_URL} variant="md" />);
      // Google URL generates 4 sources; first should be the original
      expect(screen.getByRole('img')).toHaveAttribute('src', GOOGLE_URL);
    });
  });

  describe('missing src handling', () => {
    it('shows initials when pictureUrl is undefined', () => {
      render(<Avatar name="No Pic" pictureUrl={undefined} />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('NP')).toBeInTheDocument();
    });

    it('shows initials when pictureUrl is null', () => {
      render(<Avatar name="No Pic" pictureUrl={null} />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('NP')).toBeInTheDocument();
    });

    it('shows initials when pictureUrl is empty string', () => {
      render(<Avatar name="No Pic" pictureUrl="" />);
      expect(screen.queryByRole('img')).toBeNull();
      expect(screen.getByText('NP')).toBeInTheDocument();
    });
  });
});
