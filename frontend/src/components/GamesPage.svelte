
<script>
    import { onMount } from "svelte";
    import Button from '../designsystem/components/Button.svelte';

    // API Configuration
    const API_URL = import.meta.env.PROD 
        ? 'https://confidence-picks.vercel.app'
        : 'http://localhost:3001';

    let games = [];
    let loading = false;
    let error = '';

    let selectedYear = 2025;
    let selectedWeek = 1;
    let seasonType = 2; // TODO: convert to enum

    async function fetchGames() {
        try {
            loading = true;
            error = '';

            console.log(`Fetching games for ${selectedYear}, week ${selectedWeek}`);

            const response = await fetch(`${API_URL}/api/games/${selectedYear}/${seasonType}/${selectedWeek}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            games = data.games || [];
        } catch (err) {
            error = `Failed to fetch games: ${err.message}`;
        } finally {
            loading = false;
        }
    }

  function formatGameDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit'
    });
  }

  onMount(() => {
    fetchGames();
  });


</script>

<div class="games-container">
  <h2>NFL Games</h2>
  
  <!-- Week Selector -->
  <div class="controls">
    <div class="form-group">
      <label for="year">Year:</label>
      <select id="year" bind:value={selectedYear}>
        <option value={2024}>2024</option>
        <option value={2025}>2025</option>
      </select>
    </div>
    
    <div class="form-group">
      <label for="week">Week:</label>
      <select id="week" bind:value={selectedWeek}>
        {#each Array(18) as _, i}
          <option value={i + 1}>Week {i + 1}</option>
        {/each}
      </select>
    </div>
    
    <Button 
      variant="primary" 
      size="md" 
      loading={loading} 
      disabled={loading}
      on:click={fetchGames}
    >
      {loading ? 'Loading...' : 'Load Games'}
    </Button>
  </div>

  <!-- Games List -->
  <div class="games-list">
    {#if loading}
      <div class="loading">Loading games...</div>
    {:else if error}
      <div class="error">
        {error}
        <Button variant="secondary" size="sm" on:click={fetchGames}>
          Try Again
        </Button>
      </div>
    {:else if games.length === 0}
      <div class="no-games">No games found for this week.</div>
    {:else}
      <div class="games-grid">
        {#each games as game}
          <div class="game-card">
            <div class="game-header">
              <span class="game-date">{formatGameDate(game.gameDate)}</span>
              <span class="game-status">{game.status}</span>
            </div>
            
            <div class="matchup">
              <div class="team away-team">
                <span class="team-name">{game.awayTeam.name}</span>
                <span class="team-score">{game.awayScore}</span>
              </div>
              
              <div class="vs">@</div>
              
              <div class="team home-team">
                <span class="team-name">{game.homeTeam.name}</span>
                <span class="team-score">{game.homeScore}</span>
              </div>
            </div>
          </div>
        {/each}
      </div>
    {/if}
  </div>
</div>

<style>
  .games-container {
    max-width: 1200px;
    margin: 0 auto;
    padding: 2rem;
  }

  .controls {
    display: flex;
    gap: 1rem;
    align-items: end;
    margin-bottom: 2rem;
    padding: 1rem;
    background: #f8f9fa;
    border-radius: 8px;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label {
    font-weight: 500;
    color: #495057;
  }

  .form-group select {
    padding: 0.5rem;
    border: 1px solid #ced4da;
    border-radius: 4px;
    background: white;
  }

  .loading, .error, .no-games {
    text-align: center;
    padding: 2rem;
    color: #6c757d;
  }

  .error {
    color: #dc3545;
  }

  .games-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: 1rem;
  }

  .game-card {
    background: white;
    border: 1px solid #e9ecef;
    border-radius: 8px;
    padding: 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #e9ecef;
  }

  .game-date {
    font-size: 0.9rem;
    color: #6c757d;
  }

  .game-status {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    background: #e9ecef;
    border-radius: 4px;
    color: #495057;
  }

  .matchup {
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .team {
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
  }

  .team-name {
    font-weight: 500;
    margin-bottom: 0.25rem;
  }

  .team-score {
    font-size: 1.5rem;
    font-weight: bold;
    color: #007bff;
  }

  .vs {
    font-weight: bold;
    color: #6c757d;
    margin: 0 1rem;
  }
</style>