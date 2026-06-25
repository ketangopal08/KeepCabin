# KeepCabin Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Scaffold a Nuxt 3 + shadcn-vue + Supabase SaaS app with a landing page and a fully functional receipt OCR app page.

**Architecture:** Nuxt 3 handles routing and server API routes. The landing page lives at `/` and the app at `/app`. Supabase provides Postgres (receipts table) and File Storage (images). Tesseract.js runs OCR client-side in the browser.

**Tech Stack:** Nuxt 3, shadcn-vue (via shadcn-vue CLI), Supabase JS client v2, Tesseract.js v5, Google Drive API v3 (public API key), TypeScript.

## Global Constraints

- Nuxt 3 (latest stable) — use `npx nuxi init`
- shadcn-vue — install via `npx shadcn-vue@latest init`
- Supabase JS client v2 — `@supabase/supabase-js`
- Tesseract.js v5 — `tesseract.js`
- TypeScript throughout — all files `.ts` or `.vue` with `<script setup lang="ts">`
- Style: shadcn-vue neutral palette + indigo accent, dark-mode friendly
- All "Get Started" / pricing CTAs → `/app` (no real auth/billing)
- Google Drive folder must be publicly shared (no OAuth)
- Env vars: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `GOOGLE_DRIVE_API_KEY` in `.env`

---

### Task 1: Project Scaffolding

**Files:**
- Create: `nuxt.config.ts`
- Create: `.env.example`
- Create: `tsconfig.json` (auto-generated)
- Create: `package.json` (auto-generated)

**Interfaces:**
- Produces: runnable Nuxt 3 dev server at `http://localhost:3000`

- [ ] **Step 1: Scaffold Nuxt 3 project**

```bash
npx nuxi@latest init . --force
```

Choose: no Git (already initialised), yes TypeScript.

- [ ] **Step 2: Install core dependencies**

```bash
npm install @supabase/supabase-js tesseract.js
npm install -D typescript
```

- [ ] **Step 3: Initialise shadcn-vue**

```bash
npx shadcn-vue@latest init
```

When prompted:
- TypeScript: Yes
- Framework: Nuxt
- Base color: Slate
- CSS variables: Yes

- [ ] **Step 4: Add required shadcn-vue components**

```bash
npx shadcn-vue@latest add button card dialog table badge toast
```

- [ ] **Step 5: Create `.env.example`**

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
GOOGLE_DRIVE_API_KEY=your-drive-api-key
```

Copy to `.env` and fill in real values.

- [ ] **Step 6: Update `nuxt.config.ts`**

```ts
export default defineNuxtConfig({
  devtools: { enabled: true },
  modules: [],
  runtimeConfig: {
    googleDriveApiKey: process.env.GOOGLE_DRIVE_API_KEY,
    public: {
      supabaseUrl: process.env.SUPABASE_URL,
      supabaseAnonKey: process.env.SUPABASE_ANON_KEY,
    },
  },
  css: ['~/assets/css/main.css'],
})
```

- [ ] **Step 7: Verify dev server starts**

```bash
npm run dev
```

Expected: `Nuxt 3` server running at `http://localhost:3000` with no errors.

- [ ] **Step 8: Commit**

```bash
git add .
git commit -m "feat: scaffold Nuxt 3 project with shadcn-vue and Supabase"
```

---

### Task 2: Supabase Client + Database Setup

**Files:**
- Create: `lib/supabase.ts`

**Interfaces:**
- Produces: `useSupabase()` composable returning a typed Supabase client
- Produces: `receipts` table in Supabase (created via Supabase dashboard SQL)

- [ ] **Step 1: Create the receipts table in Supabase**

In the Supabase dashboard → SQL Editor, run:

```sql
create table receipts (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  drive_file_id text,
  storage_url text not null,
  ocr_text text,
  created_at timestamptz default now()
);

-- Allow public reads and inserts (auth added later)
alter table receipts enable row level security;
create policy "public read" on receipts for select using (true);
create policy "public insert" on receipts for insert with check (true);
create policy "public update" on receipts for update using (true);
```

