import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import HomePage from './HomePage';
import { useAuth } from '../contexts/AuthContext';

// HomePage reads auth state from AuthContext to choose its CTAs. Mock the hook
// so each test can pin authenticated/unauthenticated without the provider stack.
vi.mock('../contexts/AuthContext', () => ({ useAuth: vi.fn() }));

const mockedUseAuth = vi.mocked(useAuth);

// Surfaces the router's current pathname so CTA navigation is observable.
function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

function renderHome({ isAuthenticated = false } = {}) {
  mockedUseAuth.mockReturnValue({
    isAuthenticated,
    user: null,
    isRestoring: false,
    setAuthUser: vi.fn(),
    clearAuth: vi.fn(),
  });
  return render(
    <MemoryRouter initialEntries={['/']}>
      <HomePage />
      <LocationProbe />
    </MemoryRouter>
  );
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('HomePage', () => {
  describe('static marketing content', () => {
    it('renders the welcome heading', () => {
      renderHome();
      expect(
        screen.getByRole('heading', { name: 'Welcome to Confidence Picks!' })
      ).toBeInTheDocument();
    });

    it('renders the tagline', () => {
      renderHome();
      expect(screen.getByText(/Your destination for NFL confidence picks/)).toBeInTheDocument();
    });

    it('renders all three feature cards', () => {
      renderHome();
      expect(screen.getByRole('heading', { name: 'Weekly Games' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Confidence Picks' })).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Leaderboards' })).toBeInTheDocument();
    });

    it('renders the "Get Started" section regardless of auth state', () => {
      renderHome();
      expect(screen.getByRole('heading', { name: 'Get Started' })).toBeInTheDocument();
    });
  });

  describe('unauthenticated CTAs', () => {
    it('shows the sign-in and browse CTAs', () => {
      renderHome({ isAuthenticated: false });
      expect(
        screen.getByRole('button', { name: 'Sign In to Get Started' })
      ).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Browse Groups' })).toBeInTheDocument();
    });

    it('hides the authenticated CTAs', () => {
      renderHome({ isAuthenticated: false });
      expect(screen.queryByRole('button', { name: 'View Your Groups' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Create New Group' })).toBeNull();
    });

    it('navigates to /login from "Sign In to Get Started"', () => {
      renderHome({ isAuthenticated: false });
      fireEvent.click(screen.getByRole('button', { name: 'Sign In to Get Started' }));
      expect(currentPath()).toBe('/login');
    });

    it('navigates to /login from "Browse Groups"', () => {
      renderHome({ isAuthenticated: false });
      fireEvent.click(screen.getByRole('button', { name: 'Browse Groups' }));
      expect(currentPath()).toBe('/login');
    });
  });

  describe('authenticated CTAs', () => {
    it('shows the groups and create CTAs', () => {
      renderHome({ isAuthenticated: true });
      expect(screen.getByRole('button', { name: 'View Your Groups' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Create New Group' })).toBeInTheDocument();
    });

    it('hides the unauthenticated CTAs', () => {
      renderHome({ isAuthenticated: true });
      expect(screen.queryByRole('button', { name: 'Sign In to Get Started' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Browse Groups' })).toBeNull();
    });

    it('navigates to /groups from "View Your Groups"', () => {
      renderHome({ isAuthenticated: true });
      fireEvent.click(screen.getByRole('button', { name: 'View Your Groups' }));
      expect(currentPath()).toBe('/groups');
    });

    it('navigates to /create-group from "Create New Group"', () => {
      renderHome({ isAuthenticated: true });
      fireEvent.click(screen.getByRole('button', { name: 'Create New Group' }));
      expect(currentPath()).toBe('/create-group');
    });
  });
});
