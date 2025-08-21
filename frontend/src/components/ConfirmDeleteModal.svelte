<script>
  import { createEventDispatcher } from 'svelte';
  export let open = false;
  export let name = '';
  export let slug = '';
  export let loading = false;
  export let error = null;
  // mode: 'delete' (default) | 'leave'
  export let mode = 'delete';
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
  <div class="fixed inset-0 z-50 flex items-center justify-center" aria-modal="true" role="dialog" aria-label={mode === 'leave' ? 'Confirm leave group' : 'Confirm group deletion'}>
    <div 
      class="absolute inset-0 bg-secondary-900/60 backdrop-blur-sm" 
      role="button" 
      aria-label="Close delete confirmation" 
      on:click={handleCancel}
      on:keydown={(e) => (e.key === 'Escape' || e.key === 'Enter' || e.key === ' ') && handleCancel()}
      tabindex="-1"
    ></div>
    <div class="relative w-full max-w-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg shadow-xl space-y-md">
      <h3 class="text-xl font-heading font-semibold {mode === 'leave' ? 'text-warning-600 dark:text-warning-400' : 'text-error-600 dark:text-error-400'}">{mode === 'leave' ? 'Leave Group' : 'Delete Group'}</h3>
      {#if mode === 'leave'}
        <p class="text-sm text-[var(--color-text-secondary)]">You will be removed from <span class="font-semibold">{name}</span> and lose access to its picks, messages, and leaderboard. Type <code class="font-mono bg-secondary-100 dark:bg-secondary-700 px-1 py-0.5 rounded">{slug}</code> to confirm.</p>
      {:else}
        <p class="text-sm text-[var(--color-text-secondary)]">This will permanently delete <span class="font-semibold">{name}</span> and all associated data. Type <code class="font-mono bg-secondary-100 dark:bg-secondary-700 px-1 py-0.5 rounded">{slug}</code> to confirm.</p>
      {/if}
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
          class="px-md py-xs {mode === 'leave' ? 'bg-warning-600 hover:bg-warning-700 focus:ring-warning-500 border border-warning-700' : 'bg-error-600 hover:bg-error-700 focus:ring-error-500 border border-error-600'} text-neutral-0 rounded-base text-sm font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50"
          on:click={handleConfirm}
          disabled={!canConfirm}
          type="button"
        >
          {#if loading}
            {mode === 'leave' ? 'Leaving...' : 'Deleting...'}
          {:else}
            {mode === 'leave' ? 'Confirm Leave' : 'Confirm Delete'}
          {/if}
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
