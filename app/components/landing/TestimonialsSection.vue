<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'

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

const testimonials = [
  {
    quote: 'Finally ditched my folder of receipt photos. KeepCabin pulls everything from Drive and reads it instantly.',
    initials: 'AM',
    name: 'Alex M.',
    role: 'Freelance Designer',
  },
  {
    quote: "The OCR accuracy is impressive. It caught line items I'd have missed manually.",
    initials: 'PS',
    name: 'Priya S.',
    role: 'Small Business Owner',
  },
  {
    quote: 'Setup took two minutes. I connected my Drive folder and it just worked.',
    initials: 'JK',
    name: 'Jordan K.',
    role: 'Consultant',
  },
]
</script>

<template>
  <section ref="sectionEl" class="bg-[var(--lp-bg)] border-b border-[var(--lp-border-section)] py-24 px-6">
    <div class="max-w-[1088px] mx-auto px-6">

      <div class="text-center">
        <p class="text-xs text-[var(--lp-muted)] tracking-widest uppercase mb-4">Testimonials</p>
        <h2 class="text-[36px] md:text-[40px] font-bold text-[var(--lp-text)] leading-[1.1]">
          Trusted by people who hate spreadsheets
        </h2>
      </div>

      <div class="hidden md:grid mt-12 grid-cols-3 gap-4">
        <div
          v-for="(t, i) in testimonials"
          :key="t.name"
          class="bg-[var(--lp-card)] border border-[var(--lp-border)] rounded-[10px] p-6 flex flex-col gap-4"
          :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
          :style="{ animationDelay: `${i * 100}ms` }"
        >
          <p class="text-sm text-[var(--lp-muted)] leading-relaxed flex-1 italic">"{{ t.quote }}"</p>
          <div class="flex items-center gap-3">
            <div class="size-8 rounded-full bg-[var(--lp-card-inner)] border border-[var(--lp-border)] text-[#0c8ce9] font-bold text-xs flex items-center justify-center shrink-0">
              {{ t.initials }}
            </div>
            <div>
              <p class="text-sm font-medium text-[var(--lp-text)]">{{ t.name }}</p>
              <p class="text-xs text-[var(--lp-muted)]">{{ t.role }}</p>
            </div>
          </div>
        </div>
      </div>

      <div class="md:hidden mt-12 overflow-hidden">
        <div class="flex gap-4 animate-marquee" style="width: max-content">
          <div
            v-for="(t, i) in [...testimonials, ...testimonials]"
            :key="`${t.name}-${i}`"
            class="w-72 shrink-0 bg-[var(--lp-card)] border border-[var(--lp-border)] rounded-[10px] p-6 flex flex-col gap-4"
          >
            <p class="text-sm text-[var(--lp-muted)] leading-relaxed flex-1 italic">"{{ t.quote }}"</p>
            <div class="flex items-center gap-3">
              <div class="size-8 rounded-full bg-[var(--lp-card-inner)] border border-[var(--lp-border)] text-[#0c8ce9] font-bold text-xs flex items-center justify-center shrink-0">
                {{ t.initials }}
              </div>
              <div>
                <p class="text-sm font-medium text-[var(--lp-text)]">{{ t.name }}</p>
                <p class="text-xs text-[var(--lp-muted)]">{{ t.role }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

    </div>
  </section>
</template>
