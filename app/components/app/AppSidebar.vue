<script setup lang="ts">
import {
  LayoutDashboard, Receipt, Plus, CheckCircle, Users, CreditCard,
  FileDown, Building2, LogOut, Settings, HelpCircle, Search, Layers, ChevronsUpDown,
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

const role = computed(() => ctx.value?.member?.role)

const workspaceItems = computed(() => {
  if (role.value === 'employee') return [
    { label: 'My Expenses', icon: Receipt, href: '/app/expenses' },
    { label: 'Submit Expense', icon: Plus, href: '/app/expenses/new' },
  ]
  if (role.value === 'manager') return [
    { label: 'Approvals', icon: CheckCircle, href: '/app/approvals' },
    { label: 'Expenses', icon: Receipt, href: '/app/expenses' },
    { label: 'My Team', icon: Users, href: '/app/team' },
  ]
  if (role.value === 'finance') return [
    { label: 'Payments', icon: CreditCard, href: '/app/payments' },
    { label: 'All Expenses', icon: Receipt, href: '/app/expenses' },
    { label: 'Reports', icon: FileDown, href: '/app/reports' },
  ]
  if (role.value === 'owner') return [
    { label: 'All Expenses', icon: Receipt, href: '/app/expenses' },
    { label: 'Reports', icon: FileDown, href: '/app/reports' },
    { label: 'Organization', icon: Building2, href: '/app/org' },
  ]
  return []
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

    <!-- ── Header ── -->
    <SidebarHeader class="border-b border-sidebar-border px-3 h-11 flex-row items-center py-0">
      <div class="flex items-center gap-2.5 w-full">
        <div
          class="flex size-[28px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-black"
          :style="{ background: orgColor }"
        >
          {{ orgInitials.charAt(0) }}
        </div>
        <div class="flex flex-col min-w-0 flex-1">
          <span class="truncate text-[13px] font-semibold text-sidebar-foreground leading-tight">{{ ctx?.org?.name ?? 'KeepCabin' }}</span>
          <span class="text-[10.5px] text-sidebar-foreground/50 capitalize leading-tight">{{ ctx?.member?.role ?? 'workspace' }}</span>
        </div>
        <ChevronsUpDown class="size-4 shrink-0 text-sidebar-foreground/40" />
      </div>
    </SidebarHeader>

    <SidebarContent class="gap-0">

      <!-- ── Search ── -->
      <div class="px-3 pt-2.5 pb-1">
        <div class="flex items-center gap-2 px-2.5 h-8 rounded-lg cursor-pointer transition-colors" style="background:#e3e3e3">
          <Search class="size-3.5 shrink-0 text-sidebar-foreground/40" />
          <span class="flex-1 text-[12px] text-sidebar-foreground/40 select-none">Search</span>
          <kbd class="text-[10px] text-sidebar-foreground/30 font-mono">⌘K</kbd>
        </div>
      </div>

      <!-- ── Dashboard ── -->
      <SidebarGroup class="py-2 pb-1">
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton as-child :is-active="isActive('/app')" tooltip="Dashboard">
                <NuxtLink to="/app">
                  <LayoutDashboard />
                  <span>Dashboard</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <Separator class="mx-2" />

      <!-- ── Workspace ── -->
      <SidebarGroup class="py-2">
        <SidebarGroupLabel class="flex items-center gap-1 px-2 h-6">
          <span class="flex-1 truncate">{{ ctx?.org?.name ?? 'Workspace' }}</span>
          <button
            v-if="role === 'owner' || role === 'manager'"
            class="rounded p-0.5 hover:bg-sidebar-accent text-sidebar-foreground/40 hover:text-sidebar-foreground transition-colors"
            title="Invite member"
          >
            <Plus class="size-3" />
          </button>
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in workspaceItems" :key="item.href">
              <SidebarMenuButton as-child :is-active="isActive(item.href)" :tooltip="item.label">
                <NuxtLink :to="item.href">
                  <component :is="item.icon" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- ── Teams (owner + manager) ── -->
      <template v-if="role === 'owner' || role === 'manager'">
        <Separator class="mx-2" />
        <SidebarGroup class="py-2">
          <SidebarGroupLabel class="px-2 h-6">Teams</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <!-- Owner: Finance team -->
              <SidebarMenuItem v-if="role === 'owner'">
                <SidebarMenuButton tooltip="Finance">
                  <Layers class="text-sidebar-foreground/60" />
                  <span>Finance</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <!-- Manager: their assigned team -->
              <SidebarMenuItem v-if="role === 'manager' && ctx?.team">
                <SidebarMenuButton as-child :is-active="isActive('/app/team')" tooltip="My Team">
                  <NuxtLink to="/app/team">
                    <Layers class="text-sidebar-foreground/60" />
                    <span>{{ ctx.team.name }}</span>
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <!-- Add new team -->
              <SidebarMenuItem>
                <SidebarMenuButton tooltip="Add new team" class="text-sidebar-foreground/50 hover:text-sidebar-foreground">
                  <Plus />
                  <span>Add new team</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </template>

    </SidebarContent>

    <!-- ── Footer ── -->
    <SidebarFooter class="border-t border-sidebar-border">
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
