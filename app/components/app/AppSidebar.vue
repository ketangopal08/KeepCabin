<script setup lang="ts">
import {
  Star, Clock, Tag,
  FolderOpen, FileText, Share2,
  Settings, RefreshCw, Plus, Check,
} from '@lucide/vue'
import type { Category } from '~~/lib/supabase'
import { CATEGORY_COLORS, nextCategoryColor } from '~~/lib/categorize'

const props = defineProps<{ categories: Category[] }>()
const emit  = defineEmits<{
  selectCategory:  [id: string | null]
  categoryCreated: [category: Category]
  receiptAssigned: []
}>()

const activeCategoryId = ref<string | null>(null)
const dragOverId       = ref<string>('')

// Dialog state
const dialogOpen      = ref(false)
const newCategoryName = ref('')
const newCategoryColor = ref('')
const creating        = ref(false)
const nameError       = ref('')

function openDialog() {
  newCategoryName.value  = ''
  newCategoryColor.value = nextCategoryColor(props.categories)
  nameError.value        = ''
  dialogOpen.value       = true
  nextTick(() => (document.getElementById('cat-name-input') as HTMLInputElement | null)?.focus())
}

async function submitCreate() {
  const name = newCategoryName.value.trim()
  if (!name) { nameError.value = 'Name is required'; return }
  if (name.length > 50) { nameError.value = 'Max 50 characters'; return }
  creating.value = true
  try {
    const cat = await $fetch<Category>('/api/categories', {
      method: 'POST',
      body: { name, color: newCategoryColor.value },
    })
    emit('categoryCreated', cat)
    dialogOpen.value = false
  } finally {
    creating.value = false
  }
}

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
  { label: 'Settings',    icon: Settings,  to: '/settings' },
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
  emit('receiptAssigned')
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
            @click="openDialog"
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

  <!-- Create Category Dialog -->
  <Dialog v-model:open="dialogOpen">
    <DialogContent class="sm:max-w-sm">
      <DialogHeader>
        <DialogTitle>New category</DialogTitle>
        <DialogDescription>
          Give your category a name and pick a color.
        </DialogDescription>
      </DialogHeader>

      <div class="flex flex-col gap-4 py-2">
        <!-- Name input -->
        <div class="flex flex-col gap-1.5">
          <label for="cat-name-input" class="text-sm font-medium">Name</label>
          <Input
            id="cat-name-input"
            v-model="newCategoryName"
            placeholder="e.g. Food & dining"
            maxlength="50"
            :class="nameError ? 'border-destructive focus-visible:ring-destructive' : ''"
            @keydown.enter.prevent="submitCreate"
          />
          <p v-if="nameError" class="text-xs text-destructive">{{ nameError }}</p>
        </div>

        <!-- Color picker -->
        <div class="flex flex-col gap-1.5">
          <label class="text-sm font-medium">Color</label>
          <div class="flex flex-wrap gap-2">
            <button
              v-for="color in CATEGORY_COLORS"
              :key="color"
              type="button"
              class="size-7 rounded-full transition-transform hover:scale-110 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-background"
              :style="{ backgroundColor: color }"
              :class="newCategoryColor === color ? 'ring-2 ring-offset-2 ring-offset-background scale-110' : ''"
              :aria-label="color"
              @click="newCategoryColor = color"
            >
              <Check v-if="newCategoryColor === color" class="size-3.5 text-white mx-auto drop-shadow" />
            </button>
          </div>
        </div>

        <!-- Preview -->
        <div class="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50">
          <span class="size-2.5 rounded-full shrink-0" :style="{ backgroundColor: newCategoryColor }" />
          <span class="text-sm text-foreground truncate">{{ newCategoryName || 'Category preview' }}</span>
        </div>
      </div>

      <DialogFooter>
        <Button variant="outline" @click="dialogOpen = false">Cancel</Button>
        <Button :disabled="creating" @click="submitCreate">
          {{ creating ? 'Creating…' : 'Create category' }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
