# Reimbursement Workflow — Phase 1 (Workflow & Data) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Back-end for the new flow: `pending_manager → pending_finance → scheduled → paid` (or `rejected`), with payout cycles, one payout per employee per cycle, owner fallback approvers, and notifications at every step.

**Architecture:**
- **Pure rules** in `lib/payouts.ts`: payout dates and who may approve. Unit-tested.
- **SQL migration** with two Postgres functions, so scheduling and paying each happen in one transaction.
- **Endpoints:** thin Nitro handlers that check permissions with the pure rules, call the functions, then create notifications.

**Tech Stack:** Nuxt 4 / Nitro, Supabase (service-role client + `rpc`), Vitest.

**Spec:** [docs/superpowers/specs/2026-11-19-reimbursement-workflow-design.md](../specs/2026-11-19-reimbursement-workflow-design.md). Phase 1 covers its "Data model", "Payout cycle rule", "Workflow and endpoints", "Notifications", "Self-approval" and "Clarifications" sections.

## Global Constraints

- **Never commit.** Each task ends with "stop for the user to commit" (CLAUDE.md). Only touch the files listed.
- **Statuses:** exactly `pending_manager`, `pending_finance`, `scheduled`, `paid`, `rejected`.
- **Payout schedules:** exactly `semi_monthly` (default: the 15th and the last day of the month), `monthly` (last day), `weekly` (Friday). All dates are IST.
- **Cycle rule:** the first payout date **strictly after** the approval day.
- **No self-approval:** nobody acts on their own expense at either step.
- **Owner fallback:** the owner may act at either step on any expense except their own.
- **One payout per employee per cycle:** at most one *scheduled* payout per (org, employee, cycle_date).
- **Amounts** are INR, `numeric(12,2)`.
- **Notifications** use `createNotifications` / `expenseLabel` from `lib/notifications.ts`. A failed notification never fails the action.
- **The user runs the SQL** in Supabase. Executors never run it.
- **Phase 1 adds no new UI.** Existing screens must keep working: manager approve/reject, and the old per-expense pay for legacy `pending_finance` items.

## Review Focus

1. **A manager approving their own expense** must get 403, and the owner must be able to act on it instead. Tested in Task 1 (`canActOnStep`).
2. **A team with no manager:** submitting must notify the owner, and the owner must be able to approve. Tested in Task 1 (`stepApprovers`).
3. **Approval on a payout day:** an expense approved on the 15th goes to the month-end cycle, not the 15th. Tested in Task 1 (`nextPayoutDate`).
4. **Double click or race on Finance approve or Pay:** the second call fails cleanly (409) and nothing is added twice. Enforced in Task 2 (SQL status guards), verified in Task 5's smoke step.
5. **A payout paid early, then another expense approved for the same cycle date:** a new scheduled payout is created. It must not be blocked by, or merged into, the paid one. Enforced in Task 2 (partial unique index).

---

### Task 1: Pure rules: payout dates and approvers

**Files:**
- Create: `lib/payouts.ts`
- Test: `tests/payouts.test.ts`

**Interfaces — produces:**
- `type PayoutSchedule = 'semi_monthly' | 'monthly' | 'weekly'`
- `nextPayoutDate(schedule: PayoutSchedule, approvedAt: Date): string`, returning `YYYY-MM-DD` in IST
- `interface MemberLite { user_id: string; role: 'owner' | 'manager' | 'finance' | 'employee'; team_id: string | null }`
- `interface ExpenseLite { submitted_by: string; team_id: string }`
- `type Step = 'manager' | 'finance'`
- `stepApprovers(step: Step, expense: ExpenseLite, members: MemberLite[]): string[]`, returning user_ids
- `canActOnStep(step: Step, actorUserId: string, expense: ExpenseLite, members: MemberLite[]): boolean`

**Rules for `stepApprovers`:**
- **Manager step:** managers of `expense.team_id`, excluding the submitter. If there are none, fall back to owners excluding the submitter. If there are still none, fall back to finance members excluding the submitter.
- **Finance step:** finance members excluding the submitter. If there are none, fall back to owners excluding the submitter.

**Rule for `canActOnStep`:** true if the actor is in `stepApprovers`, **or** the actor's role is owner and the actor is not the submitter.

