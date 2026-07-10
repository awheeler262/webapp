// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: false },
  app: {
    head: {
      title: 'Mycelium Dreams'
    }
  },
  modules: ['@nuxt/fonts'],
  css: ['~/assets/css/main.css'],
  runtimeConfig: {
    public: {
      apiBaseUrl: process.env.NUXT_PUBLIC_API_BASE_URL || ''
    }
  },
  $production: {
    vite: {
      esbuild: {
        pure: ['console.log', 'console.error']
      }
    }
  }
})
