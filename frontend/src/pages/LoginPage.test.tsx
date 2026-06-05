import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import LoginPage from './LoginPage';

// Mock AuthService so the test is not coupled to the network or window.location
// redirect. authService.js exports `default AuthService`, so the mock shape
// matches the default-export contract LoginPage imports against.
vi.mock('../lib/authService.js', () => ({
  default: {
    login: vi.fn(),
    getApiBaseUrl: vi.fn(() => 'http://localhost:3001'),
  },
}));

// Stub useAuth so LoginPage renders without the full provider stack. Reporting
// not-authenticated keeps the redirect-home effect inert for these assertions.
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false }),
}));

import AuthService from '../lib/authService.js';

function renderLoginPage() {
  return render(
    <MemoryRouter>
      <LoginPage />
    </MemoryRouter>
  );
}

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
