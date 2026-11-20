-- In-app notifications
-- Run once in the Supabase SQL editor.

create table if not exists notifications (
  id          uuid primary key default gen_random_uuid(),
  org_id      uuid not null references organizations(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null,                 -- e.g. 'expense_approved'
  title       text not null,
  body        text not null default '',
  expense_id  uuid references expenses(id) on delete cascade,
  read        boolean not null default false,
  created_at  timestamptz not null default now()
);
create index if not exists notifications_user_created_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;
-- Users can read their own notifications; writes go through the server (service role).
create policy "users read own notifications" on notifications
  for select using (user_id = auth.uid());
