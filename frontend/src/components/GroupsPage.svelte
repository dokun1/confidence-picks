<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import GroupsList from '../designsystem/components/GroupsList.svelte';
  import AuthService from '../lib/authService.js';
  import { getMyGroups, leaveGroup, deleteGroup } from '../lib/groupsService.js';
  import ConfirmDeleteModal from './ConfirmDeleteModal.svelte';

  let groups = [];
  let isLoading = false;
  let error = null;
  let deleting = false;
  let showDeleteModal = false;
  let groupPendingDelete = null;

  onMount(async () => {
    await loadGroups();
  });

  async function loadGroups() {
    isLoading = true;
    error = null;
    try {
      groups = await getMyGroups();
    } catch (err) {
      error = err.message;
      console.error('Error loading groups:', err);
      groups = [];
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

  function handleViewGroup(group) {
    // Use identifier for route (backend identifies groups by identifier)
    if (!group || !group.identifier) return;
    navigateTo(`/groups/${group.identifier}`);
  }

  function handleEditGroup(group) {
    if (!group || !group.identifier) return;
    navigateTo(`/groups/${group.identifier}/edit`);
  }

  async function handleLeaveGroup(group) {
    if (!group) return;
    if (confirm(`Are you sure you want to leave "${group.name}"?`)) {
      try {
        await leaveGroup(group.identifier);
        groups = groups.filter(g => g.identifier !== group.identifier);
      } catch (err) {
        error = err.message;
        console.error('Error leaving group:', err);
      }
    }
  }

  function handleDeleteGroup(group) {
    if (!group?.isOwner) return; // Only allow owner
    groupPendingDelete = group;
    showDeleteModal = true;
    error = null;
  }

  async function confirmDelete() {
    if (!groupPendingDelete) return;
    deleting = true;
    error = null;
    try {
      await deleteGroup(groupPendingDelete.identifier);
      groups = groups.filter(g => g.identifier !== groupPendingDelete.identifier);
      showDeleteModal = false;
      groupPendingDelete = null;
    } catch (e) {
      error = e.message;
    } finally {
      deleting = false;
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
  showHeader={false}
      onCreateNew={handleCreateNew}
      onJoinExisting={handleJoinExisting}
      onViewGroup={handleViewGroup}
      onEditGroup={handleEditGroup}
      onLeaveGroup={handleLeaveGroup}
  onDeleteGroup={handleDeleteGroup}
    />

  <!-- Stats section removed per UX request -->
  </div>
</div>

<ConfirmDeleteModal
  open={showDeleteModal}
  name={groupPendingDelete?.name}
  slug={groupPendingDelete?.identifier}
  loading={deleting}
  error={error && deleting ? error : null}
  on:cancel={() => { if (!deleting) { showDeleteModal = false; groupPendingDelete = null; } }}
  on:confirm={confirmDelete}
/>
