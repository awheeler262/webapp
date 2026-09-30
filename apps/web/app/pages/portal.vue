<script setup lang="ts">
// Public route on purpose -- requiresAuth:true would make the global auth
// middleware (auth.global.ts) redirect a logged-out visitor away before this
// page ever rendered, which would prevent showing the "log in" message here
// at all. Content branches on isLoggedIn instead, same as the removed /fair
// page did.
definePageMeta({ requiresAuth: false })

const { isLoggedIn, tenants } = useAuth()

const tenantOptions = computed(() => {
  const seen = new Map<string, string>()
  for (const t of tenants.value) {
    if (!seen.has(t.tenantId)) seen.set(t.tenantId, t.tenantName)
  }
  return [...seen.entries()].map(([tenantId, tenantName]) => ({ tenantId, tenantName }))
})

const selectedTenantId = ref('')
const selectedRoleId = ref('')

// A user can hold more than one role in the same tenant (tenant_users has no
// unique constraint on (user_id, tenant_id)), so this is a filter, not a lookup.
const roleOptions = computed(() =>
  tenants.value.filter((t) => t.tenantId === selectedTenantId.value)
)

watch(tenantOptions, (options) => {
  if (!options.some((o) => o.tenantId === selectedTenantId.value)) {
    selectedTenantId.value = options[0]?.tenantId ?? ''
  }
}, { immediate: true })

watch([selectedTenantId, roleOptions], ([, options]) => {
  if (!options.some((o) => o.roleId === selectedRoleId.value)) {
    selectedRoleId.value = options[0]?.roleId ?? ''
  }
})

const prompt = ref('')
const response = ref('')
const error = ref('')
const loading = ref(false)

async function onSubmit() {
  error.value = ''
  response.value = ''
  loading.value = true
  try {
    const $api = useApi()
    const result = await $api<{ status: string }>('/api/boost/query', {
      method: 'POST',
      body: { prompt: prompt.value },
      headers: {
        'X-Tenant-Id': selectedTenantId.value,
        'X-Role-Id': selectedRoleId.value
      }
    })
    response.value = result.status
  } catch (err: any) {
    // Deliberately generic -- don't echo the backend's raw error text,
    // matching AppNavbar.vue's login-form error handling.
    error.value = err?.statusCode
      ? 'Something went wrong. Please try again.'
      : 'Network error — check your connection'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <main class="portal">
    <h1>Portal</h1>

    <p v-if="!isLoggedIn" class="login-prompt">Login to enter portal</p>

    <template v-else>
      <p v-if="tenantOptions.length === 0" class="empty">
        No tenants are available for your account.
      </p>

      <form v-else class="query-form" @submit.prevent="onSubmit">
        <div class="selects">
          <label>
            Tenant
            <select v-model="selectedTenantId">
              <option v-for="t in tenantOptions" :key="t.tenantId" :value="t.tenantId">
                {{ t.tenantName }}
              </option>
            </select>
          </label>

          <label>
            Role
            <select v-model="selectedRoleId">
              <option v-for="r in roleOptions" :key="r.roleId" :value="r.roleId">
                {{ r.roleName }}
              </option>
            </select>
          </label>
        </div>

        <label class="textarea-field">
          Query
          <textarea v-model="prompt" rows="6" required placeholder="Enter your query..." />
        </label>

        <button class="btn btn-primary" type="submit" :disabled="loading || !selectedRoleId">
          {{ loading ? 'Submitting...' : 'Submit' }}
        </button>

        <p v-if="error" class="error">{{ error }}</p>

        <label class="textarea-field">
          Response
          <textarea :value="response" rows="6" readonly placeholder="Response will appear here..." />
        </label>
      </form>
    </template>
  </main>
</template>

<style scoped>
.portal {
  padding: 4rem 2rem;
  font-family: "Noto Sans", Verdana, sans-serif;
  max-width: 700px;
  margin: 0 auto;
  background-color: #F5F7FA;
}

h1 {
  text-align: center;
}

.login-prompt,
.empty {
  text-align: center;
  color: #666;
  margin-top: 2rem;
}

.query-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
  margin-top: 2rem;
}

.selects {
  display: flex;
  gap: 1rem;
}

.selects label {
  flex: 1;
}

label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.9rem;
  color: #444;
}

select,
textarea {
  padding: 0.5rem;
  border: 1px solid #ccc;
  border-radius: 6px;
  font: inherit;
}

textarea {
  resize: vertical;
}

.btn {
  align-self: flex-start;
  padding: 0.5rem 1.25rem;
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

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.error {
  color: #c0392b;
  font-size: 0.85rem;
  margin: 0;
}
</style>
