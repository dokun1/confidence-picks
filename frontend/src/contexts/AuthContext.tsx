import { createContext, useContext, useState } from 'react';
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
  setAuthUser: (user: User) => void;
  clearAuth: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [auth, setAuth] = useState<{ isAuthenticated: boolean; user: User | null }>(() => {
    const user = AuthService.getUser() as User | null;
    return { isAuthenticated: !!user, user };
  });

  function setAuthUser(user: User) {
    setAuth({ isAuthenticated: true, user });
  }

  function clearAuth() {
    setAuth({ isAuthenticated: false, user: null });
  }

  return (
    <AuthContext.Provider value={{ ...auth, setAuthUser, clearAuth }}>
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
