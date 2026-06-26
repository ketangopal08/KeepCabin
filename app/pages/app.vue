<script setup lang="ts">
import type { Receipt } from '~~/lib/supabase'
import { Sun, Moon } from '@lucide/vue'

const refreshKey = ref(0)
const selectedReceipt = ref<Receipt | null>(null)
const { isDark, toggle } = useTheme()

function onSynced() { refreshKey.value++ }
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <div class="flex flex-1 flex-col min-h-screen overflow-hidden">
      <header class="border-b bg-background h-14 flex items-center gap-3 px-4 shrink-0">
        <SidebarTrigger />
        <span class="font-semibold text-sm">KeepCabin</span>
        <div class="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" @click="toggle" aria-label="Toggle theme">
            <Sun v-if="isDark" class="size-4" />
            <Moon v-else class="size-4" />
          </Button>
          <AppSyncButtons @synced="onSynced" />
        </div>
      </header>

      <main class="flex flex-1 overflow-hidden gap-4 p-4">
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
