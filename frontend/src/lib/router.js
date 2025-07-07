import { writable } from "svelte/store";

export const currentRoute = writable('home');

export function navigateTo(route) {
    currentRoute.set(route);
    window.history.pushState({}, '', route === 'home' ? '/' : `/${route}`);
}

export function initRouter() {
    window.addEventListener('popstate', () => {
        const path = window.location.pathname;
        if (path === '/' || path === '/confidence-picks') {
            currentRoute.set('home');
        } else if (path.includes('games')) {
            currentRoute.set('games');
        }
    });
}