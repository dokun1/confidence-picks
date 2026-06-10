// Post-login redirect plumbing, shared by LoginPage (writer) and AuthCallback
// (reader). A guarded link — e.g. InvitePage's "Sign in to join" CTA — routes
// the signed-out user to `/login?next=/invite/:token`. LoginPage stashes that
// target in sessionStorage *before* leaving for the OAuth provider; sessionStorage
// survives the full cross-origin OAuth round-trip (it persists for the lifetime
// of the tab), so AuthCallback can read it back and land the now-authenticated
// user on the page they originally wanted instead of the home page.

export const POST_LOGIN_REDIRECT_KEY = 'postLoginRedirect';

// Only same-origin, absolute, non-protocol-relative paths are honored. This
// blocks open-redirect attacks where a crafted `?next=https://evil.com` (or the
// protocol-relative `//evil.com`, or a back-slash variant some browsers
// normalize to `//`) would otherwise bounce a freshly-authenticated user to an
// attacker-controlled origin. Anything that isn't a clean in-app path collapses
// to null so callers fall back to '/'.
export function safeRedirectPath(value: string | null | undefined): string | null {
  if (!value) return null;

  let decoded = value;
  try {
    decoded = decodeURIComponent(value);
  } catch {
    // Malformed percent-encoding — treat as untrusted and drop it.
    return null;
  }

  // Must be an absolute in-app path ("/groups", "/invite/abc"). Reject anything
  // that starts a new authority: "//host", "/\\host", or a full URL with scheme.
  if (!decoded.startsWith('/')) return null;
  if (decoded.startsWith('//') || decoded.startsWith('/\\')) return null;

  return decoded;
}

// Best-effort write: a blocked sessionStorage (private mode, etc.) must never
// stop sign-in. The value is validated first so we never persist a hostile path.
export function stashPostLoginRedirect(value: string | null | undefined): void {
  const safe = safeRedirectPath(value);
  if (!safe) return;
  try {
    sessionStorage.setItem(POST_LOGIN_REDIRECT_KEY, safe);
  } catch {
    /* sessionStorage unavailable — proceed without it */
  }
}

// Reads and clears the stashed target in one shot so a stale redirect can't
// hijack a later, unrelated sign-in. Returns a validated path or null.
export function consumePostLoginRedirect(): string | null {
  let raw: string | null = null;
  try {
    raw = sessionStorage.getItem(POST_LOGIN_REDIRECT_KEY);
    sessionStorage.removeItem(POST_LOGIN_REDIRECT_KEY);
  } catch {
    return null;
  }
  return safeRedirectPath(raw);
}
