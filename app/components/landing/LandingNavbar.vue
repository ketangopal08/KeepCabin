<template>
  <nav class="sticky top-0 z-50 bg-[#0e0e10] border-b border-[#232323]">
    <div class="max-w-[1088px] mx-auto px-4 h-14 flex items-center justify-between">

      <span class="text-sm font-semibold text-white">KeepCabin</span>

      <div class="hidden md:flex items-center gap-0">
        <a href="#features" class="px-3 py-1.5 text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">
          Features
        </a>
        <a href="#how-it-works" class="px-3 py-1.5 text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">
          How it works
        </a>
        <a href="#pricing" class="px-3 py-1.5 text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">
          Pricing
        </a>
      </div>

      <div class="flex items-center gap-3">
        <NuxtLink
          to="/app"
          class="text-sm text-white hover:text-[#7c7c7c] transition-colors duration-150"
        >
          Log in
        </NuxtLink>

        <NuxtLink
          to="/app"
          class="px-4 py-1.5 text-sm bg-white text-[#0e0e10] font-medium rounded-[10px] hover:opacity-90 transition-opacity duration-150"
        >
          Get Started
        </NuxtLink>
      </div>

    </div>
  </nav>
</template>
