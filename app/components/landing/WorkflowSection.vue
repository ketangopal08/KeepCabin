<script setup lang="ts">
import { ref } from 'vue'
import { useIntersectionObserver } from '@vueuse/core'
import {
  Zap, Sparkles, Split, Send, Receipt, ChevronDown, ChevronRight,
  Plus, ArrowRight, Ellipsis, CircleCheck, UserCheck, ShieldAlert,
} from '@lucide/vue'

const sectionEl = ref<HTMLElement | null>(null)
const revealed = ref(false)

const { stop } = useIntersectionObserver(
  sectionEl,
  ([{ isIntersecting }]) => {
    if (isIntersecting) {
      revealed.value = true
      stop()
    }
  },
  { threshold: 0.15 },
)

const routes = [
  { label: 'Under ₹5,000', dot: 'bg-[#05df72]' },
  { label: 'Over ₹5,000', dot: 'bg-[#3b82f6]' },
  { label: 'Flagged', dot: 'bg-[#f59e0b]' },
]

const outputs = [
  { icon: CircleCheck, color: 'text-[#05df72]', title: 'Auto-approve', sub: 'Mark approved instantly', top: 40 },
  { icon: UserCheck, color: 'text-[#3b82f6]', title: 'Manager approval', sub: 'Request sign-off', top: 200 },
  { icon: ShieldAlert, color: 'text-[#f59e0b]', title: 'Finance review', sub: 'Check policy & duplicates', top: 360 },
]

// Connector paths on the 1040×470 desktop canvas (card edges are fixed-size below)
const paths = [
  'M 220 140 C 240 140, 235 100, 255 100',   // Trigger → AI Agent
  'M 220 140 C 240 140, 235 340, 255 340',   // Trigger → Response
  'M 480 100 C 505 100, 500 215, 525 215',   // AI Agent → Router
  'M 725 215 C 765 215, 760 73, 800 73',     // Router → Auto-approve
  'M 725 215 C 765 215, 760 233, 800 233',   // Router → Manager approval
  'M 725 215 C 765 215, 760 393, 800 393',   // Router → Finance review
]

// Laser start time per path (s): trigger → agent/response, then router, then outputs
const laserDelay = [0, 0, 0.9, 1.8, 1.8, 1.8]

// Port dots at each connector end
const dots = [[220, 140], [255, 100], [255, 340], [480, 100], [525, 215], [725, 215], [800, 73], [800, 233], [800, 393]]
</script>

