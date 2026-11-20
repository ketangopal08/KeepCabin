<script setup lang="ts">
// Mobile (PWA) shell — phone-width column + floating pill tab bar.
const { load } = useOrgContext()
const { init: initAccentColor } = useAccentColor()
onMounted(() => {
  load()
  initAccentColor()
})

useHead({
  meta: [
    { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
    { name: 'apple-mobile-web-app-capable', content: 'yes' },
    { name: 'apple-mobile-web-app-status-bar-style', content: 'default' },
    { name: 'apple-mobile-web-app-title', content: 'KeepCabin' },
  ],
  link: [{ rel: 'apple-touch-icon', href: '/icons/icon-180.png' }],
  htmlAttrs: { class: 'm-app-root' },
})
</script>

<template>
  <div class="m-app min-h-dvh bg-background text-foreground">
    <NuxtPwaManifest />
    <Sonner position="top-center" theme="light" rich-colors />
    <main
      class="mx-auto w-full max-w-md px-4 pb-32"
      style="padding-top: max(env(safe-area-inset-top), 1rem)"
    >
      <slot />
    </main>
    <MobileTabBar />
  </div>
</template>

<style>
/* ── Native-app feel (scoped to the mobile shell only) ─────────────────────── */
html.m-app-root,
html.m-app-root body {
  overscroll-behavior-y: none;            /* no browser bounce / pull-to-reload */
}
.m-app {
  -webkit-tap-highlight-color: transparent;
  -webkit-touch-callout: none;
  user-select: none;
  touch-action: manipulation;             /* no 300ms double-tap zoom delay */
}
.m-app input,
.m-app textarea { user-select: text; }

/* Press feedback — scale down while finger is on it */
.m-press {
  transition: transform 160ms cubic-bezier(.2, .8, .2, 1), filter 160ms;
  will-change: transform;
}
.m-press:active {
  transform: scale(.97);
  filter: brightness(.97);
}

/* Staggered rise-in — set --d for delay */
@keyframes m-rise {
  from { opacity: 0; transform: translateY(14px) scale(.985); }
  to   { opacity: 1; transform: none; }
}
.m-rise {
  animation: m-rise 520ms cubic-bezier(.16, 1, .3, 1) backwards; /* backwards: releases transform after so :active press still works */
  animation-delay: var(--d, 0ms);
}

/* Page transitions between /m screens */
.m-page-enter-active,
.m-page-leave-active { transition: opacity 220ms ease, transform 280ms cubic-bezier(.16, 1, .3, 1); }
.m-page-enter-from { opacity: 0; transform: translateX(24px); }
.m-page-leave-to   { opacity: 0; transform: translateX(-12px); }

/* List items (filter / search changes) */
.m-list-move,
.m-list-enter-active,
.m-list-leave-active { transition: opacity 260ms ease, transform 320ms cubic-bezier(.16, 1, .3, 1); }
.m-list-enter-from { opacity: 0; transform: translateY(12px) scale(.98); }
.m-list-leave-to   { opacity: 0; transform: scale(.96); }
.m-list-leave-active { position: absolute; left: 0; right: 0; }

/* Swap fade (e.g. show/hide amount) */
.m-swap-enter-active,
.m-swap-leave-active { transition: opacity 180ms ease, filter 180ms ease, transform 180ms ease; }
.m-swap-enter-from,
.m-swap-leave-to { opacity: 0; filter: blur(6px); transform: translateY(4px); }

/* Bell wiggle when there are unread notifications */
@keyframes m-wiggle {
  0%, 60%, 100% { transform: rotate(0); }
  10%, 30%, 50% { transform: rotate(-12deg); }
  20%, 40%      { transform: rotate(12deg); }
}
.m-wiggle { animation: m-wiggle 1.6s ease-in-out 600ms 2; transform-origin: 50% 10%; }

@media (prefers-reduced-motion: reduce) {
  .m-app *, .m-app *::before, .m-app *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
  }
}
</style>
