<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'
import { PLANS } from '~~/lib/plans'
import { planManagerInvites } from '~~/lib/onboardingInvites'
import type { TeamDraft } from '~~/lib/onboardingInvites'

definePageMeta({ layout: false })

const supabase = useSupabase()
const orgName  = ref('')
const orgSize  = ref('1-10')
const loading  = ref(false)
const { show: showLoader } = usePageLoader()

const sizes = ['1-10', '11-50', '51-200', '200+']

// ── Three-step flow ──
type OStep = 'org' | 'team' | 'plan'
const ostep           = ref<OStep>('org')
const sessionToken    = ref('')
const teams           = ref<TeamDraft[]>([])      // Finance first, then custom teams (with ids + manager email)
const customTeams     = computed(() => teams.value.filter(t => !t.isFinance))
const financeTeam     = computed(() => teams.value.find(t => t.isFinance) ?? null)
const financeSelf     = ref(false)
const invitesSending  = ref(false)
const newTeamName     = ref('')
const teamLoading     = ref(false)

// ── Dot grid canvas ──
const dotCanvas = ref<HTMLCanvasElement | null>(null)
let raf: number | null = null

function initDotGrid() {
  const canvas = dotCanvas.value
  if (!canvas) return
  const parent = canvas.parentElement!
  canvas.width  = parent.offsetWidth
  canvas.height = parent.offsetHeight
  const SPACING = 14, DOT = 2
  const cols = Math.ceil(canvas.width  / SPACING) + 1
  const rows = Math.ceil(canvas.height / SPACING) + 1
  const dots = Array.from({ length: cols * rows }, (_, i) => ({
    x: (i % cols) * SPACING, y: Math.floor(i / cols) * SPACING,
    on: Math.random() > 0.72, timer: Math.random() * 3000, interval: 400 + Math.random() * 2800,
  }))
  if (raf !== null) cancelAnimationFrame(raf)
  let prev = performance.now()
  function tick(now: number) {
    const dt = now - prev; prev = now
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const d of dots) {
      d.timer -= dt
      if (d.timer <= 0) { d.on = !d.on; d.timer = d.interval + Math.random() * 600 }
      if (d.on) { ctx.fillStyle = '#a8a8a8'; ctx.fillRect(d.x, d.y, DOT, DOT) }
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

async function handleCreate() {
  if (!orgName.value.trim()) { toast.error('Please enter your company name.'); return }
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    sessionToken.value = session!.access_token
    await $fetch('/api/orgs/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: { name: orgName.value.trim(), size: orgSize.value },
    })
    // Auto-create Finance team
    const finance = await $fetch<{ id: string; name: string }>('/api/teams' as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: { name: 'Finance' },
    })
    teams.value = [{ id: finance.id, name: 'Finance', isFinance: true, managerEmail: '' }]
    ostep.value = 'team'
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Something went wrong.')
  } finally {
    loading.value = false
  }
}

async function handleAddTeam() {
  const name = newTeamName.value.trim()
  if (!name) return
  teamLoading.value = true
  try {
    const created = await $fetch<{ id: string; name: string }>('/api/teams' as string, {
      method: 'POST',
      headers: { Authorization: `Bearer ${sessionToken.value}` },
      body: { name },
    })
    teams.value.push({ id: created.id, name: created.name ?? name, isFinance: false, managerEmail: '' })
    newTeamName.value = ''
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Could not add team.')
  } finally {
    teamLoading.value = false
  }
}

// Step 2 → 3: invite a manager for each team (failures don't block onboarding)
async function handleTeamsContinue() {
  const { invites, errors } = planManagerInvites(teams.value, financeSelf.value)
  if (errors.length) { toast.error(errors[0]!); return }
  invitesSending.value = true
  let sent = 0
  try {
    for (const inv of invites) {
      try {
        await $fetch('/api/invites/send' as string, {
          method: 'POST',
          headers: { Authorization: `Bearer ${sessionToken.value}` },
          body: { email: inv.email, role: inv.role, team_id: inv.team_id },
        })
        sent++
      } catch (e: any) {
        toast.error(`${inv.team_name}: ${e?.data?.message ?? 'Could not send invite.'}`)
      }
    }
    if (sent) toast.success(`Invites sent to ${sent} manager${sent === 1 ? '' : 's'}`)
    ostep.value = 'plan'
  } finally {
    invitesSending.value = false
  }
}

