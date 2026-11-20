# Reimbursement Workflow — Phase 3 (Redesign) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every expense-workflow screen as clean as the Upgrade page, and replace phase 1's basic Finance screens with finished Finance review and Payouts screens.

**Architecture:**
- **Shared pieces first:** a pure status map (`app/utils/expenseStatus.ts`, unit-tested), a status badge, a stat card and a step tracker component. The status map replaces four separate, inconsistent copies.
- **Pages:** each page is then rebuilt on top of those pieces.
- **One small API addition:** `payout_date` on each expense, so employees see "Pays on 30 Nov".

**Tech Stack:** Nuxt 4, Vue 3, shadcn-vue, Tailwind v4, Vitest.

**Spec:** [docs/superpowers/specs/2026-11-19-reimbursement-workflow-design.md](../specs/2026-11-19-reimbursement-workflow-design.md). Phase 3 covers its "Screens (phase 3)" section.

## Global Constraints

- **Never commit.** Each task ends with "stop for the user to commit". Only the files listed (CLAUDE.md strict scope).
- **Style reference:** `app/pages/app/upgrade.vue`.
  - `AppPage` with an `AppPageHeader` (title and one-line description).
  - A summary row of stat cards at the top: `Card` with `rounded-xl px-4 py-4 gap-0`, a 13px muted label, a 22px value and a 12px muted sub-line.
  - Tables inside `AppTableCard`, `tabular-nums` for amounts, `rounded-xl` cards and `gap-4` grids.
- **shadcn-vue only:** `Button`, `Badge`, `Card`, `Table` family, `Dialog`, `Input`, `Skeleton`, `Separator`, `Tooltip`. No raw `<button>` or `<input>` in new markup. Use CSS-variable colours, except the status tints the Badge variants already define.
- **Status labels and badge variants** come only from `app/utils/expenseStatus.ts`:

  | Status | Label | Variant |
  |---|---|---|
  | `pending_manager` | "Awaiting manager" | `warning` |
  | `pending_finance` | "Awaiting finance" | `info` |
  | `scheduled` | "Scheduled" | `info` |
  | `paid` | "Paid" | `success` |
  | `rejected` | "Rejected" | `danger` |

  With a payout date, scheduled reads "Pays on <D Mon>".
- **Money:** `₹` with the `en-IN` format, no decimals in lists, two decimals in the Pay dialog.
- **Dates:** a `YYYY-MM-DD` value is formatted with `T00:00:00Z` and `timeZone: 'UTC'`.
- **Unchanged:** all existing behaviour and permissions. Phase 1's API is unchanged except for Task 1's additive `payout_date`.
- **The sidebar label** "Payments" becomes **"Payouts"** for finance and owner. The route stays `/app/payments`.

## Review Focus

1. **An expense with a status the map doesn't know** (a legacy or future value) must render a neutral badge with its raw text, not crash. Tested in Task 1 (`statusMeta` fallback).
2. **Pay dialog for a payout with many expenses** must scroll inside the dialog, not overflow the screen. Checked in Task 3's manual step.
3. **An employee viewing a scheduled expense whose payout row was deleted** (`payout_date` null) sees "Scheduled" without a date and doesn't crash. Tested in Task 1 (`statusText` without a date).
4. **A manager with zero pending items** sees a friendly empty state, not an empty table. Checked in the Task 2 and Task 3 manual steps.
5. **Expense detail for a rejected expense** shows the rejection at the right step (Manager or Finance) with the reason. Tested in Task 1 (`trackerSteps`).

---

### Task 1: Shared status logic, components and `payout_date`

