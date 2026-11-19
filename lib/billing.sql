-- Subscriptions & billing
-- Run once in the Supabase SQL editor (after lib/supabase.sql).

create table if not exists subscriptions (
  org_id                            uuid primary key references organizations(id) on delete cascade,
  plan                              text not null default 'free'
                                      check (plan in ('free','pro','business','enterprise')),
  interval                          text check (interval in ('monthly','yearly')),
  status                            text not null default 'expired'
                                      check (status in ('active','past_due','cancelled','expired')),
  razorpay_subscription_id          text unique,
  current_period_start              timestamptz,
  current_period_end                timestamptz,
  cancel_at_period_end              boolean not null default false,
  member_cap_override               int,
  pending_razorpay_subscription_id  text,
  pending_plan                      text check (pending_plan in ('free','pro','business','enterprise')),
  pending_interval                  text check (pending_interval in ('monthly','yearly')),
  last_payment_id                   text,
  last_payment_amount               int,   -- paise
  last_event_at                     timestamptz,  -- newest Razorpay event applied
  updated_at                        timestamptz default now()
);
alter table subscriptions enable row level security;
-- Members can read their own org's subscription; writes are service-role only (no write policies).
create policy "members can read own org subscription" on subscriptions
  for select using (
    org_id in (select get_user_org_ids(auth.uid()))
  );

-- Processed Razorpay webhook events (idempotency + debugging). Service role only.
create table if not exists billing_events (
  id         text primary key,
  type       text not null,
  payload    jsonb not null,
  created_at timestamptz default now()
);
alter table billing_events enable row level security;

-- If you created the table before last_event_at existed, run:
-- alter table subscriptions add column if not exists last_event_at timestamptz;
