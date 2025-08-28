<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import Button from '../designsystem/components/Button.svelte';
  import TextField from '../designsystem/components/TextField.svelte';
  import { auth } from '../lib/authStore.js';
  import { createLinkInvite } from '../lib/invitesService.js';

  export let groupId = '';

  let group = null;
  let members = [];
  let messages = [];
  let isLoading = false;
  let error = null;
  let activeTab = 'leaderboard'; // default to leaderboard
  
  // Message form
  let newMessage = '';
  let isPostingMessage = false;
  let inviteCreating = false;
  let inviteError = null;
  let lastInviteUrl = null;

  onMount(async () => {
    if (groupId) {
      await loadGroupData();
    }
  });

  import { getGroup, getMembers, getMessages, postMessage as apiPostMessage } from '../lib/groupsService.js';

  async function loadGroupData() {
    isLoading = true;
    error = null;
    try {
      const [groupResp, membersResp, messagesResp] = await Promise.all([
        getGroup(groupId),
        getMembers(groupId),
        getMessages(groupId)
      ]);
      group = {
        id: groupResp.id,
        name: groupResp.name,
        identifier: groupResp.identifier,
        description: groupResp.description,
        memberCount: groupResp.memberCount,
        isOwner: groupResp.userRole === 'admin',
        createdAt: groupResp.createdAt
      };
      members = membersResp;
      messages = messagesResp;
    } catch (err) {
      error = err.message;
      console.error('Error loading group data:', err);
    } finally {
      isLoading = false;
    }
  }

  async function postMessage() {
    if (!newMessage.trim()) return;
    isPostingMessage = true;
    try {
      const posted = await apiPostMessage(groupId, newMessage.trim());
      messages = [posted, ...messages];
      newMessage = '';
    } catch (err) {
      error = err.message;
      console.error('Error posting message:', err);
    } finally {
      isPostingMessage = false;
    }
  }

  function formatDate(dateString) {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  }

  function copyGroupIdentifier() {
    navigator.clipboard.writeText(group.identifier);
    showCopyToast = false; // reset so animation restarts if clicked repeatedly
    requestAnimationFrame(() => { showCopyToast = true; });
  }
  let showCopyToast = false;
  import InlineToast from '../designsystem/components/InlineToast.svelte';
  import PicksPanel from './PicksPanel.svelte';
  import Avatar from '../designsystem/components/Avatar.svelte';
  import { getScoreboard } from '../lib/picksService.js';
  import ConfirmDeleteModal from './ConfirmDeleteModal.svelte';
  import { leaveGroup } from '../lib/groupsService.js';

  const currentSeason = new Date().getFullYear();
  const currentSeasonType = 2; // Regular
  let leaderboardLoading = false;
  let leaderboardError = '';
  let leaderboardUsers = [];
  let leaderboardLoaded = false;
  let showLeaveModal = false;
  let leaving = false;
  let leaveError = null;
  let picksPanelRef; // reference to PicksPanel for sticky action bar
  // Reactive bindings from PicksPanel
  let canSave = false;
  let savingState = false;
  let clearingState = false;
  let hasSortedPicks = false;
  let hasMultipleGroups = false;
  let showGroupSelector = false;
  let currentWeek = null;

  async function shareInvite() {
    inviteError = null;
    try {
      inviteCreating = true;
      const invite = await createLinkInvite(group.identifier, {});
      lastInviteUrl = invite.joinUrl;
      
      if (navigator.share) {
        try {
          // For native share, only use the URL to avoid duplication when copying
          // Apps like Messages will auto-generate previews from the URL
          await navigator.share({ 
            title: `Join my Confidence Picks group "${group.name}"`, 
            url: invite.joinUrl 
          });
        } catch (e) {
          if (e.name !== 'AbortError') console.warn('Share aborted/failed', e);
        }
      } else {
        // For clipboard fallback, just copy the URL
        await navigator.clipboard.writeText(invite.joinUrl);
        showCopyToast = false; requestAnimationFrame(()=> showCopyToast = true);
      }
    } catch(e) {
      inviteError = e.message || 'Failed to create invite';
    } finally {
      inviteCreating = false;
    }
  }

  async function copyInviteLink() {
    inviteError = null;
    try {
      if (!lastInviteUrl) {
        const invite = await createLinkInvite(group.identifier, {});
        lastInviteUrl = invite.joinUrl;
      }
      await navigator.clipboard.writeText(lastInviteUrl);
      showCopyToast = false; 
      requestAnimationFrame(()=> showCopyToast = true);
    } catch(e) {
      inviteError = e.message || 'Failed to copy invite link';
    }
  }

  async function handleLeaveGroup() {
    leaveError = null;
    leaving = true;
    try {
      await leaveGroup(group.identifier);
      // Navigate back to groups list after leaving
      navigateTo('/groups');
    } catch (e) {
      leaveError = e.message || 'Failed to leave group';
    } finally {
      leaving = false;
    }
  }

  async function loadLeaderboard() {
    if (!group) return;
    leaderboardLoading = true; leaderboardError='';
    try {
      const data = await getScoreboard(group.identifier, { season: currentSeason, seasonType: currentSeasonType });
      const users = (data.users || []).slice().sort((a,b)=> b.totalPoints - a.totalPoints);
      leaderboardUsers = users;
      leaderboardLoaded = true;
    } catch (e) {
      leaderboardError = e.message || 'Failed to load leaderboard';
    } finally {
      leaderboardLoading = false;
    }
  }

  $: if (activeTab === 'leaderboard' && group && !leaderboardLoaded && !leaderboardLoading) loadLeaderboard();
