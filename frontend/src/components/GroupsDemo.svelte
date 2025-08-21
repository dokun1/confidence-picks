<script>
  import GroupCard from './GroupCard.svelte';
  import CreateGroupForm from './CreateGroupForm.svelte';
  import JoinGroupForm from './JoinGroupForm.svelte';
  import GroupsList from './GroupsList.svelte';
  import GroupPicks from './GroupPicks.svelte';
  import Button from '../designsystem/components/Button.svelte';
  
  let currentDemo = 'overview';
  let showCreateForm = false;
  let showJoinForm = false;
  let isLoading = false;
  let selectedGroup = null;
  
  // Mock data for demos
  const mockGroups = [
    {
      id: '1',
      name: 'Office League',
      identifier: 'office-league-2024',
      description: 'Our weekly office confidence picks competition',
      memberCount: 12,
      isOwner: true,
  createdAt: '2024-01-15T10:00:00Z'
    },
    {
      id: '2',
      name: 'Family Picks',
      identifier: 'family-fun-picks',
      description: 'Family-friendly NFL picks',
      memberCount: 6,
      isOwner: false,
  createdAt: '2024-02-01T15:30:00Z'
    },
    {
      id: '3',
      name: 'College Friends',
      identifier: 'college-buddies-nfl',
      description: '',
      memberCount: 8,
      isOwner: false,
  createdAt: '2024-01-20T12:00:00Z'
    }
  ];
  
  const mockGames = [
    {
      id: 1,
      awayTeam: 'Kansas City Chiefs',
      homeTeam: 'Buffalo Bills',
      awayTeamScore: 0,
      homeTeamScore: 0,
      dateTime: '2024-08-18T20:00:00Z',
      status: 'scheduled'
    },
    {
      id: 2,
      awayTeam: 'San Francisco 49ers',
      homeTeam: 'Dallas Cowboys',
      awayTeamScore: 21,
      homeTeamScore: 14,
      dateTime: '2024-08-17T18:00:00Z',
      status: 'completed'
    },
    {
      id: 3,
      awayTeam: 'Green Bay Packers',
      homeTeam: 'Chicago Bears',
      awayTeamScore: 10,
      homeTeamScore: 7,
      dateTime: '2024-08-18T15:00:00Z',
      status: 'in_progress'
    }
  ];
  
  const mockPicks = [
    { gameId: 1, confidence: 7 },
    { gameId: 2, confidence: 5 },
    { gameId: 3, confidence: 3 }
  ];
  
  // Demo handlers
  function handleCreateGroup(groupData) {
    console.log('Creating group:', groupData);
    showCreateForm = false;
    currentDemo = 'overview';
  }
  
  function handleJoinGroup(identifier) {
    console.log('Joining group:', identifier);
    showJoinForm = false;
    currentDemo = 'overview';
  }
  
  function handleViewGroup(group) {
    selectedGroup = group;
    currentDemo = 'picks';
  }
  
  function handleUpdatePick(gameId, confidence) {
    console.log('Updated pick:', { gameId, confidence });
  }
  
  function handleSubmitPicks(picks) {
    console.log('Submitting picks:', picks);
  }
  
  function simulateLoading() {
    isLoading = true;
    setTimeout(() => {
      isLoading = false;
    }, 2000);
  }
</script>

