<script>
  import Button from '../designsystem/components/Button.svelte';
  
  function handleButtonClick(variant) {
    console.log(`${variant} button clicked!`);
  }
</script>

<main class="min-h-screen p-lg">
  <div class="max-w-4xl mx-auto space-y-lg">
    <!-- Header -->
    <header>
      <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-xs">
        Button Components
      </h1>
      <p class="text-lg text-[var(--color-text-secondary)]">
        Interactive button components with multiple variants, sizes, and states.
      </p>
    </header>

    <!-- Primary Buttons -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Primary Buttons
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Primary buttons are used for the main action on a page or section. They have high emphasis and should be used sparingly.
      </p>
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
        <Button variant="primary" loading>
          Loading Primary
        </Button>
      </div>
    </section>

    <!-- Secondary Buttons -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Secondary Buttons
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Secondary buttons are used for secondary actions. They have medium emphasis and can be used more frequently than primary buttons.
      </p>
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
        <Button variant="secondary" loading>
          Loading Secondary
        </Button>
      </div>
    </section>

    <!-- Tertiary Buttons -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Tertiary Buttons
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Tertiary buttons are used for low-emphasis actions. They are subtle and can be used frequently without overwhelming the interface.
      </p>
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
        <Button variant="tertiary" loading>
          Loading Tertiary
        </Button>
      </div>
    </section>

    <!-- Destructive Buttons -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Destructive Buttons
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Destructive buttons are used for actions that cannot be undone, such as deleting data. Use them with caution and clear confirmation.
      </p>
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
        <Button variant="destructive" loading>
          Loading Destructive
        </Button>
      </div>
    </section>

    <!-- Link Buttons -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Link Buttons
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Buttons can also function as links when the `href` prop is provided. They maintain all styling while using semantic link markup.
      </p>
      <div class="flex flex-wrap gap-sm">
        <Button variant="primary" href="/games">
          Go to Games
        </Button>
        <Button variant="secondary" href="/leaderboard">
          View Leaderboard
        </Button>
        <Button variant="tertiary" href="/profile">
          Edit Profile
        </Button>
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
            <li>• Use primary buttons for the main action</li>
            <li>• Use secondary buttons for alternative actions</li>
            <li>• Use tertiary buttons for low-priority actions</li>
            <li>• Provide clear, actionable button text</li>
            <li>• Use loading states for async actions</li>
          </ul>
        </div>
        
        <div class="p-md bg-error-50 dark:bg-error-900 rounded-base border border-error-200 dark:border-error-800">
          <h3 class="text-lg font-heading font-semibold text-error-800 dark:text-error-200 mb-sm">
            ✗ Don't
          </h3>
          <ul class="space-y-xs text-error-700 dark:text-error-300">
            <li>• Don't use multiple primary buttons on one page</li>
            <li>• Don't use destructive buttons without confirmation</li>
            <li>• Don't use generic text like "Click here"</li>
            <li>• Don't use buttons for navigation (use links)</li>
            <li>• Don't stack buttons unnecessarily</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</main>
