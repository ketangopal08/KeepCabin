<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-foreground">
    <AppNavbar />
    <div class="flex flex-1 overflow-hidden">
      <AppSidebar />
      <main class="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        <!-- SyncButtons slot -->
        <div class="flex flex-1 gap-4 overflow-hidden">
          <!-- ReceiptsTable slot -->
          <div class="flex-1" />
          <!-- ReceiptPanel slot -->
          <div class="w-80 shrink-0" />
        </div>
      </main>
    </div>
  </div>
</template>
