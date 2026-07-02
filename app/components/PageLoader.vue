<script setup lang="ts">
const { visible, message } = usePageLoader()
</script>

<template>
  <Transition name="loader">
    <div
      v-if="visible"
      class="fixed inset-0 z-[9999] flex flex-col items-center justify-center backdrop-blur-sm bg-black/92"
    >
      <!-- Spinner -->
      <Spinner class="size-6 text-white mb-5" />

      <!-- Message -->
      <p class="text-[15px] font-medium text-white tracking-tight">{{ message }}</p>
      <p class="text-[12.5px] text-white/50 mt-1">Just a moment…</p>
    </div>
  </Transition>
</template>

<style scoped>
.loader-enter-active { transition: opacity 0.2s ease; }
.loader-leave-active { transition: opacity 0.25s ease; }
.loader-enter-from,
.loader-leave-to     { opacity: 0; }
</style>
