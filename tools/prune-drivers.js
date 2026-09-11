/* ============================================================
   Clear the roster down to the drivers who should be on it.

     node tools/prune-drivers.js                  what would go
     node tools/prune-drivers.js --yes            remove the unapproved
     node tools/prune-drivers.js --keep GMN-001   keep only these
     node tools/prune-drivers.js --keep GMN-001 --yes

   TWO RULES, and the caller picks one.

   By default, approval as the platform defines it: approving an
   application sets clientAccess = true on the driver, so anything
   else is a row that signed up and was never let in.

   --keep names the survivors outright. That is for clearing up
   after something that created rows AND approved them - a test
   harness signing itself in, for instance - where "approved" is
   true of rows that were never people.

   IT IS NOT ONLY THE ROSTER. An account is a way in: leave one
   behind and that person can sign in, find no driver row, and be
   given a fresh one. Applications, jobs, assignments, sessions,
   notifications and activity all point at driver codes too, and a
   row pointing at a driver who is gone is a row nothing can
   render. Everything that names a removed driver goes with them.

   It DELETES, so it reads by default and writes only when told
   to, and it copies the file first either way.

   IT ONLY TOUCHES THE SERVICE'S COPY - gmn-company.json. The
   website keeps its own in Supabase and in whatever browser it is
   open in; neither is reachable from a script with no session,
   and pretending otherwise would leave somebody believing a
   roster was clean while the page still showed all of it.

   STOP THE SERVICE FIRST. It holds this record in memory and
   flushes on exit, so a service running while this writes will
   put every one of them back.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.GMN_COMPANY_FILE || path.join(ROOT, 'gmn-company.json');
const APPLY = process.argv.indexOf('--yes') > -1;

const keepAt = process.argv.indexOf('--keep');
const KEEP_LIST = keepAt > -1
  ? process.argv.slice(keepAt + 1).filter((a) => a.indexOf('--') !== 0)
  : null;

const raw = fs.readFileSync(FILE, 'utf8');
const doc = JSON.parse(raw.replace(/^﻿/, ''));
const data = doc.data || (doc.data = {});
const drivers = Array.isArray(data.drivers) ? data.drivers : [];

const approved = (d) => d && d.clientAccess === true;
const keeping = (d) => (KEEP_LIST
  ? KEEP_LIST.indexOf(String(d && d.id)) > -1
  : approved(d));

const keep = drivers.filter(keeping);
const drop = drivers.filter((d) => !keeping(d));
/* Anything naming a driver who will not be on the roster afterwards -
   which is not the same as "being removed now". An earlier pass took 60
   drivers out and left their accounts behind: 86 accounts for 17 drivers,
   most of them a way in to a record that no longer exists. A row is
   orphaned whether it was orphaned a minute ago or last week. */
const staying = new Set(keep.map((d) => String(d.id)));
const orphaned = (v) => v != null && v !== '' && !staying.has(String(v));

/* Everything else that names a driver. Each entry is the collection and
   the fields that can hold a code - applications have carried the code in
   driver_id and in submittedBy at different times, so both are checked. */
const LINKED = [
  ['accounts', ['driverId']],
  ['applications', ['driverId', 'submittedBy']],
  ['assignments', ['driverId']],
  ['jobs', ['driverId']],
  ['sessions', ['driverId']],
  ['notifications', ['driverId']],
  ['activity', ['driverId']],
  ['tickets', ['driverId']],
];

const orphans = LINKED.map(([name, fields]) => {
  const list = Array.isArray(data[name]) ? data[name] : [];
  /* A row naming nobody in particular - a broadcast notification, say -
     is left alone. */
  const hit = list.filter((row) => row && fields.some((f) => orphaned(row[f])));
  return { name, total: list.length, going: hit.length, fields };
}).filter((x) => x.total);

const group = (list) => {
  const by = new Map();
  list.forEach((d) => {
    const name = String((d && d.name) || 'unnamed');
    by.set(name, (by.get(name) || 0) + 1);
  });
  return [...by.entries()].sort((a, b) => b[1] - a[1]);
};

console.log('\nroster in ' + path.basename(FILE));
console.log('  rule: ' + (KEEP_LIST ? 'keep only ' + KEEP_LIST.join(', ')
  : 'keep whoever was approved (clientAccess)'));
console.log('  ' + drivers.length + ' driver(s): ' + keep.length + ' kept, '
  + drop.length + ' removed');

console.log('\nKEPT');
group(keep).forEach(([n, c]) => console.log('  ' + String(c).padStart(3) + '  ' + n));
if (!keep.length) console.log('  (nobody — that is almost certainly wrong)');

console.log('\nREMOVED');
group(drop).forEach(([n, c]) => console.log('  ' + String(c).padStart(3) + '  ' + n));
if (!drop.length) console.log('  (nobody)');

if (orphans.length) {
  console.log('\nAND WHAT NAMES A DRIVER WHO WILL NOT BE THERE');
  orphans.forEach((o) => console.log('  ' + o.name.padEnd(15)
    + o.going + ' of ' + o.total + ' row(s)'));
}

if (!keep.length && APPLY) {
  console.log('\nRefusing: that would empty the roster.');
  process.exit(1);
}
if (!APPLY) {
  console.log('\nNothing was changed. Run it again with --yes.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = FILE.replace(/\.json$/, '') + '.before-prune-' + stamp + '.json';
fs.writeFileSync(backup, raw);

data.drivers = keep;
orphans.forEach((o) => {
  data[o.name] = data[o.name].filter((row) =>
    !(row && o.fields.some((f) => orphaned(row[f]))));
});

doc.version = (Number(doc.version) || 0) + 1;
doc.at = Date.now();

const tmp = FILE + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(doc));
fs.renameSync(tmp, FILE);

console.log('\nremoved ' + drop.length + ' driver(s) and everything that named them');
console.log('backup: ' + path.basename(backup));
console.log('The service reads this at startup — restart it to pick this up.');
