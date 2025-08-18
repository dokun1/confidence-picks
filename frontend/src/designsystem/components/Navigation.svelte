<script>
  import { createEventDispatcher } from 'svelte';
  
  export let currentRoute = '/';
  export let displayName = null;
  export let showThemeToggle = true;
  export let darkMode = false;
  
  const dispatch = createEventDispatcher();
  let userMenuOpen = false;
  
  // Mobile menu state - using the exact same pattern that worked in TestMobileMenu
  let mobileMenuOpen = false;
  
  function toggleMobileMenu() {
    console.log('Before toggle:', mobileMenuOpen);
    mobileMenuOpen = !mobileMenuOpen;
    console.log('After toggle:', mobileMenuOpen);
    dispatch('mobileMenuToggle', { open: mobileMenuOpen });
  }
  
  // Navigation items configuration
  const navigationItems = [
    { label: 'Home', href: '/', icon: 'home' },
    { label: 'Groups', href: '/groups', icon: 'user-group' },
    { label: 'About', href: '/about', icon: 'information-circle' },
    { label: 'Design System', href: '/design-system', icon: 'cog-6-tooth' }
  ];
  
  // User menu items (shown when authenticated)
  const userMenuItems = [
    { label: 'Profile', href: '/profile', icon: 'user' },
    { label: 'Settings', href: '/settings', icon: 'cog-6-tooth' },
    { label: 'Sign Out', action: 'signOut', icon: 'arrow-right-on-rectangle' }
  ];
  
  function toggleUserMenu() {
    userMenuOpen = !userMenuOpen;
  }
  
  function toggleTheme() {
    dispatch('themeToggle', { darkMode: !darkMode });
  }
  
  function handleNavClick(href) {
    mobileMenuOpen = false;
    userMenuOpen = false;
    dispatch('navigate', { href });
  }

  function handleUserMenuClick(item) {
    mobileMenuOpen = false;
    userMenuOpen = false;
    
    if (item.action === 'signOut') {
      dispatch('signOut');
    } else if (item.href) {
      dispatch('navigate', { href: item.href });
    }
  }
  
  function isActive(href) {
    return currentRoute === href || (href !== '/' && currentRoute.startsWith(href));
  }
  
  function getIcon(iconName) {
    const iconPaths = {
      'home': 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
      'user-group': 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
      'information-circle': 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z',
      'cog-6-tooth': 'M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z M15 12a3 3 0 11-6 0 3 3 0 016 0z',
      'user': 'M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z',
      'arrow-right-on-rectangle': 'M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75',
      'bars-3': 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
      'x-mark': 'M6 18L18 6M6 6l12 12',
      'trophy': 'M16.5 18.75h-9m9 0a3 3 0 013 3h-15a3 3 0 013-3m9 0v-3.375c0-.621-.503-1.125-1.125-1.125h-.871M7.5 18.75v-3.375c0-.621.504-1.125 1.125-1.125h.872m5.007 0H9.497m5.007 0a7.454 7.454 0 01-.982-3.172M9.497 14.25a7.454 7.454 0 00.981-3.172M5.25 4.236c-.982.143-1.954.317-2.916.52A6.003 6.003 0 007.73 9.728M5.25 4.236V4.5c0 2.108.966 3.99 2.48 5.228M5.25 4.236V2.721C7.456 2.41 9.71 2.25 12 2.25c2.291 0 4.545.16 6.75.47v1.516M18.75 4.236c.982.143 1.954.317 2.916.52a6.003 6.003 0 01-5.395 4.972M18.75 4.236V4.5a9.018 9.018 0 01-2.48 5.228m2.48-5.492a46.95 46.95 0 01-2.48-.546M18.75 4.236v1.516c-.822-.1-1.653-.184-2.48-.546'
    };
    return iconPaths[iconName] || iconPaths['home'];
  }
  
  // Close mobile menu when clicking outside
  function handleOutsideClick(event) {
    if (mobileMenuOpen && !event.target.closest('.mobile-menu-container')) {
      console.log('Outside click detected, closing mobile menu');
      mobileMenuOpen = false;
    }
    if (userMenuOpen && !event.target.closest('.user-menu-container')) {
      userMenuOpen = false;
    }
  }
