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
let   sessionToken: string | null = null  // set if already logged in with correct email

const name        = ref('')
const password    = ref('')
const accepting   = ref(false)
const formLoading = ref(false)

onMounted(async () => {
  if (!token) { errorMsg.value = 'Invalid invite link.'; step.value = 'error'; return }

  try {
    inviteInfo.value = await $fetch('/api/invites/validate', { query: { token } })
  } catch (e: any) {
    errorMsg.value = e?.data?.message ?? 'This invite link is invalid or has expired.'
    step.value = 'error'
    return
  }

  // Already logged in?
  const { data: { session } } = await supabase.auth.getSession()
  if (session) {
    if (session.user.email !== inviteInfo.value!.email) {
      errorMsg.value = `This invite was sent to ${inviteInfo.value!.email}. Please sign in with that account.`
      step.value = 'error'
      return
    }
    sessionToken = session.access_token
  }

  step.value = 'accept'
})

// Step 1: user clicks "Accept invite"
async function handleAccept() {
  if (sessionToken) {
    // Already authenticated with the right account — accept immediately
    accepting.value = true
    try {
      await doAccept(sessionToken)
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Something went wrong.')
    } finally {
      accepting.value = false
    }
    return
  }

  // Not logged in — check whether this email already has an account
  accepting.value = true
  try {
    const { exists } = await $fetch<{ exists: boolean }>('/api/auth/check-email', {
      method: 'POST',
      body: { email: inviteInfo.value!.email },
    })
    step.value = exists ? 'signin' : 'create'
  } catch {
    step.value = 'create'
  } finally {
    accepting.value = false
  }
}

async function doAccept(accessToken: string) {
  await $fetch('/api/invites/accept', {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: { token },
  })
  step.value = 'welcome'
}

// Step 2 (new user): create account then accept
async function handleCreate() {
  if (!name.value.trim())        { toast.error('Please enter your name.'); return }
  if (password.value.length < 6) { toast.error('Password must be at least 6 characters.'); return }
  formLoading.value = true
  try {
    const { data, error: err } = await supabase.auth.signUp({
      email:    inviteInfo.value!.email,
      password: password.value,
      options:  { data: { full_name: name.value.trim() } },
    })
    if (err) throw err
    if (!data.session) throw new Error('Please confirm your email address first, then return to this link.')
    await doAccept(data.session.access_token)
  } catch (e: any) {
    toast.error(e?.message ?? 'Something went wrong.')
  } finally {
    formLoading.value = false
  }
}

// Step 2 (existing user): sign in then accept
async function handleSignIn() {
  if (!password.value) { toast.error('Please enter your password.'); return }
  formLoading.value = true
  try {
    const { data, error: err } = await supabase.auth.signInWithPassword({
      email:    inviteInfo.value!.email,
      password: password.value,
    })
    if (err) throw err
    await doAccept(data.session!.access_token)
  } catch (e: any) {
    toast.error(e?.message ?? 'Something went wrong.')
  } finally {
    formLoading.value = false
  }
}
</script>

