import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import HomePage from './pages/HomePage';
import AboutPage from './pages/AboutPage';
import LoginPage from './pages/LoginPage';
import AuthCallback from './pages/AuthCallback';
import ProfilePage from './pages/ProfilePage';
import GroupsPage from './pages/GroupsPage';
import CreateGroupPage from './pages/CreateGroupPage';
import JoinGroupPage from './pages/JoinGroupPage';
import GroupDetailsPage from './pages/GroupDetailsPage';
import EditGroupPage from './pages/EditGroupPage';
import GamesPage from './pages/GamesPage';
import WorldCupPicksPage from './pages/WorldCupPicksPage';
import InvitePage from './pages/InvitePage';
import NotFoundPage from './pages/NotFoundPage';

// Routing tree only — no providers, no router. Exported so MemoryRouter-based
// unit tests can mount the routes directly without the full provider stack.
export function AppRoutes() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/login" element={<LoginPage />} />
        {/* OAuth handshake runs from an unauthenticated state — not protected. */}
        <Route path="/auth/callback" element={<AuthCallback />} />
        {/* Invite acceptance is public: a signed-out user must be able to view
            the invite and be routed to sign in (preserving the token). */}
        <Route path="/invite/:token" element={<InvitePage />} />
        <Route element={<ProtectedRoute />}>
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/groups" element={<GroupsPage />} />
          <Route path="/create-group" element={<CreateGroupPage />} />
          <Route path="/join-group" element={<JoinGroupPage />} />
          <Route path="/group-details" element={<GroupDetailsPage />} />
          <Route path="/edit-group/:identifier" element={<EditGroupPage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/world-cup" element={<WorldCupPicksPage />} />
          {/* Bare /invite (no token) carries no invitation to accept, so it sits
              behind auth and redirects signed-out users to /login. The public,
              token-bearing acceptance flow is the separate /invite/:token route
              declared above. */}
          <Route path="/invite" element={<InvitePage />} />
        </Route>
        {/* NotFoundPage's derived /not-found route is intentionally undeclared;
            it falls through to this catch-all. */}
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
}
