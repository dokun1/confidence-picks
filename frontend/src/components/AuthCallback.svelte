<script>
	import { onMount } from 'svelte';
	import AuthService from '../lib/authService.js';
	import { setAuthUser } from '../lib/authStore.js';
	import { navigateTo } from '../lib/router.js';

	let status = 'Processing authentication...';
	let error = null;

	async function finalize() {
		try {
			const params = new URLSearchParams(window.location.search);
			const token = params.get('token');
			const refresh = params.get('refresh');
			if (!token) throw new Error('Missing token');
			AuthService.setTokens(token, refresh);
			// Attempt to get user info from token
			let user = AuthService.getUser();
			// Always fetch /auth/me once to enrich with pictureUrl/provider
			const enriched = await AuthService.getCurrentUser();
			if (enriched) user = enriched;
			if (user) setAuthUser(user);
			status = 'Authenticated. Redirecting...';
			// Determine post-login redirect / invite auto-accept
			let target = '/groups';
			try {
				const storedRedirect = sessionStorage.getItem('postLoginRedirect');
				const inviteToken = sessionStorage.getItem('postLoginInviteToken');
				if (inviteToken) {
					// We'll navigate to invite page and set auto-accept flag
					sessionStorage.removeItem('postLoginInviteToken');
					sessionStorage.setItem('autoAcceptInviteToken', inviteToken);
					target = `/invite/${inviteToken}`;
				} else if (storedRedirect) {
					target = storedRedirect;
				}
				sessionStorage.removeItem('postLoginRedirect');
			} catch(_) {}
			setTimeout(() => navigateTo(target), 400);
		} catch (e) {
			console.error('Auth callback error', e);
			error = e.message;
			status = 'Authentication failed';
		}
	}

	onMount(finalize);
</script>

<div class="min-h-screen flex items-center justify-center bg-neutral-0 dark:bg-secondary-900">
	<div class="p-lg rounded-base border border-secondary-200 dark:border-secondary-700 bg-neutral-0 dark:bg-secondary-800 max-w-md w-full text-center space-y-md">
		{#if error}
			<h1 class="text-xl font-heading font-bold text-error-600 dark:text-error-400">Authentication Error</h1>
			<p class="text-sm text-[var(--color-text-secondary)] mb-sm">{error}</p>
			<button class="px-md py-xs bg-primary-500 text-neutral-0 rounded-base text-sm font-medium" on:click={() => navigateTo('/login')}>Return to Login</button>
		{:else}
			<h1 class="text-xl font-heading font-bold text-[var(--color-text-primary)]">Signing You In</h1>
			<p class="text-sm text-[var(--color-text-secondary)]">{status}</p>
		{/if}
	</div>
</div>
