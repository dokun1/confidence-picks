<script>
  import { onMount } from 'svelte';
  import Button from '../designsystem/components/Button.svelte';
  import { getClosestWeek, getPicks, savePicks, clearPicks, getScoreboard } from '../lib/picksService.js';
  import GamePickRow from './GamePickRow.svelte';
  import InlineToast from '../designsystem/components/InlineToast.svelte';

  export let groupIdentifier;
  let season = new Date().getFullYear();
  let seasonType = 2; // Regular
  let week = null;

  let loading = false;
  let saving = false;
  let clearing = false;
  let error = '';
  let showErrorToast = false;
  let lastRefreshed = null;
  let autoRefreshInterval = null;

  let games = []; // server payload games
  let availableConfidences = [];
  let totalGames = 0;
  let weekPoints = 0;

  // draft state: { [gameId]: { pickedTeamId, confidence } }
  let draft = {};
  let original = {};

  let showScoreboard = false;
  let scoreboard = null;
  let loadingScoreboard = false;
  // For auto-scroll focus when a confidence value is overridden
  let focusGameId = null;

  const TOTAL_WEEKS = 18; // reg season (weeks 1..18) plus we expose week 0 (preseason final)

  function isDirty() { return JSON.stringify(draft) !== JSON.stringify(original); }
  function completePicks() { return Object.values(draft).filter(p => p.pickedTeamId && p.confidence != null); }
  function hasIncomplete() { return Object.values(draft).some(p => (p.pickedTeamId && p.confidence == null) || (!p.pickedTeamId && p.confidence != null)); }
  let canSaveValue = false;
  function recalcCanSave() { canSaveValue = completePicks().length > 0 && !saving; }
  function incompleteCount() { return Object.values(draft).filter(p => (p.pickedTeamId && p.confidence == null) || (!p.pickedTeamId && p.confidence != null)).length; }

  async function initWeek() {
    loading = true; error='';
    try {
    if (week == null) {
        try {
          const cw = await getClosestWeek(groupIdentifier, season, seasonType);
          week = cw.week;
        } catch (e) {
          // fallback to week 1 if endpoint fails
      if (week == null) week = 0; // allow week 0 fallback
          raiseError(e.message);
        }
      }
  // Fetch even for week 0 (previously skipped due to falsy check)
  if (week !== null && week !== undefined) await fetchPicks();
    } catch (e) { error = e.message; } finally { loading=false; }
  }

  async function fetchPicks() {
    const data = await getPicks(groupIdentifier, { season, seasonType, week });
    games = data.games;
    availableConfidences = data.availableConfidences;
    totalGames = data.totalGames;
    weekPoints = data.weekPoints;
    original = {};
    for (const g of games) {
      if (g.pick && (g.pick.pickedTeamId != null || g.pick.confidence != null)) {
        original[g.id] = { pickedTeamId: g.pick.pickedTeamId != null ? Number(g.pick.pickedTeamId) : null, confidence: g.pick.confidence };
      }
    }
    draft = JSON.parse(JSON.stringify(original));
    recalcCanSave();
    lastRefreshed = new Date();
  }

  function raiseError(msg) {
    error = msg; showErrorToast = false; requestAnimationFrame(()=> showErrorToast = true); setTimeout(()=> showErrorToast = false, 4000);
  }

  function toggleWinner(game, teamId) {
    if (game.meta.locked) { raiseError('Game is locked'); return; }
    const gState = draft[game.id] || {};
    const teamNum = Number(teamId);
    if (Number(gState.pickedTeamId) === teamNum) {
      // deselect (only if no confidence assigned)
      if (gState.confidence == null) delete draft[game.id];
      else { gState.pickedTeamId = null; }
    } else {
      gState.pickedTeamId = teamNum;
      draft[game.id] = gState;
    }
    // Remove incomplete placeholder lacking both fields
    if (draft[game.id] && !draft[game.id].pickedTeamId && draft[game.id].confidence == null) delete draft[game.id];
    // force reactivity
    draft = { ...draft };
    recalcCanSave();
  }

  function assignConfidence(game, value) {
    if (game.meta.locked) { raiseError('Game is locked'); return; }
    if (Number.isNaN(value)) value = null;
    // Normalize numeric value (binding may supply string)
    if (typeof value === 'string' && value !== '') value = parseInt(value, 10);
    // If selecting same confidence already set, no-op
    const gState = draft[game.id] || {};
    if (gState.confidence === value) return;
    let overriddenGameId = null;
    // Release any other game's use of this confidence (override)
    if (value != null) {
      for (const gid of Object.keys(draft)) {
        if (parseInt(gid) !== game.id && draft[gid].confidence === value) {
          draft[gid].confidence = null; // remove confidence but keep winner so user can reassign
          overriddenGameId = parseInt(gid);
        }
      }
      // Clean up any placeholder that lost both winner and confidence
      if (overriddenGameId && draft[overriddenGameId] && !draft[overriddenGameId].pickedTeamId && draft[overriddenGameId].confidence == null) {
        delete draft[overriddenGameId];
      }
    }
    gState.confidence = value;
    // ensure object exists even if winner not picked yet
    if (!gState.pickedTeamId) {
      // nothing else
    }
    draft[game.id] = gState;
  // If confidence cleared and no winner, remove entire draft entry; if winner exists keep as incomplete so it appears unsorted
  if (value == null && gState.pickedTeamId == null) delete draft[game.id];
    // force reactivity
    draft = { ...draft };
    recalcCanSave();
    console.debug('assignConfidence -> game', game.id, 'value', value, 'draft', draft);
    if (overriddenGameId != null) {
      // trigger auto-scroll highlight
      focusGameId = overriddenGameId;
      // clear after short delay to allow repeated focus events on same game
      setTimeout(()=> { if (focusGameId === overriddenGameId) focusGameId = null; }, 2500);
    }
  }

  async function doSave() {
    saving = true; error=''; recalcCanSave();
    try {
      const picksPayload = Object.entries(draft)
        .filter(([_, val]) => val.pickedTeamId && val.confidence != null)
        .map(([gameId, val]) => ({ gameId: parseInt(gameId), pickedTeamId: val.pickedTeamId, confidence: val.confidence }));
      const data = await savePicks(groupIdentifier, { season, seasonType, week, picks: picksPayload });
      games = data.games; availableConfidences = data.availableConfidences; totalGames = data.totalGames; weekPoints = data.weekPoints;
      original = {}; for (const g of games) if (g.pick) original[g.id] = { pickedTeamId: g.pick.pickedTeamId, confidence: g.pick.confidence };
      draft = JSON.parse(JSON.stringify(original));
      recalcCanSave();
      lastRefreshed = new Date();
    } catch(e) { error = e.message; } finally { saving=false; recalcCanSave(); }
  }

  async function doClear() {
    clearing = true; error=''; recalcCanSave();
    try {
      await clearPicks(groupIdentifier, { season, seasonType, week });
      await fetchPicks();
    } catch(e) { error=e.message; } finally { clearing=false; recalcCanSave(); }
  }

  async function loadScoreboard() {
    loadingScoreboard = true; error='';
    try { scoreboard = await getScoreboard(groupIdentifier, { season, seasonType }); }
    catch(e){ error=e.message; } finally { loadingScoreboard=false; }
  }

  $: if (showScoreboard && !scoreboard && !loadingScoreboard) loadScoreboard();

  // Reactive derived lists for rendering
  $: sortedGames = games
    .filter(g => {
      const d = draft[g.id];
      const fallback = (g.pick && (g.pick.pickedTeamId != null && g.pick.confidence != null))
        ? { pickedTeamId: Number(g.pick.pickedTeamId), confidence: g.pick.confidence }
        : null;
      const eff = (d && d.pickedTeamId && d.confidence != null) ? d : fallback;
      return eff && eff.pickedTeamId && eff.confidence != null;
    })
    .sort((a,b) => {
      const da = draft[a.id];
      const db = draft[b.id];
      const aConf = (da && da.confidence != null) ? da.confidence : (a.pick ? a.pick.confidence : 0);
      const bConf = (db && db.confidence != null) ? db.confidence : (b.pick ? b.pick.confidence : 0);
      return bConf - aConf;
    });
  $: unsortedGames = games.filter(g => !sortedGames.includes(g));
  $: console.debug('derived lists -> sorted', sortedGames.length, 'unsorted', unsortedGames.length);

  function gameWinnerClass(game, teamId) {
    const pick = draft[game.id];
    return pick?.pickedTeamId === teamId ? 'selected' : '';
  }

  function ensureAutoRefresh() {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    if (games.some(g => !g.meta.final)) {
      autoRefreshInterval = setInterval(async () => {
        try { await fetchPicks(); } catch(_) {}
      }, 60000);
    }
  }

  onMount(() => {
    initWeek();
    return () => { if (autoRefreshInterval) clearInterval(autoRefreshInterval); };
  });

  $: console.debug('debug picksPanel -> draft', draft, 'complete', completePicks().length, 'canSave', canSaveValue);
