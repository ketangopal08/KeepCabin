# Receipt Categories Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a category system so receipts are auto-classified after OCR, filterable by sidebar, and reassignable via drag & drop in table and grid views.

**Architecture:** Categories live in a new Supabase `categories` table; `receipts` gains `category_id` (FK) and `category_suggested` (bool). Client-side keyword matching in `lib/categorize.ts` suggests a category after OCR; the user confirms/rejects via `CategoryBanner`. Drag & drop uses the native HTML5 drag API — receipt rows/cards set `dataTransfer`, sidebar items and grid columns are drop targets that call `PATCH /api/receipts/[id]/category`.

**Tech Stack:** Nuxt 4, shadcn-vue (auto-imported without prefix), Supabase JS v2, TypeScript, native HTML5 drag API.

## Global Constraints

- Nuxt 4 — components in `app/components/ui/` auto-imported without prefix (`<Button>`, `<Badge>` etc.). App components in `app/components/app/` auto-imported with `App` prefix (`<AppSidebar>`). Composables in `app/composables/` auto-imported by name.
- All `lib/` files live at **project root** (`lib/categorize.ts`, not `app/lib/`). Import them with `~~/lib/…` in Vue files and server routes.
- Vue auto-imports (`ref`, `computed`, `watch`, `onMounted`, `nextTick`, `defineProps`, `defineEmits`, `defineExpose`) require **no explicit import** in `<script setup>`.
- Server routes use Nitro auto-imports (`defineEventHandler`, `readBody`, `createError`, `useRuntimeConfig`, `getRouterParam`, `setResponseStatus`) — no imports needed. Only `createClient` from `@supabase/supabase-js` must be imported explicitly.
- Verification for every task: run `npm run dev -- --port 3001` and confirm in browser at `http://localhost:3001`.
- Supabase credentials come from `.env` (`SUPABASE_URL`, `SUPABASE_ANON_KEY`). Run the SQL from `lib/supabase.sql` in the Supabase dashboard before testing any task.
- `CATEGORY_COLORS` array (8 hex strings, defined in `lib/categorize.ts`): `['#6366f1','#f59e0b','#10b981','#ef4444','#3b82f6','#8b5cf6','#f97316','#14b8a6']`.

---

### Task 1: Data model + types

**Files:**
- Modify: `lib/supabase.ts`
- Modify: `lib/supabase.sql`

**Interfaces:**
- Produces: `Category` type, updated `Receipt` type (both used by every subsequent task)

- [ ] **Step 1: Update `lib/supabase.ts`**

Replace the entire file:

```ts
import { createClient } from '@supabase/supabase-js'

export type Category = {
  id: string
  name: string
  color: string
  created_at: string
}

export type Receipt = {
  id: string
  filename: string
  drive_file_id: string | null
  storage_url: string
  ocr_text: string | null
  category_id: string | null
  category_suggested: boolean
  created_at: string
}

export function useSupabase() {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
}
```

- [ ] **Step 2: Append migration SQL to `lib/supabase.sql`**

Add at the bottom of the existing file:

```sql
-- Category system migration (run after initial schema)
create table categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null,
  created_at timestamptz default now()
);

alter table categories enable row level security;
create policy "public read"   on categories for select using (true);
create policy "public insert" on categories for insert with check (true);
create policy "public update" on categories for update using (true);
create policy "public delete" on categories for delete using (true);

alter table receipts
  add column category_id        uuid references categories(id) on delete set null,
  add column category_suggested boolean not null default false;
```

- [ ] **Step 3: Run migration in Supabase dashboard**

Go to Supabase → SQL Editor → paste the migration SQL above → Run.
Expected: no errors; `categories` table appears in Table Editor; `receipts` has two new columns.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 5: Commit**

```bash
git add lib/supabase.ts lib/supabase.sql
git commit -m "feat(categories): add Category type and DB migration"
```

---

### Task 2: Categorization library

**Files:**
- Create: `lib/categorize.ts`

**Interfaces:**
- Consumes: `Category` from `lib/supabase.ts`
- Produces:
  - `CategorySuggestion` type
  - `CATEGORY_COLORS: string[]`
  - `detectCategory(ocrText: string, existingCategories: Category[]): CategorySuggestion`
  - `nextCategoryColor(existingCategories: Category[]): string`

