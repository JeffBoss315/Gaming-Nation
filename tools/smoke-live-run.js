/* ============================================================
   Smoke test — a run, from the game to everybody's screen.

     node_modules/electron/dist/electron.exe tools/smoke-live-run.js .

   This is the whole claim in one test. It stands up:

     a fake game     an HTTP server answering the SCS telemetry
                     endpoint, whose truck we can drive by hand
     the company     fleet-server.js, the real one
     a driver        tracker.html in one window, reading that
                     telemetry and reporting to that service
     a dispatcher    the management console in a second window,
                     with its own storage — a different machine

   Then it hands the driver a job and checks that the run appears,
   that the client works out the right things about it, that it
   reaches the console without anybody polling, that progress
   moves, and that delivering it announces itself.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const FLEET_PORT = 7097;
const GAME_PORT = 25599;
const COMPANY_FILE = path.join(ROOT, 'hll-company.liverun.json');
const SITE_OUT = path.join(ROOT, '.smoke-live-site');
const APP_OUT = path.join(ROOT, '.smoke-live-app');

/* A fresh profile every run.

   The driver record, the sessions and the money all live in localStorage
   under this profile, and the checks below assert exact figures — 4200
   earned, one delivery, one run in the session. Reusing the profile carried
   the previous run's totals in, so a second run read 8400 and two
   deliveries and reported nine failures that were nothing but yesterday's
   arithmetic. COMPANY_FILE is already deleted for exactly this reason; the
   profile behind it was missed. */
const USER_DATA = path.join(app.getPath('temp'), 'hll-smoke-live-run');
fs.rmSync(USER_DATA, { recursive: true, force: true });
app.setPath('userData', USER_DATA);
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const steps = [];
let problems = 0;
const say = (k, v) => steps.push(k + ': ' + v);
const check = (k, ok, v) => { steps.push((ok ? '  ' : '! ') + k + ': ' + v); if (!ok) problems++; };
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Wait for a condition, not for a duration.

   A fixed sleep is a guess about how fast this machine is, and the guess
   was wrong here: delivering a load takes the client a moment longer than
   the 3s it was given, so the run was read while it was still open and four
   checks failed on a race rather than on behaviour. Polling turns the slow
   case into a slower pass instead of a false failure, and leaves the
   genuinely broken case failing on the timeout. */
const until = async (win, expr, ms = 20000, step = 250) => {
  const deadline = Date.now() + ms;
  for (;;) {
    let ok = false;
    try {
      ok = await win.webContents.executeJavaScript('(() => !!(' + expr + '))()');
    } catch (e) { ok = false; }
    if (ok) return true;
    if (Date.now() >= deadline) return false;
    await wait(step);
  }
};

/* ---- the fake game ----
   The same payload shape the community telemetry server produces. `truck`
   is mutable, so the test can take a job, drive, and deliver. */
const truck = {
  running: true,
  paused: false,
  speed: 0,
  odometer: 100000,
  x: 0, z: 0,
  job: null,
};

function telemetryPayload() {
  return {
    game: { connected: truck.running, paused: truck.paused, gameName: 'ETS2' },
    truck: {
      make: 'Scania', model: 'S 730',
      speed: truck.speed,
      odometer: truck.odometer,
      fuel: 600, fuelCapacity: 1000,
      wearEngine: 0.01, wearTransmission: 0, wearCabin: 0, wearChassis: 0, wearWheels: 0,
      placement: { x: truck.x, y: 0, z: truck.z, heading: 0.25 },
    },
    job: truck.job ? {
      cargo: truck.job.cargo, income: truck.job.income,
      sourceCity: truck.job.from, destinationCity: truck.job.to,
      sourceCompany: 'Euroacres', destinationCompany: 'Posped',
    } : {},
    navigation: {
      estimatedDistance: truck.job ? truck.job.remainingM : 0,
      speedLimit: 90,
    },
  };
}

const game = http.createServer((req, res) => {
  res.writeHead(200, {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Cache-Control': 'no-store',
  });
  res.end(JSON.stringify(telemetryPayload()));
});