</script>

<svelte:window on:click={handleOutsideClick} />

<nav class="mobile-menu-container bg-neutral-0 dark:bg-secondary-900 border-b border-secondary-200 dark:border-secondary-700 transition-colors duration-fast">
  <div class="max-w-7xl mx-auto px-sm sm:px-md lg:px-lg">
    <div class="flex justify-between h-[4rem]">
      <!-- Logo and Brand -->
      <div class="flex items-center">
        <!-- Mobile hamburger button -->
        <button 
          class="md:hidden mr-xs p-xs rounded-base text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800 transition-colors duration-fast focus:outline-none focus:ring-1 focus:ring-primary-500"
          on:click={toggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          <svg class="w-[1.5rem] h-[1.5rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"></path>
          </svg>
        </button>
        
        <div class="flex items-center">
          <div class="w-[2rem] h-[2rem] bg-primary-500 rounded-base mr-xs flex items-center justify-center">
            <svg class="w-[1.25rem] h-[1.25rem] text-neutral-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('trophy')}></path>
            </svg>
          </div>
          <span class="text-xl font-heading font-bold text-secondary-900 dark:text-neutral-0">
            Confidence Picks
          </span>
        </div>
      </div>

      <!-- Desktop Navigation -->
      <div class="hidden md:flex md:items-center md:space-x-lg">
        {#each navigationItems as item}
          <button
            class="flex items-center px-xs py-xxxs rounded-base text-sm font-medium transition-colors duration-fast {isActive(item.href) 
              ? 'text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900' 
              : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800'}"
            on:click={() => handleNavClick(item.href)}
          >
            <svg class="w-[1rem] h-[1rem] mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon(item.icon)}></path>
            </svg>
            {item.label}
          </button>
        {/each}
      </div>

      <!-- Right side controls -->
      <div class="flex items-center space-x-xs">
        <!-- Theme Toggle -->
        {#if showThemeToggle}
          <button
            class="p-xs rounded-base text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800 transition-colors duration-fast focus:outline-none focus:ring-1 focus:ring-primary-500"
            on:click={toggleTheme}
            aria-label="Toggle theme"
          >
            <svg class="w-[1.25rem] h-[1.25rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              {#if darkMode}
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636A9 9 0 1018.364 18.364 9.004 9.004 0 0012 21c-2.172 0-4.132-.771-5.664-2.051"></path>
              {:else}
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"></path>
              {/if}
            </svg>
          </button>
        {/if}

        <!-- User Menu or Sign In -->
        {#if displayName}
          <div class="relative user-menu-container">
            <button
              class="flex items-center p-xs rounded-base text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-800 transition-colors duration-fast focus:outline-none focus:ring-1 focus:ring-primary-500"
              on:click={toggleUserMenu}
              aria-label="User menu"
            >
              <div class="w-[2rem] h-[2rem] bg-primary-500 rounded-full flex items-center justify-center mr-xs">
                <span class="text-sm font-medium text-neutral-0">
                  {displayName.charAt(0).toUpperCase()}
                </span>
              </div>
              <span class="hidden lg:block text-sm font-medium mr-xs">{displayName}</span>
              <svg class="w-[1rem] h-[1rem] transition-transform duration-fast {userMenuOpen ? 'rotate-180' : ''}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M19.5 8.25l-7.5 7.5-7.5-7.5"></path>
              </svg>
            </button>

            <!-- User Dropdown -->
            {#if userMenuOpen}
              <div class="absolute right-0 mt-xs w-[12rem] bg-neutral-0 dark:bg-secondary-800 rounded-md shadow-lg border border-secondary-200 dark:border-secondary-700 py-xs z-50">
                {#each userMenuItems as item}
                  <button
                    class="flex items-center w-full px-sm py-xs text-left text-sm text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700 transition-colors duration-fast"
                    on:click={() => handleUserMenuClick(item)}
                  >
                    <svg class="w-[1rem] h-[1rem] mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon(item.icon)}></path>
                    </svg>
                    {item.label}
                  </button>
                {/each}
              </div>
            {/if}
          </div>
        {:else}
          <!-- Sign In Button -->
          <button
            class="px-sm py-xs bg-primary-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-primary-600 transition-colors duration-fast focus:outline-none focus:ring-1 focus:ring-primary-500 focus:ring-offset-1"
            on:click={() => handleNavClick('/login')}
          >
            Sign In
          </button>
        {/if}
      </div>
    </div>
  </div>

  <!-- Off-canvas Mobile Sidebar & Overlay -->
</nav>

<!-- Mobile overlay -->
{#if mobileMenuOpen}
  <div 
    class="fixed inset-0 bg-secondary-900 bg-opacity-50 z-40 md:hidden" 
    aria-hidden="true"
    on:click={() => { mobileMenuOpen = false; }}
  ></div>
{/if}

<!-- Slide-out sidebar -->
<aside 
  class="mobile-menu-container fixed top-0 left-0 w-64 h-full bg-neutral-50 dark:bg-secondary-800 border-r border-secondary-200 dark:border-secondary-700 transform transition-transform duration-300 ease-in-out z-50 md:hidden pt-16 p-md {mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}"
  aria-label="Mobile navigation"
>
  <!-- Close button (visible when open) -->
  <button
    class="absolute top-4 right-4 p-2 rounded-base text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-700 focus:outline-none focus:ring-1 focus:ring-primary-500"
    on:click={() => { mobileMenuOpen = false; }}
    aria-label="Close menu"
  >
    <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('x-mark')}></path>
    </svg>
  </button>

  <div class="space-y-sm mt-sm">
    <h2 class="text-xs font-semibold tracking-wide uppercase text-secondary-500 dark:text-secondary-400">Menu</h2>
    <div class="space-y-xxs">
      {#each navigationItems as item}
        <button
          class="flex items-center w-full px-sm py-xs rounded-base text-left text-sm font-medium transition-colors duration-fast {isActive(item.href)
            ? 'text-primary-600 bg-primary-50 dark:text-primary-400 dark:bg-primary-900'
            : 'text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700'}"
          on:click={() => handleNavClick(item.href)}
        >
          <svg class="w-[1rem] h-[1rem] mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon(item.icon)}></path>
          </svg>
          {item.label}
        </button>
      {/each}
    </div>
  </div>

  {#if showThemeToggle}
    <div class="mt-lg pt-md border-t border-secondary-200 dark:border-secondary-700">
      <button
        class="flex items-center w-full px-sm py-xs rounded-base text-left text-sm font-medium text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700 transition-colors duration-fast"
        on:click={toggleTheme}
      >
        <svg class="w-[1rem] h-[1rem] mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          {#if darkMode}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636A9 9 0 1018.364 18.364 9.004 9.004 0 0012 21c-2.172 0-4.132-.771-5.664-2.051"></path>
          {:else}
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z"></path>
          {/if}
        </svg>
        Toggle Theme
      </button>
    </div>
  {/if}

  {#if displayName}
    <div class="mt-md">
      <h2 class="text-xs font-semibold tracking-wide uppercase text-secondary-500 dark:text-secondary-400 mb-xxs">Account</h2>
      {#each userMenuItems as item}
        <button
          class="flex items-center w-full px-sm py-xs rounded-base text-left text-sm font-medium text-secondary-700 hover:text-secondary-900 hover:bg-secondary-50 dark:text-secondary-300 dark:hover:text-secondary-100 dark:hover:bg-secondary-700 transition-colors duration-fast"
          on:click={() => handleUserMenuClick(item)}
        >
          <svg class="w-[1rem] h-[1rem] mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon(item.icon)}></path>
          </svg>
          {item.label}
        </button>
      {/each}
    </div>
  {/if}
</aside>