<script setup lang="ts">
const links = [
  { label: 'Home', icon: '🏠', to: '/app' },
  { label: 'Receipts', icon: '🧾', to: '/app' },
  { label: 'Folders', icon: '📁', to: '/app' },
  { label: 'Settings', icon: '⚙️', to: '/app' },
]
</script>

<template>
  <aside class="w-56 shrink-0 border-r bg-background h-full flex flex-col py-4 px-3 gap-1">
    <NuxtLink
      v-for="link in links"
      :key="link.label"
      :to="link.to"
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      active-class="bg-muted"
    >
      <span>{{ link.icon }}</span>
      <span>{{ link.label }}</span>
    </NuxtLink>
  </aside>
</template>
