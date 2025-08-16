<script>
  import { navigateTo } from '../lib/router.js';
  import JoinGroupForm from '../designsystem/components/JoinGroupForm.svelte';
  import { auth } from '../lib/authStore.js';

  let isLoading = false;
  let error = null;
  let successMessage = null;

  async function handleSubmit(event) {
    isLoading = true;
    error = null;
    successMessage = null;
    
    try {
      const { identifier } = event.detail;
      
      // TODO: Replace with actual API call
      const response = await fetch(`/api/groups/${identifier}/join`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${$auth.token}`
        }
      });

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Group not found. Please check the group identifier.');
        } else if (response.status === 409) {
          throw new Error('You are already a member of this group.');
        } else {
          throw new Error('Failed to join group. Please try again.');
        }
      }

      const group = await response.json();
      successMessage = `Successfully joined "${group.name}"!`;
      
      // Navigate to the group after a short delay
      setTimeout(() => {
        navigateTo(`/groups/${group.id}`);
      }, 2000);
      
    } catch (err) {
      error = err.message;
      console.error('Error joining group:', err);
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
        Join Existing Group
      </h1>
      <p class="text-[var(--color-text-secondary)]">
        Enter the group identifier to join an existing confidence picks group.
      </p>
    </div>

    <!-- Success Message -->
    {#if successMessage}
      <div class="mb-lg p-md bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-base">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-success-500 mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-semibold text-success-700 dark:text-success-400">Welcome to the Group!</h3>
            <p class="text-success-600 dark:text-success-300">{successMessage}</p>
            <p class="text-sm text-success-600 dark:text-success-300 mt-xs">Redirecting you to the group page...</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Error Message -->
    {#if error}
      <div class="mb-lg p-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-base">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-error-500 mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-semibold text-error-700 dark:text-error-400">Unable to Join Group</h3>
            <p class="text-error-600 dark:text-error-300">{error}</p>
          </div>
        </div>
      </div>
    {/if}

    <!-- Join Group Form -->
    <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
      <JoinGroupForm 
        {isLoading}
        onSubmit={handleSubmit}
        onCancel={handleCancel}
      />
    </div>

    <!-- Help Section -->
    <div class="mt-lg space-y-md">
      <!-- How to Find Group Identifier -->
      <div class="p-md bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-base">
        <h3 class="font-semibold text-info-700 dark:text-info-400 mb-sm">How to Find a Group Identifier</h3>
        <ul class="text-sm text-info-600 dark:text-info-300 space-y-xs">
          <li>• Ask the group owner for the group identifier</li>
          <li>• Look for an invitation link that contains the identifier</li>
          <li>• Group identifiers are usually in the format: "group-name-2024"</li>
          <li>• They contain only lowercase letters, numbers, and hyphens</li>
        </ul>
      </div>

      <!-- Example Identifiers -->
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
        <h3 class="font-semibold text-[var(--color-text-primary)] mb-sm">Example Group Identifiers</h3>
        <div class="grid grid-cols-1 md:grid-cols-2 gap-sm">
          <div class="text-sm">
            <code class="text-primary-600 dark:text-primary-400 font-mono">fantasy-friends-2024</code>
            <p class="text-[var(--color-text-secondary)]">Fantasy Friends group</p>
          </div>
          <div class="text-sm">
            <code class="text-primary-600 dark:text-primary-400 font-mono">office-championship</code>
            <p class="text-[var(--color-text-secondary)]">Office Championship</p>
          </div>
          <div class="text-sm">
            <code class="text-primary-600 dark:text-primary-400 font-mono">family-pool-2024</code>
            <p class="text-[var(--color-text-secondary)]">Family Pool</p>
          </div>
          <div class="text-sm">
            <code class="text-primary-600 dark:text-primary-400 font-mono">college-buddies</code>
            <p class="text-[var(--color-text-secondary)]">College Buddies League</p>
          </div>
        </div>
      </div>
    </div>
  </div>
</div>
