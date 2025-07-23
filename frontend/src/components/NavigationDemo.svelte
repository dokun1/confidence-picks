<script>
  import Navigation from '../designsystem/components/Navigation.svelte';
  
  let currentRoute = '/design-system/navigation';
  let darkMode = false;
  let userName = null;
  let showAuthenticated = false;
  
  function handleNavigate(event) {
    console.log('Navigate to:', event.detail.href);
    currentRoute = event.detail.href;
  }
  
  function handleThemeToggle(event) {
    darkMode = event.detail.darkMode;
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  
  function handleMobileMenuToggle(event) {
    console.log('Mobile menu:', event.detail.open ? 'opened' : 'closed');
  }
  
  function toggleAuthState() {
    showAuthenticated = !showAuthenticated;
    userName = showAuthenticated ? 'John Doe' : null;
  }
</script>

<main class="min-h-screen">
  <!-- Demo Navigation -->
  <Navigation 
    {currentRoute}
    {darkMode}
    {userName}
    on:navigate={handleNavigate}
    on:themeToggle={handleThemeToggle}
    on:mobileMenuToggle={handleMobileMenuToggle}
  />
  
  <div class="p-lg">
    <div class="max-w-4xl mx-auto space-y-lg">
      <!-- Header -->
      <header>
        <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-xs">
          Navigation Component
        </h1>
        <p class="text-lg text-[var(--color-text-secondary)]">
          Responsive navigation with mobile menu, theme toggle, and user authentication states.
        </p>
      </header>

      <!-- Interactive Controls -->
      <section class="space-y-md">
        <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
          Interactive Demo
        </h2>
        <p class="text-[var(--color-text-secondary)] mb-md">
          The navigation above is fully interactive. Try the controls below to test different states:
        </p>
        
        <div class="bg-neutral-50 dark:bg-secondary-800 p-md rounded-base">
          <div class="flex flex-wrap gap-md items-center">
            <button
              class="px-sm py-xs bg-primary-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-primary-600 transition-colors duration-fast"
              on:click={toggleAuthState}
            >
              {showAuthenticated ? 'Sign Out' : 'Sign In'} (Demo)
            </button>
            
            <button
              class="px-sm py-xs bg-secondary-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-secondary-600 transition-colors duration-fast"
              on:click={() => handleThemeToggle({ detail: { darkMode: !darkMode } })}
            >
              Toggle Theme
            </button>
            
            <div class="text-sm text-[var(--color-text-secondary)]">
              Current route: <code class="bg-secondary-100 dark:bg-secondary-700 px-xs py-xxxs rounded text-primary-600 dark:text-primary-400">{currentRoute}</code>
            </div>
          </div>
        </div>
      </section>

      <!-- Features -->
      <section class="space-y-md">
        <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
          Features
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
              📱 Responsive Design
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Horizontal layout on desktop, hamburger menu on mobile with smooth transitions.
            </p>
          </div>
          
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
              🌓 Theme Support
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Built-in light/dark mode toggle with proper contrast ratios and design tokens.
            </p>
          </div>
          
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
              👤 User States
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Supports both authenticated and guest states with user menu dropdown.
            </p>
          </div>
          
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
              ♿ Accessibility
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Full keyboard navigation, ARIA labels, and screen reader support.
            </p>
          </div>
          
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
              🎯 Active States
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Visual indication of current page with proper highlighting and focus states.
            </p>
          </div>
          
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
              🎨 Design System
            </h3>
            <p class="text-[var(--color-text-secondary)] text-sm">
              Uses only design system tokens for all styling - no magic values.
            </p>
          </div>
        </div>
      </section>

      <!-- Navigation Items -->
      <section class="space-y-md">
        <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
          Navigation Items
        </h2>
        <p class="text-[var(--color-text-secondary)] mb-md">
          The navigation includes these main sections for the NFL confidence picks application:
        </p>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div class="space-y-sm">
            <h3 class="text-lg font-heading font-medium text-[var(--color-text-primary)]">
              Main Navigation
            </h3>
            <ul class="space-y-xs">
              <li class="flex items-center text-[var(--color-text-secondary)]">
                <svg class="w-[1rem] h-[1rem] mr-xs text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25"></path>
                </svg>
                <strong>Home</strong> - Main dashboard and overview
              </li>
              <li class="flex items-center text-[var(--color-text-secondary)]">
                <svg class="w-[1rem] h-[1rem] mr-xs text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6.75 3v2.25M17.25 3v2.25M3 18.75V7.5a2.25 2.25 0 012.25-2.25h13.5A2.25 2.25 0 0121 7.5v11.25m-18 0A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75m-18 0v-7.5A2.25 2.25 0 015.25 9h13.5A2.25 2.25 0 0121 11.25v7.5"></path>
                </svg>
                <strong>Games</strong> - Browse NFL games by week
              </li>
              <li class="flex items-center text-[var(--color-text-secondary)]">
                <svg class="w-[1rem] h-[1rem] mr-xs text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z"></path>
                </svg>
                <strong>My Picks</strong> - Submit confidence picks
              </li>
              <li class="flex items-center text-[var(--color-text-secondary)]">
                <svg class="w-[1rem] h-[1rem] mr-xs text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.018 9.018 0 01-2.48 5.228m2.48-5.492a46.95 46.95 0 01-2.48-.546M18.75 4.236v1.516c-.822-.1-1.653-.184-2.48-.546"></path>
                </svg>
                <strong>Leaderboard</strong> - View rankings and scores
              </li>
            </ul>
          </div>
          
          <div class="space-y-sm">
            <h3 class="text-lg font-heading font-medium text-[var(--color-text-primary)]">
              User Menu (When Authenticated)
            </h3>
            <ul class="space-y-xs">
              <li class="flex items-center text-[var(--color-text-secondary)]">
                <svg class="w-[1rem] h-[1rem] mr-xs text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z"></path>
                </svg>
                <strong>Profile</strong> - User profile settings
              </li>
              <li class="flex items-center text-[var(--color-text-secondary)]">
                <svg class="w-[1rem] h-[1rem] mr-xs text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z"></path>
                </svg>
                <strong>Settings</strong> - Application preferences
              </li>
              <li class="flex items-center text-[var(--color-text-secondary)]">
                <svg class="w-[1rem] h-[1rem] mr-xs text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75"></path>
                </svg>
                <strong>Sign Out</strong> - Authentication logout
              </li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Responsive Behavior -->
      <section class="space-y-md">
        <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
          Responsive Behavior
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
              🖥️ Desktop (md and up)
            </h3>
            <ul class="space-y-xs text-[var(--color-text-secondary)] text-sm">
              <li>• Horizontal navigation bar with all items visible</li>
              <li>• User menu with dropdown for authenticated users</li>
              <li>• Theme toggle in header</li>
              <li>• Hover states for all interactive elements</li>
            </ul>
          </div>
          
          <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
            <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
              📱 Mobile (below md)
            </h3>
            <ul class="space-y-xs text-[var(--color-text-secondary)] text-sm">
              <li>• Hamburger menu button</li>
              <li>• Slide-out navigation panel</li>
              <li>• Full-width navigation items</li>
              <li>• Larger touch targets for better usability</li>
            </ul>
          </div>
        </div>
      </section>

      <!-- Usage Guidelines -->
      <section class="space-y-md">
        <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
          Usage Guidelines
        </h2>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <div class="p-md bg-success-50 dark:bg-success-900 rounded-base border border-success-200 dark:border-success-800">
            <h3 class="text-lg font-heading font-semibold text-success-800 dark:text-success-200 mb-sm">
              ✓ Do
            </h3>
            <ul class="space-y-xs text-success-700 dark:text-success-300">
              <li>• Keep navigation items concise and clear</li>
              <li>• Use consistent iconography</li>
              <li>• Provide visual feedback for active states</li>
              <li>• Test mobile usability thoroughly</li>
              <li>• Ensure proper contrast ratios</li>
            </ul>
          </div>
          
          <div class="p-md bg-error-50 dark:bg-error-900 rounded-base border border-error-200 dark:border-error-800">
            <h3 class="text-lg font-heading font-semibold text-error-800 dark:text-error-200 mb-sm">
              ✗ Don't
            </h3>
            <ul class="space-y-xs text-error-700 dark:text-error-300">
              <li>• Don't overload with too many items</li>
              <li>• Don't use unclear or generic labels</li>
              <li>• Don't forget mobile accessibility</li>
              <li>• Don't use inconsistent styling</li>
              <li>• Don't hide important actions in submenus</li>
            </ul>
          </div>
        </div>
      </section>
    </div>
  </div>
</main>
