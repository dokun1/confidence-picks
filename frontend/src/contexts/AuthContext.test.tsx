import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useContext } from 'react';
import { AuthProvider, useAuth } from './AuthContext';
import type { User } from './AuthContext';

// Mock AuthService so tests are not coupled to localStorage
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

// Helper: render a consumer component inside AuthProvider
function renderWithProvider(ui: React.ReactNode) {
  return render(<AuthProvider>{ui}</AuthProvider>);
}

// Simple consumer that exposes context values via data attributes for assertions
function AuthConsumer() {
  const { isAuthenticated, user, setAuthUser, clearAuth } = useAuth();
  return (
    <div>
      <span data-testid="isAuthenticated">{String(isAuthenticated)}</span>
      <span data-testid="userId">{user?.id ?? 'null'}</span>
      <span data-testid="userName">{user?.name ?? 'null'}</span>
      <button onClick={() => setAuthUser(testUser)}>set user</button>
      <button onClick={() => clearAuth()}>clear</button>
    </div>
  );
}

describe('AuthContext', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  describe('AuthProvider — lazy initialization', () => {
    it('initializes as authenticated when AuthService.getUser() returns a user', () => {
      mockGetUser.mockReturnValue(testUser as any);
      renderWithProvider(<AuthConsumer />);

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('userId').textContent).toBe('1');
      expect(screen.getByTestId('userName').textContent).toBe('Test User');
    });

    it('initializes as unauthenticated when AuthService.getUser() returns null', () => {
      mockGetUser.mockReturnValue(null);
      renderWithProvider(<AuthConsumer />);

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });

    it('does NOT call AuthService.getCurrentUser() on mount', () => {
      // getCurrentUser is a network call — it must never be invoked during init
      const getCurrentUser = vi.fn();
      (AuthService as any).getCurrentUser = getCurrentUser;

      mockGetUser.mockReturnValue(null);
      renderWithProvider(<AuthConsumer />);

      expect(getCurrentUser).not.toHaveBeenCalled();
    });
  });

  describe('setAuthUser', () => {
    it('sets isAuthenticated to true and stores the user', () => {
      mockGetUser.mockReturnValue(null);
      renderWithProvider(<AuthConsumer />);

      act(() => {
        screen.getByText('set user').click();
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('userId').textContent).toBe('1');
      expect(screen.getByTestId('userName').textContent).toBe('Test User');
    });
  });

  describe('clearAuth', () => {
    it('resets isAuthenticated to false and user to null', () => {
      mockGetUser.mockReturnValue(testUser as any);
      renderWithProvider(<AuthConsumer />);

      // Start authenticated
      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');

      act(() => {
        screen.getByText('clear').click();
      });

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('false');
      expect(screen.getByTestId('userId').textContent).toBe('null');
    });
  });

  describe('useAuth — outside provider', () => {
    it('throws when used outside AuthProvider', () => {
      // Suppress React's error boundary output to keep test output clean
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      function Bare() {
        useAuth();
        return null;
      }

      expect(() => render(<Bare />)).toThrow('useAuth must be used within an AuthProvider');
      consoleError.mockRestore();
    });
  });

  describe('edge cases', () => {
    it('handles a user with a null pictureUrl', () => {
      const userNoPicture: User = { ...testUser, pictureUrl: null };
      mockGetUser.mockReturnValue(userNoPicture as any);
      renderWithProvider(<AuthConsumer />);

      expect(screen.getByTestId('isAuthenticated').textContent).toBe('true');
      expect(screen.getByTestId('userId').textContent).toBe('1');
    });

    it('AuthService.getUser() is called exactly once during provider initialization', () => {
      mockGetUser.mockReturnValue(null);
      renderWithProvider(<AuthConsumer />);

      // useState lazy initializer runs once on mount
      expect(mockGetUser).toHaveBeenCalledTimes(1);
    });
  });
});
