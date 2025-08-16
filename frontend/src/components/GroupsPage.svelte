<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import GroupsList from '../designsystem/components/GroupsList.svelte';
  import { auth } from '../lib/authStore.js';

  let groups = [];
  let isLoading = false;
  let error = null;

  onMount(async () => {
    await loadGroups();
  });

  async function loadGroups() {
    isLoading = true;
    error = null;
    
    try {
      // TODO: Replace with actual API call
      const response = await fetch('/api/groups', {
        headers: {
          'Authorization': `Bearer ${$auth.token}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load groups');
      }

      groups = await response.json();
      
    } catch (err) {
      error = err.message;
      console.error('Error loading groups:', err);
      
      // Mock data for development
      groups = [
        {
          id: '1',
          name: 'Fantasy Friends',
          identifier: 'fantasy-friends-2024',
          description: 'Our yearly fantasy football confidence pool with college friends. Winner takes all!',
          memberCount: 8,
          isOwner: true,
          createdAt: '2024-08-01T10:00:00Z'
        },
        {
          id: '2',
          name: 'Office Championship',
          identifier: 'office-champs',
          description: 'Company-wide confidence picks league. May the best predictor win!',
          memberCount: 24,
          isOwner: false,
          createdAt: '2024-07-15T14:30:00Z'
        }
      ];
    } finally {
      isLoading = false;
    }
  }

  function handleCreateNew() {
    navigateTo('/groups/create');
  }

  function handleJoinExisting() {
    navigateTo('/groups/join');
  }

  function handleViewGroup(event) {
    const group = event.detail;
    navigateTo(`/groups/${group.id}`);
  }

  function handleEditGroup(event) {
    const group = event.detail;
    navigateTo(`/groups/${group.id}/edit`);
  }

  async function handleLeaveGroup(event) {
    const group = event.detail;
    
    if (confirm(`Are you sure you want to leave "${group.name}"?`)) {
      try {
        // TODO: Replace with actual API call
        const response = await fetch(`/api/groups/${group.id}/leave`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${$auth.token}`
          }
        });

        if (!response.ok) {
          throw new Error('Failed to leave group');
        }

        // Remove from local groups list
        groups = groups.filter(g => g.id !== group.id);
        
      } catch (err) {
        error = err.message;
        console.error('Error leaving group:', err);
      }
    }
  }
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900 pt-16">
  <div class="max-w-6xl mx-auto px-md py-lg">
    <!-- Page Header -->
    <div class="mb-lg">
      <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-sm">
        My Groups
      </h1>
      <p class="text-[var(--color-text-secondary)]">
        Manage your confidence picks groups and track your performance.
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
            <h3 class="font-semibold text-error-700 dark:text-error-400">Error Loading Groups</h3>
            <p class="text-error-600 dark:text-error-300">{error}</p>
          </div>
        </div>
        <button
          class="mt-sm px-sm py-xs bg-error-100 dark:bg-error-800 text-error-700 dark:text-error-300 rounded hover:bg-error-200 dark:hover:bg-error-700 transition-colors"
          on:click={loadGroups}
        >
          Try Again
        </button>
      </div>
    {/if}

    <!-- Groups List -->
    <GroupsList 
      {groups}
      {isLoading}
      onCreateNew={handleCreateNew}
      onJoinExisting={handleJoinExisting}
      onViewGroup={handleViewGroup}
      onEditGroup={handleEditGroup}
      onLeaveGroup={handleLeaveGroup}
    />

    <!-- Quick Stats -->
    {#if groups.length > 0 && !isLoading}
      <div class="mt-lg grid grid-cols-1 md:grid-cols-3 gap-md">
        <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
          <div class="flex items-center">
            <svg class="w-8 h-8 text-primary-500 mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
            </svg>
            <div>
              <div class="text-2xl font-bold text-[var(--color-text-primary)]">{groups.length}</div>
              <div class="text-sm text-[var(--color-text-secondary)]">Total Groups</div>
            </div>
          </div>
        </div>

        <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
          <div class="flex items-center">
            <svg class="w-8 h-8 text-success-500 mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path>
            </svg>
            <div>
              <div class="text-2xl font-bold text-[var(--color-text-primary)]">{groups.filter(g => g.isOwner).length}</div>
              <div class="text-sm text-[var(--color-text-secondary)]">Groups Owned</div>
            </div>
          </div>
        </div>

        <div class="p-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
          <div class="flex items-center">
            <svg class="w-8 h-8 text-info-500 mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197m13.5-9a2.5 2.5 0 11-5 0 2.5 2.5 0 015 0z"></path>
            </svg>
            <div>
              <div class="text-2xl font-bold text-[var(--color-text-primary)]">{groups.reduce((sum, g) => sum + g.memberCount, 0)}</div>
              <div class="text-sm text-[var(--color-text-secondary)]">Total Members</div>
            </div>
          </div>
        </div>
      </div>
    {/if}
  </div>
</div>
