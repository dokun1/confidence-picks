import { forwardRef } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'tertiary' | 'destructive';
export type ButtonSize = 'sm' | 'md' | 'lg';

export interface ButtonProps extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'type'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  href?: string | null;
  type?: 'button' | 'submit' | 'reset';
  children?: React.ReactNode;
}

const BASE_CLASSES =
  'inline-flex items-center justify-center font-medium transition-all duration-normal ease-smooth focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed active:translate-y-px disabled:active:translate-y-0';

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-sm py-xxxs text-sm rounded-pill h-10',
  md: 'px-lg py-xs text-base rounded-pill h-10',
  lg: 'px-xl py-sm text-lg rounded-pill h-10',
};

type ButtonState = 'default' | 'disabled';

const VARIANT_CLASSES: Record<ButtonVariant, Record<ButtonState, string>> = {
  primary: {
    default:
      'bg-accent text-accent-fg border border-accent-strong shadow-sm hover:bg-accent-strong hover:shadow-base focus:ring-accent',
    disabled:
      'bg-secondary-200 text-secondary-500 border-secondary-200 shadow-none cursor-not-allowed dark:bg-secondary-800 dark:text-secondary-400 dark:border-secondary-700',
  },
  secondary: {
    default:
      'bg-secondary-100 text-secondary-900 border border-secondary-300 shadow-sm hover:bg-secondary-200 hover:shadow-base focus:ring-secondary-500 dark:bg-secondary-800 dark:text-secondary-100 dark:border-secondary-600 dark:hover:bg-secondary-700',
    disabled:
      'bg-secondary-50 text-secondary-400 border-secondary-200 shadow-none cursor-not-allowed dark:bg-secondary-900 dark:text-secondary-600 dark:border-secondary-800',
  },
  tertiary: {
    default:
      'bg-transparent text-primary-600 border border-transparent shadow-none hover:bg-primary-50 hover:text-primary-700 focus:ring-primary-500 dark:text-primary-400 dark:hover:bg-primary-900 dark:hover:text-primary-300',
    disabled:
      'bg-transparent text-secondary-400 cursor-not-allowed dark:text-secondary-600',
  },
  destructive: {
    default:
      'bg-error-500 text-neutral-0 border border-error-600 shadow-sm hover:bg-error-600 hover:shadow-base focus:ring-error-500 dark:bg-error-600 dark:hover:bg-error-500 dark:border-error-500',
    disabled:
      'bg-secondary-200 text-secondary-500 border-secondary-200 shadow-none cursor-not-allowed dark:bg-secondary-800 dark:text-secondary-400 dark:border-secondary-700',
  },
};

function buildClasses(variant: ButtonVariant, size: ButtonSize, disabled: boolean): string {
  const variantMap = VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.primary;
  const state: ButtonState = disabled ? 'disabled' : 'default';
  return [BASE_CLASSES, SIZE_CLASSES[size], variantMap[state]].join(' ');
}

function Spinner() {
  return (
    <svg
      className="animate-spin -ml-1 mr-xs h-4 w-4"
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
 * Button component wrapping a native `<button>` element (or `<a>` when `href` is provided).
 *
 * Supports four visual variants, three sizes, disabled state, loading state with spinner,
 * and icon children. Uses `forwardRef` to expose the underlying `<button>` ref.
 */
const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    href = null,
    type = 'button',
    children,
    onClick,
    className,
    ...props
  },
  ref
) {
  const classes = [buildClasses(variant, size, disabled), className].filter(Boolean).join(' ');

  function handleClick(event: React.MouseEvent) {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    onClick?.(event as React.MouseEvent<HTMLButtonElement>);
  }

  if (href && !disabled) {
    return (
      <a
        href={href}
        className={classes}
        onClick={handleClick as React.MouseEventHandler<HTMLAnchorElement>}
        role="button"
        tabIndex={0}
        aria-disabled={disabled}
      >
        {loading && <Spinner />}
        {children}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled}
      onClick={handleClick as React.MouseEventHandler<HTMLButtonElement>}
      aria-disabled={disabled}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  );
});

export default Button;
