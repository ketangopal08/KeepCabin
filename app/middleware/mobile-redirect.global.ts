// Phones (or the installed PWA) visiting the web dashboard home go to the mobile UI.
// Only /app → /m for now; extend MOBILE_ROUTES as more mobile screens are built.
const MOBILE_ROUTES: Record<string, string> = {
  '/app': '/m',
}

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const target = MOBILE_ROUTES[to.path]
  if (!target) return

  const isPhone = window.matchMedia('(max-width: 767px)').matches
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  if (isPhone || isStandalone) return navigateTo({ path: target, query: to.query }, { replace: true })
})
