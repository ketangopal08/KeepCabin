-- Reimbursement workflow (phase 1): payout schedule, payouts, atomic functions
-- Run in the Supabase SQL editor (after lib/supabase.sql). Safe to re-run.

-- 1. Organization payout schedule
alter table organizations
  add column if not exists payout_schedule text not null default 'semi_monthly';

alter table organizations drop constraint if exists organizations_payout_schedule_check;
alter table organizations
  add constraint organizations_payout_schedule_check
  check (payout_schedule in ('semi_monthly','monthly','weekly'));

-- 2. Payouts (must exist before expenses.payout_id references it)
create table if not exists payouts (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id),
  cycle_date  date not null,
  amount      numeric(12,2) not null default 0,
  status      text not null default 'scheduled'
                check (status in ('scheduled','paid')),
  utr_number  text,
  paid_at     timestamptz,
  paid_by     uuid references auth.users(id),
  created_at  timestamptz default now()
);

-- One *scheduled* payout per employee per cycle; a paid one never blocks a new scheduled one.
create unique index if not exists payouts_one_scheduled_per_cycle
  on payouts (org_id, user_id, cycle_date)
  where status = 'scheduled';

create index if not exists payouts_org_cycle_idx on payouts (org_id, cycle_date);

alter table payouts enable row level security;
-- Writes are service-role only (no write policies).
drop policy if exists "finance and owner can read org payouts" on payouts;
create policy "finance and owner can read org payouts" on payouts
  for select using (
    org_id in (
      select org_id from org_members
      where user_id = auth.uid() and role in ('finance','owner')
    )
  );

drop policy if exists "employees can read own payouts" on payouts;
create policy "employees can read own payouts" on payouts
  for select using (user_id = auth.uid());

-- 3. Expenses: payout link and extended status check
alter table expenses
  add column if not exists payout_id uuid references payouts(id) on delete set null;

create index if not exists expenses_payout_id_idx on expenses (payout_id);

-- Drop the existing status check (its auto-generated name may vary), then re-create it.
do $$
declare
  c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.expenses'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
      and pg_get_constraintdef(oid) ilike '%pending_manager%'
  loop
    execute format('alter table public.expenses drop constraint %I', c.conname);
  end loop;
end
$$;

alter table expenses drop constraint if exists expenses_status_check;
alter table expenses
  add constraint expenses_status_check
  check (status in ('pending_manager','pending_finance','scheduled','paid','rejected'));

-- 4. schedule_expense: finance-approve an expense into a payout, atomically
create or replace function schedule_expense(
  p_expense_id uuid,
  p_org_id     uuid,
  p_cycle_date date,
  p_log        jsonb
) returns uuid
language plpgsql
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_user_id   uuid;
  v_payout_id uuid;
begin
  update expenses e
     set status     = 'scheduled',
         action_log = coalesce(e.action_log, '[]'::jsonb) || jsonb_build_array(p_log),
         updated_at = now()
   where e.id = p_expense_id
     and e.org_id = p_org_id
     and e.status = 'pending_finance'
  returning e.submitted_by into v_user_id;

  if not found then
    raise exception 'not_schedulable';
  end if;

  -- Locking upsert: the no-op DO UPDATE takes a row lock on the existing scheduled payout
  -- and re-evaluates against concurrent changes (a payout paid meanwhile yields a new row).
  insert into payouts (org_id, user_id, cycle_date)
  values (p_org_id, v_user_id, p_cycle_date)
  on conflict (org_id, user_id, cycle_date) where status = 'scheduled'
  do update set cycle_date = excluded.cycle_date
  returning id into v_payout_id;

  update expenses e
     set payout_id = v_payout_id
   where e.id = p_expense_id;

  -- Row is locked by this transaction, so the sum sees all committed linked expenses.
  update payouts p
     set amount = (select coalesce(sum(e.amount), 0) from expenses e where e.payout_id = p.id)
   where p.id = v_payout_id
     and p.status = 'scheduled';

  if not found then
    raise exception 'not_schedulable';
  end if;

  return v_payout_id;
end
$$;

revoke execute on function schedule_expense(uuid, uuid, date, jsonb) from public, anon, authenticated;
grant execute on function schedule_expense(uuid, uuid, date, jsonb) to service_role;

-- 5. pay_payout: mark a payout and its scheduled expenses paid, atomically.
--    Fails with 'amount_changed' (rolling everything back) when the expenses
--    being paid don't match the count/total Finance saw when paying.
drop function if exists pay_payout(uuid, uuid, text, uuid, jsonb);
create or replace function pay_payout(
  p_payout_id       uuid,
  p_org_id          uuid,
  p_utr             text,
  p_actor           uuid,
  p_log             jsonb,
  p_expected_count  int,
  p_expected_amount numeric
) returns table(user_id uuid, amount numeric, expense_count int)
language plpgsql
set search_path = public
as $$
#variable_conflict use_variable
declare
  v_user_id uuid;
  v_amount  numeric;
  v_count   int;
begin
  update payouts p
     set status     = 'paid',
         utr_number = p_utr,
         paid_at    = now(),
         paid_by    = p_actor
   where p.id = p_payout_id
     and p.org_id = p_org_id
     and p.status = 'scheduled'
  returning p.user_id into v_user_id;

  if not found then
    raise exception 'not_payable';
  end if;

  with paid as (
    update expenses e
       set status     = 'paid',
           utr_number = p_utr,
           updated_at = now(),
           action_log = coalesce(e.action_log, '[]'::jsonb) || jsonb_build_array(p_log)
     where e.payout_id = p_payout_id
       and e.status = 'scheduled'
    returning e.amount
  )
  select count(*)::int, coalesce(sum(paid.amount), 0)
    into v_count, v_amount
    from paid;

  if v_count = 0 then
    raise exception 'not_payable';
  end if;

  if v_count <> p_expected_count or v_amount <> p_expected_amount then
    raise exception 'amount_changed';
  end if;

  -- Store and return the true total of what was marked paid.
  update payouts p
     set amount = v_amount
   where p.id = p_payout_id;

  return query select v_user_id, v_amount, v_count;
end
$$;

revoke execute on function pay_payout(uuid, uuid, text, uuid, jsonb, int, numeric) from public, anon, authenticated;
grant execute on function pay_payout(uuid, uuid, text, uuid, jsonb, int, numeric) to service_role;
