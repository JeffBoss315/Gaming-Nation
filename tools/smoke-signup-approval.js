/* Registration with email confirmation on, and the download gate.

   The journey a new driver actually takes, which nothing covered before
   because the stand-in always returned a session and so never reproduced
   the state a real Supabase project starts in:

     1. they register — Supabase makes the Auth user and withholds the
        session until the address is proved, so the browser cannot write
        the drivers row and registration must NOT treat that as failure
     2. they confirm, and sign in — the session exists now, so the driver
        record and the application are made at that point
     3. they are on the roster but not approved, so the client download
        is refused
     4. a recruiter approves them
     5. they sign in again and the download is released

   Step 3 is the one worth having a test for: it is the only thing
   stopping an unapproved stranger taking the client, and it is a single
   boolean that any refactor could quietly flip.

     node_modules/electron/dist/electron.exe tools/smoke-signup-approval.js .
*/
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

/* resolved, not taken as given: 'npm run smoke:*' passes '.' */
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

app.setPath('userData', path.join(app.getPath('temp'), 'hll-smoke-signup'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const fails = [];
const steps = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(42) + v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function check(what, got, want) {
  if (String(got) === String(want)) say(what, String(got));
  else fails.push(what + ': expected ' + want + ', got ' + got);
}

const EMAIL = 'newdriver@heavyline.test';
const PASSWORD = 'a-good-password';

app.whenReady().then(async () => {

  const win = new BrowserWindow({ width: 1280, height: 900, show: false });

  const thrown = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level !== 3) return;
    if (/Electron Security Warning|ERR_|fonts\.|jsdelivr|No drivers row for the recruiter/.test(message)) return;
    thrown.push(message);
  });

  await win.loadURL('file:///' + path.join(ROOT, 'login.html').replace(/\\/g, '/'));

  const js = (code) => win.webContents.executeJavaScript(code, true);

  try {
    /* The stand-in, with email confirmation ON — the state a new Supabase
       project ships in and the one this whole test is about. */
    await js('window.__hllConfirmEmail = true;');
    await js(FAKE_SUPABASE);
    await js("var s=document.getElementById('splash'); if(s) s.classList.add('gone');");
    await wait(600);

    /* ---- 1. register ------------------------------------------- */

    const reg = await js(`
      Accounts.register(
        { name: 'New Driver', email: '${EMAIL}', discord: '',
          created: new Date().toISOString() },
        '${PASSWORD}', 'GB'
      ).then(r => JSON.stringify({ confirm: !!r.confirmEmail, email: r.email }))
       .catch(e => JSON.stringify({ threw: e.message }));
    `);

    const regOut = JSON.parse(reg);

    if (regOut.threw) {
      fails.push('registration threw instead of asking for confirmation: ' + regOut.threw);
    } else {
      check('registration asks for confirmation', regOut.confirm, 'true');
      check('it names the address', regOut.email, EMAIL);
    }

    check('auth user exists',
      await js(`window.hllSupabase.__users.length`), '1');

    check('no driver row yet (RLS refused it)',
      await js(`window.hllSupabase.__db.drivers.length`), '0');

    /* ---- 2. confirm, then sign in ------------------------------- */

    /* Confirming the address is what releases the session; from the
       browser's side that is simply "signInWithPassword now works". */
    await js('window.__hllConfirmEmail = false;');

    const signIn = await js(`
      Accounts.verify('${EMAIL}', '${PASSWORD}')
        .then(r => JSON.stringify({
          error: r.error || null,
          code: r.driver ? r.driver.id : null,
          access: r.driver ? !!r.driver.clientAccess : null
        }));
    `);

    const first = JSON.parse(signIn);

    if (first.error) fails.push('first sign-in failed: ' + first.error);
    else say('first sign-in', 'ok');

    check('driver record provisioned',
      await js(`window.hllSupabase.__db.drivers.length`), '1');

    check('provisioned as pending',
      await js(`window.hllSupabase.__db.drivers[0].status`), 'pending');

    check('linked to the auth user',
      await js(`window.hllSupabase.__db.drivers[0].auth_user_id === window.hllSupabase.__users[0].user.id`),
      'true');

    check('application filed',
      await js(`(window.hllSupabase.__db.applications||[]).length`), '1');

    check('application keyed on the driver code',
      await js(`(window.hllSupabase.__db.applications[0]||{}).driver_id === window.hllSupabase.__db.drivers[0].driver_code`),
      'true');

    /* ---- 3. the gate is shut ----------------------------------- */

    check('download refused while pending', first.access, 'false');

    check('downloads page offers no download button',
      await js(`
        (function () {
          state.user = { id: '${'x'}', role: 'driver', clientAccess: false };
          var html = viewDownloads();
          return html.indexOf('data-act="download-client"') === -1;
        })()
      `), 'true');

    /* ---- 4. approve -------------------------------------------- */

    await js(`window.hllSupabase.__db.applications[0].status = 'approved';`);

    /* ---- 5. and now it opens ----------------------------------- */

    const again = await js(`
      Accounts.verify('${EMAIL}', '${PASSWORD}')
        .then(r => JSON.stringify({ error: r.error || null,
                                    access: r.driver ? !!r.driver.clientAccess : null }));
    `);

    const second = JSON.parse(again);

    if (second.error) fails.push('sign-in after approval failed: ' + second.error);

    check('download released after approval', second.access, 'true');

    check('downloads page offers the download button',
      await js(`
        (function () {
          state.user = { id: 'x', role: 'driver', clientAccess: true };
          var html = viewDownloads();
          return html.indexOf('data-act="download-client"') !== -1;
        })()
      `), 'true');

    check('still only one driver record',
      await js(`window.hllSupabase.__db.drivers.length`), '1');

  } catch (err) {
    fails.push('the walk stopped: ' + (err && err.message ? err.message : err));
  }

  if (thrown.length) thrown.slice(0, 6).forEach((m) => fails.push('console error: ' + m));

  console.log('\nsignup and approval\n' + steps.join('\n'));

  if (fails.length) {
    console.log('\n' + fails.length + ' problem(s)');
    fails.forEach((f) => console.log('  ' + f));
  } else {
    console.log('\nclean');
  }

  app.exit(fails.length ? 1 : 0);
});
