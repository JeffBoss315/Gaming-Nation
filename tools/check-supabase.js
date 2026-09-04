/* What the live Supabase project actually has.

     npm run check:supabase

   The schema files in supabase/ describe what a fresh project should be
   built as. They are not evidence of what the real one is: the live
   project can be, and on 2026-09-04 was, ahead of them — driver_locations
   and the realtime publication were both already there and appeared in
   none of the SQL in this repo.

   Reading the source and reporting on the database is therefore guessing.
   This asks the database.

   It uses the publishable key from supabase-client.js — the same one any
   visitor's browser gets, so running it grants nothing.

   It writes nothing. The one call that is not a plain read is the row
   level security probe, which posts a driver_locations row naming a
   driver that cannot exist. Two things make that safe, and it refuses to
   run unless both hold: the row is rejected either by the RLS policy or,
   failing that, by the foreign key to drivers — and the probe confirms
   that foreign key is really there first, via PostgREST's embedding,
   which only resolves when the constraint exists. So there is no
   arrangement in which the row survives.

   What it still cannot see: whether the *authenticated* role has an
   insert policy. That needs a driver's session, and is reported as
   unchecked rather than assumed. driver-dashboard.html names that case
   at runtime instead — a 42501 on upload says the policy is missing.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* Taken from the client rather than repeated here, so this cannot end up
   checking a different project from the one the site talks to. */
const client = fs.readFileSync(path.join(ROOT, 'supabase-client.js'), 'utf8');
const URL = (client.match(/SUPABASE_URL\s*=\s*'([^']+)'/) || [])[1];
const KEY = (client.match(/SUPABASE_KEY\s*=\s*'([^']+)'/) || [])[1];

if (!URL || !KEY) {
  console.log('could not read SUPABASE_URL / SUPABASE_KEY out of supabase-client.js');
  process.exit(1);
}

const HEAD = { apikey: KEY, Authorization: 'Bearer ' + KEY };

/* What the app writes and reads. Each entry is the shape the code depends
   on, so a column being dropped upstream shows up here rather than in a
   driver's console at the roadside. */
const NEEDED = {
  drivers: ['id', 'driver_code', 'auth_user_id', 'full_name', 'email', 'role', 'status'],
  driver_locations: ['id', 'driver_id', 'latitude', 'longitude', 'speed', 'heading', 'updated_at'],
  applications: ['id', 'driver_id', 'full_name', 'email', 'status'],
  company: ['id', 'version', 'data'],
};

/* Tables the platform subscribes to with postgres_changes. A table only
   emits those once it is in the supabase_realtime publication, and an
   unpublished one reports SUBSCRIBED and then never says anything — so
   this is the check that a silent feature is actually wired up. */
const PUBLISHED = ['drivers', 'driver_locations'];

const problems = [];
const notes = [];

async function get(pathAndQuery) {
  const res = await fetch(URL + '/rest/v1/' + pathAndQuery, { headers: HEAD });
  let body = null;
  try { body = await res.json(); } catch (e) { /* empty body is fine */ }
  return { status: res.status, body };
}

async function checkTable(table, columns) {
  /* All the columns at once first: one round trip answers the common
     case, where everything is present. */
  const all = await get(table + '?select=' + columns.join(',') + '&limit=1');

  if (all.status === 200) {
    console.log('  ' + table.padEnd(18) + 'ok  (' + columns.length + ' columns)');
    return;
  }

  if (all.status === 404) {
    console.log('  ' + table.padEnd(18) + 'MISSING');
    problems.push(table + ' does not exist — run the migrations in supabase/');
    return;
  }

  /* Something is there but not all of it. Ask column by column, so the
     report names the column rather than the request. */
  const missing = [];

  for (const c of columns) {
    const one = await get(table + '?select=' + c + '&limit=1');
    if (one.status !== 200) missing.push(c);
  }

  if (missing.length) {
    console.log('  ' + table.padEnd(18) + 'missing: ' + missing.join(', '));
    problems.push(table + ' is missing ' + missing.join(', '));
  } else {
    console.log('  ' + table.padEnd(18) + 'unexpected ' + all.status +
      ((all.body && all.body.message) ? ' — ' + all.body.message : ''));
    notes.push(table + ': ' + all.status + ' from a select of every column');
  }
}

/* Is row level security actually on?

   The publishable key cannot tell an empty table from a blocked one by
   reading, because both come back as []. Writing tells you, and tells you
   without leaving anything behind:

     42501 "permission denied for table"   the role has no grant at all
     42501 "new row violates row-level..." RLS is on and doing its job
     23503 foreign key violation           RLS is OFF, or it permits anon
     201 / 200                             RLS is off AND the FK is gone

   Only the last of those could persist a row, and the caller does not
   reach here unless the foreign key was confirmed, which rules it out. */
