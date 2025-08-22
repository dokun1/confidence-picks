<script>
  import { createEventDispatcher } from 'svelte';
  import Button from '../designsystem/components/Button.svelte';
  export let game;
  export let draft;
  export let totalGames = 0;
  export let isSorted = false; // passed from parent to allow full range selection
  export let focusGameId = null; // when this game's id matches, auto focus/scroll
  export let cleared = false; // when true, ignore original server pick fallback

  const dispatch = createEventDispatcher();
  $: pick = (() => {
    // If row is marked cleared, only consider draft (which will usually be undefined) and never fall back to server pick
    if (cleared) return draft[game.id] || null;
    
    // For final games, merge draft with server pick to get all properties (won, points, etc.)
    if (game.meta?.final && game.pick) {
      const draftPick = draft[game.id];
      return {
        pickedTeamId: (draftPick?.pickedTeamId ?? game.pick.pickedTeamId) != null ? Number(draftPick?.pickedTeamId ?? game.pick.pickedTeamId) : null,
        confidence: draftPick?.confidence ?? game.pick.confidence,
        points: game.pick.points,
        won: game.pick.won
      };
    }
    
    // For non-final games, use draft or fallback to server pick
    return draft[game.id] || (game.pick && (game.pick.pickedTeamId != null || game.pick.confidence != null)
      ? { pickedTeamId: game.pick.pickedTeamId != null ? Number(game.pick.pickedTeamId) : null, confidence: game.pick.confidence, points: game.pick.points, won: game.pick.won }
      : null);
  })();
  $: awayTeamId = Number(game.awayTeam.id);
  $: homeTeamId = Number(game.homeTeam.id);
  $: pickTeamId = pick?.pickedTeamId != null ? Number(pick.pickedTeamId) : null;
  $: awaySelected = pickTeamId != null && pickTeamId === awayTeamId;
  $: homeSelected = pickTeamId != null && pickTeamId === homeTeamId;
  $: final = game.meta.final;
  $: winnerTeamId = final ? (game.homeScore > game.awayScore ? game.homeTeam.id : game.awayScore > game.homeScore ? game.awayTeam.id : null) : null;
  $: pickWon = final && pick?.won === true;
  $: pickLost = final && pick?.won === false;
  $: incomplete = pick && !(pick.pickedTeamId && pick.confidence != null);
  let localConfidence = '';
  let showPicker = false;
  // Sync down only when pick has a definite confidence value; never forcibly clear user's in-progress selection.
  $: if (pick && pick.confidence != null && String(pick.confidence) !== localConfidence) {
    localConfidence = String(pick.confidence);
  }

  function chooseConfidence(val) {
    const parsed = val == null ? null : parseInt(val, 10);
    localConfidence = parsed == null ? '' : String(parsed);
    dispatch('assignConfidence', parsed);
    showPicker = false;
  }

  // Build allowed confidence options.
  // If this game currently has both a pickedTeamId and confidence (complete), offer ALL values (user may override another game).
  // Otherwise restrict to unused numbers (plus this game's current one if present).
  $: completePick = pick && pick.pickedTeamId && pick.confidence != null;
  $: usedConfidences = new Set(
    Object.entries(draft)
      .filter(([gid, val]) => val && val.confidence != null && parseInt(gid) !== game.id)
      .map(([_, val]) => val.confidence)
  );
  // Always cap to totalGames; if this pick is complete allow full range for reassignment, else only unused numbers (plus its current one)
  $: allowedConfidences = (() => {
    console.log("allowed confidences: " + totalGames);
    const full = Array.from({ length: totalGames }, (_, i) => i + 1);
    // If currently a complete pick OR rendered in sorted list, allow full range (user can override others)
    if (completePick || isSorted) return full;
    return full.filter(n => !usedConfidences.has(n) || (pick && pick.confidence === n));
  })();

  function select(teamId) { dispatch('toggleWinner', Number(teamId)); }
  function setConfidence(n) { dispatch('assignConfidence', n); }
  function clearConfidence() {
    // Clear both confidence and winner entirely; parent will remove draft entry and mark cleared set
    localConfidence = '';
    dispatch('clearPick');
    showPicker = false;
  }
  function onTeamKey(e, teamId) {
    if (['Enter',' '].includes(e.key)) { e.preventDefault(); select(teamId); }
    if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      const otherId = teamId === game.homeTeam.id ? game.awayTeam.id : game.homeTeam.id;
      e.preventDefault(); select(otherId);
    }
  }

  function deriveStatus() {
    switch (game.status) {
      case 'FINAL': return 'final';
      case 'IN_PROGRESS': return 'in progress';
      default: return 'not started';
    }
  }
  $: statusLabel = deriveStatus();

  function formatGameDate(dateString) {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric', hour:'numeric', minute:'2-digit' });
  }

  function readableTextColor(hex) {
    if (!hex) return '#000';
    const clean = hex.replace('#','');
    if (clean.length !== 6) return '#000';
    const r = parseInt(clean.substring(0,2),16);
    const g = parseInt(clean.substring(2,4),16);
    const b = parseInt(clean.substring(4,6),16);
    const lum = (0.2126*r + 0.7152*g + 0.0722*b)/255;
    return lum > 0.6 ? '#000' : '#fff';
  }
  function teamStyle(team) {
    const bg = team.color ? `#${team.color.replace('#','')}` : 'var(--color-surface-tertiary,#f1f3f5)';
    const color = team.color ? readableTextColor(team.color) : 'var(--color-text-primary,#111)';
    return `background:${bg};color:${color}`;
  }

  // Auto-scroll & focus when this game loses a confidence value due to override.
  $: if (focusGameId === game.id) {
    // run after DOM update
    setTimeout(() => {
      const el = document.getElementById('game-row-' + game.id);
      if (el) {
        el.scrollIntoView({ behavior:'smooth', block:'center' });
        el.classList.add('focus-pulse');
        setTimeout(()=> el.classList.remove('focus-pulse'), 2000);
      }
    }, 30);
  }
