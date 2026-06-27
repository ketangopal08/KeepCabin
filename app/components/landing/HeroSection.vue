<script setup lang="ts">
const receipts = [
  { initials: 'SB', name: 'Starbucks Coffee', category: 'Food & dining', date: 'Jun 25, 2026', amount: '-$9.94', status: 'Processed' },
  { initials: 'UB', name: 'Uber Eats', category: 'Food & dining', date: 'Jun 24, 2026', amount: '-$34.50', status: 'Processed' },
  { initials: 'AM', name: 'Amazon Business', category: 'Office', date: 'Jun 23, 2026', amount: '-$127.00', status: 'Processing' },
  { initials: 'WG', name: 'Wegmans', category: 'Groceries', date: 'Jun 22, 2026', amount: '-$52.33', status: 'Processed' },
  { initials: 'ZM', name: 'Zoom Pro', category: 'Software', date: 'Jun 21, 2026', amount: '-$14.99', status: 'Processed' },
]
</script>

<template>
  <section class="bg-[#0e0e10] border-b border-[#232323] relative overflow-hidden">

    <div class="max-w-[1088px] mx-auto px-6 pt-16 pb-0 text-center">

      <!-- Headline -->
      <h1
        class="text-[52px] md:text-[72px] lg:text-[80px] font-bold leading-[1.05] text-white animate-fade-blur-in-up"
        style="animation-delay: 0ms"
      >
        Your receipts,<br />organized instantly.
      </h1>

      <!-- Subtitle -->
      <p
        class="mt-5 text-base md:text-lg text-[#7c7c7c] max-w-[480px] mx-auto leading-relaxed animate-fade-blur-in-up"
        style="animation-delay: 80ms"
      >
        Sync receipt images from Google Drive, extract text with OCR, and track your expenses — all in one place.
      </p>

      <!-- CTAs -->
      <div
        class="mt-8 flex items-center justify-center gap-3 animate-fade-blur-in-up"
        style="animation-delay: 160ms"
      >
        <NuxtLink
          to="/app"
          class="px-5 py-2.5 bg-white text-[#0e0e10] text-sm font-medium rounded-[10px] hover:opacity-90 transition-opacity duration-150"
        >
          Get Started →
        </NuxtLink>
        <a
          href="#how-it-works"
          class="px-5 py-2.5 border border-[#2c2c2c] text-white text-sm font-medium rounded-[10px] hover:bg-[#141414] transition-colors duration-150"
        >
          See how it works
        </a>
      </div>

      <!-- Product mockup -->
      <div
        class="mt-12 animate-fade-blur-in-up"
        style="animation-delay: 240ms"
      >
        <div class="border border-[#2c2c2c] border-b-0 rounded-t-[10px] bg-[#141414] text-left overflow-hidden shadow-[0_0_0_1px_#2b2b2f]">

          <!-- Browser chrome -->
          <div class="flex items-center gap-2 px-4 py-3 border-b border-[#2c2c2c] bg-[#0e0e10]">
            <div class="flex items-center gap-1.5">
              <div class="size-3 rounded-full bg-[#2c2c2c]" />
              <div class="size-3 rounded-full bg-[#2c2c2c]" />
              <div class="size-3 rounded-full bg-[#2c2c2c]" />
            </div>
            <div class="flex-1 mx-4 bg-[#1a1a1a] border border-[#2c2c2c] rounded-[6px] px-3 py-1 text-xs text-[#4b4b4b] text-center">
              keepcabin.app/receipts
            </div>
          </div>

          <!-- App layout -->
          <div class="flex" style="min-height: 340px">

            <!-- Sidebar -->
            <div class="w-44 border-r border-[#2c2c2c] px-3 py-4 shrink-0 hidden sm:block">
              <p class="text-[10px] text-[#4b4b4b] uppercase tracking-widest mb-3 font-medium">Receipts</p>
              <div class="space-y-0.5">
                <div class="flex items-center gap-2 px-2 py-1.5 rounded-[6px] bg-[#1a1a1a] border border-[#2c2c2c]">
                  <div class="size-1.5 rounded-full bg-white shrink-0" />
                  <span class="text-xs text-white">All receipts</span>
                </div>
                <div class="flex items-center gap-2 px-2 py-1.5 rounded-[6px]">
                  <div class="size-1.5 rounded-full bg-[#4b4b4b] shrink-0" />
                  <span class="text-xs text-[#7c7c7c]">Food & dining</span>
                </div>
                <div class="flex items-center gap-2 px-2 py-1.5 rounded-[6px]">
                  <div class="size-1.5 rounded-full bg-[#4b4b4b] shrink-0" />
                  <span class="text-xs text-[#7c7c7c]">Office</span>
                </div>
                <div class="flex items-center gap-2 px-2 py-1.5 rounded-[6px]">
                  <div class="size-1.5 rounded-full bg-[#4b4b4b] shrink-0" />
                  <span class="text-xs text-[#7c7c7c]">Travel</span>
                </div>
                <div class="flex items-center gap-2 px-2 py-1.5 rounded-[6px]">
                  <div class="size-1.5 rounded-full bg-[#4b4b4b] shrink-0" />
                  <span class="text-xs text-[#7c7c7c]">Software</span>
                </div>
              </div>

              <p class="text-[10px] text-[#4b4b4b] uppercase tracking-widest mt-5 mb-3 font-medium">This month</p>
              <div class="bg-[#1a1a1a] border border-[#2c2c2c] rounded-[6px] p-3">
                <p class="text-[10px] text-[#7c7c7c]">Total spent</p>
                <p class="text-xl font-bold text-white mt-0.5">$1,284</p>
                <p class="text-[10px] text-[#05df72] mt-1">↑ 12 receipts</p>
              </div>
            </div>

            <!-- Main content -->
            <div class="flex-1 p-4 overflow-hidden">
              <div class="flex items-center justify-between mb-4">
                <p class="text-sm font-semibold text-white">All receipts</p>
                <div class="flex items-center gap-2">
                  <div class="px-2.5 py-1 text-xs text-[#7c7c7c] border border-[#2c2c2c] rounded-[6px] bg-[#1a1a1a] cursor-pointer hover:text-white transition-colors">
                    Export CSV
                  </div>
                  <div class="px-2.5 py-1 text-xs text-[#7c7c7c] border border-[#2c2c2c] rounded-[6px] bg-[#1a1a1a] cursor-pointer hover:text-white transition-colors">
                    Filter
                  </div>
                </div>
              </div>

              <!-- Table header -->
              <div class="grid grid-cols-[1fr_auto_auto_auto] gap-3 px-3 pb-2 border-b border-[#2c2c2c]">
                <span class="text-[10px] text-[#4b4b4b] uppercase tracking-wider font-medium">Merchant</span>
                <span class="text-[10px] text-[#4b4b4b] uppercase tracking-wider font-medium hidden md:block">Date</span>
                <span class="text-[10px] text-[#4b4b4b] uppercase tracking-wider font-medium">Amount</span>
                <span class="text-[10px] text-[#4b4b4b] uppercase tracking-wider font-medium">Status</span>
              </div>

              <!-- Receipt rows -->
              <div class="mt-1 space-y-1">
                <div
                  v-for="r in receipts"
                  :key="r.name"
                  class="grid grid-cols-[1fr_auto_auto_auto] gap-3 items-center px-3 py-2.5 rounded-[6px] hover:bg-[#1a1a1a] transition-colors cursor-pointer"
                >
                  <div class="flex items-center gap-2.5 min-w-0">
                    <div class="size-7 rounded-[6px] bg-[#1a1a1a] border border-[#2c2c2c] flex items-center justify-center text-[10px] text-[#7c7c7c] shrink-0 font-bold">
                      {{ r.initials }}
                    </div>
                    <div class="min-w-0">
                      <p class="text-xs text-white font-medium truncate">{{ r.name }}</p>
                      <p class="text-[10px] text-[#4b4b4b]">{{ r.category }}</p>
                    </div>
                  </div>
                  <span class="text-xs text-[#7c7c7c] hidden md:block">{{ r.date }}</span>
                  <span class="text-xs font-medium text-white">{{ r.amount }}</span>
                  <span
                    class="px-1.5 py-0.5 rounded text-[10px] font-medium"
                    :class="r.status === 'Processed' ? 'bg-[#002c22] text-[#05df72]' : 'bg-[#1a1a1a] text-[#7c7c7c] border border-[#2c2c2c]'"
                  >{{ r.status }}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

    </div>
  </section>
</template>
