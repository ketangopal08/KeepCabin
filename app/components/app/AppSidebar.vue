<script setup lang="ts">
import {
  LayoutDashboard, Receipt, Plus, CheckCircle, Users, CreditCard,
  FileDown, Building2, LogOut, Settings, Search, Home,
} from '@lucide/vue'
import { useSupabase } from '~~/lib/supabase'

const supabase = useSupabase()
const { ctx, clear } = useOrgContext()
const route = useRoute()

async function logout() {
  clear()
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const navSections = computed(() => {
  const role = ctx.value?.member?.role

  const primary = [
    { label: 'Dashboard', icon: LayoutDashboard, href: '/app' },
  ]

  if (role === 'employee') return [
    { heading: null, items: primary },
    {
      heading: 'My Work',
      items: [
        { label: 'My Expenses', icon: Receipt, href: '/app/expenses' },
        { label: 'Submit Expense', icon: Plus, href: '/app/expenses/new' },
      ],
    },
  ]

  if (role === 'manager') return [
    { heading: null, items: primary },
    {
      heading: 'Workspace',
      items: [
        { label: 'Approvals', icon: CheckCircle, href: '/app/approvals' },
        { label: 'Expenses', icon: Receipt, href: '/app/expenses' },
        { label: 'My Team', icon: Users, href: '/app/team' },
      ],
    },
  ]

  if (role === 'finance') return [
    { heading: null, items: primary },
    {
      heading: 'Workspace',
      items: [
        { label: 'Payments', icon: CreditCard, href: '/app/payments' },
        { label: 'All Expenses', icon: Receipt, href: '/app/expenses' },
        { label: 'Reports', icon: FileDown, href: '/app/reports' },
      ],
    },
  ]

  if (role === 'owner') return [
    { heading: null, items: primary },
    {
      heading: 'Workspace',
      items: [
        { label: 'All Expenses', icon: Receipt, href: '/app/expenses' },
        { label: 'Reports', icon: FileDown, href: '/app/reports' },
      ],
    },
    {
      heading: 'Organization',
      items: [
        { label: 'Organization', icon: Building2, href: '/app/org' },
      ],
    },
  ]

  return [{ heading: null, items: primary }]
})

const allNavItems = computed(() =>
  navSections.value.flatMap(s => s.items)
)

function isActive(href: string) {
  if (href === '/app') return route.path === '/app'
  return route.path.startsWith(href)
}

const orgInitials = computed(() => {
  const name = ctx.value?.org?.name ?? ''
  return name.slice(0, 2).toUpperCase()
})

// deterministic color from org name
const orgColor = computed(() => {
  const colors = ['#6366f1','#0ea5e9','#10b981','#f59e0b','#ec4899','#8b5cf6']
  const name = ctx.value?.org?.name ?? ''
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length
  return colors[h] ?? colors[0]
})
</script>

<template>
  <aside class="flex h-full shrink-0">

    <!-- ── Icon rail ── -->
    <div class="flex flex-col items-center w-10 shrink-0 bg-[#f8f8f8] border-r border-[#ebebeb] py-2 gap-0.5">
      <!-- App icon -->
      <div class="mb-3 mt-1">
        <img src="/logo.svg" class="size-5 rounded-[6px]" alt="" />
      </div>

      <!-- Section icons -->
      <NuxtLink
        v-for="item in allNavItems"
        :key="item.href"
        :to="item.href"
        :title="item.label"
        :class="[
          'flex items-center justify-center size-7 rounded-md transition-all',
          isActive(item.href)
            ? 'bg-white shadow-[0_1px_3px_rgba(0,0,0,0.08)] text-gray-900'
            : 'text-gray-400 hover:bg-white/70 hover:text-gray-700'
        ]"
      >
        <component :is="item.icon" class="size-[15px]" />
      </NuxtLink>

      <!-- Bottom -->
      <div class="mt-auto flex flex-col items-center gap-0.5">
        <button
          title="Log out"
          class="flex items-center justify-center size-7 rounded-md text-gray-400 hover:bg-white/70 hover:text-red-500 transition-all"
          @click="logout"
        >
          <LogOut class="size-[15px]" />
        </button>
        <!-- User dot -->
        <div
          class="size-5 rounded-full mt-1 flex items-center justify-center text-[9px] font-bold text-white"
          :style="{ background: orgColor }"
        >
          {{ orgInitials.charAt(0) }}
        </div>
      </div>
    </div>

    <!-- ── Nav panel ── -->
    <div class="flex flex-col w-[220px] shrink-0 bg-white border-r border-[#ebebeb] overflow-hidden">

      <!-- Org switcher -->
      <div class="flex items-center gap-2 px-3 h-11 border-b border-[#f0f0f0] shrink-0 cursor-pointer hover:bg-gray-50 transition-colors">
        <div
          class="size-5 rounded-[5px] flex items-center justify-center text-[10px] font-bold text-white shrink-0"
          :style="{ background: orgColor }"
        >
          {{ orgInitials }}
        </div>
        <span class="text-[13px] font-semibold text-gray-900 truncate flex-1">{{ ctx?.org?.name ?? 'KeepCabin' }}</span>
        <svg class="size-3 text-gray-400 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <path d="M6 9l6 6 6-6"/>
        </svg>
      </div>

      <!-- Search -->
      <div class="px-2 py-2 border-b border-[#f0f0f0] shrink-0">
        <div class="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-[#f5f5f5] text-gray-400">
          <Search class="size-3 shrink-0" />
          <span class="text-[12px] flex-1 select-none">Search</span>
          <kbd class="text-[10px] text-gray-300 bg-white border border-gray-200 rounded px-1 leading-4">/</kbd>
        </div>
      </div>

      <!-- Nav sections -->
      <nav class="flex-1 overflow-y-auto py-1.5">
        <template v-for="section in navSections" :key="section.heading ?? 'primary'">

          <!-- Section heading -->
          <div v-if="section.heading" class="flex items-center justify-between px-3 pt-3 pb-1">
            <span class="text-[10.5px] font-semibold text-gray-400 uppercase tracking-[0.06em]">
              {{ section.heading }}
            </span>
            <button class="text-gray-300 hover:text-gray-500 transition-colors">
              <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </button>
          </div>

          <!-- Nav items -->
          <NuxtLink
            v-for="item in section.items"
            :key="item.href"
            :to="item.href"
            :class="[
              'group flex items-center gap-2 mx-1.5 px-2 py-[5px] rounded-md text-[13px] transition-all',
              isActive(item.href)
                ? 'bg-[#efefef] text-gray-900 font-medium'
                : 'text-gray-600 hover:bg-[#f5f5f5] hover:text-gray-900'
            ]"
          >
            <component :is="item.icon" class="size-[14px] shrink-0 text-gray-400 group-hover:text-gray-600" :class="isActive(item.href) ? '!text-gray-700' : ''" />
            <span class="flex-1 truncate">{{ item.label }}</span>
          </NuxtLink>

        </template>
      </nav>

      <!-- Footer -->
      <div class="border-t border-[#f0f0f0] px-3 py-2.5 shrink-0">
        <div v-if="ctx?.member" class="flex items-center gap-2">
          <div
            class="size-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0"
            :style="{ background: orgColor }"
          >
            {{ orgInitials.charAt(0) }}
          </div>
          <span class="text-[12px] text-gray-500 truncate capitalize flex-1">{{ ctx.member.role }}</span>
          <button
            class="text-gray-300 hover:text-gray-500 transition-colors"
            @click="logout"
            title="Log out"
          >
            <LogOut class="size-3.5" />
          </button>
        </div>
      </div>

    </div>
  </aside>
</template>
