# Reimbursement Workflow & Redesign — Design

**Date:** 2026-11-19
**Status:** Draft, awaiting approval

## Intent

KeepCabin reimburses employees for work expenses. The owner described the real process, and the app should match it end to end:

1. The **owner** creates the organization and its teams: **Finance** always, plus custom teams (Design, Development…). Each team has **one manager**.
2. An **employee** (e.g. Sai in Design) submits a reimbursement, for example an Uber ride.
3. The **team manager** sees only their team's expenses. Sai's request appears in Approvals, and the manager approves or rejects it.
4. The **Finance manager** sees everything managers approved, from all teams, and approves or rejects it.
5. A Finance-approved expense is **scheduled into the next payout cycle**. On payout day Finance sends **one bank transfer per employee**, covering all their scheduled expenses, and records the UTR. The expenses become Paid.

Today the app jumps from manager approval straight to "Finance enters a UTR per expense → Paid". There's no Finance approval, no payout cycle, no per-employee payout, onboarding doesn't assign managers, and notifications only exist for "manager approved". The screens also need to look as clean as the Upgrade page.

## Goals

- **Statuses:** a clear path through `pending_manager → pending_finance → scheduled → paid`, with `rejected` possible at either approval step (with a reason).
- **Finance approval:** a separate Finance approve / reject step.
- **Payout cycles:** an org-level schedule. Approved expenses get a payout date automatically.
- **Payouts:** a record per employee per cycle, paid with one UTR.
- **Onboarding:** a manager email per team, plus a Finance manager.
- **Notifications:** in-app notifications at every step, to the right people.
- **Redesign:** all workflow screens in the Upgrade-page style.

## Non-goals

- A configurable multi-step approval engine (approach C, rejected).
- Moving money. KeepCabin records payouts; the transfer happens in the company's bank.
- Changing billing or plans, the landing page, or Settings pages other than adding the payout schedule.
- Email notifications beyond the existing `notify` edge function, which is unchanged.

## Anti-goals

- An expense visible to a manager outside their team.
- Paying the same expense twice, or one expense ending up in two payouts.
- Losing existing data. Current `pending_finance` / `paid` / `rejected` expenses must keep working.
- A redesign that changes behaviour beyond what's described here.

## Approaches

- **A. Extend the current flow with a `payouts` table (chosen).** Adds a `scheduled` status, a payout schedule on organizations, and one `payouts` row per employee per cycle linked to its expenses. This gives real payout history, and each UTR lives in one place.
- **B. Same flow, no payout table.** The payout date is computed on the fly and the UTR is copied onto each expense. Quicker, but there's no payout history, and it's hard to prevent double payment.
- **C. Configurable approval-steps engine.** Far beyond the fixed manager → finance → payout flow.

**Build order (user decision):**
1. Workflow and data
2. Onboarding managers
3. Redesign

## Decisions made with the user

- **Reimbursement period** = **payout cycle**: batches on fixed dates.
- Payment is **one transfer per employee per cycle**.
- **Approach A**, built in the order above.
- **Redesign scope:** all workflow screens, clean like `app/pages/app/upgrade.vue`.

## Data model

### `organizations`
New column `payout_schedule text not null default 'semi_monthly'`, checked against:
- `semi_monthly`: the 15th and the last day of the month (default)
- `monthly`: the last day of the month
- `weekly`: every Friday

### `expenses`
- **Status check:** extended to `('pending_manager','pending_finance','scheduled','paid','rejected')`.
- **New column** `payout_id uuid references payouts(id) on delete set null`, set when the expense is scheduled.
- **`utr_number`:** still written on each expense when its payout is paid, so the CSV export and existing screens keep working.

### `payouts` (new)

| column | type | notes |
|---|---|---|
| `id` | uuid pk | |
| `org_id` | uuid → organizations | |
| `user_id` | uuid → auth.users | The employee being paid |
| `cycle_date` | date | The payout date (IST) |
| `amount` | numeric(12,2) | Sum of linked expenses, kept in sync |
| `status` | text | `scheduled` \| `paid` |
| `utr_number` | text null | |
| `paid_at` | timestamptz null | |
| `paid_by` | uuid null | Finance user who paid |
| `created_at` | timestamptz | |

- **Unique** `(org_id, user_id, cycle_date)`: one payout per employee per cycle.
- **RLS:** finance and owner can read their org's payouts, and an employee can read their own. Writes go through the server only (service role), matching the rest of the app.

