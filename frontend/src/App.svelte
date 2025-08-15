<script>
  import { onMount } from 'svelte';
  import { currentRoute, initRouter, navigateTo } from './lib/router';
  import Navigation from './designsystem/components/Navigation.svelte';
  import GamesPage from './components/GamesPage.svelte';
  import DesignSystemHub from './components/DesignSystemHub.svelte';
  import LoginPage from './components/LoginPage.svelte';
  import ProfilePage from './components/ProfilePage.svelte';
  import AuthCallback from './components/AuthCallback.svelte';
  import AuthService from './lib/authService.js';
  import { auth, setAuthUser, clearAuth } from './lib/authStore.js';

  let darkMode = false;

  // Reflect auth store into local vars used by the UI
  $: isAuthenticated = $auth?.isAuthenticated ?? false;
  $: userName = $auth?.user?.name || null;

  onMount(async () => {
    initRouter();
    
    // Check for saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      darkMode = true;
      document.documentElement.classList.add('dark');
    }

    // Check authentication status
    await checkAuthStatus();
  });

  async function checkAuthStatus() {
    if (AuthService.isAuthenticated()) {
      try {
        let user = AuthService.getUser();
        if (!user) {
          user = await AuthService.getCurrentUser();
        }
        
        if (user) {
          // Update global auth store so UI updates immediately
          setAuthUser(user);
        } else {
          AuthService.clearTokens();
          clearAuth();
        }
      } catch (error) {
        console.error('Auth check failed:', error);
        AuthService.clearTokens();
        clearAuth();
      }
    } else {
      clearAuth();
    }
  }

  function handleNavigate(event) {
    navigateTo(event.detail.href);
  }

  function handleThemeToggle(event) {
    darkMode = event.detail.darkMode;
    if (darkMode) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }

  function handleMobileMenuToggle(event) {
    console.log('Mobile menu:', event.detail.open ? 'opened' : 'closed');
  }

  function handleSignOut() {
    AuthService.logout();
    clearAuth();
  }
</script>

<!-- Navigation -->
<Navigation 
  currentRoute={$currentRoute}
  {darkMode}
  {userName}
  on:navigate={handleNavigate}
  on:themeToggle={handleThemeToggle}
  on:mobileMenuToggle={handleMobileMenuToggle}
  on:signOut={handleSignOut}
/>

