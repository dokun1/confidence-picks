<script>
  export let title = "Confidence Picks";
</script>

<header>
  <h1>{title}</h1>
  <nav>
    <ul>
      <li><a href="/">Home</a></li>
      <li><a href="/about">About</a></li>
      <li><a href="/login">Login</a></li>
      <li><a href="/groups">Groups</a></li>
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

  nav ul li a {
    color: white;
    text-decoration: none;
  }

  nav ul li a:hover {
    text-decoration: underline;
  }
</style>