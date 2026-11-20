<script setup lang="ts">
// Mobile "Profile" tab — mirrors /app/settings (all sections) and is the hub for secondary /m pages.
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { PLANS } from '~~/lib/plans'
import { nextPayoutDate } from '~~/lib/payouts'
import type { PayoutSchedule } from '~~/lib/payouts'
import { personColor, personInitials } from '~/utils/avatarColors'

definePageMeta({ layout: 'mobile', middleware: 'mobile', pageTransition: { name: 'm-page', mode: 'out-in' } })

const supabase = useSupabase()
const { ctx, load: loadOrgContext, clear: clearOrgContext } = useOrgContext()
const { isDark, toggle } = useTheme()
const { colorId, select: selectColor, clear: clearColor } = useAccentColor()

const role = computed(() => ctx.value?.member?.role)
const isOwner = computed(() => role.value === 'owner')

function haptic() {
  try { navigator.vibrate?.(8) } catch {}
}

// ── Drill-in sheets (web tabs → bottom sheets) ────────────────────────────
type SheetId = 'profile' | 'security' | 'billing' | 'notifications' | 'organization'
const sheet = ref<SheetId | null>(null)
function openSheet(id: SheetId) { haptic(); sheet.value = id }
function onSheetOpen(id: SheetId, open: boolean) {
  if (open) sheet.value = id
  else if (sheet.value === id) sheet.value = null
}

// ── General / Profile ─────────────────────────────────────────────────────
const displayName = ref('')
const userEmail   = ref('')
const jobTitle    = ref('')
const department  = ref('')

// Draft values edited in the profile sheet (committed on Save)
const draftName       = ref('')
const draftJobTitle   = ref('')
const draftDepartment = ref('')
const savingProfile   = ref(false)

watch(sheet, (s) => {
  if (s !== 'profile') return
  draftName.value       = displayName.value
  draftJobTitle.value   = jobTitle.value
  draftDepartment.value = department.value
})

async function saveProfile() {
  if (savingProfile.value) return
  savingProfile.value = true
  try {
    // Same call as web saveChanges() for the General section
    await supabase.auth.updateUser({ data: { full_name: draftName.value.trim() } })
    displayName.value = draftName.value.trim()
    jobTitle.value    = draftJobTitle.value
    department.value  = draftDepartment.value
    toast.success('Profile saved')
    sheet.value = null
  } catch {
    toast.error('Could not save profile')
  } finally {
    savingProfile.value = false
  }
}

onMounted(async () => {
  const { data: { user } } = await supabase.auth.getUser()
  displayName.value = user?.user_metadata?.full_name ?? ''
  userEmail.value   = user?.email ?? ''
  avatarUrl.value   = user?.user_metadata?.avatar_url ?? ''
  await loadOrgContext()
  loadBilling()
})

const headerName = computed(() => displayName.value.trim() || userEmail.value)
const orgLine = computed(() => [ctx.value?.team?.name, ctx.value?.org?.name].filter(Boolean).join(', '))

// ── Profile photo ─────────────────────────────────────────────────────────
const avatarUrl     = ref('')
const avatarInput   = ref<HTMLInputElement | null>(null)
const avatarBusy    = ref(false)

function pickAvatar() {
  if (avatarBusy.value) return
  haptic()
  avatarInput.value?.click()
}

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

// Web loads billing when the Billing tab opens — here, when the Billing sheet opens.
watch(sheet, async (s) => {
  if (s !== 'billing') return
  await loadBilling()
  loadInvoices()
})

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
const notifOnCount = computed(() => notifList.value.filter(n => n.on).length)

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
  haptic()
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

// ── Appearance ────────────────────────────────────────────────────────────
const accentLabel = computed(() => ACCENT_COLORS.find(c => c.id === colorId.value)?.label ?? 'Blue')
function setTheme(dark: boolean) {
  haptic()
  if (isDark.value !== dark) toggle()
}

// ── Workspace links (mirrors AppSidebar role logic) ───────────────────────
const workspaceLinks = computed(() => {
  const r = role.value
  const links: { label: string; icon: string; tint: string; href: string }[] = []
  if (r === 'owner') links.push({ label: 'Organization', icon: 'solar:buildings-2-linear', tint: 'text-sky-500', href: '/m/org' })
  if (r === 'manager') links.push({ label: 'My Team', icon: 'solar:users-group-rounded-linear', tint: 'text-violet-500', href: '/m/team' })
  if (r === 'owner' || r === 'manager') links.push({ label: 'Teams', icon: 'solar:users-group-two-rounded-linear', tint: 'text-indigo-500', href: '/m/teams' })
  if (r === 'finance' || r === 'owner') links.push({ label: 'Reports', icon: 'solar:file-download-linear', tint: 'text-emerald-500', href: '/m/reports' })
  if (r === 'owner') links.push({ label: 'Payouts', icon: 'solar:card-linear', tint: 'text-amber-500', href: '/m/payments' })
  links.push({ label: 'Upgrade plan', icon: 'solar:crown-linear', tint: 'text-amber-500', href: '/m/upgrade' })
  links.push({ label: 'Help center', icon: 'solar:question-circle-linear', tint: 'text-muted-foreground', href: '/m/help' })
  return links
})

