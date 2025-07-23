<script>
  import TextField from '../designsystem/components/TextField.svelte';
  
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

  function handleTextFieldInput(event) {
    console.log('TextField input:', event.detail.value);
  }
</script>

<main class="min-h-screen p-lg">
  <div class="max-w-4xl mx-auto space-y-lg">
    <!-- Header -->
    <header>
      <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-xs">
        Text Field Components
      </h1>
      <p class="text-lg text-[var(--color-text-secondary)]">
        Input components with validation, security features, and placeholder animations.
      </p>
    </header>

    <!-- Basic Text Fields -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Basic Text Fields
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Standard text input fields with different input types and placeholder animations.
      </p>
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
    </section>

    <!-- Validation States -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Validation States
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Text fields support three validation states: none (default), success, and error. Each state has distinct visual styling and can display validation messages.
      </p>
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
    </section>

    <!-- Size Variations -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Size Variations
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Text fields come in three sizes: small (sm), medium (md - default), and large (lg). Choose the appropriate size based on the importance and context of the field.
      </p>
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
    </section>

    <!-- Special Features -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Special Features
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Text fields include special features like secure text handling, clear buttons, and various input states.
      </p>
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
    </section>

    <!-- Required Fields -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Required Fields
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Fields can be marked as required with a red asterisk. This helps users identify which fields must be completed.
      </p>
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
    </section>

    <!-- Advanced Examples -->
    <section class="space-y-md">
      <h2 class="text-2xl font-heading font-semibold text-[var(--color-text-primary)]">
        Advanced Examples
      </h2>
      <p class="text-[var(--color-text-secondary)] mb-md">
        Real-world examples showing how text fields work in forms and complex layouts.
      </p>
      <div class="bg-neutral-50 dark:bg-secondary-800 p-md rounded-base">
        <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-md">
          User Registration Form
        </h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
          <TextField 
            label="First Name"
            placeholder="Enter your first name"
            required={true}
          />
          <TextField 
            label="Last Name"
            placeholder="Enter your last name"
            required={true}
          />
          <TextField 
            label="Email Address"
            inputType="email"
            placeholder="your@email.com"
            required={true}
          />
          <TextField 
            label="Phone Number"
            inputType="tel"
            placeholder="(555) 123-4567"
          />
          <div class="md:col-span-2">
            <TextField 
              label="Password"
              inputType="password"
              placeholder="Choose a secure password"
              required={true}
              validationMessage="Password must be at least 8 characters"
              validationState="none"
            />
          </div>
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
            <li>• Use clear, descriptive labels</li>
            <li>• Provide helpful placeholder text</li>
            <li>• Show validation states clearly</li>
            <li>• Use appropriate input types</li>
            <li>• Mark required fields consistently</li>
          </ul>
        </div>
        
        <div class="p-md bg-error-50 dark:bg-error-900 rounded-base border border-error-200 dark:border-error-800">
          <h3 class="text-lg font-heading font-semibold text-error-800 dark:text-error-200 mb-sm">
            ✗ Don't
          </h3>
          <ul class="space-y-xs text-error-700 dark:text-error-300">
            <li>• Don't use placeholder as the only label</li>
            <li>• Don't show errors before user interaction</li>
            <li>• Don't use generic error messages</li>
            <li>• Don't make fields unnecessarily required</li>
            <li>• Don't use unclear validation indicators</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
</main>
