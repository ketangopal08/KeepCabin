<script setup lang="ts">
import { useSupabase, type Receipt, type Category } from '~~/lib/supabase'
import { Sun, Moon, Search, SlidersHorizontal, LayoutList, LayoutGrid, Upload, Loader2, Camera } from '@lucide/vue'
import { toast } from 'vue-sonner'

definePageMeta({ middleware: 'auth' })

const refreshKey         = ref(0)
const selectedReceipt    = ref<Receipt | null>(null)
const { isDark, toggle } = useTheme()
const searchQuery        = ref('')
const viewMode           = ref<'list' | 'grid'>('list')
const selectedCategoryId = ref<string | null>(null)
const categories         = ref<Category[]>([])
const allReceipts        = ref<Receipt[]>([])
const loadingReceipts    = ref(true)
const uploading          = ref(false)
const uploadError        = ref('')

// Refs for programmatic triggers
const syncButtonsRef   = ref<{ openSync: () => void } | null>(null)
const cameraRef        = ref<{ open: () => void } | null>(null)
const headerFileInput  = ref<HTMLInputElement | null>(null)

const supabase = useSupabase()

async function fetchCategories() {
  const { data } = await supabase.from('categories').select('*').order('created_at')
  categories.value = data ?? []
}

async function fetchAllReceipts() {
  const { data } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
  allReceipts.value = data ?? []
  loadingReceipts.value = false
}

onMounted(() => {
  fetchCategories()
  fetchAllReceipts()
})

async function uploadFile(file: File) {
  uploading.value   = true
  uploadError.value = ''

  // Create a local blob URL so OCR can start immediately from memory
  const localUrl = URL.createObjectURL(file)

  try {
    const body = new FormData()
    body.append('file', file, file.name)
    const receipt = await $fetch<Receipt>('/api/receipts/upload', { method: 'POST', body })

    await fetchAllReceipts()
    refreshKey.value++

    // Start OCR in the background — doesn't block the upload spinner
    autoScan(receipt.id, localUrl)
  } catch (e: any) {
    uploadError.value = e?.data?.message ?? e?.message ?? 'Upload failed'
    URL.revokeObjectURL(localUrl)
  } finally {
    uploading.value = false
  }
}

async function autoScan(receiptId: string, localUrl: string) {
  const tid = toast.loading('Scanning receipt…', { duration: Infinity })
  try {
    const { runOcr } = await import('~~/lib/ocr')
    const result     = await runOcr(localUrl)

    if (result.raw) {
      await supabase.from('receipts').update({ ocr_text: result.raw }).eq('id', receiptId)
      await fetchAllReceipts()
      refreshKey.value++
    }

    toast.success('Receipt scanned!', { id: tid, duration: 3000 })
  } catch {
    toast.error('Scan failed — open the receipt to retry.', { id: tid, duration: 4000 })
  } finally {
    URL.revokeObjectURL(localUrl)
  }
}

function onHeaderFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) uploadFile(file)
  ;(e.target as HTMLInputElement).value = ''
}

function onSynced() {
  refreshKey.value++
  fetchAllReceipts()
}

function onCategoryCreated(cat: Category) {
  categories.value.push(cat)
}

function onSelectCategory(id: string | null) {
  selectedCategoryId.value = id
  refreshKey.value++
}

async function onAssign(receiptId: string, categoryId: string | null) {
  await $fetch(`/api/receipts/${receiptId}/category`, {
    method: 'PATCH',
    body: { categoryId, confirmed: true },
  })
  fetchAllReceipts()
}

function onCategoryAssigned() {
  refreshKey.value++
  fetchAllReceipts()
}

const gridColumns = computed(() => {
  const uncategorized  = allReceipts.value.filter(r => !r.category_id)
  const categoryColumns = categories.value.map(cat => ({
    category: cat,
    receipts: allReceipts.value.filter(r => r.category_id === cat.id),
  }))
  return [{ category: null as Category | null, receipts: uncategorized }, ...categoryColumns]
})

const isEmpty = computed(() => !loadingReceipts.value && allReceipts.value.length === 0)
</script>

