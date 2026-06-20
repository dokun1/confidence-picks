import { renderHook, act, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import type { User } from './AuthContext';

// Mock AuthService so tests are not coupled to localStorage or token parsing
vi.mock('../lib/authService.js', () => ({
  default: {
    getUser: vi.fn(),
    getCachedUser: vi.fn(),
    isAccessTokenValid: vi.fn(),
    getRefreshToken: vi.fn(),
    refreshToken: vi.fn(),
    getCurrentUser: vi.fn(),
    clearTokens: vi.fn(),
  },
}));

import AuthService from '../lib/authService.js';
const mockGetUser = vi.mocked(AuthService.getUser);
const mockGetCachedUser = vi.mocked(AuthService.getCachedUser);
const mockIsAccessTokenValid = vi.mocked(AuthService.isAccessTokenValid);
const mockGetRefreshToken = vi.mocked(AuthService.getRefreshToken);
const mockRefreshToken = vi.mocked(AuthService.refreshToken);
const mockGetCurrentUser = vi.mocked(AuthService.getCurrentUser);
const mockClearTokens = vi.mocked(AuthService.clearTokens);

const testUser: User = {
  id: 1,
  email: 'test@example.com',
  name: 'Test User',
  pictureUrl: 'https://example.com/pic.jpg',
  provider: 'google',
};

describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    // Safe defaults: no cached profile, access token treated as expired. Tests
    // that exercise the warm-cache / valid-token paths override these.
    mockGetCachedUser.mockReturnValue(null);
    mockIsAccessTokenValid.mockReturnValue(false);
  });

  // Test 1: getUser() returns null → isAuthenticated=false, user=null
  it('initializes as unauthenticated when getUser() returns null', () => {
    mockGetUser.mockReturnValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  // Test 2: getUser() returns a user object → isAuthenticated=true, user=that object
  it('initializes as authenticated when getUser() returns a user', () => {
    mockGetUser.mockReturnValue(testUser as any);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(testUser);
  });

  // Test 3: setAuthUser(user) → isAuthenticated=true, user updated
  it('setAuthUser sets isAuthenticated to true and stores the user', () => {
    mockGetUser.mockReturnValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      result.current.setAuthUser(testUser);
    });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(testUser);
  });

  // Test 4: clearAuth() → isAuthenticated=false, user=null
  it('clearAuth resets isAuthenticated to false and user to null', () => {
    mockGetUser.mockReturnValue(testUser as any);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.clearAuth();
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });

  // Test 5: useAuth() outside AuthProvider throws
  it('throws when useAuth is called outside AuthProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );

    consoleError.mockRestore();
  });

  // Additional coverage — edge cases

  it('AuthService.getUser() is called exactly once during provider initialization', () => {
    mockGetUser.mockReturnValue(null);
    renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(mockGetUser).toHaveBeenCalledTimes(1);
  });

  it('handles a user with a null pictureUrl', () => {
    const userNoPicture: User = { ...testUser, pictureUrl: null };
    mockGetUser.mockReturnValue(userNoPicture as any);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user?.pictureUrl).toBeNull();
  });

  // Silent session restore on mount (expired access token + valid refresh token)

  it('silently refreshes and restores the session when the access token is expired but a refresh token exists', async () => {
    // First getUser() call (state init) sees an expired access token; after a
    // successful refresh the second call returns the user again.
    mockGetUser.mockReturnValueOnce(null).mockReturnValue(testUser as any);
    mockGetRefreshToken.mockReturnValue('valid-refresh-token');
    mockRefreshToken.mockResolvedValue('new-access-token');

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // Refresh is in flight: not yet authenticated, but flagged as restoring
    // so route guards don't redirect to /login.
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.isRestoring).toBe(true);

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    expect(result.current.user).toEqual(testUser);
    expect(result.current.isRestoring).toBe(false);
    expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it('falls back to getCurrentUser() when getUser() is still null after refresh', async () => {
    mockGetUser.mockReturnValue(null);
    mockGetRefreshToken.mockReturnValue('valid-refresh-token');
    mockRefreshToken.mockResolvedValue('new-access-token');
    mockGetCurrentUser.mockResolvedValue(testUser as any);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isAuthenticated).toBe(true);
    });
    expect(result.current.user).toEqual(testUser);
    expect(mockGetCurrentUser).toHaveBeenCalledTimes(1);
  });

  it('clears tokens and stays unauthenticated when the silent refresh fails', async () => {
    mockGetUser.mockReturnValue(null);
    mockGetRefreshToken.mockReturnValue('revoked-refresh-token');
    mockRefreshToken.mockRejectedValue(new Error('Failed to refresh token'));

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    await waitFor(() => {
      expect(result.current.isRestoring).toBe(false);
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(mockClearTokens).toHaveBeenCalledTimes(1);
  });

  it('does not attempt a refresh when there is no refresh token', () => {
    mockGetUser.mockReturnValue(null);
    mockGetRefreshToken.mockReturnValue(null);

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isRestoring).toBe(false);
    expect(result.current.isAuthenticated).toBe(false);
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  it('does not attempt a refresh when the access token is still valid', () => {
    mockGetUser.mockReturnValue(testUser as any);
    mockIsAccessTokenValid.mockReturnValue(true);
    mockGetRefreshToken.mockReturnValue('valid-refresh-token');

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    expect(result.current.isRestoring).toBe(false);
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockRefreshToken).not.toHaveBeenCalled();
  });

  // The key returning-visitor optimization: when the access token has expired
  // but we still have the cached profile + a refresh token, the app paints the
  // user immediately (no logged-out flash, no blocking) and refreshes silently
  // in the background.
  it('optimistically authenticates from the cached profile while refreshing in the background', async () => {
    mockGetUser.mockReturnValue(null); // access token expired
    mockGetCachedUser.mockReturnValue(testUser as any); // but profile is cached
    mockGetRefreshToken.mockReturnValue('valid-refresh-token');
    mockRefreshToken.mockResolvedValue('new-access-token');
    mockGetCurrentUser.mockResolvedValue(testUser as any); // background reconcile

    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    // Painted immediately — no blank/logged-out interstitial.
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.user).toEqual(testUser);
    expect(result.current.isRestoring).toBe(false);

    // And the token is refreshed silently in the background.
    await waitFor(() => {
      expect(mockRefreshToken).toHaveBeenCalledTimes(1);
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(mockClearTokens).not.toHaveBeenCalled();
  });

  it('setAuthUser followed by clearAuth returns to unauthenticated state', () => {
    mockGetUser.mockReturnValue(null);
    const { result } = renderHook(() => useAuth(), { wrapper: AuthProvider });

    act(() => {
      result.current.setAuthUser(testUser);
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      result.current.clearAuth();
    });
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});
