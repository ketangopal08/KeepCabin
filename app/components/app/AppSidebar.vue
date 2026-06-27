<script setup lang="ts">
import {
  Star, Clock, Tag,
  FolderOpen, FileText, Share2,
  Settings, RefreshCw, Plus,
} from '@lucide/vue'
import type { Category } from '~~/lib/supabase'
import { nextCategoryColor } from '~~/lib/categorize'

const props = defineProps<{ categories: Category[] }>()
const emit  = defineEmits<{
  selectCategory:  [id: string | null]
  categoryCreated: [category: Category]
}>()

const activeCategoryId   = ref<string | null>(null)
const creatingCategory   = ref(false)
const newCategoryName    = ref('')
const dragOverId         = ref<string>('')   // '' = none; 'all' = All receipts

const mainNav = [
  { label: 'Favorites', icon: Star,        to: '/app' },
  { label: 'Recent',    icon: Clock,       to: '/app' },
  { label: 'Tags',      icon: Tag,         to: '/app' },
]

const orderNav = [
  { label: 'Drive Folders', icon: FolderOpen, to: '/app' },
  { label: 'Imported',      icon: FileText,   to: '/app' },
  { label: 'Shared',        icon: Share2,     to: '/app' },
]

const settingsNav = [
  { label: 'Settings',    icon: Settings,  to: '/app' },
  { label: 'Sync Status', icon: RefreshCw, to: '/app' },
]

function selectAll() {
  activeCategoryId.value = null
  emit('selectCategory', null)
}

function selectCategory(id: string) {
  activeCategoryId.value = id
  emit('selectCategory', id)
}

function startCreate() {
  creatingCategory.value = true
  newCategoryName.value  = ''
  nextTick(() => (document.getElementById('new-cat-input') as HTMLInputElement | null)?.focus())
}

async function confirmCreate() {
  const name = newCategoryName.value.trim()
  creatingCategory.value = false
  newCategoryName.value  = ''
  if (!name) return
  const color = nextCategoryColor(props.categories)
  const cat   = await $fetch<Category>('/api/categories', {
    method: 'POST',
    body: { name, color },
  })
  emit('categoryCreated', cat)
}

function onDragOver(e: DragEvent, id: string) {
  e.preventDefault()
  dragOverId.value = id
}

async function onDrop(e: DragEvent, categoryId: string | null) {
  dragOverId.value = ''
  const receiptId = e.dataTransfer?.getData('receiptId')
  if (!receiptId) return
  await $fetch(`/api/receipts/${receiptId}/category`, {
    method: 'PATCH',
    body: { categoryId, confirmed: true },
  })
}
</script>

<template>
  <Sidebar collapsible="icon">
    <!-- Profile -->
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
      <!-- RECEIPTS -->
      <SidebarGroup>
        <div class="flex items-center justify-between px-4 mb-1">
          <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 p-0">
            Receipts
          </SidebarGroupLabel>
          <button
            class="text-muted-foreground hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden"
            aria-label="New category"
            @click="startCreate"
          >
            <Plus class="size-3.5" />
          </button>
        </div>
        <SidebarGroupContent>
          <SidebarMenu>
            <!-- All receipts -->
            <SidebarMenuItem>
              <SidebarMenuButton
                :is-active="activeCategoryId === null"
                :class="{ 'ring-2 ring-inset ring-primary/40': dragOverId === 'all' }"
                @click="selectAll"
                @dragover="onDragOver($event, 'all')"
                @dragleave="dragOverId = ''"
                @drop="onDrop($event, null)"
              >
                <span class="size-2 rounded-full bg-foreground/30 shrink-0" />
                <span>All receipts</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <!-- Per-category rows -->
            <SidebarMenuItem v-for="cat in categories" :key="cat.id">
              <SidebarMenuButton
                :is-active="activeCategoryId === cat.id"
                :class="{ 'ring-2 ring-inset ring-primary/40': dragOverId === cat.id }"
                @click="selectCategory(cat.id)"
                @dragover="onDragOver($event, cat.id)"
                @dragleave="dragOverId = ''"
                @drop="onDrop($event, cat.id)"
              >
                <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: cat.color }" />
                <span>{{ cat.name }}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <!-- Inline create input -->
            <SidebarMenuItem v-if="creatingCategory">
              <div class="px-2 py-1">
                <input
                  id="new-cat-input"
                  v-model="newCategoryName"
                  placeholder="Category name…"
                  maxlength="50"
                  class="w-full text-sm bg-muted/50 border border-border rounded-md px-2 py-1 outline-none focus:border-primary"
                  @keydown.enter.prevent="confirmCreate"
                  @keydown.escape="creatingCategory = false"
                  @blur="confirmCreate"
                />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- MAIN -->
      <SidebarGroup>
        <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 px-4">
          Main
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in mainNav" :key="item.label">
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

    <!-- SETTINGS -->
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