async function handleContinue() {
  showLoader('We are setting up your account. Please wait.')
  await new Promise(resolve => setTimeout(resolve, 10000))
  navigateTo('/app')
}

// ── Step 3: choose plan ──
type PlanChoice = 'trial' | 'pro' | 'business'
const planChoice   = ref<PlanChoice>('trial')
const planIntervals = ['monthly', 'yearly'] as const
const planInterval = ref<'monthly' | 'yearly'>('monthly')
const planBusy     = ref(false)
const { billing, checkout, refresh: refreshBilling } = useBilling()

const planOptions = computed(() => [
  {
    id: 'trial' as const,
    name: 'Start with a 14-day Pro trial',
    price: 'Free',
    desc: 'No card needed. All Pro features for 14 days, then you move to the Free plan.',
  },
  {
    id: 'pro' as const,
    name: PLANS.pro.name,
    price: planPrice(PLANS.pro.monthly!, PLANS.pro.yearly!),
    desc: 'Up to 15 members, unlimited teams, 500 expenses a month, any-range exports.',
  },
  {
    id: 'business' as const,
    name: PLANS.business.name,
    price: planPrice(PLANS.business.monthly!, PLANS.business.yearly!),
    desc: 'Up to 50 members, unlimited expenses, chat support.',
  },
])

function planPrice(monthly: number, yearly: number) {
  return planInterval.value === 'monthly'
    ? `₹${monthly.toLocaleString('en-IN')}/mo + GST`
    : `₹${yearly.toLocaleString('en-IN')}/yr + GST`
}

async function handlePlanContinue() {
  if (planChoice.value === 'trial') { handleContinue(); return }
  planBusy.value = true
  try {
    await checkout(planChoice.value, planInterval.value)
    await refreshBilling()
    // Paid successfully → into the app; dialog closed → stay here to pick again.
    if (billing.value && !billing.value.trial && billing.value.plan !== 'free') handleContinue()
  } finally {
    planBusy.value = false
  }
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { navigateTo('/login'); return }
  await nextTick()
  initDotGrid()
  window.addEventListener('resize', initDotGrid)
})

