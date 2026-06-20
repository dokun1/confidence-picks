import { createContext, useContext, useEffect, useState } from 'react';
import AuthService from '../lib/authService.js';

export interface User {
  id: number;
  email: string;
  name: string;
  pictureUrl: string | null;
  provider: string;
}

export interface AuthContextValue {
  isAuthenticated: boolean;
  user: User | null;
  /** True while a silent token refresh is in flight on app load. Consumers
      that would redirect unauthenticated users (e.g. ProtectedRoute) should
      wait for this to settle instead of bouncing to /login. */
  isRestoring: boolean;
  setAuthUser: (user: User) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<{ isAuthenticated: boolean; user: User | null }>(() => {
    // getUser() returns null once the short-lived (~15m) access token expires.
    // But a returning visitor almost always still has BOTH a valid refresh
    // token and the full profile we cached from /auth/me last time. Rather than
    // render a logged-out shell while we round-trip to refresh, optimistically
    // paint that cached identity immediately and reconcile in the background.
    const user =
      (AuthService.getUser() as User | null) ??
      (AuthService.getRefreshToken()
        ? (AuthService.getCachedUser() as User | null)
        : null);
    return { isAuthenticated: !!user, user };
  });

  // We only need to block the UI when there's a refresh token but nothing to
  // paint yet (e.g. cached profile was cleared but tokens remain). With a warm
  // cache the app is already showing the user, so the refresh below is silent.
  const [isRestoring, setIsRestoring] = useState<boolean>(
    () => !auth.isAuthenticated && !!AuthService.getRefreshToken()
  );

  useEffect(() => {
    // Nothing to reconcile: either the access token is still valid, or the user
    // is genuinely signed out (no refresh token).
    if (AuthService.isAccessTokenValid() || !AuthService.getRefreshToken()) {
      return;
    }
    let cancelled = false;

    // Silent background restore. The UI is already showing the cached user
    // (isRestoring=false), so this just swaps the expired access token for a
    // fresh one and refreshes the profile — without any logged-out flash.
    async function restoreSession() {
      try {
        await AuthService.refreshToken();
        const user =
          (AuthService.getUser() as User | null) ??
          ((await AuthService.getCurrentUser()) as User | null);
        if (cancelled) return;
        if (user) {
          setAuth({ isAuthenticated: true, user });
        } else {
          AuthService.clearTokens();
          setAuth({ isAuthenticated: false, user: null });
        }
      } catch {
        if (!cancelled) {
          AuthService.clearTokens();
          setAuth({ isAuthenticated: false, user: null });
        }
      } finally {
        if (!cancelled) {
          setIsRestoring(false);
        }
      }
    }

    restoreSession();
    return () => {
      cancelled = true;
    };
    // Runs once on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function setAuthUser(user: User) {
    setAuth({ isAuthenticated: true, user });
  }

  function clearAuth() {
    setAuth({ isAuthenticated: false, user: null });
  }

  return (
    <AuthContext.Provider value={{ ...auth, isRestoring, setAuthUser, clearAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