- [ ] **Step 1: Write the failing tests** in `tests/payouts.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { nextPayoutDate, stepApprovers, canActOnStep, type MemberLite } from '../lib/payouts'

// IST = UTC+5:30. Helper: an instant that is the given IST wall-clock time.
const ist = (s: string) => new Date(new Date(`${s}Z`).getTime() - 330 * 60_000)

describe('nextPayoutDate', () => {
  it('semi_monthly: 14th → 15th', () => expect(nextPayoutDate('semi_monthly', ist('2026-11-14T10:00:00'))).toBe('2026-11-15'))
  it('semi_monthly: on the 15th → month end', () => expect(nextPayoutDate('semi_monthly', ist('2026-11-15T09:00:00'))).toBe('2026-11-30'))
  it('semi_monthly: on month end → next 15th', () => expect(nextPayoutDate('semi_monthly', ist('2026-11-30T18:00:00'))).toBe('2026-12-15'))
  it('semi_monthly: Feb end (non-leap)', () => expect(nextPayoutDate('semi_monthly', ist('2027-02-20T12:00:00'))).toBe('2027-02-28'))
  it('monthly: mid month → month end', () => expect(nextPayoutDate('monthly', ist('2026-11-19T12:00:00'))).toBe('2026-11-30'))
  it('monthly: on month end → next month end', () => expect(nextPayoutDate('monthly', ist('2026-11-30T12:00:00'))).toBe('2026-12-31'))
  it('weekly: Thursday → Friday', () => expect(nextPayoutDate('weekly', ist('2026-11-19T12:00:00'))).toBe('2026-11-20'))
  it('weekly: on Friday → next Friday', () => expect(nextPayoutDate('weekly', ist('2026-11-20T12:00:00'))).toBe('2026-11-27'))
  it('uses IST day: 23:30 IST on 14th is still the 14th', () => expect(nextPayoutDate('semi_monthly', ist('2026-11-14T23:30:00'))).toBe('2026-11-15'))
})

const M: MemberLite[] = [
  { user_id: 'owner', role: 'owner', team_id: null },
  { user_id: 'mgrD', role: 'manager', team_id: 'design' },
  { user_id: 'sai', role: 'employee', team_id: 'design' },
  { user_id: 'fin1', role: 'finance', team_id: 'finance' },
  { user_id: 'ops', role: 'employee', team_id: 'ops' }, // ops has no manager
]

describe('stepApprovers', () => {
  it('manager step → team manager', () => expect(stepApprovers('manager', { submitted_by: 'sai', team_id: 'design' }, M)).toEqual(['mgrD']))
  it('manager submits own → owner', () => expect(stepApprovers('manager', { submitted_by: 'mgrD', team_id: 'design' }, M)).toEqual(['owner']))
  it('team without manager → owner', () => expect(stepApprovers('manager', { submitted_by: 'ops', team_id: 'ops' }, M)).toEqual(['owner']))
  it('finance step → finance members', () => expect(stepApprovers('finance', { submitted_by: 'sai', team_id: 'design' }, M)).toEqual(['fin1']))
  it('only finance member submits → owner', () => expect(stepApprovers('finance', { submitted_by: 'fin1', team_id: 'finance' }, M)).toEqual(['owner']))
  it('owner submits → finance does manager step', () => expect(stepApprovers('manager', { submitted_by: 'owner', team_id: 'finance' }, M)).toEqual(['fin1']))
})

describe('canActOnStep', () => {
  it('manager cannot approve own', () => expect(canActOnStep('manager', 'mgrD', { submitted_by: 'mgrD', team_id: 'design' }, M)).toBe(false))
  it('owner can approve manager’s own', () => expect(canActOnStep('manager', 'owner', { submitted_by: 'mgrD', team_id: 'design' }, M)).toBe(true))
  it('other team manager cannot', () => expect(canActOnStep('manager', 'mgrD', { submitted_by: 'ops', team_id: 'ops' }, M)).toBe(false))
  it('finance cannot approve own', () => expect(canActOnStep('finance', 'fin1', { submitted_by: 'fin1', team_id: 'finance' }, M)).toBe(false))
  it('owner cannot approve own', () => expect(canActOnStep('finance', 'owner', { submitted_by: 'owner', team_id: 'finance' }, M)).toBe(false))
  it('employee never', () => expect(canActOnStep('manager', 'sai', { submitted_by: 'ops', team_id: 'design' }, M)).toBe(false))
})
```

