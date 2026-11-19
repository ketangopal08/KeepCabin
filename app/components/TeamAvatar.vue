<script setup lang="ts">
const props = defineProps<{ name: string; size?: 'sm' | 'md' | 'lg' }>()

// Gradient tiles — GitHub dark-mode palette (see app/utils/avatarColors.ts)
const GRADIENTS = TEAM_GRADIENTS

// White glyphs: a soft (translucent) layer + a solid layer
const GLYPHS = [
  // Orbit — ring with a satellite dot
  `<circle cx="12" cy="12" r="7.5" fill="none" stroke="white" stroke-width="2" opacity="0.45"/><circle cx="12" cy="12" r="3.5" fill="white"/><circle cx="18.2" cy="7.6" r="2" fill="white"/>`,
  // Stacked layers
  `<path d="M12 3.5L21 8L12 12.5L3 8Z" fill="white"/><path d="M4.2 11.6L12 15.5L19.8 11.6L21 12.2L12 16.7L3 12.2Z" fill="white" opacity="0.6"/><path d="M4.2 15.6L12 19.5L19.8 15.6L21 16.2L12 20.7L3 16.2Z" fill="white" opacity="0.35"/>`,
  // Sun rise — half disc over horizon lines
  `<path d="M5 15a7 7 0 0 1 14 0Z" fill="white"/><rect x="3" y="16.6" width="18" height="1.8" rx="0.9" fill="white" opacity="0.6"/><rect x="6" y="19.6" width="12" height="1.8" rx="0.9" fill="white" opacity="0.35"/>`,
  // Four-point spark
  `<path d="M12 2.5C12.8 8 16 11.2 21.5 12C16 12.8 12.8 16 12 21.5C11.2 16 8 12.8 2.5 12C8 11.2 11.2 8 12 2.5Z" fill="white"/><circle cx="19" cy="5" r="1.6" fill="white" opacity="0.5"/>`,
  // Dot grid with one highlight
  `<g fill="white" opacity="0.4"><circle cx="6" cy="6" r="2"/><circle cx="12" cy="6" r="2"/><circle cx="6" cy="12" r="2"/><circle cx="18" cy="12" r="2"/><circle cx="12" cy="18" r="2"/><circle cx="18" cy="18" r="2"/></g><circle cx="18" cy="6" r="2.4" fill="white"/><circle cx="12" cy="12" r="2.4" fill="white"/><circle cx="6" cy="18" r="2.4" fill="white"/>`,
  // Overlapping quarter petals
  `<path d="M4 20V12a8 8 0 0 1 8 8Z" fill="white" opacity="0.45"/><path d="M12 12V4a8 8 0 0 1 8 8Z" fill="white" opacity="0.45"/><path d="M12 20a8 8 0 0 1-8-8h8Z" fill="white"/><path d="M20 12a8 8 0 0 1-8 8v-8Z" fill="white" opacity="0.75"/>`,
  // Double chevron (forward motion)
  `<path d="M5 5.5L11.5 12L5 18.5" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" opacity="0.45"/><path d="M12 5.5L18.5 12L12 18.5" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  // Crescent + star
  `<path d="M14.5 3.5a8.5 8.5 0 1 0 6 14.5A7 7 0 0 1 14.5 3.5Z" fill="white"/><path d="M18 4l.7 1.6L20.3 6.3l-1.6.7L18 8.6l-.7-1.6-1.6-.7 1.6-.7Z" fill="white" opacity="0.6"/>`,
]

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0
  return h
}

const gradient = computed(() => GRADIENTS[hash(props.name) % GRADIENTS.length]!)
const glyph = computed(() => GLYPHS[hash(props.name + 'glyph') % GLYPHS.length])

const sizeClass = computed(() => {
  if (props.size === 'sm') return 'size-7 rounded-lg'
  if (props.size === 'lg') return 'size-12 rounded-xl'
  return 'size-9 rounded-[10px]'
})
</script>

<template>
  <div
    :class="[sizeClass, 'relative flex shrink-0 items-center justify-center overflow-hidden shadow-sm']"
    :style="{ background: `linear-gradient(135deg, ${gradient[0]} 0%, ${gradient[1]} 100%)` }"
  >
    <!-- soft top highlight -->
    <div class="pointer-events-none absolute inset-0 bg-gradient-to-b from-white/25 to-transparent" />
    <svg viewBox="0 0 24 24" class="relative size-[56%]" xmlns="http://www.w3.org/2000/svg">
      <!-- eslint-disable-next-line vue/no-v-html -->
      <g v-html="glyph" />
    </svg>
  </div>
</template>
