import { writable } from "svelte/store";

export const currentRoute = writable('home');

export function navigateTo(route) {
    currentRoute.set(route);
    window.history.pushState({}, '', route === 'home' ? '/' : `/${route}`);
}

export function initRouter() {
    window.addEventListener('popstate', () => {
        const path = window.location.pathname;
        const hash = window.location.hash;
        
        if (hash === '#/design-system') {
            currentRoute.set('design-system');
        } else if (path === '/' || path === '/confidence-picks') {
            currentRoute.set('home');
        } else if (path.includes('games')) {
            currentRoute.set('games');
        } else {
            currentRoute.set('404');
        }
    });

    // Handle initial route on page load
    const hash = window.location.hash;
    if (hash === '#/design-system') {
        currentRoute.set('design-system');
    }
}