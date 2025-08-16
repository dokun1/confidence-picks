<script>
  import CreateGroupForm from '../designsystem/components/CreateGroupForm.svelte';

  let isLoading = false;
  let showForm = false;
  let formResult = null;

  function handleSubmit(event) {
    isLoading = true;
    formResult = null;
    
    // Simulate API call
    setTimeout(() => {
      isLoading = false;
      formResult = {
        success: true,
        data: event.detail
      };
      showForm = false;
    }, 2000);
  }

  function handleCancel() {
    showForm = false;
    formResult = null;
  }

  function showCreateForm() {
    showForm = true;
    formResult = null;
  }
</script>

<div class="space-y-lg">
  <div>
    <h2 class="text-2xl font-heading font-bold text-[var(--color-text-primary)] mb-md">
      Create Group Form
    </h2>
    <p class="text-[var(--color-text-secondary)] mb-lg">
      Form for creating new groups with validation, auto-ID generation, and loading states.
    </p>
  </div>

  <!-- Demo Controls -->
  <div class="flex gap-md">
    <button
      class="px-md py-sm bg-primary-500 text-white rounded-base hover:bg-primary-600 transition-colors"
      on:click={showCreateForm}
    >
      Show Create Form
    </button>
    {#if formResult}
      <button
        class="px-md py-sm bg-secondary-500 text-white rounded-base hover:bg-secondary-600 transition-colors"
        on:click={() => formResult = null}
      >
        Clear Result
      </button>
    {/if}
  </div>

  <!-- Form Display -->
  {#if showForm}
    <div class="max-w-lg">
      <div class="p-lg bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
        <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-md">
          Create New Group
        </h3>
        <CreateGroupForm 
          {isLoading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  {/if}

  <!-- Result Display -->
  {#if formResult}
    <div class="max-w-lg">
      <div class="p-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-base">
        <h3 class="text-lg font-heading font-semibold text-success-700 dark:text-success-400 mb-md">
          Form Submitted Successfully!
        </h3>
        <pre class="text-sm text-success-600 dark:text-success-300 bg-success-100 dark:bg-success-900/40 p-sm rounded overflow-auto">
{JSON.stringify(formResult.data, null, 2)}
        </pre>
      </div>
    </div>
  {/if}

  <!-- Features -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Features
    </h3>
    <ul class="list-disc list-inside text-[var(--color-text-secondary)] space-y-xs">
      <li>Automatic group identifier generation from name</li>
      <li>Real-time form validation with error messages</li>
      <li>Loading states with disabled form during submission</li>
      <li>Multiline textarea support for descriptions</li>
      <li>Required field indicators and validation</li>
      <li>Character limits and input sanitization</li>
      <li>Cancel functionality with confirmation</li>
    </ul>
  </div>

  <!-- Usage Example -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Usage Example
    </h3>
    <div class="bg-secondary-50 dark:bg-secondary-800 p-md rounded-base">
      <pre class="text-sm text-[var(--color-text-secondary)] overflow-auto">
{`<CreateGroupForm 
  isLoading={isLoading}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>`}
      </pre>
    </div>
  </div>
</div>
