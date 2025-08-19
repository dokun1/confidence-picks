<script>
  import GroupCard from './GroupCard.svelte';
  import Button from './Button.svelte';
  
  export let groups = [];
  export let isLoading = false;
  export let onCreateNew = () => {};
  export let onJoinExisting = () => {};
  export let onViewGroup = () => {};
  export let onEditGroup = () => {};
  export let onLeaveGroup = () => {};
  export let onDeleteGroup = () => {};
  export let onRefresh = () => {};
  export let showHeader = true; // allow parent to hide built-in header/subheader
  
  // Removed expandable action panels; buttons now route directly
  
  function handleViewGroup(group) {
    onViewGroup(group);
  }
  
  function handleEditGroup(group) {
    onEditGroup(group);
  }
  
  function handleLeaveGroup(group) {
    if (confirm(`Are you sure you want to leave "${group.name}"?`)) {
      onLeaveGroup(group);
    }
  }
  
  function handleDeleteGroup(group) {
  onDeleteGroup(group);
  }
</script>

<div class="space-y-6">
  <!-- Header / Actions -->
  {#if showHeader}
  <div class="flex flex-col md:flex-row md:justify-between md:items-center gap-sm md:gap-0">
    <div class="order-1">
      <h1 class="text-2xl font-bold text-gray-900">My Groups</h1>
      <p class="text-gray-600 mt-1">Manage your confidence picks groups</p>
    </div>
    <div class="flex flex-col order-2 md:order-none md:flex-row md:space-x-3 gap-sm md:gap-0 w-full md:w-auto md:items-center mt-sm md:mt-0">
      <Button 
        variant="primary"
        on:click={onCreateNew}
      >
        Create Group
      </Button>
      <Button 
        variant="secondary"
        on:click={onJoinExisting}
      >
        Join Group
      </Button>
      <Button 
        variant="secondary" 
        size="sm"
        on:click={onRefresh}
        disabled={isLoading}
      >
        <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
          <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992V4.356M2.985 14.652v4.992h4.992M19.207 15.6a8.25 8.25 0 01-14.64 2.474m-.774-9.574a8.25 8.25 0 0114.64-2.474" />
        </svg>
        Refresh
      </Button>
    </div>
  </div>
  {:else}
  <div class="flex flex-col md:flex-row md:justify-end md:items-center gap-sm md:gap-3">
    <Button 
      variant="primary"
      on:click={onCreateNew}
    >
      Create Group
    </Button>
    <Button 
      variant="secondary"
      on:click={onJoinExisting}
    >
      Join Group
    </Button>
    <Button 
      variant="secondary" 
      size="sm"
      on:click={onRefresh}
      disabled={isLoading}
    >
      <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" stroke-width="1.8" viewBox="0 0 24 24" aria-hidden="true">
        <path stroke-linecap="round" stroke-linejoin="round" d="M16.023 9.348h4.992V4.356M2.985 14.652v4.992h4.992M19.207 15.6a8.25 8.25 0 01-14.64 2.474m-.774-9.574a8.25 8.25 0 0114.64-2.474" />
      </svg>
      Refresh
    </Button>
  </div>
  {/if}
  
  <!-- Loading state -->
  {#if isLoading}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-gray-600">Loading groups...</span>
    </div>
  <!-- Empty state -->
  {:else if groups.length === 0}
    <div class="text-center py-12">
      <div class="mx-auto h-12 w-12 text-gray-400">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No groups found</h3>
      <p class="mt-1 text-sm text-gray-500">Get started by creating a new group or joining an existing one.</p>
      <div class="mt-6 flex justify-center space-x-3">
        <Button variant="primary" on:click={onCreateNew}>
          Create Your First Group
        </Button>
        <Button variant="secondary" on:click={onJoinExisting}>
          Join a Group
        </Button>
      </div>
    </div>
  <!-- Groups list -->
  {:else}
    <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
      {#each groups as group (group.id)}
        <GroupCard 
          {group}
          onView={() => handleViewGroup(group)}
          onEdit={() => handleEditGroup(group)}
          onLeave={() => handleLeaveGroup(group)}
          onDelete={() => handleDeleteGroup(group)}
        />
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Additional custom styles if needed */
</style>
