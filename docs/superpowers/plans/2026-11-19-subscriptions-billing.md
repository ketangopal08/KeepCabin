# Subscriptions & Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Real plans per workspace, server-enforced limits, Razorpay Subscriptions checkout and webhooks, and crown icons on paid features.

**Architecture:**
- `lib/plans.ts` holds the pure plan logic and is shared by client and server.
- `lib/billing.ts` is the server-side plan and usage layer.
- `lib/razorpay.ts` handles signatures, the webhook state machine, and REST calls.
- `server/api/billing/*` holds the endpoints.
- `useBilling()` is the shared client state that drives the upgrade page and the crowns.

**Tech Stack:** Nuxt 4 / Nitro, Supabase, Razorpay Subscriptions REST + Checkout.js, shadcn-vue, Vitest (new dev dependency).

**Spec:** [docs/superpowers/specs/2026-11-19-subscriptions-billing-design.md](../specs/2026-11-19-subscriptions-billing-design.md)

## Global Constraints

- **Never commit** (CLAUDE.md). Touch only the files listed in each task, and don't refactor or reformat anything else.
- Use shadcn-vue components and CSS-variable colours.
- **Prices:** Pro ₹1,499/mo, ₹14,990/yr. Business ₹3,999/mo, ₹39,990/yr. All exclude GST and are shown as "+ GST".
- **Plan amounts include GST and are already created in Razorpay.** The ids come from `RAZORPAY_PLAN_{PRO,BUSINESS}_{MONTHLY,YEARLY}`.
- **Caps:**
  - Free: 3 members / 2 teams / 30 expenses per month
  - Pro: 15 / unlimited / 500
  - Business: 50 / unlimited / unlimited
  - Enterprise: override, otherwise unlimited
- **Free** exports the current IST month only and has no Drive sync.
- **Limit errors** are 402 with `data: { code: 'PLAN_LIMIT', limit, plan }`.
- **Trial:** no paid access and org younger than 14 days → Pro.
- **Only the owner** manages billing.
- **No deletion and no member removal on downgrade.**
- **The crown** is `solar:crown-linear` in an amber accent (`text-amber-500`). It appears only when the effective plan lacks the feature.

## Review Focus

1. Duplicate or out-of-order webhooks, including the old subscription's `cancelled` event after an upgrade. Covered by the `applyWebhookEvent` tests.
2. An abandoned checkout must keep the current plan. Covered by the `effectivePlan` pending-fields test.
3. Invites as a way around the cap. Covered by `checkLimit` with members + invites, plus the accept backstop.
4. The IST month boundary. Covered by the `istMonthStart` test.
5. Refund clamps. Covered by the `proratedRefundPaise` tests.

---

### Task 1: `lib/plans.ts` + Vitest

**Files:**
- Modify: `package.json` (vitest devDependency, `"test": "vitest run"`)
- Create: `lib/plans.ts`
- Create: `tests/plans.test.ts`

**Produces:**
- Types: `PlanId`, `BillingInterval`, `SubStatus`, `LimitKind`, `PlanLimits`, `PlanDisplay`, `SubscriptionRow`, `Usage`, `BillingStatus`.
- Constants: `PLANS`, `PLAN_ORDER`.
- Functions:
  - `effectivePlan(sub, orgCreatedAt, now)`
  - `istMonthStart(now)`
  - `currentIstMonth(now): string`
  - `proratedRefundPaise(amount, start, end, now)`
  - `classifyChange(current, target)`
  - `exportAllowed(limits, month, now)`
  - `checkLimit(limits, kind, used)`

- [ ] **Step 1: Install Vitest and write the tests.** The tests cover:
  - caps and prices
  - `effectivePlan`: no row with an old org; a 3-day-old org gets the trial; exactly 14 days gives free; active; `past_due` with an old period end stays paid; cancelled before and after the period end; expired; pending fields ignored; an expired row inside the trial window gets the trial; Enterprise override
  - `istMonthStart`: `2026-11-30T20:00Z` → `2026-11-30T18:30Z`
  - refund: half the period → 88441 of 176882; after the end → 0; before the start → full amount
  - `classifyChange`: new, upgrade, upgrade (monthly → yearly), downgrade, downgrade (yearly → monthly), same
  - `exportAllowed`: Free with the current month, a past month, and no month; Pro
  - `checkLimit`: at the cap, under the cap, unlimited
- [ ] **Step 2: Run `npm test`.** Expected: FAIL (module missing).
- [ ] **Step 3: Implement `lib/plans.ts`** with no imports. Display data is ported from `upgrade.vue`.
- [ ] **Step 4: Run `npm test`.** Expected: PASS.

### Task 2: Migration and server billing layer

**Files:**
- Create: `lib/billing.sql`
- Create: `lib/billing.ts`

**Produces:**
- `serviceClient()`
- `getSubscription(orgId)`
- `getOrgPlan(org)` → `{ plan, trial, limits, sub }`
- `getUsage(orgId)` → `Usage`
- `assertWithinLimit(ctx, kind, opts?)`

