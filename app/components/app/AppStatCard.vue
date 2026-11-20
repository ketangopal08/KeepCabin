<script setup lang="ts">
const props = defineProps<{
  label: string
  value: string | number
  sub?: string
  /** Iconify name, e.g. 'solar:wallet-money-linear' */
  icon?: string
  /** Optional % change shown as a small badge (positive = up) */
  trend?: number
  /** Optional data for the dot strip; when omitted a stable decorative pattern is drawn */
  series?: number[]
  /** positive → brand lime, negative (waiting / overdue) → orange. Colours the highlighted dots. */
  tone?: 'positive' | 'negative'
}>()

const COLS = 44
const ROWS = 8

// Stable pseudo-random column heights from the label, so each card keeps its own shape.
function seeded(seed: string, n: number): number[] {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) h = Math.imul(h ^ seed.charCodeAt(i), 16777619)
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)
    const r = ((h >>> 0) % 1000) / 1000
    const wave = 0.45 + 0.35 * Math.sin((i / n) * Math.PI * 2.2 + seed.length)
    out.push(Math.min(1, Math.max(0.12, wave * 0.7 + r * 0.45)))
  }
  return out
}

const columns = computed(() => {
  const src = props.series?.length ? props.series : seeded(props.label, COLS)
  const max = Math.max(...src, 1e-9)
  // Resample to COLS columns
  const vals = Array.from({ length: COLS }, (_, i) => src[Math.floor((i / COLS) * src.length)]! / max)
  // Highlight the band around the tallest stretch (like the reference), or the last third for real data
  const peak = props.series?.length ? COLS - 1 : vals.indexOf(Math.max(...vals))
  const from = Math.max(0, Math.min(COLS - 11, peak - 5))
  return vals.map((v, i) => ({
    filled: Math.max(1, Math.round(v * ROWS)),
    hot: i >= from && i < from + 11,
  }))
})

// Positive KPIs use the brand lime (logo background #C8E63C); negative ones use orange.
const BRAND_LIME = '#C8E63C'
const ORANGE = '#f97316'
const accent = computed(() => (props.tone === 'negative' ? ORANGE : BRAND_LIME))
const dotStyle = computed(() => ({ backgroundColor: accent.value }))

// Colour the highlight only when the KPI has a real, non-zero value ("—", 0, ₹0 stay grey).
const hasValue = computed(() => {
  if (typeof props.value === 'number') return props.value > 0
  const digits = String(props.value).replace(/[^0-9.]/g, '')
  return digits !== '' && Number(digits) > 0
})
</script>

<template>
  <Card class="relative h-[100px] gap-0 overflow-hidden rounded-2xl px-5 pt-3 pb-3">
    <!-- Dot graph as the card background (fades out towards the top so text stays readable) -->
    <div
      class="pointer-events-none absolute inset-x-0 bottom-0 flex h-[44px] items-end justify-between"
      style="mask-image: linear-gradient(to top, black 45%, transparent); -webkit-mask-image: linear-gradient(to top, black 45%, transparent);"
      aria-hidden="true"
    >
      <div v-for="(col, i) in columns" :key="i" class="flex flex-col-reverse gap-[2.5px]">
        <span
          v-for="r in ROWS"
          :key="r"
          class="block size-[3px] rounded-full"
          :class="r <= col.filled
            ? (col.hot && hasValue ? '' : 'bg-muted-foreground/25')
            : 'bg-muted-foreground/[0.06]'"
          :style="r <= col.filled && col.hot && hasValue ? dotStyle : undefined"
        />
      </div>
    </div>

    <div class="relative z-10">
    <!-- Header -->
    <div class="flex items-center justify-between gap-2">
      <div class="flex min-w-0 items-center gap-2">
        <Icon v-if="icon" :name="icon" class="size-[18px] shrink-0 text-muted-foreground" />
        <span class="truncate text-[13.5px] text-muted-foreground">{{ label }}</span>
      </div>
      <span
        v-if="trend !== undefined && trend !== null"
        class="flex shrink-0 items-center gap-0.5 rounded-md border border-border px-1.5 py-0.5 text-[12px] tabular-nums text-foreground"
      >
        <Icon
          :name="trend >= 0 ? 'solar:arrow-up-linear' : 'solar:arrow-down-linear'"
          class="size-3.5"
          :class="trend >= 0 ? 'text-emerald-500' : 'text-destructive'"
        />
        {{ Math.abs(trend).toFixed(1) }}%
      </span>
    </div>

    <!-- Value -->
    <div class="mt-2 truncate text-[30px] leading-none font-semibold tracking-tight tabular-nums text-foreground">{{ value }}</div>
    <div class="mt-1 h-4 truncate text-[12.5px] text-muted-foreground">{{ sub }}</div>
    </div>
  </Card>
</template>