- [ ] **Step 2: Run `npx vitest run tests/payouts.test.ts`.** Expected: FAIL, because `../lib/payouts` cannot be resolved.
- [ ] **Step 3: Implement `lib/payouts.ts`.** No imports. For IST, shift by +330 minutes and read the UTC fields.
- [ ] **Step 4: Run `npx vitest run`.** Expected: all tests pass (64 existing + 21 new).
- [ ] **Step 5: Stop for the user to commit.**

---

### Task 2: SQL migration with atomic functions

**Files:**
- Create: `lib/reimbursements.sql`

**Interfaces — produces (for Tasks 4 and 5):**
- `organizations.payout_schedule text not null default 'semi_monthly'`, checked against the three values.
- `expenses.status` check extended with `'scheduled'`. Drop and re-create the existing check constraint. Find its name with `select conname from pg_constraint where conrelid = 'expenses'::regclass and contype = 'c'`. The SQL does this inside a `do $$ … $$` block, so the user can simply run the file.
- `expenses.payout_id uuid references payouts(id) on delete set null`
- **`payouts` table:** the spec's columns, plus `status text not null default 'scheduled' check (status in ('scheduled','paid'))`, and a **partial unique index** on `(org_id, user_id, cycle_date) where status = 'scheduled'`.
- **RLS on `payouts`:**
  - select for org members with role `finance` or `owner` (via `org_members` / `get_user_org_ids`)
  - select for `user_id = auth.uid()`
  - no write policies
- `schedule_expense(p_expense_id uuid, p_org_id uuid, p_cycle_date date, p_log jsonb) returns uuid`, the payout id. In one statement block:
  1. Update the expense to `scheduled` where it's `pending_finance` in that org, appending `p_log` to `action_log`. If no row matches, `raise exception 'not_schedulable'`.
  2. Upsert the scheduled payout for (org, submitter, cycle).
  3. Set the expense's `payout_id`.
  4. Recompute `payouts.amount` as the sum of linked expenses.
- `pay_payout(p_payout_id uuid, p_org_id uuid, p_utr text, p_actor uuid, p_log jsonb) returns table(user_id uuid, amount numeric, expense_count int)`:
  1. Update the payout to `paid` (with UTR, `paid_at`, `paid_by`) where it's `scheduled` in that org. If none, `raise exception 'not_payable'`.
  2. Update the linked `scheduled` expenses to `paid`, setting `utr_number` and `updated_at` and appending `p_log`.
  3. Return the totals.
- **Lock down both functions:** `revoke execute … from public, anon, authenticated`. Only the service role calls them.

- [ ] **Step 1: Write `lib/reimbursements.sql`** in the style of `lib/billing.sql`, re-runnable (`if not exists`, `create or replace`).
- [ ] **Step 2: Check the SQL syntax** without a database, by reading it against Postgres 15 syntax. The user runs it in the Supabase SQL editor. Expected: "Success. No rows returned".
- [ ] **Step 3: Stop for the user to commit and run the SQL.**

---

### Task 3: Shared action helpers; submit, manager approve and manager reject

**Files:**
- Create: `lib/expenseActions.ts` (server-only)
- Modify: `server/api/expenses/index.post.ts`: allow roles `employee`, `manager` and `finance` to submit (an owner without a team still gets the existing "not assigned to a team" error). After the insert, notify `stepApprovers('manager', …)` with "New expense to review" (type `expense_submitted`).
- Modify: `server/api/expenses/[id]/approve.post.ts`
- Modify: `server/api/expenses/[id]/reject.post.ts`

**Interfaces:**
- **Consumes:** Task 1 (`stepApprovers`, `canActOnStep`, `MemberLite`); `createNotifications` and `expenseLabel` from `lib/notifications.ts`; `serviceClient` from `lib/billing.ts`.
- **Produces, in `lib/expenseActions.ts`:**
  - `loadMembers(orgId: string): Promise<MemberLite[]>`
  - `logEntry(ctx: OrgContext, action: string, note?: string): ActionLogEntry`. `actor_name` is the capitalised role.
  - `assertCanAct(step: Step, ctx: OrgContext, expense: { submitted_by: string; team_id: string }, members: MemberLite[]): void`. Throws 403 with "You can't approve your own expense" when the actor is the submitter, and 403 "Forbidden" otherwise.

