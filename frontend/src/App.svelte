<script>
  import { onMount } from 'svelte';

  let timestamp = '';
  let loading = true;
  let error = '';

  const API_URL = 'http://localhost:3001';

  async function fetchTimestamp() {
    try {
      loading = true;
      error = '';

      const response = await fetch(`${API_URL}/api/timestamp`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      timestamp = data.timestamp;
    } catch (err) {
      error = `Failed to fetch timestamp: ${err.message}`;
    } finally {
      loading = false;
    }
  }

  onMount(() => {
    fetchTimestamp();
  });
import Header from './components/Header.svelte';

</script>

<Header />

<main>
  <h1>Welcome to Confidence Picks!</h1>
  
  <div class="timestamp-section">
    {#if loading}
      <p>Loading...</p>
    {:else if error}
      <p class="error">{error}</p>
      <button on:click={fetchTimestamp}>Retry</button>
    {:else}
      <p class="timestamp">{new Date(timestamp).toLocaleString()}</p>
      <button on:click={fetchTimestamp}>Refresh</button>
    {/if}
  </div>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 400px;
    margin: 0 auto;
  }

  .timestamp-section {
    margin: 2rem 0;
    padding: 1rem;
    border: 1px solid #ccc;
    border-radius: 8px;
  }

  .timestamp {
    font-size: 1.2em;
    font-weight: bold;
    color: #2563eb;
    margin: 1rem 0;
  }

  .error {
    color: #dc2626;
    margin: 1rem 0;
  }

  button {
    background: #2563eb;
    color: white;
    border: none;
    padding: 0.5rem 1rem;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background: #1d4ed8;
  }
</style>