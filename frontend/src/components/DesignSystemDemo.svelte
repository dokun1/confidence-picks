<script>
  import Button from '../designsystem/components/Button.svelte';
  import TextField from '../designsystem/components/TextField.svelte';
  
  let darkMode = false;
  
  // Text field demo values
  let basicText = '';
  let emailText = '';
  let passwordText = '';
  let successText = 'Valid input';
  let errorText = 'Invalid input';
  let secureText = '';
  let noClearText = '';
  let disabledText = 'Disabled field';
  let readonlyText = 'Readonly field';
  
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

  function handleTextFieldInput(event) {
    console.log('TextField input:', event.detail.value);
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

    <!-- Text Field Showcase -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Text Field Components
      </h2>
      
      <!-- Basic Text Fields -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Basic Text Fields
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
          <TextField 
            bind:value={basicText}
            label="Basic Text Field"
            placeholder="Enter some text..."
            on:input={handleTextFieldInput}
          />
          <TextField 
            bind:value={emailText}
            label="Email Field"
            inputType="email"
            placeholder="Enter your email..."
            validationMessage="Please enter a valid email address"
            validationState="none"
          />
          <TextField 
            bind:value={passwordText}
            label="Password Field"
            inputType="password"
            placeholder="Enter password..."
          />
        </div>
      </div>

      <!-- Validation States -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Validation States
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <TextField 
            bind:value={successText}
            label="Success State"
            placeholder="Valid input..."
            validationMessage="Great! This input is valid."
            validationState="success"
          />
          <TextField 
            bind:value={errorText}
            label="Error State"
            placeholder="Invalid input..."
            validationMessage="This field has an error that needs fixing."
            validationState="error"
          />
        </div>
      </div>

      <!-- Size Variations -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Size Variations
        </h3>
        <div class="space-y-sm">
          <TextField 
            label="Small Text Field"
            placeholder="Small size..."
            size="sm"
          />
          <TextField 
            label="Medium Text Field (Default)"
            placeholder="Medium size..."
            size="md"
          />
          <TextField 
            label="Large Text Field"
            placeholder="Large size..."
            size="lg"
          />
        </div>
      </div>

      <!-- Special States -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Special States
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <TextField 
            bind:value={secureText}
            label="Secure Text Field"
            placeholder="Secure input (no copy)..."
            secure={true}
            validationMessage="Text cannot be copied from this field"
            validationState="none"
          />
          <TextField 
            bind:value={noClearText}
            label="No Clear Button"
            placeholder="Type here..."
            showClearButton={false}
          />
          <TextField 
            bind:value={disabledText}
            label="Disabled Field"
            placeholder="Cannot edit..."
            disabled={true}
          />
          <TextField 
            bind:value={readonlyText}
            label="Read-only Field"
            placeholder="Cannot edit..."
            readonly={true}
          />
        </div>
      </div>

      <!-- Required Fields -->
      <div class="space-y-sm">
        <h3 class="text-lg font-heading font-medium text-[var(--color-text-secondary)]">
          Required Fields
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <TextField 
            label="Required Field"
            placeholder="This field is required..."
            required={true}
            validationMessage="This field is required"
            validationState="error"
          />
          <TextField 
            label="Optional Field"
            placeholder="This field is optional..."
            validationMessage="This field is optional"
            validationState="none"
          />
        </div>
      </div>
    </section>

    <!-- Color Palette Demo -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Color Palette
      </h2>
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
  </div>
</main>