<template>
  <section id="workflow" ref="sectionEl" class="bg-[var(--lp-bg)] border-b border-[var(--lp-border-section)] py-24 px-6">
    <div class="max-w-[1088px] mx-auto px-6">

      <!-- Header -->
      <div>
        <p class="text-xs text-[var(--lp-muted)] tracking-widest uppercase mb-4">Workflows</p>
        <h2 class="text-[36px] md:text-[40px] font-bold text-[var(--lp-text)] leading-[1.1] mb-4">
          Smart approvals, on autopilot
        </h2>
        <p class="text-base text-[var(--lp-muted)] leading-relaxed lg:whitespace-nowrap">
          Every receipt is read, categorized and routed to the right approver — automatically.
        </p>
      </div>

      <!-- ── Desktop canvas ── -->
      <div
        class="hidden lg:block relative mt-14 mx-auto w-[1040px] h-[470px]"
        :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
      >
        <!-- Connectors -->
        <svg class="absolute inset-0 pointer-events-none" width="1040" height="470" fill="none">
          <defs>
            <filter id="wf-glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="2.5" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>
          <path v-for="(d, i) in paths" :key="i" :d="d" class="wf-line" stroke="var(--lp-faint)" stroke-width="1" />
          <!-- Green laser pulses travelling along each connector, staged left → right -->
          <path
            v-for="(d, i) in paths" :key="'laser-' + i" :d="d"
            pathLength="100" class="wf-laser" stroke="#05df72" stroke-width="2" stroke-linecap="round"
            filter="url(#wf-glow)" :style="{ animationDelay: `${laserDelay[i]}s` }"
          />
          <circle v-for="p in dots"
                  :key="p.join()" :cx.attr="p[0]" :cy.attr="p[1]" r="3" fill="var(--lp-bg)" stroke="var(--lp-muted)" stroke-width="1" />
        </svg>

        <!-- Trigger -->
        <div class="wf-card absolute left-0 top-[40px] w-[220px] h-[232px]">
          <div class="wf-head"><span class="flex items-center gap-2"><Zap class="size-3.5" /> Trigger</span><Ellipsis class="size-4 text-[var(--lp-muted)]" /></div>
          <div class="wf-field"><span class="flex items-center gap-2"><Receipt class="size-3.5 text-[#05df72]" /> New receipt uploaded</span><ChevronDown class="size-3.5" /></div>
          <p class="text-[11px] text-[var(--lp-text)] mt-3 mb-2">Conditions</p>
          <div class="wf-field"><span>Amount greater than</span><ChevronDown class="size-3.5" /></div>
          <div class="wf-field mt-2"><span>₹0</span></div>
          <p class="flex items-center gap-1.5 text-[11px] text-[var(--lp-muted)] mt-3"><Plus class="size-3" /> Add condition</p>
        </div>

        <!-- AI Agent -->
        <div class="wf-card absolute left-[255px] top-0 w-[225px] h-[200px] !border-[#05df72]/40 shadow-[0_0_24px_-8px_rgba(5,223,114,0.35)]">
          <div class="wf-head">
            <span class="flex items-center gap-2"><Sparkles class="size-3.5" /> AI Agent</span>
            <span class="flex items-center gap-1 rounded-[6px] bg-[#05df72]/15 border border-[#05df72]/40 text-[#05df72] text-[11px] px-2 py-0.5">Run <ArrowRight class="size-3" /></span>
          </div>
          <div class="rounded-[6px] bg-[var(--lp-card-inner)] p-2.5 text-[11.5px] leading-relaxed text-[var(--lp-muted)] h-[88px]">
            Read the receipt, extract merchant, date and amount, and detect the expense category.
          </div>
          <div class="flex gap-1.5 mt-3">
            <span v-for="t in ['Travel', 'Meals', 'Office']" :key="t" class="wf-tag">{{ t }}</span>
          </div>
        </div>

        <!-- Response -->
        <div class="wf-card absolute left-[255px] top-[240px] w-[225px] h-[200px]">
          <div class="wf-head"><span class="flex items-center gap-2"><Send class="size-3.5 text-[#a78bfa]" /> Response</span><Ellipsis class="size-4 text-[var(--lp-muted)]" /></div>
          <p class="text-[12px] text-[var(--lp-muted)] mb-2">Notify the employee</p>
          <div class="rounded-[6px] bg-[var(--lp-card-inner)] p-2.5 text-[11.5px] leading-relaxed text-[var(--lp-muted)] h-[96px]">
            “Your ₹2,340 receipt from Blue Tokai was received and categorized as Meals. We'll let you know once it's approved.”
          </div>
        </div>

        <!-- Router -->
        <div class="wf-card absolute left-[525px] top-[115px] w-[200px] h-[200px]">
          <div class="wf-head"><span class="flex items-center gap-2"><Split class="size-3.5 text-[#f87171]" /> Router</span><Ellipsis class="size-4 text-[var(--lp-muted)]" /></div>
          <p class="text-[12px] text-[var(--lp-text)] mb-2.5">Route by amount</p>
          <div v-for="r in routes" :key="r.label" class="wf-field mb-2">
            <span class="flex items-center gap-2"><span class="size-1.5 rounded-full" :class="r.dot" /> {{ r.label }}</span>
            <ChevronRight class="size-3.5" />
          </div>
        </div>

        <!-- Outputs -->
        <div
          v-for="o in outputs" :key="o.title"
          class="wf-card absolute left-[800px] w-[240px] h-[66px] !py-3 flex items-center gap-3"
          :style="{ top: `${o.top}px` }"
        >
          <div class="size-8 shrink-0 rounded-[8px] bg-[var(--lp-card-inner)] border border-[var(--lp-border)] flex items-center justify-center">
            <component :is="o.icon" class="size-4" :class="o.color" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-[12.5px] text-[var(--lp-text)] leading-tight">{{ o.title }}</p>
            <p class="text-[11px] text-[var(--lp-muted)] truncate">{{ o.sub }}</p>
          </div>
          <Ellipsis class="size-4 text-[var(--lp-muted)] self-start" />
        </div>
      </div>

      <!-- ── Mobile / tablet: stacked flow ── -->
      <div class="lg:hidden mt-12 flex flex-col items-stretch max-w-[420px] mx-auto">
        <template v-for="(step, i) in [
          { icon: Zap, color: '', title: 'Trigger', body: 'New receipt uploaded' },
          { icon: Sparkles, color: 'text-[#05df72]', title: 'AI Agent', body: 'Extract merchant, date & amount, detect category' },
          { icon: Split, color: 'text-[#f87171]', title: 'Router', body: 'Under ₹5,000 · Over ₹5,000 · Flagged' },
          { icon: CircleCheck, color: 'text-[#05df72]', title: 'Approve or escalate', body: 'Auto-approve, manager sign-off or finance review' },
        ]" :key="step.title">
          <div
            class="wf-card flex items-start gap-3"
            :class="revealed ? 'animate-fade-blur-in-up' : 'opacity-0'"
            :style="{ animationDelay: `${i * 100}ms` }"
          >
            <component :is="step.icon" class="size-4 mt-0.5 shrink-0" :class="step.color" />
            <div>
              <p class="text-[13px] text-[var(--lp-text)]">{{ step.title }}</p>
              <p class="text-[12px] text-[var(--lp-muted)] mt-0.5">{{ step.body }}</p>
            </div>
          </div>
          <div v-if="i < 3" class="mx-auto h-6 border-l border-dashed border-[var(--lp-faint)]" />
        </template>
      </div>

    </div>
  </section>