onUnmounted(() => {
  if (raf !== null) cancelAnimationFrame(raf)
  window.removeEventListener('resize', initDotGrid)
})
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-white select-none" style="--fh:49px">
    <Sonner position="bottom-right" theme="light" rich-colors />

    <!-- ══ BODY ══ -->
    <div class="flex flex-1 overflow-hidden" style="height:calc(100vh - var(--fh))">

      <!-- ─── LEFT: form ─── -->
      <div class="flex h-full w-full shrink-0 flex-col items-center px-6 pt-12 pb-10 overflow-y-auto lg:w-1/2">

        <!-- Logo -->
        <div class="flex items-center gap-2 mb-12 shrink-0 w-full max-w-[420px]">
          <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
          <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
        </div>

        <!-- ── STEP 1: Org setup ── -->
        <form v-if="ostep === 'org'" class="flex flex-col gap-5 w-full max-w-[420px]" @submit.prevent="handleCreate">
          <div>
            <h1 style="font-size:1.6rem;font-weight:400;color:#333">Set up your organization</h1>
            <p class="text-[14px] text-gray-500 mt-1">You'll be the owner. Invite your team next.</p>
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Company name</label>
            <input
              v-model="orgName"
              type="text"
              placeholder="Acme Corp"
              class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Company size</label>
            <div class="flex gap-2 flex-wrap">
              <button
                v-for="s in sizes" :key="s"
                type="button"
                :class="[
                  'px-4 py-2 rounded-xl text-sm border transition-all',
                  orgSize === s
                    ? 'bg-gray-900 text-white border-gray-900'
                    : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400'
                ]"
                @click="orgSize = s"
              >{{ s }}</button>
            </div>
          </div>

          <button
            type="submit"
            :disabled="loading"
            class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <svg v-if="loading" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <span>{{ loading ? 'Creating…' : 'Create organization' }}</span>
            <svg v-if="!loading" class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>
        </form>

        <!-- ── STEP 2: Team setup ── -->
        <div v-else-if="ostep === 'team'" class="flex flex-col gap-5 w-full max-w-[420px]">
          <div>
            <h1 style="font-size:1.6rem;font-weight:400;color:#333">Set up your team</h1>
            <p class="text-[14px] text-gray-500 mt-1">Your Finance team is ready. Add a manager for each team, or add more teams.</p>
          </div>

          <!-- Finance card (pre-created) -->
          <div class="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 bg-gray-50">
          <div class="flex items-center gap-3">
            <div class="size-9 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
              <svg class="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                <rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/>
              </svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-gray-900">Finance</p>
              <p class="text-[11.5px] text-gray-500">Payments, reports &amp; reimbursements</p>
            </div>
            <div class="size-5 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
              <svg class="size-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 6L9 17l-5-5"/>
              </svg>
            </div>
          </div>
            <template v-if="financeTeam">
              <Input
                v-model="financeTeam.managerEmail"
                type="email"
                placeholder="Finance manager's email"
                :disabled="financeSelf"
                class="h-9 rounded-lg bg-white dark:bg-white text-[13px] text-gray-900 dark:text-gray-900 border-gray-200 dark:border-gray-200 placeholder:text-gray-400 shadow-none disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-100"
              />
              <label class="flex items-center gap-2 text-[12.5px] text-gray-600 select-none cursor-pointer">
                <Checkbox
                  v-model="financeSelf"
                  class="border-gray-300 dark:border-gray-300 bg-white dark:bg-white data-[state=checked]:bg-gray-900 dark:data-[state=checked]:bg-gray-900 data-[state=checked]:border-gray-900 data-[state=checked]:text-white"
                />
                I'll handle finance myself
              </label>
            </template>
          </div>

          <!-- Added custom teams -->
          <div v-if="customTeams.length" class="flex flex-col gap-2">
            <div
              v-for="team in customTeams"
              :key="team.id"
              class="flex flex-col gap-3 p-4 rounded-xl border border-gray-200 bg-white"
            >
            <div class="flex items-center gap-3">
              <div class="size-9 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
                <svg class="size-4 text-gray-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                  <polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/>
                </svg>
              </div>
              <span class="flex-1 text-[13px] font-medium text-gray-900">{{ team.name }}</span>
              <div class="size-5 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                <svg class="size-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
            </div>
              <Input
                v-model="team.managerEmail"
                type="email"
                placeholder="Manager's email (optional)"
                class="h-9 rounded-lg bg-white dark:bg-white text-[13px] text-gray-900 dark:text-gray-900 border-gray-200 dark:border-gray-200 placeholder:text-gray-400 shadow-none"
              />
            </div>
          </div>

          <!-- Add team input -->
          <div class="flex gap-2">
            <input
              v-model="newTeamName"
              type="text"
              placeholder="Team name (e.g. Design, Engineering)"
              class="flex-1 px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all"
              @keydown.enter.prevent="handleAddTeam"
            />
            <button
              :disabled="teamLoading || !newTeamName.trim()"
              class="px-4 py-2.5 rounded-xl border border-gray-200 bg-white text-sm font-medium text-gray-700 hover:border-gray-400 hover:bg-gray-50 transition-all disabled:opacity-40 flex items-center gap-1.5 shrink-0"
              @click="handleAddTeam"
            >
              <svg v-if="teamLoading" class="animate-spin size-3.5" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <svg v-else class="size-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
              Add
            </button>
          </div>

          <!-- Continue -->
          <button
            class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            :disabled="invitesSending"
            @click="handleTeamsContinue"
          >
            <svg v-if="invitesSending" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <span>{{ invitesSending ? 'Sending invites…' : 'Continue' }}</span>
            <svg class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>
        </div>

        <!-- ── STEP 3: Choose plan ── -->
        <div v-else-if="ostep === 'plan'" class="flex flex-col gap-5 w-full max-w-[420px]">
          <div>
            <h1 style="font-size:1.6rem;font-weight:400;color:#333">Choose your plan</h1>
            <p class="text-[14px] text-gray-500 mt-1">Start free, or subscribe now. You can change plans anytime.</p>
          </div>

          <!-- Billing interval -->
          <div class="flex gap-2">
            <Button
              v-for="iv in planIntervals"
              :key="iv"
              variant="outline"
              size="sm"
              :class="[
                'rounded-xl capitalize shadow-none',
                planInterval === iv
                  ? 'bg-gray-900 text-white border-gray-900 hover:bg-gray-800 hover:text-white dark:bg-gray-900 dark:border-gray-900 dark:hover:bg-gray-800'
                  : 'bg-white text-gray-700 border-gray-200 hover:border-gray-400 hover:bg-white hover:text-gray-900 dark:bg-white dark:border-gray-200 dark:hover:bg-white',
              ]"
              @click="planInterval = iv"
            >
              {{ iv }}
            </Button>
            <span class="self-center text-[12px] text-gray-500">2 months free with yearly</span>
          </div>

          <!-- Plan options -->
          <div class="flex flex-col gap-2" role="radiogroup" aria-label="Plan">
            <Button
              v-for="o in planOptions"
              :key="o.id"
              variant="outline"
              role="radio"
              :aria-checked="planChoice === o.id"
              :class="[
                'h-auto w-full justify-start gap-3 rounded-xl p-4 text-left whitespace-normal shadow-none bg-white hover:bg-gray-50 dark:bg-white dark:hover:bg-gray-50',
                planChoice === o.id ? 'border-gray-900 ring-1 ring-gray-900 dark:border-gray-900' : 'border-gray-200 dark:border-gray-200',
              ]"
              @click="planChoice = o.id"
            >
              <div
                class="mt-0.5 size-4 shrink-0 self-start rounded-full border-2 flex items-center justify-center"
                :class="planChoice === o.id ? 'border-gray-900' : 'border-gray-300'"
              >
                <div v-if="planChoice === o.id" class="size-2 rounded-full bg-gray-900" />
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center justify-between gap-2">
                  <p class="text-[13px] font-semibold text-gray-900 flex items-center gap-1.5">
                    {{ o.name }}
                    <Icon v-if="o.id !== 'trial'" name="solar:crown-linear" class="size-3.5 text-amber-500" />
                  </p>
                  <p class="text-[12.5px] font-medium text-gray-900 shrink-0">{{ o.price }}</p>
                </div>
                <p class="text-[12px] font-normal text-gray-500 mt-0.5">{{ o.desc }}</p>
              </div>
            </Button>
          </div>

          <!-- Continue -->
          <Button
            :disabled="planBusy"
            class="h-auto w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm"
            @click="handlePlanContinue"
          >
            <svg v-if="planBusy" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>
            <span>{{ planChoice === 'trial' ? 'Start free trial' : 'Continue to payment' }}</span>
            <svg v-if="!planBusy" class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </Button>

          <p class="text-[12px] text-gray-500 text-center">
            Prices exclude 18% GST. Need Enterprise?
            <a href="mailto:hello@keepcabin.com" class="font-medium text-gray-900 underline underline-offset-4">Contact sales</a>
          </p>
        </div>

        <!-- Bottom info card (org step only) -->
        <div v-if="ostep === 'org'" class="mt-auto pt-10 w-full max-w-[420px]">
          <div class="rounded-2xl border border-gray-200 bg-gray-50 p-5">
            <p class="text-[12px] font-semibold text-gray-400 uppercase tracking-wider mb-4">As owner, you can</p>
            <div class="flex flex-col gap-3">
              <div class="flex items-start gap-3">
                <div class="size-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <svg class="size-3.5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                </div>
                <div>
                  <p class="text-[13px] font-medium text-gray-800">Invite your team</p>
                  <p class="text-[12px] text-gray-500 mt-0.5">Add managers, finance staff, and employees to your workspace.</p>
                </div>
              </div>
              <div class="flex items-start gap-3">
                <div class="size-7 rounded-lg bg-white border border-gray-200 flex items-center justify-center shrink-0 shadow-[0_1px_3px_rgba(0,0,0,0.06)]">
                  <svg class="size-3.5 text-gray-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                </div>
                <div>
                  <p class="text-[13px] font-medium text-gray-800">Track and approve expenses</p>
                  <p class="text-[12px] text-gray-500 mt-0.5">Full visibility across all submitted expenses, approvals, and reimbursements.</p>
                </div>
              </div>
            </div>
          </div>
        </div>

      </div>

      <!-- ─── RIGHT: dot grid + app mockup + steps ─── -->
      <div class="relative hidden lg:flex h-full w-1/2 items-center justify-center overflow-hidden border-l border-gray-100 bg-white">

        <!-- Dot grid -->
        <canvas ref="dotCanvas" class="absolute inset-0 w-full h-full opacity-60" />

        <!-- App preview mockup card -->
        <div class="relative z-10 flex flex-col items-center gap-8 px-10 w-full max-w-[440px]">

          <!-- Mini app UI mockup -->
          <div class="w-full rounded-xl border border-[#e2e2e2] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden">
            <div class="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa]">
              <div class="size-2.5 rounded-full bg-[#ff5f57]"/>
              <div class="size-2.5 rounded-full bg-[#febc2e]"/>
              <div class="size-2.5 rounded-full bg-[#28c840]"/>
              <div class="flex-1 mx-3 h-4 rounded-md bg-[#efefef]"/>
            </div>
            <div class="flex" style="height:220px">
              <div class="flex flex-col w-[140px] shrink-0 border-r border-[#efefef] bg-white">
                <div class="flex items-center gap-1.5 px-2.5 py-2 border-b border-[#f5f5f5]">
                  <div class="size-3 rounded-[3px] bg-[#6366f1]"/>
                  <div class="h-2 flex-1 rounded bg-[#e5e5e5]"/>
                  <div class="size-2 rounded-sm bg-[#efefef]"/>
                </div>
                <div class="px-2 py-1.5 border-b border-[#f5f5f5]">
                  <div class="h-4 rounded-md bg-[#f5f5f5]"/>
                </div>
                <div class="flex flex-col gap-0.5 p-1.5 flex-1">
                  <div class="flex items-center gap-1.5 px-1.5 py-1 rounded-md bg-[#f0f0f0]">
                    <div class="size-2.5 rounded-sm bg-[#aaa]"/>
                    <div class="h-1.5 w-14 rounded bg-[#ccc]"/>
                  </div>
                  <div v-for="n in 3" :key="n" class="flex items-center gap-1.5 px-1.5 py-1 rounded-md">
                    <div class="size-2.5 rounded-sm bg-[#e5e5e5]"/>
                    <div class="h-1.5 rounded bg-[#e5e5e5]" :style="`width:${[44,36,52][n-1]}px`"/>
                  </div>
                  <div class="mt-1 px-1.5">
                    <div class="h-px bg-[#f0f0f0] mb-1.5"/>
                    <div class="h-1.5 w-10 rounded bg-[#ddd] mb-1"/>
                  </div>
                  <div v-for="n in 2" :key="'b'+n" class="flex items-center gap-1.5 px-1.5 py-1 rounded-md">
                    <div class="size-2.5 rounded-sm bg-[#e5e5e5]"/>
                    <div class="h-1.5 rounded bg-[#e5e5e5]" :style="`width:${[40,52][n-1]}px`"/>
                  </div>
                </div>
              </div>
              <div class="flex-1 bg-[#fafafa] p-3 flex flex-col gap-2">
                <div class="h-3 w-28 rounded bg-[#e5e5e5]"/>
                <div class="h-1.5 w-40 rounded bg-[#efefef]"/>
                <div class="mt-1 grid grid-cols-3 gap-1.5">
                  <div v-for="n in 3" :key="n" class="rounded-lg border border-[#efefef] bg-white p-2">
                    <div class="h-1.5 w-8 rounded bg-[#efefef] mb-1"/>
                    <div class="h-3 w-12 rounded bg-[#e5e5e5]"/>
                  </div>
                </div>
                <div class="flex-1 rounded-lg border border-[#efefef] bg-white mt-0.5 p-2">
                  <div class="flex gap-1.5 mb-2">
                    <div v-for="n in 4" :key="n" class="h-1.5 flex-1 rounded bg-[#f0f0f0]"/>
                  </div>
                  <div v-for="n in 4" :key="n" class="flex gap-1.5 mb-1.5">
                    <div v-for="m in 4" :key="m" class="h-1.5 flex-1 rounded bg-[#f5f5f5]"/>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Steps -->
          <div class="w-full flex flex-col">
            <!-- Step 1 -->
            <div
              :class="[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5',
                ostep === 'team'
                  ? 'bg-white border border-[#e8e8e8] shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
                  : 'bg-white border border-[#e8e8e8] shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
              ]"
            >
              <div class="size-6 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
                <svg class="size-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-semibold text-gray-900">Set up your organization</p>
                <p class="text-[11.5px] text-gray-400 truncate">Name your workspace — you'll be the owner</p>
              </div>
              <div class="size-1.5 rounded-full shrink-0" :class="ostep === 'org' ? 'bg-gray-900' : 'bg-green-500'" />
            </div>

            <!-- Step 2 -->
            <div
              :class="[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 transition-opacity',
                ostep !== 'org'
                  ? 'bg-white border border-[#e8e8e8] shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
                  : 'opacity-50'
              ]"
            >
              <div
                class="size-6 rounded-full flex items-center justify-center shrink-0"
                :class="ostep !== 'org' ? 'bg-gray-900' : 'border-2 border-gray-300'"
              >
                <svg v-if="ostep !== 'org'" class="size-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                <span v-else class="text-[10px] font-bold text-gray-400">2</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[13px] font-semibold" :class="ostep !== 'org' ? 'text-gray-900' : 'text-gray-500'">Set up your teams</p>
                <p class="text-[11.5px] text-gray-400 truncate">Create Finance and your custom teams</p>
              </div>
              <div v-if="ostep !== 'org'" class="size-1.5 rounded-full shrink-0" :class="ostep === 'team' ? 'bg-gray-900' : 'bg-green-500'" />
            </div>

            <!-- Step 3 -->
            <div
              :class="[
                'flex items-center gap-3 px-3 py-2.5 rounded-lg transition-opacity',
                ostep === 'plan'
                  ? 'bg-white border border-[#e8e8e8] shadow-[0_1px_4px_rgba(0,0,0,0.04)]'
                  : 'opacity-35'
              ]"
            >
              <div
                class="size-6 rounded-full flex items-center justify-center shrink-0"
                :class="ostep === 'plan' ? 'bg-gray-900' : 'border-2 border-gray-200'"
              >
                <svg v-if="ostep === 'plan'" class="size-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
                <span v-else class="text-[10px] font-bold text-gray-300">3</span>
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-[13px]" :class="ostep === 'plan' ? 'font-semibold text-gray-900' : 'font-medium text-gray-400'">Choose your plan</p>
                <p class="text-[11.5px] truncate" :class="ostep === 'plan' ? 'text-gray-400' : 'text-gray-300'">Free trial, or subscribe to Pro or Business</p>
              </div>
              <div v-if="ostep === 'plan'" class="size-1.5 rounded-full bg-gray-900 shrink-0" />
            </div>
          </div>

        </div>
      </div>

    </div><!-- end BODY -->

    <!-- ══ FOOTER ══ -->
    <footer
      class="shrink-0 flex items-center justify-between px-8 border-t border-gray-100 bg-white z-10"
      style="height:var(--fh)"
    >
      <button class="text-xs text-gray-400 hover:text-gray-600 transition-colors">Contact us</button>
      <div class="flex items-center gap-4">
        <button class="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-600 transition-colors">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15.3 15.3 0 010 20M12 2a15.3 15.3 0 000 20"/></svg>
          English
        </button>
        <div class="w-px h-3 bg-gray-200" />
        <button class="text-xs text-gray-400 hover:text-gray-600 transition-colors">Privacy Policy</button>
        <div class="w-px h-3 bg-gray-200" />
        <span class="text-xs text-gray-300">© 2026 KeepCabin</span>
      </div>
    </footer>

  </div>
</template>
