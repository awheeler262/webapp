export default defineNuxtRouteMiddleware(async (to) => {
  const { user, expiresAt, clearSession, isLoggedIn, ensureSession } = useAuth()

  // Must resolve before any isLoggedIn check below -- on the very first
  // navigation of a fresh page load, nothing has populated user/expiresAt yet.
  await ensureSession()

  // Missing expiresAt counts as expired too (fail closed) -- see useAuth.ts.
  if (user.value && (!expiresAt.value || Date.now() >= expiresAt.value)) {
    clearSession()
    if (to.path !== '/') return navigateTo('/')
  }

  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return navigateTo('/')
  }
})
