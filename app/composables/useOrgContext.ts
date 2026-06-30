import { useSupabase } from '~~/lib/supabase'
import type { OrgContext } from '~~/lib/supabase'

const _ctx = ref<OrgContext | null>(null)
const _loading = ref(false)

export function useOrgContext() {
  const supabase = useSupabase()

  async function load() {
    if (_ctx.value) return
    _loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      _ctx.value = await $fetch<OrgContext>('/api/orgs/context', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } finally {
      _loading.value = false
    }
  }

  function clear() { _ctx.value = null }

  return { ctx: readonly(_ctx), loading: readonly(_loading), load, clear }
}
