import { render, screen, fireEvent, within } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import Navigation from './Navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useDarkMode } from '../../../contexts/ThemeContext';

// The contexts are the two app-state sources Navigation reads. Mocking them lets
// each test pin authenticated/theme state without standing up real providers.
vi.mock('../../../contexts/AuthContext', () => ({ useAuth: vi.fn() }));
vi.mock('../../../contexts/ThemeContext', () => ({ useDarkMode: vi.fn() }));

const mockedUseAuth = useAuth as unknown as Mock;
const mockedUseDarkMode = useDarkMode as unknown as Mock;

const USER = {
  id: 1,
  email: 'jane@example.com',
  name: 'Jane Doe',
  pictureUrl: null,
  provider: 'google',
};

// Surfaces the router's current pathname so navigation side effects are observable.
function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

interface RenderOptions {
  isAuthenticated?: boolean;
  user?: typeof USER | null;
  isDark?: boolean;
  initialPath?: string;
  showThemeToggle?: boolean;
}

function renderNav(opts: RenderOptions = {}) {
  const {
    isAuthenticated = false,
    user = null,
    isDark = false,
    initialPath = '/',
    showThemeToggle = true,
  } = opts;

  const auth = { isAuthenticated, user, isRestoring: false, clearAuth: vi.fn(), setAuthUser: vi.fn() };
  const theme = { isDark, toggle: vi.fn() };
  mockedUseAuth.mockReturnValue(auth);
  mockedUseDarkMode.mockReturnValue(theme);

  const utils = render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Navigation showThemeToggle={showThemeToggle} />
      <LocationProbe />
    </MemoryRouter>
  );

  return { ...utils, auth, theme };
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Navigation', () => {
  describe('brand', () => {
    it('renders the brand text', () => {
      renderNav();
      expect(screen.getByText('Confidence Picks')).toBeInTheDocument();
    });

    it('navigates to / when the brand is clicked', () => {
      renderNav({ initialPath: '/about' });
      fireEvent.click(screen.getByLabelText('Confidence Picks home'));
      expect(currentPath()).toBe('/');
    });
  });

  describe('navigation links', () => {
    it('renders Home and About when unauthenticated', () => {
      renderNav();
      expect(screen.getAllByRole('link', { name: 'Home' }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole('link', { name: 'About' }).length).toBeGreaterThan(0);
    });

    it('hides auth-only links (Groups) when unauthenticated', () => {
      renderNav();
      expect(screen.queryAllByRole('link', { name: 'Groups' })).toHaveLength(0);
    });

    it('shows auth-only links (Groups) when authenticated', () => {
      renderNav({ isAuthenticated: true, user: USER });
      expect(screen.getAllByRole('link', { name: 'Groups' }).length).toBeGreaterThan(0);
    });
  });

  describe('active route highlight', () => {
    it('applies active classes to the link matching the current route', () => {
      renderNav({ initialPath: '/about' });
      for (const link of screen.getAllByRole('link', { name: 'About' })) {
        expect(link).toHaveClass('text-accent-on-subtle');
        expect(link).toHaveAttribute('aria-current', 'page');
      }
    });

    it('does not mark non-active links as current', () => {
      renderNav({ initialPath: '/about' });
      for (const link of screen.getAllByRole('link', { name: 'Home' })) {
        expect(link).not.toHaveAttribute('aria-current');
      }
    });

    it('treats nested routes as active via prefix match', () => {
      renderNav({ isAuthenticated: true, user: USER, initialPath: '/groups/123' });
      for (const link of screen.getAllByRole('link', { name: 'Groups' })) {
        expect(link).toHaveAttribute('aria-current', 'page');
      }
    });

    it('does not prefix-match the root route', () => {
      renderNav({ initialPath: '/about' });
      for (const link of screen.getAllByRole('link', { name: 'Home' })) {
        expect(link).not.toHaveClass('text-primary-600');
      }
    });
  });

  describe('authentication state', () => {
    it('shows the Sign In CTA when unauthenticated', () => {
      renderNav();
      expect(screen.getByRole('button', { name: 'Sign In' })).toBeInTheDocument();
      expect(screen.queryByLabelText('User menu')).toBeNull();
    });

    it('navigates to /login when Sign In is clicked', () => {
      renderNav();
      fireEvent.click(screen.getByRole('button', { name: 'Sign In' }));
      expect(currentPath()).toBe('/login');
    });

    it('shows the user menu trigger when authenticated', () => {
      renderNav({ isAuthenticated: true, user: USER });
      expect(screen.getByLabelText('User menu')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sign In' })).toBeNull();
    });

    it('renders avatar initials when the user has no picture', () => {
      renderNav({ isAuthenticated: true, user: USER });
      expect(within(screen.getByLabelText('User menu')).getByText('JD')).toBeInTheDocument();
    });
  });

  describe('user menu', () => {
    it('is closed by default', () => {
      renderNav({ isAuthenticated: true, user: USER });
      expect(screen.queryByRole('menu')).toBeNull();
    });

    it('opens on click and shows Profile and Sign Out', () => {
      renderNav({ isAuthenticated: true, user: USER });
      fireEvent.click(screen.getByLabelText('User menu'));
      const menu = screen.getByRole('menu');
      expect(within(menu).getByText('Profile')).toBeInTheDocument();
      expect(within(menu).getByText('Sign Out')).toBeInTheDocument();
    });

    it('navigates to /profile from the Profile item', () => {
      renderNav({ isAuthenticated: true, user: USER });
      fireEvent.click(screen.getByLabelText('User menu'));
      fireEvent.click(screen.getByText('Profile'));
      expect(currentPath()).toBe('/profile');
    });

    it('clears auth and returns home on Sign Out', () => {
      const { auth } = renderNav({ isAuthenticated: true, user: USER, initialPath: '/groups' });
      fireEvent.click(screen.getByLabelText('User menu'));
      fireEvent.click(screen.getByText('Sign Out'));
      expect(auth.clearAuth).toHaveBeenCalledTimes(1);
      expect(currentPath()).toBe('/');
    });

    it('closes when clicking outside', () => {
      renderNav({ isAuthenticated: true, user: USER });
      fireEvent.click(screen.getByLabelText('User menu'));
      expect(screen.getByRole('menu')).toBeInTheDocument();
      fireEvent.mouseDown(document.body);
      expect(screen.queryByRole('menu')).toBeNull();
    });
  });

  describe('theme toggle', () => {
    it('calls toggle when clicked', () => {
      const { theme } = renderNav();
      fireEvent.click(screen.getByLabelText('Toggle theme'));
      expect(theme.toggle).toHaveBeenCalledTimes(1);
    });

    it('is hidden when showThemeToggle is false', () => {
      renderNav({ showThemeToggle: false });
      expect(screen.queryByLabelText('Toggle theme')).toBeNull();
    });
  });

  describe('mobile menu', () => {
    it('is off-canvas by default', () => {
      renderNav();
      expect(screen.getByLabelText('Mobile navigation')).toHaveClass('-translate-x-full');
    });

    it('slides in when the hamburger is clicked', () => {
      renderNav();
      fireEvent.click(screen.getByLabelText('Toggle mobile menu'));
      expect(screen.getByLabelText('Mobile navigation')).toHaveClass('translate-x-0');
    });

    it('closes via the close button', () => {
      renderNav();
      fireEvent.click(screen.getByLabelText('Toggle mobile menu'));
      fireEvent.click(screen.getByLabelText('Close menu'));
      expect(screen.getByLabelText('Mobile navigation')).toHaveClass('-translate-x-full');
    });
  });
});
