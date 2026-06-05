import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ThemeProvider, useDarkMode } from './ThemeContext';

describe('ThemeContext', () => {
  beforeEach(() => {
    document.documentElement.classList.remove('dark');
    localStorage.clear();
  });

  afterEach(() => {
    document.documentElement.classList.remove('dark');
  });

  // Test 1: no 'theme' key in localStorage → isDark=false, no 'dark' class on <html>
  it('defaults to light mode when localStorage has no theme key', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper: ThemeProvider });

    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  // Test 2: localStorage has 'dark' before mount → isDark=true, 'dark' class on <html>
  it('initializes as dark when localStorage theme is "dark" before mount', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useDarkMode(), { wrapper: ThemeProvider });

    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  // Test 3: toggle() from isDark=false → isDark=true, 'dark' class added
  it('toggle from light adds "dark" class and sets isDark=true', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper: ThemeProvider });

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDark).toBe(true);
    expect(document.documentElement.classList.contains('dark')).toBe(true);
  });

  // Test 4: toggle() from isDark=true → isDark=false, 'dark' class removed
  it('toggle from dark removes "dark" class and sets isDark=false', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useDarkMode(), { wrapper: ThemeProvider });

    act(() => {
      result.current.toggle();
    });

    expect(result.current.isDark).toBe(false);
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  // Test 5: after toggle to dark, localStorage.getItem('theme') === 'dark'
  it('persists "dark" to localStorage after toggling to dark', () => {
    const { result } = renderHook(() => useDarkMode(), { wrapper: ThemeProvider });

    act(() => {
      result.current.toggle();
    });

    expect(localStorage.getItem('theme')).toBe('dark');
  });

  // Test 6: after toggle to light, localStorage.getItem('theme') === 'light'
  it('persists "light" to localStorage after toggling to light', () => {
    localStorage.setItem('theme', 'dark');
    const { result } = renderHook(() => useDarkMode(), { wrapper: ThemeProvider });

    act(() => {
      result.current.toggle();
    });

    expect(localStorage.getItem('theme')).toBe('light');
  });

  // Test 7: useDarkMode() outside ThemeProvider throws
  it('throws when useDarkMode is called outside ThemeProvider', () => {
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useDarkMode())).toThrow(
      'useDarkMode must be used within a ThemeProvider'
    );

    consoleError.mockRestore();
  });
});
