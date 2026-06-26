<script setup lang="ts">
import type { Receipt } from '~~/lib/supabase'

const refreshKey = ref(0)
const selectedReceipt = ref<Receipt | null>(null)

function onSynced() { refreshKey.value++ }
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-foreground">
    <AppNavbar />
    <div class="flex flex-1 overflow-hidden">
      <AppSidebar />
      <main class="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        <SyncButtons @synced="onSynced" />
        <div class="flex flex-1 gap-4 overflow-hidden">
          <!-- ReceiptsTable slot -->
          <ReceiptsTable :key="refreshKey" class="flex-1 overflow-auto" @select="selectedReceipt = $event" />
          <!-- ReceiptPanel slot — Task 9 will replace this -->
          <div class="w-80 shrink-0" />
        </div>
      </main>
    </div>
  </div>
</template>