<div class="min-h-screen bg-gray-50 py-8">
  <div class="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
    <!-- Demo Navigation -->
    <div class="mb-8">
      <h1 class="text-3xl font-bold text-gray-900 mb-4">Groups Components Demo</h1>
      <p class="text-gray-600 mb-6">
        Interactive demonstration of all the groups-related components for the confidence picks application.
      </p>
      
      <div class="flex flex-wrap gap-2 mb-6">
        <Button 
          variant={currentDemo === 'overview' ? 'primary' : 'secondary'} 
          size="sm"
          on:click={() => { currentDemo = 'overview'; showCreateForm = false; showJoinForm = false; }}
        >
          Groups Overview
        </Button>
        <Button 
          variant={currentDemo === 'card' ? 'primary' : 'secondary'} 
          size="sm"
          on:click={() => { currentDemo = 'card'; showCreateForm = false; showJoinForm = false; }}
        >
          Group Card
        </Button>
        <Button 
          variant={currentDemo === 'create' ? 'primary' : 'secondary'} 
          size="sm"
          on:click={() => { currentDemo = 'create'; showCreateForm = false; showJoinForm = false; }}
        >
          Create Form
        </Button>
        <Button 
          variant={currentDemo === 'join' ? 'primary' : 'secondary'} 
          size="sm"
          on:click={() => { currentDemo = 'join'; showCreateForm = false; showJoinForm = false; }}
        >
          Join Form
        </Button>
        <Button 
          variant={currentDemo === 'picks' ? 'primary' : 'secondary'} 
          size="sm"
          on:click={() => { currentDemo = 'picks'; selectedGroup = mockGroups[0]; showCreateForm = false; showJoinForm = false; }}
        >
          Group Picks
        </Button>
      </div>
    </div>
    
    <!-- Demo Content -->
    <div class="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      {#if currentDemo === 'overview'}
        <div class="space-y-6">
          <h2 class="text-2xl font-semibold text-gray-900">Groups List Component</h2>
          <p class="text-gray-600">
            This component displays all user groups and provides actions to create or join groups.
          </p>
          
          {#if showCreateForm}
            <CreateGroupForm 
              onSubmit={handleCreateGroup}
              onCancel={() => showCreateForm = false}
              {isLoading}
            />
          {:else if showJoinForm}
            <JoinGroupForm 
              onSubmit={handleJoinGroup}
              onCancel={() => showJoinForm = false}
              {isLoading}
            />
          {:else}
            <GroupsList
              groups={mockGroups}
              {isLoading}
              onCreateNew={() => showCreateForm = true}
              onJoinExisting={() => showJoinForm = true}
              onViewGroup={handleViewGroup}
              onEditGroup={(group) => console.log('Edit:', group)}
              onLeaveGroup={(group) => console.log('Leave:', group)}
              onDeleteGroup={(group) => console.log('Delete:', group)}
              onRefresh={simulateLoading}
            />
          {/if}
        </div>
        
      {:else if currentDemo === 'card'}
        <div class="space-y-6">
          <h2 class="text-2xl font-semibold text-gray-900">Group Card Component</h2>
          <p class="text-gray-600">
            Individual group cards that display group information and actions.
          </p>
          
          <div class="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {#each mockGroups as group}
              <GroupCard 
                {group}
                onView={() => console.log('View:', group)}
                onEdit={() => console.log('Edit:', group)}
                onLeave={() => console.log('Leave:', group)}
                onDelete={() => console.log('Delete:', group)}
              />
            {/each}
          </div>
        </div>
        
      {:else if currentDemo === 'create'}
        <div class="space-y-6">
          <h2 class="text-2xl font-semibold text-gray-900">Create Group Form</h2>
          <p class="text-gray-600">
            Form for creating new confidence picks groups with validation.
          </p>
          
          <div class="max-w-lg">
            <CreateGroupForm 
              onSubmit={handleCreateGroup}
              onCancel={() => console.log('Cancel create')}
              {isLoading}
            />
            
            <div class="mt-4">
              <Button variant="secondary" size="sm" on:click={simulateLoading}>
                Test Loading State
              </Button>
            </div>
          </div>
        </div>
        
      {:else if currentDemo === 'join'}
        <div class="space-y-6">
          <h2 class="text-2xl font-semibold text-gray-900">Join Group Form</h2>
          <p class="text-gray-600">
            Simple form for joining existing groups by ID.
          </p>
          
          <div class="max-w-lg">
            <JoinGroupForm 
              onSubmit={handleJoinGroup}
              onCancel={() => console.log('Cancel join')}
              {isLoading}
            />
            
            <div class="mt-4">
              <Button variant="secondary" size="sm" on:click={simulateLoading}>
                Test Loading State
              </Button>
            </div>
          </div>
        </div>
        
      {:else if currentDemo === 'picks'}
        <div class="space-y-6">
          <h2 class="text-2xl font-semibold text-gray-900">Group Picks Component</h2>
          <p class="text-gray-600">
            Interface for making confidence picks within a group.
          </p>
          
          <GroupPicks
            group={selectedGroup || mockGroups[0]}
            picks={mockPicks}
            games={mockGames}
            {isLoading}
            onUpdatePick={handleUpdatePick}
            onSubmitPicks={handleSubmitPicks}
            onBack={() => currentDemo = 'overview'}
          />
          
          <div class="mt-4">
            <Button variant="secondary" size="sm" on:click={simulateLoading}>
              Test Loading State
            </Button>
          </div>
        </div>
      {/if}
    </div>
    
    <!-- Component Information -->
    <div class="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
      <h3 class="text-lg font-medium text-blue-900 mb-3">Component Features</h3>
      <div class="grid md:grid-cols-2 gap-6 text-sm text-blue-800">
        <div>
          <h4 class="font-medium mb-2">GroupCard</h4>
          <ul class="space-y-1">
            <li>• Displays group information and member count</li>
            <li>• Shows owner/member status badges</li>
            <li>• Conditional actions based on user role</li>
            <li>• Responsive design with hover effects</li>
          </ul>
        </div>
        
        <div>
          <h4 class="font-medium mb-2">CreateGroupForm</h4>
          <ul class="space-y-1">
            <li>• Form validation for all fields</li>
            <li>• Auto-generates group ID from name</li>
            <li>• Loading states and error handling</li>
            <li>• Character limits and pattern validation</li>
          </ul>
        </div>
        
        <div>
          <h4 class="font-medium mb-2">JoinGroupForm</h4>
          <ul class="space-y-1">
            <li>• Simple group ID input with validation</li>
            <li>• Pattern matching for valid IDs</li>
            <li>• Loading and error states</li>
            <li>• Clear user instructions</li>
          </ul>
        </div>
        
        <div>
          <h4 class="font-medium mb-2">GroupsList</h4>
          <ul class="space-y-1">
            <li>• Responsive grid layout for group cards</li>
            <li>• Empty state with call-to-action</li>
            <li>• Action panels for create/join flows</li>
            <li>• Loading states and refresh functionality</li>
          </ul>
        </div>
        
        <div>
          <h4 class="font-medium mb-2">GroupPicks</h4>
          <ul class="space-y-1">
            <li>• Confidence level selection (1-7)</li>
            <li>• Game status indicators (scheduled/live/final)</li>
            <li>• Unsaved changes tracking</li>
            <li>• Disabled picks for completed games</li>
          </ul>
        </div>
      </div>
    </div>
  </div>
</div>

<style>
  /* Additional demo-specific styles */
  :global(.min-h-screen) {
    min-height: 100vh;
  }
</style>