<!-- Main Content -->
<main class="min-h-screen bg-neutral-0 dark:bg-secondary-900 transition-colors duration-fast">
  {#if $currentRoute === '/' || $currentRoute === 'home'}
    <!-- Home Page -->
    <div class="max-w-4xl mx-auto px-lg py-lg">
      <div class="text-center space-y-lg">
        <header class="space-y-md">
          <h1 class="text-4xl font-heading font-bold text-[var(--color-text-primary)]">
            Welcome to Confidence Picks!
          </h1>
          <p class="text-xl text-[var(--color-text-secondary)] max-w-2xl mx-auto">
            Your ultimate destination for NFL confidence picks. Compete with friends, track your performance, and climb the leaderboard.
          </p>
        </header>

        <!-- Feature Cards -->
        <div class="grid grid-cols-1 md:grid-cols-3 gap-md">
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <div class="w-12 h-12 bg-primary-100 dark:bg-primary-900 rounded-base flex items-center justify-center mx-auto mb-sm">
              <svg class="w-6 h-6 text-primary-600 dark:text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"></path>
              </svg>
            </div>
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-xs">
              Weekly Games
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Browse NFL games by week and make your confidence picks for each matchup.
            </p>
          </div>

          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <div class="w-12 h-12 bg-success-100 dark:bg-success-900 rounded-base flex items-center justify-center mx-auto mb-sm">
              <svg class="w-6 h-6 text-success-600 dark:text-success-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"></path>
              </svg>
            </div>
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-xs">
              Confidence Picks
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Rank your picks by confidence level and earn points based on your accuracy.
            </p>
          </div>

          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <div class="w-12 h-12 bg-warning-100 dark:bg-warning-900 rounded-base flex items-center justify-center mx-auto mb-sm">
              <svg class="w-6 h-6 text-warning-600 dark:text-warning-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.018 9.018 0 01-2.48 5.228m2.48-5.492a46.95 46.95 0 01-2.48-.546M18.75 4.236v1.516c-.822-.1-1.653-.184-2.48-.546"></path>
              </svg>
            </div>
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-xs">
              Leaderboards
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Compete with friends and track your ranking throughout the season.
            </p>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="space-y-md">
          <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
            Get Started
          </h2>
          <div class="flex flex-col sm:flex-row gap-sm justify-center">
            {#if isAuthenticated}
              <button
                class="px-lg py-sm bg-primary-500 text-neutral-0 rounded-base text-base font-medium hover:bg-primary-600 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                on:click={() => navigateTo('/games')}
              >
                View This Week's Games
              </button>
              <button
                class="px-lg py-sm bg-secondary-100 text-secondary-900 border border-secondary-300 rounded-base text-base font-medium hover:bg-secondary-200 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 dark:bg-secondary-800 dark:text-secondary-100 dark:border-secondary-600 dark:hover:bg-secondary-700"
                on:click={() => navigateTo('/picks')}
              >
                My Picks
              </button>
            {:else}
              <button
                class="px-lg py-sm bg-primary-500 text-neutral-0 rounded-base text-base font-medium hover:bg-primary-600 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
                on:click={() => navigateTo('/login')}
              >
                Sign In to Get Started
              </button>
              <button
                class="px-lg py-sm bg-secondary-100 text-secondary-900 border border-secondary-300 rounded-base text-base font-medium hover:bg-secondary-200 transition-colors duration-fast focus:outline-none focus:ring-2 focus:ring-secondary-500 focus:ring-offset-2 dark:bg-secondary-800 dark:text-secondary-100 dark:border-secondary-600 dark:hover:bg-secondary-700"
                on:click={() => navigateTo('/games')}
              >
                View Games
              </button>
            {/if}
          </div>
        </div>
      </div>
    </div>
  {:else if $currentRoute === '/games'}
    <!-- Games Page -->
    <GamesPage />
  {:else if $currentRoute === '/design-system'}
    <!-- Design System Hub -->
    <DesignSystemHub />
  {:else if $currentRoute === '/login'}
    <!-- Login Page -->
    <LoginPage />
  {:else if $currentRoute === '/profile'}
    <!-- Profile Page -->
    <ProfilePage />
  {:else if $currentRoute.startsWith('/auth/callback')}
    <!-- Auth Callback -->
    <AuthCallback />
  {:else if $currentRoute === '/picks'}
    <!-- My Picks Page (Future) -->
    <div class="max-w-4xl mx-auto px-lg py-lg">
      <div class="text-center space-y-md">
        <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
          My Picks
        </h1>
        <p class="text-lg text-[var(--color-text-secondary)]">
          Coming soon! This will be where you manage your confidence picks.
        </p>
        <div class="p-lg bg-neutral-50 dark:bg-secondary-800 rounded-base border border-secondary-200 dark:border-secondary-700">
          <div class="text-4xl mb-md">🚧</div>
          <p class="text-[var(--color-text-secondary)]">
            This feature is under development. Check back soon!
          </p>
        </div>
      </div>
    </div>
  {:else if $currentRoute === '/leaderboard'}
    <!-- Leaderboard Page (Future) -->
    <div class="max-w-4xl mx-auto px-lg py-lg">
      <div class="text-center space-y-md">
        <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
          Leaderboard
        </h1>
        <p class="text-lg text-[var(--color-text-secondary)]">
          Coming soon! This will show rankings and scores for all players.
        </p>
        <div class="p-lg bg-neutral-50 dark:bg-secondary-800 rounded-base border border-secondary-200 dark:border-secondary-700">
          <div class="text-4xl mb-md">🏆</div>
          <p class="text-[var(--color-text-secondary)]">
            This feature is under development. Check back soon!
          </p>
        </div>
      </div>
    </div>
  {:else}
    <!-- 404 Page -->
    <div class="max-w-4xl mx-auto px-lg py-lg">
      <div class="text-center space-y-md">
        <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
          Page Not Found
        </h1>
        <p class="text-lg text-[var(--color-text-secondary)]">
          The page you're looking for doesn't exist.
        </p>
        <div class="p-lg bg-error-50 dark:bg-error-900 rounded-base border border-error-200 dark:border-error-800">
          <div class="text-4xl mb-md">🔍</div>
          <p class="text-error-700 dark:text-error-300">
            Sorry, we couldn't find what you were looking for.
          </p>
          <button
            class="mt-md px-md py-xs bg-primary-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-primary-600 transition-colors duration-fast"
            on:click={() => navigateTo('/')}
          >
            Go Home
          </button>
        </div>
      </div>
    </div>
  {/if}
</main>