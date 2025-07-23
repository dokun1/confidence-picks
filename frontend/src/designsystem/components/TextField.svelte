<script>
  import { createEventDispatcher } from 'svelte';

  export let value = '';
  export let placeholder = '';
  export let label = '';
  export let validationMessage = '';
  export let validationState = 'none'; // 'none', 'success', 'error'
  export let disabled = false;
  export let secure = false;
  export let showClearButton = true;
  export let inputType = 'text'; // 'text', 'email', 'password', etc.
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let required = false;
  export let readonly = false;
  export let id = '';

  const dispatch = createEventDispatcher();

  let inputElement;
  let focused = false;
  let hasValue = false;

  $: hasValue = value && value.length > 0;
  $: actualType = secure ? 'password' : inputType;
  $: showClear = showClearButton && hasValue && !disabled && !readonly;

  // Size-specific classes
  const sizeClasses = {
    sm: 'px-xs py-xxxs text-sm h-[2rem]',
    md: 'px-sm py-xs text-base h-[2.5rem]',
    lg: 'px-md py-sm text-lg h-[3rem]'
  };

  // Validation state classes
  const validationClasses = {
    none: 'border-secondary-300 focus:border-primary-500 focus:ring-primary-500',
    success: 'border-success-500 focus:border-success-600 focus:ring-success-500',
    error: 'border-error-500 focus:border-error-600 focus:ring-error-500'
  };

  // Dark mode validation classes
  const darkValidationClasses = {
    none: 'dark:border-secondary-600 dark:focus:border-primary-400 dark:focus:ring-primary-400',
    success: 'dark:border-success-400 dark:focus:border-success-300 dark:focus:ring-success-400',
    error: 'dark:border-error-400 dark:focus:border-error-300 dark:focus:ring-error-400'
  };

  // Validation message colors
  const messageColors = {
    none: 'text-primary-600 dark:text-primary-400',
    success: 'text-success-600 dark:text-success-400',
    error: 'text-error-600 dark:text-error-400'
  };

  $: currentSize = sizeClasses[size];
  $: currentValidation = validationClasses[validationState];
  $: currentDarkValidation = darkValidationClasses[validationState];
  $: currentMessageColor = messageColors[validationState];

  $: inputClasses = [
    'w-full rounded-base border transition-all duration-fast ease-smooth',
    'bg-neutral-0 dark:bg-secondary-800',
    'text-neutral-900 dark:text-neutral-0',
    'placeholder-secondary-500 dark:placeholder-secondary-400',
    'focus:outline-none focus:ring-1 focus:ring-offset-none',
    'disabled:bg-secondary-100 disabled:text-secondary-500 disabled:cursor-not-allowed',
    'dark:disabled:bg-secondary-900 dark:disabled:text-secondary-600',
    currentSize,
    currentValidation,
    currentDarkValidation,
    showClear ? 'pr-xl' : ''
  ].filter(Boolean).join(' ');

  function handleInput(event) {
    value = event.target.value;
    dispatch('input', { value, event });
  }

  function handleFocus(event) {
    focused = true;
    dispatch('focus', { value, event });
  }

  function handleBlur(event) {
    focused = false;
    dispatch('blur', { value, event });
  }

  function handleKeydown(event) {
    if (secure && (event.ctrlKey || event.metaKey) && event.key === 'c') {
      event.preventDefault();
      return false;
    }
    dispatch('keydown', { value, event });
  }

  function clearValue() {
    value = '';
    dispatch('clear');
    inputElement?.focus();
  }

  function getValidationIcon() {
    switch (validationState) {
      case 'success':
        return 'check-circle';
      case 'error':
        return 'exclamation-circle';
      default:
        return 'information-circle';
    }
  }

  function getValidationIconSvg() {
    switch (validationState) {
      case 'success':
        return 'M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z';
      case 'error':
        return 'M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z';
      default:
        return 'M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z';
    }
  }
</script>

<div class="text-field-container">
  <!-- Label -->
  {#if label}
    <label 
      for={id} 
      class="block text-sm font-medium text-[var(--color-text-secondary)] mb-xs"
    >
      {label}
      {#if required}
        <span class="text-error-500">*</span>
      {/if}
    </label>
  {/if}

  <!-- Input Container -->
  <div class="relative">
    {#if secure}
      <input
        bind:this={inputElement}
        bind:value
        {id}
        {disabled}
        {readonly}
        {required}
        type="password"
        class={inputClasses}
        class:select-none={true}
        style="user-select: none; -webkit-user-select: none; -moz-user-select: none;"
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        on:change
        on:keyup
        on:keypress
      />
    {:else if inputType === 'email'}
      <input
        bind:this={inputElement}
        bind:value
        {id}
        {disabled}
        {readonly}
        {required}
        type="email"
        class={inputClasses}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        on:change
        on:keyup
        on:keypress
      />
    {:else if inputType === 'password'}
      <input
        bind:this={inputElement}
        bind:value
        {id}
        {disabled}
        {readonly}
        {required}
        type="password"
        class={inputClasses}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        on:change
        on:keyup
        on:keypress
      />
    {:else}
      <input
        bind:this={inputElement}
        bind:value
        {id}
        {disabled}
        {readonly}
        {required}
        type="text"
        class={inputClasses}
        on:input={handleInput}
        on:focus={handleFocus}
        on:blur={handleBlur}
        on:keydown={handleKeydown}
        on:change
        on:keyup
        on:keypress
      />
    {/if}

    <!-- Placeholder animation overlay -->
    {#if placeholder && !hasValue}
      <div 
        class="absolute inset-y-0 left-0 flex items-center px-sm pointer-events-none transition-opacity duration-fast ease-smooth"
        class:opacity-0={focused}
        class:opacity-100={!focused}
      >
        <span class="text-secondary-500 dark:text-secondary-400 {sizeClasses[size].includes('text-sm') ? 'text-sm' : sizeClasses[size].includes('text-lg') ? 'text-lg' : 'text-base'}">
          {placeholder}
        </span>
      </div>
    {/if}

    <!-- Clear Button -->
    {#if showClear}
      <button
        type="button"
        class="absolute inset-y-0 right-0 flex items-center pr-xs text-secondary-500 hover:text-secondary-700 dark:text-secondary-400 dark:hover:text-secondary-200 transition-colors duration-fast"
        on:click={clearValue}
        tabindex="-1"
      >
        <svg class="w-[1rem] h-[1rem]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1" d="M6 18L18 6M6 6l12 12"></path>
        </svg>
      </button>
    {/if}
  </div>

  <!-- Validation Message -->
  {#if validationMessage}
    <div class="flex items-center mt-xs gap-xs">
      <svg class="w-[1rem] h-[1rem] {currentMessageColor}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="1.5" d="{getValidationIconSvg()}"></path>
      </svg>
      <span class="{currentMessageColor} text-sm">
        {validationMessage}
      </span>
    </div>
  {/if}
</div>

<style>
  .text-field-container {
    width: 100%;
  }

  .select-none {
    -webkit-user-select: none;
    -moz-user-select: none;
    -ms-user-select: none;
    user-select: none;
  }

  /* Custom placeholder styling for better animation */
  input::placeholder {
    opacity: 0;
    transition: opacity var(--animation-duration-fast) var(--animation-easing-smooth);
  }

  input:not(:focus)::placeholder {
    opacity: 0;
  }
</style>
