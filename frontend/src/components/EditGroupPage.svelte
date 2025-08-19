<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import CreateGroupForm from '../designsystem/components/CreateGroupForm.svelte';
  import { getGroup, updateGroup, deleteGroup } from '../lib/groupsService.js';
  import ConfirmDeleteModal from './ConfirmDeleteModal.svelte';

  export let groupId; // actually identifier

  let isLoading = false;
  let isSaving = false;
  let error = null;
  let group = null;
  let showDeleteModal = false;
  let deleting = false;

  onMount(loadGroup);

  async function loadGroup() {
    isLoading = true;
    error = null;
    try {
      group = await getGroup(groupId);
      if (!group.userRole || group.userRole !== 'admin') {
        error = 'You are not authorized to edit this group';
      }
    } catch (e) {
      error = e.message;
    } finally {
      isLoading = false;
    }
  }

  async function handleSubmit(formData) {
    if (!group) return;
    isSaving = true;
    error = null;
    try {
      const updates = {};
      if (formData.name && formData.name !== group.name) updates.name = formData.name;
      if (formData.description !== group.description) updates.description = formData.description || '';
      // Identifier is immutable for now (backend would treat change differently)
      if (Object.keys(updates).length === 0) {
        error = 'No changes to save';
        return;
      }
      const updated = await updateGroup(group.identifier, updates);
      group = { ...group, ...updated };
      navigateTo(`/groups/${group.identifier}`);
    } catch (e) {
      error = e.message;
    } finally {
      isSaving = false;
    }
  }

  function handleCancel() {
    if (group) navigateTo(`/groups/${group.identifier}`); else navigateTo('/groups');
  }

  async function handleDeleteConfirm() {
    if (!group) return;
    deleting = true;
    error = null;
    try {
      await deleteGroup(group.identifier);
      navigateTo('/groups');
    } catch (e) {
      error = e.message;
    } finally {
      deleting = false;
      showDeleteModal = false;
    }
  }
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900 pt-16">
  <div class="max-w-2xl mx-auto px-md py-lg">
    <div class="mb-lg">
      <button
        class="flex items-center text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100 mb-md transition-colors"
        on:click={handleCancel}
      >
        <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
        </svg>
        Back to Group
      </button>
      <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-sm">Edit Group</h1>
      {#if group}
        <p class="text-[var(--color-text-secondary)]">Update settings for <span class="font-semibold">{group.name}</span>.</p>
      {/if}
    </div>

    {#if error}
      <div class="mb-lg p-md bg-error-50 dark:bg-error-900/20 border border-error-200 dark:border-error-800 rounded-base">
        <div class="flex items-center">
          <svg class="w-5 h-5 text-error-500 mr-sm" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path>
          </svg>
          <div>
            <h3 class="font-semibold text-error-700 dark:text-error-400">Cannot Edit Group</h3>
            <p class="text-error-600 dark:text-error-300">{error}</p>
          </div>
        </div>
      </div>
    {/if}

    {#if isLoading}
      <div class="p-lg text-center text-[var(--color-text-secondary)]">Loading group...</div>
    {:else if group && !error}
      <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
        <CreateGroupForm
          isLoading={isSaving}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
          initialValues={{ name: group.name, identifier: group.identifier, description: group.description }}
        />
        <div class="mt-lg border-t border-secondary-200 dark:border-secondary-600 pt-lg">
          <h2 class="text-lg font-semibold text-error-600 dark:text-error-400 mb-sm">Danger Zone</h2>
          <p class="text-sm text-[var(--color-text-secondary)] mb-md">Deleting a group is permanent. To create it again you must use a new slug (or reuse if it becomes available).</p>
          <button
            class="px-md py-xs bg-error-500 hover:bg-error-600 text-neutral-0 rounded-base text-sm font-medium focus:outline-none focus:ring-2 focus:ring-error-500 focus:ring-offset-2 disabled:opacity-50"
            on:click={() => { showDeleteModal = true; }}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Group'}
          </button>
        </div>
      </div>
    {/if}
  </div>
</div>
<ConfirmDeleteModal
  open={showDeleteModal}
  name={group?.name}
  slug={group?.identifier}
  loading={deleting}
  error={error && deleting ? error : null}
  on:cancel={() => { if(!deleting) showDeleteModal = false; }}
  on:confirm={handleDeleteConfirm}
/>
