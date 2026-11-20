// Phones (or the installed PWA) visiting a web page that has a mobile version go to it.
// Any /app/<path> is sent to /m/<path> when a page exists for that path under app/pages/m/
// — so adding a mobile page is enough, no list to maintain.
export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  if (to.path !== '/app' && !to.path.startsWith('/app/')) return

  const isPhone = window.matchMedia('(max-width: 767px)').matches
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  if (!isPhone && !isStandalone) return

  const target = to.path.replace(/^\/app/, '/m')
  const resolved = useRouter().resolve(target)
  const hasMobilePage = resolved.matched.length > 0 && resolved.path.startsWith('/m')
    && resolved.matched.every(r => !r.path.includes(':pathMatch'))
  if (hasMobilePage) return navigateTo({ path: target, query: to.query, hash: to.hash }, { replace: true })
})
