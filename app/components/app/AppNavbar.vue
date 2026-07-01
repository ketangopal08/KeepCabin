<script setup lang="ts">
import { LayoutDashboard, Receipt, Plus, CheckCircle, CreditCard, FileDown, Building2, Users } from '@lucide/vue'

const route = useRoute()

const pages: Record<string, { label: string; icon: any; action?: { label: string; href: string } }> = {
  '/app':              { label: 'Dashboard',      icon: LayoutDashboard },
  '/app/expenses':     { label: 'Expenses',       icon: Receipt,        action: { label: 'Submit Expense', href: '/app/expenses/new' } },
  '/app/expenses/new': { label: 'Submit Expense', icon: Plus },
  '/app/approvals':    { label: 'Approvals',      icon: CheckCircle },
  '/app/payments':     { label: 'Payments',       icon: CreditCard },
  '/app/team':         { label: 'My Team',        icon: Users },
  '/app/org':          { label: 'Organization',   icon: Building2,      action: { label: 'Invite Member', href: '/app/org' } },
  '/app/reports':      { label: 'Reports',        icon: FileDown },
}

const current = computed(() => pages[route.path] ?? { label: 'KeepCabin', icon: LayoutDashboard })
</script>

<template>
  <header class="h-11 shrink-0 bg-white border-b border-[#ebebeb] flex items-center justify-between px-5 gap-4">
    <!-- Left: icon + title + "..." -->
    <div class="flex items-center gap-2">
      <component :is="current.icon" class="size-[15px] text-gray-400 shrink-0" />
      <span class="text-[13px] font-semibold text-gray-900">{{ current.label }}</span>
      <button class="text-gray-300 hover:text-gray-500 transition-colors ml-1">
        <svg class="size-[15px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <circle cx="5" cy="12" r="1.2" fill="currentColor"/><circle cx="12" cy="12" r="1.2" fill="currentColor"/><circle cx="19" cy="12" r="1.2" fill="currentColor"/>
        </svg>
      </button>
    </div>

    <!-- Right: action button -->
    <NuxtLink
      v-if="current.action"
      :to="current.action.href"
      class="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-gray-900 text-white text-[12px] font-medium hover:bg-gray-800 transition-colors"
    >
      <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
        <path d="M12 5v14M5 12h14"/>
      </svg>
      {{ current.action.label }}
    </NuxtLink>
  </header>
</template>
