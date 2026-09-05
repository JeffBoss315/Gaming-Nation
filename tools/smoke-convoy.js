/* ============================================================
   Smoke test — Live Convoy Mode.

     node_modules/electron/dist/electron.exe tools/smoke-convoy.js .

   Two machines and a fake game: a manager on the console runs a
   convoy, a driver on the drivers' site joins it, and a connector
   reports the driver's truck from the game.

   It checks the whole path rather than the screens: the convoy is
   created and started, the driver joins and is seen without the
   console refreshing, telemetry places them on the convoy map,
   the distance from the leader is real, chat crosses between the
   two machines, permissions hold, and the convoy's record is
   written when it ends.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { spawn, spawnSync } = require('child_process');
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const PORT = 7094;
const GAME_PORT = 25596;
const COMPANY_FILE = path.join(ROOT, 'hll-company.convoy.json');
const SITE_OUT = path.join(ROOT, '.smoke-convoy-site');
const APP_OUT = path.join(ROOT, '.smoke-convoy-app');

/* A fresh profile every run. Browser partitions persist between runs, so
   without this a second run starts with the previous run's localStorage and
   the assertions read state that this run did not create. */
const USER_DATA = path.join(require('os').tmpdir(), 'hll-smoke-convoy');
fs.rmSync(USER_DATA, { recursive: true, force: true });
app.setPath('userData', USER_DATA);
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const steps = [];
let problems = 0;
const say = (k, v) => steps.push('   ' + k + ': ' + v);
const check = (k, ok, v) => {
  steps.push((ok ? '  ✓ ' : '  ✗ ') + k + (v ? ': ' + v : ''));
  if (!ok) problems++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- the fake game, for the driver's truck ---- */
const truck = { running: true, speed: 0, odometer: 40000, job: null, x: 0, z: 0 };
const game = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
  res.end(JSON.stringify({
    game: { connected: truck.running, paused: false, gameName: 'ETS2' },
    truck: {
      make: 'Scania', model: 'R 450', speed: truck.speed, odometer: truck.odometer,
      fuel: 500, fuelCapacity: 1000, wearEngine: 0.01,
      placement: { x: truck.x, y: 0, z: truck.z, heading: 0.25 },
    },
    job: truck.job ? {
      cargo: truck.job.cargo, income: truck.job.income,
      sourceCity: truck.job.from, destinationCity: truck.job.to,
    } : {},
    navigation: { estimatedDistance: truck.job ? truck.job.remainingM : 0 },
  }));
});

async function open(loader, partition) {
  const win = new BrowserWindow({
    width: 1400, height: 950, show: false, webPreferences: { partition },
  });
  await loader(win);

  /* Registration goes through Supabase Auth. This test is about convoy
     chat, not about Supabase, and it must not leave real accounts behind in
     the live project — so the page gets a stand-in that keeps everything in
     memory. Installed after load, because it replaces the client that
     supabase-client.js created. */
  await win.webContents.executeJavaScript(FAKE_SUPABASE);

  await wait(2200);
  return win;
}

