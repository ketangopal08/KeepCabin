<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import { FolderOpen, Scan, LayoutDashboard } from '@lucide/vue'

const sectionEl = ref<HTMLElement | null>(null)
const revealed = ref(false)

const { stop } = useIntersectionObserver(
  sectionEl,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      revealed.value = true
      stop()
    }
  },
  { threshold: 0.15 },
)

const steps = [
  {
    number: '01',
    icon: FolderOpen,
    title: 'Connect your Drive',
    description: 'Paste a public Google Drive folder link. KeepCabin syncs all receipt images instantly — no manual upload required.',
  },
  {
    number: '02',
    icon: Scan,
    title: 'Snap your receipts',
    description: 'OCR runs automatically on every image. Merchant names, dates, line items, and totals are extracted in seconds.',
  },
  {
    number: '03',
    icon: LayoutDashboard,
    title: 'View & export',
    description: 'Browse clean, structured receipt summaries. Copy data or download any time from your dashboard.',
  },
]
</script>

<template>
  <section id="how-it-works" ref="sectionEl" class="bg-[#0e0e10] border-b border-[#232323] py-24 px-6">
    <div class="max-w-[1088px] mx-auto">

      <div>
        <p class="text-xs text-[#7c7c7c] tracking-widest uppercase mb-4">How it works</p>
        <h2 class="text-[36px] md:text-[40px] font-bold text-white leading-[1.1]">
          Up and running in minutes
        </h2>
      </div>

      <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">

        <div
          v-for="(step, i) in steps"
          :key="step.number"
          class="bg-[#141414] border border-[#2c2c2c] rounded-[10px] p-6 shadow-[0_0_0_1px_#2b2b2f]"
          :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
          :style="{ animationDelay: `${i * 100}ms` }"
        >
          <p class="text-[11px] text-[#4b4b4b] font-mono mb-4">{{ step.number }}</p>

          <div class="size-10 rounded-[8px] bg-[#1a1a1a] border border-[#2c2c2c] flex items-center justify-center mb-4">
            <component :is="step.icon" class="size-5 text-[#0c8ce9]" />
          </div>

          <h3 class="text-sm font-semibold text-white mb-2">{{ step.title }}</h3>
          <p class="text-sm text-[#7c7c7c] leading-relaxed">{{ step.description }}</p>
        </div>

      </div>
    </div>
  </section>
</template>
