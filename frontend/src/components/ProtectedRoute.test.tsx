import { describe, it, vi } from 'vitest';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import type { AuthContextValue } from '../contexts/AuthContext';

vi.mock('../contexts/AuthContext', () => {
  const mockUseAuth = vi.fn<() => AuthContextValue>(() => ({
    isAuthenticated: false,
    user: null,
    setAuthUser: vi.fn(),
    clearAuth: vi.fn(),
  }));

  return { useAuth: mockUseAuth };
});

import { useAuth } from '../contexts/AuthContext';
import ProtectedRoute from './ProtectedRoute';

const mockUseAuth = vi.mocked(useAuth);

function HelperChild() {
  return <div data-testid="protected-content">Inside</div>;
}

describe('ProtectedRoute', () => {
  describe('when unauthenticated', () => {
    it.todo('renders nothing at the protected route and redirects to /login');
    it.todo('does not render the child Outlet content');
    it.todo('replaces history so back button does not loop to protected route');
  });

  describe('when authenticated', () => {
    it.todo('renders the child Outlet content');
    it.todo('does not redirect to /login');
  });
});
