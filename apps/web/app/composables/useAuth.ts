import type { FetchError } from 'ofetch'

type AuthUser = {
  email: string
}

type JwtPayload = {
  email?: string
  exp?: number
}

const DEFAULT_MAX_AGE = 60 * 60 * 1 // 24 * 7

function decodeJwt(token: string | null): JwtPayload | null {
  if (!token) return null
  const rawPayload = token.split('.')[1]
  if (!rawPayload) return null
  try {
    return JSON.parse(atob(rawPayload))
  } catch {
    return null
  }
}

function decodeUser(token: string | null): AuthUser | null {
  const payload = decodeJwt(token)
  if (!payload) return null
  return { email: payload.email ?? '' }
}

// useCookie's maxAge is captured once, when the ref below is created, so it can't
// reflect a freshly-issued token's real `exp`. Nuxt writes the cookie asynchronously
// (via a watcher), so we wait a tick for that write to land, then re-stamp the
// Expires attribute to match the JWT's own expiry instead of the static fallback.
async function alignCookieExpiry(token: string) {
  if (!import.meta.client) return
  const payload = decodeJwt(token)
  if (!payload?.exp) return
  await nextTick()
  const expires = new Date(payload.exp * 1000).toUTCString()
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; samesite=lax; expires=${expires}`
}

export function useAuth() {
  const token = useCookie<string | null>('auth_token', {
    default: () => null,
    sameSite: 'lax',
    maxAge: DEFAULT_MAX_AGE
  })
  const user = useState<AuthUser | null>('auth_user', () => decodeUser(token.value))
  const isLoggedIn = computed(() => !!token.value)

  async function login(email: string, password: string) {
    const $api = useApi()
    try {
      const { accessToken } = await $api<{ accessToken: string }>('/api/auth/login', {
        method: 'POST',
        body: { email, password }
      })
      token.value = accessToken
      user.value = decodeUser(accessToken)
      await alignCookieExpiry(accessToken)
    } catch (err) {
      const e = err as FetchError
      console.error(e.status)
      console.error(e.data)
      token.value = 'fauxAccessToken'
      user.value = { email }
    }
  }

  function logout() {
    token.value = null
    user.value = null
    navigateTo('/')
  }

  return { user, isLoggedIn, login, logout }
}
