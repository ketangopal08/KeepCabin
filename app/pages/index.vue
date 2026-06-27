<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-[#0e0e10] text-white relative">
    <!-- Global vertical guide lines at content container edges — run full page height -->
    <div class="fixed inset-y-0 left-1/2 -translate-x-[544px] border-l border-dashed border-[#232323] hidden xl:block pointer-events-none z-10" />
    <div class="fixed inset-y-0 left-1/2 translate-x-[543px] border-l border-dashed border-[#232323] hidden xl:block pointer-events-none z-10" />
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
