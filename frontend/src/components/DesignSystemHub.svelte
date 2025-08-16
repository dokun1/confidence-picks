<script>
  import Button from '../designsystem/components/Button.svelte';
  import ButtonsDemo from './ButtonsDemo.svelte';
  import TextFieldsDemo from './TextFieldsDemo.svelte';
  import NavigationDemo from './NavigationDemo.svelte';
  import ColorPaletteDemo from './ColorPaletteDemo.svelte';
  import GroupCardDemo from './GroupCardDemo.svelte';
  import CreateGroupFormDemo from './CreateGroupFormDemo.svelte';
  import JoinGroupFormDemo from './JoinGroupFormDemo.svelte';
  import GroupsListDemo from './GroupsListDemo.svelte';
  import GroupPicksDemo from './GroupPicksDemo.svelte';
  
  let currentDemo = 'overview';
  let sidebarOpen = false;
  
  const demoSections = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'buttons', label: 'Buttons', icon: 'squares-2x2' },
    { id: 'text-fields', label: 'Text Fields', icon: 'rectangle-stack' },
    { id: 'navigation', label: 'Navigation', icon: 'bars-3' },
    { id: 'colors', label: 'Colors', icon: 'swatch' },
    { id: 'group-card', label: 'Group Card', icon: 'user-group' },
    { id: 'create-group-form', label: 'Create Group Form', icon: 'plus-circle' },
    { id: 'join-group-form', label: 'Join Group Form', icon: 'arrow-right-circle' },
    { id: 'groups-list', label: 'Groups List', icon: 'list-bullet' },
    { id: 'group-picks', label: 'Group Picks', icon: 'chart-bar' }
  ];
  
  function switchDemo(demoId) {
    currentDemo = demoId;
    // Close sidebar on mobile after selection
    if (window.innerWidth < 768) {
      sidebarOpen = false;
    }
  }
  
  function toggleSidebar() {
    sidebarOpen = !sidebarOpen;
  }
  
  function getIcon(iconName) {
    const iconPaths = {
      'home': 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
      'squares-2x2': 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
      'rectangle-stack': 'M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5',
      'bars-3': 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
      'swatch': 'M20.24 12.24a3 3 0 00-4.24-4.24L11.76 12.24a3 3 0 104.24 4.24l4.24-4.24z M15.07 8.93a1.5 1.5 0 00-2.12 0L8.71 13.17a1.5 1.5 0 002.12 2.12l4.24-4.24a1.5 1.5 0 000-2.12z',
      'user-group': 'M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z',
      'plus-circle': 'M12 9v6m3-3H9m12 0a9 9 0 11-18 0 9 9 0 0118 0z',
      'arrow-right-circle': 'M12.75 15l3-3m0 0l-3-3m3 3h-7.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
      'list-bullet': 'M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zM3.75 12h.007v.008H3.75V12zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0zm-.375 5.25h.007v.008H3.75v-.008zm.375 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z',
      'chart-bar': 'M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z'
    };
    return iconPaths[iconName] || iconPaths['home'];
  }
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900 pt-16">
  <!-- Mobile Sidebar Toggle -->
  <div class="md:hidden border-b border-secondary-200 dark:border-secondary-700 bg-neutral-0 dark:bg-secondary-900 px-md py-sm">
    <button
      class="flex items-center text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100"
      on:click={toggleSidebar}
    >
      <svg class="w-5 h-5 mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5"></path>
      </svg>
      Design System Menu
    </button>
  </div>
  
  <div class="flex relative">
    <!-- Sidebar Navigation -->
    <aside class="
      {sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      md:translate-x-0 
      fixed md:static 
      top-0 md:top-auto 
      left-0 
      w-64 
      h-full md:h-auto 
      bg-neutral-50 dark:bg-secondary-800 
      border-r border-secondary-200 dark:border-secondary-700 
      min-h-screen 
      p-md 
      transition-transform duration-300 ease-in-out
      z-40
      pt-20 md:pt-md
    ">
      <!-- Close button for mobile -->
      <button
        class="md:hidden absolute top-4 right-4 p-2 text-secondary-600 dark:text-secondary-400"
        on:click={toggleSidebar}
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
      <div class="space-y-xs">
        <h2 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-md">
          Design System
        </h2>
        {#each demoSections as section}
          <button
            class="flex items-center w-full px-sm py-xs rounded-base text-left transition-colors duration-fast {currentDemo === section.id
              ? 'bg-primary-100 text-primary-700 dark:bg-primary-900 dark:text-primary-300'
              : 'text-secondary-600 hover:text-secondary-900 hover:bg-secondary-100 dark:text-secondary-400 dark:hover:text-secondary-100 dark:hover:bg-secondary-700'}"
            on:click={() => switchDemo(section.id)}
          >
            <svg class="w-[1rem] h-[1rem] mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon(section.icon)}></path>
            </svg>
            {section.label}
          </button>
        {/each}
      </div>
    </aside>
    
    <!-- Overlay for mobile -->
    {#if sidebarOpen}
      <div 
        class="md:hidden fixed inset-0 bg-secondary-900 bg-opacity-50 z-30"
        on:click={toggleSidebar}
      ></div>
    {/if}
    
    <!-- Main Content -->
    <main class="flex-1 md:ml-0">
      {#if currentDemo === 'overview'}
        <div class="p-lg">
          <div class="max-w-4xl mx-auto space-y-lg">
            <!-- Header -->
            <header>
              <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-xs">
                Confidence Picks Design System
              </h1>
              <p class="text-lg text-[var(--color-text-secondary)]">
                A comprehensive design system built with design tokens, supporting light and dark modes for the NFL confidence picks application.
              </p>
            </header>

            <!-- Quick Stats -->
            <section class="grid grid-cols-1 md:grid-cols-4 gap-md">
              <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base text-center">
                <div class="text-2xl font-bold text-primary-600 dark:text-primary-400 mb-xs">3</div>
                <div class="text-sm text-[var(--color-text-secondary)]">Components</div>
              </div>
              <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base text-center">
                <div class="text-2xl font-bold text-success-600 dark:text-success-400 mb-xs">8</div>
                <div class="text-sm text-[var(--color-text-secondary)]">Color Palettes</div>
              </div>
              <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base text-center">
                <div class="text-2xl font-bold text-warning-600 dark:text-warning-400 mb-xs">50+</div>
                <div class="text-sm text-[var(--color-text-secondary)]">Design Tokens</div>
              </div>
              <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base text-center">
                <div class="text-2xl font-bold text-error-600 dark:text-error-400 mb-xs">2</div>
                <div class="text-sm text-[var(--color-text-secondary)]">Theme Modes</div>
              </div>
            </section>

            <!-- Component Showcase -->
            <section class="space-y-md">
              <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
                Components Overview
              </h2>
              
              <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
                <!-- Buttons Card -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('squares-2x2')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Buttons
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Four button variants with multiple sizes, states, and full accessibility support.
                  </p>
                  <div class="flex flex-wrap gap-xs mb-md">
                    <Button variant="primary" size="sm">Primary</Button>
                    <Button variant="secondary" size="sm">Secondary</Button>
                    <Button variant="tertiary" size="sm">Tertiary</Button>
                    <Button variant="destructive" size="sm">Destructive</Button>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('buttons')}
                  >
                    View Button Documentation →
                  </button>
                </div>

                <!-- Text Fields Card -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('rectangle-stack')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Text Fields
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Input components with validation, security features, and animated placeholders.
                  </p>
                  <div class="mb-md">
                    <div class="relative">
                      <input class="w-full px-sm py-xs rounded-base border border-secondary-300 dark:border-secondary-600 bg-neutral-0 dark:bg-secondary-800 text-neutral-900 dark:text-neutral-0" placeholder="Demo text field..." />
                    </div>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('text-fields')}
                  >
                    View Text Field Documentation →
                  </button>
                </div>

                <!-- Navigation Card -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('bars-3')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Navigation
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Responsive navigation with mobile menu, theme toggle, and user authentication states.
                  </p>
                  <div class="mb-md">
                    <div class="bg-secondary-100 dark:bg-secondary-700 p-xs rounded text-xs text-[var(--color-text-secondary)]">
                      Navigation component shown above ↑
                    </div>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('navigation')}
                  >
                    View Navigation Documentation →
                  </button>
                </div>

                <!-- Colors Card -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('swatch')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Color Palette
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Complete color system with semantic colors, proper contrast ratios, and dark mode support.
                  </p>
                  <div class="flex gap-xs mb-md">
                    <div class="w-6 h-6 bg-primary-500 rounded"></div>
                    <div class="w-6 h-6 bg-success-500 rounded"></div>
                    <div class="w-6 h-6 bg-warning-500 rounded"></div>
                    <div class="w-6 h-6 bg-error-500 rounded"></div>
                    <div class="w-6 h-6 bg-secondary-500 rounded"></div>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('colors')}
                  >
                    View Color Documentation →
                  </button>
                </div>

                <!-- Group Card -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('user-group')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Group Card
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Display group information with member counts, owner/member badges, and contextual actions.
                  </p>
                  <div class="mb-md">
                    <div class="bg-secondary-100 dark:bg-secondary-700 p-sm rounded text-xs text-[var(--color-text-secondary)]">
                      Mini group card preview
                    </div>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('group-card')}
                  >
                    View Group Card Documentation →
                  </button>
                </div>

                <!-- Create Group Form -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('plus-circle')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Create Group Form
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Form for creating new groups with validation, auto-ID generation, and loading states.
                  </p>
                  <div class="mb-md">
                    <Button variant="primary" size="sm">Create New Group</Button>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('create-group-form')}
                  >
                    View Create Group Form Documentation →
                  </button>
                </div>

                <!-- Join Group Form -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('arrow-right-circle')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Join Group Form
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Simple form for joining existing groups by group identifier with validation.
                  </p>
                  <div class="mb-md">
                    <Button variant="secondary" size="sm">Join Existing Group</Button>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('join-group-form')}
                  >
                    View Join Group Form Documentation →
                  </button>
                </div>

                <!-- Groups List -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('list-bullet')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Groups List
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Master component for displaying all user groups with empty states and action panels.
                  </p>
                  <div class="mb-md">
                    <div class="bg-secondary-100 dark:bg-secondary-700 p-sm rounded text-xs text-[var(--color-text-secondary)]">
                      Grid layout with group cards
                    </div>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('groups-list')}
                  >
                    View Groups List Documentation →
                  </button>
                </div>

                <!-- Group Picks -->
                <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
                  <div class="flex items-center mb-sm">
                    <svg class="w-[1.25rem] h-[1.25rem] mr-sm text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d={getIcon('chart-bar')}></path>
                    </svg>
                    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">
                      Group Picks
                    </h3>
                  </div>
                  <p class="text-[var(--color-text-secondary)] mb-md">
                    Interface for making confidence picks within groups with game management and validation.
                  </p>
                  <div class="mb-md">
                    <div class="flex gap-xs">
                      <div class="w-6 h-4 bg-success-500 rounded text-xs"></div>
                      <div class="w-6 h-4 bg-warning-500 rounded text-xs"></div>
                      <div class="w-6 h-4 bg-error-500 rounded text-xs"></div>
                    </div>
                  </div>
                  <button
                    class="text-primary-600 dark:text-primary-400 text-sm font-medium hover:underline"
                    on:click={() => switchDemo('group-picks')}
                  >
                    View Group Picks Documentation →
                  </button>
                </div>
              </div>
            </section>

            <!-- Design Principles -->
            <section class="space-y-md">
              <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
                Design Principles
              </h2>
              
              <div class="grid grid-cols-1 md:grid-cols-3 gap-md">
                <div class="p-md bg-primary-50 dark:bg-primary-900 rounded-base border border-primary-200 dark:border-primary-800">
                  <h3 class="text-lg font-heading font-semibold text-primary-800 dark:text-primary-200 mb-sm">
                    🎨 Token-Based
                  </h3>
                  <p class="text-primary-700 dark:text-primary-300 text-sm">
                    All design decisions are driven by design tokens, ensuring consistency and making theme changes effortless.
                  </p>
                </div>
                
                <div class="p-md bg-success-50 dark:bg-success-900 rounded-base border border-success-200 dark:border-success-800">
                  <h3 class="text-lg font-heading font-semibold text-success-800 dark:text-success-200 mb-sm">
                    ♿ Accessible
                  </h3>
                  <p class="text-success-700 dark:text-success-300 text-sm">
                    Built with accessibility in mind, meeting WCAG 2.1 AA standards for contrast, keyboard navigation, and screen readers.
                  </p>
                </div>
                
                <div class="p-md bg-warning-50 dark:bg-warning-900 rounded-base border border-warning-200 dark:border-warning-800">
                  <h3 class="text-lg font-heading font-semibold text-warning-800 dark:text-warning-200 mb-sm">
                    📱 Responsive
                  </h3>
                  <p class="text-warning-700 dark:text-warning-300 text-sm">
                    Mobile-first design approach with components that work seamlessly across all device sizes.
                  </p>
                </div>
              </div>
            </section>

            <!-- Getting Started -->
            <section class="space-y-md">
              <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
                Getting Started
              </h2>
              
              <div class="bg-secondary-50 dark:bg-secondary-800 p-md rounded-base">
                <p class="text-[var(--color-text-secondary)] mb-md">
                  Explore the individual component documentation using the sidebar navigation. Each section includes:
                </p>
                <ul class="space-y-xs text-[var(--color-text-secondary)]">
                  <li>• Interactive examples and demos</li>
                  <li>• Complete API documentation</li>
                  <li>• Usage guidelines and best practices</li>
                  <li>• Accessibility considerations</li>
                  <li>• Code examples and implementation details</li>
                </ul>
              </div>
            </section>
          </div>
        </div>
      {:else if currentDemo === 'buttons'}
        <ButtonsDemo />
      {:else if currentDemo === 'text-fields'}
        <TextFieldsDemo />
      {:else if currentDemo === 'navigation'}
        <NavigationDemo />
      {:else if currentDemo === 'colors'}
        <ColorPaletteDemo />
      {:else if currentDemo === 'group-card'}
        <GroupCardDemo />
      {:else if currentDemo === 'create-group-form'}
        <CreateGroupFormDemo />
      {:else if currentDemo === 'join-group-form'}
        <JoinGroupFormDemo />
      {:else if currentDemo === 'groups-list'}
        <GroupsListDemo />
      {:else if currentDemo === 'group-picks'}
        <GroupPicksDemo />
      {/if}
    </main>
  </div>
</div>
