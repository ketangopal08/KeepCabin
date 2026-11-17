-- ════════════════════════════════════════════════════════════════════════════
-- KeepCabin — DEMO DATA SEED
-- Run in: Supabase dashboard → SQL Editor → paste → Run
--
-- 1. Set v_owner_email below to the email you log in with (the org owner).
-- 2. Run it once. Re-running adds another batch of expenses.
-- 3. To remove everything this script adds, run supabase/seed-demo-cleanup.sql
--
-- What it adds to YOUR org:
--   • 4 teams (only if your org has no teams yet — otherwise your teams are used)
--   • ~14 demo people: a manager for each team that has none, 2–3 employees
--     per team, and 1 finance member. Emails end in @demo.keepcabin.test and
--     cannot log in.
--   • ~70 expenses over the last 120 days with mixed statuses
--     (paid / pending manager / pending finance / rejected), tagged
--     ocr_text = 'demo-seed' so cleanup only removes demo rows.
-- ════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_owner_email text := 'ketan@gmail.com';   -- ← owner whose org gets the demo data

  v_org_id     uuid;
  v_team       record;
  v_team_count int;
  v_uid        uuid;
  v_finance_id uuid;
  v_finance_nm text := 'Ananya Iyer';
  v_mgr_name   text;
  v_emp        record;
  v_i          int;
  v_days_ago   int;
  v_created    timestamptz;
  v_cat        text;
  v_vendor     text;
  v_amount     numeric;
  v_status     text;
  v_log        jsonb;
  v_reason     text;
  v_utr        text;
  v_desc       text;

  first_names text[] := array['Aarav','Diya','Rohan','Meera','Kabir','Isha','Vihaan','Saanvi','Arjun','Priya','Kunal','Neha','Aditya','Tara','Siddharth','Riya'];
  last_names  text[] := array['Sharma','Patel','Reddy','Nair','Gupta','Mehta','Kapoor','Rao','Joshi','Menon','Singh','Das','Kulkarni','Bose','Pillai','Chopra'];
  food_v   text[] := array['Swiggy','Zomato','Starbucks','Chaayos','Haldiram''s','Barbeque Nation','Third Wave Coffee','Domino''s'];
  travel_v text[] := array['Uber','Ola','IndiGo','Rapido','IRCTC','Air India','Vistara','BluSmart'];
  stay_v   text[] := array['OYO','Taj Hotels','Lemon Tree','Treebo','ITC Hotels','Marriott','FabHotels'];
  other_v  text[] := array['Amazon','Croma','Staples','Flipkart','Notion','Figma','Reliance Digital'];
  descs    text[] := array['Client meeting','Team lunch','Airport transfer','Conference trip','Office supplies','Offsite','Software subscription','Sales visit','Late night delivery','Vendor meeting'];
  reasons  text[] := array['Missing GST invoice','Receipt is not readable','Personal expense — not reimbursable','Duplicate submission','Exceeds daily meal limit'];
  team_names text[] := array['Engineering','Sales','Design','Operations'];
  name_idx int := 1;
