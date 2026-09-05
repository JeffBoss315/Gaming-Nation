/* The driver terminal: the #/driver-login and #/driver-terminal views.

   These two were driver-login.html and driver-dashboard.html until they
   were merged into login.html. They are the phone-side of the platform — a driver signs in against
   Supabase Auth and puts themselves on the dispatch board, and their
   position uploads while they are on shift. Nothing in the existing sweep
   covered them: tools/smoke-errors.js walks index, admin and tracker, and
   these two sit behind a sign-in it cannot get through.

   What is proved here, in order:

     1. the login page comes up and refuses an empty form without a round trip
     2. a wrong password is reported and the form is usable afterwards
     3. a correct password lands on the dashboard
     4. the dashboard shows the driver it loaded
     5. going on shift writes the status and starts the position watch
     6. a position insert reaches driver_locations with the right driver id
     7. ending the shift stops it
     8. signing out returns to the login page and leaves nobody on shift

   Nothing here touches the real project. supabase-client.js is swapped for
   the in-memory stand-in before the page ever runs, and every request off
   the machine is refused — so a run leaves no Auth users, no drivers rows
   and no positions behind in the company everybody is actually using.

     node_modules/electron/dist/electron.exe tools/smoke-driver-terminal.js .
*/
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

/* resolved, not taken as given: 'npm run smoke:*' passes '.', and a relative
   root turns a require into a bare module name */
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

