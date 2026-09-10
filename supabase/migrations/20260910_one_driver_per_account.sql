-- GAMING NATION — one driver record per account
--
-- Reported as "every time a driver logs in, two or more names appear".
--
-- WHAT HAPPENED
--
-- Signing in looks for the driver row belonging to the Auth user. When it
-- finds none it creates one, with a fresh random driver_code. That is right
-- for somebody whose row could not be made at registration — and it is a
-- duplicate factory for everybody else, because "no row came back" is also
-- what a refused read looks like, and because nothing stopped a second row
-- for an Auth user that already had one.
--
-- setup.sql has always declared that constraint:
--
--   alter table public.drivers add constraint drivers_auth_user_id_key
--     unique (auth_user_id);
--
-- so on a database where setup.sql was fully applied this could not happen.
-- It is happening, which means it was not. This adds the constraint on its
-- own, and clears up what got in while it was missing.
--
-- READ THIS BEFORE RUNNING IT
--
-- It DELETES driver rows. Run the two SELECTs at the bottom first: they show
-- exactly which rows would go and which would be kept, and they change
-- nothing. If the kept row is not the one you would have chosen, stop and
-- say so rather than running the rest.
--
-- The row kept for each account is the OLDEST, because that is the one the
-- rest of the platform has had longest to point at — applications, jobs and
-- anybody's saved driver_code. Applications filed against a code that is
-- about to go are repointed at the survivor first, so nothing is orphaned.

begin;

-- ---------------------------------------------------------------
-- 1. the survivor for each account: the oldest row it has
-- ---------------------------------------------------------------
create temporary table gmn_keep on commit drop as
select distinct on (auth_user_id)
       auth_user_id,
       id            as keep_id,
       driver_code   as keep_code
  from public.drivers
 where auth_user_id is not null
 order by auth_user_id, created_at asc, id asc;

-- everything else belonging to those accounts
create temporary table gmn_drop on commit drop as
select d.id, d.driver_code, d.auth_user_id, k.keep_code
  from public.drivers d
  join gmn_keep k on k.auth_user_id = d.auth_user_id
 where d.id <> k.keep_id;

-- ---------------------------------------------------------------
-- 2. move anything pointing at a doomed code onto the survivor
--    applications.driver_id holds the CODE, not the row id
-- ---------------------------------------------------------------
update public.applications a
   set driver_id = g.keep_code
  from gmn_drop g
 where a.driver_id = g.driver_code
   and g.keep_code is not null;

-- ---------------------------------------------------------------
-- 3. remove the duplicates
-- ---------------------------------------------------------------
delete from public.drivers d
 using gmn_drop g
 where d.id = g.id;

-- ---------------------------------------------------------------
-- 4. and make it impossible again
--
--    Guarded, so this is safe to run on a database that already has it —
--    including one where setup.sql was applied properly all along.
-- ---------------------------------------------------------------
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'drivers_auth_user_id_key'
  ) then
    alter table public.drivers
      add constraint drivers_auth_user_id_key unique (auth_user_id);
  end if;
end $$;

commit;

-- ---------------------------------------------------------------
-- RUN THESE TWO FIRST. They only read.
-- ---------------------------------------------------------------
--
--   -- accounts holding more than one driver row, and how many
--   select auth_user_id, count(*) as rows,
--          string_agg(driver_code, ', ' order by created_at) as codes
--     from public.drivers
--    where auth_user_id is not null
--    group by auth_user_id
--   having count(*) > 1;
--
--   -- for each of those, what would be kept and what would go
--   select d.auth_user_id, d.driver_code, d.full_name, d.created_at,
--          case when d.id = k.id then 'KEEP' else 'delete' end as verdict
--     from public.drivers d
--     join (select distinct on (auth_user_id) auth_user_id, id
--             from public.drivers
--            where auth_user_id is not null
--            order by auth_user_id, created_at asc, id asc) k
--       on k.auth_user_id = d.auth_user_id
--    where d.auth_user_id in (
--            select auth_user_id from public.drivers
--             where auth_user_id is not null
--             group by auth_user_id having count(*) > 1)
--    order by d.auth_user_id, d.created_at;
