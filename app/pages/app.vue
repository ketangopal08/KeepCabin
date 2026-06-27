<script setup lang="ts">
import { useSupabase, type Receipt, type Category } from '~~/lib/supabase'
import { Sun, Moon, Search, SlidersHorizontal, LayoutList, LayoutGrid, ChevronLeft } from '@lucide/vue'

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
      <header class="shrink-0 px-6 pt-5 pb-4 flex flex-col gap-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-1.5 text-sm">
            <SidebarTrigger class="mr-1" />
            <NuxtLink
              to="/"
              class="flex items-center gap-1 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft class="size-3.5" />
              Home
            </NuxtLink>
            <span class="text-muted-foreground select-none">/</span>
            <span class="font-semibold text-foreground">All Receipts</span>
          </div>
          <Button variant="ghost" size="icon" @click="toggle" aria-label="Toggle theme">
            <Sun v-if="isDark" class="size-4" />
            <Moon v-else class="size-4" />
          </Button>
        </div>

        <div class="flex items-center gap-3">
          <div class="relative flex-1 max-w-md">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <Input
              v-model="searchQuery"
              placeholder="Search a receipt…"
              class="pl-9 bg-muted/40 border-transparent focus:border-border focus:bg-background"
            />
          </div>
          <AppSyncButtons @synced="onSynced" />
          <Separator orientation="vertical" class="h-6" />
          <Button variant="outline" size="sm" class="gap-2 font-normal">
            <SlidersHorizontal class="size-4" />
            Filters
          </Button>
          <div class="flex items-center rounded-lg border overflow-hidden divide-x">
            <Button
              variant="ghost"
              size="icon"
              class="rounded-none size-8"
              :class="viewMode === 'list' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
              @click="viewMode = 'list'"
              aria-label="List view"
            >
              <LayoutList class="size-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              class="rounded-none size-8"
              :class="viewMode === 'grid' ? 'bg-muted text-foreground' : 'text-muted-foreground'"
              @click="viewMode = 'grid'"
              aria-label="Grid view"
            >
              <LayoutGrid class="size-4" />
            </Button>
          </div>
        </div>
      </header>

      <!-- List view -->
      <main v-if="viewMode === 'list'" class="flex flex-1 overflow-hidden gap-4 px-6 pb-6">
        <AppReceiptsTable
          :key="refreshKey"
          :category-id="selectedCategoryId"
          class="flex-1 overflow-auto"
          @select="selectedReceipt = $event"
        />
        <AppReceiptPanel
          :receipt="selectedReceipt"
          :categories="categories"
          class="w-80 shrink-0"
          @category-assigned="onCategoryAssigned"
        />
      </main>

      <!-- Grid view -->
      <main v-else class="flex flex-1 overflow-x-auto gap-4 px-6 pb-6">
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
