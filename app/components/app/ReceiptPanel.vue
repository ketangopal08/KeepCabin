<script setup lang="ts">
import type { OcrResult } from '~~/lib/ocr'
import { useSupabase, type Receipt } from '~~/lib/supabase'

const props = defineProps<{ receipt: Receipt | null }>()

const ocrResult = ref<OcrResult | null>(null)
const loading = ref(false)
const ocrError = ref('')

async function runOcrForReceipt(r: Receipt) {
  ocrError.value = ''
  ocrResult.value = null

  if (r.ocr_text) {
    const { parseReceiptText } = await import('~~/lib/ocr')
    ocrResult.value = parseReceiptText(r.ocr_text)
    return
  }

  loading.value = true
  try {
    const { runOcr } = await import('~~/lib/ocr')
    const result = await runOcr(r.storage_url)
    ocrResult.value = result
    const supabase = useSupabase()
    await supabase.from('receipts').update({ ocr_text: result.raw }).eq('id', r.id)
  } catch {
    ocrError.value = 'OCR failed. Please try again.'
  } finally {
    loading.value = false
  }
}

watch(
  () => props.receipt,
  async (r) => {
    if (!r) {
      ocrResult.value = null
      ocrError.value = ''
      return
    }
    await runOcrForReceipt(r)
  },
  { immediate: true }
)

function copyToClipboard() {
  if (ocrResult.value?.raw) {
    navigator.clipboard.writeText(ocrResult.value.raw)
  }
}

function downloadText() {
  if (!ocrResult.value?.raw) return
  const blob = new Blob([ocrResult.value.raw], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${props.receipt?.filename ?? 'receipt'}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}
</script>

<template>
  <div class="border rounded-md p-4 flex flex-col gap-4 bg-background overflow-auto">
    <!-- Empty state -->
    <div v-if="!receipt" class="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Select an image to view receipt
    </div>

    <!-- Loading -->
    <div v-else-if="loading" class="flex-1 flex items-center justify-center text-muted-foreground text-sm">
      Running OCR…
    </div>

    <!-- Error -->
    <div v-else-if="ocrError" class="flex-1 flex flex-col items-center justify-center gap-2">
      <p class="text-destructive text-sm">{{ ocrError }}</p>
      <Button variant="outline" size="sm" @click="runOcrForReceipt(receipt!)">Retry</Button>
    </div>

    <!-- Result -->
    <template v-else-if="ocrResult">
      <!-- Header row -->
      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-base">🧾 Receipt</h3>
        <div class="flex gap-2">
          <Button variant="ghost" size="sm" @click="copyToClipboard">Copy</Button>
          <Button variant="ghost" size="sm" @click="downloadText">Download</Button>
        </div>
      </div>

      <!-- Merchant / Date -->
      <div class="space-y-1 text-sm">
        <div v-if="ocrResult.merchant"><span class="font-medium">Merchant:</span> {{ ocrResult.merchant }}</div>
        <div v-if="ocrResult.date"><span class="font-medium">Date:</span> {{ ocrResult.date }}</div>
      </div>

      <!-- Line items -->
      <div v-if="ocrResult.items.length" class="border-t pt-2 space-y-1 text-sm">
        <div v-for="(item, i) in ocrResult.items" :key="i" class="flex justify-between">
          <span>{{ item.description }}</span>
          <span>{{ item.price ?? '' }}</span>
        </div>
      </div>

      <!-- Total -->
      <div v-if="ocrResult.total" class="border-t pt-2 flex justify-between font-semibold text-sm">
        <span>Total</span>
        <span>{{ ocrResult.total }}</span>
      </div>

      <!-- Fallback raw text if no structured data -->
      <div
        v-if="!ocrResult.merchant && !ocrResult.items.length"
        class="text-xs text-muted-foreground whitespace-pre-wrap border rounded p-2 bg-muted/30"
      >
        {{ ocrResult.raw }}
      </div>
    </template>
  </div>
</template>
