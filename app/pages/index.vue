<script setup lang="ts">
const { isDark, init } = useLandingTheme()
onMounted(init)
</script>

<template>
  <div :class="isDark ? 'bg-[var(--lp-bg)]' : 'lp-light bg-[var(--lp-bg)]'" class="min-h-screen text-[var(--lp-text)] relative">
    <!-- Global vertical guide lines at content container edges — run full page height -->
    <div class="fixed inset-y-0 left-1/2 -translate-x-[544px] border-l border-dashed border-[var(--lp-border-section)] hidden xl:block pointer-events-none z-10" />
    <div class="fixed inset-y-0 left-1/2 translate-x-[543px] border-l border-dashed border-[var(--lp-border-section)] hidden xl:block pointer-events-none z-10" />
    <LandingNavbar />
    <LandingHeroSection />
    <LandingRevealSection />
    <LandingHowItWorksSection />
    <LandingFeaturesSection />
    <LandingTestimonialsSection />
    <LandingPricingSection />
    <LandingFooterSection />
  </div>
</template>
