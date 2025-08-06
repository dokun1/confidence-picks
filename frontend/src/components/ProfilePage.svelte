<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import AuthService from '../lib/authService.js';

  let user = null;
  let loading = true;

  onMount(async () => {
    // Check if user is authenticated
    if (!AuthService.isAuthenticated()) {
      navigateTo('/login');
      return;
    }

    try {
      // Get user from cache or API
      user = AuthService.getUser();
      if (!user) {
        user = await AuthService.getCurrentUser();
      }
      
      if (!user) {
        throw new Error('Failed to get user info');
      }
    } catch (error) {
      console.error('Failed to load profile:', error);
      AuthService.clearTokens();
      navigateTo('/login');
    }
    
    loading = false;
  });

  function handleSignOut() {
    AuthService.logout();
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900">
  <div class="max-w-4xl mx-auto px-lg py-lg">
    {#if loading}
      <div class="flex items-center justify-center py-xl">
        <div class="w-8 h-8">
          <svg class="animate-spin w-8 h-8 text-primary-500" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
        </div>
      </div>
    {:else if user}
      <div class="space-y-lg">
        <!-- Header -->
        <div class="flex items-center justify-between">
          <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
            My Profile
          </h1>
          <button
            class="px-md py-sm bg-error-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-error-600 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2"
            on:click={handleSignOut}
          >
            Sign Out
          </button>
        </div>

        <!-- Profile Card -->
        <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
          <div class="flex items-start space-x-lg">
            <!-- Profile Picture -->
            <div class="flex-shrink-0">
              {#if user.pictureUrl}
                <img
                  src={user.pictureUrl}
                  alt={user.name}
                  class="w-24 h-24 rounded-full border-2 border-secondary-200 dark:border-secondary-600"
                />
              {:else}
                <div class="w-24 h-24 bg-primary-500 rounded-full flex items-center justify-center">
                  <span class="text-2xl font-bold text-neutral-0">
                    {user.name.charAt(0).toUpperCase()}
                  </span>
                </div>
              {/if}
            </div>

            <!-- Profile Info -->
            <div class="flex-1 space-y-md">
              <div>
                <h2 class="text-2xl font-heading font-bold text-[var(--color-text-primary)]">
                  {user.name}
                </h2>
                <p class="text-lg text-[var(--color-text-secondary)]">
                  {user.email}
                </p>
              </div>

              <!-- Authentication Provider -->
              <div class="flex items-center space-x-sm">
                <span class="text-sm text-[var(--color-text-secondary)]">
                  Signed in with:
                </span>
                <div class="flex items-center space-x-xs px-sm py-xs bg-primary-50 dark:bg-primary-900 rounded-md">
                  {#if user.provider === 'google'}
                    <svg class="w-4 h-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                    </svg>
                    <span class="text-sm font-medium text-primary-600 dark:text-primary-400">Google</span>
                  {:else if user.provider === 'apple'}
                    <svg class="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z"/>
                    </svg>
                    <span class="text-sm font-medium text-primary-600 dark:text-primary-400">Apple</span>
                  {/if}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Account Details -->
        <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
          <h3 class="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-md">
            Account Details
          </h3>
          
          <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
            <div class="space-y-xs">
              <dt class="text-sm font-medium text-[var(--color-text-secondary)]">User ID</dt>
              <dd class="text-base text-[var(--color-text-primary)] font-mono">{user.id}</dd>
            </div>
            
            <div class="space-y-xs">
              <dt class="text-sm font-medium text-[var(--color-text-secondary)]">Email Address</dt>
              <dd class="text-base text-[var(--color-text-primary)]">{user.email}</dd>
            </div>
            
            <div class="space-y-xs">
              <dt class="text-sm font-medium text-[var(--color-text-secondary)]">Full Name</dt>
              <dd class="text-base text-[var(--color-text-primary)]">{user.name}</dd>
            </div>
            
            <div class="space-y-xs">
              <dt class="text-sm font-medium text-[var(--color-text-secondary)]">Authentication Provider</dt>
              <dd class="text-base text-[var(--color-text-primary)] capitalize">{user.provider}</dd>
            </div>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
          <h3 class="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-md">
            Quick Actions
          </h3>
          
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-md">
            <button
              class="flex items-center justify-center px-md py-sm bg-primary-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-primary-600 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              on:click={() => navigateTo('/games')}
            >
              <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"></path>
              </svg>
              View Games
            </button>

            <button
              class="flex items-center justify-center px-md py-sm bg-secondary-100 dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100 border border-secondary-300 dark:border-secondary-600 rounded-base text-sm font-medium hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2"
              on:click={() => navigateTo('/picks')}
            >
              <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"></path>
              </svg>
              My Picks
            </button>

            <button
              class="flex items-center justify-center px-md py-sm bg-secondary-100 dark:bg-secondary-700 text-secondary-900 dark:text-secondary-100 border border-secondary-300 dark:border-secondary-600 rounded-base text-sm font-medium hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2"
              on:click={() => navigateTo('/leaderboard')}
            >
              <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.018 9.018 0 01-2.48 5.228m2.48-5.492a46.95 46.95 0 01-2.48-.546M18.75 4.236v1.516c-.822-.1-1.653-.184-2.48-.546"></path>
              </svg>
              Leaderboard
            </button>
          </div>
        </div>

        <!-- Danger Zone -->
        <div class="bg-error-50 dark:bg-error-900 border border-error-200 dark:border-error-800 rounded-lg p-lg">
          <h3 class="text-xl font-heading font-semibold text-error-700 dark:text-error-300 mb-md">
            Account Actions
          </h3>
          <p class="text-sm text-error-600 dark:text-error-400 mb-md">
            These actions will affect your account. Use with caution.
          </p>
          <button
            class="px-md py-sm bg-error-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-error-600 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2"
            on:click={handleSignOut}
          >
            Sign Out of Account
          </button>
        </div>
      </div>
    {:else}
      <div class="text-center py-xl">
        <p class="text-lg text-[var(--color-text-secondary)]">
          Failed to load profile information.
        </p>
        <button
          class="mt-md px-lg py-sm bg-primary-500 text-neutral-0 rounded-base text-base font-medium hover:bg-primary-600 transition-colors duration-fast"
          on:click={() => navigateTo('/login')}
        >
          Sign In Again
        </button>
      </div>
    {/if}
  </div>
</div>
