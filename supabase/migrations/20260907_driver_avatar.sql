-- ============================================================
-- The profile photo belongs to the driver, not to the browser
--
-- Run this in Supabase → SQL Editor. Idempotent; safe to re-run.
--
-- THE BUG THIS FIXES
--
--   "A driver uploads a photo, signs out, signs back in, and it
--    is gone."
--
-- readAvatarFile() turns the chosen file into a small JPEG data
-- URL and the app hung it on the driver's roster record, which
-- travels inside the company blob (public.company.data). That
-- works right up to the moment the roster record is not there:
--
--   const me = Store.driver(state.user.id) || state.user;
--   me.avatar = data;
--
-- state.user is a COPY built by Accounts.fromRow, not a handle
-- on the roster row. When the signed-in driver has no row in
-- Store.db.drivers — a browser that has not pulled the company
-- yet, or a driver approved on another machine — that `||` puts
-- the photo on the copy and nothing else. Store.save() then
-- writes a company record that never contained it, and the next
-- pull replaces the copy. The photo was never anywhere durable.
--
-- Even when the roster row IS there, the photo only survives for
-- as long as the company blob does, and it is the one piece of a
-- driver's profile that is genuinely theirs rather than the
-- company's.
--
-- So it gets a column, next to the rest of their identity, under
-- the policy that already lets a driver update their own row
-- ("Drivers can update their own profile", supabase/setup.sql).
--
-- WHY text AND NOT storage
--
-- The app already caps the image at AVATAR_PX (256px square) and
-- AVATAR_MAX_BYTES (90 KB) before it is stored, re-encoding as
-- JPEG until it fits, so this is a bounded value and not an open
-- door. Storage would mean a bucket, a policy, a signed URL and a
-- fetch on every render; a column means the face arrives with the
-- driver and every screen that already has the row can draw it.
-- ============================================================

alter table public.drivers add column if not exists avatar text;

comment on column public.drivers.avatar is
  'Profile photo as a small JPEG data URL. Written by the driver '
  'through readAvatarFile(), which caps it at 256px and 90 KB. '
  'Null means draw their initials instead.';


-- ------------------------------------------------------------
-- Check it
--
--   select driver_code, full_name,
--          case when avatar is null then 'initials'
--               else pg_size_pretty(length(avatar)::bigint) end as photo
--     from public.drivers
--    order by id;
-- ------------------------------------------------------------
