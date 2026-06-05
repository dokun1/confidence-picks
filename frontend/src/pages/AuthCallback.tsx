import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthService from '../lib/authService.js';
import { useAuth, type User } from '../contexts/AuthContext';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { setAuthUser } = useAuth();

  // Runs once on mount: the OAuth provider redirects here with the freshly
  // minted tokens in the query string. We persist them, hydrate the user, and
  // route onward — falling back to /login with a toast on any failure.
  useEffect(() => {
    let cancelled = false;

    async function finalize() {
      const params = new URLSearchParams(window.location.search);
      const accessToken = params.get('accessToken');
      const refreshToken = params.get('refreshToken');

      if (!accessToken) {
        navigate('/login', {
          replace: true,
          state: { toast: { variant: 'error', message: 'Sign-in failed: missing tokens' } },
        });
        return;
      }

      AuthService.setTokens(accessToken, refreshToken ?? '');

      try {
        const user = await AuthService.getCurrentUser();
        if (cancelled) return;
        if (user) {
          // AuthService types `user` as AuthUser (provider optional); the auth
          // context's User requires it. Mirror the cast already used in
          // AuthContext.tsx where getUser() is widened to User.
          setAuthUser(user as User);
          navigate('/', { replace: true });
        } else {
          navigate('/login', {
            replace: true,
            state: { toast: { variant: 'error', message: 'Sign-in failed: could not load your account' } },
          });
        }
      } catch {
        if (cancelled) return;
        navigate('/login', {
          replace: true,
          state: { toast: { variant: 'error', message: 'Sign-in failed: could not load your account' } },
        });
      }
    }

    finalize();
    return () => {
      cancelled = true;
    };
    // Intentionally run once on mount; navigate/setAuthUser are stable.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className='min-h-screen flex items-center justify-center p-lg'>
      <h1 className='text-2xl font-bold'>Signing you in&hellip;</h1>
    </div>
  );
}
