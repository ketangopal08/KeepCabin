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

      <!-- Form -->
      <form class="flex flex-col gap-5 w-full max-w-[420px]" @submit.prevent="handleCreate">
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

      <div class="mt-auto pt-10 w-full max-w-[420px]">
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
    <div class="relative hidden lg:flex h-full w-1/2 items-center justify-center overflow-hidden border-l border-gray-100 bg-[#fafafa]">

      <!-- Dot grid -->
      <canvas ref="dotCanvas" class="absolute inset-0 w-full h-full opacity-60" />

      <!-- App preview mockup card -->
      <div class="relative z-10 flex flex-col items-center gap-8 px-10 w-full max-w-[440px]">

        <!-- Mini app UI mockup -->
        <div class="w-full rounded-xl border border-[#e2e2e2] bg-white shadow-[0_4px_24px_rgba(0,0,0,0.07)] overflow-hidden">

          <!-- Mockup titlebar -->
          <div class="flex items-center gap-1.5 px-3 py-2.5 border-b border-[#f0f0f0] bg-[#fafafa]">
            <div class="size-2.5 rounded-full bg-[#ff5f57]"/>
            <div class="size-2.5 rounded-full bg-[#febc2e]"/>
            <div class="size-2.5 rounded-full bg-[#28c840]"/>
            <div class="flex-1 mx-3 h-4 rounded-md bg-[#efefef]"/>
          </div>

          <!-- Mockup body: sidebar + content -->
          <div class="flex" style="height:220px">

            <!-- Mini sidebar -->
            <div class="flex flex-col w-[140px] shrink-0 border-r border-[#efefef] bg-white">
              <!-- Sidebar header -->
              <div class="flex items-center gap-1.5 px-2.5 py-2 border-b border-[#f5f5f5]">
                <div class="size-3 rounded-[3px] bg-[#6366f1]"/>
                <div class="h-2 flex-1 rounded bg-[#e5e5e5]"/>
                <div class="size-2 rounded-sm bg-[#efefef]"/>
              </div>
              <!-- Search -->
              <div class="px-2 py-1.5 border-b border-[#f5f5f5]">
                <div class="h-4 rounded-md bg-[#f5f5f5]"/>
              </div>
              <!-- Nav items -->
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

            <!-- Mini content area -->
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

        <!-- Steps — sidebar-nav style -->
        <div class="w-full flex flex-col">
          <!-- Step 1: active -->
          <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-white border border-[#e8e8e8] shadow-[0_1px_4px_rgba(0,0,0,0.04)] mb-1.5">
            <div class="size-6 rounded-full bg-gray-900 flex items-center justify-center shrink-0">
              <svg class="size-3 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20 6L9 17l-5-5"/></svg>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-semibold text-gray-900">Set up your organization</p>
              <p class="text-[11.5px] text-gray-400 truncate">Name your workspace — you'll be the owner</p>
            </div>
            <div class="size-1.5 rounded-full bg-gray-900 shrink-0"/>
          </div>

          <!-- Step 2 -->
          <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg mb-1.5 opacity-50">
            <div class="size-6 rounded-full border-2 border-gray-300 flex items-center justify-center shrink-0">
              <span class="text-[10px] font-bold text-gray-400">2</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-gray-500">Invite your team</p>
              <p class="text-[11.5px] text-gray-400 truncate">Add managers, finance, and employees</p>
            </div>
          </div>

          <!-- Step 3 -->
          <div class="flex items-center gap-3 px-3 py-2.5 rounded-lg opacity-35">
            <div class="size-6 rounded-full border-2 border-gray-200 flex items-center justify-center shrink-0">
              <span class="text-[10px] font-bold text-gray-300">3</span>
            </div>
            <div class="flex-1 min-w-0">
              <p class="text-[13px] font-medium text-gray-400">Start tracking expenses</p>
              <p class="text-[11.5px] text-gray-300 truncate">Submit, approve, and reimburse</p>
            </div>
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
