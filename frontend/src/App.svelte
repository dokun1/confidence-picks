<script>
  import { onMount } from 'svelte';

  let timestamp = '';
  let loading = true;
  let error = '';
  
  // Database connection status
  let dbConnected = false;
  let dbLoading = true;
  let dbError = '';

    // Use your actual Vercel URL here
  const API_URL = import.meta.env.PROD 
    ? 'https://confidence-picks-eyb5l3nex-dokun1s-projects.vercel.app'  // Replace with your actual Vercel URL
    : 'http://localhost:3001';

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

  // New function to check database connection
  async function checkDatabaseConnection() {
    try {
      dbLoading = true;
      dbError = '';
      
      const response = await fetch(`${API_URL}/api/test-db`);
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      dbConnected = true;
      console.log('Database check result:', data);
    } catch (err) {
      dbConnected = false;
      dbError = `Database connection failed: ${err.message}`;
      console.error('Database check error:', err);
    } finally {
      dbLoading = false;
    }
  }

  onMount(() => {
    fetchTimestamp();
    checkDatabaseConnection();
  });
import Header from './components/Header.svelte';

</script>

<Header />

<main>
  <h1>Welcome to Confidence Picks!</h1>
  
  <!-- Database Connection Status -->
  <div class="status-indicator">
    <span class="status-label">Database:</span>
    {#if dbLoading}
      <div class="status-dot loading"></div>
      <span class="status-text">Checking...</span>
    {:else if dbConnected}
      <div class="status-dot connected"></div>
      <span class="status-text">Connected</span>
    {:else}
      <div class="status-dot disconnected"></div>
      <span class="status-text">Disconnected</span>
      {#if dbError}
        <button class="retry-btn" on:click={checkDatabaseConnection}>Retry</button>
      {/if}
    {/if}
  </div>
  
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

  .status-indicator {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    margin: 1rem 0;
    padding: 0.5rem;
    background: #f8f9fa;
    border-radius: 6px;
    border: 1px solid #e9ecef;
  }

  .status-label {
    font-weight: 500;
    color: #495057;
  }

  .status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    display: inline-block;
  }

  .status-dot.connected {
    background-color: #28a745;
    box-shadow: 0 0 8px rgba(40, 167, 69, 0.4);
  }

  .status-dot.disconnected {
    background-color: #dc3545;
    box-shadow: 0 0 8px rgba(220, 53, 69, 0.4);
  }

  .status-dot.loading {
    background-color: #6c757d;
    animation: pulse 1.5s ease-in-out infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.5; }
  }

  .status-text {
    font-size: 0.9em;
    color: #495057;
  }

  .retry-btn {
    background: #ffc107;
    color: #212529;
    border: none;
    padding: 0.25rem 0.5rem;
    border-radius: 3px;
    font-size: 0.8em;
    cursor: pointer;
    margin-left: 8px;
  }

  .retry-btn:hover {
    background: #e0a800;
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