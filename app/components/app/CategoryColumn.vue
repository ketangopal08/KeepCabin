<script setup lang="ts">
import type { Category, Receipt } from '~~/lib/supabase'

const props = defineProps<{
  category: Category | null
  receipts: Receipt[]
}>()

const emit = defineEmits<{ assign: [receiptId: string, categoryId: string | null] }>()

const isDragOver = ref(false)

function onDragOver(e: DragEvent) {
  e.preventDefault()
  isDragOver.value = true
}

function onDrop(e: DragEvent) {
  isDragOver.value = false
  const receiptId = e.dataTransfer?.getData('receiptId')
  if (receiptId) emit('assign', receiptId, props.category?.id ?? null)
}

function onDragStart(e: DragEvent, receiptId: string) {
  e.dataTransfer?.setData('receiptId', receiptId)
}
</script>

<template>
  <div
    class="flex flex-col gap-2 w-52 shrink-0 rounded-xl border bg-muted/20 p-3 transition-colors"
    :class="isDragOver ? 'bg-primary/10 border-primary/30' : ''"
    @dragover="onDragOver"
    @dragleave="isDragOver = false"
    @drop="onDrop"
  >
    <!-- Column header -->
    <div class="flex items-center gap-2 px-1 mb-1">
      <span
        class="size-2.5 rounded-full shrink-0"
        :style="category ? { backgroundColor: category.color } : { backgroundColor: 'hsl(var(--muted-foreground)/0.3)' }"
      />
      <span class="text-sm font-semibold truncate flex-1">{{ category?.name ?? 'Uncategorized' }}</span>
      <Badge variant="outline" class="text-xs ml-auto">{{ receipts.length }}</Badge>
    </div>

    <!-- Receipt cards -->
    <div
      v-for="receipt in receipts"
      :key="receipt.id"
      draggable="true"
      class="rounded-lg border bg-background p-2 cursor-grab active:cursor-grabbing hover:shadow-sm transition-shadow"
      @dragstart="onDragStart($event, receipt.id)"
    >
      <img
        :src="receipt.storage_url"
        :alt="receipt.filename"
        class="w-full h-20 object-cover rounded-md mb-1.5"
      />
      <p class="text-xs font-medium truncate">{{ receipt.filename }}</p>
      <p class="text-xs text-muted-foreground">
        {{ new Date(receipt.created_at).toLocaleDateString() }}
      </p>
    </div>

    <!-- Empty state -->
    <div v-if="receipts.length === 0" class="flex items-center justify-center py-8 text-xs text-muted-foreground">
      Drop receipts here
    </div>
  </div>
</template>
