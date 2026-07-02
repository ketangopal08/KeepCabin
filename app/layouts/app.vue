<script setup lang="ts">
import { useOrgContext } from '~/composables/useOrgContext'

const { load } = useOrgContext()
onMounted(() => {
  load()
  document.documentElement.classList.remove('dark')
  localStorage.setItem('keepcabin-theme', 'light')
})
</script>

<template>
  <SidebarProvider>
    <TooltipProvider :delay-duration="500">
      <Sonner position="bottom-right" theme="light" rich-colors />
      <AppSidebar />
      <SidebarInset class="bg-[#fafafa]">
        <AppNavbar />
        <main class="flex-1 overflow-y-auto p-6">
          <slot />
        </main>
      </SidebarInset>
    </TooltipProvider>
  </SidebarProvider>
</template>
