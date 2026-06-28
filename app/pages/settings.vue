<script setup lang="ts">
import { User, Layers, Palette, RefreshCw, Trash2, Check, Pencil, X, Sun, Moon, ChevronRight } from '@lucide/vue'
import { useSupabase, type Category } from '~~/lib/supabase'
import { CATEGORY_COLORS, nextCategoryColor } from '~~/lib/categorize'

const supabase = useSupabase()
const { isDark, toggle } = useTheme()

// --- active section ---
const activeSection = ref<'profile' | 'categories' | 'appearance' | 'sync'>('profile')

const sections = [
  { id: 'profile',    label: 'Profile',    icon: User },
  { id: 'categories', label: 'Categories', icon: Layers },
  { id: 'appearance', label: 'Appearance', icon: Palette },
  { id: 'sync',       label: 'Sync',       icon: RefreshCw },
] as const

// --- profile ---
const displayName = ref('')
const profileSaved = ref(false)

onMounted(() => {
  if (import.meta.client) {
    displayName.value = localStorage.getItem('keepcabin-display-name') ?? ''
  }
})

function saveProfile() {
  if (import.meta.client) {
    localStorage.setItem('keepcabin-display-name', displayName.value.trim())
    profileSaved.value = true
    setTimeout(() => { profileSaved.value = false }, 2000)
  }
}

const initials = computed(() => {
  const name = displayName.value.trim()
  if (!name) return 'KC'
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()
})

// --- categories ---
const categories = ref<Category[]>([])
const loadingCats = ref(true)

async function fetchCategories() {
  loadingCats.value = true
  const { data } = await supabase.from('categories').select('*').order('created_at')
  categories.value = data ?? []
  loadingCats.value = false
}

onMounted(fetchCategories)

// Edit state per category
const editingId    = ref<string | null>(null)
const editingName  = ref('')
const editingColor = ref('')
const savingId     = ref<string | null>(null)
const deletingId   = ref<string | null>(null)

function startEdit(cat: Category) {
  editingId.value    = cat.id
  editingName.value  = cat.name
  editingColor.value = cat.color
  nextTick(() => (document.getElementById(`edit-${cat.id}`) as HTMLInputElement | null)?.focus())
}

function cancelEdit() {
  editingId.value = null
}

async function saveEdit(cat: Category) {
  const name = editingName.value.trim()
  if (!name) return
  savingId.value = cat.id
  const { data } = await supabase
    .from('categories')
    .update({ name, color: editingColor.value })
    .eq('id', cat.id)
    .select()
    .single()
  if (data) {
    const idx = categories.value.findIndex(c => c.id === cat.id)
    if (idx !== -1) categories.value[idx] = data
  }
  editingId.value = null
  savingId.value  = null
}

async function deleteCategory(id: string) {
  deletingId.value = id
  await $fetch(`/api/categories/${id}`, { method: 'DELETE' })
  categories.value = categories.value.filter(c => c.id !== id)
  deletingId.value = null
}

// New category inline in settings
const newCatName  = ref('')
const newCatColor = ref(CATEGORY_COLORS[0]!)
const addingCat   = ref(false)
const newCatError = ref('')

async function addCategory() {
  const name = newCatName.value.trim()
  if (!name) { newCatError.value = 'Required'; return }
  addingCat.value  = true
  newCatError.value = ''
  const cat = await $fetch<Category>('/api/categories', {
    method: 'POST',
    body: { name, color: newCatColor.value },
  })
  categories.value.push(cat)
  newCatName.value  = ''
  newCatColor.value = nextCategoryColor(categories.value)
  addingCat.value   = false
}
</script>

