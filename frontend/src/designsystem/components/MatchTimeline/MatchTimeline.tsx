import { Fragment } from 'react';
import type { MatchEvent, MatchEventType } from '../../../lib/types';

export interface MatchTimelineProps {
  /** Chronological goal/card events for a match (already ordered by the source). */
  events: MatchEvent[];
  className?: string;
}

/** Stylized soccer-ball glyph; inherits its color from the surrounding text. */
function GoalGlyph({ className = '' }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`h-icon-sm w-icon-sm ${className}`.trim()}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7.4l4.1 3-1.6 4.9H9.5L7.9 10.4 12 7.4z" fill="currentColor" stroke="none" />
    </svg>
  );
}

/** A booking card — a small rounded rectangle in the yellow/red token color. */
function CardGlyph({ tone }: { tone: 'yellow' | 'red' }) {
  const color = tone === 'yellow' ? 'bg-warning-400' : 'bg-error-500';
  return <span className={`inline-block h-icon-sm w-[0.65em] rounded-sm ${color}`} aria-hidden="true" />;
}

const GLYPH: Record<MatchEventType, React.ReactNode> = {
  goal: <GoalGlyph className="text-content" />,
  'own-goal': <GoalGlyph className="text-error-500" />,
  'yellow-card': <CardGlyph tone="yellow" />,
  'red-card': <CardGlyph tone="red" />,
};

const LABEL: Record<MatchEventType, string> = {
  goal: 'Goal',
  'own-goal': 'Own goal',
  'yellow-card': 'Yellow card',
  'red-card': 'Red card',
};

/**
 * Two-sided match timeline (Apple Sports style): the minute runs down a central
 * spine, with each event's glyph + player branching to the left (home) or right
 * (away). Purely presentational and fully token-driven — the parent supplies the
 * `events`; nothing here is hard-coded.
 */
export default function MatchTimeline({ events, className = '' }: MatchTimelineProps) {
  if (events.length === 0) return null;
  return (
    <div
      aria-label="Match timeline"
      // `isolate` scopes the minute chips' z-10 to this grid: without it the
      // chips leak into the root stacking context and paint OVER the page's
      // sticky submit bar as the row scrolls under it.
      className={`relative isolate grid grid-cols-[1fr_auto_1fr] items-center gap-x-sm gap-y-xs text-xs ${className}`.trim()}
    >
      {/* Central spine — the minute chips mask it where they sit. */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-border"
      />

      {events.map((ev, i) => {
        const home = ev.side === 'home';
        const glyph = (
          <span className="flex shrink-0 justify-center" title={LABEL[ev.type]}>
            {GLYPH[ev.type]}
          </span>
        );
        const player = <span className="min-w-0 truncate text-content">{ev.player}</span>;
        return (
          <Fragment key={i}>
            {/* Home side (left): glyph · name grouped, hugging the spine. */}
            {home ? (
              <div className="flex min-w-0 items-center justify-end gap-xs">
                {glyph}
                {player}
              </div>
            ) : (
              <span />
            )}

            {/* Minute, centered ON the spine so its background masks the line —
                otherwise the spine peeks out beside the (left-aligned) number as
                a stray grey tick. */}
            <span className="relative z-10 justify-self-center rounded-full bg-surface px-xs text-center font-semibold tabular-nums text-content-muted">
              {ev.minute}
            </span>

            {/* Away side (right): name · glyph grouped, hugging the spine. */}
            {home ? (
              <span />
            ) : (
              <div className="flex min-w-0 items-center justify-start gap-xs">
                {player}
                {glyph}
              </div>
            )}
          </Fragment>
        );
      })}
    </div>
  );
}
