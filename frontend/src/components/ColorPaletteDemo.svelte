<script>
  let darkMode = false;
  
  function toggleDarkMode() {
    darkMode = !darkMode;
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
</script>

<main class="min-h-screen p-lg">
  <div class="max-w-4xl mx-auto space-y-lg">
    <!-- Header with theme toggle -->
    <header class="flex justify-between items-center">
      <div>
        <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-xs">
          Color Palette
        </h1>
        <p class="text-lg text-[var(--color-text-secondary)]">
          Complete color system with light and dark mode support.
        </p>
      </div>
      <button
        class="px-sm py-xs bg-primary-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-primary-600 transition-colors duration-fast"
        on:click={toggleDarkMode}
      >
        {darkMode ? '☀️' : '🌙'} Toggle Theme
      </button>
    </header>

    <!-- Color Palette Grid -->
    <section class="space-y-lg">
      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-md">
        <!-- Primary Colors -->
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Primary</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-primary-200 rounded-l" title="primary-200"></div>
            <div class="w-8 h-8 bg-primary-400" title="primary-400"></div>
            <div class="w-8 h-8 bg-primary-600" title="primary-600"></div>
            <div class="w-8 h-8 bg-primary-800 rounded-r" title="primary-800"></div>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] space-y-1">
            <div class="flex justify-between"><span>200</span><span>400</span><span>600</span><span>800</span></div>
          </div>
        </div>

        <!-- Secondary Colors -->
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Secondary</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-secondary-200 rounded-l" title="secondary-200"></div>
            <div class="w-8 h-8 bg-secondary-400" title="secondary-400"></div>
            <div class="w-8 h-8 bg-secondary-600" title="secondary-600"></div>
            <div class="w-8 h-8 bg-secondary-800 rounded-r" title="secondary-800"></div>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] space-y-1">
            <div class="flex justify-between"><span>200</span><span>400</span><span>600</span><span>800</span></div>
          </div>
        </div>

        <!-- Success Colors -->
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Success</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-success-200 rounded-l" title="success-200"></div>
            <div class="w-8 h-8 bg-success-400" title="success-400"></div>
            <div class="w-8 h-8 bg-success-600" title="success-600"></div>
            <div class="w-8 h-8 bg-success-800 rounded-r" title="success-800"></div>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] space-y-1">
            <div class="flex justify-between"><span>200</span><span>400</span><span>600</span><span>800</span></div>
          </div>
        </div>

        <!-- Error Colors -->
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Error</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-error-200 rounded-l" title="error-200"></div>
            <div class="w-8 h-8 bg-error-400" title="error-400"></div>
            <div class="w-8 h-8 bg-error-600" title="error-600"></div>
            <div class="w-8 h-8 bg-error-800 rounded-r" title="error-800"></div>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] space-y-1">
            <div class="flex justify-between"><span>200</span><span>400</span><span>600</span><span>800</span></div>
          </div>
        </div>

        <!-- Warning Colors -->
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Warning</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-warning-200 rounded-l" title="warning-200"></div>
            <div class="w-8 h-8 bg-warning-400" title="warning-400"></div>
            <div class="w-8 h-8 bg-warning-600" title="warning-600"></div>
            <div class="w-8 h-8 bg-warning-800 rounded-r" title="warning-800"></div>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] space-y-1">
            <div class="flex justify-between"><span>200</span><span>400</span><span>600</span><span>800</span></div>
          </div>
        </div>

        <!-- Neutral Colors -->
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Neutral</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-neutral-200 rounded-l" title="neutral-200"></div>
            <div class="w-8 h-8 bg-neutral-400" title="neutral-400"></div>
            <div class="w-8 h-8 bg-neutral-600" title="neutral-600"></div>
            <div class="w-8 h-8 bg-neutral-800 rounded-r" title="neutral-800"></div>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] space-y-1">
            <div class="flex justify-between"><span>200</span><span>400</span><span>600</span><span>800</span></div>
          </div>
        </div>

        <!-- Surface Colors -->
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Surface</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-[var(--color-surface-primary)] border border-neutral-300 rounded-l" title="surface-primary"></div>
            <div class="w-8 h-8 bg-[var(--color-surface-secondary)] border border-neutral-300" title="surface-secondary"></div>
            <div class="w-8 h-8 bg-[var(--color-surface-tertiary)] border border-neutral-300" title="surface-tertiary"></div>
            <div class="w-8 h-8 bg-[var(--color-surface-inverse)] rounded-r" title="surface-inverse"></div>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] space-y-1">
            <div class="flex justify-between text-[10px]"><span>1°</span><span>2°</span><span>3°</span><span>inv</span></div>
          </div>
        </div>

        <!-- Extreme Neutrals -->
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Extremes</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-neutral-0 border border-neutral-300 rounded-l" title="neutral-0 (white)"></div>
            <div class="w-8 h-8 bg-neutral-100 border border-neutral-300" title="neutral-100"></div>
            <div class="w-8 h-8 bg-neutral-900" title="neutral-900"></div>
            <div class="w-8 h-8 bg-neutral-1000 rounded-r" title="neutral-1000 (black)"></div>
          </div>
          <div class="text-xs text-[var(--color-text-tertiary)] space-y-1">
            <div class="flex justify-between text-[10px]"><span>0</span><span>100</span><span>900</span><span>1000</span></div>
          </div>
        </div>
      </div>
    </section>

    <!-- Detailed Color Information -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Color Categories
      </h2>
      
      <div class="grid grid-cols-1 md:grid-cols-2 gap-lg">
        <!-- Primary Colors Detail -->
        <div class="space-y-md">
          <h3 class="text-xl font-heading font-medium text-[var(--color-text-primary)]">
            Primary Colors (Cerulean Blue)
          </h3>
          <p class="text-[var(--color-text-secondary)] mb-md">
            Primary colors represent the main brand identity and are used for primary actions, links, and key UI elements.
          </p>
          <div class="space-y-sm">
            <div class="flex items-center justify-between p-sm bg-primary-50 dark:bg-primary-900 rounded-base">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-primary-200 rounded mr-sm"></div>
                <span class="font-medium">primary-200</span>
              </div>
              <code class="text-sm">#bae6fd</code>
            </div>
            <div class="flex items-center justify-between p-sm bg-primary-50 dark:bg-primary-900 rounded-base">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-primary-400 rounded mr-sm"></div>
                <span class="font-medium">primary-400</span>
              </div>
              <code class="text-sm">#38bdf8</code>
            </div>
            <div class="flex items-center justify-between p-sm bg-primary-50 dark:bg-primary-900 rounded-base">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-primary-600 rounded mr-sm"></div>
                <span class="font-medium">primary-600</span>
              </div>
              <code class="text-sm">#0284c7</code>
            </div>
            <div class="flex items-center justify-between p-sm bg-primary-50 dark:bg-primary-900 rounded-base">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-primary-800 rounded mr-sm"></div>
                <span class="font-medium">primary-800</span>
              </div>
              <code class="text-sm">#075985</code>
            </div>
          </div>
        </div>

        <!-- Status Colors Detail -->
        <div class="space-y-md">
          <h3 class="text-xl font-heading font-medium text-[var(--color-text-primary)]">
            Status Colors
          </h3>
          <p class="text-[var(--color-text-secondary)] mb-md">
            Status colors provide semantic meaning for success, error, and warning states across the application.
          </p>
          <div class="space-y-sm">
            <div class="flex items-center justify-between p-sm bg-success-50 dark:bg-success-900 rounded-base">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-success-500 rounded mr-sm"></div>
                <span class="font-medium">Success</span>
              </div>
              <span class="text-sm text-success-700 dark:text-success-300">Positive actions</span>
            </div>
            <div class="flex items-center justify-between p-sm bg-error-50 dark:bg-error-900 rounded-base">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-error-500 rounded mr-sm"></div>
                <span class="font-medium">Error</span>
              </div>
              <span class="text-sm text-error-700 dark:text-error-300">Errors & validation</span>
            </div>
            <div class="flex items-center justify-between p-sm bg-warning-50 dark:bg-warning-900 rounded-base">
              <div class="flex items-center">
                <div class="w-6 h-6 bg-warning-500 rounded mr-sm"></div>
                <span class="font-medium">Warning</span>
              </div>
              <span class="text-sm text-warning-700 dark:text-warning-300">Caution & alerts</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Color Usage Guidelines -->
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
            <li>• Use primary colors for main brand elements</li>
            <li>• Ensure proper contrast ratios for accessibility</li>
            <li>• Use semantic colors for their intended purpose</li>
            <li>• Test colors in both light and dark modes</li>
            <li>• Use neutral colors for text and backgrounds</li>
          </ul>
        </div>
        
        <div class="p-md bg-error-50 dark:bg-error-900 rounded-base border border-error-200 dark:border-error-800">
          <h3 class="text-lg font-heading font-semibold text-error-800 dark:text-error-200 mb-sm">
            ✗ Don't
          </h3>
          <ul class="space-y-xs text-error-700 dark:text-error-300">
            <li>• Don't use error colors for non-error states</li>
            <li>• Don't ignore contrast requirements</li>
            <li>• Don't use too many colors in one interface</li>
            <li>• Don't use colors as the only way to convey meaning</li>
            <li>• Don't override brand colors with custom values</li>
          </ul>
        </div>
      </div>
    </section>

    <!-- Accessibility Information -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Accessibility & Contrast
      </h2>
      
      <div class="bg-neutral-50 dark:bg-secondary-800 p-md rounded-base">
        <p class="text-[var(--color-text-secondary)] mb-md">
          All color combinations in this system meet WCAG 2.1 AA contrast requirements for normal text (4.5:1) and large text (3:1). 
          The design system automatically handles contrast ratios in both light and dark modes.
        </p>
        
        <div class="grid grid-cols-1 md:grid-cols-3 gap-md">
          <div class="text-center p-sm bg-neutral-0 dark:bg-secondary-900 rounded border">
            <div class="text-lg font-bold text-primary-600 dark:text-primary-400 mb-xs">AA</div>
            <div class="text-sm text-[var(--color-text-secondary)]">Normal Text</div>
            <div class="text-xs text-[var(--color-text-tertiary)]">4.5:1 ratio</div>
          </div>
          <div class="text-center p-sm bg-neutral-0 dark:bg-secondary-900 rounded border">
            <div class="text-lg font-bold text-success-600 dark:text-success-400 mb-xs">AA</div>
            <div class="text-sm text-[var(--color-text-secondary)]">Large Text</div>
            <div class="text-xs text-[var(--color-text-tertiary)]">3:1 ratio</div>
          </div>
          <div class="text-center p-sm bg-neutral-0 dark:bg-secondary-900 rounded border">
            <div class="text-lg font-bold text-warning-600 dark:text-warning-400 mb-xs">AAA</div>
            <div class="text-sm text-[var(--color-text-secondary)]">Enhanced</div>
            <div class="text-xs text-[var(--color-text-tertiary)]">7:1 ratio</div>
          </div>
        </div>
      </div>
    </section>
  </div>
</main>
