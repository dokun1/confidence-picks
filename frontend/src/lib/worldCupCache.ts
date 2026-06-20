// In-memory stale-while-revalidate store for the World Cup group views.
//
// The Leaderboard and Picks tabs each own their fetch and unmount on every tab
// switch (GroupDetailsPage conditionally renders the active tab), so without a
// cache, re-entering a tab — or revisiting the group — re-runs the fetch behind
// a "Loading…" blank every time. The Picks tab is the worst offender: it fans
// out to SEVEN stage requests on each mount.
//
// This store lets a tab paint its last-known data immediately and revalidate in
// the background, so the "extra beat" only ever shows on the very first load.
// It's process-memory only (no persistence) and deliberately tiny — freshness is
// handled by always revalidating, not by TTLs.

type Entry<T> = { value: T; ts: number };

const store = new Map<string, Entry<unknown>>();

/** Last cached value for `key`, or `undefined` if nothing has been cached yet. */
export function peekCache<T>(key: string): T | undefined {
  const entry = store.get(key);
  return entry ? (entry.value as T) : undefined;
}

/** Cache `value` under `key`, stamping it with the current time. */
export function writeCache<T>(key: string, value: T): void {
  store.set(key, { value, ts: Date.now() });
}

/** Drop everything. Tests call this in `beforeEach` so cases don't bleed cache. */
export function clearWorldCupCache(): void {
  store.clear();
}

/** Stable cache keys. Stage matches are tournament-global; the leaderboard is
 *  per group. */
export const wcCacheKeys = {
  stages: 'wc:stages',
  leaderboard: (groupId: string) => `wc:lb:${groupId}`,
} as const;
