import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import AuthService from './authService.js';

// Builds a JWT-shaped string ("header.payload.sig") whose payload is the given
// object. AuthService only ever decodes the middle segment, so the header/sig
// are throwaway. exp is in seconds since epoch, matching the real backend.
function makeToken(payload) {
  const body = btoa(JSON.stringify(payload));
  return `header.${body}.sig`;
}

const NOW = Math.floor(Date.now() / 1000);
const USER = { id: 7, email: 'a@b.com', name: 'Ada', pictureUrl: null };

describe('AuthService cache + token helpers', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  describe('getCachedUser', () => {
    it('returns the stored profile regardless of access-token expiry', () => {
      localStorage.setItem('user', JSON.stringify(USER));
      // No access token at all — getUser() would be null, but the cached
      // profile is still available for optimistic hydration.
      expect(AuthService.getCachedUser()).toEqual(USER);
    });

    it('returns null when no profile is cached', () => {
      expect(AuthService.getCachedUser()).toBeNull();
    });

    it('returns null for malformed cached JSON', () => {
      localStorage.setItem('user', '{not json');
      expect(AuthService.getCachedUser()).toBeNull();
    });
  });

  describe('isAccessTokenValid', () => {
    it('is false when there is no token', () => {
      expect(AuthService.isAccessTokenValid()).toBe(false);
    });

    it('is false once the token is past its exp', () => {
      localStorage.setItem('accessToken', makeToken({ userId: 7, exp: NOW - 60 }));
      expect(AuthService.isAccessTokenValid()).toBe(false);
    });

    it('is true for an unexpired token', () => {
      localStorage.setItem('accessToken', makeToken({ userId: 7, exp: NOW + 600 }));
      expect(AuthService.isAccessTokenValid()).toBe(true);
    });
  });

  describe('getUser', () => {
    it('returns null when the access token is expired even if a profile is cached', () => {
      localStorage.setItem('user', JSON.stringify(USER));
      localStorage.setItem('accessToken', makeToken({ userId: 7, exp: NOW - 60 }));
      expect(AuthService.getUser()).toBeNull();
    });

    it('prefers the cached profile for a valid token of the same user', () => {
      localStorage.setItem('user', JSON.stringify(USER));
      localStorage.setItem('accessToken', makeToken({ userId: 7, exp: NOW + 600 }));
      expect(AuthService.getUser()).toEqual(USER);
    });
  });

  describe('refreshToken de-duplication', () => {
    afterEach(() => {
      vi.restoreAllMocks();
    });

    it('coalesces concurrent refreshes into a single network call', async () => {
      localStorage.setItem('refreshToken', 'r1');
      let resolveFetch;
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation(
        () =>
          new Promise((resolve) => {
            resolveFetch = () =>
              resolve({ ok: true, json: async () => ({ accessToken: 'new-access' }) });
          })
      );

      // Two callers notice the expired token at the same time.
      const p1 = AuthService.refreshToken();
      const p2 = AuthService.refreshToken();

      resolveFetch();
      const [t1, t2] = await Promise.all([p1, p2]);

      expect(t1).toBe('new-access');
      expect(t2).toBe('new-access');
      expect(fetchSpy).toHaveBeenCalledTimes(1);
      expect(localStorage.getItem('accessToken')).toBe('new-access');
    });

    it('allows a fresh refresh after the previous one settles', async () => {
      localStorage.setItem('refreshToken', 'r1');
      const fetchSpy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({
        ok: true,
        json: async () => ({ accessToken: 'access-x' }),
      });

      await AuthService.refreshToken();
      await AuthService.refreshToken();

      expect(fetchSpy).toHaveBeenCalledTimes(2);
    });
  });
});
