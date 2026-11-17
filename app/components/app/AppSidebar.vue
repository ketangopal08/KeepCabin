<script setup lang="ts">
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
const orgSwitcherOpen = ref(false)

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
    { label: 'My Expenses', icon: 'solar:bill-list-linear', href: '/app/expenses' },
    { label: 'Submit Expense', icon: 'solar:add-linear', href: '/app/expenses/new' },
  ]
  if (role.value === 'manager') return [
    { label: 'Approvals', icon: 'solar:check-circle-linear', href: '/app/approvals' },
    { label: 'Expenses', icon: 'solar:bill-list-linear', href: '/app/expenses' },
    { label: 'My Team', icon: 'solar:users-group-rounded-linear', href: '/app/team' },
  ]
  if (role.value === 'finance') return [
    { label: 'Payments', icon: 'solar:card-linear', href: '/app/payments' },
    { label: 'All Expenses', icon: 'solar:bill-list-linear', href: '/app/expenses' },
    { label: 'Reports', icon: 'solar:file-download-linear', href: '/app/reports' },
  ]
  if (role.value === 'owner') return [
    { label: 'All Expenses', icon: 'solar:bill-list-linear', href: '/app/expenses' },
    { label: 'Reports', icon: 'solar:file-download-linear', href: '/app/reports' },
    { label: 'Organization', icon: 'solar:buildings-2-linear', href: '/app/org' },
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
  <Sidebar collapsible="icon" class="[--text-sm:0.8rem]">

    <!-- ── Header: logo / organization switcher ── -->
    <SidebarHeader class="h-12 flex-row items-center px-3 py-0 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:px-2">
      <Button
        variant="ghost"
        class="h-9 min-w-0 flex-1 cursor-pointer justify-start gap-2.5 rounded-lg px-2 hover:bg-sidebar-accent group-data-[collapsible=icon]:flex-none group-data-[collapsible=icon]:px-0"
        @click="orgSwitcherOpen = true"
      >
        <img
          v-if="orgImageUrl && !orgImageError"
          :src="orgImageUrl"
          alt="org"
          class="size-6 shrink-0 rounded-full object-cover"
          @error="orgImageError = true"
        />
        <div
          v-else
          class="flex size-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-black"
          :style="{ background: orgColor }"
        >
          {{ orgInitials.charAt(0) }}
        </div>
        <span class="min-w-0 flex-1 truncate text-left text-sm font-medium text-sidebar-foreground group-data-[collapsible=icon]:hidden">{{ ctx?.org?.name ?? 'KeepCabin' }}</span>
        <Badge variant="secondary" class="h-6 shrink-0 rounded-full bg-sidebar-accent px-2.5 text-xs font-medium capitalize text-sidebar-foreground group-data-[collapsible=icon]:hidden">
          {{ ctx?.member?.role ?? 'Member' }}
        </Badge>
        <Icon name="solar:chevrons-up-down-linear" class="size-4 shrink-0 text-sidebar-foreground/60 group-data-[collapsible=icon]:hidden" />
      </Button>
    </SidebarHeader>

    <SidebarContent class="gap-0">

      <!-- ── Main nav ── -->
      <SidebarGroup class="px-3 pt-2 group-data-[collapsible=icon]:px-2">
        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <SidebarMenuItem>
              <SidebarMenuButton as-child :is-active="isActive('/app')" tooltip="Dashboard" class="h-9 gap-3 px-2.5 [&_svg]:size-[18px]">
                <NuxtLink to="/app">
                  <Icon name="solar:widget-2-linear" />
                  <span>Dashboard</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem v-for="item in workspaceItems" :key="item.href">
              <SidebarMenuButton as-child :is-active="isActive(item.href)" :tooltip="item.label" class="h-9 gap-3 px-2.5 [&_svg]:size-[18px]">
                <NuxtLink :to="item.href">
                  <Icon :name="item.icon" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- ── Teams (owner + manager) ── -->
      <SidebarGroup v-if="role === 'owner' || role === 'manager'" class="px-3 pt-4 group-data-[collapsible=icon]:px-2">
        <SidebarGroupLabel class="h-8 px-2.5 text-sm font-normal text-sidebar-foreground/55">Teams</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu class="gap-0.5">
            <!-- Owner: all teams fetched from API -->
            <SidebarMenuItem v-for="team in teams" :key="team.id">
              <SidebarMenuButton as-child :is-active="isActive(`/app/teams/${team.id}`)" :tooltip="team.name" class="h-9 gap-3 px-2.5 [&_svg]:size-[18px]">
                <NuxtLink :to="`/app/teams/${team.id}`">
                  <Icon name="material-symbols-light:view-object-track-outline" />
                  <span>{{ team.name }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <!-- Manager: their assigned team -->
            <SidebarMenuItem v-if="role === 'manager' && ctx?.team">
              <SidebarMenuButton as-child :is-active="isActive(`/app/teams/${ctx.team.id}`)" :tooltip="ctx.team.name" class="h-9 gap-3 px-2.5 [&_svg]:size-[18px]">
                <NuxtLink :to="`/app/teams/${ctx.team.id}`">
                  <Icon name="material-symbols-light:view-object-track-outline" />
                  <span>{{ ctx.team.name }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <!-- Add new team -->
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="Add new team" class="h-9 gap-3 px-2.5 [&_svg]:size-[18px]">
                <Icon name="solar:add-linear" />
                <span>Add new team</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

    </SidebarContent>

    <!-- ── Upgrade card ── -->
    <div class="px-3 pb-2 group-data-[collapsible=icon]:hidden">
      <Card class="gap-0 rounded-xl bg-sidebar-accent/70 px-4 py-4 ring-0">
        <div class="mb-3 flex size-9 items-center justify-center rounded-full bg-sidebar">
          <Icon name="solar:magic-stick-3-linear" class="size-4 text-sidebar-foreground/70" />
        </div>
        <p class="text-sm font-medium text-sidebar-foreground">Upgrade to Premium</p>
        <p class="mt-0.5 text-[13px] leading-snug text-sidebar-foreground/50">Unlock advanced reports, unlimited teams, and priority support.</p>
        <Button size="sm" class="mt-3 w-full" as-child>
          <NuxtLink to="/app/upgrade">Upgrade now</NuxtLink>
        </Button>
      </Card>
    </div>

    <!-- ── Footer ── -->
    <SidebarFooter class="gap-1 px-3 pt-1 pb-3 group-data-[collapsible=icon]:px-2">
      <SidebarMenu class="gap-0.5">
        <SidebarMenuItem>
          <SidebarMenuButton as-child :is-active="isActive('/app/settings')" tooltip="Settings" class="h-9 gap-3 px-2.5 [&_svg]:size-[18px]">
            <NuxtLink to="/app/settings">
              <Icon name="solar:settings-linear" />
              <span>Settings</span>
            </NuxtLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton tooltip="Help center" class="h-9 gap-3 px-2.5 [&_svg]:size-[18px]">
            <Icon name="solar:question-circle-linear" />
            <span>Help center</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
        <SidebarMenuItem>
          <SidebarMenuButton
            tooltip="Log out"
            class="h-9 gap-3 px-2.5 [&_svg]:size-[18px] hover:text-destructive hover:bg-destructive/10"
            @click="logout"
          >
            <Icon name="solar:logout-2-linear" />
            <span>Log out</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />

    <!-- ── Organization switcher popup (template) ── -->
    <Dialog v-model:open="orgSwitcherOpen">
      <DialogContent class="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Switch organization</DialogTitle>
          <DialogDescription>Choose the organization you want to work in.</DialogDescription>
        </DialogHeader>

        <div class="flex flex-col gap-4 py-1">
          <!-- Current organization -->
          <div class="flex items-center gap-3 rounded-lg bg-muted px-3 py-2.5">
            <img
              v-if="orgImageUrl && !orgImageError"
              :src="orgImageUrl"
              alt="org"
              class="size-7 shrink-0 rounded-full object-cover"
            />
            <div
              v-else
              class="flex size-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-black"
              :style="{ background: orgColor }"
            >
              {{ orgInitials.charAt(0) }}
            </div>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-foreground capitalize">{{ ctx?.org?.name ?? 'KeepCabin' }}</p>
              <p class="text-xs text-muted-foreground capitalize">{{ ctx?.member?.role ?? 'workspace' }}</p>
            </div>
            <Icon name="solar:check-linear" class="size-4 shrink-0 text-foreground" />
          </div>

          <!-- Empty state -->
          <div class="flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border px-6 py-10 text-center">
            <Icon name="solar:buildings-2-linear" class="size-6 text-muted-foreground" />
            <p class="text-sm text-foreground">No other organizations</p>
            <p class="text-xs text-muted-foreground">Organizations you join will appear here.</p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" @click="orgSwitcherOpen = false">Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </Sidebar>
</template>