Also create a public storage bucket named `receipts` in Supabase Storage → Buckets → New bucket → name: `receipts`, public: true.

- [ ] **Step 2: Create `lib/supabase.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

export type Receipt = {
  id: string
  filename: string
  drive_file_id: string | null
  storage_url: string
  ocr_text: string | null
  created_at: string
}

export function useSupabase() {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
}
```

- [ ] **Step 3: Verify types resolve**

```bash
npx nuxi typecheck
```

Expected: no type errors related to `lib/supabase.ts`.

- [ ] **Step 4: Commit**

```bash
git add lib/supabase.ts
git commit -m "feat: add Supabase client and Receipt type"
```

---

### Task 3: OCR Utility

**Files:**
- Create: `lib/ocr.ts`

**Interfaces:**
- Produces: `runOcr(imageUrl: string): Promise<OcrResult>`
- Produces: `type OcrResult = { raw: string; merchant: string | null; date: string | null; items: LineItem[]; total: string | null }`
- Produces: `type LineItem = { description: string; price: string | null }`

- [ ] **Step 1: Create `lib/ocr.ts`**

```ts
import Tesseract from 'tesseract.js'

export type LineItem = {
  description: string
  price: string | null
}

export type OcrResult = {
  raw: string
  merchant: string | null
  date: string | null
  items: LineItem[]
  total: string | null
}

export async function runOcr(imageUrl: string): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageUrl, 'eng')
  const raw = data.text
  return parseReceiptText(raw)
}

function parseReceiptText(text: string): OcrResult {
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean)

  const merchant = lines[0] ?? null

  const dateMatch = text.match(/\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}/)
  const date = dateMatch ? dateMatch[0] : null

  const totalMatch = text.match(/total[:\s]+\$?([\d,]+\.\d{2})/i)
  const total = totalMatch ? `$${totalMatch[1]}` : null

  const priceRegex = /\$?([\d,]+\.\d{2})/
  const items: LineItem[] = lines
    .slice(1)
    .filter(line => !line.match(/total/i) && priceRegex.test(line))
    .map(line => {
      const priceMatch = line.match(priceRegex)
      return {
        description: line.replace(priceRegex, '').trim(),
        price: priceMatch ? `$${priceMatch[1]}` : null,
      }
    })

  return { raw, merchant, date, items, total }
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npx nuxi typecheck
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ocr.ts
git commit -m "feat: add Tesseract.js OCR utility with receipt parser"
```

---

### Task 4: Server API Routes

**Files:**
- Create: `server/api/sync-drive.post.ts`
- Create: `server/api/import-url.post.ts`

**Interfaces:**
- Consumes: `GOOGLE_DRIVE_API_KEY` from runtime config; `SUPABASE_URL`, `SUPABASE_ANON_KEY` from runtime config
- Produces: `POST /api/sync-drive` — body `{ folderUrl: string }` → returns `{ inserted: number; errors: string[] }`
- Produces: `POST /api/import-url` — body `{ imageUrl: string }` → returns `{ receipt: Receipt }`

- [ ] **Step 1: Create `server/api/sync-drive.post.ts`**

