import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import AuthService from '../lib/authService.js';
import AppleSignInButton from '../components/AppleSignInButton';

// Maps the `?error=` code the OAuth callback appends on failure to a friendly
// message. Unknown codes fall back to a generic line so a new backend error
// never renders blank.
const ERROR_MESSAGES: Record<string, string> = {
  callback_failed: 'Authentication failed. Please try signing in again.',
  no_tokens: 'No authentication tokens received. Please try again.',
  apple_not_configured: 'Apple Sign In is not yet configured. Please use Google Sign In for now.',
  apple_callback_failed: 'Apple authentication failed. Please try again or use Google Sign In.',
};

export default function LoginPage() {
  const navigate = useNavigate();
  const { isAuthenticated } = useAuth();
  const [searchParams] = useSearchParams();

  const errorParam = searchParams.get('error');
  const error = errorParam
    ? ERROR_MESSAGES[errorParam] ?? 'An error occurred during authentication.'
    : '';

  // Already signed in? Skip the login screen.
  useEffect(() => {
    if (isAuthenticated) {
      navigate('/', { replace: true });
    }
  }, [isAuthenticated, navigate]);

  // Stash where the user was headed (if they arrived via a guarded link) so the
  // post-OAuth callback can return them there. Best-effort: a blocked
  // sessionStorage must not stop sign-in.
  function captureRedirect() {
    const redirect = searchParams.get('redirect');
    if (!redirect) return;
    try {
      sessionStorage.setItem('postLoginRedirect', decodeURIComponent(redirect));
    } catch {
      /* sessionStorage unavailable (private mode, etc.) — proceed without it */
    }
  }

  function handleGoogleSignIn() {
    captureRedirect();
    AuthService.login();
  }

  function handleAppleSignIn() {
    captureRedirect();
    window.location.href = `${AuthService.getApiBaseUrl()}/auth/apple`;
  }

  return (
    <div className="flex min-h-[60vh] items-center justify-center">
      <div className="mx-auto w-full max-w-md px-sm py-lg sm:px-lg">
        <div className="space-y-lg text-center">
          {/* Logo */}
          <div className="space-y-md">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary-500">
              <svg
                className="h-8 w-8 text-neutral-0"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="1.5"
                  d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.018 9.018 0 01-2.48 5.228m2.48-5.492a46.95 46.95 0 01-2.48-.546M18.75 4.236v1.516c-.822-.1-1.653-.184-2.48-.546"
                />
              </svg>
            </div>
            {/* Heading text is exactly "Login" — App.test.tsx and the e2e smoke
                spec resolve this page via getByRole('heading', { name: 'Login' }). */}
            <h1 className="font-heading text-3xl font-bold text-[var(--color-text-primary)]">
              Login
            </h1>
            <p className="text-lg text-[var(--color-text-secondary)]">
              Welcome to Confidence Picks — sign in to start making your NFL picks and compete with
              friends.
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div
              role="alert"
              className="rounded-base border border-error-200 bg-error-50 p-md dark:border-error-800 dark:bg-error-900"
            >
              <p className="text-error-700 dark:text-error-300">{error}</p>
            </div>
          )}

          {/* Sign In Options */}
          <div className="space-y-md">
            <h2 className="font-heading text-xl font-semibold text-[var(--color-text-primary)]">
              Choose your sign in method
            </h2>

            {/* Google Sign In */}
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex w-full items-center justify-center rounded-base border border-secondary-300 bg-neutral-0 px-lg py-md text-base font-medium transition-colors duration-fast hover:bg-secondary-50 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 dark:border-secondary-600 dark:bg-secondary-800 dark:hover:bg-secondary-700"
            >
              <svg className="mr-sm h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Continue with Google
            </button>

            {/* Apple Sign In */}
            <AppleSignInButton variant="continue" theme="black" size="medium" onClick={handleAppleSignIn} />
          </div>

          {/* Terms */}
          <p className="text-sm text-[var(--color-text-secondary)]">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>

          {/* Back to Home */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="text-sm font-medium text-primary-600 transition-colors duration-fast hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300"
          >
            ← Back to Home
          </button>
        </div>
      </div>
    </div>
  );
}
