export type PayoutSchedule = 'semi_monthly' | 'monthly' | 'weekly'

export interface MemberLite {
  user_id: string
  role: 'owner' | 'manager' | 'finance' | 'employee'
  team_id: string | null
}

export interface ExpenseLite {
  submitted_by: string
  team_id: string
}

export type Step = 'manager' | 'finance'

const pad = (n: number) => String(n).padStart(2, '0')
const fmt = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`
const lastDay = (y: number, m: number) => new Date(Date.UTC(y, m + 1, 0)).getUTCDate()

/** First payout date strictly after the approval day (IST), as YYYY-MM-DD. */
export function nextPayoutDate(schedule: PayoutSchedule, approvedAt: Date): string {
  const ist = new Date(approvedAt.getTime() + 330 * 60_000)
  const y = ist.getUTCFullYear()
  const m = ist.getUTCMonth()
  const d = ist.getUTCDate()

  if (schedule === 'weekly') {
    const dow = ist.getUTCDay() // Friday = 5
    const add = ((5 - dow + 7) % 7) || 7
    const t = new Date(Date.UTC(y, m, d + add))
    return fmt(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate())
  }

  const end = lastDay(y, m)
  if (schedule === 'semi_monthly') {
    if (d < 15) return fmt(y, m, 15)
    if (d < end) return fmt(y, m, end)
  } else if (d < end) {
    return fmt(y, m, end)
  }
  const ny = m === 11 ? y + 1 : y
  const nm = (m + 1) % 12
  return schedule === 'semi_monthly' ? fmt(ny, nm, 15) : fmt(ny, nm, lastDay(ny, nm))
}

export function stepApprovers(step: Step, expense: ExpenseLite, members: MemberLite[]): string[] {
  const others = members.filter(m => m.user_id !== expense.submitted_by)
  const ids = (role: MemberLite['role'], team?: string) =>
    others.filter(m => m.role === role && (team === undefined || m.team_id === team)).map(m => m.user_id)

  const chain = step === 'manager'
    ? [() => ids('manager', expense.team_id), () => ids('owner'), () => ids('finance')]
    : [() => ids('finance'), () => ids('owner')]
  for (const get of chain) {
    const r = get()
    if (r.length) return r
  }
  return []
}

export function canActOnStep(step: Step, actorUserId: string, expense: ExpenseLite, members: MemberLite[]): boolean {
  if (stepApprovers(step, expense, members).includes(actorUserId)) return true
  const actor = members.find(m => m.user_id === actorUserId)
  return actor?.role === 'owner' && actorUserId !== expense.submitted_by
}