```ts
import { createClient } from '@supabase/supabase-js'
import type { Receipt } from '~/lib/supabase'

function extractFolderId(url: string): string | null {
  const match = url.match(/folders\/([a-zA-Z0-9_-]+)/)
  return match ? match[1] : null
}

export default defineEventHandler(async (event) => {
  const body = await readBody<{ folderUrl: string }>(event)
  const config = useRuntimeConfig()

  const folderId = extractFolderId(body.folderUrl)
  if (!folderId) {
    throw createError({ statusCode: 400, message: 'Invalid Google Drive folder URL' })
  }

  const driveRes = await fetch(
    `https://www.googleapis.com/drive/v3/files?q='${folderId}'+in+parents+and+mimeType+contains+'image/'&fields=files(id,name,mimeType)&key=${config.googleDriveApiKey}`
  )

  if (!driveRes.ok) {
    const err = await driveRes.json()
    const message = err?.error?.message ?? 'Google Drive API error'
    if (message.includes('sharing')) {
      throw createError({ statusCode: 403, message: 'Make sure the folder is publicly shared' })
    }
    throw createError({ statusCode: driveRes.status, message })
  }

  const { files } = await driveRes.json() as { files: { id: string; name: string }[] }

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
  const errors: string[] = []
  let inserted = 0

  for (const file of files) {
    try {
      const imageUrl = `https://drive.google.com/uc?export=download&id=${file.id}`
      const imgRes = await fetch(imageUrl)
      if (!imgRes.ok) throw new Error(`Failed to download ${file.name}`)

      const buffer = await imgRes.arrayBuffer()
      const path = `drive/${file.id}/${file.name}`

      const { error: uploadError } = await supabase.storage
        .from('receipts')
        .upload(path, buffer, { contentType: 'image/jpeg', upsert: true })

      if (uploadError) throw new Error(uploadError.message)

      const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)

      const { error: dbError } = await supabase.from('receipts').upsert({
        filename: file.name,
        drive_file_id: file.id,
        storage_url: urlData.publicUrl,
      }, { onConflict: 'drive_file_id' })

      if (dbError) throw new Error(dbError.message)
      inserted++
    } catch (e: any) {
      errors.push(e.message)
    }
  }

  return { inserted, errors }
})
```

- [ ] **Step 2: Create `server/api/import-url.post.ts`**

```ts
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const body = await readBody<{ imageUrl: string }>(event)
  const config = useRuntimeConfig()

  const imgRes = await fetch(body.imageUrl)
  if (!imgRes.ok) {
    throw createError({ statusCode: 400, message: 'Image URL unreachable' })
  }

  const buffer = await imgRes.arrayBuffer()
  const contentType = imgRes.headers.get('content-type') ?? 'image/jpeg'
  const filename = body.imageUrl.split('/').pop()?.split('?')[0] ?? 'imported.jpg'
  const path = `imported/${Date.now()}-${filename}`

  const supabase = createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)

  const { error: uploadError } = await supabase.storage
    .from('receipts')
    .upload(path, buffer, { contentType, upsert: false })

  if (uploadError) {
    throw createError({ statusCode: 500, message: uploadError.message })
  }

  const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(path)

  const { data: receipt, error: dbError } = await supabase
    .from('receipts')
    .insert({ filename, storage_url: urlData.publicUrl })
    .select()
    .single()

  if (dbError) throw createError({ statusCode: 500, message: dbError.message })

  return { receipt }
})
```

- [ ] **Step 3: Verify typecheck**

```bash
npx nuxi typecheck
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/
git commit -m "feat: add sync-drive and import-url server API routes"
```

---

### Task 5: Landing Page Components

**Files:**
- Create: `components/landing/LandingNavbar.vue`
- Create: `components/landing/HeroSection.vue`
- Create: `components/landing/FeaturesSection.vue`
- Create: `components/landing/PricingSection.vue`
- Create: `components/landing/FooterSection.vue`
- Create: `pages/index.vue`

**Interfaces:**
- Consumes: shadcn-vue `Button`, `Card`, `CardHeader`, `CardContent`, `CardFooter`
- Produces: `/` route rendering the full landing page

- [ ] **Step 1: Create `components/landing/LandingNavbar.vue`**

```vue
<script setup lang="ts">
</script>

<template>
  <nav class="border-b bg-background">
    <div class="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
      <span class="text-xl font-bold tracking-tight">KeepCabin</span>
      <NuxtLink to="/app">
        <Button variant="default">Get Started</Button>
      </NuxtLink>
    </div>
  </nav>
</template>
```

- [ ] **Step 2: Create `components/landing/HeroSection.vue`**

```vue
<script setup lang="ts">
</script>

<template>
  <section class="py-24 px-6 text-center">
    <div class="max-w-3xl mx-auto space-y-6">
      <h1 class="text-5xl font-extrabold tracking-tight leading-tight">
        Snap a receipt,<br />get it organized instantly.
      </h1>
      <p class="text-lg text-muted-foreground">
        Sync receipt images from Google Drive, extract text with OCR,
        and track your expenses — all in one place.
      </p>
      <NuxtLink to="/app">
        <Button size="lg" class="mt-4">Get Started →</Button>
      </NuxtLink>
    </div>
  </section>
