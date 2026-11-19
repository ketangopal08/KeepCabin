// Server-only billing helpers: current plan, usage, and limit enforcement.
import { createClient } from '@supabase/supabase-js'
import type { Organization, OrgContext } from './supabase'
import {
  PLANS, effectivePlan, istMonthStart, exportAllowed, checkLimit,
} from './plans'
import type { LimitKind, PlanId, PlanLimits, SubscriptionRow, Usage } from './plans'

export function serviceClient() {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.supabaseServiceKey)
}

export async function getSubscription(orgId: string): Promise<SubscriptionRow | null> {
  const { data, error } = await serviceClient()
    .from('subscriptions')
    .select('*')
    .eq('org_id', orgId)
    .maybeSingle()
  if (error) throw createError({ statusCode: 500, message: error.message })
  return (data as SubscriptionRow | null) ?? null
}

export async function getOrgPlan(org: Organization): Promise<{
  plan: PlanId
  trial: boolean
  limits: PlanLimits
  sub: SubscriptionRow | null
}> {
  const sub = await getSubscription(org.id)
  return { ...effectivePlan(sub, org.created_at, new Date()), sub }
}

async function count(query: PromiseLike<{ count: number | null; error: { message: string } | null }>): Promise<number> {
  const { count: n, error } = await query
  // Fail closed: a DB error must not let usage slip past a limit.
  if (error) throw createError({ statusCode: 500, message: error.message })
  return n ?? 0
}

export async function getUsage(orgId: string): Promise<Usage> {
  const db = serviceClient()
  const nowIso = new Date().toISOString()
  const [members, pendingInvites, teams, expensesThisMonth] = await Promise.all([
    count(db.from('org_members').select('id', { count: 'exact', head: true }).eq('org_id', orgId)),
    count(db.from('invites').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).eq('accepted', false).gt('expires_at', nowIso)),
    count(db.from('teams').select('id', { count: 'exact', head: true }).eq('org_id', orgId)),
    count(db.from('expenses').select('id', { count: 'exact', head: true })
      .eq('org_id', orgId).gte('created_at', istMonthStart(new Date()).toISOString())),
  ])
  return { members, pendingInvites, teams, expensesThisMonth }
}

export function planLimitError(kind: LimitKind, plan: PlanId) {
  return createError({
    statusCode: 402,
    message: `Your ${PLANS[plan].name} plan limit for ${kind} is reached. Upgrade to continue.`,
    data: { code: 'PLAN_LIMIT', limit: kind, plan },
  })
}

export async function assertWithinLimit(ctx: OrgContext, kind: LimitKind, opts?: { month?: string }): Promise<void> {
  const { plan, limits } = await getOrgPlan(ctx.org)

  if (kind === 'export') {
    if (!exportAllowed(limits, opts?.month, new Date())) throw planLimitError(kind, plan)
    return
  }
  if (kind === 'driveSync') {
    if (!limits.driveSync) throw planLimitError(kind, plan)
    return
  }

  const usage = await getUsage(ctx.org.id)
  const used = kind === 'members'
    ? usage.members + usage.pendingInvites
    : kind === 'teams' ? usage.teams : usage.expensesThisMonth
  if (!checkLimit(limits, kind, used)) throw planLimitError(kind, plan)
}
