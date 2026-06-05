export type AppleSignInVariant = 'sign-in' | 'continue' | 'sign-up';
export type AppleSignInTheme = 'black' | 'white' | 'white-outline';
export type AppleSignInSize = 'small' | 'medium' | 'large';

export interface AppleSignInButtonProps {
  variant?: AppleSignInVariant;
  theme?: AppleSignInTheme;
  size?: AppleSignInSize;
  disabled?: boolean;
  loading?: boolean;
  onClick?: () => void;
}

// Apple's official button text, keyed by variant. Rendered as both the visible
// label and the accessible name so consumers can query the button by role/name.
const BUTTON_TEXT: Record<AppleSignInVariant, string> = {
  'sign-in': 'Sign in with Apple',
  continue: 'Continue with Apple',
  'sign-up': 'Sign up with Apple',
};

const BASE_CLASSES =
  'w-full inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed';

const SIZE_CLASSES: Record<AppleSignInSize, string> = {
  small: 'h-8 px-3 text-sm',
  medium: 'h-11 px-4 text-base',
  large: 'h-14 px-6 text-lg',
};

const THEME_CLASSES: Record<AppleSignInTheme, string> = {
  black: 'bg-black text-white hover:bg-gray-800 border-black',
  white: 'bg-white text-black hover:bg-gray-50 border-gray-300',
  'white-outline': 'bg-white text-black hover:bg-gray-50 border-black border-2',
};

// Apple logo (official Apple design). Inlined as JSX so it inherits currentColor
// from the button theme rather than being injected as raw HTML.
function AppleLogo() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-3 h-4 w-4"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/**
 * Apple-branded sign-in button (presentational only).
 *
 * Auth/brand-specific, so it lives in src/components/ rather than the design system.
 * The variant label is exposed as both the visible text and the aria-label so it can
 * be queried by accessible name. onClick fires only when not disabled and not loading.
 */
export default function AppleSignInButton({
  variant = 'continue',
  theme = 'black',
  size = 'medium',
  disabled = false,
  loading = false,
  onClick,
}: AppleSignInButtonProps) {
  const label = BUTTON_TEXT[variant];
  const classes = [BASE_CLASSES, SIZE_CLASSES[size], THEME_CLASSES[theme]].join(' ');

  function handleClick() {
    if (disabled || loading) {
      return;
    }
    onClick?.();
  }

  return (
    <button
      type="button"
      className={classes}
      disabled={disabled}
      onClick={handleClick}
      aria-label={label}
    >
      {loading ? (
        <>
          <Spinner />
          Signing in...
        </>
      ) : (
        <>
          <span className="w-5 h-5 mr-3 flex-shrink-0">
            <AppleLogo />
          </span>
          {label}
        </>
      )}
    </button>
  );
}
