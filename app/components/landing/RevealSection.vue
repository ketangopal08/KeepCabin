<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'

const sectionEl = ref<HTMLElement | null>(null)
const scrollProgress = ref(0)

const words = 'Receipts pile up fast. Freelancers and small teams lose track of expenses every month. KeepCabin captures them all — automatically, so tax season never catches you off guard.'.split(' ')

function updateProgress() {
  if (!sectionEl.value) return
  const rect = sectionEl.value.getBoundingClientRect()
  const sectionHeight = sectionEl.value.offsetHeight
  const viewportHeight = window.innerHeight
  const scrolled = -rect.top
  const total = Math.max(sectionHeight - viewportHeight, 1)
  scrollProgress.value = Math.max(0, Math.min(1, scrolled / total))
}

onMounted(() => {
  window.addEventListener('scroll', updateProgress, { passive: true })
  updateProgress()
})

onUnmounted(() => {
  window.removeEventListener('scroll', updateProgress)
})

function wordStyle(index: number) {
  const total = words.length
  const winSize = 4 / total
  // Scale startReveal so the last word's endReveal lands exactly at 1.0
  const startReveal = (index / total) * (1 - winSize)
  const endReveal = startReveal + winSize
  const progress = (scrollProgress.value - startReveal) / Math.max(endReveal - startReveal, 0.001)
  const clamped = Math.max(0, Math.min(1, progress))

  // Color: #2c2c2c → #ffffff
  const dark = 44
  const light = 255
  const v = Math.round(dark + (light - dark) * clamped)

  // Blur: 14px → 0px
  const blur = (14 * (1 - clamped)).toFixed(1)

  return {
    color: `rgb(${v}, ${v}, ${v})`,
    filter: `blur(${blur}px)`,
  }
}
</script>

<template>
  <section ref="sectionEl" class="bg-[#0e0e10] border-b border-[#232323] relative" style="height: 300vh">
    <div class="sticky top-0 h-screen flex items-center px-6 border-b border-[#232323]">
      <div class="max-w-[1088px] mx-auto">
        <p class="text-[32px] md:text-[48px] lg:text-[56px] font-bold leading-[1.3]">
          <span
            v-for="(word, i) in words"
            :key="i"
            class="inline-block mr-[0.3em]"
            :style="wordStyle(i)"
          >{{ word }}</span>
        </p>
      </div>
    </div>
  </section>
</template>
