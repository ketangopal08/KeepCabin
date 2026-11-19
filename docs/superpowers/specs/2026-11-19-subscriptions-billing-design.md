# Subscriptions & Billing — Design

**Date:** 2026-11-19
**Status:** Approved by the user (rebuild of the 2026-11-18 design, with no sandbox mode and with premium icons added)

## Intent

KeepCabin charges workspaces (organizations) for paid plans. Each workspace has a plan, the server enforces that plan's limits, and the owner pays through **Razorpay Subscriptions**, which renews automatically. Paid features are marked with a crown icon so users can see what upgrading unlocks.

The Razorpay **Test Mode** account is ready, and the 4 plans already exist. Their ids are in `.env`.

## Goals

- Every org has a current plan, stored in the database. The default is Free, with a 14-day Pro trial for new orgs.
- Limits are enforced **server-side**.
- Owners subscribe, change plan, and cancel through Razorpay. Webhooks keep the database in sync.
- The upgrade page and the landing pricing section show the same plans, and the upgrade page shows the real current plan and usage.
- A crown icon marks paid features while the workspace is on a plan that lacks them.

## Non-goals

- Per-seat or active-member billing. Pricing is flat per plan with a member cap.
- Building Business-only extras (multi-currency, Tally/Zoho export, audit log, approval policies, SSO). They are shown as "Coming soon".
- Prepaid or one-time payments, and bank transfer.
- Self-serve Enterprise. It is "Contact sales" and set manually in the database.
- A sandbox or fake payment mode.

## Anti-goals

- Deleting data or removing members on downgrade, expiry, or a failed payment.
- Limits enforced only in the UI.
- Granting a paid plan without a verified Razorpay signature or webhook.
- Gating the approval → payment flow.

## Plans

All prices are in INR and exclude 18% GST.

| | Free | Pro | Business | Enterprise |
|---|---|---|---|---|
| Monthly | ₹0 | ₹1,499 | ₹3,999 | Contact sales |
| Yearly | ₹0 | ₹14,990 | ₹39,990 | Contact sales |
| Members (incl. pending invites) | 3 | 15 | 50 | `member_cap_override`, otherwise unlimited |
| Teams | 2 (shown as "1 team + Finance"; onboarding auto-creates Finance) | Unlimited | Unlimited | Unlimited |
| Expenses submitted / month (IST) | 30 | 500 | Unlimited | Unlimited |
| CSV export | Current month only | Any range | Any range | Any range |
| Google Drive sync | — | ✓ | ✓ | ✓ |
| Business extras | — | — | Coming soon | Coming soon |

**Razorpay plans** are already created in Test Mode, with amounts that include GST:

| Plan | Amount | Env var |
|---|---|---|
| Pro monthly | ₹1,768.82 | `RAZORPAY_PLAN_PRO_MONTHLY` |
| Pro yearly | ₹17,688.20 | `RAZORPAY_PLAN_PRO_YEARLY` |
| Business monthly | ₹4,718.82 | `RAZORPAY_PLAN_BUSINESS_MONTHLY` |
| Business yearly | ₹47,188.20 | `RAZORPAY_PLAN_BUSINESS_YEARLY` |

The UI shows prices as "₹1,499 + GST".

## Approaches

1. **Razorpay Subscriptions with auto-renew (chosen).**
2. Prepaid periods with manual renewal. Rejected because it adds churn.
3. Both. Rejected because it doubles the payment paths.

Stripe was rejected because its India and UPI support is weak.

## Data model

Table `subscriptions` holds one row per org (PK `org_id`). Columns:

- `plan`, `interval`, `status` (`active` | `past_due` | `cancelled` | `expired`)
- `razorpay_subscription_id`
- `current_period_start`, `current_period_end`, `cancel_at_period_end`
- `member_cap_override`
- `pending_razorpay_subscription_id`, `pending_plan`, `pending_interval`
- `last_payment_id`, `last_payment_amount` (paise)
- `updated_at`

RLS: members can read their own org's row. Writes go through the service role only.

Table `billing_events (id pk, type, payload, created_at)` records webhook ids so each event is processed once.

**Effective plan:**
- `active` or `past_due` → the paid plan. Razorpay retries a failed payment until it sends `subscription.halted`.
- `cancelled` → the paid plan until `current_period_end`.
- If none of those apply and the org was created less than 14 days ago → Pro trial.
- Otherwise → Free.
- Pending fields never affect the effective plan.

## Enforcement

`assertWithinLimit(ctx, kind)` throws HTTP 402 with `data: { code: 'PLAN_LIMIT', limit, plan }`.

| Limit | Where it is checked |
|---|---|
| Members | invites/send (members + pending invites), plus a backstop in invites/accept (members only) |
| Teams | teams POST |
| Expenses | expenses POST |
| Export | reports/export |
| Drive sync | sync-drive and import-url; both also gain an auth check |

The client shows a toast with an "Upgrade" action for any `PLAN_LIMIT` error.

## Payment flow

**Owner only.**

- **Subscribe:** `POST /api/billing/subscribe`
  - **New subscription or upgrade:** creates a Razorpay subscription and stores it in the pending fields.
  - **Downgrade:** creates the new subscription with `start_at = current_period_end`, and cancels the old one at cycle end.
- **Checkout:** the client opens Razorpay Checkout.
- **Verify:** `POST /api/billing/verify` checks the HMAC, fetches the subscription and payment, and promotes pending → active.
- **Webhook:** `POST /api/billing/webhook` checks the signature, dedupes by event id, and updates state. The webhook is the source of truth.
- **After an upgrade is promoted:** the old subscription is cancelled immediately, and the unused days of the last payment are refunded pro rata.
- **Cancel:** `POST /api/billing/cancel` cancels at cycle end.
- **Status:** `GET /api/billing` returns plan, trial, status, period end, pending plan, limits, usage, and `canManage`.

## Premium icon (user decision, 2026-11-19)

The icon is `solar:crown-linear` in an amber accent. It shows only while the workspace's effective plan lacks the feature:

- **Sidebar:** a crown next to "Reports" (finance and owner menus) when `exportAnyRange` is false.
- **Reports page:** when `exportAnyRange` is false, a crown appears next to the month picker with a hint like "Older months need Pro". Choosing a month other than the current one disables export and shows an "Upgrade" link.
- **Org page:** when the team cap is reached, the "Create team" control shows a crown and opens `/app/upgrade` instead of creating a team. Invite buttons on the org and team pages work the same way when the member cap is reached.

Billing state comes from a shared client composable, `useBilling()`, loaded once per session the same way `useOrgContext` is.

## UI

- **`upgrade.vue`:** uses real plans and the current plan. It adds a "Your plan" card with usage meters, the period end, a `past_due` banner, a pending-downgrade note, and a cancel option. Razorpay Checkout is wired in, Business extras show "Coming soon", and the FAQ is updated to the real behaviour.
- **`PricingSection.vue`** (landing page): uses the same plans.
- All UI uses shadcn-vue components, per CLAUDE.md.

## Left to the builder

- Migration location (`lib/billing.sql`, run by the user in the Supabase SQL editor).
- Copy wording.
- Webhook testing through an ngrok tunnel.
