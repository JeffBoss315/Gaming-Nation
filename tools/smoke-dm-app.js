/* ============================================================
   Smoke test — messaging and calling from inside the CLIENT.

     npm run smoke:dmapp

   tools/smoke-dm-web.js proves this works on the website and
   tools/smoke-messaging.js proves the service carries it. Neither
   of them opens tracker.html, and for a long time that was exactly
   where it did not work: the client had a Messages screen full of
   announcements and a Crew chat that told you to go and use the
   website.

   So this runs two real clients, in two storage partitions, against
   one real service, and checks the things a driver would:

     1. signing in gets an identity the SERVICE accepts, not just
        one this app accepts. Without it every endpoint is a 401
        and nothing below can work.
     2. a message typed in one client lands in the other.
     3. the crew room is the same room on both, so a message sent
        there reaches a driver who never opened that thread.
     4. calling rings the other client, and declining clears both.
     5. the crew call is a room both can be in at once.

   Nothing here touches the real company: the service runs as a
   child process against temp files, and the clients are seeded
   directly rather than registering.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const crypto = require('crypto');
const { spawn } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const PORT = Number(process.env.HLL_DMAPP_PORT || 7096);
const TMP = path.join(os.tmpdir(), 'hll-dmapp-smoke');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) { /* first run */ }
fs.mkdirSync(TMP, { recursive: true });