Count queries throw on a Supabase error, so a database failure blocks the action instead of letting it through.

- [ ] **Step 1: Write the SQL**, using the `get_user_org_ids(auth.uid())` policy style from `lib/supabase.sql`.
- [ ] **Step 2: Write `billing.ts`.**
- [ ] **Step 3: Run `npx nuxi typecheck`.** Expected: no errors in the new files.

### Task 3: Enforce limits

**Files:**
- Modify (server):
  - `server/api/invites/send.post.ts`
  - `server/api/invites/accept.post.ts`
  - `server/api/teams/index.post.ts`
  - `server/api/expenses/index.post.ts`
  - `server/api/reports/export.get.ts`
  - `server/api/sync-drive.post.ts`
  - `server/api/import-url.post.ts`
- Modify (client):
  - `app/components/app/SyncButtons.vue` (auth header + guard)
- Create: `app/utils/planLimit.ts` (`isPlanLimitError`, `showPlanLimitToast`)
- Modify (catch-guard only):
  - `app/pages/app/team.vue`
  - `app/pages/app/org.vue`
  - `app/pages/app/teams/[id].vue`
  - `app/pages/app/expenses/new.vue`
  - `app/pages/app/reports.vue` (handle the 402 body)

- [ ] **Step 1: Add the server checks.** Each check goes after validation and before any insert.
- [ ] **Step 2: Add the UI guards.** In each catch block, the guard is the first line.
- [ ] **Step 3: Run `npx nuxi typecheck`.** Expected: no new errors.

### Task 4: `lib/razorpay.ts`

**Files:**
- Create: `lib/razorpay.ts`
- Create: `tests/razorpay.test.ts`
- Modify: `nuxt.config.ts` (runtimeConfig keys only)

**Produces:**
- `verifyPaymentSignature(paymentId, subscriptionId, signature, secret)`
- `verifyWebhookSignature(raw, signature, secret)`
- `rzp(path, init?)`
- `WebhookEffect`
- `applyWebhookEvent(sub, event)`
- `planIdFor(plan, interval)`

- [ ] **Step 1: Write the tests.**
  - Signatures: a correct one, a wrong one, and one of a different length.
  - `applyWebhookEvent`: `activated` / `charged` for the pending subscription → `promote` with `oldSubscriptionId`; `charged` for the active one → `update` with the period and payment fields; `pending` → `past_due`; `halted` → `expired`; `cancelled` for the active one → `cancelled`; any event for an unknown id → `ignore`; `payment.failed` for the active one → `past_due`.
- [ ] **Step 2: Confirm RED, implement, confirm GREEN.**

### Task 5: Billing API

**Files:**
- Create:
  - `server/api/billing/index.get.ts`
  - `server/api/billing/subscribe.post.ts`
  - `server/api/billing/verify.post.ts`
  - `server/api/billing/cancel.post.ts`
  - `server/api/billing/webhook.post.ts`
  - `lib/billingActions.ts` (`applyEffect`)

These follow the spec's payment flow. `applyEffect` is idempotent: it re-reads the row and skips the promote when `razorpay_subscription_id` already equals the incoming id.

- [ ] **Step 1: Implement.**
- [ ] **Step 2: Typecheck.**
- [ ] **Step 3: Smoke test with curl.**
  - The webhook with a bad signature should return 400.
  - `GET /api/billing` without auth should return 401.

### Task 6: `useBilling` and the upgrade page

**Files:**
- Create: `app/composables/useBilling.ts` (shared module-level state; `load()`, `refresh()`, `checkout()`, `cancel()`)
- Modify: `app/pages/app/upgrade.vue`

- [ ] **Step 1: Implement** the composable and the page per the spec's UI section.
- [ ] **Step 2: Manual run in the browser on Free.** The user must have run the migration first. Checkout opens, and the test payment `success@razorpay` succeeds.

### Task 7: Premium crowns

**Files:**
- Modify:
  - `app/components/app/AppSidebar.vue` (crown on Reports)
  - `app/pages/app/reports.vue` (crown + hint + disabled export for older months)
  - `app/pages/app/org.vue` (Create team / Invite crown at cap)
  - `app/pages/app/team.vue` (Invite crown at cap)
  - `app/pages/app/teams/[id].vue` (Invite crown at cap)

**Consumes:** `useBilling()`.

- [ ] **Step 1: Implement.** At the cap, the control keeps its look, gains a crown, and clicking it goes to `/app/upgrade`.
- [ ] **Step 2: Manual check.** On Free at the cap, the crowns show. On Pro, they don't.

### Task 8: Landing pricing

**Files:**
- Modify: `app/components/landing/PricingSection.vue` (`tiers` only, plus an Enterprise line)

- [ ] **Step 1: Build `tiers` from `PLANS`.** Free, Pro, and Business, priced "/mo + GST", with the first 4 features of each.
