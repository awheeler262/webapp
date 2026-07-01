<script setup lang="ts">
// const { isLoggedIn, user } = useAuth()

// if (!isLoggedIn.value) {
//   await navigateTo('/')
// }

async function test() {
    const $api = useApi()
    const response = await $api('/api/fair', {
      method: 'POST',
      body: { message: 'Hello World!' }
    })
}
</script>

<template>
  <main class="fair">
    <h1>Factor Analysis of Information Risk (FAIR)</h1>
    <p>
        Apply the FAIR model to quantify information and operational risk in financial terms.
    </p>
    <p>
        Actual analysis happens on the backend with a prompt sent to Claude AI.
        We currently have this feature turned off because of token costs.
    </p>
    <button class="btn" @click="test">Test</button>
</main>
</template>

<style scoped>
.fair {
  padding: 4rem 2rem;
  font-family: "Noto Sans", Verdana, sans-serif;
}
h1 {
  text-align: center;
}
</style>
