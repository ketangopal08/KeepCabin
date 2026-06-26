<script setup lang="ts">
import type { Receipt } from '~~/lib/supabase'

const refreshKey = ref(0)
const selectedReceipt = ref<Receipt | null>(null)

function onSynced() { refreshKey.value++ }
</script>

<template>
  <SidebarProvider>
    <AppSidebar />
    <div class="flex flex-1 flex-col min-h-screen overflow-hidden">
      <!-- Top navbar -->
      <header class="border-b bg-background h-14 flex items-center gap-3 px-4 shrink-0">
        <SidebarTrigger />
        <span class="font-semibold text-sm">KeepCabin</span>
        <div class="ml-auto">
          <AppSyncButtons @synced="onSynced" />
        </div>
      </header>

      <!-- Main content -->
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