- [ ] **Step 1: Create `lib/categorize.ts`**

```ts
import type { Category } from './supabase'

export type CategorySuggestion =
  | { kind: 'existing'; name: string }
  | { kind: 'new';      name: string }
  | { kind: 'none' }

export const CATEGORY_COLORS = [
  '#6366f1',
  '#f59e0b',
  '#10b981',
  '#ef4444',
  '#3b82f6',
  '#8b5cf6',
  '#f97316',
  '#14b8a6',
]

const KEYWORD_MAP: Record<string, string[]> = {
  'Food & dining': ['restaurant', 'cafe', 'mcdonald', 'pizza', 'food', 'dining', 'bakery', 'sushi', 'bar', 'grill', 'burger', 'coffee', 'starbucks'],
  'Software':      ['amazon', 'microsoft', 'adobe', 'license', 'subscription', 'software', 'saas', 'app store', 'google play'],
  'Travel':        ['hotel', 'flight', 'airline', 'uber', 'taxi', 'airbnb', 'travel', 'airport', 'booking', 'lyft'],
  'Office':        ['staples', 'office', 'printer', 'supplies', 'fedex', 'ups', 'courier', 'postage', 'depot'],
  'Health':        ['pharmacy', 'clinic', 'hospital', 'dentist', 'medical', 'health', 'cvs', 'walgreens'],
}

export function detectCategory(
  ocrText: string,
  existingCategories: Category[],
): CategorySuggestion {
  if (!ocrText || ocrText.trim().length < 3) return { kind: 'none' }

  const lower = ocrText.toLowerCase()

  for (const [categoryName, keywords] of Object.entries(KEYWORD_MAP)) {
    if (keywords.some(kw => lower.includes(kw))) {
      const exists = existingCategories.some(c => c.name === categoryName)
      return { kind: exists ? 'existing' : 'new', name: categoryName }
    }
  }

  // No keyword match — propose the merchant name (first non-empty line ≥ 3 chars)
  const firstLine = ocrText
    .split('\n')
    .map(l => l.trim())
    .find(l => l.length >= 3)

  if (firstLine) {
    return { kind: 'new', name: firstLine.slice(0, 50) }
  }

  return { kind: 'none' }
}

export function nextCategoryColor(existingCategories: Category[]): string {
  const usedColors = new Set(existingCategories.map(c => c.color))
  return CATEGORY_COLORS.find(c => !usedColors.has(c)) ?? CATEGORY_COLORS[0]!
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 3: Commit**

```bash
git add lib/categorize.ts
git commit -m "feat(categories): add detectCategory + CATEGORY_COLORS"
```

---

### Task 3: Server API routes

**Files:**
- Create: `server/api/categories.post.ts`
- Create: `server/api/categories/[id].delete.ts`
- Create: `server/api/receipts/[id]/category.patch.ts`

**Interfaces:**
- Consumes: `Category`, `Receipt` types from `lib/supabase.ts`
- Produces:
  - `POST /api/categories` → `Category`
  - `DELETE /api/categories/:id` → 204
  - `PATCH /api/receipts/:id/category` → `Receipt`

- [ ] **Step 1: Create `server/api/categories.post.ts`**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Category } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ name: string; color: string }>(event)
  const config = useRuntimeConfig()

  if (!body?.name || body.name.trim().length === 0 || body.name.length > 50) {
    throw createError({ statusCode: 400, message: 'name must be 1–50 characters' })
  }
  if (!body?.color || !/^#[0-9a-fA-F]{6}$/.test(body.color)) {
    throw createError({ statusCode: 400, message: 'color must be a valid hex color (#rrggbb)' })
  }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { data, error } = await supabase
    .from('categories')
    .insert({ name: body.name.trim(), color: body.color })
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data as Category
})
```

- [ ] **Step 2: Create `server/api/categories/[id].delete.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const config = useRuntimeConfig()

  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { error } = await supabase.from('categories').delete().eq('id', id)

  if (error) throw createError({ statusCode: 500, message: error.message })
  setResponseStatus(event, 204)
  return null
})
```

