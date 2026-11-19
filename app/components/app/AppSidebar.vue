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

// Menu items that contain premium features show a crown on Free and during the trial;
// hidden once the workspace has purchased a paid plan.
const { billing, load: loadBilling } = useBilling()
watch(() => ctx.value?.org?.id, (orgId) => { if (orgId) loadBilling() }, { immediate: true })
const showPremium = computed(() => !!billing.value && (billing.value.trial || billing.value.plan === 'free'))

// Paid workspaces get a dismissible "You're on <Plan>" banner instead of the upgrade card.
const isPaidPlan = computed(() => !!billing.value && !showPremium.value)
const PLAN_NAMES: Record<string, string> = { pro: 'Pro', business: 'Business', enterprise: 'Enterprise' }
const planStripText = computed(() => {
  const b = billing.value
  if (!b) return ''
  const date = b.currentPeriodEnd
    ? new Date(b.currentPeriodEnd).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : ''
  if (b.status === 'past_due') return 'Payment failed — retrying'
  if (b.cancelAtPeriodEnd || b.status === 'cancelled') return date ? `Active until ${date}` : 'Cancelled'
  return date ? `Renews ${date}` : 'All features unlocked'
})
const planBannerKey = computed(() => `kc-plan-banner-dismissed:${ctx.value?.org?.id ?? ''}:${billing.value?.plan ?? ''}`)
const planBannerDismissed = ref(false)
watch(planBannerKey, (key) => {
  try { planBannerDismissed.value = import.meta.client && localStorage.getItem(key) === '1' } catch { planBannerDismissed.value = false }
}, { immediate: true })
function dismissPlanBanner() {
  planBannerDismissed.value = true
  try { localStorage.setItem(planBannerKey.value, '1') } catch { /* storage unavailable */ }
}
// Brand colours from public/logo.svg: lime background + dark dot grid + dark mark.
const BRAND_LIME = '#C8E63C'
const BRAND_INK = '#181810'
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
    { label: 'Reports', icon: 'solar:file-download-linear', href: '/app/reports', premium: showPremium.value },
  ]
  if (role.value === 'owner') return [
    { label: 'All Expenses', icon: 'solar:bill-list-linear', href: '/app/expenses' },
    { label: 'Reports', icon: 'solar:file-download-linear', href: '/app/reports', premium: showPremium.value },
    { label: 'Organization', icon: 'solar:buildings-2-linear', href: '/app/org', premium: showPremium.value },
  ]
  return []
})

function isActive(href: string) {
  if (href === '/app') return route.path === '/app'
  return route.path.startsWith(href)
}


// Set to null to use initials, or a URL string to show an image
const orgImageUrl = ref<string | null>(null)
const orgImageError = ref(false)

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
          class="flex size-6 shrink-0 items-center justify-center rounded-md border border-sidebar-border bg-sidebar-accent text-sidebar-foreground/80"
        >
          <Icon name="solar:buildings-2-linear" class="!size-3.5" />
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
                  <Icon
                    v-if="'premium' in item && item.premium"
                    name="solar:crown-linear"
                    class="ml-auto !size-3.5 !text-amber-500 group-data-[collapsible=icon]:hidden"
                    aria-label="Includes premium features"
                    title="Includes premium features"
                  />
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

    <!-- ── Plan strip (paid workspaces) ── -->
    <div v-if="isPaidPlan && !planBannerDismissed" class="px-3 pb-2 group-data-[collapsible=icon]:hidden">
      <div class="relative flex items-center gap-2.5 rounded-lg bg-sidebar-accent/60 py-2 pr-8 pl-2.5 transition-colors hover:bg-sidebar-accent">
        <NuxtLink to="/app/upgrade" class="absolute inset-0 rounded-lg" aria-label="Manage plan" />
        <div class="flex size-6 shrink-0 items-center justify-center rounded-full" :style="{ background: BRAND_LIME, color: BRAND_INK }">
          <Icon name="solar:crown-linear" class="!size-3.5" />
        </div>
        <div class="min-w-0">
          <p class="truncate text-[13px] font-medium leading-tight text-sidebar-foreground">{{ PLAN_NAMES[billing?.plan ?? ''] ?? 'Paid' }} plan</p>
          <p class="truncate text-[11.5px] leading-tight text-sidebar-foreground/55">{{ planStripText }}</p>
        </div>
        <Button
          variant="ghost"
          size="icon-xs"
          class="absolute top-1/2 right-1.5 z-10 -translate-y-1/2 rounded-full text-sidebar-foreground/50 hover:bg-sidebar hover:text-sidebar-foreground"
          aria-label="Dismiss"
          @click="dismissPlanBanner"
        >
          <Icon name="solar:close-linear" class="!size-3" />
        </Button>
      </div>
    </div>

    <!-- ── Upgrade card (Free / trial) ── -->
    <div v-else-if="billing && !isPaidPlan" class="px-3 pb-2 group-data-[collapsible=icon]:hidden">
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
          <SidebarMenuButton as-child :is-active="isActive('/app/help')" tooltip="Help center" class="h-9 gap-3 px-2.5 [&_svg]:size-[18px]">
            <NuxtLink to="/app/help">
              <Icon name="solar:question-circle-linear" />
              <span>Help center</span>
            </NuxtLink>
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
              class="flex size-7 shrink-0 items-center justify-center rounded-md border border-border bg-background text-foreground/80"
            >
              <Icon name="solar:buildings-2-linear" class="size-4" />
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
