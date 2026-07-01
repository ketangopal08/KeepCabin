<script setup lang="ts">
import { LayoutDashboard, Receipt, Plus, CheckCircle, Users, CreditCard, FileDown, Building2, LogOut } from '@lucide/vue'
import { useSupabase } from '~~/lib/supabase'

const supabase = useSupabase()
const { ctx, clear } = useOrgContext()
const route = useRoute()

async function logout() {
  clear()
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const navItems = computed(() => {
  const role = ctx.value?.member?.role
  const base = [{ label: 'Dashboard', icon: LayoutDashboard, href: '/app' }]

  if (role === 'employee') return [
    ...base,
    { label: 'My Expenses', icon: Receipt, href: '/app/expenses' },
    { label: 'Submit Expense', icon: Plus, href: '/app/expenses/new' },
  ]
  if (role === 'manager') return [
    ...base,
    { label: 'Approvals', icon: CheckCircle, href: '/app/approvals' },
    { label: 'My Team', icon: Users, href: '/app/team' },
    { label: 'Expenses', icon: Receipt, href: '/app/expenses' },
  ]
  if (role === 'finance') return [
    ...base,
    { label: 'Payments', icon: CreditCard, href: '/app/payments' },
    { label: 'All Expenses', icon: Receipt, href: '/app/expenses' },
    { label: 'Reports', icon: FileDown, href: '/app/reports' },
  ]
  if (role === 'owner') return [
    ...base,
    { label: 'All Expenses', icon: Receipt, href: '/app/expenses' },
    { label: 'Organization', icon: Building2, href: '/app/org' },
    { label: 'Reports', icon: FileDown, href: '/app/reports' },
  ]
  return base
})

function isActive(href: string) {
  if (href === '/app') return route.path === '/app'
  return route.path.startsWith(href)
}
</script>

<template>
  <aside class="flex flex-col w-56 shrink-0 h-screen bg-white border-r border-gray-100">

    <!-- Logo -->
    <div class="flex items-center gap-2.5 px-5 h-14 border-b border-gray-100 shrink-0">
      <img src="/logo.svg" class="size-6 rounded-md" alt="KeepCabin" />
      <span class="text-[14px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
    </div>

    <!-- Nav -->
    <nav class="flex-1 overflow-y-auto px-3 py-3 flex flex-col gap-0.5">
      <!-- Org name badge -->
      <div v-if="ctx?.org?.name" class="px-3 py-2 mb-1">
        <p class="text-[11px] font-semibold text-gray-400 uppercase tracking-widest truncate">{{ ctx.org.name }}</p>
      </div>

      <NuxtLink
        v-for="item in navItems"
        :key="item.href"
        :to="item.href"
        :class="[
          'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all',
          isActive(item.href)
            ? 'bg-gray-100 text-gray-900 font-medium'
            : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
        ]"
      >
        <component :is="item.icon" class="size-4 shrink-0" />
        {{ item.label }}
      </NuxtLink>
    </nav>

    <!-- Footer: role + logout -->
    <div class="px-3 py-3 border-t border-gray-100 shrink-0">
      <div v-if="ctx?.member" class="flex items-center gap-2.5 px-3 py-2 mb-1">
        <div class="size-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
          <span class="text-[11px] font-semibold text-gray-600 uppercase">
            {{ ctx.member.role.charAt(0) }}
          </span>
        </div>
        <div class="min-w-0">
          <p class="text-xs font-medium text-gray-700 capitalize truncate">{{ ctx.member.role }}</p>
          <p class="text-[11px] text-gray-400 truncate">{{ ctx.org?.name }}</p>
        </div>
      </div>
      <button
        class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-400 hover:text-red-600 hover:bg-red-50 transition-all w-full"
        @click="logout"
      >
        <LogOut class="size-4 shrink-0" />
        Log out
      </button>
    </div>

  </aside>
</template>
