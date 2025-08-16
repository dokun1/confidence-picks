<script>
  import JoinGroupForm from '../designsystem/components/JoinGroupForm.svelte';

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
        data: event.detail,
        groupName: 'Fantasy Friends'
      };
      showForm = false;
    }, 1500);
  }

  function handleCancel() {
    showForm = false;
    formResult = null;
  }

  function showJoinForm() {
    showForm = true;
    formResult = null;
  }
</script>

<div class="space-y-lg">
  <div>
    <h2 class="text-2xl font-heading font-bold text-[var(--color-text-primary)] mb-md">
      Join Group Form
    </h2>
    <p class="text-[var(--color-text-secondary)] mb-lg">
      Simple form for joining existing groups by group identifier with validation.
    </p>
  </div>

  <!-- Demo Controls -->
  <div class="flex gap-md">
    <button
      class="px-md py-sm bg-primary-500 text-white rounded-base hover:bg-primary-600 transition-colors"
      on:click={showJoinForm}
    >
      Show Join Form
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
    <div class="max-w-md">
      <div class="p-lg bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-base">
        <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-md">
          Join Existing Group
        </h3>
        <JoinGroupForm 
          {isLoading}
          onSubmit={handleSubmit}
          onCancel={handleCancel}
        />
      </div>
    </div>
  {/if}

  <!-- Result Display -->
  {#if formResult}
    <div class="max-w-md">
      <div class="p-lg bg-success-50 dark:bg-success-900/20 border border-success-200 dark:border-success-800 rounded-base">
        <h3 class="text-lg font-heading font-semibold text-success-700 dark:text-success-400 mb-md">
          Successfully Joined "{formResult.groupName}"!
        </h3>
        <pre class="text-sm text-success-600 dark:text-success-300 bg-success-100 dark:bg-success-900/40 p-sm rounded overflow-auto">
{JSON.stringify(formResult.data, null, 2)}
        </pre>
      </div>
    </div>
  {/if}

  <!-- Example Identifiers -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Example Group Identifiers
    </h3>
    <p class="text-[var(--color-text-secondary)] mb-md">
      Try entering one of these example identifiers:
    </p>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <code class="text-primary-600 dark:text-primary-400 font-mono">fantasy-friends-2024</code>
        <p class="text-sm text-[var(--color-text-secondary)] mt-xs">
          Fantasy Friends group
        </p>
      </div>
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <code class="text-primary-600 dark:text-primary-400 font-mono">office-championship</code>
        <p class="text-sm text-[var(--color-text-secondary)] mt-xs">
          Office Championship
        </p>
      </div>
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <code class="text-primary-600 dark:text-primary-400 font-mono">family-pool-2024</code>
        <p class="text-sm text-[var(--color-text-secondary)] mt-xs">
          Family Pool
        </p>
      </div>
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <code class="text-primary-600 dark:text-primary-400 font-mono">college-buddies</code>
        <p class="text-sm text-[var(--color-text-secondary)] mt-xs">
          College Buddies League
        </p>
      </div>
    </div>
  </div>

  <!-- Features -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Features
    </h3>
    <ul class="list-disc list-inside text-[var(--color-text-secondary)] space-y-xs">
      <li>Group identifier validation and formatting</li>
      <li>Real-time input validation with helpful messages</li>
      <li>Loading states during group lookup</li>
      <li>Clear user guidance and examples</li>
      <li>Pattern matching for valid identifiers</li>
      <li>Cancel functionality</li>
    </ul>
  </div>

  <!-- Usage Example -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Usage Example
    </h3>
    <div class="bg-secondary-50 dark:bg-secondary-800 p-md rounded-base">
      <pre class="text-sm text-[var(--color-text-secondary)] overflow-auto">
{`<JoinGroupForm 
  isLoading={isLoading}
  onSubmit={handleSubmit}
  onCancel={handleCancel}
/>`}
      </pre>
    </div>
  </div>
</div>
