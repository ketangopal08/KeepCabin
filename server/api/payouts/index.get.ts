import { getOrgContext, requireRole } from '~~/lib/org'
import { serviceClient } from '~~/lib/billing'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'finance', 'owner')
  const supabase = serviceClient()

  const cycle = getQuery(event).cycle
  if (cycle !== undefined && (typeof cycle !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(cycle))) {
    throw createError({ statusCode: 400, message: 'Invalid cycle' })
  }

  const today = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10)

  let query = supabase.from('payouts').select('*').eq('org_id', ctx.org.id)
  if (cycle) {
    query = query.eq('cycle_date', cycle)
  } else {
    const since = new Date(Date.now() - 60 * 86_400_000).toISOString()
    query = query.or(`status.eq.scheduled,and(status.eq.paid,paid_at.gte.${since})`)
  }

  const { data, error } = await query
  if (error) throw createError({ statusCode: 500, message: error.message })
  const rows = data ?? []
  if (!rows.length) return []

  const counts = new Map<string, number>()
  const { data: linked, error: linkErr } = await supabase
    .from('expenses')
    .select('payout_id')
    .in('payout_id', rows.map((p: any) => p.id))
  if (linkErr) throw createError({ statusCode: 500, message: linkErr.message })
  for (const e of linked ?? []) counts.set(e.payout_id, (counts.get(e.payout_id) ?? 0) + 1)

  const ids = new Set(rows.map((p: any) => p.user_id))
  const { data: { users } } = await supabase.auth.admin.listUsers({ perPage: 1000 })
  const byId = new Map(users.filter((u: any) => ids.has(u.id)).map((u: any) => [u.id, u]))

  const result = rows.map((p: any) => {
    const u: any = byId.get(p.user_id)
    return {
      ...p,
      employee_name: u?.user_metadata?.full_name ?? null,
      employee_email: u?.email ?? null,
      expense_count: counts.get(p.id) ?? 0,
      overdue: p.status === 'scheduled' && p.cycle_date < today,
    }
  })

  result.sort((a: any, b: any) => {
    if (a.status !== b.status) return a.status === 'scheduled' ? -1 : 1
    if (a.status === 'scheduled') return a.cycle_date < b.cycle_date ? -1 : a.cycle_date > b.cycle_date ? 1 : 0
    return (b.paid_at ?? '').localeCompare(a.paid_at ?? '')
  })
  return result
})
