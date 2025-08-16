<script>
  import Button from './Button.svelte';
  
  export let group = {
    id: '',
    name: '',
    identifier: ''
  };
  
  export let picks = [];
  export let games = [];
  export let isLoading = false;
  export let onUpdatePick = () => {};
  export let onSubmitPicks = () => {};
  export let onBack = () => {};
  
  let userPicks = {};
  let hasChanges = false;
  
  // Initialize user picks from props
  $: {
    userPicks = {};
    picks.forEach(pick => {
      userPicks[pick.gameId] = pick.confidence;
    });
  }
  
  function updatePick(gameId, confidence) {
    userPicks[gameId] = confidence;
    hasChanges = true;
    onUpdatePick(gameId, confidence);
  }
  
  function handleSubmit() {
    const picksData = Object.entries(userPicks).map(([gameId, confidence]) => ({
      gameId: parseInt(gameId),
      confidence: parseInt(confidence)
    }));
    
    onSubmitPicks(picksData);
    hasChanges = false;
  }
  
  function getConfidenceLabel(confidence) {
    const labels = {
      1: 'Least Confident',
      2: 'Low Confidence',
      3: 'Medium-Low',
      4: 'Medium',
      5: 'Medium-High',
      6: 'High Confidence',
      7: 'Most Confident'
    };
    return labels[confidence] || 'Not Set';
  }
  
  function formatDateTime(dateTime) {
    return new Date(dateTime).toLocaleString();
  }
  
  // Sort games by date
  $: sortedGames = games.sort((a, b) => new Date(a.dateTime) - new Date(b.dateTime));
</script>

<div class="space-y-6">
  <!-- Header -->
  <div class="flex justify-between items-center">
    <div>
      <Button variant="secondary" size="sm" on:click={onBack}>
        ← Back to Groups
      </Button>
      <h1 class="text-2xl font-bold text-gray-900 mt-2">{group.name}</h1>
      <p class="text-gray-600">Make your confidence picks for this week's games</p>
    </div>
    
    <div class="text-right">
      <Button 
        variant="primary"
        on:click={handleSubmit}
        disabled={!hasChanges || isLoading}
        loading={isLoading}
      >
        {isLoading ? 'Saving...' : 'Save Picks'}
      </Button>
      {#if hasChanges}
        <p class="text-sm text-orange-600 mt-1">You have unsaved changes</p>
      {/if}
    </div>
  </div>
  
  <!-- Instructions -->
  <div class="bg-blue-50 border border-blue-200 rounded-lg p-4">
    <h3 class="font-medium text-blue-900 mb-2">How Confidence Picks Work</h3>
    <p class="text-blue-700 text-sm">
      Rank each game from 1-7 based on your confidence in picking the winner. 
      Use 7 for your most confident pick and 1 for your least confident. 
      Each confidence level can only be used once.
    </p>
  </div>
  
  <!-- Games loading state -->
  {#if isLoading && games.length === 0}
    <div class="flex justify-center items-center py-12">
      <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      <span class="ml-3 text-gray-600">Loading games...</span>
    </div>
  <!-- No games state -->
  {:else if games.length === 0}
    <div class="text-center py-12">
      <div class="mx-auto h-12 w-12 text-gray-400">
        <svg fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h3 class="mt-2 text-sm font-medium text-gray-900">No games available</h3>
      <p class="mt-1 text-sm text-gray-500">Games for this week haven't been loaded yet.</p>
    </div>
  <!-- Games list -->
  {:else}
    <div class="space-y-4">
      {#each sortedGames as game (game.id)}
        <div class="bg-white border border-gray-200 rounded-lg p-6">
          <div class="flex justify-between items-start mb-4">
            <div class="flex-1">
              <div class="flex items-center space-x-4 mb-2">
                <h3 class="text-lg font-semibold text-gray-900">
                  {game.awayTeam} @ {game.homeTeam}
                </h3>
                <span class="text-sm text-gray-500">
                  {formatDateTime(game.dateTime)}
                </span>
              </div>
              
              {#if game.status === 'completed'}
                <div class="text-sm text-green-600 font-medium">
                  Final: {game.awayTeamScore} - {game.homeTeamScore}
                </div>
              {:else if game.status === 'in_progress'}
                <div class="text-sm text-blue-600 font-medium">
                  Live: {game.awayTeamScore} - {game.homeTeamScore}
                </div>
              {:else}
                <div class="text-sm text-gray-500">
                  Scheduled
                </div>
              {/if}
            </div>
            
            <div class="flex flex-col items-end">
              <label for="confidence-{game.id}" class="text-sm font-medium text-gray-700 mb-2">
                Confidence Level
              </label>
              <select 
                id="confidence-{game.id}"
                bind:value={userPicks[game.id]}
                on:change={() => updatePick(game.id, userPicks[game.id])}
                class="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                disabled={game.status !== 'scheduled'}
              >
                <option value="">Select...</option>
                {#each [1, 2, 3, 4, 5, 6, 7] as level}
                  <option value={level}>{level} - {getConfidenceLabel(level)}</option>
                {/each}
              </select>
              
              {#if userPicks[game.id]}
                <p class="text-xs text-gray-500 mt-1 text-center">
                  {getConfidenceLabel(userPicks[game.id])}
                </p>
              {/if}
            </div>
          </div>
        </div>
      {/each}
    </div>
  {/if}
</div>

<style>
  /* Additional custom styles if needed */
</style>
