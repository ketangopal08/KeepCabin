<script setup lang="ts">
import { Sun, Moon } from '@lucide/vue'
const { isDark, toggle } = useLandingTheme()
</script>

<template>
  <nav class="sticky top-0 z-50 bg-[var(--lp-bg)] border-b border-[var(--lp-border-section)]">
    <div class="max-w-[1088px] mx-auto px-4 h-14 flex items-center justify-between">

      <div class="flex items-center gap-2">
        <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin"/>
        <span class="text-sm font-semibold text-[var(--lp-text)]">KeepCabin</span>
      </div>

      <div class="hidden md:flex items-center gap-0">
        <a href="#features" class="px-3 py-1.5 text-sm text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors duration-150">
          Features
        </a>
        <a href="#how-it-works" class="px-3 py-1.5 text-sm text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors duration-150">
          How it works
        </a>
        <a href="#pricing" class="px-3 py-1.5 text-sm text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors duration-150">
          Pricing
        </a>
      </div>

      <div class="flex items-center gap-3">
        <NuxtLink
          to="/app"
          class="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors duration-150"
        >
          Log in
        </NuxtLink>

        <button
          @click="toggle"
          class="p-1.5 rounded-[8px] text-[var(--lp-muted)] hover:text-[var(--lp-text)] hover:bg-[var(--lp-card-inner)] transition-colors duration-150"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <Sun v-if="!isDark" class="size-4" />
          <Moon v-else class="size-4 " />
        </button>

        <NuxtLink
          to="/app"
          class="px-4 py-1.5 text-sm bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)] font-medium rounded-[10px] hover:opacity-90 transition-opacity duration-150"
        >
          Get Started
        </NuxtLink>
      </div>

    </div>
  </nav>
</template>
