import { $fetch } from 'ofetch'
import type { $Fetch } from 'ofetch'

declare module '#app' {
  interface NuxtApp {
    $api: $Fetch
  }
}

export default defineNuxtPlugin(() => {
  const config = useRuntimeConfig()

  const api = $fetch.create({
    baseURL: config.public.apiBaseUrl as string,
    onRequest({ options }) {
      const token = useCookie<string | null>('auth_token')
      if (token.value) {
        const headers = new Headers(options.headers)
        headers.set('Authorization', `Bearer ${token.value}`)
        options.headers = headers
      }
    },
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
        navigateTo('/')
      }
    }
  })

  return { provide: { api } }
})
