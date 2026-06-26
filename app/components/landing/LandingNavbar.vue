<script setup lang="ts">
import { Sun, Moon } from '@lucide/vue'
const { isDark, toggle } = useTheme()
</script>

<template>
  <nav class="border-b bg-background sticky top-0 z-50">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <span class="text-xl font-bold tracking-tight">KeepCabin</span>
      <div class="flex items-center gap-3">
        <Button variant="ghost" size="icon" @click="toggle" aria-label="Toggle theme">
          <Sun v-if="isDark" class="size-4" />
          <Moon v-else class="size-4" />
        </Button>
        <NuxtLink to="/app">
          <Button variant="default">Get Started</Button>
        </NuxtLink>
      </div>
    </div>
  </nav>
</template>
