import { writable } from "svelte/store";

export const currentRoute = writable('/');

export function navigateTo(route) {
    // Normalize the route
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
    currentRoute.set(normalizedRoute);
    
    // Update the URL
    if (normalizedRoute === '/') {
        window.history.pushState({}, '', '/confidence-picks/');
    } else {
        window.history.pushState({}, '', `/confidence-picks${normalizedRoute}`);
    }
}

export function initRouter() {
    window.addEventListener('popstate', () => {
        const path = window.location.pathname;
        const hash = window.location.hash;
        
        // Handle hash-based routing
        if (hash === '#/design-system') {
            currentRoute.set('/design-system');
        } else if (path === '/' || path === '/confidence-picks' || path === '/confidence-picks/') {
            currentRoute.set('/');
        } else if (path.includes('/games')) {
            currentRoute.set('/games');
        } else if (path.includes('/design-system')) {
            currentRoute.set('/design-system');
        } else if (path.includes('/picks')) {
            currentRoute.set('/picks');
        } else if (path.includes('/leaderboard')) {
            currentRoute.set('/leaderboard');
        } else {
            currentRoute.set('404');
        }
    });

    // Handle initial route on page load
    const path = window.location.pathname;
    const hash = window.location.hash;
    
    if (hash === '#/design-system') {
        currentRoute.set('/design-system');
    } else if (path === '/' || path === '/confidence-picks' || path === '/confidence-picks/') {
        currentRoute.set('/');
    } else if (path.includes('/games')) {
        currentRoute.set('/games');
    } else if (path.includes('/design-system')) {
        currentRoute.set('/design-system');
    } else if (path.includes('/picks')) {
        currentRoute.set('/picks');
    } else if (path.includes('/leaderboard')) {
        currentRoute.set('/leaderboard');
    }
}