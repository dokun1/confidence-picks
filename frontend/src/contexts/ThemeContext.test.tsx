import { render, screen, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useDarkMode } from './ThemeContext';

// Consumer component that exposes context values via data attributes
function ThemeConsumer() {
  const { isDark, toggle } = useDarkMode();
  return (
    <div>
      <span data-testid="isDark">{String(isDark)}</span>
      <button onClick={toggle}>toggle</button>
    </div>
  );
}

function renderWithProvider(ui: React.ReactNode) {
  return render(<ThemeProvider>{ui}</ThemeProvider>);
}

describe('ThemeContext', () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove('dark');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('ThemeProvider — lazy initialization', () => {
    it('initializes as light mode when localStorage has no theme set', () => {
      renderWithProvider(<ThemeConsumer />);
      expect(screen.getByTestId('isDark').textContent).toBe('false');
    });

    it('initializes as dark mode when localStorage has theme="dark"', () => {
      localStorage.setItem('theme', 'dark');
      renderWithProvider(<ThemeConsumer />);
      expect(screen.getByTestId('isDark').textContent).toBe('true');
    });

    it('initializes as light mode when localStorage has theme="light"', () => {
      localStorage.setItem('theme', 'light');
      renderWithProvider(<ThemeConsumer />);
      expect(screen.getByTestId('isDark').textContent).toBe('false');
    });

    it('initializes as light mode when localStorage throws (SSR safety)', () => {
      vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
        throw new Error('localStorage unavailable');
      });
      renderWithProvider(<ThemeConsumer />);
      expect(screen.getByTestId('isDark').textContent).toBe('false');
    });
  });

  describe('DOM sync via useEffect', () => {
    it('adds "dark" class to documentElement when isDark is true', () => {
      localStorage.setItem('theme', 'dark');
      renderWithProvider(<ThemeConsumer />);
      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });

    it('does not add "dark" class when isDark is false', () => {
      renderWithProvider(<ThemeConsumer />);
      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('removes "dark" class after toggling from dark to light', () => {
      localStorage.setItem('theme', 'dark');
      renderWithProvider(<ThemeConsumer />);
      expect(document.documentElement.classList.contains('dark')).toBe(true);

      act(() => {
        screen.getByText('toggle').click();
      });

      expect(document.documentElement.classList.contains('dark')).toBe(false);
    });

    it('adds "dark" class after toggling from light to dark', () => {
      renderWithProvider(<ThemeConsumer />);
      expect(document.documentElement.classList.contains('dark')).toBe(false);

      act(() => {
        screen.getByText('toggle').click();
      });

      expect(document.documentElement.classList.contains('dark')).toBe(true);
    });
  });

  describe('localStorage persistence', () => {
    it('writes "dark" to localStorage when isDark becomes true', () => {
      renderWithProvider(<ThemeConsumer />);

      act(() => {
        screen.getByText('toggle').click();
      });

      expect(localStorage.getItem('theme')).toBe('dark');
    });

    it('writes "light" to localStorage when isDark becomes false', () => {
      localStorage.setItem('theme', 'dark');
      renderWithProvider(<ThemeConsumer />);

      act(() => {
        screen.getByText('toggle').click();
      });

      expect(localStorage.getItem('theme')).toBe('light');
    });
  });

  describe('toggle', () => {
    it('flips isDark from false to true', () => {
      renderWithProvider(<ThemeConsumer />);
      expect(screen.getByTestId('isDark').textContent).toBe('false');

      act(() => {
        screen.getByText('toggle').click();
      });

      expect(screen.getByTestId('isDark').textContent).toBe('true');
    });

    it('flips isDark from true to false', () => {
      localStorage.setItem('theme', 'dark');
      renderWithProvider(<ThemeConsumer />);
      expect(screen.getByTestId('isDark').textContent).toBe('true');

      act(() => {
        screen.getByText('toggle').click();
      });

      expect(screen.getByTestId('isDark').textContent).toBe('false');
    });

    it('toggles back and forth correctly across multiple clicks', () => {
      renderWithProvider(<ThemeConsumer />);
      const btn = screen.getByText('toggle');

      act(() => btn.click());
      expect(screen.getByTestId('isDark').textContent).toBe('true');

      act(() => btn.click());
      expect(screen.getByTestId('isDark').textContent).toBe('false');

      act(() => btn.click());
      expect(screen.getByTestId('isDark').textContent).toBe('true');
    });
  });

  describe('useDarkMode — outside provider', () => {
    it('throws when used outside ThemeProvider', () => {
      const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

      function Bare() {
        useDarkMode();
        return null;
      }

      expect(() => render(<Bare />)).toThrow('useDarkMode must be used within a ThemeProvider');
      consoleError.mockRestore();
    });
  });
});
