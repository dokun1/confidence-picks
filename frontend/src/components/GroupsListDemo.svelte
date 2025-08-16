<script>
  import GroupsList from '../designsystem/components/GroupsList.svelte';

  let isLoading = false;
  let groups = [
    {
      id: '1',
      name: 'Fantasy Friends',
      identifier: 'fantasy-friends-2024',
      description: 'Our yearly fantasy football confidence pool with college friends. Winner takes all!',
      memberCount: 8,
      isOwner: true,
      createdAt: '2024-08-01T10:00:00Z'
    },
    {
      id: '2', 
      name: 'Office Championship',
      identifier: 'office-champs',
      description: 'Company-wide confidence picks league. May the best predictor win!',
      memberCount: 24,
      isOwner: false,
      createdAt: '2024-07-15T14:30:00Z'
    },
    {
      id: '3',
      name: 'Family Pool',
      identifier: 'fam-pool',
      description: 'Just the family competing for bragging rights.',
      memberCount: 4,
      isOwner: true,
      createdAt: '2024-08-10T09:15:00Z'
    }
  ];

  let emptyGroups = [];
  let showEmpty = false;
  let lastAction = null;

  function handleCreateNew() {
    lastAction = 'Create New Group clicked';
    console.log('Create new group');
  }

  function handleJoinExisting() {
    lastAction = 'Join Existing Group clicked';
    console.log('Join existing group');
  }

  function handleViewGroup(event) {
    lastAction = `View Group: ${event.detail.name}`;
    console.log('View group:', event.detail);
  }

  function handleEditGroup(event) {
    lastAction = `Edit Group: ${event.detail.name}`;
    console.log('Edit group:', event.detail);
  }

  function handleLeaveGroup(event) {
    lastAction = `Leave Group: ${event.detail.name}`;
    console.log('Leave group:', event.detail);
  }

  function simulateLoading() {
    isLoading = true;
    setTimeout(() => {
      isLoading = false;
    }, 2000);
  }

  function toggleEmpty() {
    showEmpty = !showEmpty;
  }
</script>

<div class="space-y-lg">
  <div>
    <h2 class="text-2xl font-heading font-bold text-[var(--color-text-primary)] mb-md">
      Groups List
    </h2>
    <p class="text-[var(--color-text-secondary)] mb-lg">
      Master component for displaying all user groups with empty states, loading states, and action panels.
    </p>
  </div>

  <!-- Demo Controls -->
  <div class="flex flex-wrap gap-md">
    <button
      class="px-md py-sm bg-primary-500 text-white rounded-base hover:bg-primary-600 transition-colors"
      on:click={simulateLoading}
    >
      Simulate Loading
    </button>
    <button
      class="px-md py-sm bg-secondary-500 text-white rounded-base hover:bg-secondary-600 transition-colors"
      on:click={toggleEmpty}
    >
      {showEmpty ? 'Show Groups' : 'Show Empty State'}
    </button>
    {#if lastAction}
      <button
        class="px-md py-sm bg-neutral-500 text-white rounded-base hover:bg-neutral-600 transition-colors"
        on:click={() => lastAction = null}
      >
        Clear Action
      </button>
    {/if}
  </div>

  <!-- Last Action Display -->
  {#if lastAction}
    <div class="p-md bg-info-50 dark:bg-info-900/20 border border-info-200 dark:border-info-800 rounded-base">
      <h4 class="font-semibold text-info-700 dark:text-info-400 mb-xs">Last Action:</h4>
      <p class="text-info-600 dark:text-info-300">{lastAction}</p>
    </div>
  {/if}

  <!-- Groups List Demo -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Groups Display
    </h3>
    <GroupsList 
      groups={showEmpty ? emptyGroups : groups}
      {isLoading}
      onCreateNew={handleCreateNew}
      onJoinExisting={handleJoinExisting}
      onViewGroup={handleViewGroup}
      onEditGroup={handleEditGroup}
      onLeaveGroup={handleLeaveGroup}
    />
  </div>

  <!-- Features -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Features
    </h3>
    <ul class="list-disc list-inside text-[var(--color-text-secondary)] space-y-xs">
      <li>Responsive grid layout for multiple groups</li>
      <li>Empty state with call-to-action buttons</li>
      <li>Loading states with skeleton placeholders</li>
      <li>Action panels for creating and joining groups</li>
      <li>Event delegation for group actions (view, edit, leave)</li>
      <li>Mobile-responsive design</li>
      <li>Owner vs member action differentiation</li>
    </ul>
  </div>

  <!-- States -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Component States
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-3 gap-md">
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <h4 class="font-semibold text-[var(--color-text-primary)] mb-sm">Loading State</h4>
        <p class="text-sm text-[var(--color-text-secondary)]">
          Shows skeleton cards while groups are being fetched
        </p>
      </div>
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <h4 class="font-semibold text-[var(--color-text-primary)] mb-sm">Empty State</h4>
        <p class="text-sm text-[var(--color-text-secondary)]">
          Displays helpful message and action buttons when no groups exist
        </p>
      </div>
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <h4 class="font-semibold text-[var(--color-text-primary)] mb-sm">Populated State</h4>
        <p class="text-sm text-[var(--color-text-secondary)]">
          Shows groups in responsive grid with action panel
        </p>
      </div>
    </div>
  </div>

  <!-- Usage Example -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Usage Example
    </h3>
    <div class="bg-secondary-50 dark:bg-secondary-800 p-md rounded-base">
      <pre class="text-sm text-[var(--color-text-secondary)] overflow-auto">
{`<GroupsList 
  {groups}
  {isLoading}
  onCreateNew={handleCreateNew}
  onJoinExisting={handleJoinExisting}
  onViewGroup={handleViewGroup}
  onEditGroup={handleEditGroup}
  onLeaveGroup={handleLeaveGroup}
/>`}
      </pre>
    </div>
  </div>
</div>
