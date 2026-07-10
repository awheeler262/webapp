type AuthUser = {
  id: string
  email: string
}

type Session = {
  user: AuthUser
  expiresAt: number
}

export function useAuth() {
  const user = useState<AuthUser | null>('auth_user', () => null)
  const expiresAt = useState<number | null>('auth_expires_at', () => null)
  // A missing expiresAt is treated as expired (fail closed), not "never expires" --
  // every real session from the API always includes it, so its absence means
  // something is wrong with the session data, not that it's permanently valid.
  const isLoggedIn = computed(() => !!user.value && !!expiresAt.value && Date.now() < expiresAt.value)

  function setSession(session: Session | null) {
    user.value = session?.user ?? null
    expiresAt.value = session?.expiresAt ?? null
  }

  function clearSession() {
    setSession(null)
  }

  // The token itself lives only in an httpOnly cookie now -- this app never
  // sees or stores it directly, only what the API tells it about the session.
  async function login(email: string, password: string) {
    const $api = useApi()
    const session = await $api<Session>('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    })
    setSession(session)
  }

  // Called on app startup/refresh, since there's no local token to decode
  // anymore -- ask the server who (if anyone) the cookie identifies. A 401
  // here just means "not logged in", not an error.
  async function fetchSession() {
    const $api = useApi()
    try {
      const session = await $api<Session>('/api/auth/me')
      setSession(session)
    } catch {
      clearSession()
    }
  }

  // The route middleware must never decide isLoggedIn before this first check
  // has actually resolved. callOnce() (not a plain module-level cached promise --
  // that's unsafe under SSR, where concurrent requests share the same Node
  // process/module state) ensures fetchSession() runs exactly once per app
  // instance: once server-side per request during SSR, and not redundantly
  // repeated client-side after hydration, while still reusing the result for
  // later client-side navigations within that same load.
  function ensureSession() {
    return callOnce('auth:session', fetchSession)
  }

  async function logout() {
    const $api = useApi()
    try {
      await $api('/api/auth/logout', { method: 'POST' })
    } finally {
      clearSession()
      navigateTo('/')
    }
  }

  return { user, isLoggedIn, expiresAt, login, logout, fetchSession, ensureSession, clearSession, setSession }
}
