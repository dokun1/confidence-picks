export type SpinnerSize = 'sm' | 'md' | 'lg';

export interface SpinnerProps {
  /** Visual size of the spinner ring. */
  size?: SpinnerSize;
  /** Optional visible label rendered beside the ring (e.g. "Loading groups…"). */
  label?: string;
  className?: string;
}

const SIZE_CLASSES: Record<SpinnerSize, string> = {
  sm: 'h-4 w-4 border-2',
  md: 'h-8 w-8 border-2',
  lg: 'h-12 w-12 border-[3px]',
};

/**
 * Accent-colored loading spinner. Replaces the hand-rolled
 * `animate-spin rounded-full border-b-2` markup duplicated across pages.
 *
 * Renders an accessible status region; pass `label` for a visible caption,
 * otherwise an `sr-only` "Loading…" is announced.
 */
export default function Spinner({ size = 'md', label, className = '' }: SpinnerProps) {
  return (
    <div role="status" className={`flex items-center gap-sm ${className}`.trim()}>
      <div
        className={`animate-spin rounded-full border-current border-b-transparent text-accent ${SIZE_CLASSES[size]}`}
        aria-hidden="true"
      />
      {label ? (
        <span className="text-content-muted">{label}</span>
      ) : (
        <span className="sr-only">Loading…</span>
      )}
    </div>
  );
}
