<script>
  import { createEventDispatcher } from 'svelte';
  export let open = false;
  export let name = '';
  export let slug = '';
  export let loading = false;
  export let error = null;
  const dispatch = createEventDispatcher();
  let inputValue = '';

  $: canConfirm = inputValue.trim() === slug && !loading;

  function handleCancel() {
    if (loading) return;
    dispatch('cancel');
    inputValue = '';
  }
  function handleConfirm() {
    if (!canConfirm) return;
    dispatch('confirm', { slug });
  }
</script>

{#if open}
  <div class="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog" aria-label="Confirm group deletion">
    <div 
      class="absolute inset-0 bg-secondary-900/60 backdrop-blur-sm" 
      role="button" 
      aria-label="Close delete confirmation" 
      on:click={handleCancel}
      on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && handleCancel()}
      tabindex="-1"
    ></div>
    <div class="relative w-full max-w-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg shadow-xl space-y-md">
      <h3 class="text-xl font-heading font-semibold text-error-600 dark:text-error-400">Delete Group</h3>
      <p class="text-sm text-[var(--color-text-secondary)]">This will permanently delete <span class="font-semibold">{name}</span> and all associated data. Type <code class="font-mono bg-secondary-100 dark:bg-secondary-700 px-1 py-0.5 rounded">{slug}</code> to confirm.</p>
      <input
        class="w-full px-sm py-xs border border-secondary-300 dark:border-secondary-600 rounded-base bg-neutral-0 dark:bg-secondary-700 text-[var(--color-text-primary)] focus:outline-none focus:ring-2 focus:ring-error-500"
        placeholder={slug}
        bind:value={inputValue}
        disabled={loading}
        aria-label="Type group slug to confirm deletion"
      />
      <div class="flex justify-end space-x-sm pt-sm">
        <button
          class="px-md py-xs rounded-base text-sm font-medium border border-secondary-300 dark:border-secondary-600 bg-secondary-50 dark:bg-secondary-700 hover:bg-secondary-100 dark:hover:bg-secondary-600 disabled:opacity-50"
          on:click={handleCancel}
          disabled={loading}
          type="button"
        >
          Cancel
        </button>
        <button
          class="px-md py-xs bg-error-600 hover:bg-error-700 text-neutral-0 rounded-base text-sm font-medium focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 disabled:opacity-50"
          on:click={handleConfirm}
          disabled={!canConfirm}
          type="button"
        >
          {loading ? 'Deleting...' : 'Confirm Delete'}
        </button>
      </div>
      {#if error}
        <p class="text-sm text-error-600 dark:text-error-400">{error}</p>
      {/if}
    </div>
  </div>
{/if}

<style>
  :global(code){font-size:0.85em}
</style>
