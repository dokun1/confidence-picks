import { writable } from 'svelte/store';

// Global auth store for immediate UI updates after login/logout
export const auth = writable({ isAuthenticated: false, user: null });

export function setAuthUser(user) {
  auth.set({ isAuthenticated: !!user, user: user || null });
}

export function clearAuth() {
  auth.set({ isAuthenticated: false, user: null });
}
