-- Receipts table schema
-- Run this in the Supabase dashboard → SQL Editor
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  drive_file_id text,
  storage_url text not null,
  ocr_text text,
  created_at timestamptz default now()
);

alter table receipts enable row level security;
create policy "public read" on receipts for select using (true);
create policy "public insert" on receipts for insert with check (true);
create policy "public update" on receipts for update using (true);

-- Also create a public storage bucket named 'receipts' in Supabase Storage → Buckets → New bucket → name: receipts, public: true

-- Category system migration (run after initial schema)
create table if not exists categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  color      text not null,
  created_at timestamptz default now()
);

alter table categories enable row level security;
create policy "public read"   on categories for select using (true);
create policy "public insert" on categories for insert with check (true);
create policy "public update" on categories for update using (true);
create policy "public delete" on categories for delete using (true);

alter table receipts add column if not exists category_id        uuid references categories(id) on delete set null;
alter table receipts add column if not exists category_suggested boolean not null default false;

-- Organizations (no dependencies)
create table organizations (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  size       text check (size in ('1-10','11-50','51-200','200+')),
  owner_id   uuid references auth.users(id),
  created_at timestamptz default now()
);
alter table organizations enable row level security;

-- Teams (depends on organizations)
create table teams (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) on delete cascade,
  name       text not null,
  created_at timestamptz default now()
);
alter table teams enable row level security;

-- Org members (depends on organizations + teams)
create table org_members (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) on delete cascade,
  user_id    uuid references auth.users(id) on delete cascade,
  role       text not null check (role in ('owner','manager','finance','employee')),
  team_id    uuid references teams(id) on delete set null,
  created_at timestamptz default now(),
  unique (org_id, user_id)
);
alter table org_members enable row level security;

-- Security definer helpers (must come after org_members table)
create or replace function get_user_org_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select org_id from org_members where user_id = uid
$$;

create or replace function get_user_team_ids(uid uuid)
returns setof uuid
language sql
security definer
stable
as $$
  select team_id from org_members where user_id = uid and team_id is not null
$$;

create or replace function get_user_role(uid uuid, oid uuid)
returns text
language sql
security definer
stable
as $$
  select role from org_members where user_id = uid and org_id = oid limit 1
$$;

-- RLS policies for organizations
create policy "members can read their org" on organizations
  for select using (
    id in (select get_user_org_ids(auth.uid()))
  );
create policy "owner can update" on organizations
  for update using (owner_id = auth.uid());
create policy "owner can insert own org" on organizations
  for insert with check (owner_id = auth.uid());

-- RLS policies for teams (owner insert policy references org_members, so must come after)
create policy "org members can read teams" on teams
  for select using (
    org_id in (select get_user_org_ids(auth.uid()))
  );
create policy "owner can insert teams" on teams
  for insert with check (
    org_id in (
      select org_id from org_members
      where user_id = auth.uid() and role = 'owner'
    )
  );

-- RLS policies for org_members
create policy "members can read their org members" on org_members
  for select using (
    org_id in (select get_user_org_ids(auth.uid()))
  );
create policy "service role insert" on org_members
  for insert with check (auth.role() = 'service_role');

-- Invites
create table invites (
  id         uuid primary key default gen_random_uuid(),
  org_id     uuid references organizations(id) on delete cascade,
  email      text not null,
  role       text not null check (role in ('manager','finance','employee')),
  team_id    uuid references teams(id) on delete cascade,
  token      text unique not null default gen_random_uuid()::text,
  accepted   boolean default false,
  created_at timestamptz default now(),
  expires_at timestamptz default now() + interval '7 days'
);
alter table invites enable row level security;
create policy "org owner and manager can read invites" on invites
  for select using (
    org_id in (
      select org_id from org_members
      where user_id = auth.uid() and role in ('owner','manager')
    )
  );
create policy "service role insert invites" on invites
  for insert with check (auth.role() = 'service_role');
create policy "service role update invites" on invites
  for update using (auth.role() = 'service_role');

-- Expenses
create table expenses (
  id               uuid primary key default gen_random_uuid(),
  org_id           uuid references organizations(id) on delete cascade,
  team_id          uuid not null references teams(id),
  submitted_by     uuid not null references auth.users(id),
  amount           numeric(12,2) not null,
  vendor           text,
  expense_date     date,
  description      text,
  category         text check (category in ('food','travel','accommodation','other')),
  receipt_url      text not null,
  ocr_text         text,
  status           text not null default 'pending_manager'
                     check (status in ('pending_manager','pending_finance','paid','rejected')),
  rejection_reason text,
  utr_number       text,
  action_log       jsonb not null default '[]',
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);
alter table expenses enable row level security;
-- Employees see only their own expenses
create policy "employee sees own expenses" on expenses
  for select using (submitted_by = auth.uid());
-- Managers see their team's expenses
create policy "manager sees team expenses" on expenses
  for select using (
    team_id in (
      select team_id from org_members
      where user_id = auth.uid() and role = 'manager'
    )
  );
-- Finance and owner see all org expenses
create policy "finance and owner see all" on expenses
  for select using (
    org_id in (
      select org_id from org_members
      where user_id = auth.uid() and role in ('finance','owner')
    )
  );
create policy "employee can insert expenses" on expenses
  for insert with check (submitted_by = auth.uid());
create policy "service role can update expenses" on expenses
  for update using (auth.role() = 'service_role');

create or replace function update_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger expenses_updated_at
  before update on expenses
  for each row execute function update_updated_at();
