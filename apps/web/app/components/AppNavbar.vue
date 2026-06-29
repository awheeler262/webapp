<script setup lang="ts">
const { user, isLoggedIn, login, logout } = useAuth()

const showLoginForm = ref(false)
const email = ref('')
const password = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  loading.value = true
  try {
    await login(email.value, password.value)
    showLoginForm.value = false
    email.value = ''
    password.value = ''
  } catch (err: any) {
    error.value = err?.data?.message || 'Invalid email or password'
  } finally {
    loading.value = false
  }
}

function onLogout() {
  logout()
  showLoginForm.value = false
}
</script>

<template>
  <header class="navbar">
    <NuxtLink to="/" class="brand">MyApp</NuxtLink>

    <nav class="links">
      <NuxtLink to="/">Home</NuxtLink>
      <NuxtLink v-if="isLoggedIn" to="/chat">Chat</NuxtLink>
    </nav>

    <div class="auth">
      <template v-if="isLoggedIn">
        <span class="user">{{ user?.email }}</span>
        <button class="btn" @click="onLogout">Logout</button>
      </template>
      <template v-else>
        <button class="btn" @click="showLoginForm = !showLoginForm">Login</button>
        <form v-if="showLoginForm" class="login-form" @submit.prevent="onSubmit">
          <input v-model="email" type="email" placeholder="Email" required />
          <input v-model="password" type="password" placeholder="Password" required />
          <button class="btn btn-primary" type="submit" :disabled="loading">
            {{ loading ? 'Logging in...' : 'Sign in' }}
          </button>
          <p v-if="error" class="error">{{ error }}</p>
        </form>
      </template>
    </div>
  </header>
</template>

<style scoped>
.navbar {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 1rem 2rem;
  border-bottom: 1px solid #e5e5e5;
  position: relative;
}

.brand {
  font-weight: 700;
  font-size: 1.25rem;
  color: inherit;
  text-decoration: none;
}

.links {
  display: flex;
  gap: 1.25rem;
  flex: 1;
}

.links a {
  color: inherit;
  text-decoration: none;
  opacity: 0.8;
}

.links a:hover {
  opacity: 1;
}

.auth {
  position: relative;
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.user {
  font-size: 0.9rem;
  opacity: 0.8;
}

.btn {
  padding: 0.5rem 1rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  background: white;
  cursor: pointer;
}

.btn-primary {
  background: #111;
  color: white;
  border-color: #111;
}

.login-form {
  position: absolute;
  top: calc(100% + 0.5rem);
  right: 0;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding: 1rem;
  background: white;
  border: 1px solid #e5e5e5;
  border-radius: 8px;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  min-width: 220px;
  z-index: 10;
}

.login-form input {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 4px;
}

.error {
  color: #c0392b;
  font-size: 0.85rem;
  margin: 0;
}
</style>
