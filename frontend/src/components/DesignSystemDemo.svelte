<script>
  import Button from '../designsystem/components/Button.svelte';
  
  let darkMode = false;
  
  function toggleDarkMode() {
    darkMode = !darkMode;
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }
  
  function handleButtonClick(variant) {
    console.log(`${variant} button clicked!`);
  }
</script>

<main class="min-h-screen p-lg">
  <div class="max-w-4xl mx-auto space-y-lg">
    <!-- Header with theme toggle -->
    <header class="flex justify-between items-center">
      <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)]">
        Design System Demo
      </h1>
      <Button variant="tertiary" on:click={toggleDarkMode}>
        {darkMode ? '☀️' : '🌙'} Toggle Theme
      </Button>
    </header>

    <!-- Button Showcase -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Button Components
      </h2>
      
      <!-- Primary Buttons -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Primary Buttons
        </h3>
        <div class="flex flex-wrap gap-sm">
          <Button variant="primary" size="sm" on:click={() => handleButtonClick('primary-sm')}>
            Small Primary
          </Button>
          <Button variant="primary" size="md" on:click={() => handleButtonClick('primary-md')}>
            Medium Primary
          </Button>
          <Button variant="primary" size="lg" on:click={() => handleButtonClick('primary-lg')}>
            Large Primary
          </Button>
          <Button variant="primary" disabled>
            Disabled Primary
          </Button>
        </div>
      </div>

      <!-- Secondary Buttons -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Secondary Buttons
        </h3>
        <div class="flex flex-wrap gap-sm">
          <Button variant="secondary" size="sm" on:click={() => handleButtonClick('secondary-sm')}>
            Small Secondary
          </Button>
          <Button variant="secondary" size="md" on:click={() => handleButtonClick('secondary-md')}>
            Medium Secondary
          </Button>
          <Button variant="secondary" size="lg" on:click={() => handleButtonClick('secondary-lg')}>
            Large Secondary
          </Button>
          <Button variant="secondary" disabled>
            Disabled Secondary
          </Button>
        </div>
      </div>

      <!-- Tertiary Buttons -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Tertiary Buttons
        </h3>
        <div class="flex flex-wrap gap-sm">
          <Button variant="tertiary" size="sm" on:click={() => handleButtonClick('tertiary-sm')}>
            Small Tertiary
          </Button>
          <Button variant="tertiary" size="md" on:click={() => handleButtonClick('tertiary-md')}>
            Medium Tertiary
          </Button>
          <Button variant="tertiary" size="lg" on:click={() => handleButtonClick('tertiary-lg')}>
            Large Tertiary
          </Button>
          <Button variant="tertiary" disabled>
            Disabled Tertiary
          </Button>
        </div>
      </div>

      <!-- Destructive Buttons -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Destructive Buttons
        </h3>
        <div class="flex flex-wrap gap-sm">
          <Button variant="destructive" size="sm" on:click={() => handleButtonClick('destructive-sm')}>
            Small Destructive
          </Button>
          <Button variant="destructive" size="md" on:click={() => handleButtonClick('destructive-md')}>
            Medium Destructive
          </Button>
          <Button variant="destructive" size="lg" on:click={() => handleButtonClick('destructive-lg')}>
            Large Destructive
          </Button>
          <Button variant="destructive" disabled>
            Disabled Destructive
          </Button>
        </div>
      </div>
    </section>

    <!-- Color Palette Demo -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Color Palette
      </h2>
      <div class="grid grid-cols-2 md:grid-cols-4 gap-md">
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Primary</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-primary-300 rounded-l"></div>
            <div class="w-8 h-8 bg-primary-500"></div>
            <div class="w-8 h-8 bg-primary-700 rounded-r"></div>
          </div>
        </div>
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Success</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-success-300 rounded-l"></div>
            <div class="w-8 h-8 bg-success-500"></div>
            <div class="w-8 h-8 bg-success-700 rounded-r"></div>
          </div>
        </div>
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Error</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-error-300 rounded-l"></div>
            <div class="w-8 h-8 bg-error-500"></div>
            <div class="w-8 h-8 bg-error-700 rounded-r"></div>
          </div>
        </div>
        <div class="space-y-xs">
          <h4 class="font-medium text-[var(--color-text-secondary)]">Neutral</h4>
          <div class="flex">
            <div class="w-8 h-8 bg-neutral-300 rounded-l"></div>
            <div class="w-8 h-8 bg-neutral-500"></div>
            <div class="w-8 h-8 bg-neutral-700 rounded-r"></div>
          </div>
        </div>
      </div>
    </section>
  </div>
</main>