// ── Sign out (same as AppSidebar logout) ──────────────────────────────────
const signingOut = ref(false)
async function logout() {
  haptic()
  signingOut.value = true
  clearOrgContext()
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="flex flex-col gap-5">
    <MobilePageHeader title="Profile" :back="false" />

    <input ref="avatarInput" type="file" accept="image/*" class="hidden" @change="onAvatarSelected">

    <!-- ── Profile header ─────────────────────────────────────────── -->
    <section class="m-rise flex flex-col items-center text-center" style="--d: 40ms">
      <Button
        variant="ghost"
        class="m-press relative size-[72px] shrink-0 rounded-full p-0 hover:bg-transparent"
        :disabled="avatarBusy"
        aria-label="Change profile photo"
        @click="pickAvatar"
      >
        <span
          class="flex size-full items-center justify-center overflow-hidden rounded-full text-[22px] font-semibold text-white"
          :style="{ background: avatarUrl ? undefined : personColor(headerName) }"
        >
          <img v-if="avatarUrl" :src="avatarUrl" alt="Profile photo" class="size-full object-cover" @error="avatarUrl = ''">
          <template v-else>{{ personInitials(headerName) }}</template>
        </span>
        <span
          v-if="avatarBusy"
          class="absolute inset-0 flex items-center justify-center rounded-full bg-black/50 text-white"
        >
          <Icon name="solar:refresh-linear" class="size-5 animate-spin" />
        </span>
        <span class="absolute -right-0.5 -bottom-0.5 flex size-7 items-center justify-center rounded-full bg-foreground text-background ring-[3px] ring-background">
          <Icon name="solar:camera-linear" class="size-3.5" />
        </span>
      </Button>

      <p v-if="headerName" class="mt-3 max-w-full truncate text-[19px] font-semibold tracking-tight text-foreground">{{ headerName }}</p>
      <Skeleton v-else class="mx-auto mt-3 h-6 w-36 rounded-lg" />
      <p v-if="userEmail" class="max-w-full truncate text-[13px] text-muted-foreground">{{ userEmail }}</p>
      <div class="mt-2 flex flex-wrap items-center justify-center gap-2">
        <Badge v-if="role" variant="secondary" class="rounded-full px-2.5 capitalize">{{ role }}</Badge>
        <span v-if="orgLine" class="flex items-center gap-1 text-[12px] text-muted-foreground">
          <Icon name="solar:buildings-2-linear" class="size-3.5 shrink-0" />{{ orgLine }}
        </span>
      </div>
    </section>

    <!-- ── Account ───────────────────────────────────────────────── -->
    <section class="m-rise" style="--d: 100ms">
      <h2 class="mb-2 px-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Account</h2>
      <Card class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 py-1 shadow-none ring-0">
        <Button variant="ghost" class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent" @click="openSheet('profile')">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:user-linear" class="size-[18px] text-sky-500" /></span>
          <span class="flex-1 text-left text-[14px] text-foreground">Personal info</span>
          <span class="max-w-[45%] truncate text-[13px] text-muted-foreground">{{ displayName || 'Add name' }}</span>
          <Icon name="solar:alt-arrow-right-linear" class="size-4 shrink-0 text-muted-foreground" />
        </Button>
        <Separator class="ml-[60px] w-auto" />
        <Button variant="ghost" class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent" :disabled="avatarBusy" @click="pickAvatar">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:camera-linear" class="size-[18px] text-pink-500" /></span>
          <span class="flex-1 text-left text-[14px] text-foreground">Profile photo</span>
          <span class="text-[13px] text-muted-foreground">{{ avatarBusy ? 'Uploading…' : avatarUrl ? 'Change' : 'Upload' }}</span>
          <Icon name="solar:alt-arrow-right-linear" class="size-4 shrink-0 text-muted-foreground" />
        </Button>
        <template v-if="avatarUrl">
          <Separator class="ml-[60px] w-auto" />
          <Button variant="ghost" class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent" :disabled="avatarBusy" @click="haptic(); removeAvatar()">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:trash-bin-trash-linear" class="size-[18px] text-destructive" /></span>
            <span class="flex-1 text-left text-[14px] text-destructive">Remove photo</span>
          </Button>
        </template>
        <Separator class="ml-[60px] w-auto" />
        <Button variant="ghost" class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent" @click="openSheet('security')">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:shield-check-linear" class="size-[18px] text-emerald-500" /></span>
          <span class="flex-1 text-left text-[14px] text-foreground">Security</span>
          <span class="text-[13px] text-muted-foreground">{{ twoFAEnabled ? '2FA on' : '2FA off' }}</span>
          <Icon name="solar:alt-arrow-right-linear" class="size-4 shrink-0 text-muted-foreground" />
        </Button>
        <Separator class="ml-[60px] w-auto" />
        <Button variant="ghost" class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent" @click="openSheet('notifications')">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:bell-linear" class="size-[18px] text-red-500" /></span>
          <span class="flex-1 text-left text-[14px] text-foreground">Notifications</span>
          <span class="text-[13px] text-muted-foreground">{{ notifOnCount }} on</span>
          <Icon name="solar:alt-arrow-right-linear" class="size-4 shrink-0 text-muted-foreground" />
        </Button>
        <Separator class="ml-[60px] w-auto" />
        <Button variant="ghost" class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent" @click="openSheet('billing')">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:card-linear" class="size-[18px] text-violet-500" /></span>
          <span class="flex-1 text-left text-[14px] text-foreground">Billing</span>
          <span class="max-w-[45%] truncate text-[13px] text-muted-foreground">{{ planName }}</span>
          <Icon name="solar:alt-arrow-right-linear" class="size-4 shrink-0 text-muted-foreground" />
        </Button>
        <template v-if="isOwner">
          <Separator class="ml-[60px] w-auto" />
          <Button variant="ghost" class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent" @click="openSheet('organization')">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:buildings-linear" class="size-[18px] text-sky-500" /></span>
            <span class="flex-1 text-left text-[14px] text-foreground">Organization settings</span>
            <span class="max-w-[40%] truncate text-[13px] text-muted-foreground">{{ ctx?.org?.name }}</span>
            <Icon name="solar:alt-arrow-right-linear" class="size-4 shrink-0 text-muted-foreground" />
          </Button>
        </template>
      </Card>
    </section>

    <!-- ── Appearance ────────────────────────────────────────────── -->
    <section class="m-rise" style="--d: 160ms">
      <h2 class="mb-2 px-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Appearance</h2>
      <Card class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 py-1 shadow-none ring-0">
        <!-- Theme -->
        <div class="flex items-center gap-3 px-4 py-3">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background">
            <Icon :name="isDark ? 'solar:moon-linear' : 'solar:sun-linear'" class="size-[18px] text-amber-500" />
          </span>
          <span class="flex-1 text-[14px] text-foreground">Theme</span>
          <div class="flex rounded-full bg-background p-0.5">
            <Button
              size="sm"
              :variant="!isDark ? 'default' : 'ghost'"
              class="m-press h-8 rounded-full px-3.5 text-[12.5px]"
              @click="setTheme(false)"
            >
              Light
            </Button>
            <Button
              size="sm"
              :variant="isDark ? 'default' : 'ghost'"
              class="m-press h-8 rounded-full px-3.5 text-[12.5px]"
              @click="setTheme(true)"
            >
              Dark
            </Button>
          </div>
        </div>
        <Separator class="ml-[60px] w-auto" />
        <!-- Accent color -->
        <div class="flex flex-col gap-3 px-4 py-3">
          <div class="flex items-center gap-3">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:palette-linear" class="size-[18px] text-primary" /></span>
            <span class="flex-1 text-[14px] text-foreground">Accent color</span>
            <span class="text-[13px] text-muted-foreground">{{ accentLabel }}</span>
          </div>
          <div class="flex items-center justify-between gap-2 pl-11">
            <Button
              v-for="c in ACCENT_COLORS"
              :key="c.id"
              variant="ghost"
              size="icon"
              class="m-press relative size-9 rounded-full p-0 hover:opacity-90"
              :style="{ background: c.hex }"
              :aria-label="c.label"
              @click="haptic(); selectColor(c.id)"
            >
              <span
                v-if="colorId === c.id"
                class="pointer-events-none absolute inset-0 rounded-full ring-2 ring-foreground ring-offset-2 ring-offset-muted"
              />
              <Icon v-if="colorId === c.id" name="solar:check-read-linear" class="size-4 text-white drop-shadow" />
            </Button>
          </div>
        </div>
        <Separator class="ml-[60px] w-auto" />
        <!-- Reset appearance (same as web: toggle theme + clear accent) -->
        <Button variant="ghost" class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent" @click="haptic(); toggle(); clearColor()">
          <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon name="solar:restart-linear" class="size-[18px] text-muted-foreground" /></span>
          <span class="flex-1 text-left text-[14px] text-foreground">Reset theme</span>
        </Button>
      </Card>
    </section>

    <!-- ── Workspace ─────────────────────────────────────────────── -->
    <section class="m-rise" style="--d: 220ms">
      <h2 class="mb-2 px-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Workspace</h2>
      <Card class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 py-1 shadow-none ring-0">
        <template v-for="(l, i) in workspaceLinks" :key="l.href">
          <Separator v-if="i > 0" class="ml-[60px] w-auto" />
          <NuxtLink :to="l.href" class="m-press flex items-center gap-3 px-4 py-3" @click="haptic">
            <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background"><Icon :name="l.icon" class="size-[18px]" :class="l.tint" /></span>
            <span class="flex-1 text-[14px] text-foreground">{{ l.label }}</span>
            <Icon name="solar:alt-arrow-right-linear" class="size-4 shrink-0 text-muted-foreground" />
          </NuxtLink>
        </template>
      </Card>
    </section>

    <!-- ── Sign out ──────────────────────────────────────────────── -->
    <section class="m-rise" style="--d: 280ms">
      <Button variant="destructive" class="m-press h-12 w-full rounded-full text-[15px] font-semibold" :disabled="signingOut" @click="logout">
        <Icon name="solar:logout-2-linear" class="size-5" />
        {{ signingOut ? 'Signing out…' : 'Sign out' }}
      </Button>
    </section>

    <!-- ════════════════════════════════════════════════════════════════
         SHEET · Personal info
    ═══════════════════════════════════════════════════════════════ -->
    <Sheet :open="sheet === 'profile'" @update:open="onSheetOpen('profile', $event)">
      <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl" style="padding-bottom: max(env(safe-area-inset-bottom), 1rem)">
        <SheetHeader class="px-5 pt-5">
          <SheetTitle class="text-[17px]">Personal info</SheetTitle>
          <SheetDescription class="text-[12.5px]">Manage your profile and account details.</SheetDescription>
        </SheetHeader>
        <div class="flex flex-col gap-4 px-5 pb-2">
          <div class="flex items-center gap-4">
            <span
              class="flex size-14 shrink-0 items-center justify-center overflow-hidden rounded-full text-lg font-semibold text-white"
              :style="{ background: avatarUrl ? undefined : personColor(headerName) }"
            >
              <img v-if="avatarUrl" :src="avatarUrl" alt="Profile photo" class="size-full object-cover">
              <template v-else>{{ personInitials(headerName) }}</template>
            </span>
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center gap-2">
                <Button variant="outline" size="sm" class="m-press rounded-full" :disabled="avatarBusy" @click="pickAvatar">
                  <Icon name="solar:upload-minimalistic-linear" class="size-4" />
                  {{ avatarBusy ? 'Uploading…' : avatarUrl ? 'Change photo' : 'Upload photo' }}
                </Button>
                <Button v-if="avatarUrl" variant="ghost" size="sm" class="m-press rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" :disabled="avatarBusy" @click="removeAvatar">
                  Remove
                </Button>
              </div>
              <p class="text-[11.5px] text-muted-foreground">Images up to 2 MB</p>
            </div>
          </div>

          <div class="flex flex-col gap-1.5">
            <p class="text-[11.5px] text-muted-foreground">Full name</p>
            <Input v-model="draftName" placeholder="Your full name" autocomplete="name" class="h-12 rounded-2xl text-base md:text-base" />
          </div>
          <div class="flex flex-col gap-1.5">
            <p class="text-[11.5px] text-muted-foreground">Email</p>
            <Input v-model="userEmail" disabled class="h-12 cursor-not-allowed rounded-2xl text-base opacity-60 md:text-base" />
            <p class="text-[11px] text-muted-foreground">Used for sign-in and notifications. Contact your admin to change it.</p>
          </div>
          <div class="flex flex-col gap-1.5">
            <p class="text-[11.5px] text-muted-foreground">Job title</p>
            <Input v-model="draftJobTitle" placeholder="e.g. Finance Manager" class="h-12 rounded-2xl text-base md:text-base" />
          </div>
          <div class="flex flex-col gap-1.5">
            <p class="text-[11.5px] text-muted-foreground">Department</p>
            <Input v-model="draftDepartment" placeholder="e.g. Engineering" class="h-12 rounded-2xl text-base md:text-base" />
          </div>

          <Button class="m-press mt-1 h-12 w-full rounded-full text-[15px] font-semibold" :disabled="savingProfile" @click="saveProfile">
            {{ savingProfile ? 'Saving…' : 'Save' }}
          </Button>
        </div>
      </SheetContent>
    </Sheet>

    <!-- ════════════════════════════════════════════════════════════════
         SHEET · Security
    ═══════════════════════════════════════════════════════════════ -->
    <Sheet :open="sheet === 'security'" @update:open="onSheetOpen('security', $event)">
      <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl" style="padding-bottom: max(env(safe-area-inset-bottom), 1rem)">
        <SheetHeader class="px-5 pt-5">
          <SheetTitle class="text-[17px]">Security</SheetTitle>
          <SheetDescription class="text-[12.5px]">Manage your account security and devices.</SheetDescription>
        </SheetHeader>
        <div class="flex flex-col gap-5 px-5 pb-2">
          <!-- Password -->
          <div class="flex flex-col gap-3">
            <p class="text-[13px] font-semibold text-foreground">Password</p>
            <div class="flex flex-col gap-1.5">
              <p class="text-[11.5px] text-muted-foreground">Current password</p>
              <div class="relative">
                <Input :type="showCurrentPw ? 'text' : 'password'" model-value="securepassword123" readonly class="h-12 rounded-2xl pr-12 text-base md:text-base" />
                <Button
                  variant="ghost"
                  size="icon-sm"
                  class="absolute top-1/2 right-2 -translate-y-1/2 rounded-full text-muted-foreground"
                  :aria-label="showCurrentPw ? 'Hide password' : 'Show password'"
                  @click="showCurrentPw = !showCurrentPw"
                >
                  <Icon :name="showCurrentPw ? 'solar:eye-closed-linear' : 'solar:eye-linear'" class="size-4" />
                </Button>
              </div>
              <p class="flex items-center gap-1.5 text-[11.5px] font-medium text-emerald-600 dark:text-emerald-400">
                <Icon name="solar:check-circle-linear" class="size-3.5" /> Very secure
              </p>
            </div>
            <div class="flex flex-col gap-1.5">
              <p class="text-[11.5px] text-muted-foreground">New password</p>
              <Input v-model="newPassword" type="password" placeholder="Enter new password" autocomplete="new-password" class="h-12 rounded-2xl text-base md:text-base" />
              <Button variant="outline" class="m-press mt-1 h-11 rounded-full">Save new password</Button>
            </div>
          </div>

          <Separator />

          <!-- Two-step verification -->
          <label class="m-press flex items-center gap-3">
            <div class="min-w-0 flex-1">
              <p class="text-[13px] font-semibold text-foreground">Two-step verification</p>
              <p class="text-[11.5px] leading-relaxed text-muted-foreground">Require a one-time code each time you sign in.</p>
            </div>
            <span class="text-[12.5px]" :class="twoFAEnabled ? 'text-foreground' : 'text-muted-foreground'">
              {{ twoFAEnabled ? 'Enabled' : 'Disabled' }}
            </span>
            <Checkbox :model-value="twoFAEnabled" class="size-5 rounded-md" @update:model-value="twoFAEnabled = !twoFAEnabled" />
          </label>

          <Separator />

          <!-- Devices -->
          <div>
            <p class="text-[13px] font-semibold text-foreground">Browsers and devices</p>
            <p class="mb-3 text-[11.5px] text-muted-foreground">Devices currently signed in to your account.</p>
            <Card class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 py-1 shadow-none ring-0">
              <template v-for="(device, idx) in devices" :key="device.id">
                <Separator v-if="idx > 0" class="ml-[60px] w-auto" />
                <div class="flex items-center gap-3 px-4 py-3">
                  <span class="flex size-8 shrink-0 items-center justify-center rounded-xl bg-background">
                    <Icon :name="device.type === 'mobile' ? 'solar:smartphone-linear' : 'solar:monitor-linear'" class="size-[18px] text-muted-foreground" />
                  </span>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-[13px] font-medium text-foreground">{{ device.name }}</p>
                    <p class="text-[11.5px]" :class="device.current ? 'font-medium text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'">
                      India · {{ device.time }}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    class="m-press rounded-full text-muted-foreground hover:text-destructive"
                    aria-label="Remove device"
                    @click="haptic(); removeDevice(device.id)"
                  >
                    <Icon name="solar:trash-bin-trash-linear" class="size-4" />
                  </Button>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </SheetContent>
    </Sheet>

    <!-- ════════════════════════════════════════════════════════════════
         SHEET · Notifications
    ═══════════════════════════════════════════════════════════════ -->
    <Sheet :open="sheet === 'notifications'" @update:open="onSheetOpen('notifications', $event)">
      <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl" style="padding-bottom: max(env(safe-area-inset-bottom), 1rem)">
        <SheetHeader class="px-5 pt-5">
          <SheetTitle class="text-[17px]">Notifications</SheetTitle>
          <SheetDescription class="text-[12.5px]">Choose how you receive updates from KeepCabin.</SheetDescription>
        </SheetHeader>
        <div class="px-5 pb-2">
          <Card class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 py-1 shadow-none ring-0">
            <template v-for="(item, idx) in notifList" :key="item.key">
              <Separator v-if="idx > 0" class="mx-4 w-auto" />
              <label class="m-press flex items-center gap-3 px-4 py-3">
                <div class="min-w-0 flex-1">
                  <p class="text-[13.5px] font-medium text-foreground">{{ item.label }}</p>
                  <p class="text-[11.5px] text-muted-foreground">{{ item.desc }}</p>
                </div>
                <Checkbox :model-value="item.on" class="size-5 rounded-md" @update:model-value="haptic(); toggleNotif(item.key)" />
              </label>
            </template>
          </Card>
        </div>
      </SheetContent>
    </Sheet>

    <!-- ════════════════════════════════════════════════════════════════
         SHEET · Billing
    ═══════════════════════════════════════════════════════════════ -->
    <Sheet :open="sheet === 'billing'" @update:open="onSheetOpen('billing', $event)">
      <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl" style="padding-bottom: max(env(safe-area-inset-bottom), 1rem)">
        <SheetHeader class="px-5 pt-5">
          <SheetTitle class="text-[17px]">Billing</SheetTitle>
          <SheetDescription class="text-[12.5px]">Manage your subscription and payment details.</SheetDescription>
        </SheetHeader>
        <div class="flex flex-col gap-4 px-5 pb-2">
          <div v-if="billingLoading && !billing" class="flex flex-col gap-3">
            <Skeleton class="h-24 w-full rounded-3xl" />
            <Skeleton class="h-40 w-full rounded-3xl" />
          </div>

          <template v-else-if="billing">
            <!-- Limit banner (most-used limit at 80%+) -->
            <Card v-if="showLimitBanner && tightest" class="gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
              <div class="flex items-center gap-3">
                <div class="relative size-10 shrink-0">
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
                <div class="min-w-0 flex-1">
                  <p class="text-[13px] font-semibold text-foreground">
                    <template v-if="tightest.pct >= 100">You've reached your {{ tightest.label.toLowerCase() }} limit</template>
                    <template v-else>You've used {{ tightest.used }} of {{ tightest.cap }} {{ tightest.label.toLowerCase() }}</template>
                  </p>
                  <p class="mt-0.5 text-[11.5px] text-muted-foreground">Upgrade your plan to raise your limits. Nothing is deleted when you're over a limit.</p>
                </div>
              </div>
              <div class="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" class="m-press rounded-full" @click="billingBannerDismissed = true">Dismiss</Button>
                <Button size="sm" class="m-press rounded-full" as-child><NuxtLink to="/m/upgrade">Upgrade plan</NuxtLink></Button>
              </div>
            </Card>

            <!-- Current plan -->
            <Card class="gap-3 rounded-3xl border-0 bg-muted/60 p-4 shadow-none ring-0">
              <div>
                <p class="text-[11.5px] text-muted-foreground">Current plan</p>
                <div class="mt-0.5 flex items-center gap-2">
                  <p class="text-[15px] font-semibold text-foreground">{{ planName }}</p>
                  <Icon v-if="billing.plan !== 'free'" name="solar:crown-linear" class="size-4 text-amber-500" />
                  <Badge v-if="billing.trial" variant="secondary" class="rounded-full text-[10.5px]">Trial</Badge>
                  <Badge v-else-if="billing.status === 'past_due'" variant="destructive" class="rounded-full text-[10.5px]">Payment failed</Badge>
                  <Badge v-else variant="secondary" class="rounded-full text-[10.5px]">Current</Badge>
                </div>
                <p class="mt-0.5 text-[12px] text-muted-foreground">{{ planSummary }}</p>
                <p class="mt-1 text-[11px] text-muted-foreground">Prices exclude 18% GST, which is added at checkout.</p>
              </div>
              <div class="flex gap-2">
                <Button
                  v-if="isOwner && isPaid && billing.plan !== 'enterprise' && !billing.cancelAtPeriodEnd && billing.status !== 'cancelled'"
                  variant="outline" class="m-press h-10 flex-1 rounded-full" @click="cancelOpen = true"
                >
                  Cancel
                </Button>
                <Button class="m-press h-10 flex-1 rounded-full" as-child>
                  <NuxtLink to="/m/upgrade">{{ isPaid ? 'Change plan' : 'Upgrade plan' }}</NuxtLink>
                </Button>
              </div>
            </Card>

            <!-- Usage -->
            <Card class="gap-0 rounded-3xl border-0 bg-muted/60 py-1 shadow-none ring-0">
              <template v-for="(r, idx) in usageRows" :key="r.label">
                <Separator v-if="idx > 0" class="mx-4 w-auto" />
                <div class="px-4 py-3">
                  <div class="mb-1 flex items-center justify-between gap-2">
                    <p class="text-[13px] font-medium text-foreground">{{ r.label }}</p>
                    <span class="text-[12px] text-muted-foreground tabular-nums">
                      {{ r.cap === null ? `${r.used} · Unlimited` : `${r.used} of ${r.cap} · ${pctOf(r.used, r.cap)}%` }}
                    </span>
                  </div>
                  <p class="mb-2 text-[11px] leading-relaxed text-muted-foreground">{{ r.desc }}</p>
                  <div class="h-1.5 w-full overflow-hidden rounded-full bg-background">
                    <div
                      class="h-full rounded-full"
                      :class="r.cap !== null && r.used >= r.cap ? 'bg-destructive' : 'bg-primary'"
                      :style="{ width: r.cap === null ? '0%' : `${pctOf(r.used, r.cap)}%` }"
                    />
                  </div>
                </div>
              </template>
            </Card>

            <!-- Billing history -->
            <div>
              <p class="mb-2 px-1 text-[11.5px] font-medium uppercase tracking-wide text-muted-foreground">Billing history</p>
              <Skeleton v-if="invoicesLoading" class="h-24 w-full rounded-3xl" />
              <Card v-else-if="invoices.length" class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 py-1 shadow-none ring-0">
                <template v-for="(inv, idx) in invoices" :key="inv.id">
                  <Separator v-if="idx > 0" class="mx-4 w-auto" />
                  <div class="flex items-center gap-3 px-4 py-3">
                    <div class="min-w-0 flex-1">
                      <p class="text-[13px] font-semibold tabular-nums text-foreground">{{ fmtInr(inv.amount) }}</p>
                      <p class="text-[11.5px] text-muted-foreground">{{ fmtDate(inv.date) }}</p>
                    </div>
                    <Badge :variant="inv.status === 'paid' ? 'secondary' : 'outline'" class="rounded-full text-[10.5px] capitalize">{{ inv.status }}</Badge>
                    <Button v-if="inv.url" variant="link" size="sm" class="h-auto p-0 text-[12.5px]" as-child>
                      <a :href="inv.url" target="_blank" rel="noopener">View</a>
                    </Button>
                  </div>
                </template>
              </Card>
              <Card v-else class="items-center gap-2 rounded-3xl border-0 bg-muted/60 p-6 text-center shadow-none ring-0">
                <Icon name="solar:card-linear" class="size-7 text-muted-foreground" />
                <p class="text-[13px] font-semibold text-foreground">No billing history</p>
                <p class="text-[12px] text-muted-foreground">
                  {{ isOwner ? 'Invoices will appear here after your first payment.' : 'Only the workspace owner can see invoices.' }}
                </p>
              </Card>
            </div>
          </template>
        </div>
      </SheetContent>
    </Sheet>

    <Dialog v-model:open="cancelOpen">
      <DialogContent class="rounded-3xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Cancel subscription?</DialogTitle>
          <DialogDescription>
            Your {{ planName }} plan stays active until {{ fmtDate(billing?.currentPeriodEnd) }}.
            After that your workspace moves to Free. No data is deleted.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter class="gap-2">
          <Button variant="outline" class="rounded-full" @click="cancelOpen = false">Keep plan</Button>
          <Button variant="destructive" class="rounded-full" :disabled="cancelling" @click="confirmCancel">Cancel subscription</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <!-- ════════════════════════════════════════════════════════════════
         SHEET · Organization (owner)
    ═══════════════════════════════════════════════════════════════ -->
    <Sheet :open="sheet === 'organization'" @update:open="onSheetOpen('organization', $event)">
      <SheetContent side="bottom" class="max-h-[90dvh] gap-0 overflow-y-auto rounded-t-3xl" style="padding-bottom: max(env(safe-area-inset-bottom), 1rem)">
        <SheetHeader class="px-5 pt-5">
          <SheetTitle class="text-[17px]">Organization</SheetTitle>
          <SheetDescription class="text-[12.5px]">Manage your organization settings.</SheetDescription>
        </SheetHeader>
        <div class="flex flex-col gap-4 px-5 pb-2">
          <div class="flex flex-col gap-1.5">
            <p class="text-[11.5px] text-muted-foreground">Organization name</p>
            <Input :model-value="ctx?.org?.name ?? ''" disabled class="h-12 cursor-not-allowed rounded-2xl text-base opacity-60 md:text-base" />
          </div>

          <div class="flex items-center justify-between gap-3">
            <div>
              <p class="text-[11.5px] text-muted-foreground">Your role</p>
              <Badge variant="secondary" class="mt-1 rounded-full capitalize">{{ ctx?.member?.role }}</Badge>
            </div>
            <Button variant="outline" size="sm" class="m-press rounded-full" @click="haptic(); copyOrgId()">
              <Icon :name="copied ? 'solar:check-read-linear' : 'solar:copy-linear'" class="size-4" :class="copied ? 'text-emerald-500' : ''" />
              {{ copied ? 'Copied!' : 'Copy org ID' }}
            </Button>
          </div>

          <div v-if="role === 'owner'">
            <p class="mb-2 text-[13px] font-semibold text-foreground">Payout schedule</p>
            <p class="mb-3 text-[11.5px] leading-relaxed text-muted-foreground">When approved expenses are reimbursed. Expenses approved by Finance are paid on the next payout date.</p>
            <Card class="gap-0 overflow-hidden rounded-3xl border-0 bg-muted/60 py-1 shadow-none ring-0">
              <template v-for="(opt, idx) in PAYOUT_OPTIONS" :key="opt.value">
                <Separator v-if="idx > 0" class="mx-4 w-auto" />
                <Button
                  variant="ghost"
                  class="m-press h-auto w-full justify-start gap-3 rounded-none px-4 py-3 font-normal hover:bg-transparent"
                  :disabled="payoutSaving"
                  @click="setPayoutSchedule(opt.value)"
                >
                  <Icon name="solar:calendar-linear" class="size-[18px] shrink-0 text-muted-foreground" />
                  <span class="flex-1 text-left text-[13.5px] text-foreground">{{ opt.label }}</span>
                  <Icon v-if="payoutSchedule === opt.value" name="solar:check-read-linear" class="size-5 shrink-0 text-primary" />
                </Button>
              </template>
            </Card>
            <p class="mt-2 px-1 text-[12px] text-muted-foreground">Next payout: {{ nextPayoutLabel }}</p>
          </div>

          <!-- Danger zone -->
          <Card class="gap-3 rounded-3xl border-0 bg-destructive/5 p-4 shadow-none ring-1 ring-destructive/20">
            <p class="text-[11.5px] font-semibold uppercase tracking-wide text-destructive">Danger Zone</p>
            <div>
              <p class="text-[13px] font-medium text-foreground">Delete organization</p>
              <p class="mt-0.5 text-[11.5px] leading-relaxed text-muted-foreground">
                Permanently delete <span class="font-medium text-foreground">{{ ctx?.org?.name }}</span> and all associated data — members, teams, expenses, and reports. This action cannot be undone and all members will immediately lose access.
              </p>
            </div>
            <Button variant="destructive" class="m-press h-11 rounded-full" @click="showDeleteOrgDialog = true">
              Delete organization
            </Button>
            <p class="text-[11px] text-muted-foreground">Only organization owners can perform this action.</p>
          </Card>
        </div>
      </SheetContent>
    </Sheet>

    <!-- Delete org confirmation dialog -->
    <Dialog v-model:open="showDeleteOrgDialog">
      <DialogContent class="max-w-md rounded-3xl">
        <DialogHeader>
          <DialogTitle class="text-[15px]">Delete organization</DialogTitle>
          <DialogDescription class="text-[12.5px] leading-relaxed">
            This will permanently delete <span class="font-semibold text-foreground">{{ ctx?.org?.name }}</span> and all of its data including members, teams, expense records, and reports. This action <span class="font-semibold text-foreground">cannot be undone</span>.
          </DialogDescription>
        </DialogHeader>
        <div class="mt-1 flex flex-col gap-3">
          <Card class="gap-1 rounded-2xl border-0 bg-destructive/8 px-4 py-3 text-[12px] leading-relaxed text-destructive shadow-none ring-1 ring-destructive/20">
            <p class="font-semibold">What will be deleted:</p>
            <ul class="list-inside list-disc space-y-0.5 text-destructive/80">
              <li>All members and their access</li>
              <li>All teams and team configurations</li>
              <li>All expense submissions and history</li>
              <li>All reports and approval records</li>
              <li>Billing subscription and invoices</li>
            </ul>
          </Card>
          <div class="flex flex-col gap-1.5">
            <p class="text-[12px] text-muted-foreground">
              Type <span class="font-semibold text-foreground">{{ ctx?.org?.name }}</span> to confirm:
            </p>
            <Input v-model="deleteOrgConfirmName" placeholder="Organization name" class="h-12 rounded-2xl text-base md:text-base" />
          </div>
        </div>
        <DialogFooter class="mt-1 gap-2">
          <Button variant="outline" class="rounded-full" @click="showDeleteOrgDialog = false; deleteOrgConfirmName = ''">
            Cancel
          </Button>
          <Button variant="destructive" class="rounded-full" :disabled="!deleteOrgConfirmMatch || deletingOrg" @click="deleteOrg">
            {{ deletingOrg ? 'Deleting…' : 'Delete organization' }}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </div>
</template>
