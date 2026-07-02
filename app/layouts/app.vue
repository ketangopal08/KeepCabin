<script setup lang="ts">
import { useOrgContext } from '~/composables/useOrgContext'

const { load } = useOrgContext()
const { init: initTheme } = useTheme()
onMounted(() => {
  load()
  initTheme()
})
</script>

<template>
  <SidebarProvider>
    <TooltipProvider :delay-duration="500">
      <Sonner position="bottom-right" theme="light" rich-colors />
      <AppSidebar />
      <SidebarInset class="bg-background">
        <AppNavbar />
        <main class="flex-1 overflow-y-auto p-6">
          <slot />
        </main>
      </SidebarInset>
    </TooltipProvider>
  </SidebarProvider>
</template>
