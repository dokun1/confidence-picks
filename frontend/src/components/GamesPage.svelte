
<script>
    import { onMount } from "svelte";
    import Button from '../designsystem/components/Button.svelte';

    // API Configuration
    const API_URL = import.meta.env.PROD 
        ? 'https://api.confidence-picks.com'
        : 'http://localhost:3001';

    let games = [];
    let loading = false;
    let error = '';

    let selectedYear = 2025;
    let selectedWeek = 1;
    // NFL season type: 1 = Preseason, 2 = Regular (matching ESPN numeric codes)
    let seasonType = 2; 
  let forceRefresh = false;

    const SEASON_TYPE_META = {
      1: { label: 'Preseason', weeks: 4 },
      2: { label: 'Regular Season', weeks: 18 }
    };

    $: totalWeeks = SEASON_TYPE_META[seasonType].weeks;
    $: if (selectedWeek > totalWeeks) selectedWeek = 1; // reset if switching from REG->PRE

  function deriveStatus(game) {
    switch (game.status) {
      case 'FINAL': return 'final';
      case 'IN_PROGRESS': return 'in progress';
      case 'SCHEDULED':
      default:
        return 'not started';
    }
  }

  function readableTextColor(hex) {
    if (!hex) return '#000';
    const clean = hex.replace('#','');
    if (clean.length !== 6) return '#000';
    const r = parseInt(clean.substring(0,2),16);
    const g = parseInt(clean.substring(2,4),16);
    const b = parseInt(clean.substring(4,6),16);
    // relative luminance
    const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
    return lum > 0.6 ? '#000' : '#fff';
  }

  function teamStyle(team) {
    const bg = team.color ? `#${team.color.replace('#','')}` : '#f8f9fa';
    const color = team.color ? readableTextColor(team.color) : '#212529';
    return `background:${bg};color:${color}`;
  }

  async function fetchGames() {
        try {
            loading = true;
            error = '';

      console.log(`Fetching games for ${selectedYear}, seasonType ${seasonType}, week ${selectedWeek}`);

            const response = await fetch(`${API_URL}/api/games/${selectedYear}/${seasonType}/${selectedWeek}?force=${forceRefresh}`);
            
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            games = (data.games || []).map(g => ({ ...g, _derivedStatus: deriveStatus(g) }));
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
      <label for="seasonType">Season:</label>
      <select id="seasonType" bind:value={seasonType} on:change={fetchGames}>
        <option value={1}>Preseason</option>
        <option value={2}>Regular Season</option>
      </select>
    </div>
    
    <div class="form-group">
      <label for="week">Week:</label>
      <select id="week" bind:value={selectedWeek}>
        {#each Array(totalWeeks) as _, i}
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
    <label class="force-refresh">
      <input type="checkbox" bind:checked={forceRefresh} /> Force refresh
    </label>
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
              <span class="game-status {game._derivedStatus.replace(/\s/g,'-')}">
                {#if game._derivedStatus === 'in progress'}
                  {#if game.displayClock}{game.displayClock} · {/if}
                  {#if game.period}Q{game.period}{/if}
                {:else}
                  {game._derivedStatus}
                {/if}
              </span>
            </div>
            
            <div class="matchup">
              <div class="team away-team" style={teamStyle(game.awayTeam)}>
                <div class="team-left">
                  {#if game.awayTeam.logo}
                    <img class="team-logo" alt={game.awayTeam.abbreviation} src={game.awayTeam.logo} />
                  {/if}
                  <div class="team-text">
                    <span class="team-abbr">{game.awayTeam.abbreviation}</span>
                    <span class="team-full">{game.awayTeam.name}</span>
                  </div>
                </div>
                <span class="team-score">{game.awayScore}</span>
              </div>

              <div class="vs">@</div>

              <div class="team home-team" style={teamStyle(game.homeTeam)}>
                <div class="team-left">
                  {#if game.homeTeam.logo}
                    <img class="team-logo" alt={game.homeTeam.abbreviation} src={game.homeTeam.logo} />
                  {/if}
                  <div class="team-text">
                    <span class="team-abbr">{game.homeTeam.abbreviation}</span>
                    <span class="team-full">{game.homeTeam.name}</span>
                  </div>
                </div>
                <span class="team-score">{game.homeScore}</span>
              </div>
            </div>
            {#if game._derivedStatus === 'in progress' && game.probability}
              <div class="probability-row">
                <div class="pct away">{Math.round(game.probability.awayWinPct * 100)}%</div>
                <div class="label">Win Prob</div>
                <div class="pct home">{Math.round(game.probability.homeWinPct * 100)}%</div>
              </div>
            {/if}
            <div class="game-meta">
              {#if game.odds}
                <div class="odds-line">
                  <strong>Odds:</strong>
                  {#if game.odds.favoriteAbbr}
                    <span>{game.odds.favoriteAbbr} {game.odds.spread > 0 ? '-' + game.odds.spread : game.odds.spread}</span>
                  {:else}
                    <span>{game.odds.details}</span>
                  {/if}
                  {#if game.odds.overUnder}
                    <span class="divider">|</span>
                    <span>O/U {game.odds.overUnder}</span>
                  {/if}
                  {#if game.odds.provider}
                    <span class="provider">({game.odds.provider})</span>
                  {/if}
                </div>
              {/if}
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
    background: var(--color-surface-secondary, #f8f9fa);
    border: 1px solid var(--color-surface-tertiary, #e9ecef);
    border-radius: 8px;
  }
  .force-refresh {
    display: flex;
    align-items: center;
    gap: .4rem;
    font-size: .8rem;
    color: var(--color-text-secondary, #495057);
    user-select: none;
  }

  .form-group {
    display: flex;
    flex-direction: column;
    gap: 0.5rem;
  }

  .form-group label { font-weight: 500; color: var(--color-text-secondary, #495057); }

  .form-group select {
    padding: 0.5rem;
    border: 1px solid var(--color-surface-tertiary, #ced4da);
    border-radius: 6px;
    background: var(--color-surface-primary, #ffffff);
    color: var(--color-text-primary, #212529);
  }

  .loading, .error, .no-games { text-align: center; padding: 2rem; color: var(--color-text-tertiary, #6c757d); }

  .error { color: #dc3545; }
  /* Dark mode overrides for controls */
  :global(.dark) .controls { background: var(--color-surface-secondary, #1f2937); border-color: var(--color-surface-tertiary, #374151); }
  :global(.dark) .form-group select { background: var(--color-surface-primary, #111827); color: var(--color-text-primary, #fff); border-color: var(--color-surface-tertiary, #374151); }
  :global(.dark) .form-group select:focus { outline: 2px solid #2563eb; }
  :global(.dark) .force-refresh { color: var(--color-text-secondary, #e5e7eb); }

  .games-grid {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .game-card {
    background: var(--color-surface-secondary, #ffffff);
    border: 1px solid var(--color-surface-tertiary, #e9ecef);
    border-radius: 12px;
    padding: 1.25rem 1.25rem 1rem;
    box-shadow: 0 2px 4px rgba(0,0,0,0.06);
    display: flex;
    flex-direction: column;
    gap: .75rem;
    width: 100%;
  }

  .game-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid var(--color-surface-tertiary, #e9ecef);
  }

  .game-date { font-size: 0.9rem; color: var(--color-text-tertiary, #6c757d); }

  .game-status {
    font-size: 0.8rem;
    padding: 0.25rem 0.5rem;
    border-radius: 4px;
    text-transform: uppercase;
    letter-spacing: .5px;
    font-weight: 600;
    background: var(--color-surface-tertiary, #e9ecef);
    color: var(--color-text-secondary, #495057);
  }
  .game-status.in-progress {
    background: #dc3545;
    color: #fff;
  }
  .game-status.final {
    background: #198754;
    color: #fff;
  }
  .game-status.not-started {
    background: #adb5bd;
    color: #212529;
  }

  .matchup {
    display: grid;
    grid-template-columns: 1fr auto 1fr;
  align-items: stretch;
  gap: 0;
  }

  .team {
    display: flex;
    flex-direction: row;
    justify-content: space-between;
    align-items: center;
    padding: .5rem .75rem;
    border-radius: 6px;
    gap: .75rem;
    transition: background .2s ease;
  }
  .team.away-team { border-top-right-radius: 0; border-bottom-right-radius: 0; }
  .team.home-team { border-top-left-radius: 0; border-bottom-left-radius: 0; }

  .team-left { display: flex; align-items: center; gap: .5rem; }
  .team-logo { width: 40px; height: 40px; object-fit: contain; filter: drop-shadow(0 1px 1px rgba(0,0,0,.4)); }

  .team-text { display:flex; flex-direction:column; line-height:1.05; }
  .team-abbr { font-weight:600; font-size:.95rem; }
  .team-full { font-size:.65rem; opacity:.85; text-transform:uppercase; letter-spacing:.5px; }

  .team-score {
    font-size: 1.4rem;
    font-weight: 700;
    color: #cfe8ff; /* light blue from palette */
    min-width: 2ch;
    text-align: right;
    text-shadow: 
      -1px -1px 0 #000,
      1px -1px 0 #000,
      -1px 1px 0 #000,
      1px 1px 0 #000,
      0 0 4px #000;
    letter-spacing: .5px;
  }

  .vs {
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: .9rem;
    padding: .25rem .6rem;
    color: var(--color-text-tertiary, #6c757d);
    background: var(--color-surface-tertiary, #e9ecef);
    border-radius: 0;
    border-top: 1px solid var(--color-surface-tertiary, #e9ecef);
    border-bottom: 1px solid var(--color-surface-tertiary, #e9ecef);
  }

  .game-meta { margin-top: .75rem; font-size:.75rem; display:flex; flex-direction:column; gap:.35rem; }
  .game-meta .odds-line span, .game-meta .prob-line span { margin-left:.35rem; }
  .game-meta strong { font-weight:600; }
  .game-meta .divider { opacity:.5; }
  .game-meta .provider { opacity:.6; font-style:italic; }
  .probability-row { 
    display:grid; 
    grid-template-columns: 1fr auto 1fr; 
    align-items:center; 
    margin-top:.4rem; 
    font-size:.7rem; 
    font-weight:600; 
    letter-spacing:.5px;
  }
  .probability-row .pct { text-align:center; }
  .probability-row .label { padding:0 .5rem; font-weight:500; opacity:.7; font-size:.65rem; text-transform:uppercase; }

  /* Dark mode overrides */
  :global(.dark) .game-card { background: var(--color-surface-secondary, #1f2937); border-color: var(--color-surface-tertiary, #374151); box-shadow: 0 2px 4px rgba(0,0,0,0.4); }
  :global(.dark) .game-header { border-bottom-color: var(--color-surface-tertiary, #374151); }
  :global(.dark) .game-date { color: var(--color-text-tertiary, #9ca3af); }
  :global(.dark) .game-status { background: var(--color-surface-tertiary, #374151); color: var(--color-text-secondary, #e5e7eb); }
  :global(.dark) .game-status.not-started { background: #4b5563; color: var(--color-text-secondary, #e5e7eb); }
  :global(.dark) .vs { background: var(--color-surface-tertiary, #374151); color: var(--color-text-tertiary, #9ca3af); border-top-color: var(--color-surface-tertiary, #374151); border-bottom-color: var(--color-surface-tertiary, #374151); }
  :global(.dark) .game-meta .provider { opacity:.7; }
  :global(.dark) .probability-row .label { opacity:.6; }

  @media (max-width: 600px) {
    .team {
      flex-direction: column;
      align-items: flex-start;
    }
    .team-score { align-self: flex-end; }
    .matchup { grid-template-columns: 1fr; }
    .vs { display: none; }
  }
</style>