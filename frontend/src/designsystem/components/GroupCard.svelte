<script>
  import Button from './Button.svelte';
  import Avatar from './Avatar.svelte';
  
  export let group = {
    id: '',
    name: '',
    identifier: '',
    description: '',
    memberCount: 0,
    isOwner: false,
    createdAt: '',
  // createdByName / createdByPictureUrl optionally provided
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
  <!-- Header & Badges: stack on mobile, row on desktop -->
  <div class="flex flex-col mb-4">
    <h3 class="text-lg font-semibold text-gray-900 mb-1 truncate sm:whitespace-normal leading-snug" style="word-break:keep-all;overflow-wrap:break-word;">{group.name}</h3>
    <p class="text-sm text-gray-500 mb-2 break-all sm:break-normal" style="overflow-wrap:anywhere;">ID: {group.identifier}</p>
    {#if group.description}
      <p class="text-gray-600 text-sm mb-3 leading-snug line-clamp-3 sm:line-clamp-none" style="overflow-wrap:break-word;">{group.description}</p>
    {/if}
  <div class="flex flex-row flex-wrap gap-2 mt-1">
      {#if group.isOwner}
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">Owner</span>
      {:else}
        <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">Member</span>
      {/if}
    </div>
  </div>

  <!-- Meta row: stack items on mobile if needed -->
  <div class="flex flex-col xs:flex-row xs:justify-between xs:items-center mb-4 gap-1">
    <div class="text-sm text-gray-500 break-words"><span class="font-medium">{group.memberCount}</span> members</div>
    <div class="text-sm text-gray-500 break-words">Created {formatDate(group.createdAt)}</div>
  </div>

  {#if group.createdByName && !group.isOwner}
    <div class="flex items-center gap-2 mb-4">
      <Avatar name={group.createdByName} pictureUrl={group.createdByPictureUrl} variant="sm" />
      <div class="text-xs text-gray-500">
        <span class="text-gray-600">Created by</span> <span class="font-medium text-gray-700">{group.createdByName}</span>
      </div>
    </div>
  {/if}

  <!-- Actions: vertical stack mobile, horizontal desktop -->
  <div class="flex flex-col gap-2">
    <Button 
      variant="primary" 
      size="sm"
      class="w-full"
      on:click={onView}
    >
      View Group
    </Button>
    {#if group.isOwner}
      <Button 
        variant="secondary" 
        size="sm"
        class="w-full"
        on:click={onEdit}
      >
        Edit
      </Button>
      <Button 
        variant="destructive" 
        size="sm"
        class="w-full"
        on:click={onDelete}
      >
        Delete
      </Button>
    {:else}
      <Button 
        variant="tertiary" 
        size="sm"
        class="w-full"
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
