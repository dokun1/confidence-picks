import { describe, it, expect, beforeEach } from 'vitest';
import { peekCache, writeCache, clearWorldCupCache, wcCacheKeys } from './worldCupCache';

describe('worldCupCache', () => {
  beforeEach(() => clearWorldCupCache());

  it('returns undefined for a key that was never written', () => {
    expect(peekCache('wc:lb:never')).toBeUndefined();
  });

  it('round-trips a written value', () => {
    writeCache('wc:lb:g1', [{ rank: 1 }]);
    expect(peekCache('wc:lb:g1')).toEqual([{ rank: 1 }]);
  });

  it('overwrites a prior value for the same key', () => {
    writeCache(wcCacheKeys.stages, [1, 2]);
    writeCache(wcCacheKeys.stages, [3]);
    expect(peekCache(wcCacheKeys.stages)).toEqual([3]);
  });

  it('clearWorldCupCache drops everything', () => {
    writeCache(wcCacheKeys.stages, [1]);
    writeCache(wcCacheKeys.leaderboard('g1'), [2]);
    clearWorldCupCache();
    expect(peekCache(wcCacheKeys.stages)).toBeUndefined();
    expect(peekCache(wcCacheKeys.leaderboard('g1'))).toBeUndefined();
  });

  it('keys leaderboards per group', () => {
    expect(wcCacheKeys.leaderboard('a')).not.toBe(wcCacheKeys.leaderboard('b'));
  });
});
