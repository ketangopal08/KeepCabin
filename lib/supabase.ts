import { createClient } from '@supabase/supabase-js'

export type Category = {
  id: string
  name: string
  color: string
  created_at: string
}

export type Receipt = {
  id: string
  filename: string
  drive_file_id: string | null
  storage_url: string
  ocr_text: string | null
  category_id: string | null
  category_suggested: boolean
  created_at: string
}

export interface Organization {
  id: string
  name: string
  size: string | null
  owner_id: string
  created_at: string
}

export interface Team {
  id: string
  org_id: string
  name: string
  created_at: string
}

export type OrgRole = 'owner' | 'manager' | 'finance' | 'employee'

export interface OrgMember {
  id: string
  org_id: string
  user_id: string
  role: OrgRole
  team_id: string | null
  created_at: string
}

export interface Invite {
  id: string
  org_id: string
  email: string
  role: OrgRole
  team_id: string | null
  token: string
  accepted: boolean
  created_at: string
  expires_at: string
}

export type ExpenseStatus = 'pending_manager' | 'pending_finance' | 'paid' | 'rejected'
export type ExpenseCategory = 'food' | 'travel' | 'accommodation' | 'other'

export interface ActionLogEntry {
  actor_id: string
  actor_name: string
  action: string
  timestamp: string
  note?: string
}

export interface Expense {
  id: string
  org_id: string
  team_id: string
  submitted_by: string
  amount: number
  vendor: string | null
  expense_date: string | null
  description: string | null
  category: ExpenseCategory
  receipt_url: string
  ocr_text: string | null
  status: ExpenseStatus
  rejection_reason: string | null
  utr_number: string | null
  action_log: ActionLogEntry[]
  created_at: string
  updated_at: string
}

export interface OrgContext {
  org: Organization
  member: OrgMember
  team: Team | null
}

export function useSupabase() {
  const config = useRuntimeConfig()
  return createClient(config.public.supabaseUrl, config.public.supabaseAnonKey)
}
