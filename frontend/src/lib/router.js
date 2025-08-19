import { writable } from "svelte/store";

export const currentRoute = writable('/');

// Helper function to determine the correct route for the store
function getRouteForPath(path, hash = '', search = '') {
    // Handle hash-based routing first
    if (hash === '#/design-system') {
        return '/design-system';
    } else if (path === '/') {
        return '/';
    } else if (path === '/groups') {
        return '/groups';
    } else if (path === '/about') {
        return '/about';
    } else if (path === '/design-system') {
        return '/design-system';
    } else if (path === '/login') {
        return '/login';
    } else if (path === '/profile') {
        return '/profile';
    } else if (path.startsWith('/groups/create')) {
        return '/groups/create';
    } else if (path.startsWith('/groups/join')) {
        return '/groups/join';
    } else if (path.startsWith('/groups/') && path.endsWith('/edit') && path.split('/').length === 4) {
        return path; // Full path for group edit page
    } else if (path.startsWith('/groups/') && path.split('/').length === 3) {
        return path; // Full path for group details
    } else if (path.startsWith('/auth/callback') || search.includes('token=')) {
        return '/auth/callback';
    } else if (path === '/games') {
        return '/games';
    } else if (path === '/picks') {
        return '/picks';
    } else if (path === '/leaderboard') {
        return '/leaderboard';
    } else {
        return '404';
    }
}

export function navigateTo(route) {
    // Normalize the route
    const normalizedRoute = route.startsWith('/') ? route : `/${route}`;
    
    // Apply the same route matching logic as the router
    const processedRoute = getRouteForPath(normalizedRoute);
    
    console.log('navigateTo:', { 
        input: route, 
        normalized: normalizedRoute, 
        processed: processedRoute 
    });
    
    currentRoute.set(processedRoute);
    window.history.pushState({}, '', normalizedRoute);
}

export function initRouter() {
    window.addEventListener('popstate', () => {
        const path = window.location.pathname;
        const hash = window.location.hash;
        const search = window.location.search;
        
        const route = getRouteForPath(path, hash, search);
        currentRoute.set(route);
    });

    // Handle initial route on page load
    const path = window.location.pathname;
    const hash = window.location.hash;
    const search = window.location.search;
    
    const route = getRouteForPath(path, hash, search);
    currentRoute.set(route);
}