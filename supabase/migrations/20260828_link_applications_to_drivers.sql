-- ============================================================
-- Applications: the link to the driver, plus the columns and
-- policies the client needs.
--
-- STATE AS OF THE LAST CHECK AGAINST THE LIVE PROJECT:
--   applications.driver_id   EXISTS  — text, no foreign key
--   drivers.country          MISSING — the drivers insert omits it
--   RLS policies             unverified from here
--
-- So the driver_id section below is already done. What still
-- needs running is everything from "drivers.country" down.
-- ============================================================


-- ------------------------------------------------------------
-- 1. applications.driver_id  — ALREADY APPLIED
--
-- It was created as text with no foreign key, so it holds the
-- Gaming Nation driver code (HLL4821) rather than the bigint
-- drivers.id. Accounts.register() writes it that way to match.
--
-- That is a workable choice — driver_code is what the whole
-- platform is keyed on — but nothing in the database enforces
-- it. An application can carry a code belonging to no driver,
-- and deleting a driver leaves its applications pointing at a
-- code that is gone.
--
-- To make it a real relationship instead, the column has to
-- match the type of what it points at. drivers.id is bigint:
--
--   alter table public.applications
--     drop column driver_id;
--
--   alter table public.applications
--     add column driver_id bigint
--     references public.drivers(id)
--     on delete set null;
--
-- and then Accounts.register() sends driver.id instead of
-- driverId — one line, at the insert in script.js.
--
-- Or keep text and constrain it to real codes:
--
--   alter table public.drivers
--     add constraint drivers_driver_code_key unique (driver_code);
--
--   alter table public.applications
--     add constraint applications_driver_code_fkey
--     foreign key (driver_id)
--     references public.drivers(driver_code)
--     on delete set null;
--
-- Either is fine. Neither is what is there now.
-- ------------------------------------------------------------

create index if not exists applications_driver_id_idx
  on public.applications (driver_id);


-- ------------------------------------------------------------
-- 2. drivers.country  — NOT YET APPLIED
--
-- Accounts.register() currently leaves country out of the
-- drivers insert because this column does not exist; sending it
-- fails the whole row with 42703 and takes registration down
-- before the driver has anywhere to sign in to. Run this and
-- the country can go back on the insert.
-- ------------------------------------------------------------

alter table public.drivers
  add column if not exists country text;


-- ============================================================
-- 3. Row level security  — NOT YET VERIFIED
--
-- Every table reads back empty to an anonymous client, which is
-- either an empty table or RLS denying the read. If there is no
-- staff SELECT policy on applications, the recruitment screen
-- stays empty however correct the query is.
-- ============================================================

alter table public.drivers enable row level security;
alter table public.applications enable row level security;


-- ---- drivers: a person may create and read their own row ----

drop policy if exists "Drivers can insert their own profile" on public.drivers;
create policy "Drivers can insert their own profile"
on public.drivers
for insert
to authenticated
with check (auth.uid() = auth_user_id);

drop policy if exists "Drivers can read their own profile" on public.drivers;
create policy "Drivers can read their own profile"
on public.drivers
for select
to authenticated
using (auth.uid() = auth_user_id);


-- Staff read the roster. Without this a recruiter sees nobody but
-- themselves and the fleet screens come up empty.
drop policy if exists "Staff can read every driver" on public.drivers;
create policy "Staff can read every driver"
on public.drivers
for select
to authenticated
using (
  exists (
    select 1
    from public.drivers as me
    where me.auth_user_id = auth.uid()
      and me.role in ('recruiter', 'management', 'admin', 'super_admin')
  )
);


-- ---- applications ----

-- A person may file their own application: the driver code on it has
-- to be their own. Written against driver_id as text, which is what
-- the column is.
drop policy if exists "Drivers can file their own application" on public.applications;
create policy "Drivers can file their own application"
on public.applications
for insert
to authenticated
with check (
  driver_id in (
    select driver_code from public.drivers where auth_user_id = auth.uid()
  )
);

drop policy if exists "Drivers can read their own applications" on public.applications;
create policy "Drivers can read their own applications"
on public.applications
for select
to authenticated
using (
  driver_id in (
    select driver_code from public.drivers where auth_user_id = auth.uid()
  )
);


-- Recruiters read every application — this is the recruitment screen.
drop policy if exists "Staff can read every application" on public.applications;
create policy "Staff can read every application"
on public.applications
for select
to authenticated
using (
  exists (
    select 1
    from public.drivers as me
    where me.auth_user_id = auth.uid()
      and me.role in ('recruiter', 'management', 'admin', 'super_admin')
  )
);


-- Deciding an application is a staff act. Deliberately NOT open to
-- every authenticated user: an applicant could otherwise approve
-- themselves and release the client download to themselves.
drop policy if exists "Staff can decide applications" on public.applications;
create policy "Staff can decide applications"
on public.applications
for update
to authenticated
using (
  exists (
    select 1
    from public.drivers as me
    where me.auth_user_id = auth.uid()
      and me.role in ('recruiter', 'management', 'admin', 'super_admin')
  )
)
with check (
  exists (
    select 1
    from public.drivers as me
    where me.auth_user_id = auth.uid()
      and me.role in ('recruiter', 'management', 'admin', 'super_admin')
  )
);


-- ============================================================
-- 4. Backfill: applications filed before driver_id existed.
-- Matched on the only thing both rows carry — the email address.
-- Writes the driver CODE, because that is what the column holds.
-- ============================================================

update public.applications as a
set driver_id = d.driver_code
from public.drivers as d
where a.driver_id is null
  and lower(a.email) = lower(d.email);


-- ============================================================
-- 5. public.company  — CONFIRMED MISSING
--
-- Proven, not guessed. The runtime sweep (tools/smoke-errors.js)
-- reported, on both index.html and admin.html:
--
--   [HLL] Company sync failed: new row violates row-level
--   security policy for table "company" [42501]
--
-- and every pull answered "No company record found in Supabase".
-- So RLS is on for this table with no policy behind it: the read
-- returns nothing and the upsert is refused.
--
-- The company row is the whole shared record — one row, id = 1.
-- Everybody signed in reads it; everybody signed in writes it,
-- because any driver's own change (a run finished, a ticket
-- raised) has to reach it.
-- ============================================================

alter table public.company enable row level security;

drop policy if exists "Signed-in users can read the company" on public.company;
create policy "Signed-in users can read the company"
on public.company
for select
to authenticated
using (true);

drop policy if exists "Signed-in users can create the company" on public.company;
create policy "Signed-in users can create the company"
on public.company
for insert
to authenticated
with check (true);

drop policy if exists "Signed-in users can update the company" on public.company;
create policy "Signed-in users can update the company"
on public.company
for update
to authenticated
using (true)
with check (true);


-- The row Sync.pull() looks for. Without it every pull warns
-- "No company record found in Supabase" and the first push has
-- to create it.
insert into public.company (id, version, data)
values (1, 0, '{}'::jsonb)
on conflict (id) do nothing;
