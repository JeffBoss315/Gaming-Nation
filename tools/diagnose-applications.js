/* ============================================================
   Why is the recruitment screen empty?

   Paste this whole file into the browser console with the
   management console open and signed in:

     admin.html -> F12 -> Console -> paste -> Enter

   It does not change anything. It asks, in order, every question
   between "somebody registered" and "a row appears on screen",
   and prints the first one whose answer is wrong.

   It exists because every failure along that path is silent. A
   select refused by row level security is a SUCCESSFUL query
   returning zero rows, which is identical, from the browser, to
   nobody having applied. So each step is asked separately and
   the answers are printed even when they are fine.
   ============================================================ */
(async () => {
  const line = (k, v) => console.log('  ' + String(k).padEnd(26) + ': ' + v);
  const head = (t) => console.log('\n' + t + '\n' + '-'.repeat(t.length));
  const verdicts = [];
  const fail = (m) => { verdicts.push('PROBLEM  ' + m); };

  console.log('%cGaming Nation — recruitment diagnostic', 'font-weight:bold;font-size:14px');

  /* 1. is there a client at all */
  head('1. Supabase client');
  if (!window.gmnSupabase) {
    line('window.gmnSupabase', 'MISSING');
    fail('The Supabase library did not load. Everything below is unreachable. '
       + 'Check the CDN <script> in admin.html and any ad-blocker.');
    return console.log('\n' + verdicts.join('\n'));
  }
  line('window.gmnSupabase', 'present');

  /* 2. is this browser signed in TO SUPABASE (not just to the local account list) */
  head('2. Session');
  const { data: sess } = await window.gmnSupabase.auth.getSession();
  const session = sess && sess.session;
  line('supabase session', session ? 'yes' : 'NO');
  if (!session) {
    fail('Signed in to the app but NOT to Supabase. Every table read is anon, '
       + 'and every policy here is "to authenticated", so everything returns '
       + 'zero rows. Sign out and sign in again with your email and password.');
  } else {
    line('auth user id', session.user.id);
    line('auth email', session.user.email);
    line('email confirmed', session.user.email_confirmed_at ? 'yes' : 'NO');
  }

  /* 3. what does the database think this person is */
  head('3. Your driver row');
  if (session) {
    const { data: me, error: meErr } = await window.gmnSupabase
      .from('drivers').select('id, driver_code, full_name, role, status')
      .eq('auth_user_id', session.user.id).maybeSingle();
    if (meErr) { line('lookup', 'ERROR ' + meErr.code + ' ' + meErr.message); fail('Could not read your own driver row.'); }
    else if (!me) { line('lookup', 'NO ROW'); fail('You have no drivers row, so is_staff() cannot be true. Run supabase/setup.sql.'); }
    else { line('driver_code', me.driver_code); line('role', me.role); line('status', me.status); }
  }

  /* 4. does the DATABASE agree you are staff — this is the one that decides */
  head('4. is_staff() — the database\u2019s own answer');
  const { data: staff, error: staffErr } = await window.gmnSupabase.rpc('is_staff');
  if (staffErr) {
    line('is_staff()', 'ERROR ' + staffErr.code + ' ' + staffErr.message);
    fail('is_staff() could not be called. If it does not exist, run supabase/setup.sql.');
  } else {
    line('is_staff()', String(staff));
    if (staff === false) {
      fail('The database does not consider you staff, so "Staff can read every '
         + 'application" gives you nothing and the screen is empty with no error. '
         + 'Check the role printed above against the list in is_staff() in '
         + 'supabase/setup.sql, and re-run that file.');
    }
  }

  /* 5. the rows themselves, read directly, bypassing all app code */
  head('5. Reading public.applications directly');
  const { data: apps, error: appErr, count } = await window.gmnSupabase
    .from('applications').select('id, driver_id, full_name, status', { count: 'exact' });
  if (appErr) {
    line('select', 'ERROR ' + appErr.code + ' ' + appErr.message);
    fail('The applications table refused the read. That is a policy problem, not an empty table.');
  } else {
    line('rows visible to you', (apps ? apps.length : 0) + (typeof count === 'number' ? ' (count ' + count + ')' : ''));
    if (apps && apps.length) {
      console.table(apps.slice(0, 20));
    } else {
      fail('The query succeeded and returned nothing. Either no application rows '
         + 'exist at all, or they exist and this account cannot see them — check '
         + 'is_staff() above. If it is true and this is still zero, the rows were '
         + 'never written: run supabase/setup.sql, which files one for every driver.');
    }
  }

  /* 6. how many drivers are there to compare against */
  head('6. Drivers, for comparison');
  const { data: drv, error: drvErr } = await window.gmnSupabase
    .from('drivers').select('driver_code, full_name, role');
  if (drvErr) line('select', 'ERROR ' + drvErr.code + ' ' + drvErr.message);
  else {
    const applicants = (drv || []).filter((d) => (d.role || 'driver') === 'driver');
    line('drivers visible', (drv || []).length);
    line('of those, plain drivers', applicants.length);
    if (applicants.length && apps && apps.length === 0) {
      fail('There are ' + applicants.length + ' driver(s) who should each have an '
         + 'application and there are no application rows. That is the backfill in '
         + 'supabase/setup.sql not having run.');
    }
  }

  /* 7. what the app itself is holding, versus what the table says */
  head('7. What the app is holding');
  try {
    line('Store.db.applications', (Store.db.applications || []).length);
    line('Applications.status', Applications.status);
    line('Applications.lastError', Applications.lastError ? JSON.stringify(Applications.lastError) : 'none');
    line('Applications.lastAt', Applications.lastAt ? new Date(Applications.lastAt).toLocaleTimeString() : 'never pulled');
    if (Applications.lastAt === 0) {
      fail('Applications.pull() has never completed in this tab. It runs off the '
         + 'company sync, so if that is not running neither is this.');
    }
    if (apps && apps.length && (Store.db.applications || []).length === 0) {
      fail('The table HAS rows and the app is holding none. The pull is the broken '
         + 'link, not the database. Run: await Applications.pull(); render();');
    }
  } catch (e) {
    line('app globals', 'unavailable (' + e.message + ')');
  }

  head('Verdict');
  console.log(verdicts.length ? verdicts.join('\n\n') : 'Every check passed. If the screen is still empty, run:\n  await Applications.pull(); render();');
})();