**Approve and reject changes:**
- **Roles:** `requireRole(…, 'manager', 'owner', 'finance')`.
- **Loading the expense:** load by id and org with `status = 'pending_manager'`. Drop the `team_id = ctx.member.team_id` filter, so an owner or fallback finance member can act; `assertCanAct('manager', …)` enforces scope.
- **Updates:** conditional, with `.eq('status', 'pending_manager')` and `.select('id')`. Zero rows means 409 "Already handled".
- **Approve:** notify the submitter with "Approved by your manager" (type `expense_manager_approved`, body `Your <label> is now with Finance for review.`). Notify `stepApprovers('finance', …)` with "New expense to review" (type `expense_to_finance`). This **replaces** the notification added previously. Keep the existing `notify` edge-function call.
- **Reject:** notify the submitter with "Expense rejected" (type `expense_rejected`, body `Your <label> was rejected: <reason>`). Keep the edge-function call.

- [ ] **Step 1: Implement** the helpers and the three endpoint changes.
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors versus the baseline of 24.
- [ ] **Step 3: Run `npx vitest run`.** Expected: all tests pass.
- [ ] **Step 4: Stop for the user to commit.**

---

### Task 4: Finance approve and finance reject

**Files:**
- Create: `server/api/expenses/[id]/finance-approve.post.ts`
- Create: `server/api/expenses/[id]/finance-reject.post.ts`

**Interfaces — consumes:** Task 1 (`nextPayoutDate`); Task 2 (`schedule_expense` rpc, `organizations.payout_schedule`); Task 3 (`loadMembers`, `logEntry`, `assertCanAct`).

**finance-approve:**
1. `requireRole(…, 'finance', 'owner')`.
2. Load the expense by id and org with status `pending_finance`. If none, 404.
3. `assertCanAct('finance', …)`.
4. Compute `cycle = nextPayoutDate(org.payout_schedule ?? 'semi_monthly', new Date())`.
5. Call `rpc('schedule_expense', { p_expense_id, p_org_id, p_cycle_date: cycle, p_log: logEntry(ctx, 'finance_approved', 'Pays on <cycle>') })`. An rpc error whose message contains `not_schedulable` becomes 409 "Already handled".
6. Notify the submitter with "Approved — will be paid on <D Mon>" (type `expense_scheduled`, body `Your <label> will be paid on <D Mon YYYY>.`).
7. Return `{ ok: true, payout_id, cycle_date }`.

**finance-reject:**
1. Body `{ reason }`, required.
2. Same role, load and `assertCanAct` checks as finance-approve.
3. Conditional update to `rejected` with `rejection_reason` and a log entry (`'rejected'`, note = reason). Zero rows means 409.
4. Notify the submitter and the expense team's managers with "Expense rejected by Finance" (type `expense_rejected`, body includes the reason).

- [ ] **Step 1: Implement both endpoints.**
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors.
- [ ] **Step 3: Stop for the user to commit.**

---

### Task 5: Payouts API and payout schedule setting

**Files:**
- Create: `server/api/payouts/index.get.ts`
- Create: `server/api/payouts/[id]/pay.post.ts`
- Create: `server/api/orgs/payout-schedule.patch.ts`
- Modify: `lib/supabase.ts`. Add `'scheduled'` to `ExpenseStatus`, `payout_id?: string | null` to `Expense`, and export `interface Payout { id; org_id; user_id; cycle_date; amount; status: 'scheduled' | 'paid'; utr_number; paid_at; paid_by; created_at }`.