</template>
```

- [ ] **Step 3: Create `components/landing/FeaturesSection.vue`**

```vue
<script setup lang="ts">
const features = [
  {
    icon: '📁',
    title: 'Sync from Drive',
    description: 'Connect any public Google Drive folder and pull all receipt images into KeepCabin instantly.',
  },
  {
    icon: '🔍',
    title: 'OCR Extraction',
    description: 'Tesseract-powered text recognition reads merchant names, dates, line items, and totals.',
  },
  {
    icon: '🧾',
    title: 'Receipt View',
    description: 'Every receipt is displayed as a clean, structured summary — ready to copy or download.',
  },
]
</script>

<template>
  <section class="py-20 px-6 bg-muted/40">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">Everything you need</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card v-for="f in features" :key="f.title">
          <CardHeader>
            <span class="text-4xl">{{ f.icon }}</span>
            <CardTitle class="mt-2">{{ f.title }}</CardTitle>
          </CardHeader>
          <CardContent>
            <p class="text-muted-foreground">{{ f.description }}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 4: Create `components/landing/PricingSection.vue`**

```vue
<script setup lang="ts">
const tiers = [
  {
    name: 'Free',
    price: '$0',
    features: ['50 receipts/mo', 'Drive Sync', 'OCR Extraction'],
    cta: 'Get Started',
    highlighted: false,
  },
  {
    name: 'Pro',
    price: '$9',
    features: ['Unlimited receipts', 'Drive Sync', 'Priority Support'],
    cta: 'Get Started',
    highlighted: true,
  },
  {
    name: 'Business',
    price: '$29',
    features: ['Unlimited receipts', 'Team Access', 'API Access'],
    cta: 'Contact Us',
    highlighted: false,
  },
]
</script>

<template>
  <section class="py-20 px-6">
    <div class="max-w-6xl mx-auto">
      <h2 class="text-3xl font-bold text-center mb-12">Simple pricing</h2>
      <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card
          v-for="tier in tiers"
          :key="tier.name"
          :class="tier.highlighted ? 'border-primary ring-2 ring-primary' : ''"
        >
          <CardHeader>
            <CardTitle>{{ tier.name }}</CardTitle>
            <div class="text-4xl font-bold mt-2">
              {{ tier.price }}<span class="text-base font-normal text-muted-foreground">/mo</span>
            </div>
          </CardHeader>
          <CardContent>
            <ul class="space-y-2">
              <li v-for="feat in tier.features" :key="feat" class="flex items-center gap-2 text-sm">
                <span class="text-green-500">✓</span> {{ feat }}
              </li>
            </ul>
          </CardContent>
          <CardFooter>
            <NuxtLink to="/app" class="w-full">
              <Button :variant="tier.highlighted ? 'default' : 'outline'" class="w-full">
                {{ tier.cta }}
              </Button>
            </NuxtLink>
          </CardFooter>
        </Card>
      </div>
    </div>
  </section>
</template>
```

- [ ] **Step 5: Create `components/landing/FooterSection.vue`**

```vue
<template>
  <footer class="border-t py-8 px-6 text-center text-sm text-muted-foreground">
    © KeepCabin 2026. All rights reserved.
  </footer>
</template>
```

- [ ] **Step 6: Create `pages/index.vue`**

```vue
<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen bg-background text-foreground">
    <LandingNavbar />
    <HeroSection />
    <FeaturesSection />
    <PricingSection />
    <FooterSection />
  </div>
</template>
```

- [ ] **Step 7: Visit `http://localhost:3000` and verify the landing page renders with navbar, hero, features, pricing, and footer.**

- [ ] **Step 8: Commit**

```bash
git add pages/index.vue components/landing/
git commit -m "feat: add landing page with hero, features, pricing, and footer"
```

---

### Task 6: App Shell — Layout with Sidebar and Navbar

**Files:**
- Create: `components/app/AppNavbar.vue`
- Create: `components/app/AppSidebar.vue`
- Create: `pages/app.vue`