<template>
  <SidebarProvider>
    <Sonner :theme="isDark ? 'dark' : 'light'" position="bottom-right" rich-colors />
    <AppSidebar
      :categories="categories"
      @select-category="onSelectCategory"
      @category-created="onCategoryCreated"
      @receipt-assigned="onCategoryAssigned"
    />

    <div class="flex flex-1 flex-col min-h-screen overflow-hidden bg-background">
      <!-- Header -->
      <header class="shrink-0 border-b border-border/60 px-5 py-3 flex items-center gap-3 bg-background">
        <SidebarTrigger class="text-muted-foreground hover:text-foreground" />

        <div class="w-px h-5 bg-border/60 shrink-0" />

        <div class="relative flex-1 max-w-sm">
          <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
          <Input
            v-model="searchQuery"
            placeholder="Search receipts…"
            class="pl-8 h-8 text-sm bg-muted/30 border-border/40 focus:border-border focus:bg-muted/50 rounded-lg"
          />
        </div>

        <div class="flex items-center gap-1.5 ml-auto">
          <AppSyncButtons ref="syncButtonsRef" @synced="onSynced" />

          <div class="w-px h-5 bg-border/60 shrink-0 mx-1" />

          <!-- Camera button -->
          <button
            class="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            aria-label="Snap receipt"
            @click="cameraRef?.open()"
          >
            <Camera class="size-3.5" />
          </button>

          <!-- Upload button -->
          <button
            class="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-40"
            :disabled="uploading"
            aria-label="Upload receipt"
            @click="headerFileInput?.click()"
          >
            <Loader2 v-if="uploading" class="size-3.5 animate-spin" />
            <Upload v-else class="size-3.5" />
          </button>
          <input
            ref="headerFileInput"
            type="file"
            accept="image/*,.pdf"
            class="hidden"
            @change="onHeaderFileChange"
          />

          <Button variant="ghost" size="sm" class="h-8 gap-1.5 text-muted-foreground hover:text-foreground font-normal text-sm">
            <SlidersHorizontal class="size-3.5" />
            Filter
          </Button>

          <div class="flex items-center rounded-lg border border-border/60 overflow-hidden divide-x divide-border/60 bg-muted/20">
            <button
              class="size-8 flex items-center justify-center transition-colors"
              :class="viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'"
              aria-label="List view"
              @click="viewMode = 'list'"
            >
              <LayoutList class="size-3.5" />
            </button>
            <button
              class="size-8 flex items-center justify-center transition-colors"
              :class="viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'"
              aria-label="Grid view"
              @click="viewMode = 'grid'"
            >
              <LayoutGrid class="size-3.5" />
            </button>
          </div>

          <div class="w-px h-5 bg-border/60 shrink-0 mx-1" />

          <button
            class="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            :aria-label="isDark ? 'Switch to light' : 'Switch to dark'"
            @click="toggle"
          >
            <Sun v-if="isDark" class="size-3.5" />
            <Moon v-else class="size-3.5" />
          </button>
        </div>
      </header>

      <!-- Page title bar -->
      <div class="shrink-0 px-5 py-3 flex items-center gap-3 border-b border-border/40">
        <div>
          <h1 class="text-sm font-semibold text-foreground leading-none">
            {{ selectedCategoryId ? (categories.find(c => c.id === selectedCategoryId)?.name ?? 'All Receipts') : 'All Receipts' }}
          </h1>
          <p class="text-xs text-muted-foreground mt-0.5">
            {{ allReceipts.length }} receipt{{ allReceipts.length === 1 ? '' : 's' }}
          </p>
        </div>
      </div>

      <!-- Upload error banner -->
      <div
        v-if="uploadError"
        class="shrink-0 flex items-center gap-3 px-5 py-2.5 bg-destructive/10 border-b border-destructive/20 text-sm text-destructive"
      >
        <span class="flex-1">{{ uploadError }}</span>
        <button class="shrink-0 underline underline-offset-2 text-xs hover:opacity-70" @click="uploadError = ''">Dismiss</button>
      </div>

      <!-- Camera dialog (always mounted, opened via ref) -->
      <AppCameraCapture ref="cameraRef" @file-selected="uploadFile" />

      <!-- Empty state -->
      <AppEmptyState
        v-if="isEmpty"
        @file-selected="uploadFile"
        @snap="cameraRef?.open()"
        @sync="syncButtonsRef?.openSync()"
      />

      <!-- List view -->
      <main v-else-if="viewMode === 'list'" class="flex flex-1 overflow-hidden">
        <AppReceiptsTable
          :key="refreshKey"
          :category-id="selectedCategoryId"
          :categories="categories"
          class="flex-1 overflow-auto"
          @select="selectedReceipt = $event"
        />
        <template v-if="selectedReceipt">
          <div class="w-px bg-border/60 shrink-0" />
          <AppReceiptPanel
            :receipt="selectedReceipt"
            :categories="categories"
            class="w-80 shrink-0 overflow-auto"
            @category-assigned="onCategoryAssigned"
          />
        </template>
      </main>

      <!-- Grid view -->
      <main v-else class="flex flex-1 overflow-x-auto gap-3 p-5">
        <AppCategoryColumn
          v-for="col in gridColumns"
          :key="col.category?.id ?? 'uncategorized'"
          :category="col.category"
          :receipts="col.receipts"
          @assign="onAssign"
        />
      </main>
    </div>
  </SidebarProvider>
</template>
