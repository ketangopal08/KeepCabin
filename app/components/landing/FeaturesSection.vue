<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

const sectionEl = ref<HTMLElement | null>(null)
const revealed = ref(false)

useIntersectionObserver(
  sectionEl,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      revealed.value = true
    }
  },
  { threshold: 0.1 },
)
</script>

<template>
  <section id="features" ref="sectionEl" class="bg-[var(--lp-bg)]">

    <div
      class="border-b border-[var(--lp-border-section)] py-20 px-6 bg-[var(--lp-bg)]"
      :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
      :style="{ animationDelay: '0ms' }"
    >
      <div class="max-w-[1088px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-6">
        <div>
          <p class="text-xs text-[var(--lp-muted)] tracking-widest uppercase mb-3">Sync</p>
          <h2 class="text-[32px] md:text-[40px] font-bold text-[var(--lp-text)] leading-[1.1] mb-4">
            Connect your Drive, import instantly.
          </h2>
          <p class="text-base text-[var(--lp-muted)] leading-relaxed mb-6">
            Paste any public Google Drive folder link. KeepCabin syncs all receipt images automatically — no manual uploads, no drag-and-drop.
          </p>
          <NuxtLink
            to="/app"
            class="px-4 py-2 bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)] text-sm font-medium rounded-[10px] hover:opacity-90 transition-opacity inline-block"
          >
            Get started →
          </NuxtLink>
        </div>

        <div class="bg-[var(--lp-card)] border border-[var(--lp-border)] rounded-[10px] p-5 ">
          <p class="text-xs text-[var(--lp-faint)] mb-3">Google Drive — /receipts-2026</p>
          <div class="flex items-center gap-3 py-2 border-b border-[var(--lp-card-inner)]">
            <div class="size-6 rounded bg-[var(--lp-card-inner)] border border-[var(--lp-border)] flex items-center justify-center text-[10px] text-[#0c8ce9]">📄</div>
            <span class="text-xs text-[var(--lp-text)] flex-1">starbucks_jun25.jpg</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] bg-[#002c22] text-[#05df72]">Synced</span>
          </div>
          <div class="flex items-center gap-3 py-2 border-b border-[var(--lp-card-inner)]">
            <div class="size-6 rounded bg-[var(--lp-card-inner)] border border-[var(--lp-border)] flex items-center justify-center text-[10px] text-[#0c8ce9]">📄</div>
            <span class="text-xs text-[var(--lp-text)] flex-1">uber_eats_jun24.jpg</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] bg-[#002c22] text-[#05df72]">Synced</span>
          </div>
          <div class="flex items-center gap-3 py-2 border-b border-[var(--lp-card-inner)]">
            <div class="size-6 rounded bg-[var(--lp-card-inner)] border border-[var(--lp-border)] flex items-center justify-center text-[10px] text-[#0c8ce9]">📄</div>
            <span class="text-xs text-[var(--lp-text)] flex-1">amazon_jun23.jpg</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] bg-[#002c22] text-[#05df72]">Synced</span>
          </div>
          <div class="flex items-center gap-3 py-2 border-b border-[var(--lp-card-inner)]">
            <div class="size-6 rounded bg-[var(--lp-card-inner)] border border-[var(--lp-border)] flex items-center justify-center text-[10px] text-[#0c8ce9]">📄</div>
            <span class="text-xs text-[var(--lp-text)] flex-1">wegmans_jun22.jpg</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] bg-[#002c22] text-[#05df72]">Synced</span>
          </div>
          <div class="flex items-center gap-3 py-2">
            <div class="size-6 rounded bg-[var(--lp-card-inner)] border border-[var(--lp-border)] flex items-center justify-center text-[10px] text-[#0c8ce9]">📄</div>
            <span class="text-xs text-[var(--lp-text)] flex-1">zoom_jun21.jpg</span>
            <span class="px-1.5 py-0.5 rounded text-[10px] bg-[#002c22] text-[#05df72]">Synced</span>
          </div>
        </div>
      </div>
    </div>

    <div
      class="border-b border-[var(--lp-border-section)] py-20 px-6 bg-[var(--lp-bg)]"
      :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
      :style="{ animationDelay: '100ms' }"
    >
      <div class="max-w-[1088px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-6">
        <div class="bg-[var(--lp-card)] border border-[var(--lp-border)] rounded-[10px] p-5 ">
          <p class="text-xs text-[var(--lp-faint)] mb-3">OCR result — starbucks_jun25.jpg</p>
          <div class="flex justify-between py-1.5 border-b border-[var(--lp-card-inner)]">
            <span class="text-xs text-[var(--lp-muted)]">Merchant</span>
            <span class="text-xs text-[var(--lp-text)] font-medium">Starbucks Coffee</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-[var(--lp-card-inner)]">
            <span class="text-xs text-[var(--lp-muted)]">Date</span>
            <span class="text-xs text-[var(--lp-text)] font-medium">Jun 25 2026</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-[var(--lp-card-inner)]">
            <span class="text-xs text-[var(--lp-muted)]">Caramel Macchiato</span>
            <span class="text-xs text-[var(--lp-text)] font-medium">$5.95</span>
          </div>
          <div class="flex justify-between py-1.5 border-b border-[var(--lp-card-inner)]">
            <span class="text-xs text-[var(--lp-muted)]">Butter Croissant</span>
            <span class="text-xs text-[var(--lp-text)] font-medium">$3.25</span>
          </div>
          <div class="flex justify-between py-1.5">
            <span class="text-xs text-[var(--lp-muted)]">Tax</span>
            <span class="text-xs text-[var(--lp-text)] font-medium">$0.74</span>
          </div>
          <div class="flex justify-between pt-2 mt-1">
            <span class="text-sm font-bold text-[var(--lp-text)]">Total</span>
            <span class="text-sm font-bold text-[#05df72]">$9.94</span>
          </div>
          <div class="mt-3 inline-flex items-center gap-1 px-2 py-1 rounded bg-[#002c22] text-[#05df72] text-[11px]">
            ● 98% confidence
          </div>
        </div>

        <div>
          <p class="text-xs text-[var(--lp-muted)] tracking-widest uppercase mb-3">OCR</p>
          <h2 class="text-[32px] md:text-[40px] font-bold text-[var(--lp-text)] leading-[1.1] mb-4">
            Extract every detail automatically.
          </h2>
          <p class="text-base text-[var(--lp-muted)] leading-relaxed mb-6">
            Tesseract-powered OCR reads merchant names, dates, line items, and totals from any receipt photo — even low-quality images.
          </p>
          <NuxtLink
            to="/app"
            class="px-4 py-2 bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)] text-sm font-medium rounded-[10px] hover:opacity-90 transition-opacity inline-block"
          >
            Get started →
          </NuxtLink>
        </div>
      </div>
    </div>

    <div
      class="border-b border-[var(--lp-border-section)] py-20 px-6 bg-[var(--lp-bg)]"
      :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
      :style="{ animationDelay: '200ms' }"
    >
      <div class="max-w-[1088px] mx-auto grid grid-cols-1 md:grid-cols-2 gap-12 items-center px-6">
        <div>
          <p class="text-xs text-[var(--lp-muted)] tracking-widest uppercase mb-3">Dashboard</p>
          <h2 class="text-[32px] md:text-[40px] font-bold text-[var(--lp-text)] leading-[1.1] mb-4">
            Every receipt, perfectly organized.
          </h2>
          <p class="text-base text-[var(--lp-muted)] leading-relaxed mb-6">
            Browse structured receipt summaries, filter by category or date, and export to CSV whenever you need it. Your data, your way.
          </p>
          <NuxtLink
            to="/app"
            class="px-4 py-2 bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)] text-sm font-medium rounded-[10px] hover:opacity-90 transition-opacity inline-block"
          >
            Get started →
          </NuxtLink>
        </div>

        <div class="bg-[var(--lp-card)] border border-[var(--lp-border)] rounded-[10px] p-5 ">
          <div class="grid grid-cols-2 gap-3 mb-4">
            <div class="bg-[var(--lp-card-inner)] border border-[var(--lp-border)] rounded-[8px] p-3">
              <p class="text-[10px] text-[var(--lp-muted)] uppercase tracking-wider">This month</p>
              <p class="text-2xl font-bold text-[var(--lp-text)] mt-1">$1,284</p>
              <p class="text-[11px] text-[#05df72] mt-0.5">↑ 12 receipts</p>
            </div>
            <div class="bg-[var(--lp-card-inner)] border border-[var(--lp-border)] rounded-[8px] p-3">
              <p class="text-[10px] text-[var(--lp-muted)] uppercase tracking-wider">Categories</p>
              <p class="text-2xl font-bold text-[var(--lp-text)] mt-1">4</p>
              <p class="text-[11px] text-[#05df72] mt-0.5">Active</p>
            </div>
          </div>
          <div class="space-y-1.5">
            <div class="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-[var(--lp-card-inner)] border border-[var(--lp-border)]">
              <div class="size-6 rounded bg-[var(--lp-bg)] border border-[var(--lp-border)] text-[var(--lp-muted)] text-[9px] font-bold flex items-center justify-center">SB</div>
              <span class="text-xs text-[var(--lp-text)] flex-1">Starbucks</span>
              <span class="text-xs text-[var(--lp-text)] font-medium">$9.94</span>
            </div>
            <div class="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-[var(--lp-card-inner)] border border-[var(--lp-border)]">
              <div class="size-6 rounded bg-[var(--lp-bg)] border border-[var(--lp-border)] text-[var(--lp-muted)] text-[9px] font-bold flex items-center justify-center">UB</div>
              <span class="text-xs text-[var(--lp-text)] flex-1">Uber Eats</span>
              <span class="text-xs text-[var(--lp-text)] font-medium">$34.50</span>
            </div>
            <div class="flex items-center gap-2 px-3 py-2 rounded-[6px] bg-[var(--lp-card-inner)] border border-[var(--lp-border)]">
              <div class="size-6 rounded bg-[var(--lp-bg)] border border-[var(--lp-border)] text-[var(--lp-muted)] text-[9px] font-bold flex items-center justify-center">AM</div>
              <span class="text-xs text-[var(--lp-text)] flex-1">Amazon</span>
              <span class="text-xs text-[var(--lp-text)] font-medium">$127.00</span>
            </div>
          </div>
        </div>
      </div>
    </div>

  </section>
</template>
