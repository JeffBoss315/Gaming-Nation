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

-- Done one person at a time, on purpose.
--
-- The first version of this handed out HLL7001, HLL7002, ... by row
-- number. driver_code carries a unique constraint (drivers_driver_code_key),
-- so if any existing driver already held one of those codes the insert
-- failed — and because the SQL editor runs this file as a single
-- transaction, that one collision rolled back EVERYTHING, including the
-- trigger above. The migration would report an error and change nothing,
-- which is the worst possible outcome for a fix that has to be run by hand.
--
-- So: take the code the person was actually given at sign-up when it is
-- still free, otherwise the first genuinely unused one, and let a row that
-- cannot be created be skipped with a warning instead of taking the rest
-- of the migration down with it.

do $backfill$
declare
  u          record;
  final_code text;
  made       int := 0;
  skipped    int := 0;
begin
  for u in
    select id, email, created_at, raw_user_meta_data
      from auth.users
     order by created_at
  loop
    if exists (select 1 from public.drivers where auth_user_id = u.id) then
      continue;
    end if;

    -- the code they were issued in the browser, if nobody else has it
    final_code := nullif(u.raw_user_meta_data->>'driver_code', '');

    if final_code is null
       or exists (select 1 from public.drivers where driver_code = final_code) then
      final_code := null;
      -- checked against the table as it stands on THIS iteration, so two
      -- users in the same run cannot be handed the same code
      for n in 1000..9999 loop
        if not exists (
          select 1 from public.drivers
           where driver_code = 'HLL' || lpad(n::text, 4, '0')
        ) then
          final_code := 'HLL' || lpad(n::text, 4, '0');
          exit;
        end if;
      end loop;
    end if;

    if final_code is null then
      raise warning 'no free driver_code left for %', u.id;
      skipped := skipped + 1;
      continue;
    end if;

    begin
      insert into public.drivers (
        auth_user_id, driver_code, full_name, email, country, role, status
      )
      values (
        u.id,
        final_code,
        coalesce(
          nullif(u.raw_user_meta_data->>'full_name', ''),
          nullif(split_part(coalesce(u.email, ''), '@', 1), ''),
          'Driver'),
        u.email,
        coalesce(nullif(u.raw_user_meta_data->>'country', ''), 'Not set'),
        coalesce(nullif(u.raw_user_meta_data->>'role', ''), 'driver'),
        'pending'
      );
      made := made + 1;
    exception
      when others then
        -- one unrepairable account must not cost everybody else theirs
        raise warning 'could not create driver row for % (%): %', u.id, u.email, sqlerrm;
        skipped := skipped + 1;
    end;
  end loop;

  raise notice 'backfill: % driver row(s) created, % skipped', made, skipped;
end
$backfill$;


-- ------------------------------------------------------------
-- Check it
-- ------------------------------------------------------------

-- every Auth user should now have exactly one driver row
-- select u.email, d.driver_code, d.role, d.status
--   from auth.users u
--   left join public.drivers d on d.auth_user_id = u.id
--  order by u.created_at;


-- ============================================================
-- A way for the sign-up form to know this has been run
--
-- Without it the page finds out the hard way: it creates the Auth
-- user, tries to write the driver row, is refused, and leaves the
-- person with a sign-in they cannot use and an email address that
-- now answers "already registered" on the next attempt.
--
-- The browser cannot read pg_trigger, so it cannot check for
-- itself. This answers the one question it needs, and nothing
-- else: is the trigger there.
-- ============================================================

create or replace function public.hll_signup_ready()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from pg_trigger
    where tgname = 'on_auth_user_created'
      and not tgisinternal
  );
$$;

-- The form asks before anybody has signed in, so anon needs it too.
grant execute on function public.hll_signup_ready() to anon, authenticated;
