<script setup lang="ts">
import {
  LayoutDashboard, Receipt, Plus, CheckCircle, CreditCard,
  FileDown, Building2, Users, ChevronRight,
} from '@lucide/vue'

const route = useRoute()

const pages: Record<string, { label: string; icon: any; action?: { label: string; href: string } }> = {
  '/app':              { label: 'Dashboard',      icon: LayoutDashboard },
  '/app/expenses':     { label: 'Expenses',        icon: Receipt,      action: { label: 'Submit Expense', href: '/app/expenses/new' } },
  '/app/expenses/new': { label: 'Submit Expense',  icon: Plus },
  '/app/approvals':    { label: 'Approvals',       icon: CheckCircle },
  '/app/payments':     { label: 'Payments',        icon: CreditCard },
  '/app/team':         { label: 'My Team',         icon: Users },
  '/app/org':          { label: 'Organization',    icon: Building2,    action: { label: 'Invite Member', href: '/app/org' } },
  '/app/reports':      { label: 'Reports',         icon: FileDown },
  '/app/settings':     { label: 'Settings',        icon: LayoutDashboard },
}

const current = computed(() => pages[route.path] ?? { label: 'KeepCabin', icon: LayoutDashboard })
</script>

<template>
  <header class="h-11 shrink-0 bg-background border-b border-border flex items-center px-3 gap-2">

    <!-- shadcn SidebarTrigger handles collapse/expand -->
    <SidebarTrigger class="-ml-1" />

    <Separator orientation="vertical" class="h-4" />

    <!-- Breadcrumb -->
    <div class="flex items-center gap-1.5 text-[12.5px] flex-1 min-w-0">
      <span class="text-muted-foreground shrink-0">KeepCabin</span>
      <ChevronRight class="size-3 text-muted-foreground/50 shrink-0" />
      <component :is="current.icon" class="size-[13px] text-muted-foreground shrink-0" />
      <span class="font-medium text-foreground truncate">{{ current.label }}</span>
    </div>

    <!-- Action button -->
    <Button v-if="current.action" as-child size="sm">
      <NuxtLink :to="current.action.href" class="flex items-center gap-1.5">
        <svg class="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
          <path d="M12 5v14M5 12h14"/>
        </svg>
        {{ current.action.label }}
      </NuxtLink>
    </Button>

  </header>
</template>
