import { useEffect, useState } from 'react';

/**
 * Subscribe to a CSS media query and return whether it currently matches.
 *
 * Used to mount responsive variants conditionally (one layout at a time) rather
 * than rendering both and toggling with CSS `hidden` — which would duplicate
 * content for screen readers and break single-element test queries.
 *
 * Safe when `matchMedia` is unavailable (returns `false`); tests mock
 * `window.matchMedia` in test-setup.ts.
 */
export function useMediaQuery(query: string): boolean {
  const getMatches = () =>
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(query).matches
      : false;

  const [matches, setMatches] = useState<boolean>(getMatches);

  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener?.('change', onChange);
    return () => mql.removeEventListener?.('change', onChange);
  }, [query]);

  return matches;
}

export default useMediaQuery;