## Payout cycle rule

`nextPayoutDate(schedule, approvedAt)` is a pure function in `lib/payouts.ts` and is unit-tested:
- It returns the **first payout date strictly after the approval day** (IST). An expense approved on the 14th is paid on the 15th. One approved on the 15th is paid on the last day of the month.
- **Weekly:** the next Friday after the approval day.
- **Monthly:** the last day of the month. If that's the approval day itself, it's the last day of the following month.

## Workflow and endpoints (phase 1)

| Step | Who | Endpoint | Result |
|---|---|---|---|
| Submit | Employee | `POST /api/expenses` (existing) | `pending_manager`. Notify the team's manager. |
| Manager approve | Manager of the expense's team | `POST /api/expenses/:id/approve` (existing) | `pending_finance`. Notify the employee ("approved by manager, now with Finance") and all finance members ("new expense to review"). |
| Manager reject | Manager | `POST /api/expenses/:id/reject` (existing) | `rejected` with reason. Notify the employee. |
| Finance approve | finance / owner | **new** `POST /api/expenses/:id/finance-approve` | `scheduled`. Upsert the employee's `payouts` row for `nextPayoutDate`, add the amount, set `payout_id`. Notify the employee ("approved, will be paid on 30 Nov"). |
| Finance reject | finance / owner | **new** `POST /api/expenses/:id/finance-reject {reason}` | `rejected` with reason. Notify the employee and the team manager. |
| Pay payout | finance / owner | **new** `POST /api/payouts/:id/pay {utr_number}` | Payout `paid`. All linked expenses become `paid` with the UTR and an action_log entry. Notify the employee ("₹2,340 paid for 3 expenses, UTR …"). |
| List payouts | finance / owner | **new** `GET /api/payouts?cycle=YYYY-MM-DD` | Payouts with employee name and email, amount, expense count, status. Without a cycle: upcoming and recent. |

