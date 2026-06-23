export type NotificationDotSize = 'sm' | 'md';

export interface NotificationDotProps {
  /**
   * Accessible label describing what the dot is flagging, e.g. "Unread
   * messages" or "Picks available to make". Required — a bare dot is meaningless
   * to a screen reader.
   */
  label: string;
  /** Dot diameter. `sm` (8px) matches the inline tab indicator; `md` (10px) reads better on a card. */
  size?: NotificationDotSize;
  /**
   * Positioning / ring overrides. The dot is `inline-block` by default; pass
   * `absolute -top-0.5 -right-1.5` (etc.) to pin it to a positioned parent.
   */
  className?: string;
  /** Optional test hook so existing tests can keep their selectors. */
  'data-testid'?: string;
}

const SIZE_CLASSES: Record<NotificationDotSize, string> = {
  sm: 'h-2 w-2',
  md: 'h-2.5 w-2.5',
};

/**
 * A small red status dot signalling "something needs your attention here" —
 * unread chat, picks waiting to be made, etc. Purely presentational: the parent
 * decides when it shows and where it sits (pass positioning via `className`).
 *
 * Extracted from the inline Chat-tab unread indicator so every "needs
 * attention" affordance shares one definition and one color token.
 */
export default function NotificationDot({
  label,
  size = 'sm',
  className = '',
  'data-testid': testId,
}: NotificationDotProps) {
  return (
    <span
      role="status"
      aria-label={label}
      data-testid={testId}
      className={`inline-block rounded-full bg-error-500 ${SIZE_CLASSES[size]} ${className}`.trim()}
    />
  );
}
