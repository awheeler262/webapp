const CHECK_INTERVAL_MS = 5000

// The token lives only in an httpOnly cookie now -- there's no raw value this
// app can read to check independently, so expiry is tracked purely via the
// expiresAt timestamp the server returned at login/me time. That's also no
// longer a mismatch risk the way it was before: the server sets the cookie's
// own Max-Age to exactly match the JWT's real exp, so there's a single source
// of truth for expiry instead of two that could drift apart.
export default defineNuxtPlugin(() => {
  const route = useRoute()
  const { user, expiresAt, clearSession } = useAuth()

  setInterval(() => {
    if (user.value && expiresAt.value && Date.now() >= expiresAt.value) {
      clearSession()
      if (route.meta.requiresAuth) navigateTo('/')
    }
  }, CHECK_INTERVAL_MS)
})