</script>

<div class="min-h-screen bg-neutral-0 dark:bg-secondary-900 pt-16">
  {#if isLoading}
    <!-- Loading State -->
    <div class="max-w-6xl mx-auto px-md py-lg">
      <div class="animate-pulse space-y-lg">
        <div class="h-8 bg-secondary-200 dark:bg-secondary-700 rounded w-1/3"></div>
        <div class="h-4 bg-secondary-200 dark:bg-secondary-700 rounded w-2/3"></div>
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div class="lg:col-span-2 space-y-md">
            <div class="h-48 bg-secondary-200 dark:bg-secondary-700 rounded"></div>
          </div>
          <div class="space-y-md">
            <div class="h-32 bg-secondary-200 dark:bg-secondary-700 rounded"></div>
          </div>
        </div>
      </div>
    </div>
  {:else if error}
    <!-- Error State -->
    <div class="max-w-4xl mx-auto px-md py-lg">
      <div class="text-center">
        <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-md">Group Not Found</h1>
        <p class="text-[var(--color-text-secondary)] mb-lg">{error}</p>
        <Button on:click={() => navigateTo('/groups')}>
          Back to Groups
        </Button>
      </div>
    </div>
  {:else if group}
    <!-- Group Details -->
    <div class="max-w-6xl mx-auto px-md py-lg">
      <!-- Header -->
      <div class="mb-lg">
        <button
          class="flex items-center text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100 mb-md transition-colors"
          on:click={() => navigateTo('/groups')}
        >
          <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 19l-7-7 7-7"></path>
          </svg>
          Back to Groups
        </button>
        
        <div class="flex flex-col md:flex-row md:items-start md:justify-between gap-md">
          <div>
            <h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)] mb-sm">
              {group.name}
            </h1>
            <p class="text-[var(--color-text-secondary)] mb-sm">{group.description}</p>
            <div class="flex items-center gap-md text-sm text-[var(--color-text-secondary)]">
              <span class="flex items-center">
                <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z"></path>
                </svg>
                {group.memberCount} members
              </span>
              <span>Created {formatDate(group.createdAt)}</span>
              {#if group.isOwner}
                <span class="px-xs py-xxxs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                  Owner
                </span>
              {/if}
            </div>
          </div>
          
          <div class="flex gap-sm">
            <div class="inline-toast-anchor">
              <button
                class="flex items-center px-sm py-xs bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 rounded hover:bg-secondary-200 dark:hover:bg-secondary-600 transition-colors"
                on:click={copyGroupIdentifier}
                title="Copy group identifier"
              >
                <svg class="w-4 h-4 mr-xs" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
                </svg>
                {group.identifier}
              </button>
              <InlineToast open={showCopyToast} message="Copied" variant="success" onClose={() => showCopyToast = false} />
            </div>
            {#if group.isOwner}
              <Button variant="tertiary" size="sm" on:click={() => navigateTo(`/groups/${group.identifier}/edit`)}>
                Edit Group
              </Button>
            {/if}
          </div>
        </div>
      </div>

      <!-- Tab Navigation (sticky, scrollable) -->
  <div class="border-b border-secondary-200 dark:border-secondary-700 sticky top-0 z-30 bg-neutral-0/95 dark:bg-secondary-900/95 backdrop-blur supports-backdrop-blur:backdrop-blur-sm">
        <div class="flex gap-lg overflow-x-auto no-scrollbar px-1" role="tablist" aria-label="Group sections">
          <button
            class="pb-sm px-xs text-sm font-medium border-b-2 transition-colors {activeTab === 'leaderboard' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'}"
            on:click={() => activeTab = 'leaderboard'}
            role="tab" aria-selected={activeTab==='leaderboard'}
          >
            Leaderboard
          </button>
          <button
            class="pb-sm px-xs text-sm font-medium border-b-2 transition-colors {activeTab === 'picks' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'}"
            on:click={() => activeTab = 'picks'}
            role="tab" aria-selected={activeTab==='picks'}
          >
            Picks
          </button>
          <button
            class="pb-sm px-xs text-sm font-medium border-b-2 transition-colors {activeTab === 'messages' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'}"
            on:click={() => activeTab = 'messages'}
            role="tab" aria-selected={activeTab==='messages'}
          >
            Messages ({messages.length})
          </button>
          <button
            class="pb-sm px-xs text-sm font-medium border-b-2 transition-colors {activeTab === 'members' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'}"
            on:click={() => activeTab = 'members'}
            role="tab" aria-selected={activeTab==='members'}
          >
            Members ({members.length})
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      {#if activeTab === 'leaderboard'}
        <!-- Leaderboard Tab -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div class="lg:col-span-2 space-y-lg">
            <!-- Leaderboard Card -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
              <div class="flex items-center justify-between mb-md">
                <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)]">Leaderboard</h2>
                <button class="text-xs px-sm py-xxs rounded bg-secondary-100 dark:bg-secondary-700 text-secondary-700 dark:text-secondary-300 hover:bg-secondary-200 dark:hover:bg-secondary-600 disabled:opacity-50"
                  on:click={loadLeaderboard}
                  disabled={leaderboardLoading}>
                  {leaderboardLoading ? 'Loading…' : 'Refresh'}
                </button>
              </div>
              {#if leaderboardError}
                <div class="text-sm text-red-600 dark:text-red-400">{leaderboardError}</div>
              {:else if leaderboardLoading && !leaderboardLoaded}
                <div class="text-sm text-[var(--color-text-secondary)]">Loading leaderboard…</div>
              {:else if leaderboardUsers.length === 0}
                <div class="text-sm text-[var(--color-text-secondary)]">No points yet.</div>
              {:else}
                <ul class="divide-y divide-secondary-200 dark:divide-secondary-700">
                  {#each leaderboardUsers as u, i}
                    <li class="flex items-center gap-sm py-sm">
                      <div class="w-6 text-right pr-1 text-sm font-medium tabular-nums">{i+1}</div>
                      <Avatar name={u.name} pictureUrl={u.pictureUrl} variant="md" />
                      <div class="flex-1 truncate text-sm">{u.name}</div>
                      <div class="text-sm font-semibold tabular-nums">{u.totalPoints}</div>
                    </li>
                  {/each}
                </ul>
              {/if}
            </div>
          </div> <!-- close first column before second column starts -->

          <div class="space-y-lg">
            <!-- Quick Actions -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
              <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-md">Quick Actions</h2>
              <div class="flex flex-col gap-sm">
                <Button variant="primary" size="sm" class="w-full" on:click={() => activeTab = 'picks'}>
                  Make Picks
                </Button>
                <Button variant="secondary" size="sm" class="w-full" on:click={() => activeTab = 'messages'}>
                  View Messages
                </Button>
                {#if group.isOwner}
                  <Button variant="tertiary" size="sm" class="w-full" on:click={() => navigateTo(`/groups/${group.identifier}/edit`)}>
                    Edit Group
                  </Button>
                  <Button variant="secondary" size="sm" class="w-full" disabled={inviteCreating} on:click={shareInvite}>
                    {inviteCreating ? 'Preparing…' : 'Share Invite'}
                  </Button>
                {/if}
                {#if !group.isOwner}
                  <Button variant="destructive" size="sm" class="w-full" on:click={() => { showLeaveModal = true; }} disabled={leaving}>
                    {leaving ? 'Leaving...' : 'Leave Group'}
                  </Button>
                {/if}
                {#if leaveError}
                  <div class="text-sm text-error-600 dark:text-error-400">{leaveError}</div>
                {/if}
                {#if inviteError}
                  <div class="text-sm text-error-600 dark:text-error-400">{inviteError}</div>
                {/if}
              </div>
            </div>
          </div>
        </div> <!-- close grid wrapper -->

      {:else if activeTab === 'messages'}
        <!-- Messages Tab -->
        <div class="grid grid-cols-1 lg:grid-cols-4 gap-lg">
          <div class="lg:col-span-3">
            <!-- Messages List -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg">
              <div class="p-lg border-b border-secondary-200 dark:border-secondary-700">
                <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)]">Group Messages</h2>
              </div>
              
              <div class="p-lg space-y-md max-h-96 overflow-y-auto">
                {#each messages as message}
                  <div class="flex items-start gap-sm">
                    <Avatar name={message.authorName} pictureUrl={message.authorPictureUrl} variant="md" className="shrink-0" />
                    <div class="flex-1 min-w-0">
                      <div class="font-medium text-[var(--color-text-primary)] break-all">{message.authorName}</div>
                      <div class="text-xs text-[var(--color-text-secondary)] mt-xxs">{formatDate(message.createdAt)}</div>
                      <p class="mt-xs text-sm text-[var(--color-text-secondary)] break-words whitespace-pre-wrap">{message.content}</p>
                    </div>
                  </div>
                {/each}
              </div>

              <!-- Message Form -->
              <div class="p-lg border-t border-secondary-200 dark:border-secondary-700">
                <form on:submit|preventDefault={postMessage} class="flex gap-sm">
                  <div class="flex-1">
                    <TextField
                      bind:value={newMessage}
                      placeholder="Type your message..."
                      disabled={isPostingMessage}
                    />
                  </div>
                  <Button 
                    type="submit" 
                    disabled={!newMessage.trim() || isPostingMessage}
                    loading={isPostingMessage}
                  >
                    Send
                  </Button>
                </form>
              </div>
            </div>
          </div>

          <div>
            <!-- Message Guidelines -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
              <h3 class="font-semibold text-[var(--color-text-primary)] mb-sm">Message Guidelines</h3>
              <ul class="text-sm text-[var(--color-text-secondary)] space-y-xs">
                <li>• Keep discussions friendly and respectful</li>
                <li>• Share picks strategies and insights</li>
                <li>• Celebrate wins and support others</li>
                <li>• No spam or off-topic content</li>
              </ul>
            </div>
          </div>
        </div>

      {:else if activeTab === 'members'}
        <!-- Members Tab -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div class="lg:col-span-2">
            <!-- Members List -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg">
              <div class="p-lg border-b border-secondary-200 dark:border-secondary-700">
                <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)]">Group Members</h2>
              </div>
              
              <div class="p-lg space-y-sm">
                {#each members as member}
                  <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-xs p-sm bg-secondary-50 dark:bg-secondary-700 rounded">
                    <div class="flex items-center gap-sm">
                      <Avatar name={member.name} pictureUrl={member.pictureUrl} variant="md" />
                      <div class="leading-tight">
                        <div class="font-medium text-[var(--color-text-primary)] break-words">{member.name}</div>
                        <div class="text-sm text-[var(--color-text-secondary)] break-all">{member.email}</div>
                      </div>
                    </div>
                    <div class="flex flex-wrap items-center gap-sm text-sm text-[var(--color-text-secondary)] md:justify-end">
                      {#if member.isOwner}
                        <span class="px-xs py-xxxs bg-primary-100 dark:bg-primary-900 text-primary-700 dark:text-primary-300 rounded text-xs font-medium">
                          Owner
                        </span>
                      {/if}
                      <span class="whitespace-nowrap">Joined {new Date(member.joinedAt).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}</span>
                    </div>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <div>
            <!-- Invite Members -->
            {#if group.isOwner}
              <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
                <h3 class="font-semibold text-[var(--color-text-primary)] mb-sm">Invite New Members</h3>
                <p class="text-sm text-[var(--color-text-secondary)] mb-md">
                  Share the group identifier with friends to invite them:
                </p>
                <div class="p-sm bg-secondary-50 dark:bg-secondary-700 rounded border mb-md">
                  <code class="text-sm font-mono text-primary-600 dark:text-primary-400">{group.identifier}</code>
                </div>
                <Button variant="secondary" size="sm" class="w-full" on:click={copyGroupIdentifier}>
                  Copy Identifier
                </Button>
              </div>
            {/if}
          </div>
        </div>
      {:else if activeTab === 'picks'}
        <div class="space-y-lg">
          <!-- Sticky subheader with actions -->
          <div class="sticky top-[2.75rem] z-20 mb-lg bg-neutral-0/95 dark:bg-secondary-900/95 backdrop-blur supports-backdrop-blur:backdrop-blur-sm border-b border-secondary-200 dark:border-secondary-700 py-sm px-xs">
            <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-sm">
              <h2 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">Make Your Picks</h2>
              
              <!-- Mobile: Stacked buttons, Desktop: Horizontal buttons -->
              <div class="flex flex-col md:flex-row gap-sm md:items-center">
                <!-- Multi-group save buttons -->
                {#if hasMultipleGroups}
                  <!-- Treat multi-group save as one item that stacks internally on desktop only -->
                  <div class="flex w-full md:w-auto">
                    <!-- Main save button -->
                    <button class="inline-flex items-center px-lg py-sm rounded-r-none border-r-0 text-base font-medium bg-primary-500 text-neutral-0 disabled:bg-primary-300 disabled:text-primary-100 h-10 flex-1 md:flex-initial justify-center"
                      disabled={!canSave || savingState}
                      on:click={() => picksPanelRef?.savePicksAction()}>
                      {savingState ? 'Saving…' : 'Save Picks'}
                    </button>
                    
                    <!-- Dropdown trigger button -->
                    <button class="inline-flex items-center px-sm py-sm rounded-l-none border-l border-primary-400 text-base font-medium bg-primary-500 text-neutral-0 disabled:bg-primary-300 disabled:text-primary-100 h-10 justify-center"
                      disabled={!canSave || savingState}
                      on:click={() => picksPanelRef?.toggleGroupSelector()}>
                      <svg width="16" height="16" viewBox="0 0 12 12" fill="none" class="transform {showGroupSelector ? 'rotate-180' : ''}">
                        <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
                      </svg>
                    </button>
                  </div>
                {:else}
                  <!-- Single group save button -->
                  <button class="inline-flex items-center px-lg py-sm rounded text-base font-medium bg-primary-500 text-neutral-0 disabled:bg-primary-300 disabled:text-primary-100 h-10 w-full md:w-auto justify-center"
                    disabled={!canSave || savingState}
                    on:click={() => picksPanelRef?.savePicksAction()}>
                    {savingState ? 'Saving…' : 'Save Picks'}
                  </button>
                {/if}
                
                <!-- How to play button -->
                <button class="inline-flex items-center px-lg py-sm rounded text-base font-medium bg-secondary-100 text-secondary-700 hover:bg-secondary-200 dark:bg-secondary-700 dark:text-secondary-200 dark:hover:bg-secondary-600 h-10 w-full md:w-auto justify-center gap-xs"
                  on:click={() => navigateTo('/about')}>
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z"/>
                  </svg>
                  How To Play
                </button>
                
                <button class="inline-flex items-center px-lg py-sm rounded text-base font-medium bg-red-600 text-white disabled:opacity-50 h-10 w-full md:w-auto justify-center"
                  on:click={() => { if (!clearingState && hasSortedPicks) confirm(`Clear all picks for Week ${currentWeek}? This cannot be undone.`) && picksPanelRef?.clearAllAction(); }}
                  disabled={clearingState || !hasSortedPicks}>
                  {clearingState ? 'Clearing…' : 'Clear All'}
                </button>
              </div>
            </div>
          </div>
          <div class="picks-container bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
            <PicksPanel bind:this={picksPanelRef} bind:canSave bind:savingState bind:clearingState bind:hasSortedPicks bind:hasMultipleGroups bind:showGroupSelector bind:currentWeek groupIdentifier={group.identifier} />
          </div>
        </div>
      {/if}
    </div>
    <ConfirmDeleteModal
      open={showLeaveModal}
      name={group?.name}
      slug={group?.identifier}
      loading={leaving}
      error={leaveError}
      mode="leave"
      on:cancel={() => { if(!leaving) { showLeaveModal = false; leaveError = null; } }}
      on:confirm={() => { if(!leaving) handleLeaveGroup(); }}
    />
  {/if}
</div>

<style>
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }
  .no-scrollbar::-webkit-scrollbar { display: none; }
  
  @media (max-width: 950px) {
    .picks-container {
      background: transparent !important;
      border: none !important;
      border-radius: 0 !important;
      padding: 0 !important;
      box-shadow: none !important;
    }
  }
</style>
