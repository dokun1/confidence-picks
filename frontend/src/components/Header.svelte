<script>
  import { navigateTo } from '../lib/router.js';
  
  export let title = "Confidence Picks";
  
  function handleNavigation(route) {
    navigateTo(route);
  }
</script>

<header>
  <h1>{title}</h1>
  <nav>
    <ul>
      <li><button on:click={() => handleNavigation('home')}>Home</button></li>
      <li><button on:click={() => handleNavigation('games')}>Games</button></li>
      <li><a href="/about">About</a></li>
      <li><a href="/login">Login</a></li>
    </ul>
  </nav>
</header>

<style>
  header {
    background-color: #282c34;
    padding: 1rem;
    color: white;
    text-align: center;
  }

  nav ul {
    list-style-type: none;
    padding: 0;
  }

  nav ul li {
    display: inline;
    margin: 0 1rem;
  }

  nav ul li button {
    background: none;
    border: none;
    color: white;
    text-decoration: none;
    cursor: pointer;
    font-size: 1rem;
  }

  nav ul li button:hover,
  nav ul li a:hover {
    text-decoration: underline;
  }

  nav ul li a {
    color: white;
    text-decoration: none;
  }
</style>