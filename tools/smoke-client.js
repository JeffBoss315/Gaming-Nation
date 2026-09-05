/* Drives the Gaming Nation Trucker client in a real window and reports what
   happened: sign in as the owner, walk every screen, credit a delivery to the
   company, and check the dispatch list arrives.

     node_modules/electron/dist/electron.exe tools/smoke-client.js <project-root>
*/
const { app, BrowserWindow } = require('electron');
const path = require('path');

/* resolved, not taken as given: 'npm run smoke:*' passes '.', and a relative
   root turns require(ROOT + '/desktop-capture') into a bare module name */
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

/* A probe must never touch the profile the real app uses — it signs in, writes
   records and would leave them behind. Everything below happens in a scratch
   profile that is thrown away with the run. */
app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-' + path.basename(__filename, '.js')));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  /* the same handler the shipped shell registers */
  require(path.join(ROOT, 'desktop-capture')).register();
  const win = new BrowserWindow({
    width: 1300, height: 900, show: false,
    webPreferences: { preload: path.join(ROOT, 'preload.js') },
  });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => { if (level >= 2) errors.push(msg); });

  await win.loadFile(path.join(ROOT, 'tracker.html'));
  await new Promise((r) => setTimeout(r, 1800));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const R = { steps: [] };
    const say = (k, v) => R.steps.push(k + ': ' + v);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    /* a fresh id each run, so the idempotency guard on credited runs does not
       swallow the assertions */
    const RUN = 'P' + Date.now().toString(36).toUpperCase();

    try {
      const acc = Auth.accounts().find(a => a.email === 'jeffboss730@gmail.com');
      say('owner account', acc ? acc.driverId : 'MISSING');
      if (!acc) return R;
      Auth.signIn(acc, Auth.driverRecord(acc.driverId), false);
      render(); await wait(400);
      say('signed in', Store.db.driver && Store.db.driver.authed ? Store.db.driver.gmnId : 'NO');

      /* the desktop bridge is present in this shell */
      say('desktop bridge', window.gmnDesktop ? 'yes' : 'NO');
      say('capture available', window.gmnDesktop && window.gmnDesktop.captureScreen ? 'yes' : 'NO');

      /* a dispatched load reaches the client */
      const hq = Auth.hqDb();
      hq.assignments = hq.assignments || [];
      hq.assignments.unshift({ id: 'ASG-' + RUN, driverId: Store.db.driver.gmnId,
        from: 'Rotterdam', to: 'Hamburg', cargo: 'Steel coils', km: 480, payout: 4200,
        status: 'assigned', at: new Date().toISOString() });
      Auth.saveHqDb(hq);
      say('assignments read back', myAssignments().length);
      state.view = 'dashboard'; render(); await wait(300);
      say('dispatch card', /Dispatched to you/.test(document.body.textContent) ? 'yes' : 'NO');

      /* a delivery credits the company record */
      const rec = { id: 'JOB-' + RUN, from: 'Rotterdam', to: 'Hamburg', cargo: 'Steel coils',
        km: 480, income: 4200, damage: 0, finished: new Date().toISOString(), status: 'pending' };
      Store.db.pending.push(rec);
      Store.db.conn.hll = 'connected';
      submitDelivery(rec.id, true); await wait(300);
      const hq2 = Auth.hqDb();
      const me = hq2.drivers.find(d => d.id === Store.db.driver.gmnId);
      say('run on company record', (hq2.jobs || []).some(j => j.id === 'JOB-' + RUN) ? 'yes' : 'NO');
      say('driver km credited', me ? me.km : 'NO DRIVER');
      say('driver deliveries', me ? me.deliveries : '-');
      say('activity entry', (hq2.activity || []).some(a => /delivered/.test(a.text || '')) ? 'yes' : 'NO');
      say('assignment auto-closed', (hq2.assignments.find(a => a.id === 'ASG-' + RUN) || {}).status);

      /* a real capture, through the bridge */
      const shot = window.gmnDesktop && await window.gmnDesktop.captureScreen();
      say('screen capture', shot && shot.dataUrl ? Math.round(shot.bytes / 1024) + ' KB' : 'null (headless)');

      /* every screen renders */
      const views = Object.keys(VIEWS);
      for (const v of views) {
        state.view = v; render(); await wait(160);
        const t = document.body.textContent;
        say('view/' + v, t.includes('Something went wrong') ? 'ERROR SCREEN'
          : document.querySelector('#main').children.length ? 'ok' : 'EMPTY');
      }
      say('no rail on this build', document.getElementById('railScrim') ? 'SCRIM STILL THERE' : 'yes');
    } catch (e) {
      R.crash = e && (e.stack || e.message);
    }
    return R;
  })()`);

  console.log(JSON.stringify({ ...out, consoleErrors: errors }, null, 2));
  app.exit(0);
});
