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
    const user = AuthService.getUser() as User | null;
    return { isAuthenticated: !!user, user };
  });

  // getUser() returns null once the short-lived access token expires, even
  // though the long-lived refresh token may still be valid. The pre-React app
  // silently refreshed on startup (App.svelte's checkAuthStatus); without
  // that, returning to the site after ~15 minutes looks like a logout.
  const [isRestoring, setIsRestoring] = useState<boolean>(
    () => !auth.isAuthenticated && !!AuthService.getRefreshToken()
  );

  useEffect(() => {
    if (!isRestoring) return;
    let cancelled = false;

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
        }
      } catch {
        if (!cancelled) {
          AuthService.clearTokens();
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
    // Runs once on mount; isRestoring can only go true→false after this.
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
