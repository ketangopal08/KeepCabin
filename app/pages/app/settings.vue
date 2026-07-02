<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import {
  User, Bell, Building2, Palette, Sun, Moon, Check, Copy,
} from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase  = useSupabase()
const { ctx }   = useOrgContext()
const { isDark, toggle } = useTheme()

type Section = 'profile' | 'notifications' | 'general' | 'appearance'
const active = ref<Section>('profile')

function setSection(id: string) {
  active.value = id as Section
}

const role = computed(() => ctx.value?.member?.role)

const displayName  = ref('')
const userEmail    = ref('')
const profileSaved = ref(false)

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  displayName.value = user?.user_metadata?.full_name ?? ''
  userEmail.value   = user?.email ?? ''
})

async function saveProfile() {
  await supabase.auth.updateUser({ data: { full_name: displayName.value.trim() } })
  profileSaved.value = true
  setTimeout(() => { profileSaved.value = false }, 2000)
}

const initials = computed(() => {
  const n = displayName.value.trim()
  if (!n) return 'KC'
  return n.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
})

const copied = ref(false)
function copyOrgId() {
  if (!ctx.value?.org?.id) return
  navigator.clipboard.writeText(ctx.value.org.id)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}
</script>

<template>
  <div class="flex h-full -m-6 overflow-hidden">

    <!-- ── Left settings nav ── -->
    <aside class="w-56 shrink-0 border-r border-border bg-card py-6 px-3 flex flex-col gap-5 overflow-y-auto">

      <!-- Personal Settings -->
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1.5">Personal Settings</p>
        <nav class="flex flex-col gap-0.5">
          <button
            v-for="item in [
              { id: 'profile', label: 'Profile', icon: User },
              { id: 'notifications', label: 'Notifications', icon: Bell },
            ]"
            :key="item.id"
            class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors text-left w-full"
            :class="active === item.id
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
            @click="setSection(item.id)"
          >
            <component :is="item.icon" class="size-3.5 shrink-0" />
            {{ item.label }}
          </button>
        </nav>
      </div>

      <!-- Organization (owner only) -->
      <div v-if="role === 'owner'">
        <p class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1.5">Organization</p>
        <div class="flex items-center gap-2 px-2 py-1.5 mb-0.5">
          <div
            class="size-4 rounded-sm text-[9px] font-bold text-black flex items-center justify-center shrink-0"
            style="background:#C8E63C"
          >
            {{ (ctx?.org?.name ?? 'KC').charAt(0) }}
          </div>
          <span class="text-[13px] font-medium text-foreground truncate">{{ ctx?.org?.name }}</span>
        </div>
        <nav class="flex flex-col gap-0.5">
          <button
            class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors text-left w-full"
            :class="active === 'general'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
            @click="setSection('general')"
          >
            <Building2 class="size-3.5 shrink-0" />
            General
          </button>
        </nav>
      </div>

      <!-- App Settings -->
      <div>
        <p class="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 mb-1.5">App Settings</p>
        <nav class="flex flex-col gap-0.5">
          <button
            class="flex items-center gap-2.5 px-2 py-1.5 rounded-lg text-[13px] transition-colors text-left w-full"
            :class="active === 'appearance'
              ? 'bg-accent text-accent-foreground font-medium'
              : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
            @click="setSection('appearance')"
          >
            <Palette class="size-3.5 shrink-0" />
            Appearance
          </button>
        </nav>
      </div>

    </aside>

    <!-- ── Content ── -->
    <main class="flex-1 overflow-y-auto px-10 py-8 bg-background">

      <!-- Profile -->
      <section v-if="active === 'profile'" class="max-w-xl flex flex-col gap-7">
        <div>
          <h1 class="text-[18px] font-semibold text-foreground">Profile</h1>
          <p class="text-[13px] text-muted-foreground mt-0.5">How you appear to your team.</p>
        </div>

        <div class="bg-card rounded-xl border border-border p-5 flex flex-col gap-5">
          <div class="flex items-center gap-4">
            <div class="size-14 rounded-full bg-muted border border-border flex items-center justify-center text-lg font-bold text-foreground select-none shrink-0">
              {{ initials }}
            </div>
            <div>
              <p class="text-[13px] font-medium text-foreground">{{ displayName || 'Your name' }}</p>
              <p class="text-[12px] text-muted-foreground mt-0.5">Avatar initials</p>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-foreground">Display name</label>
            <Input v-model="displayName" placeholder="Your name" class="max-w-sm" @keydown.enter="saveProfile" />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-foreground">Email</label>
            <Input :value="userEmail" disabled class="max-w-sm opacity-60 cursor-not-allowed" />
            <p class="text-[11.5px] text-muted-foreground">Email cannot be changed here.</p>
          </div>

          <div>
            <Button size="sm" @click="saveProfile">
              <Check v-if="profileSaved" class="size-3.5 mr-1.5" />
              {{ profileSaved ? 'Saved!' : 'Save changes' }}
            </Button>
          </div>
        </div>
      </section>

      <!-- Notifications -->
      <section v-else-if="active === 'notifications'" class="max-w-xl flex flex-col gap-7">
        <div>
          <h1 class="text-[18px] font-semibold text-foreground">Notifications</h1>
          <p class="text-[13px] text-muted-foreground mt-0.5">Manage how you receive updates.</p>
        </div>
        <div class="bg-card rounded-xl border border-border p-5">
          <p class="text-[13px] text-muted-foreground">Notification preferences coming soon.</p>
        </div>
      </section>

      <!-- General (org) -->
      <section v-else-if="active === 'general'" class="max-w-xl flex flex-col gap-7">
        <div class="flex items-start justify-between">
          <div>
            <h1 class="text-[18px] font-semibold text-foreground">General</h1>
            <p class="text-[13px] text-muted-foreground mt-0.5">Organization profile and settings.</p>
          </div>
          <button
            class="flex items-center gap-1.5 text-[12px] text-muted-foreground hover:text-foreground transition-colors"
            @click="copyOrgId"
          >
            <Check v-if="copied" class="size-3.5 text-green-500" />
            <Copy v-else class="size-3.5" />
            {{ copied ? 'Copied!' : 'Copy org ID' }}
          </button>
        </div>

        <div class="bg-card rounded-xl border border-border p-5 flex flex-col gap-5">
          <div class="flex items-center gap-4">
            <div
              class="size-14 rounded-xl flex items-center justify-center text-xl font-bold text-black select-none shrink-0"
              style="background:#C8E63C"
            >
              {{ (ctx?.org?.name ?? 'KC').slice(0, 2).toUpperCase() }}
            </div>
            <div>
              <p class="text-[13px] font-medium text-foreground">{{ ctx?.org?.name }}</p>
              <p class="text-[12px] text-muted-foreground mt-0.5 capitalize">{{ ctx?.member?.role }}</p>
            </div>
          </div>

          <Separator />

          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-foreground">Organization name</label>
            <p class="text-[11.5px] text-muted-foreground">How your organization name appears to members.</p>
            <Input :value="ctx?.org?.name ?? ''" disabled class="max-w-sm opacity-60 cursor-not-allowed" />
          </div>
        </div>
      </section>

      <!-- Appearance -->
      <section v-else-if="active === 'appearance'" class="max-w-xl flex flex-col gap-7">
        <div>
          <h1 class="text-[18px] font-semibold text-foreground">Appearance</h1>
          <p class="text-[13px] text-muted-foreground mt-0.5">Choose how KeepCabin looks for you.</p>
        </div>

        <div class="bg-card rounded-xl border border-border p-5 flex flex-col gap-5">
          <div class="flex items-center justify-between">
            <div>
              <p class="text-[13px] font-medium text-foreground">Theme</p>
              <p class="text-[12px] text-muted-foreground mt-0.5">{{ isDark ? 'Dark mode enabled' : 'Light mode enabled' }}</p>
            </div>
            <button
              class="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-border bg-muted text-[13px] font-medium text-foreground hover:bg-accent transition-colors"
              @click="toggle"
            >
              <Sun v-if="isDark" class="size-3.5" />
              <Moon v-else class="size-3.5" />
              {{ isDark ? 'Switch to Light' : 'Switch to Dark' }}
            </button>
          </div>

          <Separator />

          <!-- Theme preview cards — always static to show what each mode looks like -->
          <div class="grid grid-cols-2 gap-3">
            <!-- Light card -->
            <button
              class="flex flex-col gap-2.5 p-4 rounded-xl border-2 transition-all text-left"
              :class="!isDark ? 'border-foreground' : 'border-border hover:border-muted-foreground'"
              @click="isDark && toggle()"
            >
              <div class="w-full h-16 rounded-lg flex flex-col gap-1 p-2" style="background:#ffffff;border:1px solid #e5e7eb;box-shadow:0 1px 3px rgba(0,0,0,.06)">
                <div class="h-2 w-16 rounded" style="background:#e5e7eb" />
                <div class="h-1.5 w-10 rounded" style="background:#f3f4f6" />
                <div class="flex gap-1 mt-0.5">
                  <div class="h-5 w-5 rounded" style="background:#f3f4f6" />
                  <div class="flex-1 flex flex-col gap-0.5 justify-center">
                    <div class="h-1 rounded" style="background:#e5e7eb" />
                    <div class="h-1 w-2/3 rounded" style="background:#f3f4f6" />
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="size-3.5 rounded-full border-2 flex items-center justify-center"
                  :style="!isDark ? 'border-color:#111;background:#111' : 'border-color:#d1d5db;background:transparent'"
                >
                  <div v-if="!isDark" class="size-1.5 rounded-full bg-white" />
                </div>
                <span class="text-[12.5px] font-medium text-foreground">Light</span>
              </div>
            </button>

            <!-- Dark card -->
            <button
              class="flex flex-col gap-2.5 p-4 rounded-xl border-2 transition-all text-left"
              :class="isDark ? 'border-foreground' : 'border-border hover:border-muted-foreground'"
              @click="!isDark && toggle()"
            >
              <div class="w-full h-16 rounded-lg flex flex-col gap-1 p-2" style="background:#1a1a1a;border:1px solid #2c2c2c">
                <div class="h-2 w-16 rounded" style="background:#2c2c2c" />
                <div class="h-1.5 w-10 rounded" style="background:#252525" />
                <div class="flex gap-1 mt-0.5">
                  <div class="h-5 w-5 rounded" style="background:#252525" />
                  <div class="flex-1 flex flex-col gap-0.5 justify-center">
                    <div class="h-1 rounded" style="background:#2c2c2c" />
                    <div class="h-1 w-2/3 rounded" style="background:#222" />
                  </div>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <div
                  class="size-3.5 rounded-full border-2 flex items-center justify-center"
                  :style="isDark ? 'border-color:#111;background:#111' : 'border-color:#d1d5db;background:transparent'"
                >
                  <div v-if="isDark" class="size-1.5 rounded-full bg-white" />
                </div>
                <span class="text-[12.5px] font-medium text-foreground">Dark</span>
              </div>
            </button>
          </div>
        </div>
      </section>

    </main>
  </div>
</template>
