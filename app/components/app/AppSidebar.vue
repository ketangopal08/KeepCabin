<script setup lang="ts">
import {
  LayoutDashboard, Receipt, Plus, CheckCircle, Users, CreditCard,
  FileDown, Building2, LogOut, Settings, HelpCircle, ChevronsUpDown,
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

function isActive(href: string) {
  if (href === '/app') return route.path === '/app'
  return route.path.startsWith(href)
}

const orgInitials = computed(() => (ctx.value?.org?.name ?? '').slice(0, 2).toUpperCase() || 'KC')

const orgColor = computed(() => {
  const colors = ['#C8E63C']
  const name = ctx.value?.org?.name ?? ''
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) % colors.length
  return colors[h] ?? colors[0]
})
</script>

<template>
  <Sidebar collapsible="icon">

    <!-- ── Header: org branding ── -->
    <SidebarHeader>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton
            size="lg"
            class="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
          >
            <!-- Org icon -->
            <div
              class="flex aspect-square size-8 items-center justify-center rounded-lg text-black text-[13px] font-bold shrink-0"
              :style="{ background: orgColor }"
            >
              {{ orgInitials.charAt(0) }}
            </div>

            <!-- Org name + role -->
            <div class="grid flex-1 text-left text-sm leading-tight min-w-0">
              <span class="truncate font-semibold" style="text-transform: uppercase;">{{ ctx?.org?.name ?? 'KeepCabin' }}</span>
              <span class="truncate text-xs text-muted-foreground capitalize">{{ ctx?.member?.role ?? 'workspace' }}</span>
            </div>

            <!-- Switcher chevron -->
            <ChevronsUpDown class="ml-auto size-4 text-muted-foreground shrink-0" />
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarHeader>

    <!-- ── Nav sections ── -->
    <SidebarContent>
      <SidebarGroup
        v-for="section in navSections"
        :key="section.heading ?? 'primary'"
      >
        <SidebarGroupLabel v-if="section.heading">
          {{ section.heading }}
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in section.items" :key="item.href">
              <SidebarMenuButton
                as-child
                :is-active="isActive(item.href)"
                :tooltip="item.label"
              >
                <NuxtLink :to="item.href">
                  <component :is="item.icon" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <!-- ── Footer: settings, help, logout ── -->
    <SidebarFooter>
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton as-child :is-active="isActive('/app/settings')" tooltip="Settings">
            <NuxtLink to="/app/settings">
              <Settings />
              <span>Settings</span>
            </NuxtLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Help center">
            <HelpCircle />
            <span>Help center</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Log out"
            class="hover:text-destructive hover:bg-destructive/10"
            @click="logout"
          >
            <LogOut />
            <span>Log out</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
