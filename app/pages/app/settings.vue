<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { Copy, Check, Eye, EyeOff, Trash2, User, ShieldCheck, CreditCard, Bell, Palette, Building2 } from '@lucide/vue'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx }  = useOrgContext()
const { isDark, toggle } = useTheme()
const { colorId, select: selectColor, clear: clearColor } = useAccentColor()

type Section = 'general' | 'security' | 'billing' | 'notifications' | 'appearance' | 'organization'
const activeSection = ref<Section>('general')
function setSection(id: string) { activeSection.value = id as Section }

const role = computed(() => ctx.value?.member?.role)

const allSections = [
  { id: 'general',       label: 'General',       icon: User        },
  { id: 'security',      label: 'Security',      icon: ShieldCheck },
  { id: 'billing',       label: 'Billing',       icon: CreditCard  },
  { id: 'notifications', label: 'Notifications', icon: Bell        },
  { id: 'appearance',    label: 'Appearance',    icon: Palette     },
  { id: 'organization',  label: 'Organization',  icon: Building2   },
]

const sections = computed(() =>
  allSections.filter(s => s.id !== 'organization' || role.value === 'owner')
)

// ── General / Profile ─────────────────────────────────────────────────────
const displayName = ref('')
const userEmail   = ref('')
const jobTitle    = ref('')
const department  = ref('')

const { register, unregister } = useSettingsBar()

async function saveChanges() {
  if (activeSection.value === 'general') {
    await supabase.auth.updateUser({ data: { full_name: displayName.value.trim() } })
  }
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  displayName.value = user?.user_metadata?.full_name ?? ''
  userEmail.value   = user?.email ?? ''
  register(saveChanges)
})

onUnmounted(unregister)

const initials = computed(() => {
  const n = displayName.value.trim()
  if (!n) return 'KC'
  return n.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
})

// ── Security ──────────────────────────────────────────────────────────────
const showCurrentPw = ref(false)
const newPassword   = ref('')
const twoFAEnabled  = ref(false)

const devices = ref([
  { id: '1', name: 'Safari on Mac OS X',  type: 'browser', current: true,  time: 'Current session' },
  { id: '2', name: 'Chrome on Windows',   type: 'browser', current: false, time: '1 day ago'        },
  { id: '3', name: 'Safari on iPhone',    type: 'mobile',  current: false, time: '1 month ago'      },
])

function removeDevice(id: string) {
  devices.value = devices.value.filter(d => d.id !== id)
}

// ── Billing ───────────────────────────────────────────────────────────────
const billingBannerDismissed = ref(false)

// ── Notifications ─────────────────────────────────────────────────────────
const notifList = ref([
  { key: 'submitted', label: 'Expense submitted', desc: 'When a new expense is submitted for your review.', on: true  },
  { key: 'approved',  label: 'Expense approved',  desc: 'When your expense is approved by a manager.',      on: true  },
  { key: 'rejected',  label: 'Expense rejected',  desc: 'When your expense is declined.',                   on: true  },
  { key: 'payment',   label: 'Payment processed', desc: 'When a payment has been marked as paid.',          on: false },
  { key: 'newmember', label: 'New team member',   desc: 'When someone joins your organization.',            on: false },
  { key: 'digest',    label: 'Weekly digest',     desc: 'A weekly summary of expense activity.',            on: false },
])

function toggleNotif(key: string) {
  const item = notifList.value.find(n => n.key === key)
  if (item) item.on = !item.on
}

// ── Org ───────────────────────────────────────────────────────────────────
const copied = ref(false)
function copyOrgId() {
  if (!ctx.value?.org?.id) return
  navigator.clipboard.writeText(ctx.value.org.id)
  copied.value = true
  setTimeout(() => { copied.value = false }, 2000)
}

const showDeleteOrgDialog = ref(false)
const deleteOrgConfirmName  = ref('')
const deletingOrg = ref(false)

const deleteOrgConfirmMatch = computed(() =>
  deleteOrgConfirmName.value.trim() === (ctx.value?.org?.name ?? '').trim()
)

async function deleteOrg() {
  if (!deleteOrgConfirmMatch.value || deletingOrg.value) return
  deletingOrg.value = true
  // TODO: call your org-deletion API here
  deletingOrg.value = false
  showDeleteOrgDialog.value = false
}
</script>

