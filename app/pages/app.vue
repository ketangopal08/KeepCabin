<script setup lang="ts">
import { useSupabase, type Receipt, type Category } from '~~/lib/supabase'
import { Sun, Moon, Search, SlidersHorizontal, LayoutList, LayoutGrid } from '@lucide/vue'

const refreshKey        = ref(0)
const selectedReceipt   = ref<Receipt | null>(null)
const { isDark, toggle } = useTheme()
const searchQuery       = ref('')
const viewMode          = ref<'list' | 'grid'>('list')
const selectedCategoryId = ref<string | null>(null)
const categories        = ref<Category[]>([])
const allReceipts       = ref<Receipt[]>([])

async function fetchCategories() {
  const supabase = useSupabase()
  const { data } = await supabase.from('categories').select('*').order('created_at')
  categories.value = data ?? []
}

async function fetchAllReceipts() {
  const supabase = useSupabase()
  const { data } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
  allReceipts.value = data ?? []
}

onMounted(() => {
  fetchCategories()
  fetchAllReceipts()
})

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
  const uncategorized = allReceipts.value.filter(r => !r.category_id)
  const categoryColumns = categories.value.map(cat => ({
    category: cat,
    receipts: allReceipts.value.filter(r => r.category_id === cat.id),
  }))
  return [{ category: null as Category | null, receipts: uncategorized }, ...categoryColumns]
})
</script>

<template>
  <SidebarProvider>
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
          <AppSyncButtons @synced="onSynced" />

          <div class="w-px h-5 bg-border/60 shrink-0 mx-1" />

          <Button variant="ghost" size="sm" class="h-8 gap-1.5 text-muted-foreground hover:text-foreground font-normal text-sm">
            <SlidersHorizontal class="size-3.5" />
            Filter
          </Button>

          <div class="flex items-center rounded-lg border border-border/60 overflow-hidden divide-x divide-border/60 bg-muted/20">
            <button
              class="size-8 flex items-center justify-center transition-colors"
              :class="viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="viewMode = 'list'"
              aria-label="List view"
            >
              <LayoutList class="size-3.5" />
            </button>
            <button
              class="size-8 flex items-center justify-center transition-colors"
              :class="viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'"
              @click="viewMode = 'grid'"
              aria-label="Grid view"
            >
              <LayoutGrid class="size-3.5" />
            </button>
          </div>

          <div class="w-px h-5 bg-border/60 shrink-0 mx-1" />

          <button
            class="size-8 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            @click="toggle"
            :aria-label="isDark ? 'Switch to light' : 'Switch to dark'"
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

      <!-- List view -->
      <main v-if="viewMode === 'list'" class="flex flex-1 overflow-hidden">
        <AppReceiptsTable
          :key="refreshKey"
          :category-id="selectedCategoryId"
          class="flex-1 overflow-auto"
          @select="selectedReceipt = $event"
        />
        <div class="w-px bg-border/60 shrink-0" />
        <AppReceiptPanel
          :receipt="selectedReceipt"
          :categories="categories"
          class="w-80 shrink-0 overflow-auto"
          @category-assigned="onCategoryAssigned"
        />
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