**Interfaces:**
- Produces: `/app` route with persistent sidebar + navbar layout
- Produces: sidebar emits no events — purely presentational for now

- [ ] **Step 1: Create `components/app/AppNavbar.vue`**

```vue
<template>
  <header class="border-b bg-background h-14 flex items-center px-6">
    <NuxtLink to="/" class="text-lg font-bold tracking-tight">KeepCabin</NuxtLink>
  </header>
</template>
```

- [ ] **Step 2: Create `components/app/AppSidebar.vue`**

```vue
<script setup lang="ts">
const links = [
  { label: 'Home', icon: '🏠', to: '/app' },
  { label: 'Receipts', icon: '🧾', to: '/app' },
  { label: 'Folders', icon: '📁', to: '/app' },
  { label: 'Settings', icon: '⚙️', to: '/app' },
]
</script>

<template>
  <aside class="w-56 shrink-0 border-r bg-background h-full flex flex-col py-4 px-3 gap-1">
    <NuxtLink
      v-for="link in links"
      :key="link.label"
      :to="link.to"
      class="flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium hover:bg-muted transition-colors"
      active-class="bg-muted"
    >
      <span>{{ link.icon }}</span>
      <span>{{ link.label }}</span>
    </NuxtLink>
  </aside>
</template>
```

- [ ] **Step 3: Create `pages/app.vue`**

```vue
<script setup lang="ts">
</script>

<template>
  <div class="min-h-screen flex flex-col bg-background text-foreground">
    <AppNavbar />
    <div class="flex flex-1 overflow-hidden">
      <AppSidebar />
      <main class="flex-1 flex flex-col overflow-hidden p-4 gap-4">
        <SyncButtons />
        <div class="flex flex-1 gap-4 overflow-hidden">
          <ReceiptsTable class="flex-1" />
          <ReceiptPanel class="w-80 shrink-0" />
        </div>
      </main>
    </div>
  </div>
</template>
```

- [ ] **Step 4: Visit `http://localhost:3000/app` — verify navbar and sidebar render (table/panel are in next tasks).**

- [ ] **Step 5: Commit**

```bash
git add pages/app.vue components/app/AppNavbar.vue components/app/AppSidebar.vue
git commit -m "feat: add app shell with sidebar and navbar layout"
```

---

### Task 7: Sync Buttons with Dialogs

**Files:**
- Create: `components/app/SyncButtons.vue`

**Interfaces:**
- Consumes: `POST /api/sync-drive` with `{ folderUrl: string }`
- Consumes: `POST /api/import-url` with `{ imageUrl: string }`
- Produces: emits `'synced'` event after successful sync or import (parent `app.vue` listens to refresh table)

- [ ] **Step 1: Update `pages/app.vue` to handle the `synced` event**

Replace the `<ReceiptsTable>` line:

```vue
<ReceiptsTable :key="refreshKey" class="flex-1" />
```

And add to `<script setup>`:

```ts
const refreshKey = ref(0)
function onSynced() { refreshKey.value++ }
```

And update `<SyncButtons />` to:

```vue
<SyncButtons @synced="onSynced" />
```

- [ ] **Step 2: Create `components/app/SyncButtons.vue`**

