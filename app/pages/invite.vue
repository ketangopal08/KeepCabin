<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: false })

const route    = useRoute()
const supabase = useSupabase()
const token    = route.query.token as string

type Step = 'loading' | 'error' | 'accept' | 'create' | 'signin' | 'welcome'
const step       = ref<Step>('loading')
const errorMsg   = ref('')
const inviteInfo = ref<{ email: string; role: string; org_name: string; team_name: string | null } | null>(null)
let   sessionToken: string | null = null

const name        = ref('')
const password    = ref('')
const accepting   = ref(false)
const formLoading = ref(false)
const displayName = ref('')

// ── Dot grid canvas (right panel) ──
const dotCanvas = ref<HTMLCanvasElement | null>(null)
let raf: number | null = null

// ── Full-screen welcome canvas ──
const welcomeCanvas = ref<HTMLCanvasElement | null>(null)
let welcomeRaf: number | null = null

function initWelcomeCanvas() {
  const canvas = welcomeCanvas.value
  if (!canvas) return
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  const SPACING = 20, DOT = 2
  const cols = Math.ceil(canvas.width  / SPACING) + 1
  const rows = Math.ceil(canvas.height / SPACING) + 1
  const dots = Array.from({ length: cols * rows }, (_, i) => ({
    x: (i % cols) * SPACING, y: Math.floor(i / cols) * SPACING,
    on: Math.random() > 0.75, timer: Math.random() * 4000, interval: 800 + Math.random() * 3200,
  }))
  if (welcomeRaf !== null) cancelAnimationFrame(welcomeRaf)
  let prev = performance.now()
  function tick(now: number) {
    const dt = now - prev; prev = now
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const d of dots) {
      d.timer -= dt
      if (d.timer <= 0) { d.on = !d.on; d.timer = d.interval + Math.random() * 800 }
      if (d.on) { ctx.fillStyle = 'rgba(140,140,150,0.45)'; ctx.fillRect(d.x, d.y, DOT, DOT) }
    }
    welcomeRaf = requestAnimationFrame(tick)
  }
  welcomeRaf = requestAnimationFrame(tick)
}

watch(step, async (val) => {
  if (val === 'welcome') {
    await nextTick()
    initWelcomeCanvas()
    window.addEventListener('resize', initWelcomeCanvas)
  } else {
    if (welcomeRaf !== null) { cancelAnimationFrame(welcomeRaf); welcomeRaf = null }
    window.removeEventListener('resize', initWelcomeCanvas)
  }
})

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

onMounted(async () => {
  if (!token) { errorMsg.value = 'Invalid invite link.'; step.value = 'error'; await nextTick(); initDotGrid(); return }

  try {
    inviteInfo.value = await $fetch('/api/invites/validate', { query: { token } })
  } catch (e: any) {
    errorMsg.value = e?.data?.message ?? 'This invite link is invalid or has expired.'
    step.value = 'error'
    await nextTick(); initDotGrid()
    return
  }

  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    if (session.user.email !== inviteInfo.value!.email) {
      errorMsg.value = `This invite was sent to ${inviteInfo.value!.email}. Please sign in with that account.`
      step.value = 'error'
      await nextTick(); initDotGrid()
      return
    }
    sessionToken = session.access_token
  }

  step.value = 'accept'
  await nextTick()
  initDotGrid()
  window.addEventListener('resize', initDotGrid)
})

onUnmounted(() => {
  if (raf !== null) cancelAnimationFrame(raf)
  if (welcomeRaf !== null) cancelAnimationFrame(welcomeRaf)
  window.removeEventListener('resize', initDotGrid)
  window.removeEventListener('resize', initWelcomeCanvas)
})

async function handleAccept() {
  if (sessionToken) {
    accepting.value = true
    try { await doAccept(sessionToken) }
    catch (e: any) { toast.error(e?.data?.message ?? 'Something went wrong.') }
    finally { accepting.value = false }
    return
  }
  accepting.value = true
  try {
    const { exists } = await $fetch<{ exists: boolean }>('/api/auth/check-email', {
      method: 'POST', body: { email: inviteInfo.value!.email },
    })
    step.value = exists ? 'signin' : 'create'
  } catch { step.value = 'create' }
  finally { accepting.value = false }
}

