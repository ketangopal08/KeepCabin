<script setup lang="ts">
import { useOrgContext } from '~/composables/useOrgContext'

const { ctx, load } = useOrgContext()
onMounted(load)
</script>

<template>
  <SidebarProvider>
    <AppSidebar :role="ctx?.member?.role ?? null" />
    <SidebarInset>
      <AppNavbar />
      <main class="flex-1 overflow-auto p-6">
        <slot />
      </main>
    </SidebarInset>
  </SidebarProvider>
</template>
