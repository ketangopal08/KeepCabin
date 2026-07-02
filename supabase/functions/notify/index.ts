import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY')!
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

interface NotifyPayload {
  type: 'manager_approved' | 'manager_rejected' | 'finance_paid'
  expense_id: string
  org_id: string
}

Deno.serve(async (req) => {
  try {
    const payload: NotifyPayload = await req.json()
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)

    const { data: expense } = await supabase
      .from('expenses')
      .select('*, organizations(name)')
      .eq('id', payload.expense_id)
      .single()

    if (!expense) return new Response('ok', { status: 200 })

    // Get submitted_by user email
    const { data: { user: submitter } } = await supabase.auth.admin.getUserById(expense.submitted_by)

    // Get finance members' emails for manager_approved notification
    let financeEmails: string[] = []
    if (payload.type === 'manager_approved') {
      const { data: financeMembers } = await supabase
        .from('org_members')
        .select('user_id')
        .eq('org_id', payload.org_id)
        .eq('role', 'finance')
      for (const m of financeMembers ?? []) {
        const { data: { user } } = await supabase.auth.admin.getUserById(m.user_id)
        if (user?.email) financeEmails.push(user.email)
      }
    }

    const orgName = expense.organizations?.name ?? 'your organization'
    const amount = `₹${Number(expense.amount).toLocaleString('en-IN')}`

    let to: string[] = []
    let subject = ''
    let html = ''

    if (payload.type === 'manager_approved') {
      to = financeEmails
      subject = `Expense approved and pending payment — ${amount} from employee`
      html = `<p>An expense of <strong>${amount}</strong> for <strong>${expense.vendor ?? 'unknown vendor'}</strong> has been approved by the manager and is pending payment.</p><p><a href="${Deno.env.get('APP_URL')}/app/payments">Review and pay</a></p>`
    } else if (payload.type === 'manager_rejected') {
      to = submitter?.email ? [submitter.email] : []
      subject = `Your expense was rejected`
      html = `<p>Your expense of <strong>${amount}</strong> for <strong>${expense.vendor ?? 'unknown vendor'}</strong> was rejected.</p><p>Reason: ${expense.rejection_reason ?? 'No reason provided'}</p>`
    } else if (payload.type === 'finance_paid') {
      to = submitter?.email ? [submitter.email] : []
      subject = `Your expense of ${amount} has been reimbursed`
      html = `<p>Your expense of <strong>${amount}</strong> has been reimbursed.</p><p>UTR: <strong>${expense.utr_number}</strong></p>`
    }

    if (to.length === 0) return new Response('No recipients', { status: 200 })

    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'KeepCabin <noreply@keepcabin.app>',
        to,
        subject,
        html,
      }),
    })

    return new Response('ok', { status: 200 })
  } catch (_err) {
    // Fire-and-forget: a failed email must never cause the edge function to return an error status
    return new Response('ok', { status: 200 })
  }
})
