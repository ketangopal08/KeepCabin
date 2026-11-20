// Phones (or the installed PWA) visiting a web page that has a mobile version go to it.
// Add an entry to MOBILE_ROUTES for each new mobile screen.
const MOBILE_ROUTES: Record<string, string> = {
  '/app': '/m',
  '/app/expenses/new': '/m/expenses/new',
}

export default defineNuxtRouteMiddleware((to) => {
  if (import.meta.server) return
  const target = MOBILE_ROUTES[to.path]
  if (!target) return

  const isPhone = window.matchMedia('(max-width: 767px)').matches
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  if (isPhone || isStandalone) return navigateTo({ path: target, query: to.query }, { replace: true })
})
