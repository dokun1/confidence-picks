<script>
  import Button from './Button.svelte';
  
  export let group = {
    id: '',
    name: '',
    identifier: '',
    description: '',
    memberCount: 0,
    isOwner: false,
    createdAt: '',
    isActive: true
  };
  
  export let onView = () => {};
  export let onEdit = () => {};
  export let onLeave = () => {};
  export let onDelete = () => {};
  
  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString();
  }
</script>

<div class="bg-white border border-gray-200 rounded-lg p-6 shadow-sm hover:shadow-md transition-shadow">
  <div class="flex justify-between items-start mb-4">
    <div class="flex-1">
      <h3 class="text-lg font-semibold text-gray-900 mb-1">{group.name}</h3>
      <p class="text-sm text-gray-500 mb-2">ID: {group.identifier}</p>
      {#if group.description}
        <p class="text-gray-600 text-sm mb-3">{group.description}</p>
      {/if}
    </div>
    
    <div class="flex items-center space-x-2">
      {#if group.isOwner}
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          Owner
        </span>
      {:else}
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
          Member
        </span>
      {/if}
      
      {#if !group.isActive}
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
          Inactive
        </span>
      {/if}
    </div>
  </div>
  
  <div class="flex justify-between items-center mb-4">
    <div class="text-sm text-gray-500">
      <span class="font-medium">{group.memberCount}</span> members
    </div>
    <div class="text-sm text-gray-500">
      Created {formatDate(group.createdAt)}
    </div>
  </div>
  
  <div class="flex space-x-2">
    <Button 
      variant="primary" 
      size="sm"
      on:click={onView}
    >
      View Picks
    </Button>
    
    {#if group.isOwner}
      <Button 
        variant="secondary" 
        size="sm"
        on:click={onEdit}
      >
        Edit
      </Button>
      <Button 
        variant="destructive" 
        size="sm"
        on:click={onDelete}
      >
        Delete
      </Button>
    {:else}
      <Button 
        variant="secondary" 
        size="sm"
        on:click={onLeave}
      >
        Leave Group
      </Button>
    {/if}
  </div>
</div>

<style>
  /* Additional custom styles if needed */
</style>
