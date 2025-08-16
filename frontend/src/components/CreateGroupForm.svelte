<script>
  import Button from '../designsystem/components/Button.svelte';
  import TextField from '../designsystem/components/TextField.svelte';
  
  export let onSubmit = () => {};
  export let onCancel = () => {};
  export let isLoading = false;
  
  let formData = {
    name: '',
    identifier: '',
    description: ''
  };
  
  let errors = {};
  
  function validateForm() {
    errors = {};
    
    if (!formData.name.trim()) {
      errors.name = 'Group name is required';
    } else if (formData.name.length < 3) {
      errors.name = 'Group name must be at least 3 characters';
    } else if (formData.name.length > 50) {
      errors.name = 'Group name must be 50 characters or less';
    }
    
    if (!formData.identifier.trim()) {
      errors.identifier = 'Group ID is required';
    } else if (!/^[a-zA-Z0-9-_]+$/.test(formData.identifier)) {
      errors.identifier = 'Group ID can only contain letters, numbers, hyphens, and underscores';
    } else if (formData.identifier.length < 3) {
      errors.identifier = 'Group ID must be at least 3 characters';
    } else if (formData.identifier.length > 30) {
      errors.identifier = 'Group ID must be 30 characters or less';
    }
    
    if (formData.description && formData.description.length > 200) {
      errors.description = 'Description must be 200 characters or less';
    }
    
    return Object.keys(errors).length === 0;
  }
  
  function handleSubmit() {
    if (validateForm()) {
      onSubmit(formData);
    }
  }
  
  function generateIdentifier() {
    // Generate a clean identifier from the name
    const cleanName = formData.name
      .toLowerCase()
      .replace(/[^a-zA-Z0-9\s]/g, '')
      .replace(/\s+/g, '-')
      .substring(0, 30);
    
    formData.identifier = cleanName;
  }
  
  // Auto-generate identifier when name changes
  $: if (formData.name && !formData.identifier) {
    generateIdentifier();
  }
</script>

<div class="bg-white border border-gray-200 rounded-lg p-6">
  <h2 class="text-xl font-semibold text-gray-900 mb-6">Create New Group</h2>
  
  <form on:submit|preventDefault={handleSubmit} class="space-y-4">
    <TextField
      label="Group Name"
      bind:value={formData.name}
      placeholder="Enter group name"
      validationMessage={errors.name}
      validationState={errors.name ? 'error' : 'none'}
      required
      disabled={isLoading}
    />
    
    <div>
      <TextField
        label="Group ID"
        bind:value={formData.identifier}
        placeholder="unique-group-id"
        validationMessage={errors.identifier}
        validationState={errors.identifier ? 'error' : 'none'}
        required
        disabled={isLoading}
      />
      <p class="mt-1 text-sm text-gray-500">
        This will be used to share your group with others. It must be unique.
      </p>
    </div>
    
    <TextField
      label="Description (Optional)"
      bind:value={formData.description}
      placeholder="Describe your group..."
      validationMessage={errors.description}
      validationState={errors.description ? 'error' : 'none'}
      multiline
      disabled={isLoading}
    />
    
    <div class="flex space-x-3 pt-4">
      <Button 
        type="submit" 
        variant="primary"
        disabled={isLoading}
        loading={isLoading}
      >
        {isLoading ? 'Creating...' : 'Create Group'}
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
