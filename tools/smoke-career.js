/* ============================================================
   Smoke test — the career figures are the driver's real record.

     npm run smoke:career

   Statistics, rank, XP and achievements are all DERIVED, in
   Career, from records that already exist. That decision is the
   thing worth defending, so this defends it:

     Today's kilometres are summed from runs that carry a date.
     A counter would have to be reset at midnight, and a reset
     that never runs - the client was shut, the machine asleep -
     leaves a wrong number all day with nothing to correct it.

     A run held in the delivery queue still happened. Somebody
     who has just driven 400 km with the service down must not
     be told they have driven none.

     Rank falls back on EVERY condition the platform ranks on,
     not distance alone. The old ladder held km only, and a
     km-only fallback promotes a driver the website has not - a
     client handing out Senior Driver that the platform disagrees
     with is worse than a client that says nothing.

     XP is a pure function of the record, so the same driver gets
     the same number wherever it is worked out. If that stops
     being true there are two truths and no way to tell which is
     the real one.

   Everything is seeded into a scratch profile, so this never
   reads or writes the real driver's records.
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

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-career'));
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
    /* ---------------- a driver with a history ----------------
       Two runs today (one still queued), one yesterday, one last week.
       Sixty minutes at the wheel this morning, a hundred and twenty
       yesterday, and one session still running.

       The fixture hands back the clock it used. Anything else is a test
       that passes all day and fails at ten past midnight, when a session
       "ten minutes ago" started yesterday - which is the very case the
       code under test exists to handle. */
    const clock = await run(`(() => {
      const now = Date.now();
      const H = 3600000;
      const noon = new Date(); noon.setHours(12, 0, 0, 0);
      const yest = new Date(noon); yest.setDate(yest.getDate() - 1);
      const week = new Date(noon); week.setDate(week.getDate() - 7);

      Store.db.driver = Object.assign(Store.db.driver || {},
        { gmnId: 'GMN-TEST', name: 'Test Driver' });

      Store.db.logbook = [
        { id: 'R1', finished: noon.toISOString(), km: 300, income: 4000 },
        { id: 'R3', finished: yest.toISOString(), km: 900, income: 9000 },
        { id: 'R4', finished: week.toISOString(), km: 500, income: 5000 },
      ];
      /* the queued one is today's and MUST count */
      Store.db.pending = [
        { id: 'R2', finished: noon.toISOString(), km: 120, income: 1500 },
      ];

      localStorage.setItem('gmn.db.v1', JSON.stringify({
        drivers: [{ id: 'GMN-TEST', name: 'Test Driver', km: 60000, deliveries: 120,
                    earned: 812000, convoys: 6, attendance: 92, country: 'Kenya',
                    status: 'online', playing: false, achievements: ['a-lead'] }],
        /* Anchored to midnight, not to "an hour and a half ago": a session
           pinned to the clock straddles midnight when the test happens to
           run late, and then the figure this checks - the part that
           happened TODAY - is correctly smaller and the test wrongly
           fails. It failed exactly that way at 00:05. */
        sessions: [
          { driverId: 'GMN-TEST',
            started: new Date(noon.getTime() - 11 * H).toISOString(),   /* 01:00 */
            ended:   new Date(noon.getTime() - 10 * H).toISOString() }, /* 02:00 */
          { driverId: 'GMN-TEST',
            started: new Date(yest.getTime() - 10 * H).toISOString(),   /* yesterday */
            ended:   new Date(yest.getTime() - 8 * H).toISOString() },
          { driverId: 'GMN-TEST', started: new Date(now - 10 * 60000).toISOString(),
            ended: null },                                             /* open, 10 min */
          { driverId: 'SOMEONE-ELSE', started: new Date(now - 5 * H).toISOString(), ended: null },
        ],
      }));
      return { midnight: Career.midnight(), openStart: now - 10 * 60000 };
    })()`);

    const today = await run('JSON.parse(JSON.stringify(Career.today()))');
    check('today is summed from runs that carry a date',
      today.km === 420 && today.income === 5500,
      today.km + ' km, ' + today.income);
    check('and a run held in the queue still counts', today.runs === 2,
      today.runs + ' run(s) today');

    /* ---- driving hours ----
       60 today at 01:00, 120 yesterday, and 10 still running. */
    const open = (Date.now() - clock.openStart) / 60000;
    const openToday = (Date.now() - Math.max(clock.openStart, clock.midnight)) / 60000;
    const near = (got, want) => Math.abs(got - want) < 0.5;

    const mins = await run('Career.minutes()');
    check('an open session counts up to now', near(mins, 60 + 120 + open),
      Math.round(mins) + ' min — 60 + 120 + the ' + open.toFixed(1) + ' still running');
    const todayMins = await run('Career.today().minutes');
    check('and today counts only what happened today', near(todayMins, 60 + openToday),
      Math.round(todayMins) + ' min today — yesterday’s 120 left out');
    check('another driver’s sessions are not counted',
      (await run('Career.sessions().length')) === 3,
      (await run('Career.sessions().length')) + ' session(s) mine');

    /* ---- rank: every condition, not distance alone ----
       On distance alone 60,000 km reaches Senior Driver, whose threshold is
       50,000. Senior also wants 20 convoys and 70% attendance; this driver
       has 6 convoys, which carries them as far as Junior Driver - 10,000 km,
       4 convoys, 60% - and no further. Two ranks lower than distance alone
       would have handed them. */
    const rank = await run('JSON.parse(JSON.stringify(Career.rank()))');
    check('rank applies every condition, not distance alone',
      rank.name === 'Junior Driver',
      rank.name + ' — 60,000 km would be Senior, 6 convoys is not');

    const awarded = await run(`(() => {
      const hq = Auth.hqDb(); hq.drivers[0].rankIdx = 5; Auth.saveHqDb(hq);
      return Career.rank().name;
    })()`);
    check('but an awarded rank always wins', awarded === 'Professional Driver', awarded);

    /* ---- how far to the next rank ----
       The bar has to agree with the sentence under it. Measured on distance
       alone this driver reads 100% - 60,000 km against Driver's 25,000 -
       under the words "4 more convoys". So it is measured on the condition
       FURTHEST from being met, which is the convoys. */
    await run(`(() => { const hq = Auth.hqDb(); delete hq.drivers[0].rankIdx;
      Auth.saveHqDb(hq); return 1; })()`);
    const nx = await run('JSON.parse(JSON.stringify(Career.toNext()))');
    check('the next rank is named with what it still wants',
      nx.rank.name === 'Driver' && nx.need.join('; ').indexOf('4 more convoys') > -1,
      nx.rank.name + ' — ' + nx.need.join('; '));
    check('and the bar agrees with that sentence', nx.pct < 100,
      nx.pct + '% — 6 of the 10 convoys Driver wants');

    /* ---- XP ---- */
    const xp = await run('Career.xp()');
    const want = 60000 * 1 + 120 * 250 + 6 * 500;
    check('XP is km + 250/delivery + 500/convoy', xp === want,
      xp + ' (expected ' + want + ')');
    check('and it is a pure function of the record',
      (await run('Career.xp({km:1000,deliveries:2,convoys:1})')) === 1000 + 500 + 500,
      'same record in, same number out');

    /* ---- achievements ---- */
    const b = await run(`(() => {
      const m = {}; Career.badges().forEach((x) => { m[x.a.id] = x; }); return m;
    })()`);
    check('a badge the numbers have earned is earned',
      b['a-50k'].done === true, '50,000 km at 60,000 km');
    check('one they have not is not', b['a-100k'].done === false,
      '100,000 km at 60,000 km — ' + b['a-100k'].pct + '%');
    check('and shows how far along it is', b['a-100k'].pct === 60,
      b['a-100k'].pct + '%');
    check('a staff-awarded badge comes off the record',
      b['a-lead'].done === true, 'Convoy Leader was granted');
    check('and one not awarded stays locked', b['a-community'].done === false,
      'Community Contributor');

    /* ---- the strip is honest when it knows nothing ---- */
    const strip = await run(`(() => {
      Store.db.job = null; Store.db.live = null; Telemetry.mode = 'sim';
      return driverStripHTML();
    })()`);
    check('with no telemetry the strip says so, not a guess',
      /not sending telemetry/.test(strip) && (strip.match(/&mdash;/g) || []).length >= 2,
      (strip.match(/&mdash;/g) || []).length + ' cell(s) show a dash with a reason');
    check('and it never claims the crew can see an unlinked client',
      /Not linked/.test(strip), 'status reads "Not linked"');

    const live = await run(`(() => {
      Store.db.conn.gmn = 'connected';
      Telemetry.mode = 'live';
      Store.db.live = { truck: 'Scania S 730 V8', near: 'Rotterdam' };
      Store.db.job = { cargo: 'Steel coils', to: 'Hamburg' };
      return driverStripHTML();
    })()`);
    for (const [what, txt] of [['the truck', 'Scania S 730 V8'], ['the city', 'Rotterdam'],
                               ['the load', 'Steel coils'], ['status', 'Online']]) {
      check('  live, it shows ' + what, live.indexOf(txt) > -1, txt);
    }

    check('the renderer logged no errors', errors.length === 0,
      errors.length ? errors.slice(0, 2).join(' | ') : 'none');
  } catch (e) {
    check('the test itself ran', false, (e && e.message) || String(e));
  }

  console.log('\nthe career figures are the driver’s real record');
  console.log(steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
  app.exit(problems ? 1 : 0);
});
