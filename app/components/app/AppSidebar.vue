<script setup lang="ts">
import { LayoutDashboard, Receipt, Plus, CheckCircle, Users, CreditCard, FileDown, Building2, LogOut } from '@lucide/vue'
import { useSupabase } from '~~/lib/supabase'

const supabase = useSupabase()
const { ctx, clear } = useOrgContext()

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
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarContent class="py-2">
      <SidebarGroup>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in navItems" :key="item.label">
              <SidebarMenuButton as-child>
                <NuxtLink :to="item.href" class="flex items-center gap-3">
                  <component :is="item.icon" class="size-4 shrink-0" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarFooter class="border-t py-2">
      <SidebarMenu>
        <SidebarMenuItem>
          <SidebarMenuButton class="text-muted-foreground hover:text-destructive hover:bg-destructive/10" @click="logout">
            <LogOut class="size-4 shrink-0" />
            <span>Log out</span>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
