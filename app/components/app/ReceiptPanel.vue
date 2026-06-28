<script setup lang="ts">
import type { OcrResult } from '~~/lib/ocr'
import { useSupabase, type Receipt, type Category } from '~~/lib/supabase'
import type { CategorySuggestion } from '~~/lib/categorize'

const props = defineProps<{
  receipt:    Receipt | null
  categories: Category[]
}>()

const emit = defineEmits<{ categoryAssigned: [] }>()

const ocrResult  = ref<OcrResult | null>(null)
const loading    = ref(false)
const ocrError   = ref('')
const suggestion = ref<CategorySuggestion | null>(null)

async function runOcrForReceipt(r: Receipt) {
  ocrError.value  = ''
  ocrResult.value = null
  suggestion.value = null

  if (r.ocr_text) {
    const { parseReceiptText } = await import('~~/lib/ocr')
    ocrResult.value = parseReceiptText(r.ocr_text)
    maybeDetect(r.ocr_text, r)
    return
  }

  loading.value = true
  try {
    const { runOcr } = await import('~~/lib/ocr')
    const result = await runOcr(r.storage_url)
    ocrResult.value = result
    const supabase = useSupabase()
    await supabase.from('receipts').update({ ocr_text: result.raw }).eq('id', r.id)
    maybeDetect(result.raw, r)
  } catch {
    ocrError.value = 'OCR failed. Please try again.'
  } finally {
    loading.value = false
  }
}

function maybeDetect(text: string, r: Receipt) {
  if (r.category_id || r.category_suggested) return   // already handled
  import('~~/lib/categorize').then(({ detectCategory }) => {
    suggestion.value = detectCategory(text, props.categories)
  })
}

watch(
  () => props.receipt,
  async (r) => {
    if (!r) { ocrResult.value = null; ocrError.value = ''; suggestion.value = null; return }
    await runOcrForReceipt(r)
  },
  { immediate: true },
)

function copyToClipboard() {
  if (ocrResult.value?.raw) navigator.clipboard.writeText(ocrResult.value.raw)
}

function downloadText() {
  if (!ocrResult.value?.raw) return
  const blob = new Blob([ocrResult.value.raw], { type: 'text/plain' })
  const url  = URL.createObjectURL(blob)
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: `${props.receipt?.filename ?? 'receipt'}.txt`,
  })
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 100)
}

async function onAssign(receiptId: string, categoryId: string) {
  await $fetch(`/api/receipts/${receiptId}/category`, {
    method: 'PATCH',
    body: { categoryId, confirmed: true },
  })
  suggestion.value = null
  emit('categoryAssigned')
}

async function onCreate(receiptId: string, name: string) {
  const { nextCategoryColor } = await import('~~/lib/categorize')
  const cat = await $fetch<Category>('/api/categories', {
    method: 'POST',
    body: { name, color: nextCategoryColor(props.categories) },
  })
  await $fetch(`/api/receipts/${receiptId}/category`, {
    method: 'PATCH',
    body: { categoryId: cat.id, confirmed: true },
  })
  suggestion.value = null
  emit('categoryAssigned')
}

function onDismiss() {
  suggestion.value = null
  emit('categoryAssigned')
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
      <!-- Receipt image -->
      <div
        v-if="receipt?.storage_url"
        class="w-full rounded-lg overflow-hidden bg-muted/30 border border-border/40 flex items-center justify-center"
        style="min-height: 180px; max-height: 260px"
      >
        <img
          :src="receipt.storage_url"
          :alt="receipt.filename"
          class="w-full h-full object-contain"
          style="max-height: 260px"
        />
      </div>

      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-base">🧾 Receipt</h3>
        <div class="flex gap-2">
          <Button variant="ghost" size="sm" @click="copyToClipboard">Copy</Button>
          <Button variant="ghost" size="sm" @click="downloadText">Download</Button>
        </div>
      </div>

      <!-- Category banner -->
      <AppCategoryBanner
        :suggestion="suggestion"
        :categories="categories"
        :receipt-id="receipt!.id"
        @assign="onAssign"
        @create="onCreate"
        @dismiss="onDismiss"
      />

      <div class="space-y-1 text-sm">
        <div v-if="ocrResult.merchant"><span class="font-medium">Merchant:</span> {{ ocrResult.merchant }}</div>
        <div v-if="ocrResult.date"><span class="font-medium">Date:</span> {{ ocrResult.date }}</div>
      </div>

      <div v-if="ocrResult.items.length" class="border-t pt-2 space-y-1 text-sm">
        <div v-for="(item, i) in ocrResult.items" :key="i" class="flex justify-between">
          <span>{{ item.description }}</span>
          <span>{{ item.price ?? '' }}</span>
        </div>
      </div>

      <div v-if="ocrResult.total" class="border-t pt-2 flex justify-between font-semibold text-sm">
        <span>Total</span>
        <span>{{ ocrResult.total }}</span>
      </div>

      <div
        v-if="!ocrResult.merchant && !ocrResult.items.length"
        class="text-xs text-muted-foreground whitespace-pre-wrap border rounded p-2 bg-muted/30"
      >
        {{ ocrResult.raw }}
      </div>
    </template>
  </div>
</template>
