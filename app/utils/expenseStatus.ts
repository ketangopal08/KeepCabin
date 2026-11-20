export type BadgeVariant = 'warning' | 'info' | 'success' | 'danger' | 'neutral'
export type StepState = 'done' | 'current' | 'upcoming' | 'rejected'

const META: Record<string, { label: string; variant: BadgeVariant }> = {
  pending_manager: { label: 'Awaiting manager', variant: 'warning' },
  pending_finance: { label: 'Awaiting finance', variant: 'info' },
  scheduled: { label: 'Scheduled', variant: 'info' },
  paid: { label: 'Paid', variant: 'success' },
  rejected: { label: 'Rejected', variant: 'danger' },
}

export function statusMeta(status: string): { label: string; variant: BadgeVariant } {
  return META[status] ?? { label: status, variant: 'neutral' }
}

function fmtDay(value: string): string {
  const dateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value)
  return new Date(dateOnly ? `${value}T00:00:00Z` : value).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    timeZone: dateOnly ? 'UTC' : 'Asia/Kolkata',
  })
}

export function statusText(status: string, payoutDate?: string | null): string {
  if (status === 'scheduled' && payoutDate) return `Pays on ${fmtDay(payoutDate)}`
  return statusMeta(status).label
}

type Entry = { action: string; actor_name: string; timestamp: string; note?: string }
type StepKey = 'submitted' | 'manager' | 'finance' | 'scheduled' | 'paid'
type Step = { key: StepKey; title: string; state: StepState; detail: string | null }

export function trackerSteps(e: {
  status: string
  action_log: Entry[]
  payout_date?: string | null
  utr_number?: string | null
  rejection_reason?: string | null
}): Step[] {
  const log = e.action_log ?? []
  const first = (a: string) => log.findIndex(x => x.action === a)
  const entry = (a: string) => log.find(x => x.action === a)
  const by = (x?: Entry) => (x ? `${x.actor_name} · ${fmtDay(x.timestamp)}` : null)

  const rejIdx = log.findIndex(x => x.action === 'rejected')
  const rej = rejIdx >= 0 ? log[rejIdx] : undefined
  const apprIdx = first('approved')
  const isRejected = e.status === 'rejected'
  const financeRejected = isRejected && (rej ? apprIdx >= 0 && apprIdx < rejIdx : apprIdx >= 0)
  const managerRejected = isRejected && !financeRejected

  const titles: Record<StepKey, string> = {
    submitted: 'Submitted',
    manager: 'Manager approval',
    finance: 'Finance approval',
    scheduled: 'Scheduled',
    paid: 'Paid',
  }
  const keys: StepKey[] = ['submitted', 'manager', 'finance', 'scheduled', 'paid']

  // Index of the step that is "current" (or rejected); steps before are done.
  let cur: number
  if (managerRejected) cur = 1
  else if (financeRejected) cur = 2
  else if (e.status === 'paid') cur = 5
  else if (e.status === 'scheduled') cur = 3
  else if (e.status === 'pending_finance') cur = 2
  else cur = 1
  const rejected = managerRejected || financeRejected

  return keys.map((key, i): Step => {
    const state: StepState = i < cur ? 'done' : i === cur ? (rejected ? 'rejected' : 'current') : 'upcoming'
    let detail: string | null = null
    if (state === 'rejected') detail = rej ? (rej.note ?? null) : (e.rejection_reason ?? null)
    else if (state === 'done') {
      if (key === 'submitted') detail = by(entry('submitted'))
      else if (key === 'manager') detail = by(entry('approved'))
      else if (key === 'finance') detail = by(entry('finance_approved'))
    }
    if (key === 'scheduled' && state !== 'upcoming' && e.payout_date) detail = `Pays on ${fmtDay(e.payout_date)}`
    if (key === 'paid' && state === 'done' && e.utr_number) detail = `UTR ${e.utr_number}`
    return { key, title: titles[key], state, detail }
  })
}
