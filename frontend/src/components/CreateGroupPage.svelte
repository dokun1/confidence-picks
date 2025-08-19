<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import CreateGroupForm from '../designsystem/components/CreateGroupForm.svelte';
  import { createGroup } from '../lib/groupsService.js';

  let isLoading = false;
  let error = null;

  // Receives formData directly from CreateGroupForm prop callback
  async function handleSubmit(formData) {
    isLoading = true;
    error = null;
    try {
      const newGroup = await createGroup(formData);
      navigateTo(`/groups/${newGroup.identifier}`);
    } catch (err) {
      error = err.message;
      console.error('Error creating group:', err);
    } finally {
      isLoading = false;
    }
  }

  function handleCancel() {
    navigateTo('/groups');
  }
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900 pt-16">
  <div class="max-w-2xl mx-auto px-md py-lg">
    <!-- Page Header -->
    <div class="mb-lg">
      <button
        class="flex items-center text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100 mb-md transition-colors"
        on:click={() => navigateTo('/groups')}
      >
        <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Back to Groups
      </button>
      
      <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-sm">
        Create New Group
      </h1>
      <p class="text-[var(--color-text-secondary)]">
        Start a new confidence picks group and invite your friends to compete.
      </p>
    </div>

    <!-- Error Message -->
    {#if error}
      <div class="mb-lg p-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-base">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-error-500 mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-semibold text-error-700 dark:text-error-400">Error Creating Group</h3>
            <p class="text-error-600 dark:text-error-300">{error}</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Create Group Form -->
    <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
      <CreateGroupForm 
        {isLoading}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>

    <!-- Help Section -->
    <div class="mt-lg p-md bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-base">
      <h3 class="font-semibold text-info-700 dark:text-info-400 mb-sm">Getting Started</h3>
      <ul class="text-sm text-info-600 dark:text-info-300 space-y-xs">
        <li>• Choose a descriptive name that your friends will recognize</li>
        <li>• The group identifier will be auto-generated and used for joining</li>
        <li>• You can edit the group details and add members after creation</li>
        <li>• All group members can participate in weekly confidence picks</li>
      </ul>
    </div>
  </div>
</div>