</script>

<div class="space-y-lg">
  <div class="flex flex-wrap items-end gap-sm">
    <div>
  <select id="week-select" bind:value={week} on:change={() => { week = Number(week); fetchPicks(); }} class="px-sm py-xs border rounded bg-neutral-0 dark:bg-secondary-800" aria-label="Select week">
        <option value={0}>Week 0 (Preseason)</option>
        {#each Array(TOTAL_WEEKS) as _, i}
          <option value={i+1}>Week {i+1}</option>
        {/each}
      </select>
    </div>
    <Button variant="tertiary" size="sm" on:click={fetchPicks}>Refresh</Button>
    <div class="ml-auto flex gap-sm">
      <div class="flex flex-col items-start gap-1">
        <button class="inline-flex items-center px-xs py-xxxs rounded-sm text-sm font-medium bg-primary-500 text-neutral-0 disabled:bg-primary-300 disabled:text-primary-100"
          disabled={!canSaveValue || saving}
          on:click={() => { if (canSaveValue && !saving) doSave(); }} aria-disabled={!canSaveValue || saving}>
          {saving ? 'Saving…' : 'Save Picks'}
        </button>
      </div>
      <Button variant="tertiary" size="sm" disabled={clearing} loading={clearing} on:click={doClear}>Clear</Button>
    </div>
  </div>

  {#if error}
    <div class="p-sm bg-red-100 text-red-700 rounded text-sm">{error}</div>
  {/if}
  <div class="inline-toast-anchor">
    <InlineToast open={showErrorToast} message={error} variant="danger" onClose={() => showErrorToast=false} />
  </div>

  <div class="text-md font-medium">Week Points: {weekPoints}</div>

  {#if showScoreboard}
    {#if loadingScoreboard}
      <div>Loading scoreboard...</div>
    {:else if scoreboard}
      <div class="overflow-auto">
        <table class="min-w-full text-sm">
          <thead>
            <tr class="text-left">
              <th class="p-xs">User</th>
              {#each scoreboard.weeks as w}<th class="p-xs">W{w}</th>{/each}
              <th class="p-xs">Total</th>
            </tr>
          </thead>
          <tbody>
            {#each scoreboard.users as u}
              <tr>
                <td class="p-xs whitespace-nowrap flex items-center gap-xs">
                  <span>{u.name}</span>
                </td>
                {#each scoreboard.weeks as w}
                  <td class="p-xs text-center">{(u.weekly.find(x=>x.week===w) || {}).points || 0}</td>
                {/each}
                <td class="p-xs font-semibold text-center">{u.totalPoints}</td>
              </tr>
            {/each}
          </tbody>
        </table>
      </div>
    {/if}
  {:else}
    <div class="space-y-sm">
      {#if sortedGames.length > 0}
        <h3 class="mt-md text-sm font-semibold tracking-wide uppercase opacity-70">Sorted Picks</h3>
        {#each sortedGames as game (game.id)}
          <GamePickRow {game} {draft} {totalGames} {focusGameId} on:toggleWinner={(e)=>toggleWinner(game,e.detail)} on:assignConfidence={(e)=>assignConfidence(game,e.detail)} />
        {/each}
      {/if}
    </div>
    <div class="space-y-sm mt-lg">
      <h3 class="text-sm font-semibold tracking-wide uppercase opacity-70">Unsorted / Incomplete</h3>
      {#each unsortedGames as game (game.id)}
  <GamePickRow {game} {draft} {totalGames} {focusGameId} on:toggleWinner={(e)=>toggleWinner(game,e.detail)} on:assignConfidence={(e)=>assignConfidence(game,e.detail)} />
      {/each}
      {#if hasIncomplete()}
        <div class="text-xs text-amber-600 dark:text-amber-400 mt-sm">Finish selecting a confidence and winner for highlighted games to enable saving.</div>
      {/if}
    </div>
  {/if}
</div>