import type { Expense } from '~~/lib/supabase'

// Shared filter / sort / group-by state for the expense tables
// (Expenses, Approvals, Payments).

export interface ExpenseFilters {
  category: string
  date: string
  amount: string
  sort: string
  groupBy: string
}

export interface ExpenseGroup {
  key: string
  label: string | null // null = no grouping, render rows without a group header
  items: Expense[]
}

type Option = { value: string; label: string }

export const EXPENSE_FILTER_OPTIONS: Record<keyof ExpenseFilters, Option[]> = {
  category: [
    { value: 'all', label: 'All' },
    { value: 'food', label: 'Food' },
    { value: 'travel', label: 'Travel' },
    { value: 'accommodation', label: 'Accommodation' },
    { value: 'other', label: 'Other' },
  ],
  date: [
    { value: 'all', label: 'All time' },
    { value: 'month', label: 'This month' },
    { value: '3m', label: 'Last 3 months' },
    { value: 'year', label: 'This year' },
  ],
  amount: [
    { value: 'all', label: 'Any' },
    { value: 'lt1k', label: 'Under ₹1k' },
    { value: '1k-5k', label: '₹1k – ₹5k' },
    { value: '5k-20k', label: '₹5k – ₹20k' },
    { value: 'gt20k', label: 'Over ₹20k' },
  ],
  sort: [
    { value: 'newest', label: 'Newest' },
    { value: 'oldest', label: 'Oldest' },
    { value: 'amount_desc', label: 'Amount high → low' },
    { value: 'amount_asc', label: 'Amount low → high' },
  ],
  groupBy: [
    { value: 'none', label: 'None' },
    { value: 'category', label: 'Category' },
    { value: 'status', label: 'Status' },
    { value: 'month', label: 'Month' },
  ],
}

function expDate(e: Expense) {
  return new Date(e.expense_date ?? e.created_at)
}

function inDateRange(e: Expense, range: string) {
  if (range === 'all') return true
  const d = expDate(e)
  const now = new Date()
  if (range === 'month') return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  if (range === 'year') return d.getFullYear() === now.getFullYear()
  if (range === '3m') {
    const from = new Date(now.getFullYear(), now.getMonth() - 2, 1)
    return d >= from
  }
  return true
}

function inAmountRange(e: Expense, range: string) {
  const a = Number(e.amount)
  if (range === 'lt1k') return a < 1000
  if (range === '1k-5k') return a >= 1000 && a < 5000
  if (range === '5k-20k') return a >= 5000 && a < 20000
  if (range === 'gt20k') return a >= 20000
  return true
}

const STATUS_GROUP: Record<string, string> = {
  pending_manager: 'Pending',
  pending_finance: 'Pending',
  scheduled: 'Pending',
  paid: 'Paid',
  rejected: 'Rejected',
}

function groupLabel(e: Expense, by: string) {
  if (by === 'category') return e.category.charAt(0).toUpperCase() + e.category.slice(1)
  if (by === 'status') return STATUS_GROUP[e.status] ?? e.status
  if (by === 'month') return expDate(e).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
  return ''
}

export function useExpenseFilters() {
  const filters = reactive<ExpenseFilters>({
    category: 'all',
    date: 'all',
    amount: 'all',
    sort: 'newest',
    groupBy: 'none',
  })

  function apply(list: Expense[]) {
    const out = list.filter(e =>
      (filters.category === 'all' || e.category === filters.category) &&
      inDateRange(e, filters.date) &&
      inAmountRange(e, filters.amount),
    )
    return out.sort((a, b) => {
      if (filters.sort === 'oldest')     return expDate(a).getTime() - expDate(b).getTime()
      if (filters.sort === 'amount_desc') return Number(b.amount) - Number(a.amount)
      if (filters.sort === 'amount_asc')  return Number(a.amount) - Number(b.amount)
      return expDate(b).getTime() - expDate(a).getTime()
    })
  }

  // Groups keep the current sort order (group order = first appearance)
  function group(list: Expense[]): ExpenseGroup[] {
    if (filters.groupBy === 'none') return [{ key: 'all', label: null, items: list }]
    const map = new Map<string, Expense[]>()
    for (const e of list) {
      const label = groupLabel(e, filters.groupBy)
      if (!map.has(label)) map.set(label, [])
      map.get(label)!.push(e)
    }
    return [...map].map(([label, items]) => ({ key: label, label, items }))
  }

  return { filters, apply, group }
}
