<script setup lang="ts">
import type { OcrResult } from '~~/lib/ocr'
import { useSupabase, type Receipt, type Category } from '~~/lib/supabase'
import type { CategorySuggestion } from '~~/lib/categorize'

const props = defineProps<{
  receipt:    Receipt | null
  categories: Category[]
}>()

const emit = defineEmits<{ categoryAssigned: [] }>()

const ocrResult   = ref<OcrResult | null>(null)
const loading     = ref(false)
const ocrError    = ref('')
const suggestion  = ref<CategorySuggestion | null>(null)
const lightboxOpen = ref(false)
const scanned      = ref(false) // toggle scanned document look

async function runOcrForReceipt(r: Receipt, force = false) {
  ocrError.value  = ''
  ocrResult.value = null
  suggestion.value = null

  if (r.ocr_text && !force) {
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

function rescan() {
  if (props.receipt) runOcrForReceipt(props.receipt, true)
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

function onKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape') lightboxOpen.value = false
}

onMounted(() => window.addEventListener('keydown', onKeyDown))
onUnmounted(() => window.removeEventListener('keydown', onKeyDown))

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
      <Button variant="outline" size="sm" @click="rescan">Re-scan</Button>
    </div>

    <!-- Result -->
    <template v-else-if="ocrResult">
      <!-- Receipt image thumbnail (click to open scanned viewer) -->
      <div
        v-if="receipt?.storage_url"
        class="w-full rounded-lg overflow-hidden bg-muted/30 border border-border/40 flex items-center justify-center cursor-zoom-in group relative"
        style="min-height: 180px; max-height: 260px"
        @click="lightboxOpen = true"
      >
        <img
          :src="receipt.storage_url"
          :alt="receipt.filename"
          class="w-full h-full object-contain transition-opacity group-hover:opacity-80"
          style="max-height: 260px"
        />
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <span class="bg-black/60 text-white text-xs px-3 py-1.5 rounded-full font-medium">View scan</span>
        </div>
      </div>

      <!-- Fullscreen scanned document viewer -->
      <Teleport to="body">
        <div
          v-if="lightboxOpen"
          class="fixed inset-0 z-50 flex flex-col bg-neutral-900/95 backdrop-blur-sm"
          @click.self="lightboxOpen = false"
        >
          <!-- Toolbar -->
          <div class="shrink-0 flex items-center justify-between px-5 py-3 border-b border-white/10">
            <span class="text-white/70 text-sm font-medium truncate max-w-xs">{{ receipt?.filename }}</span>
            <div class="flex items-center gap-2">
              <!-- Scanned/Original toggle -->
              <button
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors"
                :class="scanned ? 'bg-white text-gray-900' : 'bg-white/10 text-white/70 hover:bg-white/20'"
                @click="scanned = !scanned"
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 9h18M9 21V9"/>
                </svg>
                {{ scanned ? 'Scanned' : 'Original' }}
              </button>
              <button
                class="size-8 flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors"
                @click="lightboxOpen = false"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- Image area -->
          <div class="flex-1 overflow-auto flex items-center justify-center p-6">
            <img
              :src="receipt?.storage_url"
              :alt="receipt?.filename"
              class="max-w-full max-h-full rounded shadow-2xl transition-all duration-300 select-none"
              :style="scanned
                ? 'filter: grayscale(1) contrast(1.6) brightness(1.15); background:#fff; box-shadow:0 0 0 1px rgba(255,255,255,0.08), 0 25px 60px rgba(0,0,0,0.7)'
                : 'box-shadow:0 25px 60px rgba(0,0,0,0.7)'"
              draggable="false"
            />
          </div>

          <!-- Footer hint -->
          <div class="shrink-0 flex items-center justify-center pb-4">
            <span class="text-white/30 text-xs">Press Esc or click outside to close</span>
          </div>
        </div>
      </Teleport>

      <div class="flex items-center justify-between">
        <h3 class="font-semibold text-base">🧾 Receipt</h3>
        <div class="flex gap-2">
          <Button variant="ghost" size="sm" :disabled="loading" @click="rescan">
            <svg v-if="loading" class="animate-spin mr-1" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
            Re-scan
          </Button>
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