**Files:**
- Create: `app/utils/expenseStatus.ts`
- Test: `tests/expenseStatus.test.ts`
- Create: `app/components/app/ExpenseStatusBadge.vue`
- Create: `app/components/app/AppStatCard.vue`
- Create: `app/components/app/ExpenseTracker.vue`
- Modify: `server/api/expenses/index.get.ts`. Additive only: for rows with a `payout_id`, add `payout_date` (the payout's `cycle_date`) using one query, `select id, cycle_date from payouts where id in (...)`.
- Modify: `server/api/expenses/[id].get.ts`. Add `payout_date` the same way.
- Modify: `lib/supabase.ts`. Add `payout_date?: string | null` to `Expense`.

**Interfaces — produces:**
- `type BadgeVariant = 'warning' | 'info' | 'success' | 'danger' | 'neutral'`
- `statusMeta(status: string): { label: string; variant: BadgeVariant }`. Uses the table in Global Constraints, and falls back to `{ label: status, variant: 'neutral' }`.
- `statusText(status: string, payoutDate?: string | null): string`. For `scheduled` with a date: `Pays on 30 Nov`. Otherwise `statusMeta(status).label`.
- `type StepState = 'done' | 'current' | 'upcoming' | 'rejected'`
- `trackerSteps(e: { status: string; action_log: { action: string; actor_name: string; timestamp: string; note?: string }[]; payout_date?: string | null; utr_number?: string | null }): { key: 'submitted' | 'manager' | 'finance' | 'scheduled' | 'paid'; title: string; state: StepState; detail: string | null }[]`, always 5 steps:
  - **Titles:** "Submitted", "Manager approval", "Finance approval", "Scheduled", "Paid".
  - **Manager rejection:** a `rejected` entry *without* an earlier `approved` entry. The manager step is `rejected` and later steps `upcoming`.
  - **Finance rejection:** a `rejected` entry *after* `approved`. Manager is `done`, finance is `rejected`, and later steps `upcoming`.
  - **`detail`:**
    - done steps: actor and date, e.g. `"Manager · 19 Nov"`
    - rejected step: the rejection note (the reason)
    - scheduled step: `"Pays on 30 Nov"`
    - paid step: `"UTR ABC123"`
- `<ExpenseStatusBadge :status :payout-date?>`: a `Badge` with a leading dot (`size-1.5 rounded-full bg-current`), using `statusText` and `statusMeta`.
- `<AppStatCard :label :value :sub? :icon?>`: the stat card from Global Constraints.
- `<ExpenseTracker :expense>`: a vertical list built from `trackerSteps`, with a circle per state (done = check on primary, current = ring, rejected = red cross, upcoming = muted), the title and the detail line.

- [ ] **Step 1: Write the failing tests** in `tests/expenseStatus.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { statusMeta, statusText, trackerSteps } from '../app/utils/expenseStatus'

const log = (...a: [string, string][]) => a.map(([action, ts]) => ({ action, actor_name: 'X', timestamp: ts }))

describe('statusMeta / statusText', () => {
  it('known', () => expect(statusMeta('pending_finance')).toEqual({ label: 'Awaiting finance', variant: 'info' }))
  it('unknown → neutral raw', () => expect(statusMeta('weird')).toEqual({ label: 'weird', variant: 'neutral' }))
  it('scheduled with date', () => expect(statusText('scheduled', '2026-11-30')).toBe('Pays on 30 Nov'))
  it('scheduled without date', () => expect(statusText('scheduled', null)).toBe('Scheduled'))
})

describe('trackerSteps', () => {
  it('pending manager', () => expect(trackerSteps({ status: 'pending_manager', action_log: log(['submitted', '2026-11-18T05:00:00Z']) }).map(s => s.state))
    .toEqual(['done', 'current', 'upcoming', 'upcoming', 'upcoming']))
  it('rejected by manager', () => {
    const s = trackerSteps({ status: 'rejected', action_log: [...log(['submitted', '2026-11-18T05:00:00Z']), { action: 'rejected', actor_name: 'Manager', timestamp: '2026-11-19T05:00:00Z', note: 'Duplicate' }] })
    expect(s.map(x => x.state)).toEqual(['done', 'rejected', 'upcoming', 'upcoming', 'upcoming'])
    expect(s[1]!.detail).toBe('Duplicate')
  })
  it('rejected by finance', () => expect(trackerSteps({ status: 'rejected', action_log: [...log(['submitted', '2026-11-18T05:00:00Z'], ['approved', '2026-11-18T06:00:00Z']), { action: 'rejected', actor_name: 'Finance', timestamp: '2026-11-19T05:00:00Z', note: 'No GST' }] }).map(s => s.state))
    .toEqual(['done', 'done', 'rejected', 'upcoming', 'upcoming']))
  it('scheduled shows payout date', () => {
    const s = trackerSteps({ status: 'scheduled', payout_date: '2026-11-30', action_log: log(['submitted', '2026-11-18T05:00:00Z'], ['approved', '2026-11-18T06:00:00Z'], ['finance_approved', '2026-11-19T06:00:00Z']) })
    expect(s.map(x => x.state)).toEqual(['done', 'done', 'done', 'current', 'upcoming'])
    expect(s[3]!.detail).toBe('Pays on 30 Nov')
  })
  it('paid shows UTR', () => {
    const s = trackerSteps({ status: 'paid', utr_number: 'ABC123', payout_date: '2026-11-30', action_log: log(['submitted', '2026-11-18T05:00:00Z'], ['approved', '2026-11-18T06:00:00Z'], ['finance_approved', '2026-11-19T06:00:00Z'], ['paid', '2026-11-30T06:00:00Z']) })
    expect(s.every(x => x.state === 'done')).toBe(true)
    expect(s[4]!.detail).toBe('UTR ABC123')
  })
  it('legacy paid without finance_approved still all done', () => expect(trackerSteps({ status: 'paid', utr_number: 'U1', action_log: log(['submitted', '2026-11-01T05:00:00Z'], ['approved', '2026-11-02T05:00:00Z'], ['paid', '2026-11-03T05:00:00Z']) }).every(x => x.state === 'done')).toBe(true))
})
```

- [ ] **Step 2: Run `npx vitest run tests/expenseStatus.test.ts`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `app/utils/expenseStatus.ts`** with no imports, then the three components and the API and type additions.
- [ ] **Step 4: Run `npx vitest run`.** Expected: all pass (92 + 10 = 102). Run `npx nuxi typecheck`. Expected: no new errors versus the baseline of 24.
- [ ] **Step 5: Stop for the user to commit.**

---

### Task 2: Approvals and Expenses list redesign

**Files:**
- Modify: `app/pages/app/approvals.vue`
- Modify: `app/pages/app/expenses/index.vue`

**Interfaces — consumes:** Task 1 (`ExpenseStatusBadge`, `AppStatCard`, `payout_date`); existing `personColor` / `personInitials`; existing toolbar, filters and reject quick-reasons.

**Approvals** (manager, or owner):
- **Header:** "Approvals" — "Review expenses from your team."
- **Stat cards:** Pending (count) · Pending amount (₹) · Oldest request ("3 days ago", or "—").
- **Table:** Expense (vendor logo or initials, vendor, description) · Submitted by (avatar, name, email) · Category · Date · Amount · Approve / Reject. Keep the existing toolbar, filters and reject dialog with quick reasons.
- **Empty state:** a `Card` with a check icon, "You're all caught up" and "New requests from your team will show up here."

**Expenses list:**
- **Employee** ("My expenses"):
  - Stat cards: Pending · Scheduled (amount, with "next: 30 Nov" as the sub-line when any is scheduled) · Paid this month.
  - Rows use `ExpenseStatusBadge` with `payout_date`.
- **Manager, finance, owner** ("Expenses"):
  - Stat cards: Pending · Scheduled · Paid this month.
  - A **Submitted by** column is added.
- **Unchanged:** existing tabs, filters, search and row click-through.

- [ ] **Step 1: Implement both pages.** Remove each page's local status label and variant functions in favour of `ExpenseStatusBadge`.
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors.
- [ ] **Step 3: Manual check:**
  - As the Design manager: Approvals shows the stat cards and dev.zeroeight's request.
  - As an employee: My expenses shows "Pays on …" on scheduled rows.
- [ ] **Step 4: Stop for the user to commit.**

---

### Task 3: Finance review and Payouts redesign

**Files:**
- Modify: `app/pages/app/payments.vue`
- Modify: `app/components/app/AppSidebar.vue`. One change only: the label `'Payments'` becomes `'Payouts'` in the finance and owner menus.

**Interfaces — consumes:** Task 1 (components); `GET /api/payouts?cycle=`; `GET /api/expenses` (with `payout_id` / `payout_date`); existing finance-approve, finance-reject and pay endpoints, including `expected_count` / `expected_amount`.

**Page:**
- **Header:** "Payouts" — "Review approved expenses and pay your team."
- **Stat cards:**
  - To review (count and ₹)
  - Next payout (date and ₹ scheduled)
  - Overdue (count, in a red tint when > 0)
  - Paid this month (₹)
- **Tabs:** Review · Payouts.
- **Review tab:** the existing behaviour from phase 1, restyled to match Approvals: Team column, Submitted by, approve / reject, toolbar.
- **Payouts tab:**
  - **Cycle bar:** a ◀ and ▶ `Button` pair stepping through the distinct `cycle_date`s present, plus an "All upcoming" option (the default).
  - **One row per payout:** avatar, name and email · cycle date · number of expenses · ₹ amount · `Badge` (Scheduled = warning, Overdue = danger, "Paid · UTR …" = success) · **Pay**.
- **Pay dialog:**
  - Title: "Pay Sai ₹2,340.00".
  - A scrollable list (`max-h-64 overflow-y-auto`) of that payout's expenses (vendor, date, ₹), taken from the expenses with `payout_id = payout.id`.
  - A UTR `Input`.
  - Confirm sends `expected_count` and `expected_amount` from the row.
  - Error handling as in phase 1: 409 closes the dialog and reloads; other errors keep the dialog open.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors.
- [ ] **Step 3: Manual check, as Finance or the owner:**
  1. The stat cards show figures.
  2. Approving in Review moves the expense to a payout row.
  3. Pay with UTR `TEST123` turns the row "Paid · UTR TEST123".
  4. The sidebar says "Payouts".
- [ ] **Step 4: Stop for the user to commit.**

---

### Task 4: Expense detail with the step tracker

**Files:**
- Modify: `app/pages/app/expenses/[id].vue`

**Interfaces — consumes:** Task 1 (`ExpenseTracker`, `ExpenseStatusBadge`, `payout_date` from `GET /api/expenses/:id`).

**Layout:**
- **Header:** vendor as the title, ₹ amount and `ExpenseStatusBadge` on the right, and a back link "← Expenses".
- **Two columns on desktop, stacked on mobile:**
  - **Left:** a `Card` "Details" (date, category, team, submitted by, description) and a `Card` "Receipt" (the existing receipt preview).
  - **Right:** a `Card` "Progress" with `<ExpenseTracker>`, plus the existing manager / finance approve-reject panel, unchanged in behaviour, restyled as a `Card` under it.
- **Removed:** the page's local `STATUS_META` and its inline tracker markup. They're replaced by the shared components.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors.
- [ ] **Step 3: Manual check:** open a paid, a scheduled and a rejected expense. The tracker shows the right steps, dates, UTR and reason.
- [ ] **Step 4: Stop for the user to commit.**
