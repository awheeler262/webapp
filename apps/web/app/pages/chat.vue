<script setup lang="ts">
const { isLoggedIn, user } = useAuth()

if (!isLoggedIn.value) {
  await navigateTo('/')
}
</script>

<template>
  <main class="chat">
    <h1>Chat</h1>
    <p>Signed in as {{ user?.email }}. Chat is coming soon.</p>
  </main>
</template>

<style scoped>
.chat {
  padding: 4rem 2rem;
  text-align: center;
}
</style>
