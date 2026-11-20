<script setup lang="ts">

definePageMeta({ layout: 'app', middleware: 'auth' })

import { useSupabase } from '~~/lib/supabase'

type Notification = { id: string; type: string; title: string; body: string; expense_id: string | null; read: boolean; created_at: string }
const notifications = ref<Notification[]>([])
const loading = ref(true)
const supabase = useSupabase()

async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

onMounted(async () => {
  try {
    notifications.value = await $fetch<Notification[]>('/api/notifications' as string, { headers: await authHeaders() })
  } catch {
    notifications.value = []
  } finally {
    loading.value = false
  }
})

async function markRead(body: { ids?: string[]; all?: boolean }) {
  await $fetch('/api/notifications/read' as string, { method: 'POST', headers: await authHeaders(), body }).catch(() => {})
}

const { set: setUnread } = useUnreadNotifications()

async function markAllRead() {
  notifications.value = notifications.value.map(n => ({ ...n, read: true }))
  setUnread(0)
  await markRead({ all: true })
}

async function openNotification(n: Notification) {
  if (!n.read) {
    n.read = true
    setUnread(notifications.value.filter(x => !x.read).length)
    markRead({ ids: [n.id] })
  }
  if (n.expense_id) await navigateTo(`/app/expenses/${n.expense_id}`)
}

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'Just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

const activeTab = ref<'all' | 'unread'>('all')
function setTab(id: string) { activeTab.value = id as 'all' | 'unread' }

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
const filtered = computed(() =>
  activeTab.value === 'unread' ? notifications.value.filter(n => !n.read) : notifications.value
)
</script>

<template>
  <AppPage>

    <!-- Header -->
    <AppPageHeader title="Notifications" description="Updates on expenses, approvals and payments.">
      <template #actions>
        <Button variant="outline" class="h-9 gap-1.5 rounded-lg px-4" :disabled="unreadCount === 0" @click="markAllRead">
          <Icon name="solar:check-read-linear" class="size-4" /> Mark all as read
        </Button>
      </template>
    </AppPageHeader>

    <!-- Tabs -->
    <AppPageTabs
      :model-value="activeTab"
      :tabs="[
        { id: 'all', label: 'All', count: notifications.length },
        { id: 'unread', label: 'Unread', count: unreadCount },
      ]"
      @update:model-value="setTab"
    />

    <!-- Loading -->
    <div v-if="loading" class="flex flex-col gap-3 pt-2">
      <Skeleton v-for="i in 4" :key="i" class="h-14 w-full rounded-lg" />
    </div>

    <!-- Empty state -->
    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center gap-3 py-28">
      <Icon name="solar:bell-linear" class="size-7 text-muted-foreground" />
      <p class="text-[15px] text-foreground">You're all caught up</p>
      <p class="-mt-1.5 text-sm text-muted-foreground">
        {{ activeTab === 'unread' ? 'No unread notifications.' : 'New notifications will appear here.' }}
      </p>
    </div>

    <!-- List -->
    <div v-else class="flex flex-col">
      <Button
        v-for="n in filtered"
        :key="n.id"
        variant="ghost"
        class="h-auto w-full items-start justify-start gap-3 rounded-none border-b border-border px-2 py-4 text-left whitespace-normal hover:bg-muted/40"
        @click="openNotification(n)"
      >
        <span class="mt-1.5 size-2 shrink-0 rounded-full" :class="n.read ? 'bg-transparent' : 'bg-primary'" />
        <Icon
          v-if="n.type === 'expense_approved'"
          name="solar:check-circle-linear"
          class="mt-0.5 size-4 shrink-0 text-emerald-500"
        />
        <div class="min-w-0 flex-1">
          <p class="text-sm text-foreground" :class="n.read ? 'font-normal' : 'font-medium'">{{ n.title }}</p>
          <p class="mt-0.5 text-[13px] font-normal text-muted-foreground">{{ n.body }}</p>
        </div>
        <span class="shrink-0 text-[12.5px] font-normal text-muted-foreground">{{ timeAgo(n.created_at) }}</span>
      </Button>
    </div>

  </AppPage>
</template>
