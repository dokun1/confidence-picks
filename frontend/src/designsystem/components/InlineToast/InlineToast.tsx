import { useEffect, useRef } from 'react';
import {
  InformationCircleIcon,
  CheckIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
} from '@heroicons/react/24/outline';

export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

export interface InlineToastProps {
  /** Whether the toast is currently visible. */
  open?: boolean;
  /** Text content to display inside the toast. */
  message?: string;
  /** Visual variant controlling color and icon. */
  variant?: ToastVariant;
  /** Milliseconds before auto-dismiss fires onClose. Default: 2000. */
  timeout?: number;
  /** Called when the auto-dismiss timer expires. Parent should set open=false. */
  onClose?: () => void;
}

const VARIANT_CLASSES: Record<ToastVariant, string> = {
  info: 'bg-secondary-900 text-neutral-0 dark:bg-secondary-100 dark:text-secondary-900',
  success: 'bg-success-600 text-neutral-0 dark:bg-success-500',
  warning: 'bg-warning-600 text-neutral-0 dark:bg-warning-500',
  error: 'bg-error-600 text-neutral-0 dark:bg-error-500',
};

const VARIANT_ICON: Record<ToastVariant, React.ComponentType<{ className?: string }>> = {
  info: InformationCircleIcon,
  success: CheckIcon,
  warning: ExclamationTriangleIcon,
  error: ExclamationCircleIcon,
};

/**
 * InlineToast displays a small contextual notification anchored to a
 * positioned parent element. It auto-dismisses after `timeout` ms by calling
 * `onClose` — the parent is responsible for setting `open` to false.
 *
 * Wrap the anchor element in a container with the `inline-toast-anchor` class
 * to establish the positioning context.
 */
export default function InlineToast({
  open = false,
  message = '',
  variant = 'info',
  timeout = 2000,
  onClose = () => {},
}: InlineToastProps) {
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (open) {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        onClose();
      }, timeout);
    }
    return () => {
      if (timerRef.current !== null) clearTimeout(timerRef.current);
    };
  }, [open, timeout, onClose]);

  if (!open) return null;

  const Icon = VARIANT_ICON[variant] ?? VARIANT_ICON.info;

  return (
    <div
      className={`pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-20 text-xs px-sm py-xs rounded shadow-md font-medium whitespace-nowrap flex items-center gap-1 transition-all duration-150 ${VARIANT_CLASSES[variant]}`}
      role="status"
      aria-live="polite"
    >
      <Icon className="w-3.5 h-3.5" />
      {message}
    </div>
  );
}
