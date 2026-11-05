<script setup lang="ts">
const columns = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'How it works', href: '#how-it-works' },
      { label: 'Workflows', href: '#workflow' },
      { label: 'Pricing', href: '#pricing' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Sign in', to: '/app' },
      { label: 'Contact', href: 'mailto:hello@keepcabin.com' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'Get started', to: '/app' },
      { label: 'Enterprise', href: 'mailto:hello@keepcabin.com' },
    ],
  },
]
</script>

<template>
  <footer class="relative overflow-hidden bg-[var(--lp-bg)] border-t border-[var(--lp-border-section)]">
    <div class="relative z-10 max-w-[1088px] mx-auto px-6 pt-16">

      <!-- Top: brand + link columns -->
      <div class="flex flex-col lg:flex-row lg:justify-between gap-12">

        <div class="max-w-[280px]">
          <div class="flex items-center gap-2 mb-4">
            <img src="/logo.svg" class="size-8 rounded-md" alt="KeepCabin" />
            <span class="text-xl font-semibold text-[var(--lp-text)] tracking-tight">KeepCabin.</span>
          </div>
          <p class="text-sm text-[var(--lp-muted)] leading-relaxed">
            Receipt tracking, without the chaos — capture, approve and reimburse in one place.
          </p>
        </div>

        <div class="grid grid-cols-2 sm:grid-cols-3 gap-x-16 gap-y-10">
          <div v-for="col in columns" :key="col.title">
            <p class="text-sm text-[var(--lp-muted)] mb-4">{{ col.title }}</p>
            <ul class="space-y-3">
              <li v-for="link in col.links" :key="link.label">
                <NuxtLink
                  v-if="link.to"
                  :to="link.to"
                  class="text-sm text-[var(--lp-text)] opacity-85 hover:opacity-100 transition-opacity duration-150"
                >{{ link.label }}</NuxtLink>
                <a
                  v-else
                  :href="link.href"
                  class="text-sm text-[var(--lp-text)] opacity-85 hover:opacity-100 transition-opacity duration-150"
                >{{ link.label }}</a>
              </li>
            </ul>
          </div>
        </div>

      </div>

      <!-- Bottom bar -->
      <div class="mt-28 md:mt-40 pb-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="flex items-center gap-4">
          <p class="text-sm text-[var(--lp-muted)]">© 2026 KeepCabin. All rights reserved.</p>
          <span class="hidden sm:flex items-center gap-2">
            <span class="inline-block size-2 rounded-full bg-[#05df72]"></span>
            <span class="text-xs text-[var(--lp-muted)]">All systems online</span>
          </span>
        </div>
        <div class="flex items-center gap-5">
          <a href="#" class="text-sm text-[var(--lp-text)] opacity-85 hover:opacity-100 transition-opacity duration-150">Privacy Policy</a>
          <a href="#" class="text-sm text-[var(--lp-text)] opacity-85 hover:opacity-100 transition-opacity duration-150">Terms of Service</a>
        </div>
      </div>

    </div>

    <!-- Big watermark wordmark, cropped by the footer's bottom edge -->
    <p
      aria-hidden="true"
      class="pointer-events-none select-none absolute left-1/2 -translate-x-1/2 bottom-0 translate-y-[28%] whitespace-nowrap font-semibold leading-none tracking-tight text-[var(--lp-card-inner)] text-[clamp(72px,17vw,220px)]"
    >
      KeepCabin
    </p>
  </footer>
</template>
