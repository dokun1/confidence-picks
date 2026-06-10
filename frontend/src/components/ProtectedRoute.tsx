import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute() {
  const { isAuthenticated, isRestoring } = useAuth();
  // While the silent token refresh runs on app load, render nothing rather
  // than redirecting — otherwise a returning user with a valid refresh token
  // gets bounced to /login before the session is restored.
  if (isRestoring) return null;
  return isAuthenticated ? <Outlet /> : <Navigate to="/login" replace />;
}
