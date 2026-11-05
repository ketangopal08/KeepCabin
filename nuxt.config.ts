/// <reference types="node" />
import tailwindcss from '@tailwindcss/vite'

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: process.env.NODE_ENV === 'development' },
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
  // Supabase session lives in the browser only, so the server can't run the auth check.
  // Render /app client-side so logged-out users are redirected before any dashboard UI shows.
  routeRules: {
    '/app': { ssr: false },
    '/app/**': { ssr: false },
  },
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
    resendApiKey: process.env.RESEND_API_KEY ?? '',
    brevoApiKey: process.env.BREVO_API_KEY ?? '',
    brevoSenderEmail: process.env.BREVO_SENDER_EMAIL ?? '',
    appUrl: process.env.APP_URL ?? 'http://localhost:3000',
    public: {
      supabaseUrl: process.env.SUPABASE_URL ?? '',
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY ?? '',
    },
  },
  css: ['~/assets/css/main.css', 'vue-sonner/style.css'],
})