- [ ] **Step 3: Create `server/api/receipts/[id]/category.patch.ts`**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Receipt } from '~~/lib/supabase'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  const body = await readBody<{ categoryId: string | null; confirmed: boolean }>(event)
  const config = useRuntimeConfig()

  if (!id) throw createError({ statusCode: 400, message: 'id is required' })

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const { data, error } = await supabase
    .from('receipts')
    .update({
      category_id: body.categoryId ?? null,
      category_suggested: !body.confirmed,
    })
    .eq('id', id)
    .select()
    .single()

  if (error) throw createError({ statusCode: 500, message: error.message })
  return data as Receipt
})
```

- [ ] **Step 4: Verify routes registered**

```bash
npm run dev -- --port 3001 &
sleep 5
curl -s -X POST http://localhost:3001/api/categories \
  -H "Content-Type: application/json" \
  -d '{"name":"Test","color":"#6366f1"}' | python3 -m json.tool
```
Expected: JSON with `id`, `name: "Test"`, `color: "#6366f1"`, `created_at`.
Then clean up: copy the returned `id` and delete the test category:
```bash
curl -s -X DELETE http://localhost:3001/api/categories/<id>
pkill -f "nuxt dev"
```

- [ ] **Step 5: Commit**

```bash
git add server/api/categories.post.ts \
        server/api/categories/[id].delete.ts \
        server/api/receipts/[id]/category.patch.ts
git commit -m "feat(categories): add API routes for create, delete, assign"
```

---

### Task 4: app.vue — categories state

**Files:**
- Modify: `app/pages/app.vue`

**Interfaces:**
- Consumes: `Category`, `Receipt` from `lib/supabase.ts`; `useSupabase()` composable; `useTheme()` composable
- Produces:
  - `categories: Ref<Category[]>` — passed as prop to `AppSidebar` and `AppReceiptPanel`
  - `selectedCategoryId: Ref<string | null>` — passed as prop to `AppReceiptsTable`
  - `allReceipts: Ref<Receipt[]>` — used in grid view only
  - `gridColumns: ComputedRef<…>` — drives grid view columns
  - Event handlers: `onCategoryCreated`, `onSelectCategory`, `onAssign`, `onCategoryAssigned`

- [ ] **Step 1: Replace `app/pages/app.vue`**

```vue
<script setup lang="ts">
import type { Receipt, Category } from '~~/lib/supabase'
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
          v-for="(col, i) in gridColumns"
          :key="col.category?.id ?? 'uncategorized'"
          :category="col.category"
          :receipts="col.receipts"
          @assign="onAssign"
        />
      </main>
    </div>
  </SidebarProvider>
</template>
```

- [ ] **Step 2: Verify dev server starts with no console errors**

```bash
npm run dev -- --port 3001
```
Open `http://localhost:3001/app`. Expected: page loads, no Vue warnings in browser console. The sidebar and header look the same as before (categories section will be empty until Task 5).

- [ ] **Step 3: Commit**

```bash
git add app/pages/app.vue
git commit -m "feat(categories): wire categories state in app.vue"
```

---

### Task 5: AppSidebar — categories section

**Files:**
- Modify: `app/components/app/AppSidebar.vue`

**Interfaces:**
- Consumes: `Category` from `lib/supabase.ts`; `nextCategoryColor` from `lib/categorize.ts`; `POST /api/categories` route
- Props: `categories: Category[]`
- Emits: `selectCategory(id: string | null)`, `categoryCreated(category: Category)`

- [ ] **Step 1: Replace `app/components/app/AppSidebar.vue`**