<template>
  <div class="fixed inset-0 flex items-center justify-center bg-white px-4">
    <Sonner position="bottom-right" theme="light" rich-colors />

    <div class="w-full max-w-[420px] flex flex-col gap-8">

      <!-- Logo -->
      <div class="flex items-center gap-2">
        <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
        <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
      </div>

      <!-- ── Loading ── -->
      <div v-if="step === 'loading'" class="flex flex-col gap-3">
        <div class="h-8 w-52 bg-gray-100 rounded-lg animate-pulse" />
        <div class="h-4 w-full bg-gray-100 rounded animate-pulse" />
        <div class="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
        <div class="h-11 w-full bg-gray-100 rounded-xl animate-pulse mt-3" />
      </div>

      <!-- ── Error ── -->
      <div v-else-if="step === 'error'" class="flex flex-col gap-4">
        <div>
          <h1 style="font-size:1.6rem;font-weight:400;color:#333">Invite unavailable</h1>
          <p class="text-[14px] text-red-500 mt-1.5">{{ errorMsg }}</p>
        </div>
        <NuxtLink to="/login" class="text-sm text-gray-500 underline underline-offset-2">Go to login</NuxtLink>
      </div>

      <!-- ── Step 1: Accept screen ── -->
      <template v-else-if="step === 'accept'">
        <div class="flex flex-col gap-5">
          <!-- Org icon + invite info -->
          <div class="flex items-start gap-4 p-5 rounded-2xl border border-gray-200 bg-gray-50">
            <div class="size-12 rounded-xl bg-gray-900 flex items-center justify-center text-white font-bold text-base shrink-0">
              {{ (inviteInfo?.org_name ?? 'KC').slice(0, 2).toUpperCase() }}
            </div>
            <div class="flex flex-col gap-0.5 min-w-0">
              <p class="text-[13px] text-gray-500 font-medium">You've been invited to</p>
              <p class="text-[16px] font-semibold text-gray-900 truncate">{{ inviteInfo?.org_name }}</p>
              <p class="text-[13px] text-gray-500 mt-0.5">
                Role: <span class="capitalize text-gray-700 font-medium">{{ inviteInfo?.role }}</span>
                <template v-if="inviteInfo?.team_name">
                  &nbsp;&middot;&nbsp;Team: <span class="text-gray-700 font-medium">{{ inviteInfo.team_name }}</span>
                </template>
              </p>
            </div>
          </div>

          <div>
            <h1 style="font-size:1.6rem;font-weight:400;color:#333">Accept your invite</h1>
            <p class="text-[14px] text-gray-500 mt-1">
              Sent to <strong class="text-gray-700 font-medium">{{ inviteInfo?.email }}</strong>.
              <template v-if="!sessionToken"> You'll set up your login after accepting.</template>
              <template v-else> You're already signed in.</template>
            </p>
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
      </template>

      <!-- ── Step 2a: Create account (new user) ── -->
      <template v-else-if="step === 'create'">
        <div class="flex flex-col gap-1">
          <h1 style="font-size:1.6rem;font-weight:400;color:#333">Create your login</h1>
          <p class="text-[14px] text-gray-500 mt-0.5">
            Set up a password for <strong class="text-gray-700 font-medium">{{ inviteInfo?.email }}</strong>.
          </p>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="handleCreate">
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Email address</label>
            <input
              :value="inviteInfo?.email"
              type="email"
              readonly
              class="w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200 outline-none cursor-default select-none"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Your name</label>
            <input
              v-model="name"
              type="text"
              placeholder="Jane Smith"
              autocomplete="name"
              autofocus
              class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Create a password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Min. 6 characters"
              autocomplete="new-password"
              class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all"
            />
          </div>

          <button
            type="submit"
            :disabled="formLoading"
            class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
          >
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
      </template>

      <!-- ── Step 2b: Sign in (existing user) ── -->
      <template v-else-if="step === 'signin'">
        <div class="flex flex-col gap-1">
          <h1 style="font-size:1.6rem;font-weight:400;color:#333">Sign in to continue</h1>
          <p class="text-[14px] text-gray-500 mt-0.5">
            Enter the password for <strong class="text-gray-700 font-medium">{{ inviteInfo?.email }}</strong>.
          </p>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="handleSignIn">
          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Email address</label>
            <input
              :value="inviteInfo?.email"
              type="email"
              readonly
              class="w-full px-4 py-2.5 text-sm text-gray-400 bg-gray-50 rounded-xl border border-gray-200 outline-none cursor-default select-none"
            />
          </div>

          <div class="flex flex-col gap-1.5">
            <label class="text-[13px] font-medium text-gray-500">Password</label>
            <input
              v-model="password"
              type="password"
              placeholder="Your password"
              autocomplete="current-password"
              autofocus
              class="w-full px-4 py-2.5 text-sm text-gray-900 bg-white rounded-xl border border-gray-200 outline-none shadow-sm placeholder:text-gray-400 focus:border-gray-400 focus:shadow-[0_0_0_3px_rgba(0,0,0,0.06)] transition-all"
            />
          </div>

          <button
            type="submit"
            :disabled="formLoading"
            class="w-full py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all disabled:opacity-50 flex items-center justify-center gap-2 mt-1"
          >
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
      </template>

      <!-- ── Step 3: Welcome screen ── -->
      <template v-else-if="step === 'welcome'">
        <div class="flex flex-col items-center text-center gap-6 py-2">
          <!-- Animated checkmark -->
          <div class="relative size-20 flex items-center justify-center">
            <div class="absolute inset-0 rounded-full bg-[#f0fce8] border-2 border-[#c5e8a0]" />
            <svg class="relative size-9 text-[#3a7a0a] welcome-check" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M20 6L9 17l-5-5" />
            </svg>
          </div>

          <div class="flex flex-col gap-2">
            <h1 style="font-size:1.8rem;font-weight:400;color:#1a1a1a">Welcome aboard!</h1>
            <p class="text-[14.5px] text-gray-500 leading-relaxed max-w-[300px] mx-auto">
              You've joined <strong class="text-gray-800 font-semibold">{{ inviteInfo?.org_name }}</strong> as
              a <strong class="text-gray-800 font-semibold capitalize">{{ inviteInfo?.role }}</strong><template v-if="inviteInfo?.team_name">&thinsp;in <strong class="text-gray-800 font-semibold">{{ inviteInfo.team_name }}</strong></template>.
            </p>
          </div>

          <NuxtLink
            to="/app"
            class="w-full max-w-[300px] py-2.5 rounded-xl bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium shadow-sm transition-all flex items-center justify-center gap-2"
          >
            Get Started
            <svg class="size-4 opacity-60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
              <path d="M5 12h14M13 6l6 6-6 6"/>
            </svg>
          </NuxtLink>
        </div>
      </template>

    </div>
  </div>
</template>

<style scoped>
.welcome-check {
  stroke-dasharray: 28;
  stroke-dashoffset: 28;
  animation: draw-check 0.45s cubic-bezier(0.22, 1, 0.36, 1) 0.1s forwards;
}
@keyframes draw-check {
  to { stroke-dashoffset: 0; }
}
</style>
