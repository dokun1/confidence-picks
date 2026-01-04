<script>
  import { onMount } from 'svelte';
  import Button from '../designsystem/components/Button.svelte';
  import { getClosestWeek, getPicks, savePicks, clearPicks, getScoreboard, getUserPicks, saveUserPicks } from '../lib/picksService.js';
  import { getMyGroups, getMembers } from '../lib/groupsService.js';
  import GamePickRow from './GamePickRow.svelte';
  import InlineToast from '../designsystem/components/InlineToast.svelte';
  import { getCurrentNFLSeason } from '../lib/nflSeasonUtils.js';
  import { auth } from '../lib/authStore.js';

  export let groupIdentifier;
  export let isOwner = false; // Whether current user is group owner
  let season = getCurrentNFLSeason();
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
  // Tracks games explicitly cleared so original server picks aren't used as fallback
  let clearedPicks = new Set();

  // Multi-group save functionality
  let userGroups = [];
  let selectedGroups = new Set();
  let loadingGroups = false;

  // Owner override functionality
  let groupMembers = [];
  let loadingMembers = false;
  let selectedUserId = null; // null means current user, number means override mode
  let showUserSelector = false;
  let showOwnerConfirmDialog = false; // For self-override confirmation
  let pendingSaveAction = null; // Store save action when waiting for confirmation
  let currentUser = null;

  const TOTAL_WEEKS = 18; // regular season weeks 1-18

  function isDirty() { return JSON.stringify(draft) !== JSON.stringify(original); }
  function completePicks() { return Object.values(draft).filter(p => p.pickedTeamId && p.confidence != null); }
  function hasIncomplete() { return Object.values(draft).some(p => (p.pickedTeamId && p.confidence == null) || (!p.pickedTeamId && p.confidence != null)); }
  let canSaveValue = false;
  // Allow save if there is at least one complete pick OR there are cleared picks to persist (so user can remove picks)
  function recalcCanSave() { canSaveValue = (completePicks().length > 0 || clearedPicks.size > 0) && !saving; }
  function incompleteCount() { return Object.values(draft).filter(p => (p.pickedTeamId && p.confidence == null) || (!p.pickedTeamId && p.confidence != null)).length; }

  async function initWeek() {
    loading = true; error='';
    try {
      // Load user's groups for multi-group save feature
      await loadUserGroups();
      
      // Load group members if owner
      if (isOwner) {
        await loadGroupMembers();
      }
      
      // Get current user info
      auth.subscribe(authState => {
        if (authState.user) {
          currentUser = authState.user;
        }
      });
      
    if (week == null) {
        try {
          const cw = await getClosestWeek(groupIdentifier, season, seasonType);
          week = cw.week;
        } catch (e) {
          // fallback to week 1 if endpoint fails
      if (week == null) week = 1; // fallback to week 1
          raiseError(e.message);
        }
      }
  // Fetch even for week 0 (previously skipped due to falsy check)
  if (week !== null && week !== undefined) await fetchPicks();
    } catch (e) { error = e.message; } finally { loading=false; }
  }

  async function loadUserGroups() {
    if (loadingGroups) return;
    loadingGroups = true;
    try {
      userGroups = await getMyGroups();
      // Initialize with current group selected
      selectedGroups = new Set([groupIdentifier]);
    } catch (e) {
      console.warn('Failed to load user groups:', e);
      userGroups = [];
    } finally {
      loadingGroups = false;
    }
  }

  async function loadGroupMembers() {
    if (loadingMembers) return;
    loadingMembers = true;
    try {
      groupMembers = await getMembers(groupIdentifier);
    } catch (e) {
      console.warn('Failed to load group members:', e);
      groupMembers = [];
    } finally {
      loadingMembers = false;
    }
  }

  async function fetchPicks() {
    // If in override mode, fetch picks for selected user
    if (selectedUserId !== null) {
      const data = await getUserPicks(groupIdentifier, selectedUserId, { season, seasonType, week });
      games = data.games;
      applyWeekSpecificFilters();
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
      return;
    }
    
    // Normal mode - fetch current user's picks
    const data = await getPicks(groupIdentifier, { season, seasonType, week });
  console.debug('[PicksPanel] fetchPicks response', { groupIdentifier, season, seasonType, week, gameCount: data.games.length, available: data.availableConfidences, total: data.totalGames, weekPoints: data.weekPoints });
  games = data.games;
  applyWeekSpecificFilters();
    availableConfidences = data.availableConfidences;
    console.log("totalGames: "+ totalGames);
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

  function applyWeekSpecificFilters() {
    // Apply persistent week-specific filtering rules every time we set games.
    // No special filtering needed for regular season weeks
  }

  function raiseError(msg) {
    error = msg; showErrorToast = false; requestAnimationFrame(()=> showErrorToast = true); setTimeout(()=> showErrorToast = false, 4000);
  }

  function toggleWinner(game, teamId) {
    if (game.meta.locked) { raiseError('Game is locked'); return; }
  clearedPicks.delete(game.id);
  console.debug('[PicksPanel] toggleWinner start', { gameId: game.id, teamId, before: draft[game.id] });
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
  console.debug('[PicksPanel] toggleWinner end', { gameId: game.id, after: draft[game.id] });
  }

  function assignConfidence(game, value) {
    if (game.meta.locked) { raiseError('Game is locked'); return; }
  clearedPicks.delete(game.id);
  console.debug('[PicksPanel] assignConfidence start', { gameId: game.id, incoming: value, before: draft[game.id] });
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
  console.debug('[PicksPanel] assignConfidence end', { gameId: game.id, after: draft[game.id] });
    if (overriddenGameId != null) {
      // trigger auto-scroll highlight
      focusGameId = overriddenGameId;
      // clear after short delay to allow repeated focus events on same game
      setTimeout(()=> { if (focusGameId === overriddenGameId) focusGameId = null; }, 2500);
    }
  }

  async function doSave() {
    // Check if owner is saving their own picks in override mode (needs confirmation)
    if (isOwner && selectedUserId === currentUser?.id && hasLockedGames()) {
      // Show confirmation dialog
      pendingSaveAction = () => doSaveInternal();
      showOwnerConfirmDialog = true;
      return;
    }
    
    await doSaveInternal();
  }
  
  function hasLockedGames() {
    // Check if any of the picks being saved are for locked games
    return Object.entries(draft).some(([gameId, val]) => {
      if (!val.pickedTeamId || val.confidence == null) return false;
      const game = games.find(g => g.id === parseInt(gameId));
      return game && game.status !== 'SCHEDULED';
    });
  }
  
  async function confirmOwnerOverride() {
    showOwnerConfirmDialog = false;
    if (pendingSaveAction) {
      await pendingSaveAction();
      pendingSaveAction = null;
    }
  }
  
  function cancelOwnerOverride() {
    showOwnerConfirmDialog = false;
    pendingSaveAction = null;
  }

  async function doSaveInternal() {
    saving = true; error=''; recalcCanSave();
    try {
      const picksPayload = Object.entries(draft)
        .filter(([_, val]) => val.pickedTeamId && val.confidence != null)
        .map(([gameId, val]) => ({ gameId: parseInt(gameId), pickedTeamId: val.pickedTeamId, confidence: val.confidence }));
      const clearedGameIds = Array.from(clearedPicks);
    console.debug('[PicksPanel] doSave start', { week, season, seasonType, picksPayload, clearedGameIds, draft, selectedGroups: Array.from(selectedGroups), selectedUserId });
      
      // If in override mode, save for the selected user
      if (selectedUserId !== null) {
        const result = await saveUserPicks(groupIdentifier, selectedUserId, { season, seasonType, week, picks: picksPayload, clearedGameIds });
        console.debug('[PicksPanel] doSave override response');
        games = result.games; applyWeekSpecificFilters();
        availableConfidences = result.availableConfidences; totalGames = result.totalGames; weekPoints = result.weekPoints;
        original = {}; for (const g of games) if (g.pick) original[g.id] = { pickedTeamId: g.pick.pickedTeamId, confidence: g.pick.confidence };
        draft = JSON.parse(JSON.stringify(original));
        clearedPicks.clear();
        recalcCanSave();
        lastRefreshed = new Date();
        return;
      }
      
      // Normal mode - save to selected groups
      const groupsToSave = selectedGroups.size === 0 ? [groupIdentifier] : Array.from(selectedGroups);
      
      let lastResult = null;
      
      // Save to each selected group
      for (const groupId of groupsToSave) {
        try {
          const result = await savePicks(groupId, { season, seasonType, week, picks: picksPayload, clearedGameIds });
          // Use the result from the current group for UI updates
          if (groupId === groupIdentifier) {
            lastResult = result;
          }
        } catch (e) {
          // If saving to current group fails, throw error. For other groups, just log warning
          if (groupId === groupIdentifier) {
            throw e;
          } else {
            console.warn(`Failed to save picks to group ${groupId}:`, e);
            const groupName = userGroups.find(g => g.identifier === groupId)?.name || groupId;
            raiseError(`Warning: Failed to save to ${groupName}`);
          }
        }
      }

      // Update UI with current group's data
      if (lastResult) {
        console.debug('[PicksPanel] doSave response', { games: lastResult.games.map(g => ({ id:g.id, pick:g.pick ? { conf:g.pick.confidence, team:g.pick.pickedTeamId } : null })), availableConfidences: lastResult.availableConfidences });
        games = lastResult.games; applyWeekSpecificFilters();
        availableConfidences = lastResult.availableConfidences; totalGames = lastResult.totalGames; weekPoints = lastResult.weekPoints;
        original = {}; for (const g of games) if (g.pick) original[g.id] = { pickedTeamId: g.pick.pickedTeamId, confidence: g.pick.confidence };
        draft = JSON.parse(JSON.stringify(original));
        clearedPicks.clear();
        recalcCanSave();
        lastRefreshed = new Date();
      }
      
      // Close group selector after successful save
      showGroupSelector = false;
      
    } catch(e) { 
      error = e.message; 
    } finally { 
      saving=false; 
      recalcCanSave(); 
    }
  }

  async function changeSelectedUser(userId) {
    // userId can be null (current user) or a number (other user)
    selectedUserId = userId;
    showUserSelector = false;
    
    // Clear current draft and fetch picks for selected user
    draft = {};
    original = {};
    clearedPicks.clear();
    
    await fetchPicks();
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
  function handleClearPick(game) {
    if (draft[game.id]) {
      delete draft[game.id];
      draft = { ...draft };
    }
    clearedPicks.add(game.id);
    recalcCanSave();
  }

  $: sortedGames = games
    .filter(g => {
      if (clearedPicks.has(g.id)) return false;
      const d = draft[g.id];
      const fallback = (!clearedPicks.has(g.id) && g.pick && (g.pick.pickedTeamId != null && g.pick.confidence != null))
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
  $: weekGameCount = games.length;
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

  // Expose reactive state to parent via bindings
  export let canSave = false; // bound by parent (read-only external)
  export let savingState = false;
  export let clearingState = false;
  export let hasSortedPicks = false; // exposed to parent for Clear All enable logic
  export let hasMultipleGroups = false; // exposed to parent for multi-group UI
  export let showGroupSelector = false; // exposed to parent for dropdown visibility
  export let currentWeek = null; // exposed to parent for clear dialog message
  $: canSave = canSaveValue;
  $: savingState = saving;
  $: clearingState = clearing;
  $: hasSortedPicks = sortedGames.length > 0;
  $: hasMultipleGroups = userGroups && userGroups.length > 1;
  $: currentWeek = week;

  // Expose imperative actions for parent sticky bar
  export function savePicksAction() { if (canSaveValue && !saving) doSave(); }
  export function clearAllAction() { if (!clearing) doClear(); }
  export function toggleGroupSelector() { 
    if (hasMultipleGroups) {
      showGroupSelector = !showGroupSelector; 
    }
  }
  export function selectAllGroups() {
    if (userGroups) {
      userGroups.forEach(group => selectedGroups.add(group.identifier));
      selectedGroups = selectedGroups; // Trigger reactivity
    }
  }
  export function deselectAllGroups() {
    selectedGroups.clear();
    selectedGroups = selectedGroups; // Trigger reactivity
  }
  export function getSelectedGroupsInfo() {
    return {
      count: selectedGroups.size,
      names: userGroups ? userGroups.filter(g => selectedGroups.has(g.identifier)).map(g => g.name) : []
    };
  }
</script>

<div class="space-y-lg">
  <!-- Week selection & refresh (Save/Clear moved to sticky parent bar) -->
  <div class="flex flex-wrap items-end gap-sm picks-controls-internal">
    <div>
      <select id="week-select" bind:value={week} on:change={() => { week = Number(week); fetchPicks(); }} class="px-sm py-xs border rounded bg-neutral-0 dark:bg-secondary-800" aria-label="Select week">
        {#each Array(TOTAL_WEEKS) as _, i}
          <option value={i+1}>Week {i+1}</option>
        {/each}
      </select>
    </div>
    
    <!-- Owner: User Selector -->
    {#if isOwner && groupMembers.length > 0}
      <div class="relative">
        <button 
          on:click={() => showUserSelector = !showUserSelector}
          class="px-sm py-xs border rounded bg-neutral-0 dark:bg-secondary-800 hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors flex items-center gap-xs"
          aria-label="Select user to edit picks"
        >
          {#if selectedUserId === null}
            <span>Your Picks</span>
          {:else}
            <span>Editing: {groupMembers.find(m => m.id === selectedUserId)?.name || 'User'}</span>
          {/if}
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
          </svg>
        </button>
        
        {#if showUserSelector}
          <!-- svelte-ignore a11y-click-events-have-key-events -->
          <!-- svelte-ignore a11y-no-static-element-interactions -->
          <div class="fixed inset-0 z-40" on:click={() => showUserSelector = false}></div>
          <div class="absolute left-0 top-full mt-2 w-64 bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 rounded-lg shadow-lg z-50 max-h-80 overflow-y-auto">
            <!-- svelte-ignore a11y-click-events-have-key-events -->
            <!-- svelte-ignore a11y-no-static-element-interactions -->
            <div on:click|stopPropagation>
              <div class="p-2 border-b border-gray-200 dark:border-secondary-700">
                <button
                  on:click={() => changeSelectedUser(null)}
                  class="w-full text-left px-3 py-2 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors {selectedUserId === null ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium' : ''}"
                >
                  Your Picks
                </button>
              </div>
              <div class="p-2">
                <div class="text-xs font-semibold text-gray-500 dark:text-gray-400 px-3 py-1 uppercase tracking-wide">
                  Edit Other Users
                </div>
                {#each groupMembers as member}
                  <button
                    on:click={() => changeSelectedUser(member.id)}
                    class="w-full text-left px-3 py-2 rounded hover:bg-secondary-100 dark:hover:bg-secondary-700 transition-colors {selectedUserId === member.id ? 'bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 font-medium' : ''}"
                  >
                    {member.name}
                  </button>
                {/each}
              </div>
            </div>
          </div>
        {/if}
      </div>
    {/if}
    
    <Button variant="tertiary" size="sm" on:click={fetchPicks}>Refresh</Button>
  </div>
  
  <!-- Owner Override Warning -->
  {#if selectedUserId !== null}
    <div class="p-sm bg-amber-100 dark:bg-amber-900 text-amber-900 dark:text-amber-100 rounded text-sm flex items-start gap-sm">
      <svg class="w-5 h-5 flex-shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
      </svg>
      <div>
        <strong>Owner Override Mode:</strong> You are editing picks for <strong>{groupMembers.find(m => m.id === selectedUserId)?.name || 'another user'}</strong>. You can override picks even after games have started or finished.
      </div>
    </div>
  {/if}

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
          <GamePickRow {game} {draft} totalGames={weekGameCount} isSorted={true} {focusGameId} cleared={clearedPicks.has(game.id)} on:toggleWinner={(e)=>toggleWinner(game,e.detail)} on:assignConfidence={(e)=>assignConfidence(game,e.detail)} on:clearPick={() => handleClearPick(game)} />
        {/each}
      {/if}
    </div>
    <div class="space-y-sm mt-lg">
      <h3 class="text-sm font-semibold tracking-wide uppercase opacity-70">Unsorted / Incomplete</h3>
    {#each unsortedGames as game (game.id)}
      <GamePickRow {game} {draft} totalGames={weekGameCount} isSorted={false} {focusGameId} cleared={clearedPicks.has(game.id)} on:toggleWinner={(e)=>toggleWinner(game,e.detail)} on:assignConfidence={(e)=>assignConfidence(game,e.detail)} on:clearPick={() => { if (!game.meta.locked) handleClearPick(game); }} />
      {/each}
      {#if hasIncomplete()}
        <div class="text-xs text-amber-600 dark:text-amber-400 mt-sm">Finish selecting a confidence and winner for highlighted games to enable saving.</div>
      {/if}
    </div>
  {/if}

  <!-- Group selector dropdown (positioned relative to parent save button) -->
  {#if showGroupSelector && userGroups && userGroups.length > 1}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="fixed inset-0 z-40" on:click={() => showGroupSelector = false}></div>
    <div class="fixed top-20 right-4 w-80 bg-white dark:bg-secondary-800 border border-gray-200 dark:border-secondary-700 rounded-lg shadow-lg z-50">
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="p-4" on:click|stopPropagation>
        <h3 class="text-sm font-medium text-gray-900 dark:text-neutral-0 mb-3">Save picks to groups:</h3>
        
        <!-- Group checkboxes -->
        <div class="space-y-3 mb-4 max-h-48 overflow-y-auto">
          {#each userGroups as group}
            <label class="flex items-center space-x-3 cursor-pointer">
              <input 
                type="checkbox" 
                checked={selectedGroups.has(group.identifier)}
                on:change={(e) => {
                  if (e.target.checked) {
                    selectedGroups.add(group.identifier);
                  } else {
                    selectedGroups.delete(group.identifier);
                  }
                  selectedGroups = selectedGroups; // Trigger reactivity
                }}
                class="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 focus:ring-2"
              />
              <span class="text-sm text-gray-700 dark:text-neutral-200">{group.name}</span>
              {#if group.identifier === groupIdentifier}
                <span class="text-xs text-blue-600 dark:text-blue-400">(current)</span>
              {/if}
            </label>
          {/each}
        </div>
        
        <!-- Action buttons -->
        <div class="flex flex-col space-y-2">
          <Button 
            variant="primary" 
            size="md" 
            disabled={!canSave || saving || selectedGroups.size === 0}
            on:click={savePicksAction}
            class="w-full flex h-10"
          >
            {saving ? 'Saving…' : `Save to ${selectedGroups.size} group${selectedGroups.size === 1 ? '' : 's'}`}
          </Button>
          
          <Button 
            variant="secondary" 
            size="md" 
            disabled={saving}
            on:click={selectAllGroups}
            class="w-full flex h-10"
          >
            Select All
          </Button>
          
          <Button 
            variant="destructive" 
            size="md" 
            disabled={saving}
            on:click={deselectAllGroups}
            class="w-full flex h-10"
          >
            Deselect All
          </Button>
        </div>
      </div>
    </div>
  {/if}
  
  <!-- Owner Self-Override Confirmation Dialog -->
  {#if showOwnerConfirmDialog}
    <!-- svelte-ignore a11y-click-events-have-key-events -->
    <!-- svelte-ignore a11y-no-static-element-interactions -->
    <div class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" on:click={cancelOwnerOverride}>
      <!-- svelte-ignore a11y-click-events-have-key-events -->
      <!-- svelte-ignore a11y-no-static-element-interactions -->
      <div class="bg-white dark:bg-secondary-800 rounded-lg shadow-xl max-w-md w-full mx-4 p-6" on:click|stopPropagation>
        <div class="flex items-start gap-4 mb-4">
          <div class="flex-shrink-0">
            <svg class="w-8 h-8 text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path>
            </svg>
          </div>
          <div class="flex-1">
            <h3 class="text-lg font-semibold text-gray-900 dark:text-neutral-0 mb-2">
              Confirm Owner Override
            </h3>
            <p class="text-sm text-gray-600 dark:text-gray-300 mb-4">
              You are about to override your own picks after games have been locked or completed. This action should only be used to correct submission issues. Are you sure you want to proceed?
            </p>
            <div class="flex gap-3 justify-end">
              <Button variant="tertiary" size="md" on:click={cancelOwnerOverride}>
                Cancel
              </Button>
              <Button variant="primary" size="md" on:click={confirmOwnerOverride}>
                Confirm Override
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  {/if}
</div>