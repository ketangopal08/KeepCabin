# Reimbursement Workflow — Phase 2 (Onboarding Managers) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** New workspaces start with a manager for every team. Onboarding's "Set up your teams" step collects a manager email per team (plus a Finance manager) and sends the invites. The owner can change the payout schedule in Settings → Organization.

**Architecture:**
- **A pure helper** (`lib/onboardingInvites.ts`, unit-tested) turns the teams-step form into a list of invites, or validation errors.
- **`onboarding.vue`** keeps the team ids returned by `POST /api/teams` and sends the invites through the existing `POST /api/invites/send`.
- **Settings:** a small owner-only control calls the existing `PATCH /api/orgs/payout-schedule`.

**Tech Stack:** Nuxt 4, Vue 3, shadcn-vue, Vitest.

**Spec:** [docs/superpowers/specs/2026-11-19-reimbursement-workflow-design.md](../specs/2026-11-19-reimbursement-workflow-design.md). Phase 2 covers its "Onboarding (phase 2)" section and the onboarding-invite clarification.

## Global Constraints

- **Never commit.** Each task ends with "stop for the user to commit". Touch only the files listed, and change nothing else in them (CLAUDE.md strict scope).
- **shadcn-vue components** (`Button`, `Input`, `Checkbox`) for new controls.
- **Onboarding is always light-themed.** New controls must pin light colours with `dark:` overrides too, e.g. `bg-white dark:bg-white text-gray-900 dark:text-gray-900 border-gray-200 dark:border-gray-200`, because the outline and input variants add dark-mode backgrounds.
- **Roles in invites:** the Finance team's manager is invited with role `finance`; every other team's manager with role `manager`. Both include `team_id`.
- **Finance manager email** is required unless **"I'll handle finance myself"** is ticked. That choice isn't stored anywhere.
- **Other teams' manager emails** are optional.
- **A failed invite** (already a member, plan limit, network) shows a toast with the server message and onboarding **continues**.
- **Payout schedule values:** exactly `semi_monthly` ("Twice a month — 15th & last day"), `monthly` ("Monthly — last day"), `weekly` ("Weekly — every Friday"). Only the owner may change it.

## Review Focus

1. **The same email entered for two teams** is a validation error, not two invites. Tested in Task 1.
2. **Email with spaces or capitals** (" Sai@Company.com ") is trimmed and lower-cased before validating and inviting. Tested in Task 1.
3. **Finance left blank with the box unticked** blocks Continue with a clear message. Tested in Task 1.
4. **A team added but then left without a manager:** no invite and no error. Tested in Task 1.
5. **A non-owner opening Settings → Organization** must not see or be able to change the schedule. The UI hides it and the server already rejects with 403; checked in Task 3's manual step.

---

### Task 1: Pure invite planner

**Files:**
- Create: `lib/onboardingInvites.ts`
- Test: `tests/onboardingInvites.test.ts`

**Interfaces — produces:**
- `interface TeamDraft { id: string; name: string; isFinance: boolean; managerEmail: string }`
- `interface PlannedInvite { email: string; role: 'manager' | 'finance'; team_id: string; team_name: string }`
- `planManagerInvites(teams: TeamDraft[], financeSelf: boolean): { invites: PlannedInvite[]; errors: string[] }`

**Rules:**
- **Normalising:** trim and lower-case each email.
- **Validity:** an email is valid if it matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/`.
- **Finance team:**
  - Blank and `financeSelf` false → error `"Add a Finance manager's email, or tick “I'll handle finance myself”."`
  - `financeSelf` true → no Finance invite, even if an email was typed.
- **Invalid email** → error `"<Team name>: enter a valid email."`
- **Same email on two teams** → error `"<email> is entered for more than one team."` (listed once).
- **Invites** only when there are zero errors. Otherwise return `invites: []`.

- [ ] **Step 1: Write the failing tests:**

```ts
import { describe, it, expect } from 'vitest'
import { planManagerInvites, type TeamDraft } from '../lib/onboardingInvites'

const fin = (email = ''): TeamDraft => ({ id: 'f', name: 'Finance', isFinance: true, managerEmail: email })
const team = (id: string, name: string, email = ''): TeamDraft => ({ id, name, isFinance: false, managerEmail: email })

