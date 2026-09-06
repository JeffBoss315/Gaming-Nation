-- ============================================================
-- The application is filed by the database, at sign-up
--
-- Run this in Supabase → SQL Editor. Idempotent; safe to re-run.
--
-- THE BUG THIS FIXES
--
--   "Admin cannot get the applications sent by new drivers."
--
-- Nothing was reaching public.applications from the website. The
-- insert policy is
--
--   on public.applications for insert to authenticated
--   with check (driver_id in (select driver_code from drivers
--                             where auth_user_id = auth.uid()))
--
-- and this project has mailer_autoconfirm = false, so signUp()
-- returns a user and NO session. The browser's request is anon,
-- auth.uid() is null, and the insert is refused. Every time. It
-- is the same wall that 20260903 hit for public.drivers, and it
-- has the same answer: a row the browser is not yet allowed to
-- write has to be written by something already trusted.
--
-- The client change that goes with this (script.js) stops the
-- browser attempting that impossible insert, and files the
-- application at first sign-in instead. That works — but only
-- once the driver confirms their email and signs in. Until they
-- do, a real applicant is invisible to the recruiter, and if the
-- confirmation email never arrives they are invisible for good.
--
-- A recruiter should see somebody the moment they apply, not
-- once they have proved their email. So the row is made here,
-- next to the drivers row, in the same trigger, at the same
-- moment, needing no session at all.
--
-- Confirmation still gates everything it should: status is
-- 'pending', the driver cannot sign in unconfirmed, and approval
-- is still a recruiter's decision. It gates being APPROVED. It
-- should never have gated being SEEN.
-- ============================================================

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
  new_role    text  := coalesce(nullif(meta->>'role', ''), 'driver');
  full_name   text;
begin
  full_name := coalesce(nullif(meta->>'full_name', ''), split_part(new.email, '@', 1));

  -- Already there? Then this is a re-run, or the browser got in first.
  select d.driver_code into final_code
    from public.drivers d
   where d.auth_user_id = new.id;

  if final_code is null then

    -- driver_code is unique. The client generates it randomly and cannot
    -- see what is taken, so a clash is a matter of time. Rather than fail
    -- the signup — which would leave an Auth user with no driver record,
    -- the exact state this trigger exists to prevent — take the next free
    -- code. GMN, not HLL: the company was renamed and this was missed, so
    -- anybody the trigger named got a code in the retired scheme.
    final_code := coalesce(want_code, 'GMN' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'));

    while exists (select 1 from public.drivers where driver_code = final_code) loop
      final_code := 'GMN' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    end loop;

    insert into public.drivers (
      auth_user_id, driver_code, full_name, email, country, role, status
    )
    values (
      new.id, final_code, full_name, new.email,
      coalesce(nullif(meta->>'country', ''), 'Not set'),
      new_role, 'pending'
    );
  end if;

  -- ---- and the application, which is the new part ----
  --
  -- Staff are not applicants: an admin does not queue for approval.
  -- Same rule Accounts.ensureApplication() applies in the browser.
  if new_role = 'driver'
     and not exists (select 1 from public.applications a where a.driver_id = final_code)
  then
    insert into public.applications (driver_id, full_name, email, country, status)
    values (
      final_code, full_name, new.email,
      coalesce(nullif(meta->>'country', ''), 'Not set'),
      'pending'
    );
  end if;

  return new;
exception
  when others then
    -- A failure here would abort the signup itself and the person would be
    -- told their account could not be created, when in truth only the
    -- profile row failed. Better to let them in and repair the row than to
    -- turn away a real applicant.
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ------------------------------------------------------------
-- Backfill: every driver who applied while this was broken
--
-- These are real people who signed up on the website and were
-- never seen by a recruiter. One at a time, and a row that
-- cannot be written is skipped with a warning rather than
-- rolling back the trigger above with it — the SQL editor runs
-- this file as one transaction, and a fix that reports an error
-- and changes nothing is the worst outcome for a migration that
-- has to be run by hand.
-- ------------------------------------------------------------
do $backfill$
declare
  d        record;
  made     int := 0;
  skipped  int := 0;
begin
  for d in
    select dr.driver_code, dr.full_name, dr.email, dr.country, dr.role
      from public.drivers dr
     where coalesce(dr.role, 'driver') = 'driver'
       and not exists (
             select 1 from public.applications a where a.driver_id = dr.driver_code)
     order by dr.id
  loop
    begin
      insert into public.applications (driver_id, full_name, email, country, status)
      values (d.driver_code,
              coalesce(nullif(d.full_name, ''), 'Driver'),
              d.email,
              coalesce(nullif(d.country, ''), 'Not set'),
              'pending');
      made := made + 1;
    exception
      when others then
        raise warning 'no application could be filed for %: %', d.driver_code, sqlerrm;
        skipped := skipped + 1;
    end;
  end loop;

  raise notice 'backfill: % application(s) filed, % skipped', made, skipped;
end
$backfill$;


-- ------------------------------------------------------------
-- Check it
--
--   -- every non-staff driver should have exactly one application
--   select d.driver_code, d.full_name, a.status
--     from public.drivers d
--     left join public.applications a on a.driver_id = d.driver_code
--    where coalesce(d.role,'driver') = 'driver'
--    order by d.id;
--
--   -- and, signed in as a recruiter, this should not be empty
--   select count(*) from public.applications;
-- ------------------------------------------------------------
