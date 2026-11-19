import { toast } from 'vue-sonner'
import { useSupabase } from '~~/lib/supabase'
import type { BillingInterval, BillingStatus } from '~~/lib/plans'

// Shared, module-level billing state (loaded once per session, like useOrgContext).
const _billing = ref<BillingStatus | null>(null)
const _loading = ref(false)
/** User id the cached billing belongs to — a different login must never see it. */
let _loadedFor: string | null = null
let _inflight: Promise<void> | null = null
let _authWatch = false
let _scriptPromise: Promise<void> | null = null

// Premium (crown) state — true only when the current plan lacks the feature / is at its cap.
const membersAtCap = computed(() => {
  const b = _billing.value
  return !!b && b.limits.members !== null && b.usage.members + b.usage.pendingInvites >= b.limits.members
})
const teamsAtCap = computed(() => {
  const b = _billing.value
  return !!b && b.limits.teams !== null && b.usage.teams >= b.limits.teams
})
const exportLocked = computed(() => !!_billing.value && !_billing.value.limits.exportAnyRange)

function loadCheckoutScript(): Promise<void> {
  if ((window as any).Razorpay) return Promise.resolve()
  if (_scriptPromise) return _scriptPromise
  _scriptPromise = new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = 'https://checkout.razorpay.com/v1/checkout.js'
    s.onload = () => resolve()
    s.onerror = () => { _scriptPromise = null; reject(new Error('Could not load Razorpay Checkout')) }
    document.head.appendChild(s)
  })
  return _scriptPromise
}

export function useBilling() {
  const supabase = useSupabase()

  async function authHeaders(): Promise<Record<string, string>> {
    const { data: { session } } = await supabase.auth.getSession()
    return session ? { Authorization: `Bearer ${session.access_token}` } : {}
  }

  function clear() {
    _billing.value = null
    _loadedFor = null
  }

  // Drop cached billing whenever the signed-in user changes or signs out (registered once).
  if (import.meta.client && !_authWatch) {
    _authWatch = true
    supabase.auth.onAuthStateChange((_event, session) => {
      if ((session?.user?.id ?? null) !== _loadedFor) clear()
    })
  }

  async function refresh() {
    _loading.value = true
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { clear(); return }
      const data = await $fetch<BillingStatus>('/api/billing' as string, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      _billing.value = data
      _loadedFor = session.user.id
    } catch {
      // No workspace yet / not allowed: show nothing rather than another account's data.
      clear()
    } finally {
      _loading.value = false
    }
  }

  async function load() {
    const { data: { session } } = await supabase.auth.getSession()
    if (_billing.value && session?.user?.id === _loadedFor) return
    _inflight ??= refresh().finally(() => { _inflight = null })
    await _inflight
  }

  /** Starts Razorpay checkout for a plan. Resolves once the dialog closes. */
  async function checkout(plan: 'pro' | 'business', interval: BillingInterval) {
    const headers = await authHeaders()
    const { data: { session } } = await supabase.auth.getSession()
    let res: { subscriptionId: string; keyId: string; change: string }
    try {
      res = await $fetch<{ subscriptionId: string; keyId: string; change: string }>('/api/billing/subscribe' as string, {
        method: 'POST', headers, body: { plan, interval },
      })
      await loadCheckoutScript()
    } catch (e: any) {
      toast.error(e?.data?.message ?? e?.message ?? 'Could not start checkout')
      return
    }

    await new Promise<void>((resolve) => {
      const rz = new (window as any).Razorpay({
        key: res.keyId,
        subscription_id: res.subscriptionId,
        name: 'KeepCabin',
        description: `${plan === 'pro' ? 'Pro' : 'Business'} plan (${interval})`,
        prefill: { email: session?.user?.email ?? '' },
        theme: { color: '#18181b' },
        handler: async (r: { razorpay_payment_id: string; razorpay_subscription_id: string; razorpay_signature: string }) => {
          try {
            await $fetch('/api/billing/verify' as string, { method: 'POST', headers, body: r })
            await refresh()
            toast.success(res.change === 'downgrade'
              ? 'Plan change scheduled for your next renewal.'
              : 'Payment successful — your plan is active.')
          } catch (e: any) {
            toast.error(e?.data?.message ?? 'Payment received, but confirming it failed. It will update shortly.')
          } finally {
            resolve()
          }
        },
        modal: { ondismiss: () => resolve() },
      })
      rz.on?.('payment.failed', (r: any) => {
        toast.error(r?.error?.description ?? 'Payment failed')
      })
      rz.open()
    })
  }

  async function cancel() {
    try {
      await $fetch('/api/billing/cancel' as string, { method: 'POST', headers: await authHeaders() })
      await refresh()
      toast.success('Subscription cancelled. Your plan stays active until the end of the billing period.')
    } catch (e: any) {
      toast.error(e?.data?.message ?? 'Could not cancel subscription')
    }
  }

  return {
    billing: readonly(_billing), loading: readonly(_loading), load, refresh, clear, checkout, cancel,
    membersAtCap, teamsAtCap, exportLocked,
  }
}
