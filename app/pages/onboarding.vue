<script setup lang="ts">
import { useSupabase } from '~~/lib/supabase'
import { toast } from 'vue-sonner'

definePageMeta({ layout: false })

const supabase = useSupabase()
const orgName = ref('')
const orgSize = ref('1-10')
const loading = ref(false)

const sizes = ['1-10', '11-50', '51-200', '200+']

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
  <div class="fixed inset-0 flex bg-white select-none">
    <Sonner position="bottom-right" theme="light" rich-colors />

    <!-- ─── LEFT: form ─── -->
    <div class="flex h-full w-full shrink-0 flex-col items-center justify-center px-6 py-10 overflow-y-auto lg:w-1/2">

      <!-- Form -->
      <form class="flex flex-col gap-5 w-full max-w-[420px]" @submit.prevent="handleCreate">
        <div class="flex items-center gap-2 mb-2">
          <img src="/logo.svg" class="size-7 rounded-md" alt="KeepCabin" />
          <span class="text-[15px] font-semibold text-gray-900 tracking-tight">KeepCabin</span>
        </div>
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

    </div>

    <!-- ─── RIGHT: dot grid + illustration + steps ─── -->
    <div class="relative hidden lg:flex h-full w-1/2 items-center justify-center overflow-hidden border-l border-gray-100 bg-white">

      <!-- Dot grid -->
      <canvas ref="dotCanvas" class="absolute inset-0 w-full h-full" />

      <!-- Content on top of dots -->
      <div class="relative z-10 flex flex-col items-center gap-10 px-14">

        <!-- Receipt illustration -->
        <svg viewBox="0 0 280 220" fill="none" class="w-64" xmlns="http://www.w3.org/2000/svg">
          <!-- Receipt stack -->
          <rect x="44" y="44" width="160" height="130" rx="12" fill="#e5e7eb" transform="rotate(-4 44 44)"/>
          <rect x="44" y="44" width="160" height="130" rx="12" fill="#f3f4f6" transform="rotate(-1.5 44 44)"/>
          <!-- Main receipt -->
          <rect x="60" y="40" width="160" height="140" rx="12" fill="white" stroke="#e5e7eb" stroke-width="1.5"/>
          <!-- Receipt content lines -->
          <rect x="80" y="62" width="80" height="8" rx="4" fill="#d1d5db"/>
          <rect x="80" y="76" width="55" height="6" rx="3" fill="#e5e7eb"/>
          <rect x="80" y="98" width="120" height="1.5" rx="1" fill="#f3f4f6"/>
          <rect x="80" y="108" width="65" height="6" rx="3" fill="#e5e7eb"/>
          <rect x="160" y="108" width="40" height="6" rx="3" fill="#d1d5db"/>
          <rect x="80" y="122" width="65" height="6" rx="3" fill="#e5e7eb"/>
          <rect x="160" y="122" width="40" height="6" rx="3" fill="#d1d5db"/>
          <rect x="80" y="136" width="65" height="6" rx="3" fill="#e5e7eb"/>
          <rect x="160" y="136" width="40" height="6" rx="3" fill="#374151"/>
          <!-- Approved badge -->
          <rect x="162" y="52" width="44" height="22" rx="11" fill="#dcfce7" stroke="#86efac" stroke-width="1"/>
          <circle cx="174" cy="63" r="4" fill="#16a34a"/>
          <path d="M172.5 63l1 1 2.5-2.5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          <rect x="181" y="60" width="20" height="6" rx="3" fill="#16a34a" opacity="0.5"/>
          <!-- Coin badge -->
          <circle cx="220" cy="170" r="20" fill="#fef9c3" stroke="#fde68a" stroke-width="1.5"/>
          <path d="M213 170c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7" stroke="#ca8a04" stroke-width="1.5" stroke-linecap="round"/>
          <path d="M220 163v2M220 175v2" stroke="#ca8a04" stroke-width="1.5" stroke-linecap="round"/>
        </svg>

        <!-- Steps -->
        <div class="flex flex-col gap-5 w-full max-w-[280px]">
          <div class="flex items-start gap-4">
            <div class="size-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 bg-gray-900 text-white">1</div>
            <div>
              <p class="text-sm font-semibold text-gray-900">Create your organization</p>
              <p class="text-xs text-gray-500 mt-0.5 leading-relaxed">Set up your workspace. You'll be the owner.</p>
            </div>
          </div>
          <div class="flex items-start gap-4">
            <div class="size-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 bg-gray-200 text-gray-400">2</div>
            <div>
              <p class="text-sm font-semibold text-gray-400">Invite your team</p>
              <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">Add managers, finance staff, and employees.</p>
            </div>
          </div>
          <div class="flex items-start gap-4">
            <div class="size-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 bg-gray-200 text-gray-400">3</div>
            <div>
              <p class="text-sm font-semibold text-gray-400">Start tracking expenses</p>
              <p class="text-xs text-gray-400 mt-0.5 leading-relaxed">Employees submit receipts, managers approve, finance pays.</p>
            </div>
          </div>
        </div>

      </div>
    </div>

  </div>
</template>
