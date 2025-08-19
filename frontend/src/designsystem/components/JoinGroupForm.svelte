<script>
  import Button from './Button.svelte';
  import TextField from './TextField.svelte';
  
  export let onSubmit = () => {};
  export let onCancel = () => {};
  export let isLoading = false;
  
  let formData = {
    identifier: ''
  };
  
  let errors = {};
  
  function validateForm() {
    errors = {};
    
    if (!formData.identifier.trim()) {
      errors.identifier = 'Group ID is required';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(formData.identifier)) {
      errors.identifier = 'Group ID can only contain letters, numbers, hyphens, and underscores';
    }
    
    return Object.keys(errors).length === 0;
  }
  
  function handleSubmit() {
    if (validateForm()) {
      onSubmit({ identifier: formData.identifier.trim().toLowerCase() });
    }
  }
</script>

<div class="bg-white border border-gray-200 rounded-lg p-6">
  <h2 class="text-xl font-semibold text-gray-900 mb-6">Join Existing Group</h2>
  
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <TextField
      label="Group ID"
      bind:value={formData.identifier}
      placeholder="Enter the group ID to join"
      validationMessage={errors.identifier}
      validationState={errors.identifier ? 'error' : 'none'}
      required
      disabled={isLoading}
    />
    
    <p class="text-sm text-gray-500">
      Ask the group owner for the Group ID to join their confidence picks group.
    </p>
    
    <div class="flex space-x-3 pt-4">
      <Button 
        type="submit" 
        variant="primary"
        disabled={isLoading}
        loading={isLoading}
      >
        {isLoading ? 'Joining...' : 'Join Group'}
      </Button>
      
      <Button 
        type="button" 
        variant="secondary"
        on:click={onCancel}
        disabled={isLoading}
      >
        Cancel
      </Button>
    </div>
  </form>
</div>

<style>
  /* Additional custom styles if needed */
</style>
