import { useSupabase } from '~~/lib/supabase'

// Auth guard for the mobile UI (/m/**). Mirrors the /app checks in auth.ts.
export default defineNuxtRouteMiddleware(async () => {
  if (import.meta.server) return

  const supabase = useSupabase()
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return navigateTo('/login')

  const { data: member } = await supabase
    .from('org_members')
    .select('id')
    .eq('user_id', session.user.id)
    .single()

  if (!member) return navigateTo('/onboarding')
})
