-- ============================================================
-- GAMING NATION — is_staff() and the app disagreed about staff
--
-- Run this in Supabase -> SQL Editor. Idempotent, changes no
-- rows, and can be re-run safely.
--
-- THE DISAGREEMENT
--
-- script.js decides who may work the recruitment screen with
--
--   PERMS['recruitment.manage'] = 4
--
-- and ROLES gives these a level of 4 or more:
--
--   recruiter 4, dispatcher 4, event_manager 5, moderator 6,
--   management 8, admin 9, super_admin 10
--
-- The database decided separately, in is_staff():
--
--   role in ('recruiter', 'management', 'admin', 'super_admin')
--
-- So a dispatcher, an event manager or a moderator is shown the
-- recruitment screen, is shown the Approve and Reject buttons,
-- and is handed NO ROWS by row level security — because
-- "Staff can read every application" is built on is_staff().
--
-- The screen is empty and nothing says why. It does not error:
-- an RLS SELECT that matches nothing is a successful query
-- returning zero rows, which is indistinguishable from nobody
-- having applied. That is exactly how it was reported.
--
-- WHICH SIDE MOVES
--
-- The app is the specification: it already shows these people
-- the screen and the buttons, so the database contradicting it
-- is the bug. This widens is_staff() to match.
--
-- Be deliberate about this — it IS a widening. After running it,
-- a dispatcher, an event manager and a moderator can read every
-- application and decide it. If that is not what you want, the
-- other fix is to raise 'recruitment.manage' in script.js above
-- their level, so the screen stops being offered to them; do one
-- or the other, because the two disagreeing is what produced an
-- empty screen with no explanation.
--
-- Not touched: 'driver'. A driver reads their own application
-- through a separate policy and nothing here changes that.
-- ============================================================

create or replace function public.is_staff()
returns boolean
language sql
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.drivers
    where auth_user_id = auth.uid()
      and role in (
        'recruiter',
        'dispatcher',
        'event_manager',
        'moderator',
        'management',
        'admin',
        'super_admin'
      )
  );
$$;

grant execute on function public.is_staff() to authenticated;


-- ------------------------------------------------------------
-- Check it
--
--   -- who counts as staff now
--   select role, count(*) from public.drivers group by role order by 2 desc;
--
--   -- and, signed in as one of them, this should not be empty
--   select count(*) from public.applications;
-- ------------------------------------------------------------