describe('planManagerInvites', () => {
  it('finance + design managers', () => expect(planManagerInvites([fin('ana@co.com'), team('d', 'Design', 'ketan@co.com')], false)).toEqual({
    invites: [
      { email: 'ana@co.com', role: 'finance', team_id: 'f', team_name: 'Finance' },
      { email: 'ketan@co.com', role: 'manager', team_id: 'd', team_name: 'Design' },
    ],
    errors: [],
  }))
  it('trims and lower-cases', () => expect(planManagerInvites([fin(' Ana@Co.com ')], false).invites[0]!.email).toBe('ana@co.com'))
  it('finance required unless self', () => expect(planManagerInvites([fin('')], false).errors).toEqual(["Add a Finance manager's email, or tick “I'll handle finance myself”."]))
  it('finance self → no finance invite', () => expect(planManagerInvites([fin('ana@co.com'), team('d', 'Design', 'k@co.com')], true).invites.map(i => i.team_id)).toEqual(['d']))
  it('blank optional team → skipped', () => expect(planManagerInvites([fin('ana@co.com'), team('d', 'Design')], false).invites).toHaveLength(1))
  it('invalid email', () => expect(planManagerInvites([fin('ana@co.com'), team('d', 'Design', 'not-an-email')], false)).toEqual({ invites: [], errors: ['Design: enter a valid email.'] }))
  it('duplicate email across teams', () => expect(planManagerInvites([fin('a@co.com'), team('d', 'Design', 'A@co.com')], false).errors).toEqual(['a@co.com is entered for more than one team.']))
})
```

- [ ] **Step 2: Run `npx vitest run tests/onboardingInvites.test.ts`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `lib/onboardingInvites.ts`** with no imports.
- [ ] **Step 4: Run `npx vitest run`.** Expected: all pass (85 existing + 7 new = 92).
- [ ] **Step 5: Stop for the user to commit.**

---

### Task 2: Onboarding "Set up your teams" with manager emails

**Files:**
- Modify: `app/pages/onboarding.vue` (only the team step and the script state it needs)

**Interfaces — consumes:**
- Task 1 (`planManagerInvites`, `TeamDraft`).
- `POST /api/teams { name }` returns the created team row `{ id, name, … }`.
- `POST /api/invites/send { email, role, team_id }`.

**Changes:**
- **Team state:** replace `customTeams: string[]` with `teams: TeamDraft[]`.
  - In `handleCreate`, push the auto-created Finance team from the `/api/teams` response as `{ id, name: 'Finance', isFinance: true, managerEmail: '' }`.
  - In `handleAddTeam`, push the created team's `{ id, name, isFinance: false, managerEmail: '' }`.
- **`financeSelf`:** a new `ref(false)`.
- **Team cards:** keep the existing Finance card and team cards, and add an email `Input` under each:
  - **Finance:** placeholder "Finance manager's email". Below it, a `Checkbox` labelled "I'll handle finance myself", which disables the input when ticked.
  - **Other teams:** placeholder "Manager's email (optional)".
- **Continue** (today it sets `ostep = 'plan'`) now calls a new `handleTeamsContinue()`:
  1. Run `planManagerInvites(teams.value, financeSelf.value)`. If there are errors, toast the first one and stay on the step.
  2. Otherwise send each invite one by one with the stored session token. On failure, toast `"<team name>: <server message>"` and keep going.
  3. If at least one invite was sent, toast `"Invites sent to <n> manager(s)"`.
  4. Set `ostep = 'plan'`.
  5. Disable the button and show a spinner while sending.
- **Step subtitle:** "Your Finance team is ready. Add a manager for each team, or add more teams."

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors versus the baseline of 24. `onboarding.vue` already has 3 known canvas errors.
- [ ] **Step 3: Stop for the user to commit.** Manual check, deferred to the user: sign up with a new email, enter a Finance manager email and a Design manager email, Continue, and confirm both invites arrive.

---

### Task 3: Payout schedule in Settings → Organization

**Files:**
- Modify: `app/pages/app/settings.vue`. Add one row to the existing owner-only Organization section, in its row style (`flex items-start gap-20 py-4 border-b border-dashed`). Change nothing else.

**Interfaces — consumes:** `PATCH /api/orgs/payout-schedule { schedule }` → `{ ok, schedule }` (phase 1); `ctx.org.payout_schedule` (from `useOrgContext`).

**Row:**
- **Label and help:**
  - Label: "Payout schedule".
  - Help: "When approved expenses are reimbursed. Expenses approved by Finance are paid on the next payout date."
- **Control:** three `Button`s (`variant="outline"`, `size="sm"`), with the selected one shown as `variant="default"`. Labels are exactly as in Global Constraints. Under them, a muted line: "Next payout: <D Mon YYYY>", computed with `nextPayoutDate(schedule, new Date())` from `lib/payouts.ts`.
- **On click:** PATCH, update the local value, and toast "Payout schedule updated". On error, toast the server message and keep the old value. Disable the buttons while saving.
- **Visibility:** only render the row when `ctx.member.role === 'owner'`. The section is already owner-only; this is an extra safeguard.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Run `npx nuxi typecheck`.** Expected: no new errors.
- [ ] **Step 3: Stop for the user to commit.** Manual check: as the owner, switch to Weekly and see "Next payout" change. As a manager, the row isn't there.