/* open a window with its own storage — one window is one machine */
async function open(loader, partition) {
  const win = new BrowserWindow({
    width: 1300, height: 900, show: false,
    webPreferences: { partition },
  });
  await loader(win);
  await wait(2000);
  return win;
}

app.whenReady().then(async () => {
  try { fs.unlinkSync(COMPANY_FILE); } catch (e) { /* first run */ }

  const built = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-www.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1', HLL_SITE_OUT: SITE_OUT, HLL_APP_OUT: APP_OUT,
    }),
    encoding: 'utf8',
  });
  if (built.status !== 0) {
    console.log('could not build the site: ' + (built.stderr || built.error));
    app.exit(1);
    return;
  }

  game.listen(GAME_PORT, '127.0.0.1');

  const server = spawn(process.execPath, [path.join(ROOT, 'fleet-server.js'), '--port', String(FLEET_PORT)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1',
      HLL_COMPANY_FILE: COMPANY_FILE,
      HLL_SITE_DIR: SITE_OUT,
    }),
    stdio: 'ignore',
  });
  await wait(1500);

  const base = 'http://localhost:' + FLEET_PORT;

  try {
    /* ---- the driver's machine ---- */
    const driver = await open(
      (w) => w.loadFile(path.join(ROOT, 'tracker.html')), 'persist:live-driver');

    const setup = await driver.webContents.executeJavaScript(`(async () => {
      const R = {};
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const acc = Auth.accounts().find(a => a.email === 'jeffboss730@gmail.com');
      Auth.signIn(acc, Auth.driverRecord(acc.driverId), false);

      /* point the client at the fake game and the real service */
      const s = Store.db.settings;
      s.telemetryHost = '127.0.0.1';
      s.telemetryPort = '${GAME_PORT}';
      s.liveTelemetry = true;
      s.pollRate = 300;
      s.fleetUrl = '${base}';
      s.heartbeatSec = 5;
      Store.save();

      Telemetry.start();
      Fleet.start();
      Sync.start();
      state.view = 'dashboard';
      render();
      await wait(2500);

      R.id = Store.db.driver.hllId;
      R.name = Store.db.driver.name;
      R.telemetry = Telemetry.mode;
      R.stream = Realtime.status;

      /* the game coming up should have opened a sitting on the record */
      const open = Sessions.current();
      R.session = open ? { id: open.id, game: open.game, ended: open.ended } : null;

      const me = (Auth.hqDb().drivers || []).find(x => x.id === R.id);
      R.earnedBefore = me ? (me.earned || 0) : null;
      R.deliveriesBefore = me ? (me.deliveries || 0) : null;
      return R;
    })()`);

    say('driver signed in', setup.id);
    check('the client reads the game', setup.telemetry === 'live', setup.telemetry);
    check('the client holds the live stream open', setup.stream === 'live', setup.stream);
    check('the game coming up opens a session', !!setup.session,
      setup.session ? setup.session.id + ' on ' + setup.session.game : 'NO SESSION');

    /* ---- the dispatcher's machine, a different browser profile ---- */
    const console2 = await open((w) => w.loadURL(base + '/admin.html'), 'persist:live-console');
    /* The console watches the fleet whoever is looking at it, so this needs no
       sign-in — bringing the live map up is what opens the stream, and being
       served from the service is what tells it where to open it to. */
    await console2.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      LiveMap.start();
      await wait(2500);
      return true;
    })()`);

    const hqUp = await console2.webContents.executeJavaScript(
      `({ stream: HQLive.status, service: LiveMap.service() })`);
    check('the console holds the same stream open', hqUp.stream === 'live', hqUp.stream);

    /* ---- the game hands out a job ---- */
    truck.job = { cargo: 'Steel coils', income: 4200, from: 'Rotterdam', to: 'Hamburg',
                  remainingM: 480000 };
    truck.speed = 85;
    /* The client polls telemetry every 300ms and opens the run when it
       sees the job. 2.5s of sleep was usually enough and occasionally
       not, which showed up as this whole test failing intermittently on
       NO RUN with every later check cascading off it. */
    await until(driver, 'Store.db.job');

    const started = await driver.webContents.executeJavaScript(`(() => {
      const j = Store.db.job;
      return j ? { from: j.from, to: j.to, cargo: j.cargo, km: j.km,
                   live: j.live, events: (j.events || []).map(e => e.text) } : null;
    })()`);
    check('taking a job in game starts the run', !!started,
      started ? started.from + ' -> ' + started.to : 'NO RUN');
    check('the run knows how far it is', !!started && started.km === 480,
      started ? started.km + ' km' : '-');
    check('the run opens its own timeline', !!started && started.events.length > 0,
      started ? (started.events[0] || 'none') : '-');

    /* did it reach the dispatcher, without either side polling for it? */
    const seen = await console2.webContents.executeJavaScript(`(() => {
      const d = LiveMap.drivers.find(x => x.id === ${JSON.stringify(setup.id)});
      return {
        found: !!d,
        job: d && d.job ? d.job.from + ' -> ' + d.job.to : null,
        cargo: d && d.job ? d.job.cargo : null,
        events: HQLive.events.map(e => e.kind),
      };
    })()`);
    check('the run reaches the console live', seen.found && !!seen.job, seen.job || 'NOT SEEN');
    check('with the cargo on it', seen.cargo === 'Steel coils', seen.cargo || '-');
    check('and it is announced as an event', seen.events.includes('job.start'),
      seen.events.join(',') || 'none');

    /* ---- drive it half way ---- */
    truck.job.remainingM = 240000;
    truck.odometer += 240;
    await until(driver, 'Store.db.job && Math.round(GameLink.progress(Store.db.job)) === 50');

    const half = await driver.webContents.executeJavaScript(`(() => {
      const j = Store.db.job;
      return { pct: Math.round(GameLink.progress(j)), driven: Math.round(j.drivenKm),
               eta: JobTracker.etaMinutes(j), avg: j.avgSpeed,
               events: (j.events || []).map(e => e.text) };
    })()`);
    check('progress follows the game', half.pct === 50, half.pct + '%');
    check('it works out an arrival time', half.eta != null && half.eta > 0,
      half.eta == null ? 'none' : Math.round(half.eta) + ' min');
    check('from an average speed, not the speed of the moment',
      half.avg > 0, (half.avg || 0) + ' km/h');
    check('the halfway mark goes on the timeline',
      half.events.some((t) => /50%/.test(t)), half.events.join(' | '));

    const moved = await console2.webContents.executeJavaScript(`(() => {
      const d = LiveMap.drivers.find(x => x.id === ${JSON.stringify(setup.id)});
      return d && d.job ? Math.round(d.job.progress) : null;
    })()`);
    check('the console sees the progress move', moved === 50, moved + '%');

    /* ---- deliver it ---- */
    truck.job = null;
    truck.speed = 0;
    await until(driver,
      'Store.db.job === null && Store.db.pending.length > 0');
    await until(console2,
      "HQLive.events.some(e => e.kind === 'job.delivered')");

    const done = await driver.webContents.executeJavaScript(`(() => ({
      job: Store.db.job,
      queued: Store.db.pending.length,
      last: Store.db.pending[Store.db.pending.length - 1] || null,
    }))()`);
    check('delivering in game closes the run', done.job === null,
      done.job ? 'still open' : 'closed');
    check('and queues it for submission', done.queued > 0, done.queued + ' queued');
    check('the finished run keeps its timeline',
      !!done.last && (done.last.events || []).length > 0,
      done.last ? (done.last.events || []).length + ' entries' : '-');

    const told = await console2.webContents.executeJavaScript(
      `HQLive.events.filter(e => e.kind === 'job.delivered').map(e => e.text)`);
    check('the delivery announces itself to the console', told.length > 0,
      told[0] || 'NOT ANNOUNCED');

    /* ---- the money and the session ---- */
    const banked = await driver.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const id = Store.db.driver.hllId;
      /* the run is queued; submitting is what credits the company */
      const rec = Store.db.pending[Store.db.pending.length - 1];
      Store.db.conn.hll = 'connected';
      submitDelivery(rec.id, true);
      await wait(500);
      const hq = Auth.hqDb();
      const me = (hq.drivers || []).find(x => x.id === id);
      const job = (hq.jobs || []).find(j => j.id === rec.id);
      const ses = (hq.sessions || []).find(s => s.driverId === id && !s.ended);
      return {
        earned: me ? me.earned : null,
        deliveries: me ? me.deliveries : null,
        job: job ? { from: job.from, to: job.to, cargo: job.cargo, km: job.km,
                     income: job.income, status: job.status,
                     started: !!job.started, finished: !!job.finished } : null,
        session: ses ? { jobs: ses.jobs, km: ses.km, earned: ses.earned } : null,
      };
    })()`);

    check('the run is written to the company record', !!banked.job,
      banked.job ? banked.job.from + ' -> ' + banked.job.to : 'NOT RECORDED');
    check('with every detail the console reports on',
      !!banked.job && banked.job.cargo === 'Steel coils' && banked.job.km === 480
        && banked.job.income === 4200 && banked.job.status === 'delivered'
        && banked.job.started && banked.job.finished,
      banked.job ? banked.job.cargo + ', ' + banked.job.km + ' km, '
        + banked.job.income + ', ' + banked.job.status : '-');
    check('the money lands on the driver record',
      banked.earned === (setup.earnedBefore || 0) + 4200,
      (setup.earnedBefore || 0) + ' -> ' + banked.earned);
    check('the delivery is counted',
      banked.deliveries === (setup.deliveriesBefore || 0) + 1,
      (setup.deliveriesBefore || 0) + ' -> ' + banked.deliveries);
    check('the sitting takes the credit too',
      !!banked.session && banked.session.jobs === 1 && banked.session.earned === 4200,
      banked.session ? banked.session.jobs + ' run, ' + banked.session.earned : 'NO SESSION');

    /* ---- the game closes ---- */
    await new Promise((done) => game.close(done));
    await until(driver, 'GameWatch.running === false && !Sessions.current()');

    const closed = await driver.webContents.executeJavaScript(`(() => {
      const id = Store.db.driver.hllId;
      const hq = Auth.hqDb();
      const ses = (hq.sessions || []).filter(s => s.driverId === id)
        .sort((a, b) => new Date(b.started) - new Date(a.started))[0];
      return {
        running: GameWatch.running,
        open: !!Sessions.current(),
        session: ses ? { ended: !!ses.ended, minutes: ses.minutes,
                         jobs: ses.jobs, earned: ses.earned } : null,
      };
    })()`);

    check('the game going away is noticed', closed.running === false,
      closed.running ? 'still running' : 'closed');
    check('the session is closed off', !!closed.session && closed.session.ended,
      closed.session && closed.session.ended ? 'ended' : 'STILL OPEN');
    check('and keeps what was done in it',
      !!closed.session && closed.session.jobs === 1 && closed.session.earned === 4200,
      closed.session ? closed.session.jobs + ' run, ' + closed.session.earned : '-');
    check('no session is left hanging', closed.open === false,
      closed.open ? 'one still open' : 'none open');

  } catch (e) {
    problems++;
    say('ERROR', e.message);
  }

  console.log('\nA run, from the game to everybody\'s screen\n');
  steps.forEach((s) => console.log('  ' + s));
  console.log('\n' + (problems ? problems + ' problem(s)\n' : 'all good\n'));

  try { server.kill(); } catch (e) {}
  try { if (game.listening) game.close(); } catch (e) {}
  try { fs.unlinkSync(COMPANY_FILE); } catch (e) {}
  fs.rmSync(SITE_OUT, { recursive: true, force: true });
  fs.rmSync(APP_OUT, { recursive: true, force: true });
  app.exit(problems ? 1 : 0);
});
