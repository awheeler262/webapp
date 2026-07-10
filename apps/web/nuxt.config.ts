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
    // Server-only: SSR-side $fetch calls run in Node, with no browser/current-page
    // origin to resolve a relative URL against, so they need the real backend
    // address directly -- the dev proxy below only intercepts browser-issued
    // requests hitting the Vite dev server itself.
    apiBaseUrlServer: process.env.API_BASE_URL || 'http://localhost:3001',
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
  $development: {
    vite: {
      server: {
        proxy: {
          // Keeps the browser talking to one origin in dev, matching production's
          // CloudFront-routed /api/* -- the httpOnly auth cookie would otherwise be
          // a genuinely cross-site cookie (web on :3000, api on :3001), which modern
          // browsers restrict in ways that make cross-origin cookie auth unreliable
          // even with SameSite=None; same-origin sidesteps the problem entirely.
          '/api': { target: 'http://localhost:3001', changeOrigin: true }
        }
      }
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
