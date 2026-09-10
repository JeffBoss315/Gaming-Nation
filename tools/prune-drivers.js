/* ============================================================
   Clear the roster of drivers who were never approved.

     node tools/prune-drivers.js            what would go
     node tools/prune-drivers.js --yes      actually remove them

   APPROVAL, as the platform itself defines it: approving an
   application sets clientAccess = true on the driver (script.js,
   Applications approve). So clientAccess === true is approved and
   anything else is a row that signed up and was never let in.

   This DELETES rows, so it reads by default and writes only when
   told to. A backup of the file is written beside it first, named
   with the time, whatever happens.

   IT ONLY TOUCHES THE SERVICE'S COPY - gmn-company.json. The
   website keeps its own in Supabase and in the browser it is
   open in; neither is reachable from a script with no session,
   and pretending otherwise would leave somebody believing a
   roster was clean when the page still shows all of it.
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const FILE = process.env.GMN_COMPANY_FILE || path.join(ROOT, 'gmn-company.json');
const APPLY = process.argv.indexOf('--yes') > -1;

const raw = fs.readFileSync(FILE, 'utf8');
const doc = JSON.parse(raw.replace(/^﻿/, ''));
const data = doc.data || (doc.data = {});
const drivers = Array.isArray(data.drivers) ? data.drivers : [];

const approved = (d) => d && d.clientAccess === true;

const keep = drivers.filter(approved);
const drop = drivers.filter((d) => !approved(d));

/* how the kept ones break down, because "17 kept" is not the same as
   "17 people" when a test harness has been signing up all week */
const group = (list) => {
  const by = new Map();
  list.forEach((d) => {
    const name = String((d && d.name) || 'unnamed');
    by.set(name, (by.get(name) || 0) + 1);
  });
  return [...by.entries()].sort((a, b) => b[1] - a[1]);
};

console.log('\nroster in ' + path.basename(FILE));
console.log('  ' + drivers.length + ' driver(s): ' + keep.length + ' approved, '
  + drop.length + ' never approved');

console.log('\nwould be KEPT (clientAccess is true)');
group(keep).forEach(([name, n]) => console.log('  ' + String(n).padStart(3) + '  ' + name));

console.log('\nwould be REMOVED (never approved)');
group(drop).forEach(([name, n]) => console.log('  ' + String(n).padStart(3) + '  ' + name));

if (!APPLY) {
  console.log('\nNothing was changed. Run it again with --yes to remove them.');
  process.exit(0);
}

const stamp = new Date().toISOString().replace(/[:.]/g, '-');
const backup = FILE.replace(/\.json$/, '') + '.before-prune-' + stamp + '.json';
fs.writeFileSync(backup, raw);

data.drivers = keep;
doc.version = (Number(doc.version) || 0) + 1;
doc.at = Date.now();

/* written beside and moved into place, so an interrupted write cannot
   leave the company record half-rewritten */
const tmp = FILE + '.tmp';
fs.writeFileSync(tmp, JSON.stringify(doc));
fs.renameSync(tmp, FILE);

console.log('\nremoved ' + drop.length + ' driver(s); ' + keep.length + ' left');
console.log('backup: ' + path.basename(backup));
console.log('The service reads this file at startup — restart it to pick this up.');
