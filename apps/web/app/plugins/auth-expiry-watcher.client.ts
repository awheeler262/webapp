import { isTokenExpired } from '~/composables/useAuth'

const CHECK_INTERVAL_MS = 5000

// Reads document.cookie directly rather than going through useCookie()/useAuth().token:
// Nuxt's useCookie ref only re-syncs opportunistically (e.g. on navigation, or whenever
// something else happens to touch it), not on a real background timer -- so relying on
// it here would inherit that same unreliable timing instead of fixing it.
function getRawAuthToken(): string | null {
  const value = document.cookie.match(/(?:^|; )auth_token=([^;]*)/)?.[1]
  return value ? decodeURIComponent(value) : null
}

export default defineNuxtPlugin(() => {
  const route = useRoute()
  const { clearSession } = useAuth()

  setInterval(() => {
    const raw = getRawAuthToken()

    if (!raw || isTokenExpired(raw)) {
      clearSession()
      if (route.meta.requiresAuth) navigateTo('/')
    }
  }, CHECK_INTERVAL_MS)
})
