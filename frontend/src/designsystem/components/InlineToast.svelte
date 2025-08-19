<script>
  import { onMount } from 'svelte';
  import { fade } from 'svelte/transition';
  export let open = false;
  export let message = '';
  export let variant = 'info'; // info | success | warning | error
  export let timeout = 2000; // ms
  export let onClose = () => {};

  let timer;
  $: if (open) {
    clearTimeout(timer);
    timer = setTimeout(() => {
      open = false;
      onClose();
    }, timeout);
  }

  const variantClasses = {
    info: 'bg-secondary-900 text-neutral-0 dark:bg-secondary-100 dark:text-secondary-900',
    success: 'bg-success-600 text-neutral-0 dark:bg-success-500',
    warning: 'bg-warning-600 text-neutral-0 dark:bg-warning-500',
    error: 'bg-error-600 text-neutral-0 dark:bg-error-500'
  };
  const vIcon = {
    info: 'M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    success: 'M5 13l4 4L19 7',
    warning: 'M12 9v3m0 4h.01M12 5.5l7.5 13h-15L12 5.5z',
    error: 'M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'
  };
</script>

{#if open}
  <div transition:fade={{ duration: 150 }} class="pointer-events-none absolute -top-9 left-1/2 -translate-x-1/2 z-20 text-xs px-sm py-xs rounded shadow-md font-medium whitespace-nowrap flex items-center gap-1 transition-all duration-150 {variantClasses[variant]}" role="status" aria-live="polite">
    <svg class="w-3.5 h-3.5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d={vIcon[variant] || vIcon.info}></path>
    </svg>
    {message}
  </div>
{/if}

<style>
  :global(.inline-toast-anchor){ position:relative; }
</style>
