-- ============================================================
-- GAMING NATION — new driver codes are GMN, not HLL
--
-- Run this in Supabase -> SQL Editor. Idempotent and safe to
-- re-run. It does NOT touch a single existing row.
--
-- WHY THIS FILE EXISTS
--
-- The site now issues GMN#### to anyone signing up. The trigger
-- in 20260903_driver_row_on_signup.sql still issued HLL####, and
-- the trigger is the one that wins: it runs inside the database
-- on auth.users insert, so a signup that reached Supabase before
-- the browser finished got an HLL code while the page believed it
-- had been given a GMN one. Two names for the same driver, and
-- applications.driver_id holds the text code — so the mismatch
-- would hide the application from the person who filed it.
--
-- WHAT DOES NOT CHANGE
--
-- Every driver already issued an HLL code keeps it. Their code is
-- their identity: it is in drivers.driver_code, in
-- applications.driver_id, in job records and in whatever anyone
-- has written down. Renumbering them would be a rename of people,
-- not of a brand, and nothing here does it.
--
-- So the fleet is deliberately mixed after this:
--
--   HLL-1001, HLL4821, ...   everyone who was already here
--   GMN3907, ...             everyone from now on
--
-- The site reads both. script.js matches /^(HLL|GMN)/i where it
-- has to recognise a code, and that is the one place it matters.
-- ============================================================


-- ------------------------------------------------------------
-- 1. The signup trigger
--
-- Same function as before in every respect but the two literals.
-- Replaced whole rather than patched, because create or replace
-- is the only way to change a function body and a partial edit
-- would leave the two halves disagreeing.
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer                 -- runs as the owner, so RLS does not apply
set search_path = public
as $$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  want_code   text  := nullif(meta->>'driver_code', '');
  final_code  text;
begin
  -- Already there? Then this is a re-run, or the browser got in first.
  if exists (select 1 from public.drivers where auth_user_id = new.id) then
    return new;
  end if;

  -- driver_code is unique. The client generates it randomly (GMN + four
  -- digits) and cannot see what is taken, so a clash is a matter of time.
  -- Rather than fail the signup — which would leave an Auth user with no
  -- driver record, the exact state this trigger exists to prevent — take
  -- the next free code.
  --
  -- want_code is honoured whatever its prefix. A client that has not been
  -- reloaded since the rename still sends HLL####, and refusing it would
  -- turn a stale tab into a failed signup.
  final_code := coalesce(want_code, 'GMN' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'));

  -- The uniqueness check is over the whole column, so a generated GMN code
  -- can never collide with an issued HLL one either.
  while exists (select 1 from public.drivers where driver_code = final_code) loop
    final_code := 'GMN' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
  end loop;

  insert into public.drivers (
    auth_user_id, driver_code, full_name, email, country, role, status
  )
  values (
    new.id,
    final_code,
    coalesce(nullif(meta->>'full_name', ''), split_part(new.email, '@', 1)),
    new.email,
    coalesce(nullif(meta->>'country', ''), 'Not set'),
    coalesce(nullif(meta->>'role', ''), 'driver'),
    'pending'
  );

  return new;
end $$;


-- ------------------------------------------------------------
-- 2. What is deliberately not here
--
-- The backfill in 20260903 is a one-off `do $backfill$` block, not
-- a stored function. It has already run, and it hands codes to
-- Auth users who have no drivers row — which by now is nobody. It
-- is history and is left exactly as it was; re-running it would
-- issue nothing either way.
--
-- public.hll_signup_ready() keeps its name. It is a diagnostic
-- with no caller anywhere in the project, so renaming it would be
-- risk spent on something nothing reads.
-- ------------------------------------------------------------


-- ------------------------------------------------------------
-- 3. Check it
--
--   -- the function should mention GMN and not HLL
--   select prosrc like '%GMN%' as mints_gmn,
--          prosrc like '%''HLL''%' as still_mints_hll
--     from pg_proc where proname = 'handle_new_user';
--
--   -- and nobody should have been renamed
--   select left(driver_code, 3) as prefix, count(*)
--     from public.drivers group by 1 order by 2 desc;
-- ------------------------------------------------------------
