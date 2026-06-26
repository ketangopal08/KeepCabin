<script setup lang="ts">
const refreshKey = ref(0)
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
          <div :key="refreshKey" class="flex-1" />
          <!-- ReceiptPanel slot -->
          <div class="w-80 shrink-0" />
        </div>
      </main>
    </div>
  </div>
</template>
