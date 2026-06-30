<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: false })

const supabase = useSupabase()
const orgName = ref('')
const orgSize = ref('1-10')
const loading = ref(false)

const sizes = ['1-10', '11-50', '51-200', '200+']

const steps = [
  {
    n: '1',
    title: 'Create your organization',
    desc: 'Set up your workspace. You\'ll be the owner.',
    active: true,
  },
  {
    n: '2',
    title: 'Invite your team',
    desc: 'Add managers, finance staff, and employees.',
    active: false,
  },
  {
    n: '3',
    title: 'Start tracking expenses',
    desc: 'Employees submit receipts, managers approve, finance pays.',
    active: false,
  },
]

async function handleCreate() {
  if (!orgName.value.trim()) { toast.error('Please enter your company name.'); return }
  loading.value = true
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await $fetch('/api/orgs/create', {
      method: 'POST',
      headers: { Authorization: `Bearer ${session!.access_token}` },
      body: { name: orgName.value.trim(), size: orgSize.value },
    })
    toast.success('Organization created!')
    await navigateTo('/app')
  } catch (e: any) {
    toast.error(e?.data?.message ?? 'Something went wrong.')
  } finally {
    loading.value = false
  }
}

onMounted(async () => {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) { navigateTo('/login'); return }
})
</script>

<template>
  <div class="fixed inset-0 flex bg-white select-none">
    <Sonner position="bottom-right" theme="light" rich-colors />

    <!-- ─── LEFT: illustration + steps ─── -->
    <div class="hidden lg:flex flex-col justify-between w-1/2 bg-gray-50 border-r border-gray-100 px-14 py-12">

      <!-- Logo -->
      <div class="flex items-center gap-2">
        <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
        <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
      </div>

      <!-- Illustration -->
      <div class="flex flex-col items-center gap-10">
        <svg viewBox="0 0 320 260" fill="none" class="w-72 opacity-90" xmlns="http://www.w3.org/2000/svg">
          <!-- Background card -->
          <rect x="30" y="30" width="260" height="200" rx="20" fill="#f9fafb" stroke="#e5e7eb" stroke-width="1.5"/>
          <!-- Receipt stack shadow -->
          <rect x="54" y="54" width="170" height="140" rx="12" fill="#e5e7eb" transform="rotate(-4 54 54)"/>
          <rect x="54" y="54" width="170" height="140" rx="12" fill="#f3f4f6" transform="rotate(-1.5 54 54)"/>
          <!-- Main receipt -->
          <rect x="75" y="50" width="170" height="150" rx="12" fill="white" stroke="#e5e7eb" stroke-width="1.5"/>
          <!-- Receipt lines -->
          <rect x="95" y="76" width="90" height="8" rx="4" fill="#d1d5db"/>
          <rect x="95" y="92" width="60" height="6" rx="3" fill="#e5e7eb"/>
          <rect x="95" y="114" width="130" height="1.5" rx="1" fill="#f3f4f6"/>
          <rect x="95" y="124" width="70" height="6" rx="3" fill="#e5e7eb"/>
          <rect x="175" y="124" width="50" height="6" rx="3" fill="#d1d5db"/>
          <rect x="95" y="138" width="70" height="6" rx="3" fill="#e5e7eb"/>
          <rect x="175" y="138" width="50" height="6" rx="3" fill="#d1d5db"/>
          <rect x="95" y="152" width="70" height="6" rx="3" fill="#e5e7eb"/>
          <rect x="175" y="152" width="50" height="6" rx="3" fill="#374151"/>
          <!-- Approved badge -->
          <rect x="185" y="62" width="44" height="22" rx="11" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
          <circle cx="197" cy="73" r="4" fill="#16a34a"/>
          <path d="M195.5 73l1 1 2.5-2.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="204" y="70" width="20" height="6" rx="3" fill="#16a34a" opacity="0.5"/>
          <!-- Coins / money icon bottom right -->
          <circle cx="248" cy="195" r="22" fill="#fef9c3" stroke="#fde68a" stroke-width="1.5"/>
          <path d="M241 195c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7" stroke="#ca8a04" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M248 188v2M248 200v2" stroke="#ca8a04" stroke-width="1.5" stroke-linecap="round"/>
          <!-- Arrow flow -->
          <path d="M60 160 Q40 180 60 200" stroke="#9ca3af" stroke-width="1.5" stroke-dasharray="4 3" stroke-linecap="round"/>
        </svg>

        <!-- Steps -->
        <div class="flex flex-col gap-5 w-full max-w-xs">
          <div v-for="step in steps" :key="step.n" class="flex items-start gap-4">
            <div :class="[
              'size-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5',
              step.active ? 'bg-gray-900 text-white' : 'bg-gray-200 text-gray-500'
            ]">{{ step.n }}</div>
            <div>
              <p :class="['text-sm font-semibold', step.active ? 'text-gray-900' : 'text-gray-400']">{{ step.title }}</p>
              <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">{{ step.desc }}</p>
            </div>
          </div>
        </div>
      </div>

      <p class="text-xs text-gray-400">© 2026 KeepCabin</p>
    </div>

    <!-- ─── RIGHT: form ─── -->
    <div class="flex flex-1 flex-col items-center justify-center px-6 py-12 overflow-y-auto">
      <!-- Mobile logo -->
      <div class="flex items-center gap-2 mb-10 lg:hidden">
        <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
        <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
      </div>

      <div class="w-full max-w-[420px] flex flex-col gap-6">
        <div>
          <h1 class="text-2xl font-normal text-gray-800">Set up your organization</h1>
          <p class="text-sm text-gray-500 mt-1">You'll be the owner. Invite your team next.</p>
        </div>

        <form class="flex flex-col gap-4" @submit.prevent="handleCreate">
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
      </div>
    </div>

  </div>
</template>