</template>

<style scoped>
.wf-card {
  background: var(--lp-card);
  border: 1px solid var(--lp-border);
  border-radius: 10px;
  padding: 14px;
}
.wf-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: var(--lp-text);
  margin-bottom: 12px;
}
.wf-field {
  display: flex;
  align-items: center;
  justify-content: space-between;
  background: var(--lp-card-inner);
  border: 1px solid var(--lp-border);
  border-radius: 6px;
  padding: 6px 9px;
  font-size: 11.5px;
  color: var(--lp-text);
}
.wf-tag {
  font-size: 11px;
  color: var(--lp-text);
  background: var(--lp-card-inner);
  border: 1px solid var(--lp-border);
  border-radius: 5px;
  padding: 2px 8px;
}
.wf-line {
  stroke-dasharray: 4 4;
  animation: wf-flow 1.2s linear infinite;
}
@keyframes wf-flow {
  to { stroke-dashoffset: -8; }
}
/* Short green beam travels each path once per 2.7s cycle */
.wf-laser {
  stroke-dasharray: 18 182;
  stroke-dashoffset: 18;
  opacity: 0;
  animation: wf-laser 2.7s ease-in-out infinite;
}
@keyframes wf-laser {
  0%   { stroke-dashoffset: 18;   opacity: 1; }
  33%  { stroke-dashoffset: -100; opacity: 1; }
  34%, 100% { stroke-dashoffset: -100; opacity: 0; }
}
@media (prefers-reduced-motion: reduce) {
  .wf-line, .wf-laser { animation: none; }
}
</style>
