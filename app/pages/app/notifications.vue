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

// Status word per notification type — colours match the expense workflow steps
// (submitted/scheduled violet · manager/paid lime · finance cyan · rejected red)
const STATUS: Record<string, { label: string; cls: string; icon: string }> = {
  expense_submitted:        { label: 'To review', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', icon: 'solar:bolt-bold' },
  expense_manager_approved: { label: 'Approved',  cls: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300', icon: 'solar:user-check-linear' },
  expense_to_finance:       { label: 'To review', cls: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300', icon: 'solar:user-check-linear' },
  expense_finance_approved: { label: 'Approved',  cls: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-500/15 dark:text-cyan-300', icon: 'solar:wallet-money-linear' },
  expense_approved:         { label: 'Approved',  cls: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300', icon: 'solar:user-check-linear' },
  expense_scheduled:        { label: 'Scheduled', cls: 'bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300', icon: 'solar:calendar-linear' },
  expense_rejected:         { label: 'Rejected',  cls: 'bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300', icon: 'solar:close-circle-linear' },
  payout_paid:              { label: 'Paid',      cls: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300', icon: 'solar:check-circle-linear' },
  payout_paid_team:         { label: 'Paid',      cls: 'bg-lime-100 text-lime-800 dark:bg-lime-500/15 dark:text-lime-300', icon: 'solar:check-circle-linear' },
}
const statusOf = (type: string) => STATUS[type] ?? { label: '', cls: 'bg-muted text-muted-foreground', icon: 'solar:bell-linear' }

const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
function dayLabel(iso: string) {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(); yesterday.setDate(today.getDate() - 1)
  if (dayKey(d) === dayKey(today)) return 'Today'
  if (dayKey(d) === dayKey(yesterday)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}
function shortTime(iso: string) {
  const label = dayLabel(iso)
  if (label === 'Yesterday') return 'yesterday'
  if (label !== 'Today') return label
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  return `${Math.floor(s / 3600)}h`
}

const activeTab = ref<'all' | 'unread'>('all')
function setTab(id: string) { activeTab.value = id as 'all' | 'unread' }

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
const filtered = computed(() =>
  activeTab.value === 'unread' ? notifications.value.filter(n => !n.read) : notifications.value
)

// Group by day (list is already newest-first)
const groups = computed(() => {
  const out: { label: string; items: Notification[] }[] = []
  for (const n of filtered.value) {
    const label = dayLabel(n.created_at)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(n)
    else out.push({ label, items: [n] })
  }
  return out
})
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
    <div v-else-if="filtered.length === 0" class="flex flex-col items-center justify-center py-16">
      <!-- Illustration: stacked notification cards on soft rings -->
      <div class="relative flex size-[300px] items-center justify-center" aria-hidden="true">
        <span class="absolute inset-0 rounded-full border border-border/60" />
        <span class="absolute inset-[30px] rounded-full border border-border/60" />
        <span class="absolute inset-[64px] rounded-full bg-muted/60" />

        <div class="relative flex w-full flex-col items-center gap-3">
          <Card
            v-for="row in [
              { dot: 'bg-blue-500', ring: 'bg-blue-500/10', w: 'w-[220px]', size: 'sm' },
              { dot: 'bg-violet-600', ring: 'bg-violet-500/10', w: 'w-[300px]', size: 'lg' },
              { dot: 'bg-green-600', ring: 'bg-green-500/10', w: 'w-[220px]', size: 'sm' },
            ]"
            :key="row.dot"
            class="flex-row items-center gap-3 rounded-lg px-3 py-2.5 shadow-[0_2px_10px_rgba(0,0,0,0.06)]"
            :class="row.w"
          >
            <span
              class="flex shrink-0 items-center justify-center rounded-full"
              :class="[row.ring, row.size === 'lg' ? 'size-9' : 'size-6']"
            >
              <span class="rounded-full" :class="[row.dot, row.size === 'lg' ? 'size-2.5' : 'size-1.5']" />
            </span>
            <span class="flex flex-1 flex-col gap-1.5">
              <span class="flex gap-1.5">
                <span class="h-1.5 flex-[3] rounded-full bg-muted" />
                <span class="h-1.5 flex-[3] rounded-full bg-muted" />
                <span class="h-1.5 flex-[4] rounded-full bg-muted" />
              </span>
              <span class="flex gap-1.5">
                <span class="h-1.5 flex-[3] rounded-full bg-muted" />
                <span class="h-1.5 flex-[2] rounded-full bg-muted" />
                <span class="flex-[3]" />
              </span>
              <span class="flex gap-1.5">
                <span class="h-1.5 w-5 rounded-full bg-muted" />
                <span class="h-1.5 w-5 rounded-full bg-muted" />
              </span>
            </span>
          </Card>
        </div>
      </div>

      <p class="mt-6 text-lg font-medium text-foreground">Quiet as a mouse!</p>
      <p class="mt-1 text-[15px] text-muted-foreground">
        {{ activeTab === 'unread' ? 'No unread notifications — you’re all caught up.' : 'We’ll let you know when something pops up!' }}
      </p>
    </div>

    <!-- List -->
    <Card v-else class="gap-0 overflow-hidden rounded-xl py-0">
      <section v-for="g in groups" :key="g.label">
        <p class="px-5 pt-4 pb-1 text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">{{ g.label }}</p>
        <template v-for="(n, i) in g.items" :key="n.id">
          <Separator v-if="i > 0" class="mx-5 !w-auto border-t border-dashed border-border bg-transparent" />
          <Button
            variant="ghost"
            class="h-auto w-full items-center justify-start gap-3.5 rounded-none px-5 py-3 text-left font-normal whitespace-normal hover:bg-muted/40"
            @click="openNotification(n)"
          >
            <span
              class="size-2 shrink-0 rounded-full"
              :class="['bg-[#C8E63C]', n.read ? 'opacity-50' : '']"
            />
            <div class="min-w-0 flex-1">
              <p class="flex flex-wrap items-center gap-x-1.5 text-[14px] text-foreground" :class="n.read ? 'font-normal' : 'font-medium'">
                {{ n.title }}
                <span
                  v-if="statusOf(n.type).label"
                  class="inline-flex items-center gap-1 rounded-md px-1.5 py-px text-[11px] font-medium leading-4"
                  :class="statusOf(n.type).cls"
                >
                  <Icon :name="statusOf(n.type).icon" class="size-3" />{{ statusOf(n.type).label }}
                </span>
              </p>
              <p class="mt-0.5 truncate text-[13px] text-muted-foreground">{{ n.body }}</p>
            </div>
            <span class="shrink-0 font-mono text-[12px] text-muted-foreground">{{ shortTime(n.created_at) }}</span>
          </Button>
        </template>
      </section>
      <div class="h-2" />
    </Card>

  </AppPage>
</template>
