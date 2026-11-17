-- ════════════════════════════════════════════════════════════════════════════
-- KeepCabin — REMOVE DEMO DATA
-- Run in: Supabase dashboard → SQL Editor → paste → Run
-- Removes only what supabase/seed-demo.sql added. Your real data is untouched.
-- ════════════════════════════════════════════════════════════════════════════

-- 1. Demo expenses (tagged by the seed)
delete from expenses where ocr_text = 'demo-seed';

-- 2. Demo people (org memberships are removed automatically via cascade)
delete from auth.users where email like '%@demo.keepcabin.test';

-- 3. Demo teams — only the seed's team names, and only if nothing real uses them
delete from teams t
where t.name in ('Engineering', 'Sales', 'Design', 'Operations')
  and not exists (select 1 from org_members m where m.team_id = t.id)
  and not exists (select 1 from expenses e where e.team_id = t.id)
  and not exists (select 1 from invites i where i.team_id = t.id);
