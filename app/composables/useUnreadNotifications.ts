import { useSupabase } from '~~/lib/supabase'

// Shared unread-notification count (drives the dot on the navbar bell).
const _unread = ref(0)

export function useUnreadNotifications() {
  const supabase = useSupabase()

  async function refresh() {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { _unread.value = 0; return }
      const list = await $fetch<{ read: boolean }[]>('/api/notifications' as string, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      _unread.value = list.filter(n => !n.read).length
    } catch {
      _unread.value = 0
    }
  }

  function set(count: number) { _unread.value = Math.max(0, count) }

  return { unread: readonly(_unread), refresh, set }
}
