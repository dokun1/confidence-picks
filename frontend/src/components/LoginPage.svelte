<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import AuthService from '../lib/authService.js';

  let error = '';

  onMount(() => {
    // Check if user is already authenticated
    if (AuthService.isAuthenticated()) {
      navigateTo('/');
      return;
    }

    // Check for error in URL params
    const urlParams = new URLSearchParams(window.location.search);
    const errorParam = urlParams.get('error');
    
    if (errorParam) {
      switch (errorParam) {
        case 'callback_failed':
          error = 'Authentication failed. Please try signing in again.';
          break;
        case 'no_tokens':
          error = 'No authentication tokens received. Please try again.';
          break;
        default:
          error = 'An error occurred during authentication.';
      }
    }
  });

  function handleGoogleSignIn() {
    AuthService.login();
  }
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900 flex items-center justify-center">
  <div class="max-w-md mx-auto px-lg py-lg">
    <div class="text-center space-y-lg">
      <!-- Logo -->
      <div class="space-y-md">
        <div class="w-16 h-16 bg-primary-500 rounded-full mx-auto flex items-center justify-center">
          <svg class="w-8 h-8 text-neutral-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.018 9.018 0 01-2.48 5.228m2.48-5.492a46.95 46.95 0 01-2.48-.546M18.75 4.236v1.516c-.822-.1-1.653-.184-2.48-.546"></path>
          </svg>
        </div>
        <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
          Welcome to Confidence Picks
        </h1>
        <p class="text-lg text-[var(--color-text-secondary)]">
          Sign in to start making your NFL picks and compete with friends.
        </p>
      </div>

      <!-- Error Message -->
      {#if error}
        <div class="p-md bg-error-50 dark:bg-error-900 rounded-base border border-error-200 dark:border-error-800">
          <p class="text-error-700 dark:text-error-300">
            {error}
          </p>
        </div>
      {/if}

      <!-- Sign In Options -->
      <div class="space-y-md">
        <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)]">
          Choose your sign in method
        </h2>
        
        <!-- Google Sign In -->
        <button
          class="w-full flex items-center justify-center px-lg py-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-300 dark:border-secondary-600 rounded-base text-base font-medium hover:bg-secondary-50 dark:hover:bg-secondary-700 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
          on:click={handleGoogleSignIn}
        >
          <svg class="w-5 h-5 mr-sm" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>

        <!-- Apple Sign In (Disabled for now) -->
        <button
          disabled
          class="w-full flex items-center justify-center px-lg py-md bg-secondary-100 dark:bg-secondary-700 border border-secondary-300 dark:border-secondary-600 rounded-base text-base font-medium text-secondary-500 dark:text-secondary-400 cursor-not-allowed opacity-50"
        >
          <svg class="w-5 h-5 mr-sm" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
          </svg>
          Continue with Apple
          <span class="ml-xs text-xs">(Coming Soon)</span>
        </button>
      </div>

      <!-- Terms -->
      <div class="text-sm text-[var(--color-text-secondary)]">
        By signing in, you agree to our Terms of Service and Privacy Policy.
      </div>

      <!-- Back to Home -->
      <button
        class="text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 text-sm font-medium transition-colors duration-fast"
        on:click={() => navigateTo('/')}
      >
        ← Back to Home
      </button>
    </div>
  </div>
</div>
