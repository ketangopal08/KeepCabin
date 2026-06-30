<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: false })

const supabase = useSupabase()

// ── Step state ──
// 'email'  → email + Continue
// 'signin' → existing user: password + Sign in
// 'setup'  → new user: name + Continue
// 'signup' → new user: create password + Create account
const step     = ref<'email' | 'signin' | 'setup' | 'signup'>('email')
const email    = ref('')
const name     = ref('')
const password = ref('')
const loading  = ref(false)

// ── Dot grid canvas ──
const dotCanvas = ref<HTMLCanvasElement | null>(null)
let raf: number | null = null

function initDotGrid() {
  const canvas = dotCanvas.value
  if (!canvas) return
  const parent = canvas.parentElement!
  canvas.width  = parent.offsetWidth
  canvas.height = parent.offsetHeight

  const SPACING = 14
  const DOT     = 2

  const cols = Math.ceil(canvas.width  / SPACING) + 1
  const rows = Math.ceil(canvas.height / SPACING) + 1

  const dots = Array.from({ length: cols * rows }, (_, i) => ({
    x:        (i % cols) * SPACING,
    y:        Math.floor(i / cols) * SPACING,
    on:       Math.random() > 0.72,
    timer:    Math.random() * 3000,
    interval: 400 + Math.random() * 2800,
  }))

  if (raf !== null) cancelAnimationFrame(raf)

  let prev = performance.now()
  function tick(now: number) {
    const dt  = now - prev
    prev = now
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const d of dots) {
      d.timer -= dt
      if (d.timer <= 0) {
        d.on    = !d.on
        d.timer = d.interval + Math.random() * 600
      }
      if (d.on) {
        ctx.fillStyle = 'rgba(150,150,160,0.70)'
        ctx.fillRect(d.x, d.y, DOT, DOT)
      }
    }
    raf = requestAnimationFrame(tick)
  }
  raf = requestAnimationFrame(tick)
}

// ── Step 1: check if email exists ──
async function handleContinue() {
  const trimmed = email.value.trim()
  if (!trimmed) { toast.error('Please enter your email.'); return }
  loading.value = true
  try {
    const { exists } = await $fetch<{ exists: boolean }>('/api/auth/check-email', {
      method: 'POST',
      body: { email: trimmed },
    })
    if (exists) {
      step.value = 'signin'
      await nextTick()
      ;(document.querySelector('input[type="password"]') as HTMLInputElement | null)?.focus()
    } else {
      step.value = 'setup'
      await nextTick()
      ;(document.getElementById('name-input') as HTMLInputElement | null)?.focus()
    }
  } catch (e: any) {
    toast.error(e?.data?.message ?? e?.message ?? 'Something went wrong.')
  } finally {
    loading.value = false
  }
}

// ── Step 2 (new user): collect name ──
function handleSetup() {
  if (!name.value.trim()) { toast.error('Please enter your name.'); return }
  step.value = 'signup'
  nextTick(() => {
    ;(document.querySelector('input[type="password"]') as HTMLInputElement | null)?.focus()
  })
}

// ── Step 2a (existing user): sign in ──
async function handleSignIn() {
  if (!password.value) { toast.error('Please enter your password.'); return }
  loading.value = true
  const { error: err } = await supabase.auth.signInWithPassword({
    email: email.value.trim(),
    password: password.value,
  })
  if (err) { toast.error(err.message); loading.value = false }
  else { toast.success('Welcome back!'); navigateTo('/app') }
}

// ── Step 3 (new user): create password + account ──
async function handleSignUp() {
  if (!password.value || password.value.length < 6) {
    toast.error('Password must be at least 6 characters.')
    return
  }
  loading.value = true
  const { error: err } = await supabase.auth.signUp({
    email: email.value.trim(),
    password: password.value,
    options: { data: { full_name: name.value.trim() } },
  })
  if (err) { toast.error(err.message); loading.value = false }
  else { toast.success('Account created! Welcome to KeepCabin.'); navigateTo('/app') }
}

function handleSubmit() {
  if (step.value === 'email')  return handleContinue()
  if (step.value === 'setup')  return handleSetup()
  if (step.value === 'signin') return handleSignIn()
  if (step.value === 'signup') return handleSignUp()
}

