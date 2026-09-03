-- ============================================================
-- The drivers row is created by the database, not by the browser
--
-- Run this in Supabase → SQL Editor. It is idempotent.
--
-- THE BUG THIS FIXES
--
--   new row violates row-level security policy for table "drivers"
--
-- Registration signed the person up and then, from the browser,
-- inserted their drivers row. The policy on that insert is
--
--     with check (auth.uid() = auth_user_id)
--
-- which is correct — nobody should be able to create a driver
-- record for somebody else. But when email confirmation is on,
-- signUp() returns a user and NO session. There is no auth.uid()
-- yet. So auth.uid() is null, null = anything is never true, and
-- the insert is refused for the one person who should be allowed
-- to make it.
--
-- Turning the policy off would let anyone write any driver row.
-- The row has to be created by something that is already trusted,
-- at the moment the account is made — which is a trigger on
-- auth.users, running as its owner, before any session exists.
--
-- Everything it needs was already being sent: Accounts.register()
-- puts full_name, driver_code, role and country into the signUp
-- metadata, and that is what raw_user_meta_data holds here.
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
begin
  -- Already there? Then this is a re-run, or the browser got in first.
  if exists (select 1 from public.drivers where auth_user_id = new.id) then
    return new;
  end if;

  -- driver_code is unique. The client generates it randomly (HLL + four
  -- digits) and cannot see what is taken, so a clash is a matter of time.
  -- Rather than fail the signup — which would leave an Auth user with no
  -- driver record, the exact state this trigger exists to prevent — take
  -- the next free code.
  final_code := coalesce(want_code, 'HLL' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0'));

  while exists (select 1 from public.drivers where driver_code = final_code) loop
    final_code := 'HLL' || lpad((floor(random() * 9000) + 1000)::int::text, 4, '0');
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
-- Backfill: Auth users who signed up while this was broken and
-- have no drivers row. They exist, they cannot sign in, and
-- nothing else will ever create the row for them.
-- ------------------------------------------------------------

insert into public.drivers (auth_user_id, driver_code, full_name, email, country, role, status)
select
  u.id,
  'HLL' || lpad(((row_number() over (order by u.created_at)) + 7000)::text, 4, '0'),
  coalesce(nullif(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1)),
  u.email,
  coalesce(nullif(u.raw_user_meta_data->>'country', ''), 'Not set'),
  coalesce(nullif(u.raw_user_meta_data->>'role', ''), 'driver'),
  'pending'
from auth.users as u
where not exists (select 1 from public.drivers d where d.auth_user_id = u.id);


-- ------------------------------------------------------------
-- Check it
-- ------------------------------------------------------------

-- every Auth user should now have exactly one driver row
-- select u.email, d.driver_code, d.role, d.status
--   from auth.users u
--   left join public.drivers d on d.auth_user_id = u.id
--  order by u.created_at;
