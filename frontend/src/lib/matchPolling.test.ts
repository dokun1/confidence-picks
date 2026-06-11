import { describe, it, expect } from 'vitest';
import {
  pollIntervalFor,
  IN_PROGRESS_POLL_MS,
  UPCOMING_POLL_MS,
} from './matchPolling';
import type { WorldCupMatch } from './types';

const m = (status: string): Pick<WorldCupMatch, 'status'> => ({ status });

describe('pollIntervalFor', () => {
  it('returns the fast interval when any match is in progress', () => {
    expect(pollIntervalFor([m('FINAL'), m('IN_PROGRESS'), m('SCHEDULED')])).toBe(
      IN_PROGRESS_POLL_MS,
    );
  });

  it('prefers the fast interval over the slow one when both live and scheduled exist', () => {
    // In-progress wins: a live match must refresh fast even alongside upcoming ones.
    expect(pollIntervalFor([m('SCHEDULED'), m('IN_PROGRESS')])).toBe(IN_PROGRESS_POLL_MS);
  });

  it('returns the slow interval when matches are only scheduled (no live)', () => {
    expect(pollIntervalFor([m('FINAL'), m('SCHEDULED')])).toBe(UPCOMING_POLL_MS);
  });

  it('stops polling (null) once every match is final', () => {
    expect(pollIntervalFor([m('FINAL'), m('FINAL')])).toBeNull();
  });

  it('stops polling (null) for an empty slate', () => {
    expect(pollIntervalFor([])).toBeNull();
  });

  it('keeps the slow interval slower than the fast one', () => {
    // Guards the intent: upcoming matches must never poll faster than live ones.
    expect(UPCOMING_POLL_MS).toBeGreaterThan(IN_PROGRESS_POLL_MS);
  });
});