</script>

<div class="game-card pick-card {incomplete ? 'incomplete' : ''}" data-final={final} id={'game-row-'+game.id}>
  <div class="game-header">
    <span class="game-date">{formatGameDate(game.gameDate)}</span>
    <div class="header-right">
      <span class="game-status {statusLabel.replace(/\s/g,'-')}">
      {#if statusLabel === 'in progress'}
        {#if game.displayClock}{game.displayClock} · {/if}
        {#if game.period}Q{game.period}{/if}
      {:else}
        {statusLabel}
      {/if}
      </span>
  {#if !game.meta.locked && statusLabel === 'not started' && (pick?.pickedTeamId != null || pick?.confidence != null)}
        <Button variant="destructive" size="sm" class="clear-inline" on:click={(e)=>{ e.stopPropagation(); clearConfidence(); }}>
          Clear
        </Button>
      {/if}
    </div>
  </div>
  <div class="matchup" role="radiogroup" aria-label="Select winner">
  <div class="team away-team clickable {awaySelected ? 'selected' : ''} {final && winnerTeamId===game.awayTeam.id ? 'winner' : ''} {pickLost && awaySelected ? 'lost' : ''}"
      style={teamStyle(game.awayTeam)}
      role="radio" aria-checked={awaySelected} tabindex="0"
      on:keydown={(e)=>onTeamKey(e, game.awayTeam.id)}
      on:click={() => select(game.awayTeam.id)}>
      {#if pick?.pickedTeamId === game.awayTeam.id}
        <div class="pick-check" aria-label="Picked to win" title="Picked to win">✓</div>
      {/if}
      <div class="team-left">
        {#if game.awayTeam.logo}
          <img class="team-logo" alt={game.awayTeam.abbreviation} src={game.awayTeam.logo} />
        {/if}
        <div class="team-text">
          <span class="team-abbr">{game.awayTeam.abbreviation}</span>
          <span class="team-full">{game.awayTeam.name}</span>
        </div>
      </div>
      <span class="team-score {statusLabel === 'in progress' ? 'neutral' : ''}">{game.awayScore}</span>
    </div>
    <div class="vs">@</div>
    <div class="team home-team clickable {homeSelected ? 'selected' : ''} {final && winnerTeamId===game.homeTeam.id ? 'winner' : ''} {pickLost && homeSelected ? 'lost' : ''}"
      style={teamStyle(game.homeTeam)}
      role="radio" aria-checked={homeSelected} tabindex="0"
      on:keydown={(e)=>onTeamKey(e, game.homeTeam.id)}
      on:click={() => select(game.homeTeam.id)}>
      {#if pick?.pickedTeamId === game.homeTeam.id}
        <div class="pick-check" aria-label="Picked to win" title="Picked to win">✓</div>
      {/if}
      <div class="team-left">
        {#if game.homeTeam.logo}
          <img class="team-logo" alt={game.homeTeam.abbreviation} src={game.homeTeam.logo} />
        {/if}
        <div class="team-text">
          <span class="team-abbr">{game.homeTeam.abbreviation}</span>
          <span class="team-full">{game.homeTeam.name}</span>
        </div>
      </div>
  <span class="team-score {statusLabel === 'in progress' ? 'neutral' : ''}">{game.homeScore}</span>
    </div>
    <div class="confidence-wrapper {game.meta.locked ? 'locked-state' : ''}">
      {#if final}
        <!-- Final game: always show a confidence result number (0 if no pick) with win/loss coloring -->
        <div class="final-confidence {pickWon ? 'won' : pickLost ? 'lost' : 'no-pick'}" title={pickWon ? `Won ${(pick?.points ?? pick?.confidence ?? 0)}` : pickLost ? `Lost ${(pick?.points ?? pick?.confidence ?? 0)}` : 'No pick'}>
          {pick?.points ?? pick?.confidence ?? 0}
        </div>
      {:else if !game.meta.locked}
        <button type="button" class="conf-button" aria-haspopup="listbox" aria-expanded={showPicker} on:click|stopPropagation={() => showPicker = !showPicker} title={localConfidence ? `Confidence ${localConfidence}` : 'Select confidence'}>
          <span class="conf-value">{localConfidence || '—'}</span>
          <span class="conf-arrows" aria-hidden="true">▲▼</span>
        </button>
        {#if showPicker}
          <div class="conf-popover" role="listbox" aria-label="Select confidence" tabindex="0" on:click|stopPropagation on:keydown={(e)=>{ if(e.key==='Escape'){ showPicker=false; e.stopPropagation(); } }}>
            {#each allowedConfidences as c}
              <button type="button" class="conf-option {String(c) === localConfidence ? 'active' : ''}" role="option" aria-selected={String(c) === localConfidence} on:click={() => chooseConfidence(c)}>{c}</button>
            {/each}
          </div>
        {/if}
      {:else}
        <div class="locked {statusLabel === 'in progress' && pick?.confidence == null ? 'neutral' : ''}" title="Locked">{pick?.confidence ?? (statusLabel === 'in progress' ? 0 : '—')}</div>
      {/if}
    </div>
  </div>
  {#if !final && game.status === 'SCHEDULED' && game.odds}
  <div class="odds-line">
    <span class="odds-label">Odds:</span>
    {#if game.odds.favoriteAbbr}
      <span class="odds-seg">{game.odds.favoriteAbbr} {game.odds.spread}</span>
      <span class="divider">|</span>
    {/if}
    {#if game.odds.overUnder}
      <span class="odds-seg">O/U {game.odds.overUnder}</span>
    {/if}
    {#if game.odds.provider}
      <span class="odds-prov">({game.odds.provider})</span>
    {/if}
  </div>
  {/if}
  {#if final && pick}
  <div class="result-line {pickWon ? 'won' : pickLost ? 'lost' : ''}">{pickWon ? 'Won +' + (pick.points ?? pick.confidence ?? 0) : pickLost ? 'Lost ' + Math.abs(pick.points ?? pick.confidence ?? 0) : ''}</div>
  {/if}
</div>

<style>
  .pick-card { padding:1rem 1rem .75rem; }
  .game-card { background: var(--color-surface-secondary,#ffffff); border:1px solid var(--color-surface-tertiary,#e5e7eb); border-radius:12px; display:flex; flex-direction:column; gap:.6rem; box-shadow:0 2px 4px rgba(0,0,0,.06); position:relative; }
  .game-header { display:flex; align-items:center; padding-bottom:.35rem; border-bottom:1px solid var(--color-surface-tertiary,#e5e7eb); }
  .header-right { margin-left:auto; display:flex; align-items:center; gap:.5rem; }
  .game-date { font-size:.75rem; color: var(--color-text-tertiary,#6c757d); }
  .game-status { font-size:.6rem; padding:.2rem .45rem; border-radius:4px; text-transform:uppercase; letter-spacing:.5px; font-weight:600; background:var(--color-surface-tertiary,#e9ecef); color:var(--color-text-secondary,#495057); }
  .game-status.in-progress { background:#dc3545; color:#fff; }
  .game-status.final { background:#198754; color:#fff; }
  .matchup { display:grid; grid-template-columns: 1fr auto 1fr 72px; align-items:stretch; gap:0; position:relative; }
  .team { display:flex; justify-content:space-between; align-items:center; padding:.5rem .75rem; gap:.75rem; position:relative; border-radius:8px; user-select:none; outline:2px solid transparent; outline-offset:2px; transition: outline-color .15s, box-shadow .15s, transform .1s; }
  .team.clickable { cursor:pointer; }
  .team.selected { 
    box-shadow:0 0 0 3px #2563eb, 0 0 0 6px rgba(37,99,235,.35), 0 4px 10px -2px rgba(37,99,235,.4);
    position:relative;
    transform:translateY(-2px);
  }
  .team.selected::after { 
    content:""; 
    position:absolute; inset:0; border-radius:inherit; 
    background:linear-gradient(135deg, rgba(37,99,235,.18), rgba(37,99,235,.05));
    pointer-events:none;
  }
  .team.winner { box-shadow:0 0 0 2px #16a34a, 0 0 0 4px #16a34a55; }
  .team.lost.selected { box-shadow:0 0 0 2px #dc2626, 0 0 0 4px #dc262655; }
  .team.winner { transform:translateY(-2px); }
  .team.lost.selected { transform:none; }
  :global(.dark) .team.selected { box-shadow:0 0 0 3px #3b82f6, 0 0 0 8px rgba(59,130,246,.4), 0 6px 14px -3px rgba(0,0,0,.55); }
  :global(.dark) .team.selected::after { background:linear-gradient(135deg, rgba(59,130,246,.25), rgba(59,130,246,.08)); }
  .team:focus-visible { outline-color:#6366f1; }
  .team-left { display:flex; align-items:center; gap:.5rem; }
  .team-logo { width:36px; height:36px; object-fit:contain; filter:drop-shadow(0 1px 1px rgba(0,0,0,.4)); }
  .team-text { display:flex; flex-direction:column; line-height:1.05; }
  .team-abbr { font-weight:600; font-size:.9rem; }
  .team-full { font-size:.55rem; opacity:.85; text-transform:uppercase; letter-spacing:.5px; }
  .team-score { font-size:1.2rem; font-weight:700; min-width:2ch; text-align:right; text-shadow:-1px -1px 0 #000,1px -1px 0 #000,-1px 1px 0 #000,1px 1px 0 #000,0 0 4px #000; color:#cfe8ff; }
  .team-score.neutral { color:#94a3b8; text-shadow:none; }
  .vs { display:flex; align-items:center; justify-content:center; font-weight:600; font-size:.75rem; padding:.25rem .6rem; color:var(--color-text-tertiary,#6c757d); background:var(--color-surface-tertiary,#e9ecef); }
  .confidence-wrapper { display:flex; align-items:center; justify-content:center; padding:.45rem .4rem; background:var(--color-surface-tertiary,#e5e7eb); border-top-right-radius:8px; border-bottom-right-radius:8px; position:relative; }
  .confidence-wrapper.locked-state { opacity:.8; }
  :global(.dark) .confidence-wrapper { background:#374151; }
  .conf-button { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.25rem; background:linear-gradient(135deg,#1e3a8a,#2563eb); color:#fff; border:none; border-radius:10px; padding:.5rem .55rem .55rem; cursor:pointer; font-weight:700; font-size:1.35rem; line-height:1; min-width:2.8ch; position:relative; box-shadow:0 2px 4px rgba(0,0,0,.25); }
  .conf-button:focus-visible { outline:2px solid #2563eb; outline-offset:2px; }
  .conf-value { font-variant-numeric:tabular-nums; }
  .conf-arrows { font-size:.55rem; letter-spacing:-1px; margin-top:2px; opacity:.85; font-weight:600; }
  .conf-popover { position:absolute; top:100%; right:0; margin-top:.4rem; background:var(--color-surface-primary,#ffffff); border:1px solid var(--color-surface-tertiary,#d1d5db); box-shadow:0 6px 18px -4px rgba(0,0,0,.25); border-radius:10px; padding:.4rem .45rem .5rem; display:grid; grid-template-columns:repeat(auto-fill,minmax(40px,1fr)); gap:.35rem; min-width:200px; z-index:30; }
  .conf-option { background:var(--color-surface-tertiary,#f1f5f9); border:1px solid var(--color-surface-tertiary,#e2e8f0); border-radius:8px; padding:.4rem .25rem; font-size:.85rem; font-weight:600; cursor:pointer; transition:background .15s,border-color .15s,color .15s; }
  .conf-option:hover { background:#2563eb; color:#fff; border-color:#2563eb; }
  .conf-option.active { background:#1d4ed8; color:#fff; border-color:#1d4ed8; }
  :global(.dark) .conf-popover { background:#1f2937; border-color:#374151; }
  :global(.dark) .conf-option { background:#374151; border-color:#4b5563; color:#e5e7eb; }
  :global(.dark) .conf-option:hover { background:#2563eb; border-color:#2563eb; color:#fff; }
  :global(.dark) .conf-option.active { background:#1d4ed8; border-color:#1d4ed8; }
  .sr-only { position:absolute; width:1px; height:1px; padding:0; margin:-1px; overflow:hidden; clip:rect(0 0 0 0); white-space:nowrap; border:0; }
  .locked { font-size:.75rem; font-weight:600; text-align:center; padding:.3rem .4rem; border-radius:6px; background:var(--color-surface-tertiary,#e5e7eb); }
  .locked.neutral { background:#6b7280; color:#fff; }
  .final-confidence { display:flex; align-items:center; justify-content:center; font-weight:700; font-size:1.25rem; line-height:1; padding:.55rem .65rem; border-radius:10px; min-width:2.8ch; font-variant-numeric:tabular-nums; box-shadow:0 2px 4px rgba(0,0,0,.25); }
  .final-confidence.won { background:linear-gradient(135deg,#15803d,#16a34a); color:#fff; }
  .final-confidence.lost { background:linear-gradient(135deg,#b91c1c,#dc2626); color:#fff; }
  .final-confidence.no-pick { background:linear-gradient(135deg,#6b7280,#9ca3af); color:#fff; opacity:.9; }
  .result-line { margin-top:.4rem; font-size:.6rem; font-weight:600; letter-spacing:.5px; padding:.25rem .5rem; border-radius:4px; text-transform:uppercase; width:max-content; }
  .result-line.won { background:#16a34a22; color:#15803d; }
  .result-line.lost { background:#dc262622; color:#b91c1c; }
  .pick-check { position:absolute; top:4px; right:4px; background:#16a34a; color:#fff; width:20px; height:20px; display:flex; align-items:center; justify-content:center; font-size:.85rem; font-weight:700; border-radius:50%; box-shadow:0 0 0 2px rgba(255,255,255,.4), 0 2px 4px rgba(0,0,0,.3); z-index:5; }
  :global(.dark) .pick-check { background:#22c55e; box-shadow:0 0 0 2px rgba(0,0,0,.5); }
  .focus-pulse { animation: pulseBorder 1.2s ease-out 0s 2; }
  @keyframes pulseBorder { 0% { box-shadow:0 0 0 0 rgba(59,130,246,.9); } 70% { box-shadow:0 0 0 8px rgba(59,130,246,0); } 100% { box-shadow:0 0 0 0 rgba(59,130,246,0); } }
  .odds-line { font-size:.6rem; font-weight:600; letter-spacing:.4px; display:flex; align-items:center; gap:.5rem; padding:.2rem .5rem .1rem; color:var(--color-text-secondary,#495057); }
  .odds-label { text-transform:uppercase; }
  .odds-seg { font-weight:700; }
  .divider { opacity:.5; }
  .odds-prov { font-style:italic; opacity:.7; }
  :global(.dark) .odds-line { color:#d1d5db; }
  .game-card.incomplete { outline:2px dashed #f59e0b; }
  :global(.dark) .game-card.incomplete { outline-color:#d97706; }
  :global(.dark) .game-card { background:#1f2937; border-color:#374151; box-shadow:0 2px 4px rgba(0,0,0,.45); }
  :global(.dark) .game-header { border-bottom-color:#374151; }
  :global(.dark) .game-date { color:#9ca3af; }
  :global(.dark) .game-status { background:#374151; color:#e5e7eb; }
  :global(.dark) .game-status.not-started { background:#4b5563; }
  :global(.dark) .vs { background:#374151; color:#9ca3af; }
  :global(.dark) .locked { background:#374151; color:#e5e7eb; }
  :global(.dark) .team-score.neutral { color:#9ca3af; }
  :global(.dark) .locked.neutral { background:#4b5563; color:#f1f5f9; }
  :global(.dark) .final-confidence.won { background:linear-gradient(135deg,#166534,#16a34a); }
  :global(.dark) .final-confidence.lost { background:linear-gradient(135deg,#7f1d1d,#b91c1c); }
  :global(.dark) .final-confidence.no-pick { background:linear-gradient(135deg,#4b5563,#6b7280); }
  @media (max-width:950px){
    .matchup { 
      display:grid; 
  grid-template-columns: 1fr 80px; 
      grid-template-rows: auto auto auto; 
      gap:.4rem .5rem; 
      align-items:stretch; 
    }
    .away-team { grid-column:1; grid-row:1; }
    .vs { 
      grid-column:1; grid-row:2; 
      display:flex; 
      background:transparent; 
      justify-content:flex-start; 
      padding:0 .75rem; 
      font-size:.65rem; 
      color:var(--color-text-tertiary,#6c757d);
    }
    .home-team { grid-column:1; grid-row:3; }
    .confidence-wrapper { 
      grid-column:2; grid-row:1 / span 3; 
      flex-direction:column; 
      justify-content:center; 
      padding:.5rem .55rem; 
      border-top-right-radius:8px; 
      border-bottom-right-radius:8px; 
    }
  .conf-button { font-size:1.2rem; }
  }
</style>
