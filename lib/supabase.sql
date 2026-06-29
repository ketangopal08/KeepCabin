-- Receipts table schema
-- Run this in the Supabase dashboard → SQL Editor
create table receipts (
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
create table categories (
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

alter table receipts
  add column category_id        uuid references categories(id) on delete set null,
  add column category_suggested boolean not null default false;
