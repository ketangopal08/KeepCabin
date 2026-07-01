import { useSupabase } from '~~/lib/supabase'
import type { OrgContext } from '~~/lib/supabase'
import type { User } from '@supabase/supabase-js'

const _ctx = ref<OrgContext | null>(null)
const _loading = ref(false)
const _user = ref<User | null>(null)

export function useOrgContext() {
  const supabase = useSupabase()

  async function load() {
    if (_ctx.value) return
    _loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      _user.value = session.user
      _ctx.value = await $fetch<OrgContext>('/api/orgs/context', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
    } finally {
      _loading.value = false
    }
  }

  function clear() { _ctx.value = null; _user.value = null }

  return { ctx: readonly(_ctx), user: readonly(_user), loading: readonly(_loading), load, clear }
}
