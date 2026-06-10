import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  POST_LOGIN_REDIRECT_KEY,
  safeRedirectPath,
  stashPostLoginRedirect,
  consumePostLoginRedirect,
} from './postLoginRedirect';

describe('safeRedirectPath', () => {
  it('accepts an in-app absolute path', () => {
    expect(safeRedirectPath('/invite/tok-123')).toBe('/invite/tok-123');
    expect(safeRedirectPath('/groups')).toBe('/groups');
  });

  it('decodes percent-encoded paths', () => {
    expect(safeRedirectPath('%2Finvite%2Ftok-123')).toBe('/invite/tok-123');
  });

  it('returns null for empty / missing values', () => {
    expect(safeRedirectPath(null)).toBeNull();
    expect(safeRedirectPath(undefined)).toBeNull();
    expect(safeRedirectPath('')).toBeNull();
  });

  it('rejects absolute URLs to other origins (open-redirect guard)', () => {
    expect(safeRedirectPath('https://evil.com')).toBeNull();
    expect(safeRedirectPath('http://evil.com/invite/x')).toBeNull();
  });

  it('rejects protocol-relative and back-slash authority tricks', () => {
    expect(safeRedirectPath('//evil.com')).toBeNull();
    expect(safeRedirectPath('/\\evil.com')).toBeNull();
  });

  it('rejects relative paths that do not start with a single slash', () => {
    expect(safeRedirectPath('invite/tok-123')).toBeNull();
  });

  it('returns null on malformed percent-encoding', () => {
    expect(safeRedirectPath('%E0%A4%A')).toBeNull();
  });
});

describe('sessionStorage round-trip', () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    sessionStorage.clear();
    vi.restoreAllMocks();
  });

  it('stashes a safe path and consumes it once', () => {
    stashPostLoginRedirect('/invite/tok-123');
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBe('/invite/tok-123');

    expect(consumePostLoginRedirect()).toBe('/invite/tok-123');
    // Consuming clears it so a stale redirect can't hijack a later sign-in.
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull();
    expect(consumePostLoginRedirect()).toBeNull();
  });

  it('does not stash an unsafe path', () => {
    stashPostLoginRedirect('https://evil.com');
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull();
  });

  it('does not stash a null/undefined target', () => {
    stashPostLoginRedirect(null);
    expect(sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY)).toBeNull();
  });

  it('swallows sessionStorage write failures (private mode, etc.)', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(() => stashPostLoginRedirect('/invite/tok-123')).not.toThrow();
  });

  it('returns null when sessionStorage read throws', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    expect(consumePostLoginRedirect()).toBeNull();
  });
});