**Interfaces:**
- **Consumes:** Task 2 (`pay_payout` rpc, `payouts` table).
- **Produces (for phase 3):**
  - `GET /api/payouts?cycle=YYYY-MM-DD` (finance or owner). Returns `Array<Payout & { employee_name: string | null; employee_email: string | null; expense_count: number; overdue: boolean }>`.
    - Without `cycle`: every `scheduled` payout plus `paid` ones from the last 60 days.
    - `overdue` means `status = 'scheduled'` and `cycle_date` < today (IST).
  - `POST /api/payouts/:id/pay { utr_number }` (finance or owner). The UTR is required, trimmed and at most 64 characters. Calls `rpc('pay_payout', …)` with `logEntry(ctx, 'paid', 'UTR: <utr>')`. A `not_payable` error becomes 409. Notifies the employee with "Reimbursement paid" (type `payout_paid`, body `₹<amount> for <n> expense(s) was paid. UTR <utr>.`, `expense_id` = one linked expense). Returns `{ ok: true, amount, expense_count }`.
  - `PATCH /api/orgs/payout-schedule { schedule }` (owner only). Validates against the three values and returns `{ ok: true, schedule }`.

- [ ] **Step 1: Implement** the three endpoints and the type changes.
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors.
- [ ] **Step 3: Smoke test**, after the user has run the SQL, with the dev server running:
  - `curl -s -o /dev/null -w "%{http_code}" -X POST localhost:3000/api/payouts/00000000-0000-0000-0000-000000000000/pay`. Expected: `401` (no auth).
  - With the service-role key, `rpc('pay_payout', …)` on a random UUID. Expected: an error containing `not_payable`.
- [ ] **Step 4: Run `npx vitest run`.** Expected: all tests pass.
- [ ] **Step 5: Stop for the user to commit.**

---

### Task 6: Basic Finance screens and owner access (user request: usable at the end of phase 1)

These are functional and tidy, using existing shadcn patterns. Phase 3 does the full redesign.

**Files:**
- Modify: `app/pages/app/payments.vue`
- Modify: `app/pages/app/approvals.vue`. One change only: hide expenses where `submitted_by` is the current user, since nobody approves their own.
- Modify: `app/components/app/AppSidebar.vue`. One change only: add **Approvals** (`/app/approvals`) and **Payments** (`/app/payments`) to the owner's menu, so the owner can step in. The finance menu is unchanged.

**Interfaces — consumes:** Task 4 (`POST /api/expenses/:id/finance-approve`, `POST /api/expenses/:id/finance-reject { reason }`); Task 5 (`GET /api/payouts`, `POST /api/payouts/:id/pay { utr_number }`); `submitter_name` / `submitter_email` on `GET /api/expenses`; `personColor` / `personInitials` from `app/utils/avatarColors.ts`; `showPlanLimitToast` is not needed.

**payments.vue — two tabs** (`AppPageTabs`), replacing today's per-expense UTR list:

1. **Review** (count = `pending_finance` expenses, excluding the current user's own):
   - Columns: expense (vendor, description), **Submitted by** (avatar, name, email), category, date, amount.
   - **Approve** calls finance-approve and shows a toast "Approved — pays on <D Mon>" using `cycle_date` from the response.
   - **Reject** opens a `Dialog` with a reason `Input` and the same quick reasons as `approvals.vue`, then calls finance-reject.
   - Reload after each action.
2. **Payouts** (count = scheduled payouts):
   - Rows from `GET /api/payouts`: employee (avatar, name, email), payout date (`D Mon YYYY`), number of expenses, amount (₹, tabular-nums), and a status `Badge`: `warning` "Scheduled", `danger` "Overdue" when `overdue`, `success` "Paid · UTR …".
   - **Pay** (scheduled rows only) opens a `Dialog`: "Pay ₹2,340 to Sai for 3 expenses". It has a UTR `Input` (required) and Confirm. It calls pay, toasts "Payout recorded", and reloads.
   - Sort: scheduled first by `cycle_date`, then paid by `paid_at` descending.

**Error handling:** 409 → toast "Already handled by someone else" and reload. Anything else → toast the server message.

- [ ] **Step 1: Implement the three file changes.** Use shadcn-vue components only and CSS-variable colours.
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors versus the baseline of 24.
- [ ] **Step 3: Manual check, after the SQL is run and as finance or owner:**
  1. A `pending_finance` expense appears in Review. Approving it makes it disappear.
  2. Payouts shows the employee's row with the next cycle date. Pay with UTR `TEST123` marks it Paid.
  3. The employee gets the "Reimbursement paid" notification.
- [ ] **Step 4: Stop for the user to commit.**
