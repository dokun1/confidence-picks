<script>
  import Button from '../designsystem/components/Button.svelte';
  import ButtonsDemo from './ButtonsDemo.svelte';
  import TextFieldsDemo from './TextFieldsDemo.svelte';
  import NavigationDemo from './NavigationDemo.svelte';
  import ColorPaletteDemo from './ColorPaletteDemo.svelte';
  
  let currentDemo = 'overview';
  
  const demoSections = [
    { id: 'overview', label: 'Overview', icon: 'home' },
    { id: 'buttons', label: 'Buttons', icon: 'squares-2x2' },
    { id: 'text-fields', label: 'Text Fields', icon: 'rectangle-stack' },
    { id: 'navigation', label: 'Navigation', icon: 'bars-3' },
    { id: 'colors', label: 'Colors', icon: 'swatch' }
  ];
  
  function switchDemo(demoId) {
    currentDemo = demoId;
  }
  
  function getIcon(iconName) {
    const iconPaths = {
      'home': 'M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25',
      'squares-2x2': 'M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z',
      'rectangle-stack': 'M5.25 8.25h15m-16.5 7.5h15m-1.8-13.5l-3.9 19.5m-2.1-19.5l-3.9 19.5',
      'bars-3': 'M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5',
      'swatch': 'M20.24 12.24a3 3 0 00-4.24-4.24L11.76 12.24a3 3 0 104.24 4.24l4.24-4.24z M15.07 8.93a1.5 1.5 0 00-2.12 0L8.71 13.17a1.5 1.5 0 002.12 2.12l4.24-4.24a1.5 1.5 0 000-2.12z'
    };
    return iconPaths[iconName] || iconPaths['home'];
  }
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900 pt-16">
  <div class="flex">
    <!-- Sidebar Navigation -->
    <aside class="w-64 bg-neutral-50 dark:bg-secondary-800 border-r border-secondary-200 dark:border-secondary-700 min-h-screen p-md">
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
    
    <!-- Main Content -->
    <main class="flex-1">
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
      {/if}
    </main>
  </div>
</div>
