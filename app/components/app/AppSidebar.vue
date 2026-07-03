<script setup lang="ts">
import {
  LayoutDashboard, Receipt, Plus, CheckCircle, Users, CreditCard,
  FileDown, Building2, LogOut, Settings, HelpCircle, Search, Layers, ChevronsUpDown,
} from '@lucide/vue'
import { useSupabase } from '~~/lib/supabase'
import type { Team } from '~~/lib/supabase'

const supabase = useSupabase()
const { ctx, clear } = useOrgContext()
const route = useRoute()

async function logout() {
  clear()
  await supabase.auth.signOut()
  await navigateTo('/login')
}

const role  = computed(() => ctx.value?.member?.role)

// Fetch teams list (owner only)
const teams = ref<Team[]>([])

watch(() => ctx.value?.org?.id, async (orgId) => {
  if (!orgId || role.value !== 'owner') return
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) return
  teams.value = await $fetch<Team[]>('/api/teams', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  }).catch(() => [])
}, { immediate: true })

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

// Set to null to use initials, or a URL string to show an image
const orgImageUrl = ref<string | null>('/images/org-temp.jpg')
const orgImageError = ref(false)

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
        <img
          v-if="orgImageUrl && !orgImageError"
          :src="orgImageUrl"
          alt="org"
          class="size-[28px] shrink-0 rounded-md object-cover"
          @error="orgImageError = true"
        />
        <div
          v-else
          class="flex size-[28px] shrink-0 items-center justify-center rounded-md text-[11px] font-bold text-black"
          :style="{ background: orgColor }"
        >
          {{ orgInitials.charAt(0) }}
        </div>
        <div class="flex flex-col min-w-0 flex-1">
          <span class="truncate text-[13px] font-semibold text-sidebar-foreground leading-tight" style="text-transform: capitalize;">{{ ctx?.org?.name ?? 'KeepCabin' }}</span>
          <span class="text-[10.5px] text-sidebar-foreground/50 capitalize leading-tight">{{ ctx?.member?.role ?? 'workspace' }}</span>
        </div>
        <ChevronsUpDown class="size-4 shrink-0 text-sidebar-foreground/40" />
      </div>
    </SidebarHeader>

    <SidebarContent class="gap-0">

      <!-- ── Search ── -->
      <div class="px-3 pt-2.5 pb-1">
        <div class="flex items-center gap-2 px-2.5 h-8 rounded-lg cursor-pointer transition-colors bg-sidebar-accent">
          <Search class="size-3.5 shrink-0 text-sidebar-foreground/40" />
          <span class="flex-1 text-[12px] text-sidebar-foreground/40 select-none">Search</span>
          <kbd class="text-[10px] text-sidebar-foreground/30 font-mono">⌘K</kbd>
        </div>
      </div>

      <!-- ── Dashboard ── -->
      <SidebarGroup class="">
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

      <!-- <Separator class="mx-2" /> -->
     

      <!-- ── Teams (owner + manager) ── -->
      <template v-if="role === 'owner' || role === 'manager'">
        <Separator class="mx-2" />
        <SidebarGroup class="py-2">
          <SidebarGroupLabel class="px-2 h-6">Teams</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <!-- Owner: all teams fetched from API -->
              <SidebarMenuItem v-for="team in teams" :key="team.id">
                <SidebarMenuButton as-child :is-active="isActive(`/app/teams/${team.id}`)" :tooltip="team.name">
                  <NuxtLink :to="`/app/teams/${team.id}`">
                    <Layers class="text-sidebar-foreground/60" />
                    <span>{{ team.name }}</span>
                  </NuxtLink>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <!-- Manager: their assigned team -->
              <SidebarMenuItem v-if="role === 'manager' && ctx?.team">
                <SidebarMenuButton as-child :is-active="isActive(`/app/teams/${ctx.team.id}`)" :tooltip="ctx.team.name">
                  <NuxtLink :to="`/app/teams/${ctx.team.id}`">
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

    <!-- ── Upgrade banner ── -->
    <div class="px-3 pb-3 group-data-[collapsible=icon]:hidden">
      <div class="rounded-xl p-3 flex flex-col gap-2 bg-sidebar-accent">
        <div class="flex items-center gap-2">
          <div class="size-6 rounded-md bg-sidebar-primary flex items-center justify-center shrink-0">
            <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="hsl(var(--sidebar-primary-foreground))" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
            </svg>
          </div>
          <span class="text-[12px] font-semibold text-sidebar-foreground leading-tight">Upgrade to Premium</span>
        </div>
        <p class="text-[11px] text-sidebar-foreground/50 leading-relaxed">Unlock advanced reports, unlimited teams, and priority support.</p>
        <button class="w-full py-1.5 rounded-lg text-[11.5px] font-medium bg-sidebar-primary text-sidebar-primary-foreground transition-colors hover:opacity-90">
          Upgrade now
        </button>
      </div>
    </div>

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
