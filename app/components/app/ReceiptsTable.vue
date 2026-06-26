<script setup lang="ts">
import { useSupabase, type Receipt } from '~~/lib/supabase'

const emit = defineEmits<{ select: [receipt: Receipt] }>()
const supabase = useSupabase()
const receipts = ref<Receipt[]>([])
const loadingReceipts = ref(true)
const fetchErrorMsg = ref('')

async function fetchReceipts() {
  loadingReceipts.value = true
  fetchErrorMsg.value = ''
  const { data, error: fetchError } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
  if (fetchError) {
    console.error('Failed to fetch receipts:', fetchError.message)
    fetchErrorMsg.value = fetchError?.message ?? ''
  }
  receipts.value = data ?? []
  loadingReceipts.value = false
}

onMounted(fetchReceipts)
defineExpose({ fetchReceipts })
</script>

<template>
  <div class="overflow-auto rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-16">Image</TableHead>
          <TableHead>Filename</TableHead>
          <TableHead>Added</TableHead>
          <TableHead>OCR</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="loadingReceipts">
          <TableCell colspan="4" class="text-center text-muted-foreground py-8">
            Loading…
          </TableCell>
        </TableRow>
        <TableRow v-else-if="fetchErrorMsg">
          <TableCell colspan="4" class="text-center text-destructive py-8">
            Failed to load receipts: {{ fetchErrorMsg }}
          </TableCell>
        </TableRow>
        <TableRow v-else-if="receipts.length === 0">
          <TableCell colspan="4" class="text-center text-muted-foreground py-8">
            No receipts yet. Click Sync to get started.
          </TableCell>
        </TableRow>
        <TableRow
          v-for="receipt in receipts"
          :key="receipt.id"
          class="cursor-pointer hover:bg-muted/50"
          @click="emit('select', receipt)"
        >
          <TableCell>
            <img
              :src="receipt.storage_url"
              :alt="receipt.filename"
              class="w-12 h-12 object-cover rounded"
            />
          </TableCell>
          <TableCell class="font-medium">{{ receipt.filename }}</TableCell>
          <TableCell class="text-muted-foreground text-sm">
            {{ new Date(receipt.created_at).toLocaleDateString() }}
          </TableCell>
          <TableCell>
            <Badge :variant="receipt.ocr_text ? 'default' : 'outline'">
              {{ receipt.ocr_text ? 'Done' : 'Pending' }}
            </Badge>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </div>
</template>
