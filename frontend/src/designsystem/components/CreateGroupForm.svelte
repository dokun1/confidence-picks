<script>
  import Button from './Button.svelte';
  import TextField from './TextField.svelte';
  
  export let onSubmit = () => {};
  export let onCancel = () => {};
  export let isLoading = false;
  
  export let initialValues = null; // { name, identifier, description }
  let formData = {
    name: '',
    identifier: '',
    description: ''
  };
  $: if (initialValues && !formData.name && !formData.identifier) {
    // Prefill once when arriving with initial values
    formData = {
      name: initialValues.name || '',
      identifier: initialValues.identifier || '',
      description: initialValues.description || ''
    };
    // If identifier provided, treat as manually edited so slug doesn't overwrite
    if (initialValues.identifier) {
      identifierManuallyEdited = true;
    }
  }
  // Track whether user manually changed identifier; if not, keep auto-syncing from name
  let identifierManuallyEdited = false;
  
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
  
  function slugifyName(name) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '') // remove invalid chars
      .trim()
      .replace(/\s+/g, '-') // spaces to dashes
      .replace(/-+/g, '-')   // collapse multiple dashes
      .replace(/^-+|-+$/g, '') // trim leading/trailing dashes
      .substring(0, 30);
  }

  // Continuously sync identifier from name while not manually edited
  $: if (!identifierManuallyEdited) {
    formData.identifier = slugifyName(formData.name || '');
  }

  function handleIdentifierInput(e) {
    const value = e.target.value;
    // If user diverges from auto slug, stop auto-updating
    const expected = slugifyName(formData.name || '');
    if (value !== expected) {
      identifierManuallyEdited = true;
    }
    formData.identifier = value;
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
        value={formData.identifier}
        on:input={handleIdentifierInput}
        placeholder="unique-group-id"
        validationMessage={errors.identifier}
        validationState={errors.identifier ? 'error' : 'none'}
        required
        disabled={isLoading || !!initialValues?.identifier}
      />
      <p class="mt-1 text-sm text-gray-500">
        {#if initialValues?.identifier}
          Group ID cannot be changed after creation.
        {:else}
          This will be used to share your group with others. It must be unique.
        {/if}
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
