<script setup lang="ts">
</script>

<template>
  <div class="card">
    <h1>Aaron Wheeler</h1>

    <div class="tagline">
        Research • Data • Technology
    </div>

    <p>
      This site includes information about my projects, interests, and ongoing work.
    </p>

    <div class="links">
      <a class="button" href="https://www.linkedin.com/in/wheelera/"
        target="_blank" rel="noopener noreferrer">
          LinkedIn
      </a>

      <a class="button" href="https://www.patreon.com/cw/AarontheGeographer"
        target="_blank" rel="noopener noreferrer">
          Patreon
      </a>
    </div>
    <footer>
      Understanding and educating through research, data analysis, and
      technology.
    </footer>
  </div>
</template>

<style scoped>
.card {
    align-items: center;
    background-color: #F5F7FA;
    font-family: "Noto Sans", Verdana, sans-serif;
    justify-content: center;
    margin: 0 auto;
    max-width: 900px;
    padding: 4rem 2rem;
    text-align: center;
}

h1 {
    font-size: 3rem;
    font-weight: 600;
    margin: 0;
}

.tagline {
    color: var(--muted);
    letter-spacing: 0.05em;
    margin: 0.5rem 0 2rem;
}

p {
    line-height: 1.7;
    margin-bottom: 2rem;
}

.links {
    display: flex;
    gap: 1rem;
    justify-content: center;
}

.button {
    border: 1px solid #2F3A56;
    border-radius: 8px;
    color: inherit;
    padding: 0.8rem 1.4rem;
    text-decoration: none;
    transition: background 0.2s;
}

.button:hover {
    background: #f0f0f0;
}

footer {
    color: var(--muted);
    font-size: 0.9rem;
    margin-top: 3rem;
}
</style>
