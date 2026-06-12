import '@testing-library/jest-dom'

// jsdom has no matchMedia. Default every query to "not matching" so responsive
// components (useMediaQuery) render their desktop/base layout in tests unless a
// test explicitly overrides window.matchMedia to simulate a smaller viewport.
// jsdom doesn't implement scrollIntoView. Provide a no-op so components that
// re-anchor the scroll (e.g. the picks list on a filter change) don't throw,
// and so tests can spy on it.
if (typeof Element !== 'undefined' && typeof Element.prototype.scrollIntoView !== 'function') {
  Element.prototype.scrollIntoView = () => {};
}

if (typeof window !== 'undefined' && typeof window.matchMedia !== 'function') {
  window.matchMedia = (query: string): MediaQueryList =>
    ({
      matches: false,
      media: query,
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false,
    }) as unknown as MediaQueryList;
}
