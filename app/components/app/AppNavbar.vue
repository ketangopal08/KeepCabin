<script setup lang="ts">
import {
  LayoutDashboard, Receipt, Plus, CheckCircle, CreditCard,
  FileDown, Building2, Users, ChevronRight, Settings, Check,
} from '@lucide/vue'

const route = useRoute()
const { ctx } = useOrgContext()
const role = computed(() => ctx.value?.member?.role)

const { triggerSave, saving, saved } = useSettingsBar()
const isSettings = computed(() => route.path === '/app/settings')

type PageDef = { label: string; icon: any; action?: { label: string; href: string; ownerOnly?: boolean } }

const pages: Record<string, PageDef> = {
  '/app':              { label: 'Dashboard',      icon: LayoutDashboard },
  '/app/expenses':     { label: 'Expenses',        icon: Receipt,   action: { label: 'New Expense', href: '/app/expenses/new' } },
  '/app/expenses/new': { label: 'Submit Expense',  icon: Plus },
  '/app/approvals':    { label: 'Approvals',       icon: CheckCircle },
  '/app/payments':     { label: 'Payments',        icon: CreditCard },
  '/app/teams':        { label: 'Teams',           icon: Users,     action: { label: 'New Team', href: '/app/teams/new', ownerOnly: true } },
  '/app/org':          { label: 'Organization',    icon: Building2, action: { label: 'Invite Member', href: '/app/org' } },
  '/app/reports':      { label: 'Reports',         icon: FileDown },
  '/app/settings':     { label: 'Settings',        icon: Settings },
}

const current = computed<PageDef>(() => {
  if (pages[route.path]) return pages[route.path]
  if (route.path.startsWith('/app/teams/')) return { label: 'Team', icon: Users }
  if (route.path.startsWith('/app/expenses/')) return { label: 'Expense', icon: Receipt }
  return { label: 'KeepCabin', icon: LayoutDashboard }
})

const showAction = computed(() => {
  if (!current.value.action) return false
  if (current.value.action.ownerOnly && role.value !== 'owner') return false
  return true
})
</script>

<template>
  <header class="h-11 shrink-0 bg-background border-b border-border flex items-center px-3 gap-2">

    <!-- shadcn SidebarTrigger handles collapse/expand -->
    <SidebarTrigger class="-ml-1" />

    <!-- Breadcrumb -->
    <div class="flex items-center gap-1.5 text-[12.5px] flex-1 min-w-0">
      <span class="text-muted-foreground shrink-0">{{ ctx?.org?.name ?? 'KeepCabin' }}</span>
      <ChevronRight class="size-3 text-muted-foreground/50 shrink-0" />
      <component :is="current.icon" class="size-[13px] text-muted-foreground shrink-0" />
      <span class="font-medium text-foreground truncate">{{ current.label }}</span>
    </div>

    <!-- Settings: Save changes -->
    <Button v-if="isSettings" size="sm" class="h-8 text-[12.5px] gap-1.5" :disabled="saving" @click="triggerSave">
      <Check v-if="saved" class="size-3.5" />
      {{ saved ? 'Saved!' : saving ? 'Saving…' : 'Save changes' }}
    </Button>

    <!-- Other pages: contextual action -->
    <Button v-else-if="showAction" as-child size="sm">
      <NuxtLink :to="current.action?.href ?? ''" class="flex items-center gap-1.5">
        <svg class="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        {{ current.action?.label }}
      </NuxtLink>
    </Button>

  </header>
</template>
