<script>
  import Header from './components/Header.svelte';
  let name = 'Confidence Picks'
</script>

<Header />

<main>
  <h1>Welcome to {name}!</h1>
  <p>Your NFL picks competition starts here.</p>
</main>

<style>
  main {
    text-align: center;
    padding: 1em;
    max-width: 800px;
    margin: 0 auto;
  }

  h1 {
    color: #ff3e00;
    text-transform: uppercase;
    font-size: 4em;
    font-weight: 100;
  }
</style>