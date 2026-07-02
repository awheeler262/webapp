import type { FetchError } from 'ofetch'

type AuthUser = {
  email: string
}

function decodeUser(token: string | null): AuthUser | null {
  if (!token) return null
  const raw_payload = token.split('.')[1]
  if (!raw_payload) return null
  try {
    const payload = JSON.parse(atob(raw_payload))
    return { email: payload.email }
  } catch {
    return null
  }
}

export function useAuth() {
  const token = useCookie<string | null>('auth_token', {
    default: () => null,
    sameSite: 'lax',
    maxAge: 60 * 60 * 24 * 7
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
    } catch (err) {
      const e = err as FetchError
      console.error(e)
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
