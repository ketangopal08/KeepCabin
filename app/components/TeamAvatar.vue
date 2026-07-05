<script setup lang="ts">
const props = defineProps<{ name: string; size?: 'sm' | 'md' | 'lg' }>()

const COLORS = [
  { bg: '#ede9fe', shape: '#7c3aed' }, // violet
  { bg: '#d1fae5', shape: '#059669' }, // emerald
  { bg: '#fed7aa', shape: '#ea580c' }, // orange
  { bg: '#dbeafe', shape: '#2563eb' }, // blue
  { bg: '#fce7f3', shape: '#db2777' }, // pink
  { bg: '#fef9c3', shape: '#ca8a04' }, // yellow
  { bg: '#ccfbf1', shape: '#0d9488' }, // teal
  { bg: '#e0e7ff', shape: '#4338ca' }, // indigo
]

// 6 two-layer shape combos: background (low opacity) + foreground (full)
const SHAPES = [
  // Concentric circles — outer ring + inner filled sphere
  `<circle cx="12" cy="12" r="9" opacity="0.28"/><circle cx="12" cy="12" r="5.5"/>`,
  // Offset stacked blocks
  `<rect x="3" y="7" width="13" height="12" rx="3.5" opacity="0.3"/><rect x="8" y="5" width="13" height="12" rx="3.5"/>`,
  // Arrow head + base bar
  `<rect x="4" y="15.5" width="16" height="5" rx="2.5" opacity="0.35"/><path d="M6 15L12 4.5L18 15H6z"/>`,
  // Nested diamonds
  `<path d="M12 2L22 12L12 22L2 12Z" opacity="0.28"/><path d="M12 6L18.5 12L12 18L5.5 12Z"/>`,
  // Hexagon shell + center circle
  `<path d="M12 2L21.5 7V17L12 22L2.5 17V7Z" opacity="0.28"/><circle cx="12" cy="12" r="4.5"/>`,
  // Rounded square backdrop + plus/cross
  `<rect x="3" y="3" width="18" height="18" rx="5" opacity="0.28"/><path d="M10 5h4v5h5v4h-5v5h-4v-5h-5v-4h5z"/>`,
]

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const color = computed(() => COLORS[hash(props.name) % COLORS.length])
const shape = computed(() => SHAPES[hash(props.name + 'shape') % SHAPES.length])

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'size-7'
  if (props.size === 'lg') return 'size-12'
  return 'size-9'
})
</script>

<template>
  <div
    :class="[sizeClass, 'rounded-xl flex items-center justify-center shrink-0 overflow-hidden']"
    :style="{ background: color.bg }"
  >
    <svg viewBox="0 0 24 24" class="size-[55%]" :fill="color.shape" xmlns="http://www.w3.org/2000/svg">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <g v-html="shape" />
    </svg>
  </div>
</template>
