<script setup lang="ts">
const { isLoggedIn } = useAuth()
</script>

<template>
  <main class="landing">
    <section class="hero">
      <h1>Welcome | Bienvenido | مَرْحَبًا</h1>
      <p>Experimental Web Application</p>
      <!-- <NuxtLink v-if="isLoggedIn" to="/fair" class="cta">Go to FAIR</NuxtLink> -->
      <NuxtLink to="/fair" class="cta">Go to FAIR</NuxtLink>
      <!-- <p v-else class="hint">Log in to get started.</p> -->
    </section>
  </main>
</template>

<style scoped>
.landing {
  display: flex;
  justify-content: center;
  padding: 4rem 2rem;
  font-family: "Noto Sans", Verdana, sans-serif;
  background-color: #F5F7FA;
}

.hero {
  text-align: center;
  max-width: 480px;
}

.hero h1 {
  font-size: 2rem;
  margin-bottom: 0.5rem;
}

.hero p {
  opacity: 0.75;
  margin-bottom: 1.5rem;
}

.cta {
  display: inline-block;
  padding: 0.6rem 1.5rem;
  background: #111;
  color: white;
  border-radius: 6px;
  text-decoration: none;
}

.hint {
  font-size: 0.9rem;
}
</style>
