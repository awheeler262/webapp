type AuthUser = {
  email: string
}

function decodeUser(token: string | null): AuthUser | null {
  if (!token) return null
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
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
    const config = useRuntimeConfig()
    const { accessToken } = await $fetch<{ accessToken: string }>('/api/auth/login', {
      baseURL: config.public.apiBaseUrl,
      method: 'POST',
      body: { email, password }
    })
    token.value = accessToken
    user.value = decodeUser(accessToken)
  }

  function logout() {
    token.value = null
    user.value = null
    navigateTo('/')
  }

  return { user, isLoggedIn, login, logout }
}
