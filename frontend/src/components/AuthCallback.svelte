<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import AuthService from '../lib/authService.js';

  let loading = true;

  onMount(async () => {
    // Get tokens from URL
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('token');
    const refresh = urlParams.get('refresh');
    
    if (token && refresh) {
      try {
        // Store tokens
        AuthService.setTokens(token, refresh);
        
        // Get user info
        const user = await AuthService.getCurrentUser();
        
        if (user) {
          // Clear URL params and redirect to home
          window.history.replaceState({}, document.title, window.location.pathname);
          navigateTo('/');
        } else {
          throw new Error('Failed to get user info');
        }
      } catch (error) {
        console.error('Auth callback error:', error);
        AuthService.clearTokens();
        navigateTo('/login?error=callback_failed');
      }
    } else {
      // No tokens in URL, redirect to login
      navigateTo('/login?error=no_tokens');
    }
    
    loading = false;
  });
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900 flex items-center justify-center">
  <div class="max-w-md mx-auto px-lg py-lg">
    <div class="text-center space-y-md">
      {#if loading}
        <div class="space-y-md">
          <div class="w-16 h-16 mx-auto">
            <svg class="animate-spin w-16 h-16 text-primary-500" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
          </div>
          <h1 class="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Signing you in...
          </h1>
          <p class="text-[var(--color-text-secondary)]">
            Please wait while we complete your authentication.
          </p>
        </div>
      {:else}
        <div class="space-y-md">
          <div class="text-4xl">❌</div>
          <h1 class="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
            Authentication Failed
          </h1>
          <p class="text-[var(--color-text-secondary)]">
            Something went wrong during sign in. Please try again.
          </p>
          <button
            class="px-lg py-sm bg-primary-500 text-neutral-0 rounded-base text-base font-medium hover:bg-primary-600 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
            on:click={() => navigateTo('/login')}
          >
            Try Again
          </button>
        </div>
      {/if}
    </div>
  </div>
</div>