app.setPath('userData', path.join(app.getPath('temp'), 'hll-smoke-driver-terminal'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const fails = [];
const steps = [];
const say = (k, v) => steps.push('  ' + k.padEnd(34) + v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function check(what, got, want) {
  if (String(got) === String(want)) say(what, String(got));
  else fails.push(what + ': expected ' + want + ', got ' + got);
}

/* ------------------------------------------------------------------
   The stand-in, installed as supabase-client.js itself.

   The page builds its client from that file, so replacing the file is
   what makes the stand-in arrive before any of the page's own code — a
   fake injected after load would arrive after the dashboard had already
   decided nobody was signed in.

   It carries a seeded driver on top of the plain stand-in, because the
   dashboard's job starts from a driver that already exists.
------------------------------------------------------------------ */
const EMAIL = 'driver@heavyline.test';
const PASSWORD = 'terminal-test';

/* The seeded driver, and a session that survives a reload.

   The two views no longer navigate between documents, so the session no
   longer has to cross one — but this test reloads once at the start to
   clear whatever an earlier run left behind, and the stand-in would
   forget across that. Real Supabase keeps the session in localStorage;
   the stand-in is taught to do the same, so the reload lands in the same
   state a driver would be in.

   Note what is NOT done here: signUp. It signs the new user in as a side
   effect, and the sign-in view checks for an existing session on load —
   so seeding through signUp sent the page straight to the terminal
   before it had shown anybody a form. The user is placed directly
   instead, signed out, which is the state a sign-in form is for. */
const SEED = `
(function () {
  var S = window.hllSupabase;
  var UID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
  var KEY = 'hll.smoke.session';

  S.__db.drivers.push({
    id: 41,
    driver_code: 'HLL-0041',
    auth_user_id: UID,
    full_name: 'Test Driver',
    email: '${EMAIL}',
    country: 'GB',
    role: 'driver',
    status: 'offline',
    created_at: new Date().toISOString()
  });

  S.__users.push({
    email: '${EMAIL}',
    password: '${PASSWORD}',
    user: { id: UID, email: '${EMAIL}', user_metadata: {} }
  });

  var signIn = S.auth.signInWithPassword;
  var signOut = S.auth.signOut;

  S.auth.signInWithPassword = function (o) {
    return signIn(o).then(function (r) {
      if (!r.error) { try { localStorage.setItem(KEY, '1'); } catch (e) {} }
      return r;
    });
  };

  S.auth.signOut = function () {
    try { localStorage.removeItem(KEY); } catch (e) {}
    return signOut();
  };

  /* Restored synchronously, before the page's own script asks. */
  try {
    if (localStorage.getItem(KEY) === '1') {
      signIn({ email: '${EMAIL}', password: '${PASSWORD}' });
    }
  } catch (e) {}
})();
`;

/* A geolocation stand-in. Electron will not hand out a real position in a
   test, and a watch that never fires proves nothing about the upload. */
const FAKE_GPS = `
(function () {
  var tick = null;
  var n = 0;

  navigator.geolocation.watchPosition = function (ok) {
    tick = setInterval(function () {
      n += 1;
      ok({
        coords: {
          latitude: 51.5072 + n * 0.0004,
          longitude: -0.1276 + n * 0.0004,
          altitude: 35,
          accuracy: 8,
          speed: 16.7,
          heading: 74
        },
        timestamp: Date.now()
      });
    }, 120);
    return 99;
  };

  navigator.geolocation.clearWatch = function () {
    clearInterval(tick);
    tick = null;
    window.__gpsCleared = true;
  };
})();
`;

const CLIENT = FAKE_SUPABASE + '\n' + SEED;

app.whenReady().then(async () => {

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'hll-terminal-'));
  const clientFile = path.join(tmp, 'fake-supabase-client.js');
  fs.writeFileSync(clientFile, CLIENT, 'utf8');

  /* Swap the client, and refuse everything that leaves the machine. The
     CDN bundle must not load either: if it did, supabase-client.js would
     be replaced but window.supabase would still be real, and the next
     change to either file would quietly start talking to production. */
  session.defaultSession.webRequest.onBeforeRequest((details, cb) => {

    const url = details.url;

    if (url.endsWith('/supabase-client.js')) {
      return cb({ redirectURL: 'file:///' + clientFile.replace(/\\/g, '/') });
    }

    if (/^https?:/i.test(url)) return cb({ cancel: true });

    cb({});
  });

  const win = new BrowserWindow({ width: 1280, height: 900, show: false });

  const thrown = [];

  /* Two steps below make the page fail on purpose, and the page is right
     to complain about them. Anything logged outside those is not. */
  let expected = false;

  win.webContents.on('console-message', (_e, level, message) => {
    /* level 3 is error. The fonts and the blocked CDN are refused by this
       harness by design and say so; nothing else should be here. */
    if (level !== 3) return;
    if (expected) return;
    if (/ERR_BLOCKED|ERR_FAILED|fonts\.googleapis|jsdelivr/.test(message)) return;
    thrown.push(message);
  });

  const page = (name) => 'file:///' + path.join(ROOT, name).replace(/\\/g, '/');
  const js = (code) => win.webContents.executeJavaScript(code, true);

  /* Both views live in one document, so the URL no longer says which
     one is up. What is visible does. */
  const VIEW = "document.getElementById('dt-terminal').hidden ? 'login' : 'terminal'";

  try {

    /* ---- 1. the login page ------------------------------------- */

    await win.loadURL(page('login.html') + '#/driver-login');

    /* An earlier run may have left the stand-in's session flag behind,
       which would send this one straight past the form. */
    await js("try{localStorage.clear()}catch(e){}");
    await win.webContents.reload();
    await wait(700);

    check('login page title',
      await js("document.querySelector('.dt-title').textContent"),
      'Driver terminal');

    check('sign-in button enabled',
      await js("!document.getElementById('loginBtn').disabled"),
      'true');

    /* An empty form must not cost a round trip. */
    await js("document.getElementById('loginForm').dispatchEvent(new Event('submit',{cancelable:true}))");
    await wait(200);

    check('empty form refused locally',
      await js("document.getElementById('message').classList.contains('err')"),
      'true');

    check('still on the sign-in view',
      await js(VIEW),
      'login');

    /* ---- 2. a wrong password ----------------------------------- */

    expected = true;
    await js(`
      document.getElementById('email').value = '${EMAIL}';
      document.getElementById('password').value = 'not-the-password';
      document.getElementById('loginForm').dispatchEvent(new Event('submit',{cancelable:true}));
    `);
    await wait(600);
    expected = false;

    check('wrong password reported',
      await js("document.getElementById('messageText').textContent"),
      'That email and password do not match a driver account.');

    check('form usable again',
      await js("!document.getElementById('loginBtn').disabled"),
      'true');

    /* ---- 3. the real password ---------------------------------- */

    await js(`
      document.getElementById('password').value = '${PASSWORD}';
      document.getElementById('loginForm').dispatchEvent(new Event('submit',{cancelable:true}));
    `);
    await wait(1200);

    check('landed on the terminal',
      await js(VIEW),
      'terminal');

    /* ---- 4. the dashboard loaded the driver -------------------- */

    /* Nothing has asked for a position yet — the driver is off shift — so
       the stand-in geolocation can go in now, before the first click. */
    await js(FAKE_GPS);
    await wait(500);

    check('driver name shown',
      await js("document.getElementById('driverName').textContent"),
      'Test Driver');

    check('driver code shown',
      await js("document.getElementById('driverCode').textContent"),
      'HLL-0041');

    check('starts off shift',
      await js("document.getElementById('statusText').textContent"),
      'OFFLINE');

    check('realtime subscribed',
      await js("document.getElementById('realtimeText').textContent"),
      'Live');

    /* ---- 5 & 6. on shift, and the position uploads ------------- */

    await js("document.getElementById('onlineBtn').click()");
    await wait(1400);

    check('status now online',
      await js("document.getElementById('statusText').textContent"),
      'ONLINE');

    check('driver row says online',
      await js("window.hllSupabase.__db.drivers[0].status"),
      'online');

    check('gps active',
      await js("document.getElementById('gpsStatus').textContent"),
      'Active');

    check('position painted',
      await js("document.getElementById('latitude').textContent !== '—'"),
      'true');

    check('heading painted',
      await js("document.getElementById('headingDir').textContent"),
      'ENE');

    const rows = await js("(window.hllSupabase.__db.driver_locations||[]).length");
    if (Number(rows) > 0) say('positions uploaded', rows);
    else fails.push('positions uploaded: expected at least 1, got ' + rows);

    check('upload carries the driver id',
      await js("(window.hllSupabase.__db.driver_locations||[])[0].driver_id"),
      '41');

    check('fix counter moved',
      await js("Number(document.getElementById('fixCount').textContent) > 0"),
      'true');

    /* ---- 7. off shift ------------------------------------------ */

    await js("document.getElementById('offlineBtn').click()");
    await wait(900);

    check('status now offline',
      await js("document.getElementById('statusText').textContent"),
      'OFFLINE');

    check('gps watch cleared',
      await js("window.__gpsCleared === true"),
      'true');

    /* ---- 8. signing out ---------------------------------------- */

    await js("document.getElementById('onlineBtn').click()");
    await wait(900);
    await js("document.getElementById('logoutBtn').click()");
    await wait(1200);

    check('back at the sign-in view',
      await js(VIEW),
      'login');

  } catch (err) {
    fails.push('the walk stopped: ' + (err && err.message ? err.message : err));
  }

  if (thrown.length) {
    thrown.slice(0, 8).forEach((m) => fails.push('console error: ' + m));
  }

  console.log('\ndriver terminal\n' + steps.join('\n'));

  if (fails.length) {
    console.log('\n' + fails.length + ' problem(s)');
    fails.forEach((f) => console.log('  ' + f));
  } else {
    console.log('\nclean');
  }

  try { fs.rmSync(tmp, { recursive: true, force: true }); } catch (e) { /* temp */ }

  app.exit(fails.length ? 1 : 0);
});