```vue
<script setup lang="ts">
import {
  Star, Clock, Tag,
  FolderOpen, FileText, Share2,
  Settings, RefreshCw, Plus,
} from '@lucide/vue'
import type { Category } from '~~/lib/supabase'
import { nextCategoryColor } from '~~/lib/categorize'

const props = defineProps<{ categories: Category[] }>()
const emit  = defineEmits<{
  selectCategory:  [id: string | null]
  categoryCreated: [category: Category]
}>()

const activeCategoryId   = ref<string | null>(null)
const creatingCategory   = ref(false)
const newCategoryName    = ref('')
const dragOverId         = ref<string>('')   // '' = none; 'all' = All receipts

const mainNav = [
  { label: 'Favorites', icon: Star,        to: '/app' },
  { label: 'Recent',    icon: Clock,       to: '/app' },
  { label: 'Tags',      icon: Tag,         to: '/app' },
]

const orderNav = [
  { label: 'Drive Folders', icon: FolderOpen, to: '/app' },
  { label: 'Imported',      icon: FileText,   to: '/app' },
  { label: 'Shared',        icon: Share2,     to: '/app' },
]

const settingsNav = [
  { label: 'Settings',    icon: Settings,  to: '/app' },
  { label: 'Sync Status', icon: RefreshCw, to: '/app' },
]

function selectAll() {
  activeCategoryId.value = null
  emit('selectCategory', null)
}

function selectCategory(id: string) {
  activeCategoryId.value = id
  emit('selectCategory', id)
}

function startCreate() {
  creatingCategory.value = true
  newCategoryName.value  = ''
  nextTick(() => (document.getElementById('new-cat-input') as HTMLInputElement | null)?.focus())
}

async function confirmCreate() {
  const name = newCategoryName.value.trim()
  creatingCategory.value = false
  newCategoryName.value  = ''
  if (!name) return
  const color = nextCategoryColor(props.categories)
  const cat   = await $fetch<Category>('/api/categories', {
    method: 'POST',
    body: { name, color },
  })
  emit('categoryCreated', cat)
}

function onDragOver(e: DragEvent, id: string) {
  e.preventDefault()
  dragOverId.value = id
}

async function onDrop(e: DragEvent, categoryId: string | null) {
  dragOverId.value = ''
  const receiptId = e.dataTransfer?.getData('receiptId')
  if (!receiptId) return
  await $fetch(`/api/receipts/${receiptId}/category`, {
    method: 'PATCH',
    body: { categoryId, confirmed: true },
  })
}
</script>

<template>
  <Sidebar collapsible="icon">
    <!-- Profile -->
    <SidebarHeader class="border-b px-4 py-4">
      <div class="flex items-center gap-3 group-data-[collapsible=icon]:justify-center">
        <div class="size-10 rounded-full bg-muted flex items-center justify-center text-xl shrink-0 select-none">
          🗂️
        </div>
        <div class="min-w-0 group-data-[collapsible=icon]:hidden">
          <p class="text-sm font-semibold leading-tight truncate">KeepCabin</p>
          <p class="text-xs text-muted-foreground truncate">Receipt organizer</p>
        </div>
      </div>
    </SidebarHeader>

    <SidebarContent class="py-2">
      <!-- RECEIPTS -->
      <SidebarGroup>
        <div class="flex items-center justify-between px-4 mb-1">
          <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 p-0">
            Receipts
          </SidebarGroupLabel>
          <button
            class="text-muted-foreground hover:text-foreground transition-colors group-data-[collapsible=icon]:hidden"
            aria-label="New category"
            @click="startCreate"
          >
            <Plus class="size-3.5" />
          </button>
        </div>
        <SidebarGroupContent>
          <SidebarMenu>
            <!-- All receipts -->
            <SidebarMenuItem>
              <SidebarMenuButton
                :is-active="activeCategoryId === null"
                :class="{ 'ring-2 ring-inset ring-primary/40': dragOverId === 'all' }"
                @click="selectAll"
                @dragover="onDragOver($event, 'all')"
                @dragleave="dragOverId = ''"
                @drop="onDrop($event, null)"
              >
                <span class="size-2 rounded-full bg-foreground/30 shrink-0" />
                <span>All receipts</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <!-- Per-category rows -->
            <SidebarMenuItem v-for="cat in categories" :key="cat.id">
              <SidebarMenuButton
                :is-active="activeCategoryId === cat.id"
                :class="{ 'ring-2 ring-inset ring-primary/40': dragOverId === cat.id }"
                @click="selectCategory(cat.id)"
                @dragover="onDragOver($event, cat.id)"
                @dragleave="dragOverId = ''"
                @drop="onDrop($event, cat.id)"
              >
                <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: cat.color }" />
                <span>{{ cat.name }}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>

            <!-- Inline create input -->
            <SidebarMenuItem v-if="creatingCategory">
              <div class="px-2 py-1">
                <input
                  id="new-cat-input"
                  v-model="newCategoryName"
                  placeholder="Category name…"
                  maxlength="50"
                  class="w-full text-sm bg-muted/50 border border-border rounded-md px-2 py-1 outline-none focus:border-primary"
                  @keydown.enter.prevent="confirmCreate"
                  @keydown.escape="creatingCategory = false"
                  @blur="confirmCreate"
                />
              </div>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- MAIN -->
      <SidebarGroup>
        <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 px-4">
          Main
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in mainNav" :key="item.label">
              <SidebarMenuButton as-child>
                <NuxtLink :to="item.to" class="flex items-center gap-3">
                  <component :is="item.icon" class="size-4 shrink-0" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- ORDER -->
      <SidebarGroup>
        <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 px-4">
          Order
        </SidebarGroupLabel>
        <SidebarGroupContent>
          <SidebarMenu>
            <SidebarMenuItem v-for="item in orderNav" :key="item.label">
              <SidebarMenuButton as-child>
                <NuxtLink :to="item.to" class="flex items-center gap-3">
                  <component :is="item.icon" class="size-4 shrink-0" />
                  <span>{{ item.label }}</span>
                </NuxtLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <!-- SETTINGS -->
    <SidebarFooter class="border-t py-2">
      <SidebarGroupLabel class="text-[10px] font-semibold tracking-widest uppercase text-muted-foreground/70 px-4 mb-1">
        Settings
      </SidebarGroupLabel>
      <SidebarMenu>
        <SidebarMenuItem v-for="item in settingsNav" :key="item.label">
          <SidebarMenuButton as-child>
            <NuxtLink :to="item.to" class="flex items-center gap-3">
              <component :is="item.icon" class="size-4 shrink-0" />
              <span>{{ item.label }}</span>
            </NuxtLink>
          </SidebarMenuButton>
        </SidebarMenuItem>
      </SidebarMenu>
    </SidebarFooter>

    <SidebarRail />
  </Sidebar>
</template>
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3001/app`.
- RECEIPTS section shows "All receipts" with a gray dot.
- Clicking the `+` icon opens an inline text input.
- Typing a name and pressing Enter creates a new category (check Supabase dashboard → `categories` table).
- The new category appears in the sidebar with a colored dot.

