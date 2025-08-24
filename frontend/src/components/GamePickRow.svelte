<script>
  import { createEventDispatcher } from 'svelte';
  import GamePickRow from '../designsystem/components/GamePickRow.svelte';

  // Re-export all props for backward compatibility
  export let game;
  export let draft = {};
  export let totalGames = 0;
  export let isSorted = false;
  export let focusGameId = null;
  export let cleared = false;

  const dispatch = createEventDispatcher();

  function handleToggleWinner(event) {
    dispatch('toggleWinner', event.detail);
  }

  function handleAssignConfidence(event) {
    dispatch('assignConfidence', event.detail);
  }

  function handleClearPick(event) {
    dispatch('clearPick', event.detail);
  }
</script>

<!-- Delegate to design system component -->
<GamePickRow 
  {game} 
  {draft} 
  {totalGames}
  {isSorted}
  {focusGameId}
  {cleared}
  on:toggleWinner={handleToggleWinner}
  on:assignConfidence={handleAssignConfidence}
  on:clearPick={handleClearPick} />