```vue
<script setup lang="ts">
const emit = defineEmits<{ synced: [] }>()

const syncOpen = ref(false)
const importOpen = ref(false)
const folderUrl = ref(localStorage.getItem('keepcabin_folder_url') ?? '')
const imageUrl = ref('')
const loading = ref(false)
const error = ref('')

async function handleSync() {
  error.value = ''
  loading.value = true
  try {
    const res = await $fetch('/api/sync-drive', {
      method: 'POST',
      body: { folderUrl: folderUrl.value },
    })
    localStorage.setItem('keepcabin_folder_url', folderUrl.value)
    syncOpen.value = false
    emit('synced')
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Sync failed'
  } finally {
    loading.value = false
  }
}

async function handleImport() {
  error.value = ''
  loading.value = true
  try {
    await $fetch('/api/import-url', {
      method: 'POST',
      body: { imageUrl: imageUrl.value },
    })
    imageUrl.value = ''
    importOpen.value = false
    emit('synced')
  } catch (e: any) {
    error.value = e?.data?.message ?? 'Import failed'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="flex gap-2">
    <!-- Sync Dialog -->
    <Dialog v-model:open="syncOpen">
      <DialogTrigger as-child>
        <Button variant="default">Sync</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sync from Google Drive</DialogTitle>
          <DialogDescription>
            Paste the URL of a publicly shared Google Drive folder.
          </DialogDescription>
        </DialogHeader>
        <Input v-model="folderUrl" placeholder="https://drive.google.com/drive/folders/..." />
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button :disabled="loading || !folderUrl" @click="handleSync">
            {{ loading ? 'Syncing…' : 'Sync' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- Import from URL Dialog -->
    <Dialog v-model:open="importOpen">
      <DialogTrigger as-child>
        <Button variant="outline">Import from URL</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import from URL</DialogTitle>
          <DialogDescription>
            Paste a direct URL to a receipt image.
          </DialogDescription>
        </DialogHeader>
        <Input v-model="imageUrl" placeholder="https://example.com/receipt.jpg" />
        <p v-if="error" class="text-sm text-destructive">{{ error }}</p>
        <DialogFooter>
          <Button :disabled="loading || !imageUrl" @click="handleImport">
            {{ loading ? 'Importing…' : 'Import' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
```

Note: also run `npx shadcn-vue@latest add dialog input` if not already added.

- [ ] **Step 3: Verify typecheck**

```bash
npx nuxi typecheck
```

- [ ] **Step 4: Commit**

```bash
git add components/app/SyncButtons.vue pages/app.vue
git commit -m "feat: add Sync and Import from URL dialogs with Drive API integration"
```

---

### Task 8: Receipts Table

**Files:**
- Create: `components/app/ReceiptsTable.vue`

**Interfaces:**
- Consumes: `useSupabase()` from `~/lib/supabase`; `Receipt` type from `~/lib/supabase`
- Consumes: `:key="refreshKey"` prop from parent to trigger re-fetch
- Produces: emits `'select'` with `Receipt` payload when a row is clicked

- [ ] **Step 1: Create `components/app/ReceiptsTable.vue`**

```vue
<script setup lang="ts">
import { useSupabase, type Receipt } from '~/lib/supabase'

const emit = defineEmits<{ select: [receipt: Receipt] }>()
const supabase = useSupabase()
const receipts = ref<Receipt[]>([])
const loadingReceipts = ref(true)

async function fetchReceipts() {
  loadingReceipts.value = true
  const { data } = await supabase
    .from('receipts')
    .select('*')
    .order('created_at', { ascending: false })
  receipts.value = data ?? []
  loadingReceipts.value = false
}

onMounted(fetchReceipts)
// Re-fetch when parent bumps the key (via :key prop)
watch(() => undefined, fetchReceipts)
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
        <TableRow
          v-if="loadingReceipts"
        >
          <TableCell colspan="4" class="text-center text-muted-foreground py-8">
            Loading…
          </TableCell>
        </TableRow>
        <TableRow
          v-else-if="receipts.length === 0"
        >
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
            <img :src="receipt.storage_url" :alt="receipt.filename" class="w-12 h-12 object-cover rounded" />
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
```

- [ ] **Step 2: Update `pages/app.vue` to wire the `select` event**

Add to `<script setup>`:

```ts
import type { Receipt } from '~/lib/supabase'
const selectedReceipt = ref<Receipt | null>(null)
```

Update `<ReceiptsTable>`:

```vue
<ReceiptsTable :key="refreshKey" class="flex-1" @select="selectedReceipt = $event" />
```

Update `<ReceiptPanel>`:

```vue
<ReceiptPanel :receipt="selectedReceipt" class="w-80 shrink-0" />
```

- [ ] **Step 3: Verify the table renders and rows are clickable in the browser.**

- [ ] **Step 4: Commit**

```bash
git add components/app/ReceiptsTable.vue pages/app.vue
git commit -m "feat: add receipts table with Supabase fetch and row selection"
```

