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

const tiers = [
  {
    name: 'Free',
    price: '$0',
    features: ['50 receipts/month', 'Google Drive sync', 'OCR extraction'],
    cta: 'Get started',
    href: '/app',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$9',
    features: ['Unlimited receipts', 'Google Drive sync', 'Priority support', 'CSV export'],
    cta: 'Get started',
    href: '/app',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$29',
    features: ['Unlimited receipts', 'Team access', 'API access', 'Custom branding'],
    cta: 'Contact us',
    href: 'mailto:hello@keepcabin.com',
    highlighted: false,
  },
]
</script>

<template>
  <section id="pricing" ref="sectionEl" class="bg-[var(--lp-bg)] border-b border-[var(--lp-border-section)] py-24 px-6">
    <div class="max-w-[1088px] mx-auto px-6">
      <div class="text-left">
        <p class="text-xs text-[var(--lp-muted)] tracking-widest uppercase mb-4">Pricing</p>
        <h2 class="text-[36px] md:text-[40px] font-bold text-[var(--lp-text)] leading-[1.1]">
          Simple pricing
        </h2>
      </div>

      <div class="mt-12 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div
          v-for="(tier, i) in tiers"
          :key="tier.name"
          class="relative rounded-[10px] p-6 flex flex-col gap-6"
          :class="[
            tier.highlighted
              ? 'bg-[var(--lp-card-inner)] border border-[var(--lp-featured-border)] '
              : 'bg-[var(--lp-card)] border border-[var(--lp-border)] ',
            revealed ? 'animate-fade-blur-in-up' : 'opacity-0',
          ]"
          :style="{ animationDelay: `${i * 100}ms` }"
        >
          <div
            v-if="tier.highlighted"
            class="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)] text-[11px] font-medium"
          >
            Most popular
          </div>

          <div>
            <p class="text-sm font-medium text-[var(--lp-muted)]">{{ tier.name }}</p>
            <div class="flex items-baseline gap-1 mt-2">
              <span class="text-[40px] font-bold leading-none text-[var(--lp-text)]">{{ tier.price }}</span>
              <span class="text-sm text-[var(--lp-muted)]">/mo</span>
            </div>
          </div>

          <ul class="space-y-3 flex-1">
            <li
              v-for="feat in tier.features"
              :key="feat"
              class="flex items-center gap-2 text-sm text-[var(--lp-muted)]"
            >
              <span class="text-[var(--lp-text)] font-bold text-xs">✓</span>
              {{ feat }}
            </li>
          </ul>

          <a
            :href="tier.href"
            class="block w-full py-2.5 rounded-[10px] text-sm font-medium text-center transition-all duration-150 hover:opacity-90"
            :class="tier.highlighted
              ? 'bg-[var(--lp-btn-bg)] text-[var(--lp-btn-text)]'
              : 'border border-[var(--lp-border)] text-[var(--lp-text)] bg-transparent hover:bg-[var(--lp-card-inner)]'"
          >
            {{ tier.cta }}
          </a>
        </div>
      </div>
    </div>
  </section>
</template>