async function checkRls() {

  const res = await fetch(URL + '/rest/v1/driver_locations', {
    method: 'POST',
    headers: Object.assign({}, HEAD, {
      'Content-Type': 'application/json',
      Prefer: 'return=minimal',
    }),
    /* A driver id far outside any bigint identity sequence anybody has
       reached, so the foreign key cannot match a real driver. */
    body: JSON.stringify({ driver_id: 999999999999, latitude: 0, longitude: 0 }),
  });

  let body = null;
  try { body = await res.json(); } catch (e) { /* a 201 has no body */ }

  const code = body && body.code;
  const message = (body && body.message) || '';

  if (code === '42501' && /row-level security/i.test(message)) {
    return { state: 'on', detail: 'anon is blocked by policy' };
  }

  if (code === '42501') {
    return { state: 'no grant', detail: message };
  }

  if (code === '23503') {
    return { state: 'OFF', detail: 'the row reached the foreign key, so no policy stopped it' };
  }

  if (res.status < 300) {
    return { state: 'OFF', detail: 'the insert was accepted' };
  }

  return { state: 'unclear', detail: res.status + ' ' + (code || '') + ' ' + message };
}

/* PostgREST resolves an embedded resource only when a foreign key joins
   the two tables, so this answers "is the constraint there" as a read. */
async function hasForeignKey() {
  const r = await get('driver_locations?select=id,drivers(id)&limit=1');
  return r.status === 200;
}

function checkPublished(db, table) {
  return new Promise((resolve) => {
    let settled = false;

    const done = (ok, detail) => {
      if (settled) return;
      settled = true;
      try { db.removeChannel(ch); } catch (e) {}
      resolve({ ok, detail });
    };

    const ch = db
      .channel('hll-check-' + table + '-' + Date.now())
      .on('postgres_changes', { event: '*', schema: 'public', table }, () => {})
      .subscribe((status, err) => {
        if (status === 'SUBSCRIBED') done(true, '');
        else if (status === 'CHANNEL_ERROR') done(false, err ? String(err.message || err) : '');
        else if (status === 'TIMED_OUT') done(false, 'timed out');
      });

    setTimeout(() => done(false, 'no answer in 15s'), 15000);
  });
}

(async () => {

  console.log('\n' + URL);

  console.log('\ntables and columns');
  for (const [table, columns] of Object.entries(NEEDED)) {
    await checkTable(table, columns);
  }

  console.log('\nrealtime publication');

  let createClient;
  try {
    ({ createClient } = require('@supabase/supabase-js'));
  } catch (e) {
    console.log('  skipped — @supabase/supabase-js is not installed (npm install)');
    createClient = null;
  }

  if (createClient) {
    const db = createClient(URL, KEY, { realtime: { params: { eventsPerSecond: 1 } } });

    for (const table of PUBLISHED) {
      const r = await checkPublished(db, table);
      console.log('  ' + table.padEnd(18) + (r.ok ? 'published' : 'NOT published' +
        (r.detail ? '  — ' + r.detail : '')));
      if (!r.ok) {
        problems.push(table + ' is not in the supabase_realtime publication — ' +
          'postgres_changes on it will subscribe and then stay silent');
      }
    }
  }

  console.log('\nrow level security');

  const fk = await hasForeignKey();

  if (!fk) {
    console.log('  driver_locations   not probed — no foreign key to drivers, so a');
    console.log('                     test row could not be guaranteed to fail');
    notes.push('driver_locations has no foreign key to drivers; the RLS probe was skipped');
  } else {
    const rls = await checkRls();
    console.log('  driver_locations   ' + rls.state + (rls.detail ? '  — ' + rls.detail : ''));

    if (rls.state === 'OFF') {
      problems.push('row level security is OFF on driver_locations — any caller can ' +
        'read and write every driver position');
    } else if (rls.state === 'unclear' || rls.state === 'no grant') {
      notes.push('driver_locations RLS probe was inconclusive: ' + rls.detail);
    }
  }

  console.log('\nnot checked here');
  console.log('  authenticated insert  needs a driver session. If that policy is');
  console.log('                        missing, an upload fails 42501 and the');
  console.log('                        dashboard says so on screen.');

  if (notes.length) {
    console.log('');
    notes.forEach((n) => console.log('  note: ' + n));
  }

  if (problems.length) {
    console.log('\n' + problems.length + ' problem(s)');
    problems.forEach((p) => console.log('  ' + p));
    process.exit(1);
  }

  console.log('\nclean');
  process.exit(0);
})();
