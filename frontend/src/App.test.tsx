import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App, { AppRoutes } from './App';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';

// Mock AuthService.getUser — AuthProvider derives its initial auth state from it,
// so faking the return value is how we drive protected routes both ways without
// touching localStorage or token parsing. Same seam used by AuthContext.test.tsx.
vi.mock('./lib/authService.js', () => ({
  default: {
    getUser: vi.fn(),
    setTokens: vi.fn(),
    getCurrentUser: vi.fn(),
  },
}));

import AuthService from './lib/authService.js';
const mockGetUser = vi.mocked(AuthService.getUser);
const mockGetCurrentUser = vi.mocked(AuthService.getCurrentUser);

const TEST_USER = {
  id: 1,
  email: 'jane@example.com',
  name: 'Jane Doe',
  pictureUrl: null,
  provider: 'google',
};

// Surfaces the router's current pathname so a redirect is directly observable.
function LocationProbe() {
  const { pathname } = useLocation();
  return <div data-testid="location">{pathname}</div>;
}

// Mounts the named AppRoutes export — NOT the default App — so BrowserRouter is
// bypassed and we can seed the entry path via MemoryRouter. The real Theme/Auth
// providers wrap it; authentication is controlled purely through mockGetUser.
function renderAt(path: string, { authenticated = false } = {}) {
  mockGetUser.mockReturnValue(authenticated ? (TEST_USER as never) : null);
  return render(
    <ThemeProvider>
      <AuthProvider>
        <MemoryRouter initialEntries={[path]}>
          <AppRoutes />
          <LocationProbe />
        </MemoryRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}

// Page headings are <h1>; Navigation renders same-named <a> links, so querying by
// heading role disambiguates the page from its nav link (e.g. the "Groups" link).
function heading(name: string) {
  return screen.getByRole('heading', { name });
}

function currentPath() {
  return screen.getByTestId('location').textContent;
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetUser.mockReturnValue(null);
  // Unauthenticated callback: no user comes back, so AuthCallback routes to /login.
  mockGetCurrentUser.mockResolvedValue(null as never);
});

describe('App', () => {
  it('App renders without crashing', () => {
    render(<App />);
  });
});

describe('AppRoutes', () => {
  describe('public routes', () => {
    it('renders Home at /', () => {
      renderAt('/');
      // HomePage's ported marketing landing leads with this <h1>.
      expect(heading('Welcome to Confidence Picks!')).toBeInTheDocument();
    });

    it('renders About at /about', () => {
      renderAt('/about');
      expect(heading('About')).toBeInTheDocument();
    });

    it('renders Login at /login', () => {
      renderAt('/login');
      expect(heading('Login')).toBeInTheDocument();
    });
  });

  describe('catch-all', () => {
    it('renders the NotFoundPage for an unknown path', () => {
      renderAt('/this-route-does-not-exist');
      expect(heading('Page not found')).toBeInTheDocument();
    });
  });

  describe('protected routes', () => {
    it('renders Groups when authenticated', () => {
      renderAt('/groups', { authenticated: true });
      expect(heading('Groups')).toBeInTheDocument();
    });

    it('redirects to /login when unauthenticated', () => {
      renderAt('/groups', { authenticated: false });
      expect(currentPath()).toBe('/login');
      expect(heading('Login')).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'Groups' })).toBeNull();
    });
  });

  describe('auth callback', () => {
    // /auth/callback sits OUTSIDE ProtectedRoute because the OAuth handshake runs
    // from an unauthenticated state. With no tokens in the URL and no user to
    // hydrate, AuthCallback finalizes by redirecting to /login.
    it('redirects to /login when unauthenticated', async () => {
      renderAt('/auth/callback', { authenticated: false });
      await waitFor(() => expect(currentPath()).toBe('/login'));
      expect(heading('Login')).toBeInTheDocument();
    });
  });
});
