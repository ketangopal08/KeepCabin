/// <reference types="node" />
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },
  app: {
    head: {
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Manrope:wght@200..800&display=swap' },
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
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  },
  css: ['~/assets/css/main.css'],
})
