// Server-only: shared helpers for expense approval endpoints.
import type { OrgContext, ActionLogEntry } from '~~/lib/supabase'
import { serviceClient } from '~~/lib/billing'
import { canActOnStep, type MemberLite, type Step } from '~~/lib/payouts'

export async function loadMembers(orgId: string): Promise<MemberLite[]> {
  const { data, error } = await serviceClient()
    .from('org_members')
    .select('user_id, role, team_id')
    .eq('org_id', orgId)
  if (error) throw createError({ statusCode: 500, message: error.message })
  return (data ?? []) as MemberLite[]
}

export function logEntry(ctx: OrgContext, action: string, note?: string): ActionLogEntry {
  const entry: ActionLogEntry = {
    actor_id: ctx.member.user_id,
    actor_name: ctx.member.role.charAt(0).toUpperCase() + ctx.member.role.slice(1),
    action,
    timestamp: new Date().toISOString(),
  }
  if (note) entry.note = note
  return entry
}

export function assertCanAct(
  step: Step,
  ctx: OrgContext,
  expense: { submitted_by: string; team_id: string },
  members: MemberLite[],
): void {
  if (expense.submitted_by === ctx.member.user_id) {
    throw createError({ statusCode: 403, message: "You can't approve your own expense" })
  }
  if (!canActOnStep(step, ctx.member.user_id, expense, members)) {
    throw createError({ statusCode: 403, message: 'Forbidden' })
  }
}
