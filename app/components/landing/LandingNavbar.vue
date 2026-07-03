<script setup lang="ts">
import { Sun, Moon } from '@lucide/vue'
const { isDark, toggle } = useLandingTheme()
const { show: showLoader } = usePageLoader()

function goToLogin() {
  showLoader('Checking your account…')
  navigateTo('/login')
}

function goToApp(msg = 'Taking you in…') {
  showLoader(msg)
  navigateTo('/app')
}
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
        <button
          class="text-sm text-[var(--lp-muted)] hover:text-[var(--lp-text)] transition-colors duration-150"
          @click="goToLogin"
        >
          Log in
        </button>

        <button
          @click="toggle"
          class="p-1.5 rounded-[8px] text-[var(--lp-muted)] hover:text-[var(--lp-text)] hover:bg-[var(--lp-card-inner)] transition-colors duration-150"
          :aria-label="isDark ? 'Switch to light mode' : 'Switch to dark mode'"
        >
          <Sun v-if="!isDark" class="size-4" />
          <Moon v-else class="size-4 " />
        </button>

        <button
          class="px-4 py-1.5 text-sm bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)] font-medium rounded-[10px] hover:opacity-90 transition-opacity duration-150"
          @click="goToApp('Taking you in…')"
        >
          Get Started
        </button>
      </div>

    </div>
  </nav>
</template>
