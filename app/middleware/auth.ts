import { useSupabase } from '~~/lib/supabase'

export default defineNuxtRouteMiddleware(async (to) => {
  if (import.meta.server) return

  const supabase = useSupabase()
  const { data: { session } } = await supabase.auth.getSession()

  if (!session && to.path.startsWith('/app')) {
    return navigateTo('/login')
  }

  if (session && to.path === '/login') {
    return navigateTo('/app')
  }

  if (session && to.path.startsWith('/app')) {
    const { data: member } = await supabase
      .from('org_members')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (!member) {
      return navigateTo('/onboarding')
    }
  }

  if (session && to.path === '/onboarding') {
    const { data: member } = await supabase
      .from('org_members')
      .select('id')
      .eq('user_id', session.user.id)
      .single()

    if (member) {
      return navigateTo('/app')
    }
  }
})
