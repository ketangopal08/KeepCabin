/// <reference types="node" />
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'icon', type: 'image/svg+xml', href: '/logo.svg' },
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap' },
      ],
    },
  },
  vite: {
    plugins: [tailwindcss()],
  },
  modules: [],
  // UI components registered without path prefix so <Button>, <Card>, <Sidebar> etc. work directly.
  // The full ~/components scan still runs (for landing/ and app/ prefixed components),
  // registering UI components a second time as <UiButton> etc. — different names, no conflict.
  // extensions: ['.vue'] on both entries prevents index.ts files from being picked up as components.
  components: [
    { path: '~/components/ui', pathPrefix: false, extensions: ['.vue'] },
    { path: '~/components', extensions: ['.vue'] },
  ],
  typescript: {
    tsConfig: {
      compilerOptions: {
        types: ['node'],
      },
    },
  },
  runtimeConfig: {
    googleDriveApiKey: process.env.GOOGLE_DRIVE_API_KEY,
    supabaseServiceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  },
  css: ['~/assets/css/main.css'],
})
