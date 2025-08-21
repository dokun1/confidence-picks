<script>
  import { onMount } from 'svelte';
  import { navigateTo } from '../lib/router.js';
  import { getInvite, acceptInvite } from '../lib/invitesService.js';
  import AuthService from '../lib/authService.js';
  import Avatar from '../designsystem/components/Avatar.svelte';
  import Button from '../designsystem/components/Button.svelte';

  export let token = '';
  let loading = true;
  let invite = null;
  let error = null;
  let accepting = false;

  async function load() {
    loading = true; error=null;
    try { invite = await getInvite(token); } catch(e){ error = e.message; } finally { loading=false; }
  }

  async function handleAccept() {
    if (!AuthService.getToken()) {
      // Persist intent & redirect target for post-login auto-accept
      try {
        sessionStorage.setItem('postLoginRedirect', window.location.pathname);
        sessionStorage.setItem('postLoginInviteToken', token);
      } catch(_) {}
      navigateTo(`/login`);
      return;
    }
    accepting = true; error=null;
    try {
      const res = await acceptInvite(token);
      navigateTo(`/groups/${res.groupIdentifier}`);
    } catch(e){ error=e.message; } finally { accepting=false; }
  }

  function handleDecline() { navigateTo('/groups'); }

  onMount(async () => {
    await load();
    // If callback set auto-accept flag for this token, attempt accept automatically
    try {
      const autoToken = sessionStorage.getItem('autoAcceptInviteToken');
      if (autoToken === token) {
        sessionStorage.removeItem('autoAcceptInviteToken');
        if (AuthService.getToken() && invite?.valid && !invite?.alreadyMember) {
          // Fire and forget; internal state will reflect
          handleAccept();
        }
      }
    } catch(_) {}
  });
</script>

<div class="min-h-screen flex items-center justify-center bg-neutral-0 dark:bg-secondary-900 px-md py-xl">
  <div class="w-full max-w-md bg-neutral-0 dark:bg-secondary-800 border border-secondary-200 dark:border-secondary-700 rounded-lg p-xl space-y-lg">
    {#if loading}
      <div class="animate-pulse space-y-sm">
        <div class="h-6 bg-secondary-200 dark:bg-secondary-700 rounded"></div>
        <div class="h-4 bg-secondary-200 dark:bg-secondary-700 rounded w-2/3"></div>
        <div class="h-32 bg-secondary-200 dark:bg-secondary-700 rounded"></div>
      </div>
    {:else if error}
      <div>
        <h1 class="text-xl font-heading font-semibold text-error-600 dark:text-error-400 mb-sm">Invitation Error</h1>
        <p class="text-sm text-[var(--color-text-secondary)] mb-md">{error}</p>
        <Button variant="secondary" size="sm" on:click={() => navigateTo('/groups')}>Go to Groups</Button>
      </div>
    {:else if invite}
      {#if !invite.valid}
        <div>
          <h1 class="text-xl font-heading font-semibold text-[var(--color-text-primary)] mb-sm">Invite Unavailable</h1>
          <p class="text-sm text-[var(--color-text-secondary)] mb-md">Reason: {invite.reason}</p>
          <Button variant="secondary" size="sm" on:click={() => navigateTo('/groups')}>Browse Groups</Button>
        </div>
      {:else}
        <div class="space-y-md">
          <div class="flex items-center gap-sm">
            <Avatar name={invite.group.ownerName} pictureUrl={invite.group.ownerPictureUrl} variant="md" />
            <div>
              <h1 class="text-xl font-heading font-semibold text-[var(--color-text-primary)]">Join {invite.group.name}</h1>
              <p class="text-xs text-[var(--color-text-secondary)]">Hosted by {invite.group.ownerName}</p>
            </div>
          </div>
          {#if invite.group.description}
            <p class="text-sm text-[var(--color-text-secondary)] whitespace-pre-wrap">{invite.group.description}</p>
          {/if}
          <div class="flex items-center gap-sm text-xs text-[var(--color-text-secondary)]">
            <span>{invite.group.memberCount} members</span>
            <span>•</span>
            <span>Max {invite.group.maxMembers}</span>
            {#if invite.invite.remainingUses != null}
              <span>• {invite.invite.remainingUses} uses left</span>
            {/if}
          </div>
          {#if invite.alreadyMember}
            <Button variant="primary" size="sm" class="w-full" on:click={() => navigateTo(`/groups/${invite.group.identifier}`)}>Go to Group</Button>
          {:else}
            <div class="flex flex-col gap-sm">
              <Button variant="primary" size="sm" class="w-full" disabled={accepting} on:click={handleAccept}>{accepting ? 'Joining…' : 'Accept & Join'}</Button>
              <Button variant="secondary" size="sm" class="w-full" on:click={handleDecline}>Decline</Button>
            </div>
          {/if}
        </div>
      {/if}
    {/if}
  </div>
</div>
