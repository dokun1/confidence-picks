import { render, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AuthCallback from './AuthCallback';

// Mock AuthService so the test is not coupled to localStorage or the network.
vi.mock('../lib/authService.js', () => ({
  default: {
    setTokens: vi.fn(),
    getCurrentUser: vi.fn(),
    getUser: vi.fn(),
  },
}));

// Keep the real react-router exports (MemoryRouter etc.), stub only useNavigate.
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>();
  return { ...actual, useNavigate: () => mockNavigate };
});

// Stub useAuth so we can assert on setAuthUser without the provider stack.
const mockSetAuthUser = vi.fn();
vi.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ setAuthUser: mockSetAuthUser }),
}));

import AuthService from '../lib/authService.js';
const mockSetTokens = vi.mocked(AuthService.setTokens);
const mockGetCurrentUser = vi.mocked(AuthService.getCurrentUser);

const testUser = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  pictureUrl: null,
  provider: 'google',
};

describe('AuthCallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('persists tokens, hydrates the user, and redirects home on success', async () => {
    window.history.pushState({}, '', '/auth/callback?accessToken=A&refreshToken=B');
    mockGetCurrentUser.mockResolvedValue(testUser as any);

    render(
      <MemoryRouter>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());

    expect(mockSetTokens).toHaveBeenCalledWith('A', 'B');
    expect(mockSetAuthUser).toHaveBeenCalledWith(testUser);
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  // Regression: backend/src/routes/auth.js redirects to
  // /auth/callback?token=…&refresh=… (NOT accessToken/refreshToken).
  // Prior to fix/auth-callback-param-names the React AuthCallback only read
  // the long-form names, so every successful OAuth round-trip silently fell
  // through to the missing-tokens branch and bounced the user back to /login.
  // This test pins the actual backend contract so any future regression of
  // the param names trips a unit test rather than reaching prod.
  it('persists tokens and hydrates the user when given the backend "?token=&refresh=" shape', async () => {
    window.history.pushState({}, '', '/auth/callback?token=BACKEND_ACCESS&refresh=BACKEND_REFRESH');
    mockGetCurrentUser.mockResolvedValue(testUser as any);

    render(
      <MemoryRouter>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());

    expect(mockSetTokens).toHaveBeenCalledWith('BACKEND_ACCESS', 'BACKEND_REFRESH');
    expect(mockSetAuthUser).toHaveBeenCalledWith(testUser);
    expect(mockNavigate).toHaveBeenCalledWith('/', { replace: true });
  });

  it('redirects to /login with an error toast when tokens are missing', async () => {
    window.history.pushState({}, '', '/auth/callback');

    render(
      <MemoryRouter>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());

    expect(mockNavigate).toHaveBeenCalledWith(
      '/login',
      expect.objectContaining({ replace: true, state: expect.any(Object) })
    );
    expect(mockSetTokens).not.toHaveBeenCalled();
  });

  it('redirects to /login when getCurrentUser returns null', async () => {
    window.history.pushState({}, '', '/auth/callback?accessToken=A&refreshToken=B');
    mockGetCurrentUser.mockResolvedValue(null);

    render(
      <MemoryRouter>
        <AuthCallback />
      </MemoryRouter>
    );

    await waitFor(() => expect(mockNavigate).toHaveBeenCalled());

    expect(mockSetTokens).toHaveBeenCalledWith('A', 'B');
    expect(mockSetAuthUser).not.toHaveBeenCalled();
    expect(mockNavigate).toHaveBeenCalledWith(
      '/login',
      expect.objectContaining({ replace: true, state: expect.any(Object) })
    );
  });
});