- **Every action** appends to `action_log`, the way the existing endpoints do.
- **Concurrency:** state changes are conditional updates (`.eq('status', expected)`), so a double click or a race can't apply a step twice. Payout totals are recalculated from the linked expenses, not incremented blindly.
- **The old per-expense pay endpoint** (`POST /api/expenses/:id/pay`) stays for legacy `pending_finance` items until phase 3 removes its UI. *(Builder call: keep it working, but the new screens don't use it.)*
- **Existing `pending_finance` expenses** simply wait for Finance approval in the new flow. No migration is needed.

## Notifications

All use the `notifications` table from the previous feature (`lib/notifications.ts`). Each links to the expense, or for payouts to the employee's first expense in that payout.

| Event | Recipient | Message |
|---|---|---|
| Submitted | Team manager | "New expense to review" |
| Manager approved | Employee | "Approved by your manager" |
| Manager approved | Finance members | "New expense to review" |
| Rejected by manager | Employee | "Rejected", with the reason |
| Rejected by Finance | Employee and team manager | "Rejected", with the reason |
| Finance approved | Employee | "Approved — will be paid on 30 Nov" |
| Paid | Employee | "₹2,340 paid · UTR …" |

## Onboarding (phase 2)

Step 2, "Set up your teams" (`app/pages/onboarding.vue`), gains a manager email field on each team row.

```
┌───────────────────────────────────────────────┐
│ Finance      Finance manager: [email      ]   │
│ Design       Manager:         [email      ]   │
│ + Add team                                    │
└───────────────────────────────────────────────┘
```

- **Finance row:** a "Finance manager" email, or the checkbox **"I'll handle finance myself"**. The owner can already pay. *(Builder call: required unless that box is ticked.)*
- **Other teams:** the manager email is optional and can be assigned later from the Organization page.
- **On Continue:** invites go out through the existing `POST /api/invites/send` (owner may invite `manager` / `finance` with a `team_id`). Plan member limits apply as usual, and new workspaces are on the Pro trial (15 members).
- **Owner settings:** the payout schedule is set in **Settings → Organization** (an owner-only section that already exists), defaulting to twice a month.

## Screens (phase 3): redesign in the Upgrade-page style

The reference is `app/pages/app/upgrade.vue`:
- `AppPage` with an `AppPageHeader` (title and one-line description)
- a summary `Card` at the top
- generous spacing, rounded-xl Cards
- tabular-nums for amounts
- tinted status `Badge`s
- shadcn-vue components only (CLAUDE.md)

| Screen | Role | Content |
|---|---|---|
| **Approvals** (`approvals.vue`) | Manager | Summary card (pending count and total). Table of the team's `pending_manager` expenses with "Submitted by" (name and email). Approve / reject, with the existing quick reasons. |
| **Finance review** (new tab or section on the Payments page) | Finance | Summary (to review, scheduled this cycle, next payout date). Table of `pending_finance` expenses from all teams, with team and submitter. Finance approve / reject. |
| **Payouts** (replaces today's Payments list) | Finance | Cycle picker (next / previous). One row per employee: avatar, name and email, number of expenses, total, status. **Pay** opens a dialog listing the expenses with a UTR field, then marks everything paid. Paid rows show the UTR and date. |
| **My Expenses** (`expenses/index.vue`, employee view) | Employee | Summary (pending, scheduled with the next date, paid this month). Each row shows the status and, when scheduled, "Pays on 30 Nov". |
| **Expenses** (manager / finance / owner view) | Manager, Finance, Owner | Same page, scoped by role, with a "Submitted by" column. |
| **Expense detail** (`expenses/[id].vue`) | All | A step tracker: Submitted → Manager → Finance → Scheduled (date) → Paid (UTR). Shows who acted when, and the rejection reason if any. |

The sidebar keeps its structure. Finance's "Payments" item points to the Payouts page, and the label becomes **"Payouts"**.

## Constraints

- **CLAUDE.md:** shadcn-vue components, CSS-variable colours, no unrelated edits, and the user commits.
- **Migration file:** SQL lives in `lib/reimbursements.sql`. The user runs it in the Supabase SQL editor.
- **Server-side checks:** all role checks happen on the server. Managers are always scoped to their own `team_id`.
- **Unit tests:** pure logic (`nextPayoutDate`, payout totals) gets Vitest tests next to the existing ones.

## Self-approval and missing approvers (user decision: the owner steps in)

- **Nobody approves their own expense,** at either step. The server enforces this: `submitted_by ≠ approver` on manager-approve, reject, finance-approve and finance-reject.
- **Manager step:** if the submitter is the team's manager, or the team has no manager, the **owner** handles the manager step. Those expenses appear in the owner's Approvals, and the owner is notified on submit. The expense then goes to Finance as normal.
- **Finance step:** any `finance` member other than the submitter can approve. If the submitter is the only finance member, the **owner** handles the Finance step.
- **The owner's own expenses:** the owner normally has no team and doesn't submit. If the owner does submit, the Finance team handles both steps, and nobody approves their own.
- **Owner access:** the owner may approve or reject at either step for any expense, except their own. The endpoints accept `owner` alongside `manager` / `finance`, with the self-approval guard.

## Clarifications (from the builder check)

- **How "team manager" is stored (answered by the code):** no new column. A team's manager is the `org_members` row with `role = 'manager'` and that `team_id`. This is how the app already scopes managers.
- **Currency (answered by the code):** all amounts are INR (`expenses.amount numeric(12,2)`, the UI shows ₹), so summing per employee is valid.
- **Atomic steps (builder call):** "Finance approve → schedule into payout" and "Pay payout" are Postgres functions in `lib/reimbursements.sql`, called through `supabase.rpc`. Each runs as one transaction with status guards, so a double click or a race can't double-schedule or double-pay. Notifications are sent after the function succeeds.
- **Payout lifecycle (builder calls):**
  - Once scheduled, an expense stays in its payout until paid. There's no "remove from payout" in v1.
  - Finance can pay a payout any time, before or after its `cycle_date`. Payouts past their date and still unpaid are shown as **Overdue** in the UI.
  - Changing `payout_schedule` only affects expenses approved afterwards. Already-scheduled payouts keep their date.
- **Saving the payout schedule (builder call):** new owner-only `PATCH /api/orgs/payout-schedule { schedule }`. The control goes in the existing owner-only **Settings → Organization** section of `app/pages/app/settings.vue`.
- **Onboarding invites (builder calls):**
  - If an invite fails, for example because the email is already a member or the plan limit is reached, a toast shows the reason and onboarding continues. The manager can be assigned later.
  - "I'll handle finance myself" isn't stored. The owner already has finance powers.

## Left to the builder

- Exact copy and wording, and empty states.
- Component breakdown inside each page.
- Whether Finance review and Payouts are tabs on one page or two routes. Default: tabs on `/app/payments`, shown as "Payouts".