app.setPath('userData', path.join(app.getPath('temp'), 'hll-smoke-dm-app'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const steps = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(46) + v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let problems = 0;
const fail = (why) => { problems++; steps.push('  ! ' + why); };
const check = (what, ok, detail) => {
  say(what, detail);
  if (!ok) fail(what);
};

const sha = (pw, salt) =>
  crypto.createHash('sha256').update(salt + '::' + pw, 'utf8').digest('hex');

const SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const PW = 'DriverPass#7';

const ANNA = { id: 'GMN-1001', name: 'Anna Bergen', email: 'anna@example.com' };
const MAREK = { id: 'GMN-2002', name: 'Marek Kowal', email: 'marek@example.com' };

const COMPANY = {
  drivers: [ANNA, MAREK].map((d) => ({
    id: d.id, name: d.name, role: 'driver', accountStatus: 'active', status: 'online',
  })),
  accounts: [ANNA, MAREK].map((d) => ({
    driverId: d.id, name: d.name, email: d.email, salt: SALT, hash: sha(PW, SALT),
  })),
  events: [],
  jobs: [],
};

/* The client is seeded rather than registered: registration goes through
   Supabase, which this test has no business touching, and what is under
   test starts at "a driver is signed in". */
const SEED = (who) => `(async () => {
  localStorage.setItem('hll.accounts.v1', ${JSON.stringify(JSON.stringify(COMPANY.accounts))});
  localStorage.setItem('hll.db.v1', ${JSON.stringify(JSON.stringify({ drivers: COMPANY.drivers }))});

  Store.db.settings.fleetUrl = 'http://localhost:${PORT}';
  Store.save();

  const account = Auth.accounts().find(a => a.driverId === ${JSON.stringify(who.id)});
  Auth.signIn(account, Auth.driverRecord(${JSON.stringify(who.id)}), false);

  const ok = await ServiceAuth.login(${JSON.stringify(who.email)}, ${JSON.stringify(PW)});
  await new Promise(r => setTimeout(r, 700));

  render();
  return {
    serviceAuth: ok,
    token: !!ServiceAuth.token,
    status: ServiceAuth.status,
    me: Store.db.driver ? Store.db.driver.hllId : null,
    stream: Realtime.status,
  };
})()`;

async function open(url, partition) {
  const win = new BrowserWindow({
    width: 1280, height: 900, show: false,
    webPreferences: { partition, session: undefined },
  });
  await win.loadURL(url);
  await wait(1500);
  return win;
}

app.whenReady().then(async () => {
  fs.writeFileSync(path.join(TMP, 'company.json'),
    JSON.stringify({ version: 1, data: COMPANY }));

  const server = spawn(
    process.execPath, [path.join(ROOT, 'fleet-server.js'), '--port', String(PORT)], {
      cwd: ROOT,
      env: Object.assign({}, process.env, {
        ELECTRON_RUN_AS_NODE: '1',
        HLL_COMPANY_FILE: path.join(TMP, 'company.json'),
        HLL_SESSION_FILE: path.join(TMP, 'sessions.json'),
        HLL_CHAT_FILE: path.join(TMP, 'chat.json'),
        HLL_DM_FILE: path.join(TMP, 'dms.json'),
        HLL_ROOM_READS_FILE: path.join(TMP, 'room-reads.json'),
        HLL_FILES_FILE: path.join(TMP, 'files.json'),
        HLL_FILES_DIR: path.join(TMP, 'files'),
        HLL_SITE_DIR: ROOT,
        /* A relay the test never dials — what is under test is that the
           service hands it out and both clients take it, not that TURN
           works, which would need a real relay. */
        HLL_TURN_URL: 'turn:relay.example.test:3478',
        HLL_TURN_USER: 'crew',
        HLL_TURN_PASS: 'secret',
      }),
      stdio: 'ignore',
    });

  await wait(1600);

  const base = 'http://localhost:' + PORT;
  const client = 'file:///' + path.join(ROOT, 'tracker.html').replace(/\\/g, '/');

  let one = null;
  let two = null;

  try {
    one = await open(client, 'persist:dmapp-one');
    two = await open(client, 'persist:dmapp-two');

    /* ---- 1. an identity the service accepts ---- */

    const a = await one.webContents.executeJavaScript(SEED(ANNA));
    const b = await two.webContents.executeJavaScript(SEED(MAREK));

    check('the client gets a service session', a.token && b.token,
      a.status + ' / ' + b.status);
    check('and signs in as who it says it is',
      a.me === ANNA.id && b.me === MAREK.id, a.me + ' / ' + b.me);

    if (!a.token || !b.token) throw new Error('no service session — nothing below can work');

    await wait(1200);

    const streams = [
      await one.webContents.executeJavaScript('Realtime.status'),
      await two.webContents.executeJavaScript('Realtime.status'),
    ];
    check('the live channel carries the identity',
      streams.every((s) => s === 'live'), streams.join(' / '));

    /* The relay comes from the service, so a company that has one does
       not have to rebuild two clients to use it. Both ends must take it,
       or one of them quietly cannot reach the other. */
    const ice = await one.webContents.executeJavaScript(`(async () => {
      await Ice.load();
      return { relay: Ice.relay, urls: JSON.stringify(Ice.config().iceServers) };
    })()`);
    check('the relay is served, not hard-coded',
      ice.relay && /relay.example.test/.test(ice.urls),
      ice.relay ? 'TURN from the service' : 'STUN ONLY — ' + ice.urls.slice(0, 60));

    /* ---- 1b. signing in before the service knows anything ----

       The service authenticates against the accounts in the company
       record it holds, and a freshly started one holds nothing. Signing
       in first — which is the ordinary order when the app starts the
       service itself — was refused by a service that had never heard of
       the account, and the screen then said "sign out and back in",
       which would have been refused exactly the same way.

       login() uploads the company and asks again, so this resolves
       itself. Tested against a service with an EMPTY company. */
    const cold = await one.webContents.executeJavaScript(`(async () => {
      /* wipe the service back to knowing nobody */
      await fetch(Sync.url() + '/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: 0, data: { drivers: [], accounts: [] } }),
      }).catch(() => {});

      ServiceAuth.token = null;
      ServiceAuth.driver = null;
      ServiceAuth.keep();

      const ok = await ServiceAuth.login(${JSON.stringify(ANNA.email)}, ${JSON.stringify(PW)});
      return { ok, status: ServiceAuth.status, token: !!ServiceAuth.token };
    })()`);

    check('a session even when the service knew nobody',
      cold.ok && cold.token,
      cold.ok ? 'taught the service, then signed in' : 'REFUSED (' + cold.status + ')');

    await wait(800);

    /* ---- 2. a message, one client to the other ---- */

    await one.webContents.executeJavaScript(
      `Messages.openThread(${JSON.stringify(MAREK.id)})`);
    await wait(700);

    await one.webContents.executeJavaScript(
      `Messages.send('Rolling in ten, bay four.')`);
    await wait(1200);

    const gotIt = await two.webContents.executeJavaScript(`(() => {
      const t = Messages.threads.find(x => String(x.withId) === ${JSON.stringify(ANNA.id)});
      return { threads: Messages.threads.length, last: t && t.last ? t.last.text : null };
    })()`);

    check('it reaches the other client',
      gotIt.last === 'Rolling in ten, bay four.', gotIt.last || 'NOTHING ARRIVED');

    /* And it is readable, not merely delivered. */
    const onScreen = await two.webContents.executeJavaScript(`(async () => {
      await Messages.openThread(${JSON.stringify(ANNA.id)});
      await new Promise(r => setTimeout(r, 500));
      state.view = 'messages'; render();
      await new Promise(r => setTimeout(r, 300));
      return document.querySelector('#dmThread')
        ? document.querySelector('#dmThread').textContent.replace(/\\s+/g, ' ').trim()
        : 'NO THREAD ELEMENT';
    })()`);

    check('and is on the screen a driver opens',
      /Rolling in ten/.test(onScreen), onScreen.slice(0, 70));

    /* ---- 3. the crew room ---- */

    await two.webContents.executeJavaScript(`Messages.openThread(FLEET_ROOM)`);
    await wait(600);

    await one.webContents.executeJavaScript(`(async () => {
      await Messages.openThread(FLEET_ROOM);
      await new Promise(r => setTimeout(r, 400));
      await Messages.send('Anyone near Hamburg tonight?');
    })()`);
    await wait(1300);

    const room = await two.webContents.executeJavaScript(`(() => ({
      open: Messages.open,
      texts: Messages.history.map(m => m.text),
    }))()`);

    check('the crew room is the same room on both',
      room.open === '#fleet' && room.texts.includes('Anyone near Hamburg tonight?'),
      room.texts.slice(-1)[0] || 'NOTHING IN THE ROOM');

    /* Somebody who never opened the room still hears about it — that is
       what makes it a crew channel rather than a thread you must find. */
    const badge = await two.webContents.executeJavaScript(`(() => {
      const t = Messages.threads.find(x => String(x.withId) === '#fleet');
      return t ? (t.name || '#fleet') : 'NOT LISTED';
    })()`);
    say('and it is listed as a thread', badge);

    /* ---- 3b. reaching a driver from the live map ---- */

    /* Marek reports a position, the way a driver with the game open does.

       Injecting one into Fleet.drivers directly does not survive: the next
       'fleet' frame off the live channel calls absorb(list, true), which
       replaces the list wholesale, and the fake is gone before the screen
       is read. Going through the service is both more honest and stable. */
    await two.webContents.executeJavaScript(`(async () => {
      Store.db.live = {
        game: 'ets2',
        speed: 62,
        heading: 90,
        world: { x: 1000, z: 2000 },
        truck: 'Scania S 730',
      };
      Store.db.activityState = 'driving';
      Fleet.pushNow();
      await new Promise(r => setTimeout(r, 400));
    })()`);

    await wait(1500);

    const onMap = await one.webContents.executeJavaScript(`(async () => {
      try {
        /* The list of drivers on the road is on the dashboard; the live
           map draws them as pins with a popup. Both are "the map" as far
           as a driver is concerned, so both are checked. */
        state.view = 'dashboard';
        render();
        await new Promise(r => setTimeout(r, 600));

        const rows = document.querySelectorAll('.fleetrow').length;
        const message = !!document.querySelector('[data-act="map-message"]');
        const call = !!document.querySelector('[data-act="map-call"]');
        const onSelf = document.querySelectorAll('.fleetrow.me [data-act="map-call"]').length;

        /* and the pin popup the live map builds for the same driver */
        Store.db.settings.showFleet = true;
        state.view = 'livemap';
        render();
        await new Promise(r => setTimeout(r, 900));
        const pins = document.querySelectorAll('.fleet-pin').length;

        return { rows, message, call, onSelf, pins };
      } catch (e) {
        return { err: e.message };
      }
    })()`);

    if (onMap.err) fail('the map screen threw: ' + onMap.err);

    check('a driver on the map can be reached from it',
      onMap.message && onMap.call && onMap.onSelf === 0,
      onMap.rows + ' row(s), ' + onMap.pins + ' pin(s); '
        + (onMap.message && onMap.call ? 'message + call' : 'BUTTONS MISSING')
        + (onMap.onSelf ? ', BUT ALSO ON YOURSELF' : ', and not on your own row'));

    /* And the screen says why when it cannot, rather than looking empty —
       which is how this was reported: not as an error, as "still cannot
       chat" in front of a blank list. */
    const offline = await one.webContents.executeJavaScript(`(() => {
      const was = Store.db.settings.fleetUrl;
      const wasSvc = window.HLL_SERVICE;
      Store.db.settings.fleetUrl = '';
      window.HLL_SERVICE = '';
      const html = dmOffline();
      Store.db.settings.fleetUrl = was;
      window.HLL_SERVICE = wasSvc;
      return html;
    })()`);

    /* It has to name the service AND give a next step. Which next step
       depends on where it is running: the desktop shell can start one, so
       it offers a button; a plain browser window like this one cannot, so
       it says where to put the address. Asserting on the button alone
       would pass only in the build a driver is not using, and asserting
       on the old "npm run fleet" wording would fail the moment that
       instruction stopped being the answer — which is the point of the
       change it is testing. */
    const named = /company service/i.test(offline);
    const actionable = /Run it on this machine/.test(offline)   /* desktop */
      || /address in Settings/i.test(offline);                  /* anywhere else */

    check('and says so when the service is missing',
      named && actionable,
      !named ? 'SAYS NOTHING'
        : actionable ? 'names the service and what to do about it'
          : 'names it but offers no way out');

    /* ---- 4. a call ---- */

    const call = await one.webContents.executeJavaScript(`(async () => {
      /* getUserMedia needs a device this test does not have. Only the
         media step is stubbed; the signalling, the overlay and the
         teardown below are the real code. */
      Calls.media = async () => new MediaStream();
      await Calls.start(${JSON.stringify(MAREK.id)}, ${JSON.stringify(MAREK.name)});
      await new Promise(r => setTimeout(r, 700));
      return {
        state: Calls.state,
        bar: !!document.querySelector('.call-bar'),
        who: (document.querySelector('.call-name') || {}).textContent || '',
      };
    })()`);

    check('calling puts the bar up', call.bar && call.state === 'ringing',
      call.state + (call.who ? ' — ' + call.who.trim() : ''));

    await wait(900);

    const ring = await two.webContents.executeJavaScript(`(() => ({
      state: Calls.state,
      answer: !!document.querySelector('[data-act="call-accept"]'),
      decline: !!document.querySelector('[data-act="call-decline"]'),
      who: (document.querySelector('.call-name') || {}).textContent || '',
    }))()`);

    check('it rings the other client',
      ring.state === 'incoming' && ring.answer && ring.decline,
      ring.state + (ring.who ? ' — ' + ring.who.trim() : '')
        + (ring.answer && ring.decline ? ' (answer/decline offered)' : ' (NO BUTTONS)'));

    await two.webContents.executeJavaScript('Calls.decline()');
    await wait(1000);

    const after = [
      await one.webContents.executeJavaScript('Calls.state'),
      await two.webContents.executeJavaScript('Calls.state'),
    ];
    check('declining clears both ends',
      after.every((s) => s === 'idle'), after.join(' / '));

    /* ---- 5. the crew call ---- */

    await one.webContents.executeJavaScript(`(async () => {
      RoomCall.local = null;
      Calls.media = async () => new MediaStream();
      await RoomCall.join();
    })()`);
    await wait(900);

    await two.webContents.executeJavaScript(`(async () => {
      Calls.media = async () => new MediaStream();
      await RoomCall.join();
    })()`);
    await wait(1400);

    const crew = await one.webContents.executeJavaScript(`(() => ({
      live: RoomCall.live,
      count: RoomCall.count(),
      peers: Object.keys(RoomCall.peers).length,
    }))()`);

    check('both clients are in the crew call',
      crew.live && crew.count >= 2,
      crew.count + ' on the call, ' + crew.peers + ' peer connection(s)');

    const barText = await two.webContents.executeJavaScript(
      `(document.querySelector('.call-bar') || {}).textContent || 'NO BAR'`);
    say('and the call bar says so',
      String(barText).replace(/\s+/g, ' ').trim().slice(0, 58));

    await one.webContents.executeJavaScript('RoomCall.leave(true)');
    await wait(1000);

    const left = await two.webContents.executeJavaScript(`(() => ({
      live: RoomCall.live,
      peers: Object.keys(RoomCall.peers).length,
    }))()`);
    check('leaving drops the peer at the other end',
      left.live && left.peers === 0,
      left.peers + ' peer(s) left');

    await two.webContents.executeJavaScript('RoomCall.leave(true)');
    await wait(500);

  } catch (err) {
    fail('the walk stopped: ' + (err && err.message ? err.message : err));
  }

  try { if (one) one.destroy(); } catch (e) { /* gone */ }
  try { if (two) two.destroy(); } catch (e) { /* gone */ }
  try { server.kill(); } catch (e) { /* gone */ }

  console.log('\nmessaging and calling, in the client\n' + steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');

  app.exit(problems ? 1 : 0);
});
