<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'

const route = useRoute()

// Search popup — also opens with ⌘K / Ctrl+K
const searchOpen = ref(false)
const searchQuery = ref('')
watch(searchOpen, (open) => { if (!open) searchQuery.value = '' })
function onKeydown(e: KeyboardEvent) {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault()
    searchOpen.value = !searchOpen.value
  }
}
onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
const { ctx, user } = useOrgContext()
const userInitials = computed(() => {
  const u = user.value as any
  const name: string = u?.user_metadata?.full_name ?? u?.email ?? ''
  return name.split(/[\s@.]/).filter(Boolean).map((w: string) => w[0]).join('').slice(0, 2).toUpperCase() || 'KC'
})
const role = computed(() => ctx.value?.member?.role)

// Bell dot: only when there are unread notifications (re-checked on every page change)
const { unread: unreadNotifications, refresh: refreshUnread } = useUnreadNotifications()
watch(() => [route.path, ctx.value?.org?.id], () => { if (ctx.value?.org?.id) refreshUnread() }, { immediate: true })

// Profile photo (user_metadata.avatar_url) — updates live after upload/remove in Settings.
const avatarUrl = ref<string>('')
watch(user, (u: any) => { avatarUrl.value = u?.user_metadata?.avatar_url ?? '' }, { immediate: true })
let authSub: { unsubscribe: () => void } | null = null
onMounted(() => {
  authSub = useSupabase().auth.onAuthStateChange((_e, session) => {
    avatarUrl.value = session?.user?.user_metadata?.avatar_url ?? ''
  }).data.subscription
})
onBeforeUnmount(() => authSub?.unsubscribe())

const { triggerSave, saving, saved } = useSettingsBar()
const isSettings = computed(() => route.path === '/app/settings')

type PageDef = { label: string; icon: any; action?: { label: string; href: string; ownerOnly?: boolean } }

const pages: Record<string, PageDef> = {
  '/app':              { label: 'Dashboard',      icon: 'solar:widget-2-linear' },
  '/app/expenses':     { label: 'Expenses',        icon: 'solar:bill-list-linear',   action: { label: 'New Expense', href: '/app/expenses/new' } },
  '/app/expenses/new': { label: 'Submit Expense',  icon: 'solar:add-linear' },
  '/app/approvals':    { label: 'Approvals',       icon: 'solar:check-circle-linear' },
  '/app/payments':     { label: 'Payments',        icon: 'solar:card-linear' },
  '/app/teams':        { label: 'Teams',           icon: 'solar:users-group-rounded-linear',     action: { label: 'New Team', href: '/app/teams/new', ownerOnly: true } },
  '/app/org':          { label: 'Organization',    icon: 'solar:buildings-2-linear' },
  '/app/reports':      { label: 'Reports',         icon: 'solar:file-download-linear' },
  '/app/settings':     { label: 'Settings',        icon: 'solar:settings-linear' },
  '/app/upgrade':      { label: 'Upgrade',         icon: 'solar:settings-linear' },
  '/app/notifications': { label: 'Notifications',  icon: 'solar:bell-linear' },
}

const current = computed<PageDef>(() => {
  if (pages[route.path]) return pages[route.path]
  if (route.path.startsWith('/app/teams/')) return { label: 'Team', icon: 'solar:users-group-rounded-linear' }
  if (route.path.startsWith('/app/expenses/')) return { label: 'Expense', icon: 'solar:bill-list-linear' }
  return { label: 'KeepCabin', icon: 'solar:widget-2-linear' }
})

const showAction = computed(() => {
  if (!current.value.action) return false
  if (current.value.action.ownerOnly && role.value !== 'owner') return false
  return true
})
</script>

