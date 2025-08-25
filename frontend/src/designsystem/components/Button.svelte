<script>
  import { createEventDispatcher } from 'svelte';

  export let variant = 'primary'; // 'primary', 'secondary', 'tertiary', 'destructive'
  export let size = 'md'; // 'sm', 'md', 'lg'
  export let disabled = false;
  export let loading = false;
  export let href = null; // If provided, renders as a link
  export let type = 'button'; // 'button', 'submit', 'reset'

  const dispatch = createEventDispatcher();

  // Base classes applied to all buttons
  const baseClasses = 'inline-flex items-center justify-center font-medium transition-all duration-normal ease-smooth focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:cursor-not-allowed';

  // Size-specific classes
  const sizeClasses = {
    sm: 'px-xs py-xxxs text-sm rounded-sm h-10',
    md: 'px-md py-xs text-base rounded-base h-10',
    lg: 'px-lg py-sm text-lg rounded-md h-10'
  };

  // Variant-specific classes
  const variantClasses = {
    primary: {
      default: 'bg-primary-500 text-neutral-0 border border-primary-600 shadow-sm hover:bg-primary-600 hover:shadow-base focus:ring-primary-500',
      active: 'bg-primary-700 shadow-inner',
      disabled: 'bg-primary-300 text-primary-100 border-primary-300 shadow-none cursor-not-allowed'
    },
    secondary: {
      default: 'bg-secondary-100 text-secondary-900 border border-secondary-300 shadow-sm hover:bg-secondary-200 hover:shadow-base focus:ring-secondary-500',
      active: 'bg-secondary-300 shadow-inner',
      disabled: 'bg-secondary-50 text-secondary-400 border-secondary-200 shadow-none cursor-not-allowed'
    },
    tertiary: {
      default: 'bg-transparent text-primary-600 border border-transparent shadow-none hover:bg-primary-50 hover:text-primary-700 focus:ring-primary-500',
      active: 'bg-primary-100 text-primary-800',
      disabled: 'bg-transparent text-secondary-400 cursor-not-allowed'
    },
    destructive: {
      default: 'bg-error-500 text-neutral-0 border border-error-600 shadow-sm hover:bg-error-600 hover:shadow-base focus:ring-error-500',
      active: 'bg-error-700 shadow-inner',
      disabled: 'bg-error-300 text-error-100 border-error-300 shadow-none cursor-not-allowed'
    }
  };

  // Dark mode variant classes
  const darkVariantClasses = {
    primary: {
      default: 'dark:bg-primary-600 dark:hover:bg-primary-500 dark:border-primary-500',
      active: 'dark:bg-primary-800',
      disabled: 'dark:bg-primary-800 dark:text-primary-400 dark:border-primary-800'
    },
    secondary: {
      default: 'dark:bg-secondary-800 dark:text-secondary-100 dark:border-secondary-600 dark:hover:bg-secondary-700',
      active: 'dark:bg-secondary-600',
      disabled: 'dark:bg-secondary-900 dark:text-secondary-600 dark:border-secondary-800'
    },
    tertiary: {
      default: 'dark:text-primary-400 dark:hover:bg-primary-900 dark:hover:text-primary-300',
      active: 'dark:bg-primary-800 dark:text-primary-200',
      disabled: 'dark:text-secondary-600'
    },
    destructive: {
      default: 'dark:bg-error-600 dark:hover:bg-error-500 dark:border-error-500',
      active: 'dark:bg-error-800',
      disabled: 'dark:bg-error-800 dark:text-error-400 dark:border-error-800'
    }
  };

  // Gracefully fallback if an unknown variant is provided
  $: currentVariant = variantClasses[variant] || variantClasses.primary;
  $: currentDarkVariant = darkVariantClasses[variant] || darkVariantClasses.primary;
  $: currentSize = sizeClasses[size];

  $: buttonState = disabled ? 'disabled' : 'default';
  
  $: classes = [
    baseClasses,
    currentSize,
    currentVariant[buttonState],
    currentDarkVariant[buttonState]
  ].filter(Boolean).join(' ');

  function handleClick(event) {
    if (disabled || loading) {
      event.preventDefault();
      return;
    }
    dispatch('click', event);
  }

  function handleKeydown(event) {
    if (event.key === 'Enter' || event.key === ' ') {
      handleClick(event);
    }
  }
</script>

{#if href && !disabled}
  <a 
    {href}
    class={classes}
    on:click={handleClick}
    on:keydown={handleKeydown}
    role="button"
    tabindex="0"
    aria-disabled={disabled}
  >
    {#if loading}
      <svg class="animate-spin -ml-1 mr-xs h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot />
  </a>
{:else}
  <button
    {type}
    class={classes}
    {disabled}
    on:click={handleClick}
    aria-disabled={disabled}
  >
    {#if loading}
      <svg class="animate-spin -ml-1 mr-xs h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
        <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
        <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
      </svg>
    {/if}
    <slot />
  </button>
{/if}

<style>
  /* Custom active state handling */
  button:active,
  a[role="button"]:active {
    transform: translateY(1px);
  }

  button:disabled:active,
  a[aria-disabled="true"]:active {
    transform: none;
  }
</style>
