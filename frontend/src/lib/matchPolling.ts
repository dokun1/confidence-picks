import type { WorldCupMatch } from './types';

/** Live matches refresh fast so goals/cards land within ~30s of happening. */
export const IN_PROGRESS_POLL_MS = 30_000;
/**
 * Matches that haven't kicked off yet poll slowly — purely to notice the
 * SCHEDULED → IN_PROGRESS transition, after which the fast cadence takes over.
 * A long interval here keeps idle pages (and ESPN) from being hammered while
 * still catching kickoff without a manual refresh.
 */
export const UPCOMING_POLL_MS = 5 * 60_000;

/**
 * Status-aware poll cadence for a World Cup match slate, in milliseconds, or
 * `null` to stop polling entirely.
 *
 * - Any match in progress → fast (live scores/events).
 * - Otherwise any match still scheduled → slow (watch for kickoff).
 * - Everything final → `null`; the slate can't change, so don't poll.
 *
 * Only the `status` field is read, so callers can pass the raw API matches.
 */
export function pollIntervalFor(matches: Pick<WorldCupMatch, 'status'>[]): number | null {
  if (matches.some((m) => m.status === 'IN_PROGRESS')) return IN_PROGRESS_POLL_MS;
  if (matches.some((m) => m.status === 'SCHEDULED')) return UPCOMING_POLL_MS;
  return null;
}
