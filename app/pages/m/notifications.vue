<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'

definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

type Notification = { id: string; type: string; title: string; body: string; expense_id: string | null; read: boolean; created_at: string }
const notifications = ref<Notification[]>([])
const loading = ref(true)
const supabase = useSupabase()


async function authHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function fetchNotifications() {
  try {
    notifications.value = await $fetch<Notification[]>('/api/notifications' as string, { headers: await authHeaders() })
  } catch {
    notifications.value = []
  } finally {
    loading.value = false
  }
}

onMounted(fetchNotifications)

async function markRead(body: { ids?: string[]; all?: boolean }) {
  await $fetch('/api/notifications/read' as string, { method: 'POST', headers: await authHeaders(), body }).catch(() => {})
}

const { set: setUnread } = useUnreadNotifications()

async function refresh() {
  await fetchNotifications()
  // Keep the shared unread count (home bell dot) in sync with what we just loaded.
  setUnread(notifications.value.filter(n => !n.read).length)
}

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
  if (n.expense_id) await navigateTo(`/m/expenses/${n.expense_id}`)
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

const unreadCount = computed(() => notifications.value.filter(n => !n.read).length)
const filtered = computed(() =>
  activeTab.value === 'unread' ? notifications.value.filter(n => !n.read) : notifications.value,
)
const tabs = computed(() => [
  { id: 'all' as const, label: 'All', count: notifications.value.length },
  { id: 'unread' as const, label: 'Unread', count: unreadCount.value },
])

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
  <MobilePullToRefresh :on-refresh="refresh">
    <div class="flex flex-col">
      <MobilePageHeader title="Inbox" :subtitle="unreadCount ? `${unreadCount} unread` : 'All caught up'">
        <template #action>
          <Button
            variant="secondary"
            size="icon-lg"
            class="m-press rounded-full"
            aria-label="Mark all as read"
            :disabled="unreadCount === 0"
            @click="markAllRead"
          >
            <Icon name="solar:check-read-linear" class="size-5" />
          </Button>
        </template>
      </MobilePageHeader>

      <!-- ── Segmented tabs ──────────────────────────────────────── -->
      <div class="m-rise mb-5 grid grid-cols-2 gap-1 rounded-full bg-muted/60 p-1" style="--d: 60ms">
        <Button
          v-for="t in tabs"
          :key="t.id"
          variant="ghost"
          class="m-press h-10 rounded-full text-[13px] font-semibold"
          :class="activeTab === t.id ? 'bg-background text-foreground shadow-sm hover:bg-background' : 'text-muted-foreground hover:bg-transparent'"
          @click="activeTab = t.id; haptic('selection')"
        >
          {{ t.label }}
          <Badge
            variant="secondary"
            class="h-5 min-w-5 rounded-full px-1.5 text-[11px] tabular-nums"
            :class="activeTab === t.id ? 'bg-foreground text-background' : ''"
          >
            {{ t.count }}
          </Badge>
        </Button>
      </div>

      <!-- ── Loading ─────────────────────────────────────────────── -->
      <div v-if="loading" class="flex flex-col gap-3">
        <Skeleton class="h-4 w-16 rounded-md" />
        <Skeleton v-for="n in 5" :key="n" class="h-[76px] rounded-3xl" />
      </div>

      <!-- ── Empty ───────────────────────────────────────────────── -->
      <Card v-else-if="filtered.length === 0" class="m-rise items-center gap-2 rounded-3xl border-0 bg-muted/60 px-6 py-12 text-center shadow-none ring-0" style="--d: 120ms">
        <span class="mb-2 flex size-16 items-center justify-center rounded-full bg-background">
          <Icon name="solar:bell-off-linear" class="size-7 text-muted-foreground" />
        </span>
        <p class="text-[15px] font-semibold text-foreground">Quiet as a mouse!</p>
        <p class="text-[12.5px] text-muted-foreground">
          {{ activeTab === 'unread' ? 'No unread notifications — you’re all caught up.' : 'We’ll let you know when something pops up!' }}
        </p>
      </Card>

      <!-- ── Grouped list ────────────────────────────────────────── -->
      <div v-else class="flex flex-col gap-6">
        <section
          v-for="(g, gi) in groups"
          :key="g.label"
          class="m-rise"
          :style="{ '--d': `${120 + gi * 60}ms` }"
        >
          <p class="mb-2.5 px-1 text-[11.5px] font-medium uppercase tracking-wider text-muted-foreground">{{ g.label }}</p>
          <TransitionGroup name="m-list" tag="div" class="relative flex flex-col gap-2">
            <Button
              v-for="n in g.items"
              :key="n.id"
              variant="ghost"
              class="m-press h-auto w-full items-start justify-start gap-3 rounded-3xl p-3.5 text-left font-normal whitespace-normal"
              :class="n.read ? 'bg-transparent hover:bg-muted/40' : 'bg-muted/60 hover:bg-muted/60'"
              @click="openNotification(n)"
            >
              <span class="relative shrink-0">
                <span class="flex size-11 items-center justify-center rounded-2xl" :class="statusOf(n.type).cls">
                  <Icon :name="statusOf(n.type).icon" class="size-5" />
                </span>
              </span>
              <span class="min-w-0 flex-1">
                <span class="flex items-start justify-between gap-2">
                  <span class="line-clamp-2 text-[13.5px] leading-snug text-foreground" :class="n.read ? 'font-normal' : 'font-semibold'">
                    {{ n.title }}
                  </span>
                  <span class="flex shrink-0 items-center gap-1.5 pt-0.5">
                    <span class="text-[11px] tabular-nums text-muted-foreground">{{ shortTime(n.created_at) }}</span>
                    <span v-if="!n.read" class="size-2 rounded-full bg-[#C8E63C]" aria-label="Unread" />
                  </span>
                </span>
                <span class="mt-0.5 line-clamp-2 block text-[12.5px] leading-snug text-muted-foreground">{{ n.body }}</span>
                <span v-if="statusOf(n.type).label || n.expense_id" class="mt-2 flex items-center justify-between gap-2">
                  <Badge v-if="statusOf(n.type).label" variant="secondary" class="h-5 rounded-full border-0 px-2 text-[11px] font-medium" :class="statusOf(n.type).cls">
                    {{ statusOf(n.type).label }}
                  </Badge>
                  <span v-else />
                  <Icon v-if="n.expense_id" name="solar:alt-arrow-right-linear" class="size-4 text-muted-foreground" />
                </span>
              </span>
            </Button>
          </TransitionGroup>
        </section>
      </div>
    </div>
  </MobilePullToRefresh>
</template>
