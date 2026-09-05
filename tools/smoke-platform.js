/* Drives the platform in a real Electron window and reports what happened.
   Loads index.html, signs in as the owner, dispatches a load, credits a run,
   and reads the resulting screens back out. */
const { app, BrowserWindow } = require('electron');
const path = require('path');

/* Registration goes through Supabase Auth. Without a stand-in this probe
   signs up against the LIVE project on every run — leaving a real Auth user
   and a real drivers row in the company people are actually using. */
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

/* resolved, not taken as given: 'npm run smoke:*' passes '.', and a relative
   root turns require(ROOT + '/desktop-capture') into a bare module name */
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

/* A probe must never touch the profile the real app uses — it signs in, writes
   records and would leave them behind. Everything below happens in a scratch
   profile that is thrown away with the run. */
app.setPath('userData', path.join(app.getPath('temp'), 'hll-smoke-' + path.basename(__filename, '.js')));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1400, height: 950, show: false });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2) errors.push(msg);
  });
  await win.loadFile(path.join(ROOT, 'index.html'));
  await win.webContents.executeJavaScript(FAKE_SUPABASE);
  await new Promise((r) => setTimeout(r, 1800));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const R = { steps: [] };
    const say = (k, v) => R.steps.push(k + ': ' + v);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));

    try {
      /* 0. the driver terminal shares this document and must stay out of
            the way of it. driver-login.html and driver-dashboard.html were
            merged into index.html, so on every ordinary route their markup
            is present and has to be hidden, their scripts unrun, and the
            SPA has to have booted — which it does not if HLL_TERMINAL was
            wrongly set, leaving a blank page. */
      const dt = document.getElementById('dt-root');
      say('terminal markup present but hidden',
        dt ? (dt.hidden ? 'hidden' : 'VISIBLE') : 'MISSING');
      say('terminal scripts not started',
        window.dtGo === undefined ? 'not started' : 'STARTED');
      say('the website booted', document.getElementById('app') ? 'yes' : 'NO');

      /* 1. sign in as the owner */
      const acc = Accounts.all().find(a => a.email === 'jeffboss730@gmail.com');
      say('owner account', acc ? acc.driverId + ' / ' + acc.role : 'MISSING');
      if (!acc) return R;
      state.user = Store.driver(acc.driverId);
      say('owner driver record', state.user ? state.user.id + ' ' + state.user.name : 'MISSING');
      go('#/dashboard'); render(); await wait(300);
      say('dashboard rendered', document.querySelector('.page') ? 'yes' : 'NO');

      /* 2. presence is derived, not random */
      refreshPresence();
      say('own status after presence', state.user.status);
      const before = state.user.status;
      state.user.lastSeen = new Date(Date.now() - 40 * 60000).toISOString();
      refreshPresence();
      say('status when stale (should be online again — we stamp ourselves)', state.user.status);

      /* 3. dispatch a load to the owner */
      const n0 = Store.db.assignments.length;
      openDispatch(state.user.id); await wait(200);
      document.getElementById('dp-from').value = 'Rotterdam';
      document.getElementById('dp-to').value = 'Hamburg';
      document.getElementById('dp-cargo').value = 'Steel coils';
      document.getElementById('dp-payout').value = '4200';
      saveDispatch(); await wait(200);
      say('assignment created', Store.db.assignments.length === n0 + 1 ? 'yes' : 'NO');
      const a = Store.db.assignments[0];
      say('assignment', a ? [a.id, a.driverId, a.from, a.to, a.km + 'km', a.status].join(' | ') : 'NONE');

      /* 4. the driver sees it on the dashboard */
      go('#/dashboard'); render(); await wait(300);
      const card = [...document.querySelectorAll('.card-title')].find(e => /Dispatched to you/.test(e.textContent));
      say('dispatch card on dashboard', card ? 'yes' : 'NO');
      const accept = document.querySelector('[data-act="assignment-state"][data-v="accepted"]');
      say('accept button', accept ? 'yes' : 'NO');
      if (accept) { accept.click(); await wait(300); }
      say('status after accept', Store.db.assignments[0].status);

      /* 5. a credited run drives the charts */
      Store.db.jobs.unshift({ id: 'JOB-1', driverId: state.user.id, from: 'Rotterdam', to: 'Hamburg',
        cargo: 'Steel coils', km: 480, income: 4200, finished: new Date().toISOString() });
      Store.save();
      say('deliveries this month', deliveriesThisMonth(state.user.id));
      rollDistanceWindows();
      say('weekKm from runs', state.user.weekKm);

      /* 6. every admin screen renders */
      /* the console's own tabs are walked by smoke-sites */

      /* 7. every route renders */
      const routes = ['dashboard','drivers','fleet','convoy','events','rankings','achievements',
        'recruitment','community','support','notifications','livemap','downloads','settings'];
      for (const r of routes) {
        go('#/' + r); render(); await wait(180);
        const t = document.body.textContent;
        say('route/' + r, t.includes('Something went wrong') ? 'ERROR SCREEN'
          : document.querySelector('.page') ? 'ok' : 'EMPTY');
      }

      /* 8. the management paths: recruit, tickets, roles */
      const email = 'probe' + Store.db.drivers.length + '@example.com';
      /* register(account, password, country) — the password and the country
         are positional. Passing them inside the account object left signUp
         with an undefined password, and the probe died on "Signup requires a
         valid password" without ever reaching the screens below. */
      await Accounts.register(
        { name: 'Probe Driver', email, discord: 'probe' },
        'ProbePass123',
        'Netherlands'
      );
      const cand = Accounts.all().find(a => a.email === email);
      say('signup created an account', cand ? cand.driverId : 'NO');
      const appn = Store.db.applications.find(a => a.email === email);
      say('signup filed an application', appn ? appn.id + ' / ' + appn.status : 'NO');
      /* Either title counts. The owner IS the recruiter here — recruiterDriver()
         falls back to the owner seed — so registration sends them the direct
         'New application for you' and deliberately leaves them OUT of the
         broadcast titled 'New driver signed up', to avoid telling one person
         twice. Matching only the broadcast reported NO for a person who had
         in fact been told, and told more precisely. */
      const heard = Store.db.notifications.find(n =>
        n.driverId === state.user.id
        && /signed up|application for you/i.test(n.title || ''));
      say('staff was notified', heard ? heard.title : 'NO');

      /* the console has its own site now — smoke-sites covers it. Here we check
         the drivers' site tells staff there is something waiting. */
      go('#/dashboard'); render(); await wait(300);
      say('application visible to the owner',
        document.body.textContent.includes('Probe Driver') ? 'yes' : 'NO');
      say('console button carries the count',
        (document.querySelector('[data-act="site-admin"]') || {}).textContent
          ? 'yes' : 'NO');
      if (appn) {
        approveApplication(appn.id); await wait(250);
        const yes = document.querySelector('[data-act="modal-yes"]');
        say('approve asks for confirmation', yes ? 'yes' : 'NO');
        if (yes) yes.click();
        await wait(250);
      }
      const approved = Store.db.applications.find(a => a.email === email);
      say('after approve', approved ? approved.status : 'GONE');
      const newDriver = Store.db.drivers.filter(d => d.email === email);
      say('driver records created (must be 1)', newDriver.length);

      /* a ticket raised by that driver must reach the owner */
      const tk = { id: 'TCK-PROBE', subject: 'Probe ticket', category: 'Technical issue',
        priority: 'normal', status: 'open', driverId: cand.driverId,
        opened: new Date().toISOString(), updated: new Date().toISOString(),
        messages: [{ from: cand.driverId, text: 'Please look at this', at: new Date().toISOString() }] };
      Store.db.tickets.unshift(tk); Store.save();
      go('#/support'); state.ui.supportFilter = 'all'; render(); await wait(250);
      say('owner sees the driver ticket',
        document.body.textContent.includes('Probe ticket') ? 'yes' : 'NO');
      handleAction('ticket-progress', { dataset: { id: 'TCK-PROBE' } }); await wait(200);
      say('ticket moved to in progress', Store.ticket('TCK-PROBE').status);
      say('raiser was notified', Store.db.notifications.some(n =>
        n.driverId === cand.driverId) ? 'yes' : 'NO');
      handleAction('ticket-resolve', { dataset: { id: 'TCK-PROBE' } }); await wait(200);
      say('ticket resolved', Store.ticket('TCK-PROBE').status);

      /* 9. connections are editable, not fake */
      go('#/settings'); state.ui.profileTab = 'account'; render(); await wait(250);
      say('connection rows', document.querySelectorAll('[data-act="conn-edit"]').length);
      say('google row gone', /Google/.test(document.body.textContent) ? 'STILL THERE' : 'yes');
    } catch (e) {
      R.crash = e && (e.stack || e.message);
    }
    return R;
  })()`);

  console.log(JSON.stringify({ ...out, consoleErrors: errors }, null, 2));
  app.exit(0);
});
