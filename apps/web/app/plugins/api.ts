import { $fetch } from 'ofetch'
import type { $Fetch } from 'ofetch'

declare module '#app' {
  interface NuxtApp {
    $api: $Fetch
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()
  // Client-side calls are relative (public.apiBaseUrl is empty), hitting the same
  // origin the page loaded from -- in dev that's the Vite proxy forwarding /api to
  // the real backend, matching production's CloudFront same-origin routing. SSR
  // calls run in Node with no browser/page origin to resolve a relative URL
  // against, so they need the real backend address directly.
  const baseURL = import.meta.server ? (config.apiBaseUrlServer as string) : (config.public.apiBaseUrl as string)
  // credentials:'include' only means anything for actual browser fetches. During
  // SSR (nuxt dev runs it; the real prod build never does, it's pure static) the
  // $fetch call runs in Node, which has no browser cookie jar at all -- forward
  // the incoming request's own Cookie header manually so that side of things sees
  // the same session a real browser call would. Empty/no-op on the client.
  const forwardedHeaders = import.meta.server ? useRequestHeaders(['cookie']) : undefined

  const api = $fetch.create({
    baseURL,
    headers: forwardedHeaders,
    // The auth_token cookie is httpOnly now -- this app can't read it to build
    // an Authorization header itself. `credentials: 'include'` tells the browser
    // to attach it automatically (and accept the Set-Cookie that comes back).
    // Meaningless in Node (SSR) -- only set it for real browser fetches.
    credentials: import.meta.server ? undefined : 'include',
    onRequestError({ error }) {
      const message = error.message ?? 'unknown error'
      throw {
        status: 0,
        data: { message: `Network error: ${message}` },
        raw: error
      };
    },
    onResponseError({ response }) {
      if (response && response.status === 401) {
        // The frontend has no way to inspect the (httpOnly) cookie itself to
        // notice a session has gone stale server-side -- a 401 is the signal.
        const { clearSession } = useAuth()
        clearSession()
        navigateTo('/')
      }
    }
  })

  return { provide: { api } }
})
