<script setup lang="ts">
import {
  Receipt, Star, Clock, Tag,
  FolderOpen, FileText, Share2,
  Settings, RefreshCw
} from '@lucide/vue'

const mainNav = [
  { label: 'All Receipts', icon: Receipt, to: '/app' },
  { label: 'Favorites',    icon: Star,    to: '/app' },
  { label: 'Recent',       icon: Clock,   to: '/app' },
  { label: 'Tags',         icon: Tag,     to: '/app' },
]

const orderNav = [
  { label: 'Drive Folders', icon: FolderOpen, to: '/app' },
  { label: 'Imported',      icon: FileText,   to: '/app' },
  { label: 'Shared',        icon: Share2,     to: '/app' },
]

const settingsNav = [
  { label: 'Settings',     icon: Settings,   to: '/app' },
  { label: 'Sync Status',  icon: RefreshCw,  to: '/app' },
]

const activeLabel = ref('All Receipts')
</script>

<template>
  <Sidebar collapsible="icon">
    <!-- User profile -->
    <SidebarHeader class="border-b px-4 py-4">
      <div class="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
        <div class="size-10 rounded-full bg-muted flex items-center justify-center text-xl shrink-0 select-none">
          🗂️
        </div>
        <div class="min-w-0 group-data-[collapsible=icon]:hidden">
          <p class="text-sm font-semibold leading-tight truncate">KeepCabin</p>
          <p class="text-xs text-muted-foreground truncate">Receipt organizer</p>
        </div>
      </div>
    </SidebarHeader>

    <SidebarContent class="py-2">
      <!-- MAIN -->
      <SidebarGroup>
        <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 px-4">
          Main
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in mainNav" :key="item.label">
              <SidebarMenuButton
                as-child
                :is-active="activeLabel === item.label"
                @click="activeLabel = item.label"
              >
                <NuxtLink :to="item.to" class="flex items-center gap-3">
                  <component :is="item.icon" class="size-4 shrink-0" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- ORDER -->
      <SidebarGroup>
        <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 px-4">
          Order
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in orderNav" :key="item.label">
              <SidebarMenuButton as-child>
                <NuxtLink :to="item.to" class="flex items-center gap-3">
                  <component :is="item.icon" class="size-4 shrink-0" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <!-- SETTINGS pinned at bottom -->
    <SidebarFooter class="border-t py-2">
      <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 px-4 mb-1">
        Settings
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in settingsNav" :key="item.label">
          <SidebarMenuButton as-child>
            <NuxtLink :to="item.to" class="flex items-center gap-3">
              <component :is="item.icon" class="size-4 shrink-0" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