async function signInWithGoogle() {
  loading.value = true
  const { error: err } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: `${window.location.origin}/auth/callback` },
  })
  if (err) { toast.error(err.message); loading.value = false }
}

function goBack() {
  if (step.value === 'signup') { step.value = 'setup'; password.value = ''; return }
  step.value     = 'email'
  name.value     = ''
  password.value = ''
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (session) { navigateTo('/app'); return }
  await nextTick()
  initDotGrid()
  window.addEventListener('resize', initDotGrid)
})

onUnmounted(() => {
  if (raf !== null) cancelAnimationFrame(raf)
  window.removeEventListener('resize', initDotGrid)
})

const brandLogos: Record<string, string> = {
  studio: `<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><circle cx="10" cy="10" r="8.5" stroke="#6366f1" stroke-width="1.5"/><circle cx="10" cy="10" r="3.5" fill="#6366f1"/></svg>`,
  folio:  `<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="5" y="2" width="10" height="13" rx="2" fill="#10b981" opacity="0.35"/><rect x="3" y="5" width="10" height="13" rx="2" fill="#10b981"/></svg>`,
  arc:    `<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M2.5 17a9 9 0 0115 0" stroke="#f59e0b" stroke-width="2.5" stroke-linecap="round"/><path d="M5.5 13a5 5 0 019 0" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" opacity="0.55"/></svg>`,
  ramp:   `<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><path d="M4 16L15 5M15 5H8M15 5v7" stroke="#ec4899" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  vercel: `<svg width="14" height="13" viewBox="0 0 18 16" fill="none"><path d="M9 1L17.66 15H0.34L9 1Z" fill="#8b5cf6"/></svg>`,
  bench:  `<svg width="16" height="16" viewBox="0 0 20 20" fill="none"><rect x="3" y="2" width="14" height="16" rx="2.5" fill="#06b6d4" opacity="0.12"/><rect x="3" y="2" width="14" height="16" rx="2.5" stroke="#06b6d4" stroke-width="1.5"/><path d="M7 7h6M7 10h6M7 13h4" stroke="#06b6d4" stroke-width="1.5" stroke-linecap="round"/></svg>`,
}

const testimonials = [
  {
    quote: "Finally an app that makes receipt management painless. I used to dread expense reports — KeepCabin changed that completely.",
    name: "Sarah Mitchell", title: "Freelance Designer", initials: "SM", company: "studio", color: "#6366f1",
    avatar: "https://i.pravatar.cc/150?img=47",
  },
  {
    quote: "The Google Drive sync alone is worth it. My receipts are automatically pulled in and sorted without any manual work.",
    name: "James Park", title: "Small Business Owner", initials: "JP", company: "folio", color: "#10b981",
    avatar: "https://i.pravatar.cc/150?img=68",
  },
  {
    quote: "OCR accuracy is impressive. Snap a photo and the vendor, amount, and date are extracted instantly. Saves hours every month.",
    name: "Priya Sharma", title: "Startup Founder", initials: "PS", company: "arc", color: "#f59e0b",
    avatar: "https://i.pravatar.cc/150?img=44",
  },
  {
    quote: "We process hundreds of receipts monthly. KeepCabin cut our accounting prep time by more than half. The categorization is spot on.",
    name: "Marcus Chen", title: "Finance Manager", initials: "MC", company: "ramp", color: "#ec4899",
    avatar: "https://i.pravatar.cc/150?img=54",
  },
  {
    quote: "Clean, fast, and just works. No bloat. Does exactly what it promises without getting in the way.",
    name: "Lena Weber", title: "Product Manager", initials: "LW", company: "vercel", color: "#8b5cf6",
    avatar: "https://i.pravatar.cc/150?img=5",
  },
  {
    quote: "After trying a few expense apps I finally found one I actually stick with. The interface is just so much better.",
    name: "Tom Nakamura", title: "Accountant", initials: "TN", company: "bench", color: "#06b6d4",
    avatar: "https://i.pravatar.cc/150?img=60",
  },
]

</script>

<template>
  <div class="fixed inset-0 flex flex-col bg-white select-none" style="--fh:49px">
    <Sonner position="bottom-right" theme="light" rich-colors />

    <!-- ══ BODY ══ -->
    <div class="grid grid-cols-1 lg:grid-cols-2 flex-1 overflow-hidden" style="height:calc(100vh - var(--fh))">

      <!-- ─── LEFT COLUMN ─── -->
      <div class="flex h-full w-full shrink-0 flex-col items-center px-6 pt-12 pb-10 overflow-y-auto">

        <!-- Logo -->
        <div class="flex items-center gap-2 mb-12 shrink-0 w-full max-w-[420px]">
          <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin"/>
          <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
        </div>

        <!-- ── FORM ── -->
        <form class="flex flex-col gap-5 w-full max-w-[420px]" @submit.prevent="handleSubmit">

          <!-- Heading -->
          <div>
            <template v-if="step === 'email'">
              <h1 style="font-size:1.6rem;font-weight:400;color:#333">What's your email?</h1>
              <p class="text-[14px] text-gray-500">Create your account or sign in.</p>
            </template>
            <template v-else-if="step === 'signin'">
              <h1 style="font-size:1.6rem;font-weight:400;color:#333">Welcome back</h1>
              <p class="text-[14px] text-gray-500">Sign in as <strong class="text-gray-700 font-medium">{{ email }}</strong>.</p>
            </template>
            <template v-else-if="step === 'setup'">
              <h1 style="font-size:1.6rem;font-weight:400;color:#333">Let's set up your account</h1>
              <p class="text-[14px] text-gray-500">No account found for <strong class="text-gray-700 font-medium">{{ email }}</strong>. What should we call you?</p>
            </template>
            <template v-else>
              <h1 style="font-size:1.6rem;font-weight:400;color:#333">Create a password</h1>
              <p class="text-[14px] text-gray-500">Almost done, <strong class="text-gray-700 font-medium">{{ name }}</strong>. Choose a secure password.</p>
            </template>
          </div>

          <!-- Email field (always shown, locked after step 1) -->
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Email address</label>
            <div class="relative">
              <input
                v-model="email"
                type="email"
                placeholder="name@company.com"
                autocomplete="email"
                :readonly="step !== 'email'"
                :class="[
                  'w-full px-4 py-2.5 text-sm text-gray-900 rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 transition-all',
                  step === 'email'
                    ? 'bg-white focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)]'
                    : 'bg-gray-50 text-gray-500 cursor-default pr-16'
                ]"
              />
              <button
                v-if="step !== 'email'"
                type="button"
                class="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-700 transition-colors"
                @click="goBack"
              >
                Change
              </button>
            </div>
          </div>

          <!-- Name field (setup step only) -->
          <div v-if="step === 'setup'" class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Your name</label>
            <input
              id="name-input"
              v-model="name"
              type="text"
              placeholder="Jane Smith"
              autocomplete="name"
              class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all"
            />
          </div>

          <!-- Password field (signin or signup steps) -->
          <div v-if="step === 'signin' || step === 'signup'" class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">
              {{ step === 'signin' ? 'Password' : 'Create a password' }}
            </label>
            <input
              v-model="password"
              type="password"
              :placeholder="step === 'signin' ? 'Your password' : 'Min. 6 characters'"
              :autocomplete="step === 'signin' ? 'current-password' : 'new-password'"
              class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all"
            />
          </div>

          <!-- Primary action button -->
          <button
            type="submit"
            class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            :disabled="loading"
          >
            <!-- Circle loader when loading -->
            <svg v-if="loading" class="animate-spin size-4 shrink-0" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" stroke-width="3" stroke-opacity="0.25"/>
              <path d="M22 12a10 10 0 0 0-10-10" stroke="currentColor" stroke-width="3" stroke-linecap="round"/>
            </svg>

            <span v-if="step === 'email'">{{ loading ? 'Checking…' : 'Continue' }}</span>
            <span v-else-if="step === 'setup'">Continue</span>
            <span v-else-if="step === 'signin'">{{ loading ? 'Signing in…' : 'Sign in' }}</span>
            <span v-else>{{ loading ? 'Creating account…' : 'Create account' }}</span>

            <!-- Arrow icon when not loading -->
            <svg v-if="!loading" class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </button>

          <!-- Divider -->
          <div class="flex items-center gap-3">
            <div class="flex-1 h-px bg-gray-100" />
            <span class="text-xs text-gray-400">or</span>
            <div class="flex-1 h-px bg-gray-100" />
          </div>

          <!-- Google (always present) -->
          <button
            type="button"
            class="w-full flex items-center justify-center gap-2.5 rounded-xl border border-gray-200 bg-white hover:bg-gray-50 text-gray-700 text-sm font-medium py-2.5 transition-all shadow-sm disabled:opacity-50"
            :disabled="loading"
            @click="signInWithGoogle"
          >
            <svg width="16" height="16" viewBox="0 0 24 24">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continue with Google
          </button>

        </form>

        <!-- Bottom "Want a tour?" card -->
        <div class="mt-auto pt-10 w-full max-w-[420px]">
          <div class="rounded-2xl border border-gray-200 bg-gray-50 p-6">
            <div class="flex items-start justify-between gap-4">
              <div class="flex flex-col gap-1">
                <p class="text-[15px] font-semibold text-gray-900">Want a tour?</p>
                <p class="text-sm text-gray-500">See how KeepCabin organizes your receipts</p>
              </div>
              <div class="flex items-center -space-x-2 shrink-0">
                <img v-for="(t, i) in testimonials.slice(0,5)" :key="i"
                  :src="t.avatar" :alt="t.name"
                  class="size-8 rounded-full object-cover border-2 border-white shrink-0"
                />
              </div>
            </div>
            <button class="mt-4 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-sm transition-all">
              Schedule a Call
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" class="text-gray-400">
                <path d="M7 17L17 7M17 7H7M17 7v10"/>
              </svg>
            </button>
          </div>
        </div>

      </div>

      <!-- ─── RIGHT COLUMN ─── -->
      <div class="relative hidden lg:flex h-full items-center overflow-hidden border-l border-gray-100 bg-white">
        <!-- Random on/off dot grid -->
        <canvas ref="dotCanvas" class="absolute inset-0 w-full h-full" />
        <!-- Horizontal auto-scroll testimonials, centered vertically -->
        <div
          class="absolute inset-0 flex items-center"
          style="mask-image:linear-gradient(to right,transparent 0%,black 6%,black 94%,transparent 100%);-webkit-mask-image:linear-gradient(to right,transparent 0%,black 6%,black 94%,transparent 100%)"
        >
          <div class="flex gap-5 animate-marquee shrink-0 pl-8">
            <template v-for="(t, i) in [...testimonials, ...testimonials]" :key="i">
              <div
                class="shrink-0 flex flex-col rounded-2xl bg-white p-6 shadow-[0_2px_16px_rgba(0,0,0,0.08),0_0_0_1px_rgba(0,0,0,0.04)]"
                style="width:420px; height:240px"
              >
                <!-- Quote -->
                <p class="flex-1 text-[0.875rem] text-gray-800 leading-[1.6] font-normal tracking-[-0.01em]">
                  "{{ t.quote }}"
                </p>
                <!-- Bottom row -->
                <div class="flex items-center justify-between mt-4 shrink-0">
                  <!-- Avatar portrait + name -->
                  <div class="flex items-center gap-2.5">
                    <img
                      :src="t.avatar"
                      :alt="t.name"
                      class="size-9 rounded-full object-cover shrink-0"
                      style="box-shadow: 0 0 0 2px white, 0 0 0 3px #e5e7eb"
                    />
                    <div>
                      <p class="text-[12.5px] font-semibold text-gray-900 leading-snug">{{ t.name }}</p>
                      <p class="text-[11px] text-gray-400 leading-snug">{{ t.title }}</p>
                    </div>
                  </div>
                  <!-- Brand wordmark -->
                  <div class="flex items-center gap-1.5 shrink-0">
                    <span v-html="brandLogos[t.company]" class="flex-none leading-none" />
                    <span class="text-[13px] font-bold tracking-tight" :style="{ color: t.color }">{{ t.company }}</span>
                  </div>
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>

    </div>

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

<style scoped>
@keyframes marquee {
  from { transform: translateX(0); }
  to   { transform: translateX(-50%); }
}
.animate-marquee {
  animation: marquee 36s linear infinite;
}
.animate-marquee:hover {
  animation-play-state: paused;
}
</style>
