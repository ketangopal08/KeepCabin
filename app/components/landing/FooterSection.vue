<template>
  <footer class="bg-[#0e0e10] border-t border-[#232323]">
    <div class="max-w-[1088px] mx-auto px-6 py-16">

      <div class="grid grid-cols-2 md:grid-cols-4 gap-8 md:gap-12">

        <div class="col-span-2 md:col-span-1">
          <p class="text-sm font-semibold text-white mb-2">KeepCabin</p>
          <p class="text-sm text-[#7c7c7c] leading-relaxed max-w-[200px]">Receipt tracking, without the chaos.</p>
        </div>

        <div>
          <p class="text-xs text-[#4b4b4b] uppercase tracking-widest mb-4 font-medium">Product</p>
          <ul class="space-y-3">
            <li><a href="#features" class="text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">Features</a></li>
            <li><a href="#how-it-works" class="text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">How it works</a></li>
            <li><a href="#pricing" class="text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">Pricing</a></li>
          </ul>
        </div>

        <div>
          <p class="text-xs text-[#4b4b4b] uppercase tracking-widest mb-4 font-medium">Resources</p>
          <ul class="space-y-3">
            <li><NuxtLink to="/app" class="text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">Sign in</NuxtLink></li>
            <li><a href="mailto:hello@keepcabin.com" class="text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">Contact</a></li>
          </ul>
        </div>

        <div>
          <p class="text-xs text-[#4b4b4b] uppercase tracking-widest mb-4 font-medium">Company</p>
          <ul class="space-y-3">
            <li><NuxtLink to="/app" class="text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">Get started</NuxtLink></li>
            <li><a href="mailto:hello@keepcabin.com" class="text-sm text-[#7c7c7c] hover:text-white transition-colors duration-150">Enterprise</a></li>
          </ul>
        </div>

      </div>

      <div class="mt-16 pt-8 border-t border-[#232323] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <span class="inline-block size-2 rounded-full bg-[#05df72]"></span>
          <span class="text-xs text-[#7c7c7c]">All systems online</span>
        </div>
        <p class="text-xs text-[#4b4b4b]">© 2026 KeepCabin. All rights reserved.</p>
      </div>

    </div>
  </footer>
</template>