async function doAccept(accessToken: string) {
  await $fetch('/api/invites/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { token },
  })
  step.value = 'welcome'
}

async function handleCreate() {
  if (!name.value.trim())        { toast.error('Please enter your name.'); return }
  if (password.value.length < 6) { toast.error('Password must be at least 6 characters.'); return }
  formLoading.value = true
  try {
    const { data, error: err } = await supabase.auth.signUp({
      email: inviteInfo.value!.email, password: password.value,
      options: { data: { full_name: name.value.trim() } },
    })
    if (err) throw err
    if (!data.session) throw new Error('Please confirm your email address first, then return to this link.')
    displayName.value = name.value.trim().split(' ')[0] ?? ''
    await doAccept(data.session.access_token)
  } catch (e: any) { toast.error(e?.message ?? 'Something went wrong.') }
  finally { formLoading.value = false }
}

async function handleSignIn() {
  if (!password.value) { toast.error('Please enter your password.'); return }
  formLoading.value = true
  try {
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: inviteInfo.value!.email, password: password.value,
    })
    if (err) throw err
    displayName.value = (data.session!.user.user_metadata?.full_name as string | undefined)?.split(' ')[0] ?? ''
    await doAccept(data.session!.access_token)
  } catch (e: any) { toast.error(e?.message ?? 'Something went wrong.') }
  finally { formLoading.value = false }
}
</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-white select-none" style="--fh:49px">
    <Sonner position="bottom-right" theme="light" rich-colors />

    <!-- ══ BODY ══ -->
    <div class="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden" style="height:calc(100vh - var(--fh))">

      <!-- ─── LEFT: form ─── -->
      <div class="flex h-full w-full shrink-0 flex-col items-center px-6 pt-12 pb-10 overflow-y-auto">

        <!-- Logo -->
        <div class="flex items-center gap-2 mb-12 shrink-0 w-full max-w-[420px]">
          <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
          <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
        </div>

        <!-- Steps with transition -->
        <div :class="step === 'welcome' ? 'flex-1 flex flex-col justify-center w-full max-w-[420px]' : 'w-full max-w-[420px]'">
        <Transition name="step" mode="out-in">

          <!-- Loading -->
          <div v-if="step === 'loading'" key="loading" class="flex flex-col gap-3 w-full max-w-[420px]">
            <div class="h-8 w-52 bg-gray-100 rounded-lg animate-pulse" />
            <div class="h-4 w-full bg-gray-100 rounded animate-pulse" />
            <div class="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
            <div class="h-11 w-full bg-gray-100 rounded-xl animate-pulse mt-3" />
          </div>

          <!-- Error -->
          <div v-else-if="step === 'error'" key="error" class="flex flex-col gap-4 w-full max-w-[420px]">
            <div>
              <h1 style="font-size:1.6rem;font-weight:400;color:#333">Invite unavailable</h1>
              <p class="text-[14px] text-red-500 mt-1.5">{{ errorMsg }}</p>
            </div>
            <NuxtLink to="/login" class="text-sm text-gray-500 underline underline-offset-2">Go to login</NuxtLink>
          </div>

          <!-- Step 1: Accept -->
          <div v-else-if="step === 'accept'" key="accept" class="flex flex-col gap-5 w-full max-w-[420px]">
            <!-- Org card -->
           

            <div>
              <h1 style="font-size:1.6rem;font-weight:400;color:#333">Accept your invite</h1>
              <p class="text-[14px] text-gray-500 mt-1">
                Sent to <strong class="text-gray-700 font-medium">{{ inviteInfo?.email }}</strong>.
                <template v-if="!sessionToken"> You'll set up your login after accepting.</template>
                <template v-else> You're already signed in.</template>
              </p>
            </div>
 <div class="rounded-2xl border border-gray-200 bg-white shadow-sm overflow-hidden">
             
              <div class="flex items-center gap-4 px-3 py-3">
                <div class="size-11 rounded-xl bg-black flex items-center justify-center shrink-0">
                  <svg class="size-[18px] text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"/>
                    <path d="M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"/>
                    <path d="M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"/>
                    <path d="M10 6h4"/><path d="M10 10h4"/><path d="M10 14h4"/><path d="M10 18h4"/>
                  </svg>
                </div>
                <div class="flex flex-col gap-0.5 min-w-0">
                  <p class="text-[10.5px] font-semibold text-gray-400 uppercase tracking-widest">Invitation</p>
                  <p class="text-[15px] font-semibold text-gray-900 truncate leading-snug">{{ inviteInfo?.org_name }}</p>
                  <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                    <span class="inline-flex items-center gap-1 text-[12px] text-gray-500">
                      <svg class="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                      <span class="capitalize">{{ inviteInfo?.role }}</span>
                    </span>
                    <template v-if="inviteInfo?.team_name">
                      <span class="text-gray-300 text-[11px]">·</span>
                      <span class="inline-flex items-center gap-1 text-[12px] text-gray-500">
                        <svg class="size-3 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                        {{ inviteInfo.team_name }}
                      </span>
                    </template>
                  </div>
                </div>
              </div>
            </div>
            <button
              :disabled="accepting"
              class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              @click="handleAccept"
            >
              <svg v-if="accepting" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
                <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
              </svg>
              <span>{{ accepting ? 'Checking…' : 'Accept invite' }}</span>
              <svg v-if="!accepting" class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <path d="M5 12h14M13 6l6 6-6 6"/>
              </svg>
            </button>
          </div>

          <!-- Step 2a: Create account -->
          <div v-else-if="step === 'create'" key="create" class="flex flex-col gap-5 w-full max-w-[420px]">
            <div>
              <h1 style="font-size:1.6rem;font-weight:400;color:#333">Create your login</h1>
              <p class="text-[14px] text-gray-500 mt-0.5">
                Set up a password for <strong class="text-gray-700 font-medium">{{ inviteInfo?.email }}</strong>.
              </p>
            </div>

            <form class="flex flex-col gap-4" @submit.prevent="handleCreate">
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-medium text-gray-500">Email address</label>
                <input :value="inviteInfo?.email" type="email" readonly
                  class="w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200 outline-none cursor-default select-none" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-medium text-gray-500">Your name</label>
                <input v-model="name" type="text" placeholder="Jane Smith" autocomplete="name" autofocus
                  class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-medium text-gray-500">Create a password</label>
                <input v-model="password" type="password" placeholder="Min. 6 characters" autocomplete="new-password"
                  class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all" />
              </div>
              <button type="submit" :disabled="formLoading"
                class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
                <svg v-if="formLoading" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                </svg>
                <span>{{ formLoading ? 'Creating account…' : 'Create account & continue' }}</span>
                <svg v-if="!formLoading" class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
            </form>
          </div>

          <!-- Step 2b: Sign in -->
          <div v-else-if="step === 'signin'" key="signin" class="flex flex-col gap-5 w-full max-w-[420px]">
            <div>
              <h1 style="font-size:1.6rem;font-weight:400;color:#333">Sign in to continue</h1>
              <p class="text-[14px] text-gray-500 mt-0.5">
                Enter the password for <strong class="text-gray-700 font-medium">{{ inviteInfo?.email }}</strong>.
              </p>
            </div>

            <form class="flex flex-col gap-4" @submit.prevent="handleSignIn">
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-medium text-gray-500">Email address</label>
                <input :value="inviteInfo?.email" type="email" readonly
                  class="w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200 outline-none cursor-default select-none" />
              </div>
              <div class="flex flex-col gap-1.5">
                <label class="text-[13px] font-medium text-gray-500">Password</label>
                <input v-model="password" type="password" placeholder="Your password" autocomplete="current-password" autofocus
                  class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all" />
              </div>
              <button type="submit" :disabled="formLoading"
                class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1">
                <svg v-if="formLoading" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
                  <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
                  <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
                </svg>
                <span>{{ formLoading ? 'Signing in…' : 'Sign in & continue' }}</span>
                <svg v-if="!formLoading" class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M5 12h14M13 6l6 6-6 6"/>
                </svg>
              </button>
            </form>
          </div>

          <!-- Step 3: Welcome — rendered in full-screen overlay below -->
          <div v-else-if="step === 'welcome'" key="welcome" />

        </Transition>
        </div><!-- end flex-1 wrapper -->

        <!-- Step indicators (hidden on welcome) -->
        <div v-if="step !== 'welcome'" class="mt-auto pt-10 w-full max-w-[420px] flex flex-col gap-2">
          <!-- Step 1: current (active) -->
          <div class="flex items-center gap-3 px-4 py-3.5 rounded-xl bg-white border border-gray-200 shadow-[0_1px_4px_rgba(0,0,0,0.05)]">
            <div class="size-7 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
              <svg class="size-3.5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-gray-900">Accept your invite</p>
              <p class="text-[12px] text-gray-500 mt-0.5">Confirm your role and join your organization.</p>
            </div>
            <div class="size-1.5 rounded-full bg-gray-900 shrink-0" />
          </div>

          <!-- Step 2: upcoming -->
          <div class="flex items-center gap-3 px-4 py-3.5 rounded-xl border border-gray-100 bg-gray-50 opacity-55">
            <div class="size-7 rounded-full border-2 border-gray-300 flex items-center justify-center shrink-0">
              <span class="text-[11px] font-bold text-gray-400">2</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-gray-500">Get started with your team</p>
              <p class="text-[12px] text-gray-400 mt-0.5">Submit expenses, track approvals, and collaborate.</p>
            </div>
          </div>
        </div>

      </div>

      <!-- ─── RIGHT: dot grid + showcase ─── -->
      <div class="relative hidden lg:flex h-full items-center justify-center overflow-hidden border-l border-gray-100 bg-white">
        <canvas ref="dotCanvas" class="absolute inset-0 w-full h-full opacity-60" />

        <div class="relative z-10 flex flex-col gap-4 px-14 w-full max-w-[440px]">
          <p class="text-[11px] font-semibold uppercase tracking-widest text-gray-400 mb-1">Your team roles</p>

          <!-- Owner -->
          <div class="flex items-start gap-3 rounded-xl bg-white border border-[#e8e8e8] p-4 shadow-[0_1px_6px_rgba(0,0,0,0.05)]">
            <div class="size-8 rounded-lg bg-gray-900 flex items-center justify-center shrink-0">
              <svg class="size-4 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="4"/><path d="M4 20c0-4 3.6-7 8-7s8 3 8 7"/></svg>
            </div>
            <div class="flex-1">
              <div class="flex items-center gap-2 mb-0.5">
                <p class="text-[13px] font-semibold text-gray-900">Owner</p>
                <span class="px-1.5 py-0.5 rounded text-[10px] font-medium bg-gray-100 text-gray-500">Invited you</span>
              </div>
              <p class="text-[12px] text-gray-500">Full control — manages members, approves expenses, and exports reports.</p>
            </div>
          </div>

          <div class="flex justify-center">
            <svg class="size-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </div>

          <!-- Manager + Finance row -->
          <div class="grid grid-cols-2 gap-3">
            <div class="flex flex-col gap-2 rounded-xl bg-white border border-[#e8e8e8] p-4 shadow-[0_1px_6px_rgba(0,0,0,0.05)]">
              <div class="size-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg class="size-4 text-blue-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/></svg>
              </div>
              <div>
                <p class="text-[13px] font-semibold text-gray-900">Manager</p>
                <p class="text-[12px] text-gray-500 mt-0.5">Reviews and approves team expenses.</p>
              </div>
            </div>
            <div class="flex flex-col gap-2 rounded-xl bg-white border border-[#e8e8e8] p-4 shadow-[0_1px_6px_rgba(0,0,0,0.05)]">
              <div class="size-8 rounded-lg bg-emerald-50 flex items-center justify-center">
                <svg class="size-4 text-emerald-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="1" y="4" width="22" height="16" rx="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
              </div>
              <div>
                <p class="text-[13px] font-semibold text-gray-900">Finance</p>
                <p class="text-[12px] text-gray-500 mt-0.5">Processes payments and exports reports.</p>
              </div>
            </div>
          </div>

          <div class="flex justify-center">
            <svg class="size-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 5v14M5 12l7 7 7-7"/></svg>
          </div>

          <!-- Employee -->
          <div class="flex items-start gap-3 rounded-xl bg-white border border-[#e8e8e8] p-4 shadow-[0_1px_6px_rgba(0,0,0,0.05)]">
            <div class="size-8 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
              <svg class="size-4 text-amber-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="8" y1="13" x2="16" y2="13"/><line x1="8" y1="17" x2="12" y2="17"/></svg>
            </div>
            <div>
              <p class="text-[13px] font-semibold text-gray-900">Employee</p>
              <p class="text-[12px] text-gray-500 mt-0.5">Submits expense claims and tracks reimbursement status.</p>
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

  <!-- ══ FULL-SCREEN WELCOME OVERLAY ══ -->
  <Teleport to="body">
    <Transition name="welcome-screen">
      <div v-if="step === 'welcome'" class="fixed inset-0 z-50 bg-white overflow-hidden select-none">

        <!-- Dot grid canvas -->
        <canvas ref="welcomeCanvas" class="absolute inset-0 w-full h-full" />

        <!-- Logo top-left -->
        <div class="absolute top-11 left-38 flex items-center gap-2 z-10">
          <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
          <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
        </div>

        <!-- Centered content -->
        <div class="absolute inset-0 flex items-center justify-center z-10 px-10">
          <div class="max-w-[520px] w-full">
            <h1 class="welcome-blur" style="font-size:2.2rem;font-weight:300;color:#111;letter-spacing:-0.04em;line-height:1;animation-delay:0.1s">
              Welcome<template v-if="displayName">, {{ displayName }}</template>
            </h1>
            <p class="text-[18px] text-gray-500 leading-relaxed mt-5">
              <span class="welcome-blur" style="animation-delay:1.0s">We </span>
              <span class="welcome-blur" style="animation-delay:1.18s">have </span>
              <span class="welcome-blur" style="animation-delay:1.36s">successfully </span>
              <span class="welcome-blur" style="animation-delay:1.54s">created </span>
              <span class="welcome-blur" style="animation-delay:1.72s">your </span>
              <span class="welcome-blur" style="animation-delay:1.90s">account. </span>
              <span class="welcome-blur" style="animation-delay:2.08s">You're </span>
              <span class="welcome-blur" style="animation-delay:2.26s">now </span>
              <span class="welcome-blur" style="animation-delay:2.44s">part </span>
              <span class="welcome-blur" style="animation-delay:2.62s">of </span>
              <span class="welcome-blur font-medium text-gray-800" style="animation-delay:2.80s">{{ inviteInfo?.org_name }}<template v-if="inviteInfo?.team_name"> · {{ inviteInfo.team_name }}</template>.</span>
            </p>
            <NuxtLink to="/app"
              class="welcome-blur mt-10 inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-[14px] font-medium shadow-sm transition-colors"
              style="animation-delay:3.4s">
              Get started
              <svg class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>
            </NuxtLink>
          </div>
        </div>

        <!-- Footer -->
        <footer class="absolute bottom-0 left-0 right-0 flex items-center justify-between px-8 border-t border-gray-100 z-10" style="height:49px">
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
    </Transition>
  </Teleport>

</template>

<style scoped>
.step-enter-active,
.step-leave-active {
  transition: opacity 0.18s ease, transform 0.18s ease;
}
.step-enter-from {
  opacity: 0;
  transform: translateX(14px);
}
.step-leave-to {
  opacity: 0;
  transform: translateX(-14px);
}

/* Welcome screen fade-in */
.welcome-screen-enter-active { transition: opacity 0.4s ease; }
.welcome-screen-leave-active { transition: opacity 0.3s ease; }
.welcome-screen-enter-from,
.welcome-screen-leave-to { opacity: 0; }

/* Welcome blur-in animation */
.welcome-blur {
  opacity: 0;
  animation: blur-in 0.9s cubic-bezier(0.22, 1, 0.36, 1) forwards;
}
@keyframes blur-in {
  from {
    opacity: 0;
    filter: blur(14px);
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    filter: blur(0px);
    transform: translateY(0);
  }
}
</style>
