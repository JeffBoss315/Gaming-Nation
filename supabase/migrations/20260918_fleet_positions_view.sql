-- ============================================================
-- THE CREW MAP, WITHOUT A SERVICE TO RUN
-- ------------------------------------------------------------
-- The client could only show the rest of the crew by asking a
-- company service - fleet-server.js, a program somebody has to keep
-- running on a machine somewhere. Supabase is already running, and
-- public.driver_locations already holds every position: it is what
-- the management console's live map reads.
--
-- What stopped the client using it is row level security, and
-- rightly. From 20260904_driver_locations_and_realtime.sql:
--
--   a driver may write their own position and read their own
--   staff may read every position
--
-- So an ordinary driver asking that table for the fleet gets their
-- own truck and nothing else. The same is true of public.drivers,
-- which is where the names are.
--
-- Loosening either table is the wrong fix. drivers holds email
-- addresses, account status and roles; nobody needs those to see a
-- lorry on a map. This view hands out exactly what a crew map
-- needs and nothing else, and being a view it answers with the
-- privileges of its owner rather than the caller's - which is the
-- point: the tables underneath stay shut.
--
-- Safe to run more than once.
-- ============================================================

-- ------------------------------------------------------------
-- Newest position per driver, with the name to put on it.
--
-- `distinct on (driver_id)` with that order is Postgres's way of
-- saying "the newest row for each driver" in one pass, and it uses
-- driver_locations_driver_idx exactly as that index intended.
--
-- Ten minutes: long enough that a driver stopped at a service
-- station is still on the map, short enough that nobody appears to
-- be driving a run they finished this morning. The client applies
-- its own, shorter, silence rule on top.
-- ------------------------------------------------------------
create or replace view public.fleet_positions as
select distinct on (l.driver_id)
  l.driver_id,
  d.driver_code,
  d.full_name,
  d.role,
  l.latitude,
  l.longitude,
  l.speed,
  l.heading,
  l.updated_at
from public.driver_locations l
join public.drivers d on d.id = l.driver_id
where l.updated_at > now() - interval '10 minutes'
  and coalesce(d.account_status, 'active') <> 'suspended'
order by l.driver_id, l.updated_at desc;

-- Anyone signed in may see where the crew is. That is the product:
-- a driver on the live map is looking for the rest of the fleet.
-- Nothing here identifies a person beyond the name and the driver
-- code they already wear in chat and on the leaderboard.
grant select on public.fleet_positions to authenticated;

-- and not to the anonymous key, which every browser has
revoke all on public.fleet_positions from anon;

comment on view public.fleet_positions is
  'Newest position per driver in the last ten minutes, for the crew map. '
  'Exposes only code, name, role and position - the tables underneath stay '
  'closed by row level security.';
