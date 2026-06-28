import { useSupabase } from '~~/lib/supabase'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const supabase = useSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  // Protect /app/* routes
  if (!session && to.path.startsWith('/app')) {
    return navigateTo('/login')
  }

  // Redirect away from login if already authenticated
  if (session && to.path === '/login') {
    return navigateTo('/app')
  }
})
