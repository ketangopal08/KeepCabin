<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { Copy, Check, Eye, EyeOff, Trash2, User, ShieldCheck, CreditCard, Bell, Palette, Building2 } from '@lucide/vue'
import { PLANS } from '~~/lib/plans'
import { toast } from 'vue-sonner'
import { nextPayoutDate } from '~~/lib/payouts'
import type { PayoutSchedule } from '~~/lib/payouts'

definePageMeta({ layout: 'app', middleware: 'auth' })

const supabase = useSupabase()
const { ctx, load: loadOrgContext, clear: clearOrgContext }  = useOrgContext()
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
  avatarUrl.value   = user?.user_metadata?.avatar_url ?? ''
  register(saveChanges)
})

onUnmounted(unregister)

const initials = computed(() => {
  const n = displayName.value.trim()
  if (!n) return 'KC'
  return n.split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()
})

// ── Profile photo ─────────────────────────────────────────────────────────
const avatarUrl     = ref('')
const avatarInput   = ref<HTMLInputElement | null>(null)
const avatarBusy    = ref(false)

async function avatarAuthHeaders(): Promise<Record<string, string>> {
  const { data: { session } } = await supabase.auth.getSession()
  return session ? { Authorization: `Bearer ${session.access_token}` } : {}
}

async function onAvatarSelected(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = ''
  if (!file) return
  if (!file.type.startsWith('image/')) { toast.error('Please choose an image file.'); return }
  if (file.size > 2 * 1024 * 1024) { toast.error('Image must be 2 MB or smaller.'); return }
  avatarBusy.value = true
  try {
    const form = new FormData()
    form.append('file', file)
    const res = await $fetch<{ avatarUrl: string }>('/api/profile/avatar' as string, {
      method: 'POST', headers: await avatarAuthHeaders(), body: form,
    })
    avatarUrl.value = res.avatarUrl
    await supabase.auth.refreshSession()
    toast.success('Profile photo updated')
  } catch (err: any) {
    toast.error(err?.data?.message ?? 'Could not upload photo')
  } finally {
    avatarBusy.value = false
  }
}

async function removeAvatar() {
  if (!avatarUrl.value) return
  avatarBusy.value = true
  try {
    await $fetch('/api/profile/avatar' as string, { method: 'DELETE', headers: await avatarAuthHeaders() })
    avatarUrl.value = ''
    await supabase.auth.refreshSession()
    toast.success('Profile photo removed')
  } catch (err: any) {
    toast.error(err?.data?.message ?? 'Could not remove photo')
  } finally {
    avatarBusy.value = false
  }
}

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
const { billing, loading: billingLoading, load: loadBilling, cancel: cancelSubscription } = useBilling()

type Invoice = { id: string; date: string | null; amount: number; status: string; url: string | null }
const invoices = ref<Invoice[]>([])
const invoicesLoading = ref(false)
const cancelOpen = ref(false)
const cancelling = ref(false)

const isOwner = computed(() => role.value === 'owner')
const planName = computed(() => (billing.value ? PLANS[billing.value.plan].name : ''))
const isPaid = computed(() => !!billing.value && !billing.value.trial && billing.value.plan !== 'free')

const fmtDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : ''
const fmtInr = (paise: number) => `₹${(paise / 100).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

const planSummary = computed(() => {
  const b = billing.value
  if (!b) return ''
  if (b.trial) return `Pro trial · ends ${fmtDate(b.trialEndsAt)}`
  if (b.plan === 'free') return 'Free forever'
  if (b.pendingPlan) return `Switching to ${PLANS[b.pendingPlan].name} on ${fmtDate(b.currentPeriodEnd)}`
  if (b.cancelAtPeriodEnd || b.status === 'cancelled') return `Cancelled · active until ${fmtDate(b.currentPeriodEnd)}`
  if (b.status === 'past_due') return 'Payment failed — Razorpay is retrying'
  return `Billed ${b.interval} · renews ${fmtDate(b.currentPeriodEnd)}`
})

const usageRows = computed(() => {
  const b = billing.value
  if (!b) return []
  return [
    { label: 'Members', desc: 'Members plus pending invites. Each plan has a member limit.', used: b.usage.members + b.usage.pendingInvites, cap: b.limits.members },
    { label: 'Teams', desc: 'Teams in your organization, including Finance.', used: b.usage.teams, cap: b.limits.teams },
    { label: 'Expenses this month', desc: 'Expenses submitted this calendar month (IST). Resets on the 1st.', used: b.usage.expensesThisMonth, cap: b.limits.expensesPerMonth },
  ]
})
const pctOf = (used: number, cap: number | null) => (cap ? Math.min(100, Math.round((used / cap) * 100)) : 0)

// Banner: the most-used limit, shown when it's at 80% or more.
const tightest = computed(() =>
  usageRows.value
    .filter(r => r.cap !== null)
    .map(r => ({ ...r, pct: pctOf(r.used, r.cap) }))
    .sort((a, b) => b.pct - a.pct)[0] ?? null,
)
const showLimitBanner = computed(() => !billingBannerDismissed.value && !!tightest.value && tightest.value.pct >= 80)

async function loadInvoices() {
  if (!isOwner.value || !isPaid.value) { invoices.value = []; return }
  invoicesLoading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    invoices.value = await $fetch<Invoice[]>('/api/billing/invoices' as string, {
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
    })
  } catch {
    invoices.value = []
  } finally {
    invoicesLoading.value = false
  }
}

async function confirmCancel() {
  cancelling.value = true
  try { await cancelSubscription() } finally { cancelling.value = false; cancelOpen.value = false }
}

watch(activeSection, async (s) => {
  if (s !== 'billing') return
  await loadBilling()
  loadInvoices()
}, { immediate: true })

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
// ── Payout schedule (owner) ───────────────────────────────────────────────
const PAYOUT_OPTIONS: { value: PayoutSchedule; label: string }[] = [
  { value: 'semi_monthly', label: 'Twice a month — 15th & last day' },
  { value: 'monthly',      label: 'Monthly — last day' },
  { value: 'weekly',       label: 'Weekly — every Friday' },
]
const payoutSchedule = ref<PayoutSchedule>('semi_monthly')
const payoutSaving = ref(false)
watch(() => ctx.value?.org?.payout_schedule, (v) => { if (v) payoutSchedule.value = v }, { immediate: true })
const nextPayoutLabel = computed(() =>
  new Date(`${nextPayoutDate(payoutSchedule.value, new Date())}T00:00:00Z`)
    .toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }),
)
async function setPayoutSchedule(value: PayoutSchedule) {
  if (value === payoutSchedule.value || payoutSaving.value) return
  const previous = payoutSchedule.value
  payoutSchedule.value = value
  payoutSaving.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/orgs/payout-schedule' as string, {
      method: 'PATCH',
      headers: session ? { Authorization: `Bearer ${session.access_token}` } : {},
      body: { schedule: value },
    })
    // Refresh the cached org context so the new schedule survives navigating away and back
    clearOrgContext()
    await loadOrgContext()
    toast.success('Payout schedule updated')
  } catch (e: any) {
    payoutSchedule.value = previous
    toast.error(e?.data?.message ?? 'Could not update payout schedule')
  } finally {
    payoutSaving.value = false
  }
}

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
  <div class="-m-6 flex h-full overflow-hidden">
    <div class="w-full max-w-5xl mx-auto flex h-full overflow-hidden">

    <!-- ── Left nav ──────────────────────────────────────────────────────── -->
    <aside class="w-52 shrink-0 flex flex-col py-4 pr-10 overflow-y-auto bg-background">
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
              <input ref="avatarInput" type="file" accept="image/png,image/jpeg,image/webp,image/gif" class="hidden" @change="onAvatarSelected" />
              <Button
                variant="ghost"
                class="group relative size-16 shrink-0 overflow-hidden rounded-full border border-border bg-muted p-0 text-lg font-semibold text-foreground hover:bg-muted"
                :disabled="avatarBusy"
                aria-label="Change profile photo"
                @click="avatarInput?.click()"
              >
                <img v-if="avatarUrl" :src="avatarUrl" alt="Profile photo" class="size-full object-cover" />
                <span v-else class="select-none">{{ initials }}</span>
                <span
                  class="absolute inset-0 flex items-center justify-center bg-black/50 text-white transition-opacity"
                  :class="avatarBusy ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'"
                >
                  <Icon v-if="avatarBusy" name="solar:refresh-linear" class="size-5 animate-spin" />
                  <Icon v-else name="solar:camera-linear" class="size-5" />
                </span>
              </Button>
              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  <Button variant="outline" size="sm" class="h-8 gap-1.5 text-[12px]" :disabled="avatarBusy" @click="avatarInput?.click()">
                    <Icon name="solar:upload-minimalistic-linear" class="size-3.5" />
                    {{ avatarBusy ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo' }}
                  </Button>
                  <Button
                    v-if="avatarUrl"
                    variant="ghost"
                    size="sm"
                    class="h-8 text-[12px] text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                    :disabled="avatarBusy"
                    @click="removeAvatar"
                  >
                    Remove
                  </Button>
                </div>
                <p class="text-[11.5px] text-muted-foreground">PNG, JPG, WebP or GIF · max 2 MB</p>
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

          <div v-if="billingLoading && !billing" class="flex flex-col gap-3">
            <Skeleton class="h-16 w-full rounded-xl" />
            <Skeleton class="h-16 w-full rounded-xl" />
            <Skeleton class="h-16 w-full rounded-xl" />
          </div>

          <template v-else-if="billing">
            <!-- Limit banner (most-used limit at 80%+) -->
            <div v-if="showLimitBanner && tightest" class="flex items-center gap-4 px-4 py-3.5 mb-6 rounded-xl border border-border bg-muted/40">
              <div class="shrink-0 size-10 relative">
                <svg class="size-10 -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3" class="text-border" />
                  <circle
                    cx="18" cy="18" r="15.5" fill="none" stroke="currentColor" stroke-width="3"
                    :class="tightest.pct >= 100 ? 'text-destructive' : 'text-primary'"
                    stroke-dasharray="97.4 97.4" :stroke-dashoffset="97.4 - (97.4 * tightest.pct) / 100" stroke-linecap="round"
                  />
                </svg>
                <span class="absolute inset-0 flex items-center justify-center text-[8.5px] font-bold text-foreground">{{ tightest.used }}/{{ tightest.cap }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-semibold text-foreground">
                  <template v-if="tightest.pct >= 100">You've reached your {{ tightest.label.toLowerCase() }} limit</template>
                  <template v-else>You've used {{ tightest.used }} of {{ tightest.cap }} {{ tightest.label.toLowerCase() }}</template>
                </p>
                <p class="text-[12px] text-muted-foreground mt-0.5">Upgrade your plan to raise your limits. Nothing is deleted when you're over a limit.</p>
              </div>
              <div class="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" class="text-[12px]" @click="billingBannerDismissed = true">Dismiss</Button>
                <Button size="sm" class="text-[12px]" as-child><NuxtLink to="/app/upgrade">Upgrade plan</NuxtLink></Button>
              </div>
            </div>

            <!-- Current plan -->
            <div class="flex items-start gap-20 py-5 border-b border-dashed border-border">
              <div class="w-[300px] shrink-0">
                <p class="text-[13px] font-medium text-foreground">Current plan</p>
                <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">Your workspace's subscription. Prices exclude 18% GST, which is added at checkout.</p>
              </div>
              <div class="flex-1 flex items-center justify-between gap-4">
                <div>
                  <div class="flex items-center gap-2">
                    <p class="text-[13px] font-semibold text-foreground">{{ planName }}</p>
                    <Icon v-if="billing.plan !== 'free'" name="solar:crown-linear" class="size-3.5 text-amber-500" />
                    <Badge v-if="billing.trial" variant="secondary" class="text-[10.5px] px-1.5">Trial</Badge>
                    <Badge v-else-if="billing.status === 'past_due'" variant="destructive" class="text-[10.5px] px-1.5">Payment failed</Badge>
                    <Badge v-else variant="secondary" class="text-[10.5px] px-1.5">Current</Badge>
                  </div>
                  <p class="text-[12px] text-muted-foreground mt-0.5">{{ planSummary }}</p>
                </div>
                <div class="flex items-center gap-2 shrink-0">
                  <Button
                    v-if="isOwner && isPaid && billing.plan !== 'enterprise' && !billing.cancelAtPeriodEnd && billing.status !== 'cancelled'"
                    variant="outline" size="sm" class="text-[12px]" @click="cancelOpen = true"
                  >
                    Cancel
                  </Button>
                  <Button size="sm" class="text-[12px]" as-child>
                    <NuxtLink to="/app/upgrade">{{ isPaid ? 'Change plan' : 'Upgrade plan' }}</NuxtLink>
                  </Button>
                </div>
              </div>
            </div>

            <!-- Usage -->
            <div v-for="r in usageRows" :key="r.label" class="flex items-start gap-20 py-5 border-b border-dashed border-border">
              <div class="w-[300px] shrink-0">
                <p class="text-[13px] font-medium text-foreground">{{ r.label }}</p>
                <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">{{ r.desc }}</p>
              </div>
              <div class="flex-1">
                <div class="flex items-center justify-between mb-2">
                  <span class="text-[12.5px] text-foreground font-medium">
                    {{ r.cap === null ? `${r.used} · Unlimited` : `${r.used} of ${r.cap} used` }}
                  </span>
                  <span v-if="r.cap !== null" class="text-[12px] text-muted-foreground">{{ pctOf(r.used, r.cap) }}%</span>
                </div>
                <div class="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    class="h-full rounded-full"
                    :class="r.cap !== null && r.used >= r.cap ? 'bg-destructive' : 'bg-primary'"
                    :style="{ width: r.cap === null ? '0%' : `${pctOf(r.used, r.cap)}%` }"
                  />
                </div>
              </div>
            </div>

            <!-- Billing history -->
            <div class="py-5">
              <p class="text-[13px] font-medium text-foreground mb-3">Billing history</p>
              <Skeleton v-if="invoicesLoading" class="h-24 w-full rounded-xl" />
              <AppTableCard v-else-if="invoices.length">
                <Table>
                  <TableHeader>
                    <TableRow class="hover:bg-transparent">
                      <TableHead>Date</TableHead>
                      <TableHead>Amount</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead class="text-right">Invoice</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow v-for="inv in invoices" :key="inv.id">
                      <TableCell class="text-[12.5px]">{{ fmtDate(inv.date) }}</TableCell>
                      <TableCell class="text-[12.5px] tabular-nums">{{ fmtInr(inv.amount) }}</TableCell>
                      <TableCell>
                        <Badge :variant="inv.status === 'paid' ? 'secondary' : 'outline'" class="text-[10.5px] capitalize">{{ inv.status }}</Badge>
                      </TableCell>
                      <TableCell class="text-right">
                        <Button v-if="inv.url" variant="link" size="sm" class="h-auto p-0 text-[12px]" as-child>
                          <a :href="inv.url" target="_blank" rel="noopener">View</a>
                        </Button>
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>
              </AppTableCard>
              <div v-else class="py-8 flex flex-col items-center justify-center gap-3 text-center">
                <div class="size-10 rounded-xl bg-muted flex items-center justify-center">
                  <CreditCard class="size-5 text-muted-foreground" />
                </div>
                <p class="text-[13px] font-semibold text-foreground">No billing history</p>
                <p class="text-[12px] text-muted-foreground">
                  {{ isOwner ? 'Invoices will appear here after your first payment.' : 'Only the workspace owner can see invoices.' }}
                </p>
              </div>
            </div>
          </template>

          <Dialog v-model:open="cancelOpen">
            <DialogContent class="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Cancel subscription?</DialogTitle>
                <DialogDescription>
                  Your {{ planName }} plan stays active until {{ fmtDate(billing?.currentPeriodEnd) }}.
                  After that your workspace moves to Free. No data is deleted.
                </DialogDescription>
              </DialogHeader>
              <DialogFooter>
                <Button variant="outline" @click="cancelOpen = false">Keep plan</Button>
                <Button variant="destructive" :disabled="cancelling" @click="confirmCancel">Cancel subscription</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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

          <div v-if="role === 'owner'" class="flex items-start gap-20 py-4 border-b border-dashed border-border">
            <div class="w-[300px] shrink-0">
              <p class="text-[13px] font-medium text-foreground">Payout schedule</p>
              <p class="text-[11.5px] text-muted-foreground mt-0.5 leading-relaxed">When approved expenses are reimbursed. Expenses approved by Finance are paid on the next payout date.</p>
            </div>
            <div class="flex-1">
              <div class="flex flex-wrap gap-2">
                <Button
                  v-for="opt in PAYOUT_OPTIONS"
                  :key="opt.value"
                  :variant="payoutSchedule === opt.value ? 'default' : 'outline'"
                  size="sm"
                  class="text-[12px]"
                  :disabled="payoutSaving"
                  @click="setPayoutSchedule(opt.value)"
                >
                  {{ opt.label }}
                </Button>
              </div>
              <p class="mt-2 text-[12px] text-muted-foreground">Next payout: {{ nextPayoutLabel }}</p>
            </div>
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

    </div><!-- end container -->
  </div>
</template>
