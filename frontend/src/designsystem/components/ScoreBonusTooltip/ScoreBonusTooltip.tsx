import { useState, useEffect } from 'react';

const STORAGE_KEY = 'wc-score-bonus-tooltip-seen';

/** Read a localStorage flag safely (SSR / storage-disabled guard). */
function readFlag(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Set the localStorage flag safely. */
function setFlag() {
  try {
    localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    // Storage unavailable — flag never persists, tooltip re-shows next mount. Acceptable.
  }
}

export interface ScoreBonusTooltipProps {
  /** The tooltip only renders when this is true — avoids showing in group-only contexts. */
  hasKnockoutMatches: boolean;
}

/**
 * ScoreBonusTooltip — first-visit explanation of the knockout score bonus.
 *
 * Auto-opens on first render (when `localStorage['wc-score-bonus-tooltip-seen']` is
 * absent) and provides an ℹ️ button to re-open on demand. Dismissing sets the flag
 * so it never nags again.
 */
export default function ScoreBonusTooltip({ hasKnockoutMatches }: ScoreBonusTooltipProps) {
  // Initialise open state synchronously from localStorage so the tooltip is
  // already open on first paint — no layout flash. Mirrors the ThemeContext pattern.
  const [open, setOpen] = useState<boolean>(() => {
    if (!hasKnockoutMatches) return false;
    return !readFlag();
  });

  // If the component mounts with the tooltip auto-opened, mark it as seen so
  // a tab re-mount or StrictMode double-invoke doesn't reset it.
  useEffect(() => {
    if (open) setFlag();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // intentionally runs only once on mount

  // Don't render at all when there are no knockout matches in view.
  if (!hasKnockoutMatches) return null;

  return (
    <div className="relative inline-flex items-center">
      {/* ℹ️ info button — always available to re-open the tooltip */}
      <button
        type="button"
        aria-label="Score bonus info"
        aria-expanded={open}
        className="flex items-center justify-center rounded-full w-5 h-5 text-xs text-content-muted hover:text-content hover:bg-surface transition-colors"
        onClick={() => setOpen((prev) => !prev)}
      >
        ℹ️
      </button>

      {/* Dismissible popover */}
      {open && (
        <div
          role="tooltip"
          className="absolute bottom-full left-0 mb-xs z-30 w-72 rounded-md border border-border bg-neutral-0 dark:bg-secondary-800 p-sm shadow-lg text-sm text-content"
        >
          <p className="font-semibold text-secondary-900 dark:text-neutral-0 mb-xxs">
            Score Bonus (optional)
          </p>
          <p className="text-content-muted">
            Predict the final score for extra points — exact score = +2; off by one goal, or the
            right scoreline with the teams flipped = +1. PK shootouts count as a draw score.
          </p>
          <button
            type="button"
            className="mt-xs text-xs font-medium text-primary-600 hover:underline dark:text-primary-400"
            onClick={() => {
              setFlag();
              setOpen(false);
            }}
          >
            Got it
          </button>
        </div>
      )}
    </div>
  );
}
