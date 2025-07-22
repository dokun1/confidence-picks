<script>
  import { onMount } from 'svelte';
  import { currentRoute, initRouter } from './lib/router';
  import Header from './components/Header.svelte';
  import GamesPage from './components/GamesPage.svelte';
  import DesignSystemDemo from './components/DesignSystemDemo.svelte';

  onMount(() => {
    initRouter();
  });

</script>

<Header />

<main>
  {#if $currentRoute === 'home'}
    <!-- Simplified Home Page -->
    <div class="home-page">
      <h1>Welcome to Confidence Picks!</h1>
      <p>Your one-stop shop for NFL confidence picks.</p>
      <p>Click "Games" in the navigation to view NFL games by week.</p>
    </div>
  {:else if $currentRoute === 'games'}
    <!-- Games Page -->
    <GamesPage />
  {:else if $currentRoute === 'design-system'}
    <!-- Design System Demo -->
    <DesignSystemDemo />
  {:else}
    <!-- 404 Page -->
    <div class="not-found">
      <h2>Page Not Found</h2>
      <p>The page you're looking for doesn't exist.</p>
    </div>
  {/if}
</main>

<style>
  main {
    min-height: calc(100vh - 100px);
  }

  .home-page {
    text-align: center;
    padding: 2rem;
    max-width: 600px;
    margin: 0 auto;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .not-found {
    text-align: center;
    padding: 4rem 2rem;
    color: #6c757d;
  }
</style>