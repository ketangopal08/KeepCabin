<script setup lang="ts">
import type { Receipt } from '~~/lib/supabase'
import { Sun, Moon, Search, SlidersHorizontal, LayoutList, LayoutGrid, ChevronLeft } from '@lucide/vue'

const refreshKey = ref(0)
const selectedReceipt = ref<Receipt | null>(null)
const { isDark, toggle } = useTheme()
const searchQuery = ref('')
const viewMode = ref<'list' | 'grid'>('list')

function onSynced() { refreshKey.value++ }
</script>

<template>
  <SidebarProvider>
    <AppSidebar />

    <div class="flex flex-1 flex-col min-h-screen overflow-hidden bg-background">
      <!-- ─── Header ────────────────────────────────────────────── -->
      <header class="shrink-0 px-6 pt-5 pb-4 flex flex-col gap-4">

        <!-- Row 1: breadcrumb + theme toggle -->
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-sm">
            <SidebarTrigger class="mr-1" />
            <NuxtLink
              to="/"
              class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft class="size-3.5" />
              Home
            </NuxtLink>
            <span class="text-muted-foreground select-none">/</span>
            <span class="font-semibold text-foreground">All Receipts</span>
          </div>

          <Button variant="ghost" size="icon" @click="toggle" aria-label="Toggle theme">
            <Sun v-if="isDark" class="size-4" />
            <Moon v-else class="size-4" />
          </Button>
        </div>

        <!-- Row 2: search + actions -->
        <div class="flex items-center gap-3">
          <!-- Search -->
          <div class="relative flex-1 max-w-md">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              v-model="searchQuery"
              placeholder="Search a receipt…"
              class="pl-9 bg-muted/40 border-transparent focus:border-border focus:bg-background"
            />
          </div>

          <!-- Sync / Import buttons -->
          <AppSyncButtons @synced="onSynced" />

          <!-- Divider -->
          <Separator orientation="vertical" class="h-6" />

          <!-- Filters button -->
          <Button variant="outline" size="sm" class="gap-2 font-normal">
            <SlidersHorizontal class="size-4" />
            Filters
          </Button>

          <!-- View toggle -->
          <div class="flex items-center rounded-lg border overflow-hidden divide-x">
            <Button
              variant="ghost"
              size="icon"
              class="rounded-none size-8"
              :class="viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
              @click="viewMode = 'list'"
              aria-label="List view"
            >
              <LayoutList class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="rounded-none size-8"
              :class="viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
              @click="viewMode = 'grid'"
              aria-label="Grid view"
            >
              <LayoutGrid class="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <!-- ─── Main content ──────────────────────────────────────── -->
      <main class="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
        <AppReceiptsTable
          :key="refreshKey"
          class="flex-1 overflow-auto"
          @select="selectedReceipt = $event"
        />
        <AppReceiptPanel
          :receipt="selectedReceipt"
          class="w-80 shrink-0"
        />
      </main>
    </div>
  </SidebarProvider>
</template>
