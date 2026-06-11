import '@testing-library/jest-dom'

// jsdom has no matchMedia. Default every query to "not matching" so responsive
// components (useMediaQuery) render their desktop/base layout in tests unless a
// test explicitly overrides window.matchMedia to simulate a smaller viewport.
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
