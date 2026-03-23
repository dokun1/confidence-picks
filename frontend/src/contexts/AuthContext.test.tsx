import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthProvider, useAuth } from './AuthContext';
import type { User } from './AuthContext';

// Mock AuthService so tests are not coupled to localStorage or token parsing
vi.mock('../lib/authService.js', () => ({
  default: {
    getUser: vi.fn(),
  },
}));

import AuthService from '../lib/authService.js';
const mockGetUser = vi.mocked(AuthService.getUser);

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