begin
  -- ── Find the owner's org ─────────────────────────────────────────────────
  select om.org_id into v_org_id
  from org_members om
  join auth.users u on u.id = om.user_id
  where lower(u.email) = lower(v_owner_email) and om.role = 'owner'
  limit 1;

  -- Email not set / not found → use the org automatically if there is only one
  if v_org_id is null then
    if (select count(*) from organizations) = 1 then
      select id into v_org_id from organizations limit 1;
    else
      raise exception 'Could not pick an org automatically. Set v_owner_email at the top to one of these owner emails: %',
        (select string_agg(u.email || ' (' || o.name || ')', ', ')
         from organizations o
         join org_members om on om.org_id = o.id and om.role = 'owner'
         join auth.users u on u.id = om.user_id);
    end if;
  end if;

  -- ── Teams: reuse existing, create demo teams only if none exist ──────────
  select count(*) into v_team_count from teams where org_id = v_org_id;
  if v_team_count = 0 then
    for v_i in 1..array_length(team_names, 1) loop
      insert into teams (org_id, name, created_at)
      values (v_org_id, team_names[v_i], now() - interval '150 days');
    end loop;
  end if;

  -- ── Helper: create a demo auth user + org membership ─────────────────────
  -- (inline because DO blocks can't declare functions)

  -- Finance member (no team)
  v_finance_id := gen_random_uuid();
  insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                          raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                          confirmation_token, email_change, email_change_token_new, recovery_token)
  values (v_finance_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
          'ananya.iyer.' || substr(v_finance_id::text, 1, 6) || '@demo.keepcabin.test', '', now(),
          '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_finance_nm),
          now() - interval '140 days', now(), '', '', '', '');
  insert into org_members (org_id, user_id, role, team_id, created_at)
  values (v_org_id, v_finance_id, 'finance', null, now() - interval '140 days');

  -- Per team: manager (if missing) + employees
  for v_team in select id, name from teams where org_id = v_org_id order by created_at loop

    -- Manager: reuse existing one's name for the action log, or create a demo one
    select coalesce(u.raw_user_meta_data->>'full_name', u.email) into v_mgr_name
    from org_members om join auth.users u on u.id = om.user_id
    where om.org_id = v_org_id and om.team_id = v_team.id and om.role = 'manager'
    limit 1;

    if v_mgr_name is null then
      v_uid := gen_random_uuid();
      v_mgr_name := first_names[name_idx] || ' ' || last_names[name_idx];
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, email_change, email_change_token_new, recovery_token)
      values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              lower(first_names[name_idx]) || '.' || lower(last_names[name_idx]) || '.' || substr(v_uid::text, 1, 6) || '@demo.keepcabin.test',
              '', now(), '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', v_mgr_name),
              now() - interval '130 days', now(), '', '', '', '');
      insert into org_members (org_id, user_id, role, team_id, created_at)
      values (v_org_id, v_uid, 'manager', v_team.id, now() - interval '130 days');
      name_idx := (name_idx % array_length(first_names, 1)) + 1;
    end if;

    -- 2–3 employees
    for v_i in 1..(2 + floor(random() * 2)::int) loop
      v_uid := gen_random_uuid();
      insert into auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
                              raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
                              confirmation_token, email_change, email_change_token_new, recovery_token)
      values (v_uid, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated',
              lower(first_names[name_idx]) || '.' || lower(last_names[name_idx]) || '.' || substr(v_uid::text, 1, 6) || '@demo.keepcabin.test',
              '', now(), '{"provider":"email","providers":["email"]}',
              jsonb_build_object('full_name', first_names[name_idx] || ' ' || last_names[name_idx]),
              now() - interval '120 days', now(), '', '', '', '');
      insert into org_members (org_id, user_id, role, team_id, created_at)
      values (v_org_id, v_uid, 'employee', v_team.id, now() - (interval '1 day' * (60 + floor(random() * 60))));
      name_idx := (name_idx % array_length(first_names, 1)) + 1;
    end loop;

    -- ── Expenses for this team's demo employees ────────────────────────────
    for v_emp in
      select om.user_id, coalesce(u.raw_user_meta_data->>'full_name', u.email) as name
      from org_members om join auth.users u on u.id = om.user_id
      where om.org_id = v_org_id and om.team_id = v_team.id and om.role = 'employee'
        and u.email like '%@demo.keepcabin.test'
    loop
      for v_i in 1..(5 + floor(random() * 4)::int) loop
        v_days_ago := floor(random() * 120)::int;
        v_created  := now() - (interval '1 day' * v_days_ago) - (interval '1 minute' * floor(random() * 600));

        -- category + vendor + realistic INR amount
        case floor(random() * 4)::int
          when 0 then v_cat := 'food';          v_vendor := food_v[1 + floor(random() * array_length(food_v, 1))::int];   v_amount := 150 + floor(random() * 2400);
          when 1 then v_cat := 'travel';        v_vendor := travel_v[1 + floor(random() * array_length(travel_v, 1))::int]; v_amount := 200 + floor(random() * 9000);
          when 2 then v_cat := 'accommodation'; v_vendor := stay_v[1 + floor(random() * array_length(stay_v, 1))::int];   v_amount := 1800 + floor(random() * 12000);
          else        v_cat := 'other';         v_vendor := other_v[1 + floor(random() * array_length(other_v, 1))::int];  v_amount := 300 + floor(random() * 6000);
        end case;
        v_desc := descs[1 + floor(random() * array_length(descs, 1))::int];

        -- status: recent ones are still in progress, older ones mostly settled
        if v_days_ago < 7 then
          v_status := case when random() < 0.65 then 'pending_manager' else 'pending_finance' end;
        elsif v_days_ago < 20 then
          v_status := case when random() < 0.25 then 'pending_manager' when random() < 0.6 then 'pending_finance' when random() < 0.85 then 'paid' else 'rejected' end;
        else
          v_status := case when random() < 0.85 then 'paid' else 'rejected' end;
        end if;

        -- action log + extra fields per status
        v_log    := jsonb_build_array(jsonb_build_object('action','submitted','actor_name',v_emp.name,'timestamp',v_created));
        v_reason := null;
        v_utr    := null;
        if v_status in ('pending_finance','paid') then
          v_log := v_log || jsonb_build_array(jsonb_build_object('action','approved','actor_name',v_mgr_name,'timestamp',v_created + interval '1 day'));
        end if;
        if v_status = 'paid' then
          v_utr := 'UTR' || lpad(floor(random() * 1e12)::bigint::text, 12, '0');
          v_log := v_log || jsonb_build_array(jsonb_build_object('action','paid','actor_name',v_finance_nm,'timestamp',v_created + interval '3 days','note',v_utr));
        end if;
        if v_status = 'rejected' then
          v_reason := reasons[1 + floor(random() * array_length(reasons, 1))::int];
          v_log := v_log || jsonb_build_array(jsonb_build_object('action','rejected','actor_name',v_mgr_name,'timestamp',v_created + interval '1 day','note',v_reason));
        end if;

        insert into expenses (org_id, team_id, submitted_by, amount, vendor, expense_date, description,
                              category, receipt_url, ocr_text, status, rejection_reason, utr_number,
                              action_log, created_at, updated_at)
        values (v_org_id, v_team.id, v_emp.user_id, v_amount, v_vendor, v_created::date, v_desc,
                v_cat, 'https://placehold.co/600x800/png?text=Receipt', 'demo-seed', v_status, v_reason, v_utr,
                v_log, v_created, v_created);
      end loop;
    end loop;
  end loop;

  raise notice 'Demo data added to org %', v_org_id;
end $$;