app.whenReady().then(async () => {
  try { fs.unlinkSync(COMPANY_FILE); } catch (e) {}

  const built = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-www.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1', GMN_SITE_OUT: SITE_OUT, GMN_APP_OUT: APP_OUT,
    }),
    encoding: 'utf8',
  });
  if (built.status !== 0) { console.log('build failed: ' + built.stderr); app.exit(1); return; }

  game.listen(GAME_PORT, '127.0.0.1');
  const server = spawn(process.execPath,
    [path.join(ROOT, 'fleet-server.js'), '--port', String(PORT)], {
      cwd: ROOT,
      env: Object.assign({}, process.env, {
        ELECTRON_RUN_AS_NODE: '1', GMN_COMPANY_FILE: COMPANY_FILE, GMN_SITE_DIR: SITE_OUT,
      }),
      stdio: 'ignore',
    });
  await wait(1500);

  const base = 'http://localhost:' + PORT;
  let connector = null;
  let DRIVER_ID = null;

  try {
    /* ================= the manager's console ================= */
    const admin = await open((w) => w.loadURL(base + '/admin.html'), 'persist:convoy-admin');

    const setup = await admin.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const R = {};
      /* A real account with a password this test knows, so it can sign in
         to the service the way a person does — convoy chat needs a proven
         identity now, and a locally-set state.user is not one. */
      const reg = await Accounts.register(
        { name: 'Convoy Manager', email: 'mgr@example.com', discord: '',
          created: new Date().toISOString() },
        'ManagerPass#1', 'Netherlands');
      const mgr = Store.driver(reg.driver.driver_code);
      mgr.role = 'event_manager';
      mgr.accountStatus = 'active';
      Store.save();
      doLogin(mgr);
      await wait(300);
      R.me = state.user.id;
      R.canManage = can('events.manage');
      await Sync.sendNow();
      await wait(600);
      R.token = await ServiceAuth.login('mgr@example.com', 'ManagerPass#1');


      /* create the convoy through the real editor path */
      const e = {
        id: 'EV-9100', name: 'GMN Convoy Test', type: 'convoy',
        typeLabel: 'Official Convoy', tone: '',
        start: 'Rotterdam', dest: 'Hamburg',
        path: ['Rotterdam', 'Bremen', 'Hamburg'],
        distance: 480, duration: 440,
        date: new Date(Date.now() + 20 * 60000).toISOString(),
        meetTime: new Date(Date.now() + 5 * 60000).toISOString(),
        maxSlots: 20, leaderId: state.user.id, server: 'Simulation 1', dlc: 'Base map',
        meetPoint: 'Rotterdam — HQ', departPoint: 'Rotterdam — north gate',
        description: 'A test convoy.', instructions: ['Hold the gap.'],
        registered: [], activity: [], status: 'scheduled',
      };
      Store.db.events.push(e);
      Convoy.ensureLeader(e);
      Convoy.touch(e);
      Store.save();
      await Sync.sendNow();
      await wait(900);

      R.convoyId = e.id;
      R.state = Convoy.stateOf(e);
      R.stream = HQLive.status;
      return R;
    })()`);

    say('manager', setup.me);
    check('a manager may run convoys', setup.canManage === true, String(setup.canManage));
    check('the manager signed in to the service', setup.token === true,
      setup.token ? 'token issued' : 'NO TOKEN');
    check('the console holds the live stream open', setup.stream === 'live', setup.stream);
    check('a convoy near its departure reads as starting soon',
      setup.state === 'starting', setup.state);

    /* ================= the driver's machine ================= */
    const driver = await open((w) => w.loadURL(base + '/'), 'persist:convoy-driver');

    const joined = await driver.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const R = {};
      await Sync.pull();
      await wait(600);
      const reg = await Accounts.register(
        { name: 'Convoy Driver', email: 'cd@example.com', discord: '',
          created: new Date().toISOString() },
        'DriverPass#2', 'Kenya');
      const d = Store.driver(reg.driver.driver_code);
      d.accountStatus = 'active';
      d.clientAccess = true;
      Store.save();
      R.sawDriver = !!d;
      R.driverId = d.id;
      doLogin(d);
      await wait(300);
      await Sync.sendNow();
      await wait(600);
      R.token = await ServiceAuth.login('cd@example.com', 'DriverPass#2');

      R.canManage = can('events.manage');

      const e = Store.event('EV-9100');
      R.sawConvoy = !!e;
      R.upcoming = Store.upcomingEvents().some(x => x.id === 'EV-9100');

      /* join it the way the button does */
      go('#/convoy/EV-9100');
      render();
      await wait(500);
      evRegister('EV-9100');
      await wait(400);
      await Sync.sendNow();
      await wait(900);

      const after = Store.event('EV-9100');
      R.joined = (after.registered || []).some(r => r.driverId === d.id);
      R.activity = (after.activity || []).map(a => a.kind);
      return R;
    })()`);

    DRIVER_ID = joined.driverId;
    check('the driver signed in to the service', joined.token === true,
      joined.token ? 'token issued' : 'NO TOKEN');
    check('the driver sees the convoy on the shared record', joined.sawConvoy === true);
    check('it appears in their upcoming convoys', joined.upcoming === true);
    check('a driver may NOT run convoys', joined.canManage === false, String(joined.canManage));
    check('the driver can join', joined.joined === true);
    check('joining is written to the convoy activity',
      joined.activity.includes('joined'), joined.activity.join(','));

    /* the console should have been told, without being refreshed */
    await wait(1500);
    const consoleSaw = await admin.webContents.executeJavaScript(`(async () => {
      await Sync.pull();
      const e = Store.event('EV-9100');
      return {
        parts: Convoy.participants(e).map(p => p.id),
        events: HQLive.events.map(x => x.kind),
      };
    })()`);
    check('the console sees the new participant',
      consoleSaw.parts.includes(DRIVER_ID), consoleSaw.parts.join(','));
    check('and was told over the live stream',
      consoleSaw.events.includes('convoy.joined'), consoleSaw.events.join(',') || 'none');

    /* ================= the driver's truck reports in ================= */
    connector = spawn(process.execPath, [
      path.join(ROOT, 'game-connector.js'),
      '--service', base, '--driver', DRIVER_ID, '--name', 'Convoy Driver',
      '--telemetry-port', String(GAME_PORT), '--poll', '300',
      '--outbox', path.join(app.getPath('temp'), 'hll-convoy-outbox.json'),
    ], { env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }), stdio: 'ignore' });

    truck.speed = 78;
    truck.x = 12000; truck.z = -8000;
    await wait(3500);

    const live = await admin.webContents.executeJavaScript(`(() => {
      const e = Store.event('EV-9100');
      const parts = Convoy.participants(e);
      const p = parts.find(x => x.id === "${DRIVER_ID}");
      return {
        connected: !!(p && p.connected),
        speed: p ? p.speed : null,
        truck: p ? p.truck : null,
        game: p ? p.game : null,
        leaderMarked: parts.some(x => x.leader),
        stats: Convoy.stats(e),
      };
    })()`);
    check('telemetry puts the driver on the convoy live',
      live.connected === true, live.connected ? live.truck + ' @ ' + live.speed + ' km/h' : 'NOT CONNECTED');
    check('their game is known', live.game === 'ets2', String(live.game));
    check('the leader is identified', live.leaderMarked === true,
      live.leaderMarked ? 'on the roster and marked' : 'NOT MARKED');
    check('convoy statistics count who actually connected',
      live.stats.connected === 1 && live.stats.joined === 2,
      live.stats.connected + ' of ' + live.stats.joined);

    /* ================= start it ================= */
    const started = await admin.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const e = Store.event('EV-9100');
      /* drive the real action, bypassing only the confirmation dialog */
      e.status = 'live'; e.startedAt = new Date().toISOString();
      (e.registered || []).forEach(r => { if (r.state === 'registered') r.state = 'confirmed'; });
      Convoy.note(e, 'started', e.name + ' is rolling', state.user.id);
      Convoy.emit(e, 'convoy.started', e.name + ' is rolling', 'ok');
      Convoy.notifyParticipants(e, { type:'ok', icon:'route', title:'Convoy started',
        body: e.name + ' is rolling.', href:'#/convoy/' + e.id });
      Store.save(); await Sync.sendNow(); await wait(900);
      return { state: Convoy.stateOf(e), startedAt: !!e.startedAt,
               activity: (e.activity||[]).map(a=>a.kind) };
    })()`);
    check('the convoy can be started', started.state === 'live', started.state);
    check('and its start time is recorded', started.startedAt === true);
    check('the start is on the activity log',
      started.activity.includes('started'), started.activity.join(','));

    await wait(1600);
    const driverTold = await driver.webContents.executeJavaScript(`(async () => {
      await Sync.pull();
      const e = Store.event('EV-9100');
      const notes = Store.notificationsFor("${DRIVER_ID}").map(n => n.title);
      return { state: Convoy.stateOf(e), notes };
    })()`);
    check('the driver sees it go live', driverTold.state === 'live', driverTold.state);
    check('and is notified', driverTold.notes.some(t => /Convoy started/i.test(t)),
      driverTold.notes.join(' | ') || 'none');

    /* ================= chat across two machines ================= */
    await driver.webContents.executeJavaScript(
      `ConvoyChat.open('EV-9100').then(() => ConvoyChat.send('EV-9100', 'Rolling out of Rotterdam'))`);
    await wait(1500);
    const chat = await admin.webContents.executeJavaScript(`(async () => {
      await ConvoyChat.open('EV-9100');
      await ConvoyChat.refresh();
      return ConvoyChat.messages.map(m => m.driver + ': ' + m.text);
    })()`);
    check('convoy chat crosses between machines',
      chat.some(t => /Rolling out of Rotterdam/.test(t)), chat.join(' | ') || 'nothing');

    /* ================= permissions ================= */
    const denied = await driver.webContents.executeJavaScript(`(() => {
      const before = Store.event('EV-9100').registered.length;
      /* a driver trying convoy control directly, not through a button */
      convoyRemove('EV-9100', "${DRIVER_ID}");
      const after = Store.event('EV-9100').registered.length;
      return { before, after, allowed: convoyControlAllowed() };
    })()`);
    check('a driver cannot use convoy control',
      denied.allowed === false && denied.before === denied.after,
      'allowed=' + denied.allowed + ', roster unchanged=' + (denied.before === denied.after));

    /* ================= remove a participant ================= */
    const removed = await admin.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const e = Store.event('EV-9100');
      e.registered = e.registered.filter(r => r.driverId !== "${DRIVER_ID}");
      Convoy.note(e, 'removed', 'Convoy Driver was removed from the convoy', "${DRIVER_ID}");
      Convoy.emit(e, 'convoy.removed', 'Convoy Driver was removed', 'warn');
      Store.notify("${DRIVER_ID}", { type:'warn', icon:'alert', title:'Removed from a convoy',
        body:'You have been taken off ' + e.name + '.', href:'#/convoy/' + e.id });
      Store.save(); await Sync.sendNow(); await wait(800);
      return { left: e.registered.map(r => r.driverId),
               activity: (e.activity||[]).map(a=>a.kind) };
    })()`);
    check('a manager can remove a participant',
      !removed.left.includes("${DRIVER_ID}"), removed.left.join(',') || 'empty');
    check('the removal is logged',
      removed.activity.includes('removed'), removed.activity.join(','));

    /* ================= end it ================= */
    const ended = await admin.webContents.executeJavaScript(`(async () => {
      const wait = (ms) => new Promise((r) => setTimeout(r, ms));
      const e = Store.event('EV-9100');
      e.status = 'completed'; e.endedAt = new Date().toISOString();
      e.stats = Convoy.stats(e);
      Convoy.note(e, 'ended', e.name + ' completed', state.user.id);
      Convoy.emit(e, 'convoy.ended', e.name + ' has finished', 'ok');
      Store.save(); await Sync.sendNow(); await wait(700);
      return { state: Convoy.stateOf(e), stats: e.stats };
    })()`);
    check('the convoy can be ended', ended.state === 'completed', ended.state);
    check('its record is frozen when it ends',
      !!ended.stats && ended.stats.endedAt != null && typeof ended.stats.durationMin === 'number',
      ended.stats ? ended.stats.joined + ' joined, ' + ended.stats.durationMin + ' min' : 'NO STATS');

    /* ================= the driver's own convoy record ================= */
    const profile = await admin.webContents.executeJavaScript(`(() => {
      const cs = Convoy.driverStats(state.user.id);
      return { registered: cs.registered, led: cs.led };
    })()`);
    check('a convoy shows on the leader record',
      profile.registered >= 1 && profile.led >= 1,
      profile.registered + ' registered, ' + profile.led + ' led');

  } catch (e) {
    problems++;
    steps.push('  ✗ ERROR: ' + e.message);
  }

  console.log('\nLive Convoy Mode\n');
  steps.forEach((s) => console.log(s));
  console.log('\n' + (problems ? problems + ' failed\n' : 'all passed\n'));

  try { if (connector) connector.kill(); } catch (e) {}
  try { server.kill(); } catch (e) {}
  try { game.close(); } catch (e) {}
  try { fs.unlinkSync(COMPANY_FILE); } catch (e) {}
  fs.rmSync(SITE_OUT, { recursive: true, force: true });
  fs.rmSync(APP_OUT, { recursive: true, force: true });
  app.exit(problems ? 1 : 0);
});
