import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './LoginPage';
import { POST_LOGIN_REDIRECT_KEY } from '../lib/postLoginRedirect';

// Mock AuthService so the test is not coupled to the network or window.location
// redirect. authService.js exports `default AuthService`, so the mock shape
// matches the default-export contract LoginPage imports against.
vi.mock('../lib/authService.js', () => ({
  default: {
    login: vi.fn(),
    getApiBaseUrl: vi.fn(() => 'http://localhost:3001'),
  },
}));

// Stub useAuth so LoginPage renders without the full provider stack. Default to
// not-authenticated so the redirect-home effect stays inert; individual tests
// override mockIsAuthenticated as needed.
let mockIsAuthenticated = false;
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: mockIsAuthenticated }),
}));

// Stub useNavigate so the already-authenticated redirect is observable.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

import AuthService from '../lib/authService.js';

function renderLoginPage(initialEntry = '/login') {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsAuthenticated = false;
    sessionStorage.clear();
  });

  it('renders the Google sign in button', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /Google/ })).toBeInTheDocument();
  });

  it('renders the Apple sign in button', () => {
    renderLoginPage();
    expect(screen.getByRole('button', { name: /Apple/ })).toBeInTheDocument();
  });

  it('starts Google OAuth via AuthService.login when the Google button is clicked', () => {
    renderLoginPage();
    fireEvent.click(screen.getByRole('button', { name: /Google/ }));
    expect(vi.mocked(AuthService.login)).toHaveBeenCalledTimes(1);
  });

  it('stashes the ?next destination before starting Google OAuth so the callback can return there', () => {
    renderLoginPage(`/login?next=${encodeURIComponent('/invite/tok-123')}`);
    fireEvent.click(screen.getByRole('button', { name: /Google/ }));
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/invite/tok-123');
    expect(vi.mocked(AuthService.login)).toHaveBeenCalledTimes(1);
  });

  it('accepts the legacy ?redirect alias for the post-login destination', () => {
    renderLoginPage(`/login?redirect=${encodeURIComponent('/groups')}`);
    fireEvent.click(screen.getByRole('button', { name: /Google/ }));
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/groups');
  });

  it('does not stash an off-site ?next (open-redirect guard)', () => {
    renderLoginPage(`/login?next=${encodeURIComponent('https://evil.com')}`);
    fireEvent.click(screen.getByRole('button', { name: /Google/ }));
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull();
  });

  it('redirects an already-authenticated user to ?next instead of home', () => {
    mockIsAuthenticated = true;
    renderLoginPage(`/login?next=${encodeURIComponent('/invite/tok-123')}`);
    expect(mockNavigate).toHaveBeenCalledWith('/invite/tok-123', { replace: true });
  });

  it('redirects an already-authenticated user home when no destination is given', () => {
    mockIsAuthenticated = true;
    renderLoginPage('/login');
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('redirects to the Apple OAuth start when the Apple button is clicked', () => {
    // window.location is read-only in jsdom; redefine it with a writable href so
    // the handler's assignment is observable, then restore the original.
    const originalLocation = window.location;
    Object.defineProperty(window, 'location', {
      configurable: true,
      writable: true,
      value: { href: '' },
    });

    try {
      renderLoginPage();
      fireEvent.click(screen.getByRole('button', { name: /Apple/ }));
      expect(window.location.href).toBe('http://localhost:3001/auth/apple');
    } finally {
      Object.defineProperty(window, 'location', {
        configurable: true,
        writable: true,
        value: originalLocation,
      });
    }
  });
});
