<script setup lang="ts">
// Floating pill tab bar — active tab expands into a dark chip with its label.
// Tabs depend on role (mirrors the web sidebar's workspace items).
const route = useRoute()
const { ctx } = useOrgContext()
const { unread, refresh } = useUnreadNotifications()
onMounted(refresh)

type Tab = { to: string; label: string; icon: string; match: (p: string) => boolean }

const HOME: Tab     = { to: '/m',               label: 'Home',      icon: 'solar:home-2-bold',          match: p => p === '/m' }
const EXPENSES: Tab = { to: '/m/expenses',      label: 'Expenses',  icon: 'solar:box-linear',           match: p => p.startsWith('/m/expenses') }
const APPROVE: Tab  = { to: '/m/approvals',     label: 'Approvals', icon: 'solar:check-circle-linear',  match: p => p.startsWith('/m/approvals') }
const PAYOUTS: Tab  = { to: '/m/payments',      label: 'Payouts',   icon: 'solar:card-linear',          match: p => p.startsWith('/m/payments') }
const INBOX: Tab    = { to: '/m/notifications', label: 'Inbox',     icon: 'solar:letter-linear',        match: p => p.startsWith('/m/notifications') }
const PROFILE: Tab  = { to: '/m/settings',      label: 'Profile',   icon: 'solar:user-circle-linear',
  match: p => ['/m/settings', '/m/org', '/m/team', '/m/teams', '/m/reports', '/m/upgrade', '/m/help'].some(x => p.startsWith(x)) }

const tabs = computed<Tab[]>(() => {
  const role = ctx.value?.member?.role
  if (role === 'manager' || role === 'owner') return [HOME, APPROVE, EXPENSES, INBOX, PROFILE]
  if (role === 'finance') return [HOME, PAYOUTS, EXPENSES, INBOX, PROFILE]
  return [HOME, EXPENSES, INBOX, PROFILE]
})

</script>

<template>
  <nav
    v-if="!route.meta.hideTabBar"
    class="m-tabbar fixed inset-x-0 z-40 flex justify-center px-4"
    style="bottom: max(env(safe-area-inset-bottom), 1rem)"
    aria-label="Primary"
  >
    <div class="flex items-center gap-1 rounded-full border border-border bg-card/85 p-1.5 shadow-[0_10px_40px_rgba(0,0,0,0.14)] backdrop-blur-xl">
      <Button
        v-for="t in tabs"
        :key="t.to"
        variant="ghost"
        class="m-press relative h-11 gap-0 rounded-full transition-[background-color,color,padding] duration-300 ease-[cubic-bezier(.16,1,.3,1)]"
        :class="[
          t.match(route.path) ? 'bg-foreground px-5 text-background hover:bg-foreground hover:text-background' : 'text-muted-foreground',
          !t.match(route.path) && (tabs.length > 4 ? 'px-3' : 'px-4'),
        ]"
        as-child
      >
        <NuxtLink :to="t.to" :aria-label="t.label" @click="haptic('selection')">
          <Icon :name="t.icon" class="size-5 shrink-0" />
          <span
            class="overflow-hidden whitespace-nowrap text-[13px] font-semibold transition-all duration-300 ease-[cubic-bezier(.16,1,.3,1)]"
            :class="t.match(route.path) ? 'ml-2 max-w-24 opacity-100' : 'ml-0 max-w-0 opacity-0'"
          >{{ t.label }}</span>
          <span
            v-if="t.label === 'Inbox' && unread > 0"
            class="absolute top-2.5 right-2.5 size-2 rounded-full bg-red-500 ring-2 ring-card"
          >
            <span class="absolute inset-0 animate-ping rounded-full bg-red-500/70" />
          </span>
        </NuxtLink>
      </Button>
    </div>
  </nav>
</template>

<style scoped>
@keyframes tabbar-in {
  from { opacity: 0; transform: translateY(24px) scale(.96); }
  to   { opacity: 1; transform: none; }
}
.m-tabbar { animation: tabbar-in 600ms cubic-bezier(.16, 1, .3, 1) 200ms both; }
</style>
