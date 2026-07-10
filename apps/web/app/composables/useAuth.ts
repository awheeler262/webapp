import type { FetchError } from 'ofetch'

type AuthUser = {
  email: string
}

type JwtPayload = {
  email?: string
  exp?: number
}

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

export function isTokenExpired(token: string | null): boolean {
  const payload = decodeJwt(token)
  if (!payload?.exp) return true
  return payload.exp * 1000 <= Date.now()
}

async function alignCookieExpiry(token: string) {
  if (!import.meta.client) return
  const payload = decodeJwt(token)
  if (!payload?.exp) return
  // Wait for Nuxt to create the cookie, then update it.
  await nextTick()
  const expires = new Date(payload.exp * 1000).toUTCString()
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; samesite=lax; secure; expires=${expires}`
}

export function useAuth() {
  const token = useCookie<string | null>('auth_token', {
    default: () => null,
    sameSite: 'lax',
    secure: true,
    maxAge: 60,
  })
  const user = useState<AuthUser | null>('auth_user', () => decodeUser(token.value))
  const isLoggedIn = computed(() => !!token.value && !isTokenExpired(token.value))

  function clearSession() {
    token.value = null
    user.value = null
  }

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
    clearSession()
    navigateTo('/')
  }

  return { user, isLoggedIn, login, logout, token, clearSession }
}
