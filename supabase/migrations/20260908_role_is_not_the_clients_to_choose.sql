-- ============================================================
-- GAMING NATION — a signing-up user cannot choose to be staff
--
-- Run this in Supabase → SQL Editor. Idempotent; safe to re-run.
-- It changes ONE decision inside handle_new_user() and touches no
-- existing row.
--
-- RUN THIS ONE BEFORE THE OTHERS. It closes a live hole.
--
-- ------------------------------------------------------------
-- WHAT WAS WRONG
--
-- public.is_staff() decides who may read the whole roster, read
-- every application, approve or reject them, manage drivers, and
-- read every driver's position. It answers from one column:
--
--     select exists (select 1 from public.drivers
--                     where auth_user_id = auth.uid()
--                       and role in ('recruiter','dispatcher',
--                           'event_manager','moderator',
--                           'management','admin','super_admin'))
--
-- and that column was filled, at signup, from this:
--
--     new_role text := coalesce(nullif(meta->>'role', ''), 'driver');
--
-- where meta is new.raw_user_meta_data — which Supabase populates
-- verbatim from options.data on auth.signUp(). That is the
-- browser's to write. The anon key is public and sits in
-- supabase-client.js, so nobody even has to use the site:
--
--     supabase.auth.signUp({
--       email, password,
--       options: { data: { role: 'super_admin' } }
--     })
--
-- and the trigger writes super_admin into drivers.role, and
-- is_staff() says yes from then on.
--
-- The check that was supposed to prevent this lived in the browser
-- — script.js decides `const role = isOwner ? 'admin' : 'driver'`
-- — which is not a check, it is a suggestion. A control that runs
-- on the attacker's machine is not a control.
--
-- ------------------------------------------------------------
-- THE FIX
--
-- The role is decided HERE, from the email address on the Auth
-- user, and the client's metadata is ignored for this one field.
-- Everything else in the function is unchanged; it is replaced
-- whole because create or replace is the only way to change a
-- function body, and a partial edit would leave the halves
-- disagreeing.
--
-- Staff are made the way staff should be made: by somebody who is
-- already staff, editing the driver record in the console, under
-- the "Staff can manage drivers" policy that already exists.
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer                 -- runs as the owner, so RLS does not apply
set search_path = public
as $handle_new_user$
declare
  meta        jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  want_code   text  := nullif(meta->>'driver_code', '');
  final_code  text;
  new_role    text;               -- decided below; NEVER read from meta
  full_name   text;
  country     text;
begin
  full_name := coalesce(nullif(meta->>'full_name', ''), split_part(new.email, '@', 1));
  country   := coalesce(nullif(meta->>'country', ''), 'Not set');

  -- The one decision this migration exists to move out of the browser.
  --
  -- The founding account is recognised by its address, which is a fact
  -- about the company rather than something a signup can assert. Everybody
  -- else starts as a driver and is promoted by a human.
  new_role := case
                when lower(new.email) = lower('jeffboss730@gmail.com') then 'admin'
                else 'driver'
              end;

  -- Already there? Then this is a re-run, or the browser got in first.
  select d.driver_code into final_code
    from public.drivers d
   where d.auth_user_id = new.id;

  if final_code is null then

    -- driver_code is unique and the browser cannot see what is taken, so a
    -- clash is a matter of time rather than bad luck. Failing here would
    -- leave an Auth user with no driver record, which is the exact state
    -- this trigger exists to prevent; take the next free code instead.
    final_code := coalesce(want_code, 'GMN' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'));

    while exists (select 1 from public.drivers where driver_code = final_code) loop
      final_code := 'GMN' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
    end loop;

    insert into public.drivers (
      auth_user_id, driver_code, full_name, email, country, role, status
    )
    values (new.id, final_code, full_name, new.email, country, new_role, 'pending');
  end if;

  -- Staff are not applicants: an admin does not queue for approval.
  if new_role = 'driver'
     and not exists (select 1 from public.applications a where a.driver_id = final_code)
  then
    insert into public.applications (driver_id, full_name, email, country, status)
    values (final_code, full_name, new.email, country, 'pending');
  end if;

  return new;
exception
  when others then
    -- A failure here would abort the signup itself, and the person would be
    -- told their account could not be created when in truth only the
    -- profile row failed. Better to let them in and repair the row than to
    -- turn away a real applicant.
    raise warning 'handle_new_user failed for %: %', new.id, sqlerrm;
    return new;
end
$handle_new_user$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();


-- ============================================================
-- NOW GO AND LOOK AT WHO IS ALREADY STAFF
--
-- This migration stops the next one. It does not undo the last
-- one, and it deliberately demotes nobody: some of these people
-- are your actual recruiters, and quietly stripping their access
-- would break the company to fix a hole they did not open.
--
-- So this is a report, not a repair. Run it, and check every row
-- is somebody you promoted on purpose:
-- ============================================================

do $audit$
declare
  r      record;
  total  int := 0;
begin
  raise notice '--- accounts that public.is_staff() currently says yes to ---';

  for r in
    select driver_code, full_name, email, role, created_at
      from public.drivers
     where role in ('recruiter','dispatcher','event_manager',
                    'moderator','management','admin','super_admin')
     order by created_at
  loop
    total := total + 1;
    raise notice '  % | % | % | % | joined %',
      r.driver_code, coalesce(r.full_name,'(no name)'),
      coalesce(r.email,'(no email)'), r.role, r.created_at;
  end loop;

  raise notice '--- % staff account(s) ---', total;
  raise notice 'Anyone here you did not promote yourself, demote with:';
  raise notice '  update public.drivers set role = ''driver'' where driver_code = ''GMN####'';';
end
$audit$;


-- ------------------------------------------------------------
-- Check it
--
--   -- a signup can no longer name its own role: this must come
--   -- back 'driver' for any address that is not the founder's
--   select proname, prosrc like '%meta->>''role''%' as still_trusts_client
--     from pg_proc where proname = 'handle_new_user';
--
--   -- and the roster, after the fact
--   select driver_code, email, role from public.drivers order by id;
-- ------------------------------------------------------------
