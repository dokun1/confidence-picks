<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import Button from '../designsystem/components/Button.svelte';
  import TextField from '../designsystem/components/TextField.svelte';
  import { auth } from '../lib/authStore.js';

  export let groupId = '';

  let group = null;
  let members = [];
  let messages = [];
  let isLoading = false;
  let error = null;
  let activeTab = 'picks'; // default to picks per requirements
  
  // Message form
  let newMessage = '';
  let isPostingMessage = false;

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
      messages = [...messages, posted];
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

      <!-- Tab Navigation -->
      <div class="mb-lg border-b border-secondary-200 dark:border-secondary-700">
        <div class="flex gap-lg">
          <button
            class="pb-sm px-xs text-sm font-medium border-b-2 transition-colors {activeTab === 'overview' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'}"
            on:click={() => activeTab = 'overview'}
          >
            Overview
          </button>
          <button
            class="pb-sm px-xs text-sm font-medium border-b-2 transition-colors {activeTab === 'picks' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'}"
            on:click={() => activeTab = 'picks'}
          >
            Picks
          </button>
          <button
            class="pb-sm px-xs text-sm font-medium border-b-2 transition-colors {activeTab === 'messages' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'}"
            on:click={() => activeTab = 'messages'}
          >
            Messages ({messages.length})
          </button>
          <button
            class="pb-sm px-xs text-sm font-medium border-b-2 transition-colors {activeTab === 'members' ? 'border-primary-500 text-primary-600 dark:text-primary-400' : 'border-transparent text-secondary-600 dark:text-secondary-400 hover:text-secondary-900 dark:hover:text-secondary-100'}"
            on:click={() => activeTab = 'members'}
          >
            Members ({members.length})
          </button>
        </div>
      </div>

      <!-- Tab Content -->
      {#if activeTab === 'overview'}
        <!-- Overview Tab -->
        <div class="grid grid-cols-1 lg:grid-cols-3 gap-lg">
          <div class="lg:col-span-2 space-y-lg">
            <!-- Group Stats -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
              <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-md">Group Statistics</h2>
              <div class="grid grid-cols-2 gap-md">
                <div class="text-center p-md bg-secondary-50 dark:bg-secondary-700 rounded">
                  <div class="text-2xl font-bold text-[var(--color-text-primary)]">{members.length}</div>
                  <div class="text-sm text-[var(--color-text-secondary)]">Active Members</div>
                </div>
                <div class="text-center p-md bg-secondary-50 dark:bg-secondary-700 rounded">
                  <div class="text-2xl font-bold text-[var(--color-text-primary)]">{messages.length}</div>
                  <div class="text-sm text-[var(--color-text-secondary)]">Messages</div>
                </div>
              </div>
            </div>

            <!-- Recent Activity -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
              <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-md">Recent Activity</h2>
              <div class="space-y-sm">
                {#each messages.slice(-3).reverse() as message}
                  <div class="p-sm bg-secondary-50 dark:bg-secondary-700 rounded">
                    <div class="flex items-center gap-sm">
                      <Avatar name={message.authorName} pictureUrl={message.authorPictureUrl} size={32} className="text-xs" />
                      <span class="font-medium text-[var(--color-text-primary)] truncate">{message.authorName}</span>
                    </div>
                    <div class="mt-xxs text-xs text-[var(--color-text-secondary)]">{formatDate(message.createdAt)}</div>
                    <p class="mt-sm text-sm text-[var(--color-text-secondary)] break-words">{message.content}</p>
                  </div>
                {/each}
              </div>
            </div>
          </div>

          <div class="space-y-lg">
            <!-- Quick Actions -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
              <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-md">Quick Actions</h2>
              <div class="flex flex-col md:flex-row md:items-center md:gap-sm">
                <div class="w-full md:w-auto mb-sm md:mb-0">
                  <Button variant="primary" size="sm" on:click={() => activeTab = 'messages'}>
                    View Messages
                  </Button>
                </div>
                <div class="w-full md:w-auto mb-sm md:mb-0">
                  <Button variant="secondary" size="sm" on:click={() => activeTab = 'members'}>
                    View Members
                  </Button>
                </div>
                {#if group.isOwner}
                  <div class="w-full md:w-auto">
                    <Button variant="tertiary" size="sm" on:click={() => navigateTo(`/groups/${group.identifier}/edit`)}>
                      Edit Group
                    </Button>
                  </div>
                {/if}
              </div>
            </div>
          </div>
        </div>

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
                    <Avatar name={message.authorName} pictureUrl={message.authorPictureUrl} size={40} className="shrink-0" />
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
                      <Avatar name={member.name} pictureUrl={member.pictureUrl} size={40} />
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

            <!-- Member Stats -->
            <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg {group.isOwner ? 'mt-lg' : ''}">
              <h3 class="font-semibold text-[var(--color-text-primary)] mb-sm">Member Statistics</h3>
              <div class="space-y-sm">
                <div class="flex justify-between text-sm">
                  <span class="text-[var(--color-text-secondary)]">Total Members:</span>
                  <span class="font-medium text-[var(--color-text-primary)]">{members.length}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-[var(--color-text-secondary)]">Group Owners:</span>
                  <span class="font-medium text-[var(--color-text-primary)]">{members.filter(m => m.isOwner).length}</span>
                </div>
                <div class="flex justify-between text-sm">
                  <span class="text-[var(--color-text-secondary)]">Regular Members:</span>
                  <span class="font-medium text-[var(--color-text-primary)]">{members.filter(m => !m.isOwner).length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      {:else if activeTab === 'picks'}
        <div class="space-y-lg">
          <div class="bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-lg">
            <h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-md">Make Your Picks</h2>
            <PicksPanel groupIdentifier={group.identifier} />
          </div>
        </div>
      {/if}
    </div>
  {/if}
</div>
