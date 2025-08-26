import { writable } from 'svelte/store';

// Global auth store for immediate UI updates after login/logout
export const auth = writable({ isAuthenticated: false, user: null });

export function setAuthUser(user) {
  auth.set({ isAuthenticated: !!user, user: user || null });
}

export function clearAuth() {
  auth.set({ isAuthenticated: false, user: null });
}

// Apple Sign In handler
export function signInWithApple() {
  const baseURL = import.meta.env.PROD 
    ? 'https://api.confidence-picks.com'
    : 'http://localhost:3001';
  
  window.location.href = `${baseURL}/auth/apple`;
}

// Google Sign In handler (keeping existing for consistency)
export function signInWithGoogle() {
  const baseURL = import.meta.env.PROD 
    ? 'https://api.confidence-picks.com'
    : 'http://localhost:3001';
  
  window.location.href = `${baseURL}/auth/google`;
}
