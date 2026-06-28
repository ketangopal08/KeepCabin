<script setup lang="ts">
import { Camera, Upload, Cloud } from '@lucide/vue'

const emit = defineEmits<{
  'file-selected': [file: File]
  snap: []
  sync: []
}>()

const uploadInput = ref<HTMLInputElement | null>(null)

function onFileSelected(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) emit('file-selected', file)
  ;(e.target as HTMLInputElement).value = ''
}
</script>

<template>
  <div class="flex flex-col items-center justify-center flex-1 py-24 px-6 select-none">
    <!-- Icon -->
    <div class="size-20 rounded-2xl bg-muted/40 border border-border/50 flex items-center justify-center text-4xl mb-6 shadow-inner">
      🗂️
    </div>

    <h2 class="text-base font-semibold text-foreground">No receipts yet</h2>
    <p class="text-sm text-muted-foreground mt-1.5 text-center max-w-xs leading-relaxed">
      Add your first receipt — snap a photo, upload a file, or sync from Google Drive.
    </p>

    <!-- Action cards -->
    <div class="grid grid-cols-3 gap-3 mt-10 w-full max-w-xs">
      <button
        type="button"
        class="flex flex-col items-center gap-3 p-5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-border transition-all group cursor-pointer"
        @click="emit('snap')"
      >
        <div class="size-10 rounded-lg bg-muted/60 flex items-center justify-center group-hover:bg-muted transition-colors">
          <Camera class="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <span class="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight text-center">
          Snap a receipt
        </span>
      </button>

      <button
        type="button"
        class="flex flex-col items-center gap-3 p-5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-border transition-all group cursor-pointer"
        @click="uploadInput?.click()"
      >
        <div class="size-10 rounded-lg bg-muted/60 flex items-center justify-center group-hover:bg-muted transition-colors">
          <Upload class="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <span class="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight text-center">
          Upload a file
        </span>
      </button>

      <button
        type="button"
        class="flex flex-col items-center gap-3 p-5 rounded-xl border border-border/60 bg-card hover:bg-muted/40 hover:border-border transition-all group cursor-pointer"
        @click="emit('sync')"
      >
        <div class="size-10 rounded-lg bg-muted/60 flex items-center justify-center group-hover:bg-muted transition-colors">
          <Cloud class="size-5 text-muted-foreground group-hover:text-foreground transition-colors" />
        </div>
        <span class="text-xs font-medium text-muted-foreground group-hover:text-foreground transition-colors leading-tight text-center">
          Sync from Drive
        </span>
      </button>
    </div>

    <!-- Hidden upload input -->
    <input
      ref="uploadInput"
      type="file"
      accept="image/*,.pdf"
      class="hidden"
      @change="onFileSelected"
    />
  </div>
</template>