<template>
  <SidebarProvider>
    <AppSidebar :categories="categories" />

    <div class="flex flex-1 min-h-screen bg-background">

      <!-- Left settings nav -->
      <aside class="w-52 shrink-0 border-r border-border/60 py-6 px-3 flex flex-col gap-1">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-3 mb-3">Settings</p>
        <button
          v-for="s in sections"
          :key="s.id"
          class="flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors text-left w-full"
          :class="activeSection === s.id
            ? 'bg-muted text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'"
          @click="activeSection = s.id"
        >
          <component :is="s.icon" class="size-4 shrink-0" />
          {{ s.label }}
          <ChevronRight v-if="activeSection === s.id" class="size-3.5 ml-auto" />
        </button>
      </aside>

      <!-- Content -->
      <div class="flex-1 max-w-2xl px-8 py-8 overflow-auto">

        <!-- ── PROFILE ── -->
        <section v-if="activeSection === 'profile'" class="flex flex-col gap-6">
          <div>
            <h2 class="text-base font-semibold">Profile</h2>
            <p class="text-sm text-muted-foreground mt-0.5">How you appear in KeepCabin.</p>
          </div>

          <!-- Avatar preview -->
          <div class="flex items-center gap-4">
            <div class="size-16 rounded-full bg-muted border border-border flex items-center justify-center text-xl font-bold text-foreground select-none">
              {{ initials }}
            </div>
            <div>
              <p class="text-sm font-medium">{{ displayName || 'Your name' }}</p>
              <p class="text-xs text-muted-foreground mt-0.5">Initials shown as avatar</p>
            </div>
          </div>

          <div class="flex flex-col gap-4 p-5 rounded-xl border border-border/60 bg-card">
            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium">Display name</label>
              <Input
                v-model="displayName"
                placeholder="Your name"
                class="max-w-sm"
                @keydown.enter="saveProfile"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-sm font-medium">Email</label>
              <Input placeholder="you@example.com" disabled class="max-w-sm opacity-50 cursor-not-allowed" />
              <p class="text-xs text-muted-foreground">Sign in coming soon.</p>
            </div>

            <div class="pt-1">
              <Button size="sm" @click="saveProfile">
                <Check v-if="profileSaved" class="size-3.5 mr-1.5" />
                {{ profileSaved ? 'Saved!' : 'Save changes' }}
              </Button>
            </div>
          </div>
        </section>

        <!-- ── CATEGORIES ── -->
        <section v-else-if="activeSection === 'categories'" class="flex flex-col gap-6">
          <div>
            <h2 class="text-base font-semibold">Categories</h2>
            <p class="text-sm text-muted-foreground mt-0.5">Manage how your receipts are organized.</p>
          </div>

          <!-- Category list -->
          <div class="rounded-xl border border-border/60 bg-card overflow-hidden">
            <div v-if="loadingCats" class="py-10 text-center text-sm text-muted-foreground">
              Loading…
            </div>
            <div v-else-if="categories.length === 0" class="py-10 text-center text-sm text-muted-foreground">
              No categories yet.
            </div>
            <template v-else>
              <div
                v-for="(cat, i) in categories"
                :key="cat.id"
                class="flex items-center gap-3 px-4 py-3 transition-colors"
                :class="i !== 0 ? 'border-t border-border/40' : ''"
              >
                <!-- Editing state -->
                <template v-if="editingId === cat.id">
                  <div class="flex flex-wrap gap-1.5 shrink-0">
                    <button
                      v-for="color in CATEGORY_COLORS"
                      :key="color"
                      type="button"
                      class="size-5 rounded-full transition-transform hover:scale-110 focus:outline-none"
                      :class="editingColor === color ? 'ring-2 ring-offset-1 ring-offset-card scale-110' : ''"
                      :style="{ backgroundColor: color }"
                      @click="editingColor = color"
                    />
                  </div>
                  <Input
                    :id="`edit-${cat.id}`"
                    v-model="editingName"
                    class="flex-1 h-8 text-sm"
                    @keydown.enter="saveEdit(cat)"
                    @keydown.escape="cancelEdit"
                  />
                  <Button size="icon" variant="ghost" class="size-8 shrink-0" :disabled="savingId === cat.id" @click="saveEdit(cat)">
                    <Check class="size-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" class="size-8 shrink-0" @click="cancelEdit">
                    <X class="size-3.5" />
                  </Button>
                </template>

                <!-- Display state -->
                <template v-else>
                  <span class="size-3 rounded-full shrink-0" :style="{ backgroundColor: cat.color }" />
                  <span class="flex-1 text-sm">{{ cat.name }}</span>
                  <Button size="icon" variant="ghost" class="size-7 shrink-0 text-muted-foreground hover:text-foreground" @click="startEdit(cat)">
                    <Pencil class="size-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    class="size-7 shrink-0 text-muted-foreground hover:text-destructive"
                    :disabled="deletingId === cat.id"
                    @click="deleteCategory(cat.id)"
                  >
                    <Trash2 class="size-3.5" />
                  </Button>
                </template>
              </div>
            </template>
          </div>

          <!-- Add new category -->
          <div class="flex flex-col gap-3 p-5 rounded-xl border border-border/60 bg-card">
            <p class="text-sm font-medium">Add category</p>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="color in CATEGORY_COLORS"
                :key="color"
                type="button"
                class="size-6 rounded-full transition-transform hover:scale-110 focus:outline-none"
                :class="newCatColor === color ? 'ring-2 ring-offset-2 ring-offset-card scale-110' : ''"
                :style="{ backgroundColor: color }"
                @click="newCatColor = color"
              />
            </div>
            <div class="flex gap-2">
              <Input
                v-model="newCatName"
                placeholder="Category name…"
                maxlength="50"
                class="flex-1"
                :class="newCatError ? 'border-destructive' : ''"
                @keydown.enter="addCategory"
              />
              <Button :disabled="addingCat" @click="addCategory">
                {{ addingCat ? 'Adding…' : 'Add' }}
              </Button>
            </div>
            <p v-if="newCatError" class="text-xs text-destructive">{{ newCatError }}</p>
          </div>
        </section>

        <!-- ── APPEARANCE ── -->
        <section v-else-if="activeSection === 'appearance'" class="flex flex-col gap-6">
          <div>
            <h2 class="text-base font-semibold">Appearance</h2>
            <p class="text-sm text-muted-foreground mt-0.5">Customize how KeepCabin looks.</p>
          </div>

          <div class="flex flex-col gap-3 p-5 rounded-xl border border-border/60 bg-card">
            <div class="flex items-center justify-between">
              <div>
                <p class="text-sm font-medium">Theme</p>
                <p class="text-xs text-muted-foreground mt-0.5">{{ isDark ? 'Dark mode is on' : 'Light mode is on' }}</p>
              </div>
              <button
                class="flex items-center gap-2 px-4 py-2 rounded-lg border border-border/60 bg-muted/40 text-sm font-medium hover:bg-muted transition-colors"
                @click="toggle"
              >
                <Sun v-if="isDark" class="size-4" />
                <Moon v-else class="size-4" />
                {{ isDark ? 'Switch to light' : 'Switch to dark' }}
              </button>
            </div>
          </div>

          <!-- Theme preview cards -->
          <div class="grid grid-cols-2 gap-3">
            <button
              class="flex flex-col gap-2 p-4 rounded-xl border-2 transition-colors text-left"
              :class="isDark ? 'border-primary' : 'border-border/60'"
              @click="!isDark && toggle()"
            >
              <div class="w-full h-16 rounded-lg bg-[#0e0e10] border border-[#2c2c2c] flex flex-col gap-1 p-2">
                <div class="h-2 w-16 rounded bg-[#2c2c2c]" />
                <div class="h-1.5 w-10 rounded bg-[#1a1a1a]" />
              </div>
              <div class="flex items-center gap-2">
                <div class="size-3 rounded-full" :class="isDark ? 'bg-primary' : 'bg-border'" />
                <span class="text-xs font-medium">Dark</span>
              </div>
            </button>

            <button
              class="flex flex-col gap-2 p-4 rounded-xl border-2 transition-colors text-left"
              :class="!isDark ? 'border-primary' : 'border-border/60'"
              @click="isDark && toggle()"
            >
              <div class="w-full h-16 rounded-lg bg-white border border-gray-200 flex flex-col gap-1 p-2">
                <div class="h-2 w-16 rounded bg-gray-200" />
                <div class="h-1.5 w-10 rounded bg-gray-100" />
              </div>
              <div class="flex items-center gap-2">
                <div class="size-3 rounded-full" :class="!isDark ? 'bg-primary' : 'bg-border'" />
                <span class="text-xs font-medium">Light</span>
              </div>
            </button>
          </div>
        </section>

        <!-- ── SYNC ── -->
        <section v-else-if="activeSection === 'sync'" class="flex flex-col gap-6">
          <div>
            <h2 class="text-base font-semibold">Sync</h2>
            <p class="text-sm text-muted-foreground mt-0.5">Connect external sources to import receipts.</p>
          </div>

          <div class="flex flex-col gap-3 p-5 rounded-xl border border-border/60 bg-card">
            <div class="flex items-start gap-4">
              <div class="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg">
                📁
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">Google Drive</p>
                <p class="text-xs text-muted-foreground mt-0.5">Sync receipt images from a Drive folder.</p>
                <div class="mt-3 flex flex-col gap-1.5">
                  <label class="text-xs font-medium text-muted-foreground uppercase tracking-wide">API Key</label>
                  <div class="flex gap-2">
                    <Input
                      placeholder="your-google-drive-api-key"
                      type="password"
                      disabled
                      class="flex-1 font-mono text-xs opacity-60 cursor-not-allowed"
                    />
                    <Button variant="outline" size="sm" disabled>Update</Button>
                  </div>
                  <p class="text-xs text-muted-foreground">Set via <code class="px-1 py-0.5 rounded bg-muted text-xs">GOOGLE_DRIVE_API_KEY</code> in your <code class="px-1 py-0.5 rounded bg-muted text-xs">.env</code> file.</p>
                </div>
              </div>
            </div>
          </div>

          <div class="flex flex-col gap-3 p-5 rounded-xl border border-border/60 bg-card">
            <div class="flex items-start gap-4">
              <div class="size-10 rounded-lg bg-muted flex items-center justify-center shrink-0 text-lg">
                🗄️
              </div>
              <div class="flex-1">
                <p class="text-sm font-medium">Supabase</p>
                <p class="text-xs text-muted-foreground mt-0.5">Database and storage backend.</p>
                <div class="mt-2 flex items-center gap-2">
                  <div class="size-2 rounded-full bg-emerald-500" />
                  <span class="text-xs text-muted-foreground">Connected</span>
                </div>
              </div>
            </div>
          </div>
        </section>

      </div>
    </div>
  </SidebarProvider>
</template>
