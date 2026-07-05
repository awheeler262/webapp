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
  vite: {
    build: {
      // Avoids a runtime-injected inline <script> for browsers without native
      // modulepreload support — every evergreen browser has it, and the injected
      // polyfill can't be covered by a build-time CSP hash since it doesn't exist
      // in the static HTML output.
      modulePreload: { polyfill: false }
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
