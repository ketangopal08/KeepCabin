<template>
  <section class="bg-[#0e0e10] border-b border-[#232323] py-12 px-6 overflow-hidden">
    <div class="max-w-[1088px] mx-auto mb-8">
      <p class="text-xs text-[#4b4b4b] tracking-widest uppercase text-center">Works with the tools you already use</p>
    </div>

    <div class="relative">
      <div class="flex gap-12 animate-marquee" style="width: max-content">
        <template v-for="_ in 2" :key="_">
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Google Drive</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Tesseract OCR</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Dropbox</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">QuickBooks</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Stripe</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Notion</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Zapier</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Airtable</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Google Sheets</span>
          <span class="text-sm font-semibold text-[#4b4b4b] whitespace-nowrap shrink-0">Xero</span>
        </template>
      </div>
    </div>
  </section>
</template>
