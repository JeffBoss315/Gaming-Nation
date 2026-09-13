/* ============================================================
   Smoke test — notifications gather, and support actually sends.

     npm run smoke:notify

   TWO CLAIMS WORTH DEFENDING.

   The notifications screen invents no store of its own. It reads
   the places these things already live - assignments, threads,
   announcements, convoys, the platform's own notifications - and
   its read state is the source's read state wherever the source
   has one. If that stops being true, the badge on Messages and
   the badge here disagree, and a driver has two inboxes that
   both claim to be the inbox.

   Support raises a REAL ticket on the company record, the same
   one the admin console opens. A support screen that takes a
   message and drops it is worse than no support screen at all,
   because the driver walks away believing they have been heard.
   So this checks the ticket exists afterwards, that staff are
   told about it, and - the part that is easy to get wrong - that
   a failed write says so instead of thanking them.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const steps = [];
let problems = 0;
const check = (name, ok, detail) => {
  steps.push((ok ? '  ' : '! ') + String(name).padEnd(52)
    + (detail === undefined ? '' : detail));
  if (!ok) problems++;
};

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-notify'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200, height: 900, show: false,
    webPreferences: { preload: path.join(ROOT, 'preload.js') },
  });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Electron Security Warning/.test(msg)) errors.push(msg);
  });

  await win.loadFile(path.join(ROOT, 'tracker.html'));
  await new Promise((r) => setTimeout(r, 1600));
  const run = (js) => win.webContents.executeJavaScript(js);

  try {
    /* ---------------- a company with things to say ---------------- */
    await run(`(() => {
      const now = Date.now();
      Store.db.driver = Object.assign(Store.db.driver || {},
        { gmnId: 'GMN-ME', name: 'Me' });
      Store.db.seen = {};

      localStorage.setItem('gmn.db.v1', JSON.stringify({
        drivers: [
          { id: 'GMN-ME', name: 'Me', km: 0, deliveries: 0, convoys: 0, attendance: 100,
            accountStatus: 'active' },
          { id: 'GMN-OTHER', name: 'Other Driver', km: 0, deliveries: 0, convoys: 0,
            attendance: 100, accountStatus: 'active' },
        ],
        sessions: [],
        tickets: [],
        assignments: [{ id: 'AS1', driverId: 'GMN-ME', status: 'assigned',
          from: 'Rotterdam', to: 'Hamburg', cargo: 'Steel coils', km: 480,
          payout: 4200, at: new Date(now - 60000).toISOString() }],
        announcements: [{ id: 'AN1', title: 'Winter convoy season',
          body: 'Sign-ups open Friday.', date: new Date(now - 120000).toISOString() }],
        notifications: [
          { id: 'N1', driverId: 'GMN-ME', type: 'info', icon: 'bell', title: 'Promoted',
            body: 'You are now a Junior Driver.', at: new Date(now - 30000).toISOString(),
            read: false },
          { id: 'N2', driverId: null, type: 'info', icon: 'bell', title: 'Server maintenance',
            body: 'Back at 20:00.', at: new Date(now - 90000).toISOString(), read: false },
          { id: 'N3', driverId: 'GMN-OTHER', type: 'info', icon: 'bell', title: 'Not for me',
            body: 'Somebody else.', at: new Date(now).toISOString(), read: false },
        ],
        events: [{ id: 'EV1', name: 'Friday Night Haul', status: 'scheduled',
          date: new Date(now + 6 * 3600000).toISOString(), start: 'Calais', dest: 'Berlin',
          registered: [{ driverId: 'GMN-ME' }] },
          { id: 'EV2', name: 'Next month', status: 'scheduled',
            date: new Date(now + 30 * 86400000).toISOString(),
            registered: [{ driverId: 'GMN-ME' }] },
          { id: 'EV3', name: 'Not signed on', status: 'scheduled',
            date: new Date(now + 3600000).toISOString(), registered: [] }],
      }));
      Messages.threads = [
        { withId: 'GMN-OTHER', name: 'Other Driver', unread: 2,
          last: { text: 'Are you rolling?', at: new Date(now - 10000).toISOString() } },
        { withId: 'GMN-QUIET', name: 'Quiet Driver', unread: 0, last: null },
      ];
      return true;
    })()`);

    const kinds = await run(`Notify.feed().map((n) => n.kind + '|' + n.title)`);
    const has = (k) => kinds.some((x) => x.indexOf(k + '|') === 0);

    check('a dispatched job is a notification', has('New job'),
      kinds.find((x) => x.indexOf('New job') === 0) || 'MISSING');
    check('so is a message waiting', has('Message'),
      kinds.find((x) => x.indexOf('Message') === 0) || 'MISSING');
    check('and a crew announcement', has('Announcement'),
      kinds.find((x) => x.indexOf('Announcement') === 0) || 'MISSING');
    check('and anything staff sent you', has('Admin'),
      kinds.filter((x) => x.indexOf('Admin') === 0).join(' / ') || 'MISSING');

    check('a broadcast reaches everybody',
      kinds.some((x) => x.indexOf('Server maintenance') > -1), 'driverId null');
    check('but another driver’s notification does not',
      !kinds.some((x) => x.indexOf('Not for me') > -1), 'addressed to GMN-OTHER');

    check('a convoy soon is a reminder',
      kinds.some((x) => x.indexOf('Friday Night Haul') > -1), 'starts in 6 h');
    check('one a month away is not yet',
      !kinds.some((x) => x.indexOf('Next month') > -1), 'still 30 days out');
    check('nor is one you never signed on to',
      !kinds.some((x) => x.indexOf('Not signed on') > -1), 'not registered');

    /* ---- read state belongs to the source ---- */
    const before = await run('Notify.count()');
    await run(`Notify.markRead('n:N1')`);
    const after = await run('Notify.count()');
    check('marking one read drops the count', after === before - 1,
      before + ' then ' + after);
    check('and it is marked read where it actually lives',
      (await run(`(Auth.hqDb().notifications.find((n) => n.id === 'N1') || {}).read`)) === true,
      'the platform row carries read:true');

    /* Mark all read clears everything it OWNS. It does not clear the waiting
       message, because a message is unread until the message is read - and
       the company service, which owns that state, is not running here. The
       alternative is a cleared badge over a message nobody has opened, and
       the Messages tab disagreeing with this screen about the same thread. */
    const listed = await run('Notify.feed().length');
    await run('Notify.markAll()');
    const left = await run(`Notify.feed().filter((n) => n.unread).map((n) => n.kind)`);
    check('mark all read clears what it owns',
      left.length === 1 && left[0] === 'Message',
      left.length ? left.join(', ') + ' left' : 'nothing left');
    check('a waiting message is not cleared by tidying up',
      left[0] === 'Message', 'it stays until the message itself is read');
    check('and nothing was thrown away to get there',
      (await run('Notify.feed().length')) === listed, listed + ' still listed');

    /* ---------------- support ---------------- */
    const sent = await run(`(() => {
      Support.open('tech');
      document.querySelector('#spSubject').value = 'No telemetry from ETS2';
      document.querySelector('#spBody').value = 'Nothing arrives when I take a load.';
      Support.send('tech');
      const hq = Auth.hqDb();
      const t = (hq.tickets || [])[0];
      return t ? { id: t.id, subject: t.subject, category: t.category,
        status: t.status, driverId: t.driverId,
        body: (t.messages[0] || {}).body,
        staffTold: (hq.notifications || []).some((n) => n.href === '#/ticket/' + t.id) } : null;
    })()`);
    check('a support request becomes a real ticket', !!sent && !!sent.id,
      sent ? sent.id + ' — ' + sent.subject : 'NO TICKET WAS WRITTEN');
    if (sent) {
      check('filed against the driver who raised it', sent.driverId === 'GMN-ME', sent.driverId);
      check('open, and in the right category',
        sent.status === 'open' && sent.category === 'Technical',
        sent.status + ' / ' + sent.category);
      check('a technical ticket carries the diagnosis',
        /what the client reports/.test(sent.body) && /Client V/.test(sent.body),
        'version, game and telemetry state travel with it');
      check('and staff are told it exists', sent.staffTold === true,
        'a notification points at the ticket');
    }

    /* ---- an empty ticket cannot be answered, so it is not sent ---- */
    const empty = await run(`(() => {
      const n = (Auth.hqDb().tickets || []).length;
      Support.open('admin');
      document.querySelector('#spSubject').value = '';
      document.querySelector('#spBody').value = '';
      Support.send('admin');
      const after = (Auth.hqDb().tickets || []).length;
      closeModals();
      return { n, after };
    })()`);
    check('an empty request is refused, not filed',
      empty.after === empty.n, empty.n + ' before, ' + empty.after + ' after');

    /* ---- reporting a driver names them, in the ticket, not to them ---- */
    const rep = await run(`(() => {
      Support.open('driver');
      document.querySelector('#spWho').value = 'GMN-OTHER';
      document.querySelector('#spSubject').value = 'Blocking on convoy';
      document.querySelector('#spBody').value = 'Parked across the road at the start.';
      Support.send('driver');
      const t = (Auth.hqDb().tickets || [])[0];
      return { body: (t.messages[0] || {}).body, priority: t.priority, cat: t.category };
    })()`);
    check('a report names the driver it is about',
      rep.body.indexOf('Other Driver (GMN-OTHER)') > -1,
      rep.body.split(String.fromCharCode(10))[0]);
    check('and conduct is raised high, not normal',
      rep.priority === 'high' && rep.cat === 'Conduct', rep.priority + ' / ' + rep.cat);

    /* ---- a write that fails must not thank them ---- */
    const failed = await run(`(() => {
      const real = Auth.saveHqDb;
      Auth.saveHqDb = () => false;                 /* the disk says no */
      Support.open('admin');
      document.querySelector('#spSubject').value = 'Will not save';
      document.querySelector('#spBody').value = 'This write is going to fail.';
      Support.send('admin');
      Auth.saveHqDb = real;
      const stillOpen = !!document.querySelector('#spSubject');
      closeModals();
      return { stillOpen };
    })()`);
    check('a failed write leaves the form open, not a false thank-you',
      failed.stillOpen === true, 'the driver still has what they typed');

    check('the renderer logged no errors', errors.length === 0,
      errors.length ? errors.slice(0, 2).join(' | ') : 'none');
  } catch (e) {
    check('the test itself ran', false, (e && e.message) || String(e));
  }

  console.log('\nnotifications gather, and support actually sends');
  console.log(steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
  app.exit(problems ? 1 : 0);
});
