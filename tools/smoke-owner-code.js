/* ============================================================
   Smoke test — the owner's driver code moved without losing them.

     npm run smoke:ownercode

   HLL-1001 became GMN-001. A driver code is not a label: the roster
   is keyed on it, and so is every truck assignment, convoy
   registration, ticket and session pointing at that driver.

   Changing OWNER_SEED on its own would not have been a rename, it
   would have been a fork. provisionOwner() finds the account by
   EMAIL as well as by code, and its staleness test looks only at
   salt, hash and email — so the account keeps the old code, the
   lookup for a driver row under the new one misses, and a SECOND,
   empty "Jeff Boss" gets pushed into the roster beside the real one
   with all the history on it.

   So this seeds a store exactly as it was before the change — the
   owner under the old code, with history, and other records
   pointing at them — loads the platform, and checks what came out.

   The count of owner rows is the check that matters. Everything
   else here can pass while the roster quietly holds two of them.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

const OLD = 'HLL-1001';
const NEW = 'GMN-001';

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-probe-ownercode'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1200, height: 900, show: false });

  /* Load once for the origin, plant the old store, then load again so the
     migration meets it on the way in — which is when it really runs. */
  await win.loadFile(path.join(ROOT, 'login.html'));
  await win.webContents.executeJavaScript(`(() => {
    localStorage.clear();
    localStorage.setItem('gmn.db.v1', JSON.stringify({
      drivers: [{
        id: ${JSON.stringify(OLD)}, name: 'Jeff Boss', email: 'jeffboss730@gmail.com',
        role: 'super_admin', accountStatus: 'active', clientAccess: true,
        km: 5280, deliveries: 7, earned: 46200, initials: 'JB',
      }],
      trucks: [{ id: 'TRK-1', assignedTo: ${JSON.stringify(OLD)} }],
      tickets: [{ id: 'TK-1', driverId: ${JSON.stringify(OLD)}, subject: 'brakes' }],
      sessions: [{ id: 'SES-1', driverId: ${JSON.stringify(OLD)}, ended: null }],
      events: [], applications: [], notifications: [], jobs: [], uploads: [],
      meta: { founded: '2026-01-01T00:00:00.000Z' },
    }));
    localStorage.setItem('gmn.accounts.v1', JSON.stringify([{
      driverId: ${JSON.stringify(OLD)}, email: 'jeffboss730@gmail.com',
      salt: 'x', hash: 'y', status: 'active', ownerSeed: true,
    }]));
    return true;
  })()`);

  await win.loadFile(path.join(ROOT, 'login.html'));
  await win.webContents.executeJavaScript(FAKE_SUPABASE);
  await new Promise((r) => setTimeout(r, 1800));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const R = { steps: [], problems: 0 };
    const check = (name, ok, detail) => {
      R.steps.push((ok ? '  ' : '! ') + name.padEnd(48)
        + (detail === undefined ? '' : detail));
      if (!ok) R.problems++;
    };
    try {
      provisionOwner();

      const db = Store.db;
      const raw = localStorage.getItem('gmn.db.v1') || '';
      const owners = (db.drivers || []).filter((d) =>
        d && (d.id === ${JSON.stringify(NEW)} || d.id === ${JSON.stringify(OLD)}));

      /* the one that would have been two */
      check('the owner is in the roster exactly once',
        owners.length === 1, owners.length + ' row(s): '
          + owners.map((d) => d.id + '/' + (d.km || 0) + 'km').join(', '));

      check('under the new code', owners.length === 1 && owners[0].id === ${JSON.stringify(NEW)},
        owners.length ? owners[0].id : 'NONE');
      check('and it is the row with the history on it',
        owners.length === 1 && owners[0].km === 5280 && owners[0].deliveries === 7,
        owners.length ? owners[0].km + ' km, ' + owners[0].deliveries + ' deliveries' : '-');
      check('still the owner, not demoted',
        owners.length === 1 && owners[0].role === 'super_admin',
        owners.length ? owners[0].role : '-');

      /* everything that pointed at the old code came with it */
      check('the truck assignment followed',
        (db.trucks || []).every((t) => t.assignedTo === ${JSON.stringify(NEW)}),
        (db.trucks || []).map((t) => t.assignedTo).join(', '));
      check('the ticket followed',
        (db.tickets || []).every((t) => t.driverId === ${JSON.stringify(NEW)}),
        (db.tickets || []).map((t) => t.driverId).join(', '));
      check('the session followed',
        (db.sessions || []).every((s) => s.driverId === ${JSON.stringify(NEW)}),
        (db.sessions || []).map((s) => s.driverId).join(', '));

      const acct = Accounts.all().filter((a) =>
        String(a.email).toLowerCase() === 'jeffboss730@gmail.com');
      check('the sign-in account points at the new code',
        acct.length === 1 && acct[0].driverId === ${JSON.stringify(NEW)},
        acct.length + ' account(s): ' + acct.map((a) => a.driverId).join(', '));

      check('and the old code is nowhere in the store',
        raw.indexOf(${JSON.stringify(OLD)}) === -1,
        raw.indexOf(${JSON.stringify(OLD)}) === -1 ? 'gone' : 'STILL THERE');
    } catch (e) {
      R.crash = e && (e.stack || e.message);
      R.problems++;
    }
    return R;
  })()`);

  console.log('\nthe owner keeps their history through the rename');
  console.log((out.steps || []).join('\n'));
  if (out.crash) console.log('\nCRASH: ' + out.crash);
  console.log(out.problems ? '\n' + out.problems + ' problem(s)' : '\nclean');
  app.exit(out.problems ? 1 : 0);
});
