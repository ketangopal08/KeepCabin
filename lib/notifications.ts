// Server-only: create in-app notifications (shown on /app/notifications).
import type { SupabaseClient } from '@supabase/supabase-js'

export interface NewNotification {
  org_id: string
  user_id: string
  type: string
  title: string
  body?: string
  expense_id?: string | null
}

/** Best effort — a failed notification must never fail the action that triggered it. */
export async function createNotifications(supabase: SupabaseClient, items: NewNotification[]): Promise<void> {
  if (!items.length) return
  const { error } = await supabase.from('notifications').insert(
    items.map(n => ({ ...n, body: n.body ?? '', expense_id: n.expense_id ?? null })),
  )
  if (error) console.error('[notifications] insert failed', error.message)
}

const inr = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`

/** "₹450 expense at Swiggy" / "₹450 travel expense" */
export function expenseLabel(e: { amount: number; vendor?: string | null; category?: string | null }): string {
  return e.vendor ? `${inr(e.amount)} expense at ${e.vendor}` : `${inr(e.amount)} ${e.category ?? ''} expense`.replace('  ', ' ')
}
