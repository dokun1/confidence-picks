<script>
	import { onMount } from 'svelte';
	import AuthService from '../lib/authService.js';
	import { auth, setAuthUser } from '../lib/authStore.js';
	import { navigateTo } from '../lib/router.js';

	let loading = true;
	let error = null;
	let user = null;
			let pictureFailed = false;
			let imgSources = [];
			let currentSrcIndex = 0;

	// Derive from store reactively
	$: storeUser = $auth.user;

	function initials(name) {
		if (!name) return '?';
		return name.split(/\s+/).slice(0,2).map(p=>p[0]?.toUpperCase()).join('');
	}

	async function loadUser() {
		loading = true;
		error = null;
		try {
			// Try existing enriched user first
			user = AuthService.getUser();
			if (!user || !user.pictureUrl) {
				const fresh = await AuthService.getCurrentUser();
				if (fresh) {
					user = fresh;
					setAuthUser(fresh); // update global store to include pictureUrl
				}
			}
				if (user?.pictureUrl) {
					// Generate candidate image URLs with sizes matching display: 64px (mobile) and 80px (desktop)
					const base = user.pictureUrl;
					const variants = new Set();
					variants.add(base);
					if (/=s\d+-c$/.test(base)) {
						variants.add(base.replace(/=s\d+-c$/, '=s80-c')); // desktop size
						variants.add(base.replace(/=s\d+-c$/, '=s160-c')); // 2x for retina
						variants.add(base.replace(/=s\d+-c$/, '')); // no size param
					} else if (!/[?&]sz=/.test(base)) {
						variants.add(base + (base.includes('?') ? '&' : '?') + 'sz=160'); // 2x for retina
					}
					imgSources = Array.from(variants);
					currentSrcIndex = 0;
				} else {
					imgSources = [];
				}
			if (!user) {
				navigateTo('/login');
			}
		} catch (e) {
			console.error(e);
			error = 'Unable to load profile';
		} finally {
			loading = false;
		}
	}

	onMount(loadUser);
</script>

{#if loading}
	<div class="max-w-3xl mx-auto px-lg py-xl text-center text-[var(--color-text-secondary)]">Loading profile...</div>
{:else if error}
	<div class="max-w-3xl mx-auto px-lg py-xl">
		<div class="p-md rounded-base border border-error-300 dark:border-error-700 bg-error-50 dark:bg-error-900/30 text-error-700 dark:text-error-300">
			{error}
		</div>
	</div>
{:else if user}
	<div class="max-w-4xl mx-auto px-lg py-lg space-y-xl">
		<header class="flex flex-col sm:flex-row items-center sm:items-end gap-md">
			<!-- Avatar -->
									{#if user.pictureUrl && !pictureFailed}
										<img
											src={imgSources[currentSrcIndex] || user.pictureUrl}
											alt={user.name}
												class="w-16 h-16 md:w-20 md:h-20 rounded-full object-cover border-4 border-primary-100 dark:border-primary-800 shadow-md flex-shrink-0"
											referrerpolicy="no-referrer"
											crossorigin="anonymous"
											on:error={() => {
												if (currentSrcIndex < imgSources.length - 1) {
													currentSrcIndex += 1;
													console.warn('Avatar load failed, trying next variant', imgSources[currentSrcIndex]);
												} else {
													pictureFailed = true;
													console.error('All avatar variants failed to load. Falling back to initials.', imgSources);
												}
											}}
										/>
							{:else}
								<div class="w-16 h-16 md:w-20 md:h-20 rounded-full bg-primary-500 flex items-center justify-center text-neutral-0 text-2xl font-heading font-semibold shadow-md flex-shrink-0">
					{initials(user.name || user.email)}
				</div>
			{/if}
			<div class="text-center sm:text-left space-y-sm">
				<h1 class="text-3xl font-heading font-bold text-[var(--color-text-primary)]">My Profile</h1>
				<p class="text-[var(--color-text-secondary)]">Manage your account details and preferences.</p>
			</div>
		</header>

		<section class="grid grid-cols-1 md:grid-cols-3 gap-lg">
			<div class="md:col-span-2 space-y-lg">
				<!-- Basic Info Card -->
				<div class="p-lg rounded-base border border-secondary-200 dark:border-secondary-700 bg-neutral-0 dark:bg-secondary-800 space-y-md">
					<h2 class="text-xl font-heading font-semibold text-[var(--color-text-primary)]">Account Details</h2>
					<div class="space-y-sm text-sm">
						<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs">
							<span class="text-[var(--color-text-secondary)]">Name</span>
							<span class="font-medium text-[var(--color-text-primary)]">{user.name || '—'}</span>
						</div>
						<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs">
							<span class="text-[var(--color-text-secondary)]">Email</span>
							<span class="font-medium text-[var(--color-text-primary)] break-all">{user.email}</span>
						</div>
						<div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-xs">
							<span class="text-[var(--color-text-secondary)]">Provider</span>
							<span class="font-medium capitalize text-[var(--color-text-primary)]">{user.provider || 'google'}</span>
						</div>
					</div>
				</div>
			</div>
			<!-- Quick Actions / Secondary -->
			<div class="space-y-lg">
				<div class="p-lg rounded-base border border-secondary-200 dark:border-secondary-700 bg-neutral-0 dark:bg-secondary-800 space-y-md">
					<h2 class="text-lg font-heading font-semibold text-[var(--color-text-primary)]">Quick Actions</h2>
					<div class="flex flex-col gap-sm">
						<button class="px-md py-xs bg-primary-500 text-neutral-0 rounded-base text-sm font-medium hover:bg-primary-600 transition-colors duration-fast" on:click={() => navigateTo('/groups')}>
							View Your Groups
						</button>
						<button class="px-md py-xs bg-secondary-100 text-secondary-900 border border-secondary-300 rounded-base text-sm font-medium hover:bg-secondary-200 transition-colors duration-fast dark:bg-secondary-700 dark:text-secondary-50 dark:border-secondary-500 dark:hover:bg-secondary-600" on:click={() => navigateTo('/groups/create')}>
							Create New Group
						</button>
						<button class="px-md py-xs bg-secondary-100 text-secondary-900 border border-secondary-300 rounded-base text-sm font-medium hover:bg-secondary-200 transition-colors duration-fast dark:bg-secondary-700 dark:text-secondary-50 dark:border-secondary-500 dark:hover:bg-secondary-600" on:click={() => navigateTo('/groups/join')}>
							Join Group
						</button>
					</div>
				</div>
			</div>
		</section>
	</div>
{:else}
	<div class="max-w-3xl mx-auto px-lg py-xl text-center text-[var(--color-text-secondary)]">No user data.</div>
{/if}

<style>
	/* Minimal component-specific styles if needed */
</style>