<template>
  <div class="-m-6 flex h-full overflow-hidden" style="justify-content: center;">

    <!-- ── Left nav ──────────────────────────────────────────────────────── -->
    <aside class="w-52 shrink-0 flex flex-col py-4 px-10 overflow-y-auto bg-background">
      <p class="text-[13px] font-semibold text-foreground mb-4 px-3">Settings</p>
      <nav class="flex flex-col gap-0.5">
        <button
          v-for="s in sections"
          :key="s.id"
          class="flex items-center gap-2 h-8 text-[13px] rounded-lg px-3 transition-colors text-left w-full"
          :class="activeSection === s.id
            ? 'bg-accent text-foreground font-medium'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent/50'"
          @click="setSection(s.id)"
        >
          <component :is="s.icon" class="size-[14px] shrink-0" />
          {{ s.label }}
        </button>
      </nav>
    </aside>

    <!-- ── Right content ─────────────────────────────────────────────────── -->
    <div class="flex-1 overflow-y-auto bg-background max-w-4xl">
      <div class="max-w-4xl px-10 py-4">

        <!-- ════════════════════════════════════════════════════════════════
             GENERAL
        ═══════════════════════════════════════════════════════════════ -->
        <template v-if="activeSection === 'general'">
          <div class="mb-6">
            <h1 class="text-[16px] font-semibold text-foreground">General</h1>
            <p class="text-[12.5px] text-muted-foreground mt-0.5">Manage your profile and account details.</p>
          </div>
          <Separator class="mb-0" />

          <div class="flex items-start gap-20 py-5 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Profile photo</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Upload a profile picture that will be shown across the app — on your profile, in team listings, and beside your activity.</p>
            </div>
            <div class="flex items-center gap-4 flex-1">
              <div class="size-[60px] rounded-xl bg-muted border border-border flex items-center justify-center text-base font-bold text-foreground select-none shrink-0">
                {{ initials }}
              </div>
              <div class="flex flex-col gap-1.5">
                <Button variant="outline" size="sm" class="text-[12px] gap-1.5 h-7">
                  <svg class="size-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Upload photo
                </Button>
                <Button variant="ghost" size="sm" class="text-[12px] h-7 text-destructive hover:text-destructive hover:bg-destructive/8">Remove</Button>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-20 py-4 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Full name</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Your full name as it appears to teammates, in expense reports, and in approval workflows.</p>
            </div>
            <div class="flex-1"><Input v-model="displayName" placeholder="Your full name" class="h-8 text-[13px]" /></div>
          </div>

          <div class="flex items-start gap-20 py-4 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Email</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">The email address associated with your account. Used for sign-in and notifications. Contact your admin to change it.</p>
            </div>
            <div class="flex-1"><Input v-model="userEmail" disabled class="h-8 text-[13px] opacity-60 cursor-not-allowed" /></div>
          </div>

          <div class="flex items-start gap-20 py-4 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Job title</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Your current role or position within the company. Shown on your profile and helps teammates understand your responsibilities.</p>
            </div>
            <div class="flex-1"><Input v-model="jobTitle" placeholder="e.g. Finance Manager" class="h-8 text-[13px]" /></div>
          </div>

          <div class="flex items-start gap-20 py-4">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Department</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">The team or department you belong to. Used to group expense reports and set the right approval hierarchy for your submissions.</p>
            </div>
            <div class="flex-1"><Input v-model="department" placeholder="e.g. Engineering" class="h-8 text-[13px]" /></div>
          </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════════
             SECURITY
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'security'">
          <div class="mb-6">
            <h1 class="text-[16px] font-semibold text-foreground">Security</h1>
            <p class="text-[12.5px] text-muted-foreground mt-0.5">Manage your account security and devices.</p>
          </div>
          <Separator class="mb-0" />

          <div class="flex items-start gap-20 py-5 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Password</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Set a strong password to keep your account secure. We recommend at least 12 characters with a mix of letters, numbers, and symbols.</p>
            </div>
            <div class="flex-1 flex flex-col gap-3">
              <div>
                <label class="text-[11px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">Current password</label>
                <div class="relative">
                  <Input :type="showCurrentPw ? 'text' : 'password'" value="securepassword123" readonly class="pr-9 h-8 text-[13px]" />
                  <button class="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" @click="showCurrentPw = !showCurrentPw">
                    <EyeOff v-if="showCurrentPw" class="size-3.5" />
                    <Eye v-else class="size-3.5" />
                  </button>
                </div>
                <div class="flex items-center gap-1.5 mt-1.5">
                  <svg class="size-3 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span class="text-[11.5px] text-emerald-600 dark:text-emerald-400 font-medium">Very secure</span>
                </div>
              </div>
              <div>
                <label class="text-[11px] font-medium text-muted-foreground mb-1 block uppercase tracking-wide">New password</label>
                <div class="flex gap-2">
                  <Input v-model="newPassword" type="password" placeholder="Enter new password" class="flex-1 h-8 text-[13px]" />
                  <Button variant="outline" size="sm" class="text-[12px] whitespace-nowrap h-8 shrink-0">Save new password</Button>
                </div>
              </div>
            </div>
          </div>

          <div class="flex items-start gap-20 py-5 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Two-step verification</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Add an extra layer of security by requiring a one-time verification code each time you sign in. Strongly recommended for all accounts.</p>
            </div>
            <div class="flex-1 flex items-center gap-3 pt-0.5">
              <button
                class="relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
                :class="twoFAEnabled ? 'bg-primary' : 'bg-input'"
                @click="twoFAEnabled = !twoFAEnabled"
              >
                <span class="pointer-events-none inline-block size-[14px] rounded-full bg-white shadow-sm transition-transform duration-200" :class="twoFAEnabled ? 'translate-x-[14px]' : 'translate-x-0'" />
              </button>
              <span class="text-[12.5px]" :class="twoFAEnabled ? 'text-foreground' : 'text-muted-foreground'">
                {{ twoFAEnabled ? 'Enabled' : 'Disabled' }}
              </span>
            </div>
          </div>

          <div class="py-5">
            <p class="text-[14px] font-semibold text-foreground">Browsers and devices</p>
            <p class="text-[12px] text-muted-foreground mt-0.5 mb-4">Devices currently signed in to your account.</p>
            <div class="flex flex-col border border-border rounded-xl overflow-hidden">
              <div
                v-for="(device, idx) in devices"
                :key="device.id"
                class="flex items-center gap-3 px-4 py-3 group transition-colors hover:bg-muted/40"
                :class="idx < devices.length - 1 ? 'border-b border-border' : ''"
              >
                <div class="size-8 rounded-lg border border-border bg-muted flex items-center justify-center shrink-0">
                  <svg v-if="device.type === 'mobile'" class="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2"/><line x1="12" y1="18" x2="12.01" y2="18" stroke-width="2"/></svg>
                  <svg v-else class="size-3.5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg>
                </div>
                <p class="text-[12.5px] font-medium text-foreground flex-1 min-w-0 truncate">{{ device.name }}</p>
                <span class="text-[11.5px] text-muted-foreground shrink-0">🌏 India</span>
                <span class="text-[11.5px] shrink-0 w-28 text-right" :class="device.current ? 'text-emerald-600 dark:text-emerald-400 font-medium' : 'text-muted-foreground'">{{ device.time }}</span>
                <button class="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-all ml-1 shrink-0" @click="removeDevice(device.id)">
                  <Trash2 class="size-3.5" />
                </button>
              </div>
            </div>
          </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════════
             BILLING
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'billing'">
          <div class="mb-6">
            <h1 class="text-[16px] font-semibold text-foreground">Billing</h1>
            <p class="text-[12.5px] text-muted-foreground mt-0.5">Manage your subscription and payment details.</p>
          </div>
          <Separator class="mb-5" />

          <div v-if="!billingBannerDismissed" class="flex items-center gap-4 px-4 py-3.5 mb-6 rounded-xl border border-border bg-muted/40">
            <div class="shrink-0 size-10 relative">
              <svg class="size-10 -rotate-90" viewBox="0 0 36 36">
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-border" />
                <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-primary" stroke-dasharray="97.4 97.4" stroke-dashoffset="19.5" stroke-linecap="round" />
              </svg>
              <span class="absolute inset-0 flex items-center justify-center text-[8.5px] font-bold text-foreground">8/10</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-foreground">You've used 8 out of 10 available seats</p>
              <p class="text-[12px] text-muted-foreground mt-0.5">Upgrade to a business plan to unlock up to 32 team members and 1 TB bandwidth.</p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              <Button variant="outline" size="sm" class="text-[12px]" @click="billingBannerDismissed = true">Dismiss</Button>
              <Button size="sm" class="text-[12px]">Upgrade plan</Button>
            </div>
          </div>

          <div class="flex items-start gap-20 py-5 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Current plan</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Your active subscription tier. Upgrading unlocks more seats, higher storage limits, and advanced reporting features.</p>
            </div>
            <div class="flex-1 flex items-center justify-between">
              <div>
                <div class="flex items-center gap-2">
                  <p class="text-[13px] font-semibold text-foreground">Free</p>
                  <Badge variant="secondary" class="text-[10.5px] px-1.5">Current</Badge>
                </div>
                <p class="text-[12px] text-muted-foreground mt-0.5">Up to 10 members, 3 teams.</p>
              </div>
              <Button size="sm" class="text-[12px]">Upgrade to Premium</Button>
            </div>
          </div>

          <div class="flex items-start gap-20 py-5 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Seats used</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">The number of active members currently occupying seats in your organization. Upgrade your plan to add more members.</p>
            </div>
            <div class="flex-1">
              <div class="flex items-center justify-between mb-2">
                <span class="text-[12.5px] text-foreground font-medium">8 of 10 seats used</span>
                <span class="text-[12px] text-muted-foreground">80%</span>
              </div>
              <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                <div class="h-full bg-primary rounded-full" style="width:80%" />
              </div>
            </div>
          </div>

          <div class="py-10 flex flex-col items-center justify-center gap-3 text-center">
            <div class="size-10 rounded-xl bg-muted flex items-center justify-center">
              <svg class="size-5 text-muted-foreground" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
            </div>
            <p class="text-[13px] font-semibold text-foreground">No billing history</p>
            <p class="text-[12px] text-muted-foreground">Invoices will appear here after your first payment.</p>
          </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════════
             NOTIFICATIONS
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'notifications'">
          <div class="mb-6">
            <h1 class="text-[16px] font-semibold text-foreground">Notifications</h1>
            <p class="text-[12.5px] text-muted-foreground mt-0.5">Choose how you receive updates from KeepCabin.</p>
          </div>
          <Separator class="mb-0" />

          <div v-for="item in notifList" :key="item.key" class="flex items-center gap-20 py-4 border-b border-dashed border-border last:border-0">
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-foreground">{{ item.label }}</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5">{{ item.desc }}</p>
            </div>
            <button
              class="relative inline-flex h-[18px] w-8 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200"
              :class="item.on ? 'bg-primary' : 'bg-input'"
              @click="toggleNotif(item.key)"
            >
              <span class="pointer-events-none inline-block size-[14px] rounded-full bg-white shadow-sm transition-transform duration-200" :class="item.on ? 'translate-x-[14px]' : 'translate-x-0'" />
            </button>
          </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════════
             APPEARANCE
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'appearance'">
          <div class="mb-6">
            <h1 class="text-[16px] font-semibold text-foreground">Appearance</h1>
            <p class="text-[12.5px] text-muted-foreground mt-0.5">Choose how KeepCabin looks for you.</p>
          </div>
          <Separator class="mb-0" />

          <!-- Theme -->
          <div class="flex items-start gap-20 py-5 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Theme</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Choose between light and dark mode. Your preference is saved and applied automatically every time you sign in.</p>
            </div>
            <div class="flex gap-3 flex-1">
              <button
                class="flex flex-col gap-2.5 p-3 rounded-xl border-2 transition-all text-left flex-1"
                :class="!isDark ? 'border-foreground' : 'border-border hover:border-muted-foreground/50'"
                @click="isDark && toggle()"
              >
                <div class="w-full h-16 rounded-lg flex flex-col gap-1.5 p-2.5 overflow-hidden" style="background:#f8f8f8;border:1px solid #e5e7eb">
                  <div class="flex gap-1"><div class="size-1.5 rounded-full" style="background:#fc5f57" /><div class="size-1.5 rounded-full" style="background:#febc2e" /><div class="size-1.5 rounded-full" style="background:#28c840" /></div>
                  <div class="h-1.5 w-14 rounded" style="background:#e0e0e0" />
                  <div class="flex gap-1 mt-0.5"><div class="h-5 w-5 rounded" style="background:#ebebeb" /><div class="flex-1 flex flex-col gap-1 justify-center"><div class="h-1 rounded" style="background:#e0e0e0" /><div class="h-1 w-3/4 rounded" style="background:#ebebeb" /></div></div>
                </div>
                <div class="flex items-center justify-between px-0.5">
                  <p class="text-[12px] font-medium text-foreground">Light</p>
                  <div class="size-3.5 rounded-full border-2 flex items-center justify-center" :class="!isDark ? 'border-foreground bg-foreground' : 'border-muted-foreground/40'">
                    <div v-if="!isDark" class="size-1.5 rounded-full bg-background" />
                  </div>
                </div>
              </button>
              <button
                class="flex flex-col gap-2.5 p-3 rounded-xl border-2 transition-all text-left flex-1"
                :class="isDark ? 'border-foreground' : 'border-border hover:border-muted-foreground/50'"
                @click="!isDark && toggle()"
              >
                <div class="w-full h-16 rounded-lg flex flex-col gap-1.5 p-2.5 overflow-hidden" style="background:#1a1a1a;border:1px solid #2c2c2c">
                  <div class="flex gap-1"><div class="size-1.5 rounded-full" style="background:#fc5f57" /><div class="size-1.5 rounded-full" style="background:#febc2e" /><div class="size-1.5 rounded-full" style="background:#28c840" /></div>
                  <div class="h-1.5 w-14 rounded" style="background:#2c2c2c" />
                  <div class="flex gap-1 mt-0.5"><div class="h-5 w-5 rounded" style="background:#252525" /><div class="flex-1 flex flex-col gap-1 justify-center"><div class="h-1 rounded" style="background:#2c2c2c" /><div class="h-1 w-3/4 rounded" style="background:#222" /></div></div>
                </div>
                <div class="flex items-center justify-between px-0.5">
                  <p class="text-[12px] font-medium text-foreground">Dark</p>
                  <div class="size-3.5 rounded-full border-2 flex items-center justify-center" :class="isDark ? 'border-foreground bg-foreground' : 'border-muted-foreground/40'">
                    <div v-if="isDark" class="size-1.5 rounded-full bg-background" />
                  </div>
                </div>
              </button>
            </div>
          </div>

          <!-- Accent color -->
          <div class="flex items-start gap-20 py-5 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Accent color</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Personalise your interface by picking an accent color. Applied to buttons, active states, and links across the entire app. Saved to your account.</p>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2.5 flex-wrap">
                <button
                  v-for="c in ACCENT_COLORS"
                  :key="c.id"
                  class="relative size-7 rounded-full transition-all duration-150 focus:outline-none hover:scale-110"
                  :style="{ background: c.hex }"
                  :title="c.label"
                  @click="selectColor(c.id)"
                >
                  <span
                    v-if="colorId === c.id"
                    class="absolute inset-0 rounded-full ring-2 ring-offset-2 ring-foreground ring-offset-background pointer-events-none"
                  />
                  <svg v-if="colorId === c.id" class="absolute inset-0 m-auto size-3.5 text-white drop-shadow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </button>
              </div>
              <p class="text-[11.5px] text-muted-foreground mt-3">
                Currently: <span class="text-foreground font-medium">{{ ACCENT_COLORS.find(c => c.id === colorId)?.label ?? 'Blue' }}</span>
              </p>
            </div>
          </div>

          <!-- Reset to defaults -->
          <div class="flex items-start gap-20 py-5">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Reset appearance</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Switch to the opposite theme and remove any custom accent color, restoring the interface to its original default look.</p>
            </div>
            <div class="flex-1">
              <Button
                variant="outline"
                size="sm"
                class="text-[12.5px] gap-2"
                @click="toggle(); clearColor()"
              >
                <svg class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                  <path d="M3 3v5h5"/>
                </svg>
                Reset theme
              </Button>
            </div>
          </div>
        </template>

        <!-- ════════════════════════════════════════════════════════════════
             ORGANIZATION
        ═══════════════════════════════════════════════════════════════ -->
        <template v-else-if="activeSection === 'organization'">
          <div class="flex items-start justify-between mb-6">
            <div>
              <h1 class="text-[16px] font-semibold text-foreground">Organization</h1>
              <p class="text-[12.5px] text-muted-foreground mt-0.5">Manage your organization settings.</p>
            </div>
            <button class="flex items-center gap-1.5 text-[11.5px] text-muted-foreground hover:text-foreground transition-colors mt-1" @click="copyOrgId">
              <Check v-if="copied" class="size-3 text-emerald-500" />
              <Copy v-else class="size-3" />
              {{ copied ? 'Copied!' : 'Copy org ID' }}
            </button>
          </div>
          <Separator class="mb-0" />

          <div class="flex items-start gap-20 py-4 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Organization name</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">The name of your organization as it appears across KeepCabin. Visible to all members. Contact an owner to update it.</p>
            </div>
            <div class="flex-1"><Input :model-value="ctx?.org?.name ?? ''" disabled class="h-8 text-[13px] opacity-60 cursor-not-allowed" /></div>
          </div>

          <div class="flex items-start gap-20 py-4 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Your role</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Your current permission level in this organization. Roles control what you can view, approve, and manage. Only an owner can change your role.</p>
            </div>
            <Badge variant="secondary" class="capitalize text-[11.5px] mt-0.5">{{ ctx?.member?.role }}</Badge>
          </div>

          <!-- Danger zone -->
          <div class="mt-8 rounded-xl border border-destructive/30 overflow-hidden">
            <div class="bg-destructive/5 px-5 py-3 border-b border-destructive/20">
              <p class="text-[12px] font-semibold text-destructive tracking-wide uppercase">Danger Zone</p>
            </div>
            <div class="flex items-start gap-20 px-5 py-5">
              <div class="w-[300px] shrink-0">
                <p class="text-[13px] font-medium text-foreground">Delete organization</p>
                <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">
                  Permanently delete <span class="font-medium text-foreground">{{ ctx?.org?.name }}</span> and all associated data — members, teams, expenses, and reports. This action cannot be undone and all members will immediately lose access.
                </p>
              </div>
              <div class="flex-1 flex flex-col gap-2 pt-0.5">
                <Button variant="destructive" size="sm" class="h-8 text-[12.5px] w-fit" @click="showDeleteOrgDialog = true">
                  Delete organization
                </Button>
                <p class="text-[11px] text-muted-foreground">Only organization owners can perform this action.</p>
              </div>
            </div>
          </div>
        </template>

        <!-- Delete org confirmation dialog -->
        <Dialog v-model:open="showDeleteOrgDialog">
          <DialogContent class="max-w-md">
            <DialogHeader>
              <DialogTitle class="text-[15px]">Delete organization</DialogTitle>
              <DialogDescription class="text-[12.5px] leading-relaxed">
                This will permanently delete <span class="font-semibold text-foreground">{{ ctx?.org?.name }}</span> and all of its data including members, teams, expense records, and reports. This action <span class="font-semibold text-foreground">cannot be undone</span>.
              </DialogDescription>
            </DialogHeader>
            <div class="mt-1 flex flex-col gap-3">
              <div class="rounded-lg bg-destructive/8 border border-destructive/20 px-4 py-3 text-[12px] text-destructive leading-relaxed">
                <p class="font-semibold mb-1">What will be deleted:</p>
                <ul class="list-disc list-inside space-y-0.5 text-destructive/80">
                  <li>All members and their access</li>
                  <li>All teams and team configurations</li>
                  <li>All expense submissions and history</li>
                  <li>All reports and approval records</li>
                  <li>Billing subscription and invoices</li>
                </ul>
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[12px] text-muted-foreground">
                  Type <span class="font-semibold text-foreground">{{ ctx?.org?.name }}</span> to confirm:
                </label>
                <Input v-model="deleteOrgConfirmName" placeholder="Organization name" class="h-8 text-[13px]" />
              </div>
            </div>
            <DialogFooter class="mt-1 gap-2">
              <Button variant="outline" size="sm" class="h-8 text-[12.5px]" @click="showDeleteOrgDialog = false; deleteOrgConfirmName = ''">
                Cancel
              </Button>
              <Button variant="destructive" size="sm" class="h-8 text-[12.5px]" :disabled="!deleteOrgConfirmMatch || deletingOrg" @click="deleteOrg">
                {{ deletingOrg ? 'Deleting…' : 'Delete organization' }}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>

  </div>
</template>
