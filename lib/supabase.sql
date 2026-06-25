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
