<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import { useSupabase, type Receipt, type Category } from '~~/lib/supabase'

const props = defineProps<{ categoryId?: string | null; categories?: Category[] }>()
const emit  = defineEmits<{ select: [receipt: Receipt] }>()

const supabase        = useSupabase()
const receipts        = ref<Receipt[]>([])
const loadingReceipts = ref(true)
const fetchErrorMsg   = ref('')

async function fetchReceipts() {
  loadingReceipts.value = true
  fetchErrorMsg.value   = ''
  let query = supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
  if (props.categoryId) {
    query = query.eq('category_id', props.categoryId)
  }
  const { data, error: fetchError } = await query
  if (fetchError) fetchErrorMsg.value = fetchError.message
  receipts.value        = data ?? []
  loadingReceipts.value = false
}

onMounted(fetchReceipts)
watch(() => props.categoryId, fetchReceipts)
defineExpose({ fetchReceipts })

function onDragStart(e: DragEvent, receiptId: string) {
  e.dataTransfer?.setData('receiptId', receiptId)
}

function shortName(filename: string) {
  // If it looks like a storage path (very long, no spaces), just show extension + truncate
  if (filename.length > 60 && !filename.includes(' ')) {
    const ext = filename.split('.').pop() ?? ''
    return `receipt.${ext}`
  }
  return filename
}

function categoryForReceipt(receipt: Receipt) {
  return props.categories?.find(c => c.id === receipt.category_id) ?? null
}
</script>

<template>
  <div class="overflow-auto">
    <table class="w-full text-sm">
      <thead>
        <tr class="border-b border-border/40">
          <th class="text-left font-medium text-muted-foreground px-4 py-2.5 w-72">Receipt</th>
          <th class="text-left font-medium text-muted-foreground px-4 py-2.5 w-32">Added</th>
          <th class="text-left font-medium text-muted-foreground px-4 py-2.5 w-36">Category</th>
          <th class="text-left font-medium text-muted-foreground px-4 py-2.5 w-24">OCR</th>
        </tr>
      </thead>
      <tbody>
        <tr v-if="loadingReceipts">
          <td colspan="4" class="text-center text-muted-foreground py-12 px-4">Loading…</td>
        </tr>
        <tr v-else-if="fetchErrorMsg">
          <td colspan="4" class="text-center text-destructive py-12 px-4">{{ fetchErrorMsg }}</td>
        </tr>
        <tr v-else-if="receipts.length === 0">
          <td colspan="4" class="text-center text-muted-foreground py-12 px-4">No receipts in this category.</td>
        </tr>

        <tr
          v-for="receipt in receipts"
          :key="receipt.id"
          draggable="true"
          class="border-b border-border/30 hover:bg-muted/25 cursor-pointer transition-colors group"
          @click="emit('select', receipt)"
          @dragstart="onDragStart($event, receipt.id)"
        >
          <!-- Image + name -->
          <td class="px-4 py-2.5">
            <div class="flex items-center gap-3 min-w-0">
              <div class="w-11 h-11 rounded-md overflow-hidden bg-muted/40 border border-border/40 shrink-0">
                <img
                  :src="receipt.storage_url"
                  :alt="receipt.filename"
                  class="w-full h-full object-cover"
                />
              </div>
              <span class="truncate text-foreground font-medium max-w-[200px]" :title="receipt.filename">
                {{ shortName(receipt.filename) }}
              </span>
            </div>
          </td>

          <!-- Date -->
          <td class="px-4 py-2.5 text-muted-foreground tabular-nums whitespace-nowrap">
            {{ new Date(receipt.created_at).toLocaleDateString() }}
          </td>

          <!-- Category -->
          <td class="px-4 py-2.5">
            <span
              v-if="categoryForReceipt(receipt)"
              class="inline-flex items-center gap-1.5 text-xs font-medium px-2 py-0.5 rounded-full border"
              :style="{
                backgroundColor: categoryForReceipt(receipt)?.color + '22',
                borderColor: categoryForReceipt(receipt)?.color + '55',
                color: categoryForReceipt(receipt)?.color,
              }"
            >
              <span class="size-1.5 rounded-full shrink-0" :style="{ backgroundColor: categoryForReceipt(receipt)?.color }" />
              {{ categoryForReceipt(receipt)?.name }}
            </span>
            <span v-else-if="receipt.category_suggested" class="text-xs text-primary/70">Suggested</span>
            <span v-else class="text-xs text-muted-foreground/40">—</span>
          </td>

          <!-- OCR status -->
          <td class="px-4 py-2.5">
            <span
              class="text-xs px-2 py-0.5 rounded-full font-medium"
              :class="receipt.ocr_text
                ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                : 'bg-muted/40 text-muted-foreground border border-border/40'"
            >
              {{ receipt.ocr_text ? 'Done' : 'Pending' }}
            </span>
          </td>
        </tr>
      </tbody>
    </table>
  </div>
</template>