<template>
  <header class="sticky top-0 z-20 h-12 shrink-0 [--text-sm:0.8rem] bg-background border-b border-border flex items-center px-4 gap-3">

    <!-- shadcn SidebarTrigger handles collapse/expand -->
    <SidebarTrigger class="-ml-1 text-muted-foreground hover:text-foreground" />

    <!-- Breadcrumb -->
    <div class="flex items-center gap-2 text-sm flex-1 min-w-0">
      <span class="text-foreground/80 shrink-0 capitalize">{{ ctx?.org?.name ?? 'KeepCabin' }}</span>
      <Icon name="solar:alt-arrow-right-linear" class="size-4 text-muted-foreground shrink-0" />
      <span class="font-medium text-foreground truncate">{{ current.label }}</span>
    </div>

    <!-- Center search (opens search popup) -->
    <Button
      variant="outline"
      class="absolute left-1/2 top-1/2 hidden h-8 w-[300px] -translate-x-1/2 -translate-y-1/2 cursor-pointer justify-start gap-2 rounded-lg bg-transparent px-3 text-sm font-normal text-muted-foreground hover:text-muted-foreground md:inline-flex dark:bg-transparent"
      @click="searchOpen = true"
    >
      <Icon name="solar:magnifer-linear" class="size-4" />
      <span class="flex-1 text-left">Search everything...</span>
      <kbd class="flex items-center gap-1 font-sans text-[11px] text-muted-foreground">
        <span class="flex size-5 items-center justify-center rounded border border-border">⌘</span>
        <span class="flex size-5 items-center justify-center rounded border border-border">K</span>
      </kbd>
    </Button>

    <!-- Settings: Save changes -->
    <Button v-if="isSettings" size="sm" class="h-8 text-[12.5px] gap-1.5" :disabled="saving" @click="triggerSave">
      <Icon name="solar:check-linear" v-if="saved" class="size-3.5" />
      {{ saved ? 'Saved!' : saving ? 'Saving…' : 'Save changes' }}
    </Button>

    <!-- Permanent right-side actions -->
    <div v-else class="flex items-center gap-2 shrink-0">
      <Button variant="outline" class="h-8 gap-1.5 rounded-lg px-3 text-sm font-medium" as-child>
        <NuxtLink to="/app/help">
          <Icon name="solar:question-circle-linear" class="size-4" /> Help
        </NuxtLink>
      </Button>
      <Button variant="outline" size="icon" class="relative rounded-lg" as-child>
        <NuxtLink to="/app/notifications">
          <Icon name="solar:bell-linear" class="size-4" />
          <span v-if="unreadNotifications > 0" class="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-primary" />
        </NuxtLink>
      </Button>
      <Button variant="outline" size="icon" class="overflow-hidden rounded-full p-0 text-[11px] font-semibold" as-child>
        <NuxtLink to="/app/settings" aria-label="Profile settings">
          <img v-if="avatarUrl" :src="avatarUrl" alt="" class="size-full object-cover" @error="avatarUrl = ''" />
          <template v-else>{{ userInitials }}</template>
        </NuxtLink>
      </Button>
    </div>

    <!-- ── Search popup (template) ── -->
    <Dialog v-model:open="searchOpen">
      <DialogContent class="gap-0 p-0 sm:max-w-[560px]" :show-close-button="false">
        <DialogTitle class="sr-only">Search</DialogTitle>
        <DialogDescription class="sr-only">Search across KeepCabin</DialogDescription>
        <div class="relative border-b border-border">
          <Icon name="solar:magnifer-linear" class="pointer-events-none absolute top-1/2 left-4 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            v-model="searchQuery"
            autofocus
            placeholder="Search everything..."
            class="h-12 rounded-none border-0 bg-transparent pl-11 text-sm shadow-none focus-visible:ring-0 dark:bg-transparent"
          />
        </div>
        <div class="flex flex-col items-center justify-center gap-2 px-6 py-14 text-center">
          <Icon name="solar:magnifer-linear" class="size-6 text-muted-foreground" />
          <p class="text-sm text-foreground">{{ searchQuery ? 'No results found' : 'Start typing to search' }}</p>
          <p class="text-xs text-muted-foreground">Search expenses, teams, members and pages.</p>
        </div>
      </DialogContent>
    </Dialog>

  </header>
</template>