---

### Task 9: Receipt Panel with OCR

**Files:**
- Create: `components/app/ReceiptPanel.vue`

**Interfaces:**
- Consumes: `runOcr(imageUrl: string): Promise<OcrResult>` from `~/lib/ocr`
- Consumes: `type Receipt` from `~/lib/supabase`
- Consumes: prop `receipt: Receipt | null`
- Consumes: `useSupabase()` to save `ocr_text` back to DB after processing

- [ ] **Step 1: Create `components/app/ReceiptPanel.vue`**

```vue
<script setup lang="ts">
import { runOcr, type OcrResult } from '~/lib/ocr'
import { useSupabase, type Receipt } from '~/lib/supabase'

const props = defineProps<{ receipt: Receipt | null }>()
const supabase = useSupabase()

const ocrResult = ref<OcrResult | null>(null)
const loading = ref(false)
const ocrError = ref('')

watch(() => props.receipt, async (r) => {
  if (!r) { ocrResult.value = null; return }
  ocrError.value = ''

  if (r.ocr_text) {
    // Cached — parse the stored raw text without re-running OCR
    const { parseReceiptText } = await import('~/lib/ocr')
    // parseReceiptText is not exported; use runOcr directly but serve cached raw
    ocrResult.value = { raw: r.ocr_text, merchant: null, date: null, items: [], total: null }
    return
  }

  loading.value = true
  try {
    const result = await runOcr(r.storage_url)
    ocrResult.value = result
    await supabase.from('receipts').update({ ocr_text: result.raw }).eq('id', r.id)
  } catch (e: any) {
    ocrError.value = 'OCR failed. Please try again.'
  } finally {
    loading.value = false
  }
}, { immediate: true })

function copyToClipboard() {
  if (ocrResult.value?.raw) navigator.clipboard.writeText(ocrResult.value.raw)
}

function downloadText() {
  if (!ocrResult.value?.raw) return
  const blob = new Blob([ocrResult.value.raw], { type: 'text/plain' })
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = `${props.receipt?.filename ?? 'receipt'}.txt`
  a.click()
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
      <Button variant="outline" size="sm" @click="$emit('retry')">Retry</Button>
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

      <!-- Fallback: show raw if no structured data -->
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

- [ ] **Step 2: Export `parseReceiptText` from `lib/ocr.ts`**

In `lib/ocr.ts`, change `function parseReceiptText` to `export function parseReceiptText`.

Then update the cached-OCR branch in `ReceiptPanel.vue`:

```ts
import { runOcr, parseReceiptText, type OcrResult } from '~/lib/ocr'

// inside the watch, cached branch:
if (r.ocr_text) {
  ocrResult.value = parseReceiptText(r.ocr_text)
  return
}
```

- [ ] **Step 3: Test in browser — click a synced receipt row and verify OCR runs and result displays.**

- [ ] **Step 4: Commit**

```bash
git add components/app/ReceiptPanel.vue lib/ocr.ts
git commit -m "feat: add receipt panel with Tesseract OCR and structured display"
```

---

### Task 10: Final Integration Check

- [ ] **Step 1: Run full typecheck**

```bash
npx nuxi typecheck
```

Expected: 0 errors.

- [ ] **Step 2: Run dev server and walk through the golden path**

```bash
npm run dev
```

1. Open `http://localhost:3000` — landing page renders fully (navbar, hero, features, pricing, footer)
2. Click "Get Started" — redirects to `/app`
3. Click "Sync" — dialog opens, paste a public Drive folder URL, click Sync — table populates
4. Click "Import from URL" — dialog opens, paste an image URL, click Import — row appears in table
5. Click a table row — OCR runs, receipt panel shows structured data
6. Click Copy / Download — clipboard / file download works

- [ ] **Step 3: Verify error states**

- Enter a private Drive folder URL → error "Make sure the folder is publicly shared" appears in dialog
- Enter a broken image URL in Import → error "Image URL unreachable" appears

- [ ] **Step 4: Final commit**

```bash
git add .
git commit -m "feat: complete KeepCabin Phase 1 — landing page + OCR receipt app"
```
