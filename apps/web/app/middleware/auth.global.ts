import { isTokenExpired } from '~/composables/useAuth'

export default defineNuxtRouteMiddleware((to) => {
  const { token, clearSession, isLoggedIn } = useAuth()

  if (token.value && isTokenExpired(token.value)) {
    clearSession()
    if (to.path !== '/') return navigateTo('/')
  }

  if (to.meta.requiresAuth && !isLoggedIn.value) {
    return navigateTo('/')
  }
})