- [ ] **Step 3: Commit**

```bash
git add app/components/app/AppSidebar.vue
git commit -m "feat(categories): sidebar RECEIPTS section with drop targets and inline create"
```

---

### Task 6: ReceiptsTable — filter + draggable rows

**Files:**
- Modify: `app/components/app/ReceiptsTable.vue`

**Interfaces:**
- Consumes: `Receipt` from `lib/supabase.ts`
- Props: `categoryId?: string | null` (undefined or null → show all; UUID string → filter)
- Emits: (unchanged) `select(receipt: Receipt)`

- [ ] **Step 1: Replace `app/components/app/ReceiptsTable.vue`**

```vue
<script setup lang="ts">
import { useSupabase, type Receipt } from '~~/lib/supabase'

const props = defineProps<{ categoryId?: string | null }>()
const emit  = defineEmits<{ select: [receipt: Receipt] }>()

const supabase       = useSupabase()
const receipts       = ref<Receipt[]>([])
const loadingReceipts = ref(true)
const fetchErrorMsg  = ref('')

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
  receipts.value       = data ?? []
  loadingReceipts.value = false
}

onMounted(fetchReceipts)
watch(() => props.categoryId, fetchReceipts)
defineExpose({ fetchReceipts })

function onDragStart(e: DragEvent, receiptId: string) {
  e.dataTransfer?.setData('receiptId', receiptId)
}
</script>

<template>
  <div class="overflow-auto rounded-md border">
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead class="w-16">Image</TableHead>
          <TableHead>Filename</TableHead>
          <TableHead>Added</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>OCR</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-if="loadingReceipts">
          <TableCell colspan="5" class="text-center text-muted-foreground py-8">Loading…</TableCell>
        </TableRow>
        <TableRow v-else-if="fetchErrorMsg">
          <TableCell colspan="5" class="text-center text-destructive py-8">
            Failed to load receipts: {{ fetchErrorMsg }}
          </TableCell>
        </TableRow>
        <TableRow v-else-if="receipts.length === 0">
          <TableCell colspan="5" class="text-center text-muted-foreground py-8">
            No receipts yet. Click Sync to get started.
          </TableCell>
        </TableRow>
        <TableRow
          v-for="receipt in receipts"
          :key="receipt.id"
          draggable="true"
          class="cursor-pointer hover:bg-muted/50"
          @click="emit('select', receipt)"
          @dragstart="onDragStart($event, receipt.id)"
        >
          <TableCell>
            <img :src="receipt.storage_url" :alt="receipt.filename" class="w-12 h-12 object-cover rounded" />
          </TableCell>
          <TableCell class="font-medium">{{ receipt.filename }}</TableCell>
          <TableCell class="text-muted-foreground text-sm">
            {{ new Date(receipt.created_at).toLocaleDateString() }}
          </TableCell>
          <TableCell>
            <Badge v-if="receipt.category_suggested" variant="outline" class="text-primary border-primary/40">
              Suggested
            </Badge>
            <span v-else-if="receipt.category_id" class="text-xs text-muted-foreground">Assigned</span>
            <span v-else class="text-xs text-muted-foreground">—</span>
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
```

