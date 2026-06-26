<script setup lang="ts">
import { Home, Receipt, Folder, Settings } from '@lucide/vue'

const links = [
  { label: 'Home', icon: Home, to: '/app' },
  { label: 'Receipts', icon: Receipt, to: '/app' },
  { label: 'Folders', icon: Folder, to: '/app' },
  { label: 'Settings', icon: Settings, to: '/app' },
]
</script>

<template>
  <Sidebar collapsible="icon">
    <SidebarHeader class="border-b px-4 py-3">
      <NuxtLink to="/" class="flex items-center gap-2 font-bold text-base tracking-tight">
        KeepCabin
      </NuxtLink>
    </SidebarHeader>

    <SidebarContent>
      <SidebarGroup>
        <SidebarGroupLabel>Navigation</SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="link in links" :key="link.label">
              <SidebarMenuButton as-child>
                <NuxtLink :to="link.to">
                  <component :is="link.icon" />
                  <span>{{ link.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarRail />
  </Sidebar>
</template>
