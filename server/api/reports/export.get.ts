import { getOrgContext, requireRole } from '~~/lib/org'
import { createClient } from '@supabase/supabase-js'

export default defineEventHandler(async (event) => {
  const ctx = requireRole(await getOrgContext(event), 'finance', 'owner')
  const config = useRuntimeConfig()
  const supabase = createClient(config.public.supabaseUrl, config.supabaseServiceKey)

  const query = getQuery(event)
  let dbQuery = supabase
    .from('expenses')
    .select('*, org_members!submitted_by(user_id, role, teams(name))')
    .eq('org_id', ctx.org.id)
    .order('created_at', { ascending: false })

  if (query.month) {
    const month = query.month as string  // e.g. "2026-06"
    const parts = month.split('-')
    const year = Number(parts[0] ?? '0')
    const mon = Number(parts[1] ?? '1')
    const nextMonth = mon === 12
      ? `${year + 1}-01-01`
      : `${year}-${String(mon + 1).padStart(2, '0')}-01`
    dbQuery = dbQuery
      .gte('expense_date', `${month}-01`)
      .lt('expense_date', nextMonth)
  }

  const { data: expenses } = await dbQuery

  const rows = [
    ['ID', 'Date', 'Employee', 'Team', 'Vendor', 'Category', 'Amount (INR)', 'Description', 'Status', 'UTR', 'Submitted At', 'Paid At'],
    ...(expenses ?? []).map(e => [
      e.id,
      e.expense_date ?? '',
      e.submitted_by,
      e.org_members?.teams?.name ?? '',
      e.vendor ?? '',
      e.category ?? '',
      e.amount,
      e.description ?? '',
      e.status,
      e.utr_number ?? '',
      e.created_at.slice(0, 10),
      e.status === 'paid' ? e.updated_at.slice(0, 10) : '',
    ])
  ]

  const csv = rows.map(row =>
    row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
  ).join('\n')

  setHeader(event, 'Content-Type', 'text/csv; charset=utf-8')
  setHeader(event, 'Content-Disposition', `attachment; filename="expenses-${query.month ?? 'all'}.csv"`)
  return csv
})
