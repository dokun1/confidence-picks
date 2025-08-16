<script>
  import GroupPicks from '../designsystem/components/GroupPicks.svelte';

  let group = {
    id: '1',
    name: 'Fantasy Friends',
    identifier: 'fantasy-friends-2024'
  };

  let picks = [
    { gameId: 'game1', teamId: 'KC', confidence: 14 },
    { gameId: 'game2', teamId: 'BUF', confidence: 13 },
    { gameId: 'game3', teamId: 'MIA', confidence: 12 }
  ];

  let games = [
    {
      id: 'game1',
      week: 1,
      date: '2024-09-08T17:00:00Z',
      status: 'upcoming',
      awayTeam: { id: 'BAL', name: 'Ravens', score: null },
      homeTeam: { id: 'KC', name: 'Chiefs', score: null }
    },
    {
      id: 'game2', 
      week: 1,
      date: '2024-09-08T20:20:00Z',
      status: 'upcoming',
      awayTeam: { id: 'BUF', name: 'Bills', score: null },
      homeTeam: { id: 'NYJ', name: 'Jets', score: null }
    },
    {
      id: 'game3',
      week: 1,
      date: '2024-09-09T13:00:00Z',
      status: 'upcoming',
      awayTeam: { id: 'MIA', name: 'Dolphins', score: null },
      homeTeam: { id: 'JAX', name: 'Jaguars', score: null }
    },
    {
      id: 'game4',
      week: 1,
      date: '2024-09-09T13:00:00Z', 
      status: 'upcoming',
      awayTeam: { id: 'CLE', name: 'Browns', score: null },
      homeTeam: { id: 'DAL', name: 'Cowboys', score: null }
    },
    {
      id: 'game5',
      week: 1,
      date: '2024-09-09T16:25:00Z',
      status: 'upcoming',
      awayTeam: { id: 'GB', name: 'Packers', score: null },
      homeTeam: { id: 'PHI', name: 'Eagles', score: null }
    }
  ];

  let lastAction = null;
  let isLoading = false;

  function handlePickSubmit(event) {
    lastAction = `Pick submitted: ${event.detail.teamName} with confidence ${event.detail.confidence}`;
    console.log('Pick submitted:', event.detail);
  }

  function handleSaveAll(event) {
    isLoading = true;
    lastAction = `Saving all picks... (${event.detail.length} picks)`;
    
    // Simulate API call
    setTimeout(() => {
      isLoading = false;
      lastAction = `All picks saved successfully! (${event.detail.length} picks)`;
    }, 2000);
    
    console.log('Save all picks:', event.detail);
  }

  function simulateCompletedGame() {
    // Simulate a completed game
    games = games.map((game, index) => {
      if (index === 0) {
        return {
          ...game,
          status: 'completed',
          awayTeam: { ...game.awayTeam, score: 17 },
          homeTeam: { ...game.homeTeam, score: 24 }
        };
      }
      return game;
    });
  }

  function resetGames() {
    games = games.map(game => ({
      ...game,
      status: 'upcoming',
      awayTeam: { ...game.awayTeam, score: null },
      homeTeam: { ...game.homeTeam, score: null }
    }));
  }
</script>

<div class="space-y-lg">
  <div>
    <h2 class="text-2xl font-heading font-bold text-[var(--color-text-primary)] mb-md">
      Group Picks
    </h2>
    <p class="text-[var(--color-text-secondary)] mb-lg">
      Interface for making confidence picks within groups with game management and pick validation.
    </p>
  </div>

  <!-- Demo Controls -->
  <div class="flex flex-wrap gap-md">
    <button
      class="px-md py-sm bg-primary-500 text-white rounded-base hover:bg-primary-600 transition-colors"
      on:click={simulateCompletedGame}
    >
      Simulate Completed Game
    </button>
    <button
      class="px-md py-sm bg-secondary-500 text-white rounded-base hover:bg-secondary-600 transition-colors"
      on:click={resetGames}
    >
      Reset All Games
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

  <!-- Group Picks Demo -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Picks Interface
    </h3>
    <GroupPicks 
      {group}
      {picks}
      {games}
      {isLoading}
      onPickSubmit={handlePickSubmit}
      onSaveAll={handleSaveAll}
    />
  </div>

  <!-- Features -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      Features
    </h3>
    <ul class="list-disc list-inside text-[var(--color-text-secondary)] space-y-xs">
      <li>Confidence level selection (1-16 for NFL)</li>
      <li>Game sorting by date and status</li>
      <li>Team selection with visual feedback</li>
      <li>Pick validation and conflict detection</li>
      <li>Bulk save functionality</li>
      <li>Game status tracking (upcoming, live, completed)</li>
      <li>Mobile-responsive pick interface</li>
      <li>Loading states during save operations</li>
    </ul>
  </div>

  <!-- Pick Strategies -->
  <div>
    <h3 class="text-lg font-heading font-semibold text-[var(--color-text-primary)] mb-sm">
      How Confidence Picks Work
    </h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-md">
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <h4 class="font-semibold text-[var(--color-text-primary)] mb-sm">Confidence Levels</h4>
        <p class="text-sm text-[var(--color-text-secondary)] mb-sm">
          Assign confidence points (1-16) to each game based on how sure you are of the outcome.
        </p>
        <ul class="text-xs text-[var(--color-text-secondary)] space-y-xs">
          <li>• 16 points = Most confident pick</li>
          <li>• 1 point = Least confident pick</li>
          <li>• Each confidence level used exactly once</li>
        </ul>
      </div>
      <div class="p-md bg-secondary-50 dark:bg-secondary-800 rounded-base">
        <h4 class="font-semibold text-[var(--color-text-primary)] mb-sm">Scoring</h4>
        <p class="text-sm text-[var(--color-text-secondary)] mb-sm">
          Points are awarded based on correct picks and confidence levels.
        </p>
        <ul class="text-xs text-[var(--color-text-secondary)] space-y-xs">
          <li>• Correct pick = confidence points awarded</li>
          <li>• Wrong pick = 0 points</li>
          <li>• Highest total score wins</li>
        </ul>
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
{`<GroupPicks 
  {group}
  {picks}
  {games}
  {isLoading}
  onPickSubmit={handlePickSubmit}
  onSaveAll={handleSaveAll}
/>`}
      </pre>
    </div>
  </div>
</div>
