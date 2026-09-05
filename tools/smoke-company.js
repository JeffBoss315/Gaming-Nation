/* The thing that was actually broken: a driver signs up on one machine and
   the recruiter on another never hears about it.

   Starts the company service, then opens the drivers' website in one window
   and the console in a second — two separate browser profiles, standing in
   for two machines. A sign-up in the first must reach the second with nothing
   configured by hand.

     node_modules/electron/dist/electron.exe tools/smoke-company.js .
*/
const { app, BrowserWindow, session } = require('electron');
const path = require('path');
const fs = require('fs');
const { spawn, spawnSync } = require('child_process');
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

/* resolved, not taken as given: 'npm run smoke:*' passes '.', and a relative
   root turns require(ROOT + '/desktop-capture') into a bare module name */
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const PORT = 7098;
const COMPANY_FILE = path.join(ROOT, 'hll-company.smoke.json');
/* built and served from somewhere disposable, so a deployable www/ is never
   overwritten by a test run */
const SITE_OUT = path.join(ROOT, '.smoke-site');
const APP_OUT = path.join(ROOT, '.smoke-app');

app.setPath('userData', path.join(app.getPath('temp'), 'hll-smoke-company'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const steps = [];
const say = (k, v) => steps.push(k + ': ' + v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* each window gets its own storage, so they are two machines and not one */
async function open(url, partition) {
  const win = new BrowserWindow({
    width: 1300, height: 900, show: false,
    webPreferences: { partition, session: undefined },
  });
  await win.loadURL(url);

  /* Registration goes through Supabase Auth. This test is about two
     machines sharing one company through the service, not about Supabase,
     and it must not leave real accounts behind in the live project — so
     each window gets its own in-memory stand-in. Two windows therefore
     share nothing through Supabase, which is the point: what crosses
     between them has to cross through the company service. */
  await win.webContents.executeJavaScript(FAKE_SUPABASE);

  await wait(1800);
  return win;
}

app.whenReady().then(async () => {
  try { fs.unlinkSync(COMPANY_FILE); } catch (e) { /* first run */ }

  /* The service serves www/, not the source files. Building first is the
     difference between testing this code and testing whatever was built last. */
  const built = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-www.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1',
      GMN_SITE_OUT: SITE_OUT,
      GMN_APP_OUT: APP_OUT,
    }),
    encoding: 'utf8',
  });
  if (built.status !== 0) {
    console.log('could not build www/: ' + (built.stderr || built.error));
    app.exit(1);
    return;
  }

  const server = spawn(process.execPath, [path.join(ROOT, 'fleet-server.js'), '--port', String(PORT)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1',
      GMN_COMPANY_FILE: COMPANY_FILE,
      GMN_SITE_DIR: SITE_OUT,
    }),
    stdio: 'ignore',
  });
  await wait(1500);

  const base = 'http://localhost:' + PORT;
  let problems = 0;

  try {
    /* ---- machine one: a driver signs up on the website ---- */
    const one = await open(base + '/', 'persist:machine-one');
    const a = await one.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      out.serviceUrl = Sync.url();
      out.configuredByHand = Sync.configured();
      const email = 'joined' + Date.now() + '@example.com';
      out.email = email;
      const res = await Accounts.register(
        { name: 'Joined Driver', email, discord: '',
          created: new Date().toISOString() },
        'JoinedUp123', 'Netherlands').catch((e) => ({ error: e.message }));
      out.registered = res.error || 'ok';
      out.application = (Store.db.applications.find(x => x.email === email) || {}).id || 'NONE';
      /* the store pushes a moment after any write */
      await wait(2500);
      out.syncStatus = Sync.status;
      out.syncError = Sync.lastError;
      return out;
    })()`);

    say('service the page chose by itself', a.serviceUrl || 'NONE');
    say('anybody had to configure it', a.configuredByHand ? 'YES' : 'no');
    say('sign-up on machine one', a.registered);
    say('application filed', a.application);
    say('push status', a.syncStatus + (a.syncError ? ' — ' + a.syncError : ''));
    if (a.registered !== 'ok') problems++;
    if (a.syncStatus !== 'ok') problems++;

    /* ---- the service now holds it ---- */
    const held = await one.webContents.executeJavaScript(
      `fetch('${base}/api/company').then(r => r.json()).then(b => ({
        drivers: (b.data.drivers || []).length,
        applications: (b.data.applications || []).map(x => x.name),
        accounts: (b.data.accounts || []).length,
      }))`);
    say('service holds drivers', held.drivers);
    say('service holds applications', held.applications.join(', ') || 'NONE');
    say('service holds logins', held.accounts);
    if (!held.applications.includes('Joined Driver')) problems++;

    /* ---- machine two: the recruiter, in a separate profile ---- */
    const two = await open(base + '/admin.html', 'persist:machine-two');
    const b = await two.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const out = {};
      out.site = SITE;
      out.serviceUrl = Sync.url();
      /* this window has its own storage — it starts knowing nothing */
      out.beforePull = Store.db.applications.length;
      await Sync.pull();
      await wait(600);
      out.afterPull = Store.db.applications.length;
      out.sees = Store.db.applications.map(x => x.name).join(', ');
      const owner = Accounts.all().find(x => x.email === 'jeffboss730@gmail.com');
      state.user = Store.driver(owner.driverId);
      render(); await wait(500);
      const page = document.querySelector('#view').textContent.replace(/\\s+/g,' ');
      out.announces = /drivers? (has|have) applied/i.test(page);
      out.namesThem = /Joined Driver/.test(page);
      out.warningShown = /not joined up across machines/.test(page);
      out.notified = Store.db.notifications.some(n => /signed up/i.test(n.title || ''));
      return out;
    })()`);

    say('console service', b.serviceUrl);
    say('applications known before pulling', b.beforePull);
    say('applications after pulling', b.afterPull);
    say('console sees', b.sees || 'NOTHING');
    say('console announces the sign-up', b.announces ? 'yes' : 'NO');
    say('console names the applicant', b.namesThem ? 'yes' : 'NO');
    say('notification travelled', b.notified ? 'yes' : 'NO');
    say('"not joined up" warning', b.warningShown ? 'STILL SHOWN' : 'gone');
    if (!b.announces || !b.namesThem || b.warningShown) problems++;

    one.destroy(); two.destroy();
  } catch (e) {
    say('crash', e && (e.stack || e.message));
    problems++;
  }

  server.kill();
  try { fs.unlinkSync(COMPANY_FILE); } catch (e) { /* fine */ }
  for (const d of [SITE_OUT, APP_OUT]) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) { /* fine */ }
  }

  console.log(JSON.stringify({ steps }, null, 2));
  console.log(problems ? '\n' + problems + ' problem(s)\n' : '\nclean\n');
  app.exit(problems ? 1 : 0);
});