- [ ] **Step 2: Verify in browser**

Open `http://localhost:3001/app`. If receipts exist:
- Clicking a sidebar category filters the table (empty if none assigned yet — that's correct).
- Hovering over a receipt row should show the grab cursor on drag (test by starting a drag; the row should move with cursor).

- [ ] **Step 3: Commit**

```bash
git add app/components/app/ReceiptsTable.vue
git commit -m "feat(categories): filter receipts by category; make rows draggable"
```

---

### Task 7: CategoryBanner component

**Files:**
- Create: `app/components/app/CategoryBanner.vue`

**Interfaces:**
- Consumes: `Category` from `lib/supabase.ts`; `CategorySuggestion` from `lib/categorize.ts`
- Props: `suggestion: CategorySuggestion | null`, `categories: Category[]`, `receiptId: string`
- Emits:
  - `assign(receiptId: string, categoryId: string)` — user picks an existing category
  - `create(receiptId: string, name: string)` — user accepts a "new" suggestion
  - `dismiss()` — user closes the banner

- [ ] **Step 1: Create `app/components/app/CategoryBanner.vue`**

```vue
<script setup lang="ts">
import { Check, Plus, ChevronDown, X } from '@lucide/vue'
import type { Category } from '~~/lib/supabase'
import type { CategorySuggestion } from '~~/lib/categorize'

const props = defineProps<{
  suggestion:  CategorySuggestion | null
  categories:  Category[]
  receiptId:   string
}>()

const emit = defineEmits<{
  assign:  [receiptId: string, categoryId: string]
  create:  [receiptId: string, name: string]
  dismiss: []
}>()

const showDropdown = ref(false)

const visible = computed(
  () => props.suggestion && props.suggestion.kind !== 'none',
)

function accept() {
  if (!props.suggestion || props.suggestion.kind === 'none') return
  const existing = props.categories.find(c => c.name === props.suggestion!.name)
  if (existing) {
    emit('assign', props.receiptId, existing.id)
  } else {
    emit('create', props.receiptId, props.suggestion.name)
  }
}

function pickCategory(cat: Category) {
  showDropdown.value = false
  emit('assign', props.receiptId, cat.id)
}
</script>

<template>
  <div
    v-if="visible"
    class="flex items-center gap-2 rounded-lg border border-dashed border-primary/40 bg-primary/5 px-3 py-2 text-sm"
  >
    <span class="shrink-0">📁</span>

    <span class="flex-1 min-w-0 truncate">
      <template v-if="suggestion!.kind === 'existing'">
        Suggested: <span class="font-medium">{{ suggestion!.name }}</span>
      </template>
      <template v-else>
        New category: <span class="font-medium">"{{ suggestion!.name }}"</span>?
      </template>
    </span>

    <!-- Accept / Create -->
    <Button
      v-if="suggestion!.kind === 'existing'"
      variant="ghost"
      size="sm"
      class="h-7 gap-1 shrink-0"
      @click="accept"
    >
      <Check class="size-3" /> Accept
    </Button>
    <Button
      v-else
      variant="ghost"
      size="sm"
      class="h-7 gap-1 shrink-0"
      @click="accept"
    >
      <Plus class="size-3" /> Create
    </Button>

    <!-- Change dropdown -->
    <div class="relative shrink-0">
      <Button
        variant="ghost"
        size="sm"
        class="h-7 gap-1"
        @click="showDropdown = !showDropdown"
      >
        Change <ChevronDown class="size-3" />
      </Button>
      <div
        v-if="showDropdown"
        class="absolute right-0 top-8 z-50 w-48 rounded-lg border bg-popover shadow-md py-1"
      >
        <button
          v-for="cat in categories"
          :key="cat.id"
          class="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-muted text-left"
          @click="pickCategory(cat)"
        >
          <span class="size-2 rounded-full shrink-0" :style="{ backgroundColor: cat.color }" />
          {{ cat.name }}
        </button>
        <p v-if="categories.length === 0" class="px-3 py-1.5 text-sm text-muted-foreground">
          No categories yet
        </p>
      </div>
    </div>

    <!-- Dismiss -->
    <Button
      variant="ghost"
      size="icon"
      class="size-7 shrink-0"
      aria-label="Dismiss suggestion"
      @click="emit('dismiss')"
    >
      <X class="size-3" />
    </Button>
  </div>
</template>
```

- [ ] **Step 2: Verify component loads**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 3: Commit**

```bash
git add app/components/app/CategoryBanner.vue
git commit -m "feat(categories): add CategoryBanner suggest/confirm component"
```

---

### Task 8: ReceiptPanel — integrate CategoryBanner

**Files:**
- Modify: `app/components/app/ReceiptPanel.vue`

**Interfaces:**
- Consumes: `detectCategory`, `CategorySuggestion` from `lib/categorize.ts`; `Category` from `lib/supabase.ts`; `AppCategoryBanner` (auto-imported)
- Props: `receipt: Receipt | null`, `categories: Category[]`
- Emits: `categoryAssigned()` — after any assign/create/dismiss

- [ ] **Step 1: Replace `app/components/app/ReceiptPanel.vue`**

```vue
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
  const { default: type } = { default: '' }   // unused, just for import consistency
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
```

- [ ] **Step 2: Fix the unused import line**

In the `onCreate` function there is a stray line `const { default: type } = { default: '' }`. Remove it — replace the function body with:

```ts
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
```

- [ ] **Step 3: Verify in browser**

Open `http://localhost:3001/app`, click a receipt that has OCR text. If the OCR text contains a keyword from the map (e.g. "restaurant"), the CategoryBanner appears below the header row. Accept, Change, and Dismiss buttons should be visible.

- [ ] **Step 4: Commit**

```bash
git add app/components/app/ReceiptPanel.vue
git commit -m "feat(categories): integrate CategoryBanner into ReceiptPanel"
```

---

### Task 9: CategoryColumn + grid view

**Files:**
- Create: `app/components/app/CategoryColumn.vue`

**Interfaces:**
- Consumes: `Category`, `Receipt` from `lib/supabase.ts`
- Props: `category: Category | null` (null = Uncategorized), `receipts: Receipt[]`
- Emits: `assign(receiptId: string, categoryId: string | null)`

- [ ] **Step 1: Create `app/components/app/CategoryColumn.vue`**

```vue
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
```

- [ ] **Step 2: Verify typecheck**

```bash
npm run typecheck 2>&1 | tail -5
```
Expected: `Found 0 errors.`

- [ ] **Step 3: Verify grid view in browser**

Open `http://localhost:3001/app`, click the grid icon in the header. Expected:
- One "Uncategorized" column appears (contains all receipts not yet assigned).
- One column per created category (initially empty).
- Dragging a receipt card from "Uncategorized" and dropping it onto a category column moves it there (page re-fetches after drop).

- [ ] **Step 4: Commit**

```bash
git add app/components/app/CategoryColumn.vue
git commit -m "feat(categories): add CategoryColumn for grid view drag and drop"
```
