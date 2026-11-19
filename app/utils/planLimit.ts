import { toast } from 'vue-sonner'

/** Server limit errors: HTTP 402 with data { code: 'PLAN_LIMIT', limit, plan } (see lib/billing.ts). */
export function isPlanLimitError(e: any): boolean {
  return e?.data?.data?.code === 'PLAN_LIMIT' || e?.data?.code === 'PLAN_LIMIT'
}

/** Shows an "Upgrade" toast for plan-limit errors. Returns true when it handled the error. */
export function showPlanLimitToast(e: any): boolean {
  if (!isPlanLimitError(e)) return false
  toast.error(e?.data?.message ?? 'Your plan limit is reached.', {
    action: { label: 'Upgrade', onClick: () => navigateTo('/app/upgrade') },
  })
  return true
}
