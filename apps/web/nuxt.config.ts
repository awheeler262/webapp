// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  modules: ['@nuxt/fonts'],
  runtimeConfig: {
    public: {
      apiBaseUrl: 'http://localhost:3001'
    }
  }
})
