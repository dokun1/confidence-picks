import {
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export type BannerVariant = 'info' | 'success' | 'warning' | 'error';

export interface BannerAction {
  /** Link/button text, e.g. "Make your picks". */
  label: string;
  /** Click handler — typically a deeplink navigation. */
  onClick: () => void;
}

export interface BannerProps {
  /** Visual tone + leading icon. Defaults to `info`. */
  variant?: BannerVariant;
  /** Banner copy. */
  children: React.ReactNode;
  /** Optional trailing call-to-action rendered as a tappable link. */
  action?: BannerAction;
}

// Subtle, persistent inline-alert palette (border + tinted surface), matching
// the hand-rolled error block this component generalizes. Distinct from
// InlineToast's solid, transient toast styling.
const VARIANT_CLASSES: Record<BannerVariant, string> = {
  info: 'bg-secondary-50 border-secondary-200 text-secondary-800 dark:bg-secondary-900/40 dark:border-secondary-700 dark:text-secondary-200',
  success: 'bg-success-50 border-success-200 text-success-800 dark:bg-success-900/20 dark:border-success-800 dark:text-success-200',
  warning: 'bg-warning-50 border-warning-200 text-warning-800 dark:bg-warning-900/20 dark:border-warning-800 dark:text-warning-200',
  error: 'bg-error-50 border-error-200 text-error-700 dark:bg-error-900/20 dark:border-error-800 dark:text-error-300',
};

const VARIANT_ICON: Record<BannerVariant, React.ComponentType<{ className?: string }>> = {
  info: InformationCircleIcon,
  success: CheckCircleIcon,
  warning: ExclamationTriangleIcon,
  error: ExclamationCircleIcon,
};

/**
 * A persistent, full-width inline alert with an icon, a message, and an optional
 * tappable action. Unlike InlineToast (a transient, auto-dismissing, absolutely
 * positioned popover), a Banner stays put in the document flow and is meant to
 * span its container — e.g. a "you have picks to make" notice above a tab bar.
 */
export default function Banner({ variant = 'info', children, action }: BannerProps) {
  const Icon = VARIANT_ICON[variant];
  return (
    <div
      role="status"
      className={`flex flex-col gap-xs rounded-base border p-md text-sm sm:flex-row sm:items-center sm:gap-sm ${VARIANT_CLASSES[variant]}`}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <span className="flex-1">{children}</span>
      {action && (
        <button
          type="button"
          onClick={action.onClick}
          className="self-start whitespace-nowrap font-semibold underline underline-offset-2 hover:no-underline sm:self-auto"
        >
          {action.label}
        </button>
      )}
    </div>
  );
}
