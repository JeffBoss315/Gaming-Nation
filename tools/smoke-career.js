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

    /* ---- the face that goes on a Discord card ----
       It lives in two places and reading only one is a silent failure: the
       driver record is rebuilt on every sign-in and only carries a photo
       when the database has a column for one, which is why the app keeps
       its own copy under the driver's code. Reading record-only gave a
       driver with a photo on screen a faceless card. */
    const AVA = 'data:image/png;base64,iVBORw0KGgo=';
    const noPhoto = await run(`cardAvatar({ name: 'Jeff Boss', gmnId: 'GMN-001' })`);
    check('with no photo it draws the initials, not nothing',
      /^data:image\/png;base64,/.test(noPhoto) && noPhoto.length > 200,
      noPhoto ? 'a ' + Math.round(noPhoto.length / 1024) + ' KB PNG' : 'NOTHING');

    const kept = await run(`(() => {
      localStorage.setItem('gmn.trk.avatar.GMN-KEPT', ${JSON.stringify(AVA)});
      return cardAvatar({ name: 'Kept Driver', gmnId: 'GMN-KEPT' });
    })()`);
    check('a photo the app kept for itself is found', kept === AVA,
      kept === AVA ? 'read from the app’s own copy' : 'MISSED IT');

    const onRecord = await run(`cardAvatar({ name: 'R', gmnId: 'GMN-R', avatar: ${JSON.stringify(AVA)} })`);
    check('and one on the record is preferred', onRecord === AVA, 'record wins');

    const lan = await run(`cardAvatar({ name: 'L', gmnId: 'GMN-L',
      avatar: 'https://192.168.1.9:7040/files/a.png' })`);
    check('an address Discord cannot reach falls back to initials',
      lan.indexOf('data:image/png') === 0, 'drawn, not a broken link');

    /* ---- what the website knows about this driver ----
       The photo is set on the website and lives on the driver's Supabase
       row. The client read that row at SIGN-IN and never again - and a
       remembered sign-in never signs in, so a photo set after the last
       full sign-in never arrived. Which is everybody: you sign in, then
       you go and set a photo.

       Supabase is stubbed, so this never touches the real project. */
    /* A REAL 1x1 PNG. The made-up truncated string that stood here looked
       like a photo to every string check and decoded to nothing, which is
       exactly the failure the measured check below is for. */
    const PIC = 'data:image/png;base64,'
      + 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const sync = await run(`(async () => {
      /* A whole render happens inside refresh(), and the strip test above
         left a deliberately minimal live frame - enough for the strip,
         not enough for the map, which reads live.world.x. Cleared here
         rather than made complete: this section is about the profile. */
      Store.db.live = null; Store.db.job = null;
      Store.db.driver = Object.assign(Store.db.driver || {},
        { gmnId: 'GMN-TEST', name: 'Test Driver', authed: true, avatar: '', country: '' });

      let asked = null;
      window.gmnSupabase = {
        from(table) {
          return { select: () => ({ eq: (col, val) => {
            asked = table + '.' + col + '=' + val;
            return { maybeSingle: async () => ({ error: null, data: {
              driver_code: 'GMN-TEST', full_name: 'Test Driver',
              country: 'Kenya', avatar: ${JSON.stringify(PIC)},
            } }) };
          } }) };
        },
      };
      ProfileSync.at = 0;
      await ProfileSync.refresh(true);
      return { asked, avatar: Store.db.driver.avatar, country: Store.db.driver.country,
        kept: localStorage.getItem('gmn.trk.avatar.GMN-TEST') };
    })()`);
    check('it asks for this driver’s own row', sync.asked === 'drivers.driver_code=GMN-TEST',
      sync.asked || 'ASKED NOTHING');
    check('the photo set on the website arrives', sync.avatar === PIC,
      sync.avatar ? 'picked up' : 'STILL BLANK');
    check('and is kept where a sign-in cannot wipe it', sync.kept === PIC,
      sync.kept ? 'copied to the app’s own store' : 'NOT KEPT');
    check('the country comes with it', sync.country === 'Kenya', sync.country || 'blank');

    /* A failed read must not look like a driver who deleted their photo. */
    const held = await run(`(async () => {
      window.gmnSupabase = { from: () => ({ select: () => ({ eq: () => ({
        maybeSingle: async () => ({ error: { message: 'policy' }, data: null }),
      }) }) }) };
      ProfileSync.at = 0;
      await ProfileSync.refresh(true);
      return Store.db.driver.avatar;
    })()`);
    check('a refused read does not wipe the photo', held === PIC,
      held ? 'still there' : 'THE PHOTO WAS DELETED');

    const blanked = await run(`(async () => {
      window.gmnSupabase = { from: () => ({ select: () => ({ eq: () => ({
        maybeSingle: async () => ({ error: null, data: { driver_code: 'GMN-TEST',
          avatar: null, full_name: '', country: '' } }),
      }) }) }) };
      ProfileSync.at = 0;
      await ProfileSync.refresh(true);
      return { avatar: Store.db.driver.avatar, name: Store.db.driver.name };
    })()`);
    check('nor does a row that answers with nothing',
      blanked.avatar === PIC && blanked.name === 'Test Driver',
      blanked.avatar ? 'photo and name held' : 'BLANKED');

    /* And the photo has to reach the screen. avatarFace looked the kept
       copy up by d.id; the signed-in driver record calls it gmnId, so the
       one person whose photo this app keeps was the one it never found. */
    /* MEASURED, not read off the markup. The markup was right for months
       while nothing appeared: avatarFace asks for sizes by word - 'sm',
       'lg' - and those were never CSS classes, so .avatar had no width or
       height, and .avatar-img is absolutely positioned at inset:0 of it.
       Initials still looked right, because text gives a box its size. A
       photo collapsed to nothing. Checking the HTML could never see it. */
    const drawn = await run(`(async () => {
      const host = document.createElement('div');
      host.style.cssText = 'position:fixed;left:-500px;top:0';
      host.innerHTML = avatarFace(Store.db.driver, 'lg me');
      document.body.appendChild(host);
      const el = host.querySelector('.avatar');
      const img = host.querySelector('.avatar-img');
      /* a data: URI still decodes asynchronously */
      if (img && !img.complete) await new Promise((r) => {
        img.onload = r; img.onerror = r; setTimeout(r, 1500);
      });
      const box = el.getBoundingClientRect();
      const out = { w: Math.round(box.width), h: Math.round(box.height),
        natural: img ? img.naturalWidth : 0, isImg: !!img };
      host.remove();
      return out;
    })()`);
    check('the avatar is drawn as the photo', drawn.isImg === true,
      drawn.isImg ? 'an image element' : 'STILL INITIALS');
    check('and the box has a size at all', drawn.w >= 24 && drawn.h >= 24,
      drawn.w + 'x' + drawn.h + (drawn.w < 24 ? ' — COLLAPSED' : ''));
    check('and the picture actually decoded', drawn.natural > 0,
      drawn.natural ? drawn.natural + 'px source' : 'THE IMAGE NEVER LOADED');

    /* ---- which world the driver is in ----
       A map mod replaces the world the truck drives in. The client knew
       only the two base maps, so a driver in Australia or east of the
       Urals was drawn in Europe or nowhere, with nothing saying why.

       Installed comes from the shell. IN USE can only be proved by the
       truck: a position the base map cannot reach. */
    const mods = await run(`(async () => {
      /* contextBridge freezes window.gmnDesktop, so the seam is MapMods.api */
      MapMods.api = () => ({
        gameMods: async () => ({ ok: true, maps: [
          { name: 'ProMods', known: true, size: 3e9 },
          { name: 'The Land Down Under', known: true, size: 4.6e9 },
        ] }),
      });
      MapMods.at = 0;
      await MapMods.detect(true);
      return { label: MapMods.label(), state: MapMods.state(),
        promods: MapMods.usingProMods() };
    })()`);
    check('an installed map mod is found and named', mods.label === 'ProMods',
      mods.label || 'NOTHING FOUND');
    check('and it says installed, not in use', mods.state === 'installed',
      mods.state + ' — nothing has driven off the base map yet');
    check('ProMods switches the client to the ProMods map', mods.promods === true,
      'the wider European table');

    const proof = await run(`(() => {
      const b = mapFor('ets2').bounds;
      /* well past the western edge — Iceland, which ETS2 has no road to */
      MapMods.seen('ets2', b.x0 - (b.x1 - b.x0) * 0.5, (b.y0 + b.y1) / 2);
      return MapMods.state();
    })()`);
    check('a position off the base map proves one is in use', proof === 'in use',
      proof);

    const inside = await run(`(() => {
      const b = mapFor('ets2').bounds;
      MapMods.seen('ets2', (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2);
      return MapMods.state();
    })()`);
    check('and coming back inside stops claiming it', inside === 'installed', inside);

    /* ---- a pin is a claim that somebody is there NOW ----
       The map drew the driver's own truck whenever db.live merely existed.
       One frame - a driver who opened the game, was seen once and closed
       it - left a pin at 0 km/h with their name on it for the rest of the
       session, and nobody could tell it from someone parked in a lay-by. */
    const pin = await run(`(() => {
      const out = {};
      const frame = { at: new Date().toISOString(), game: 'ets2',
        world: { x: 0, z: 0 }, map: { x: 10, z: 10 }, heading: 0, speed: 42 };

      Telemetry.mode = 'live'; Store.db.live = frame;
      out.live = Telemetry.onRoad();

      /* the link dropped, the frame is still in the store */
      Telemetry.mode = 'sim';
      out.linkGone = Telemetry.onRoad();

      /* the link says live, but nothing has answered for a minute */
      Telemetry.mode = 'live';
      Store.db.live = Object.assign({}, frame,
        { at: new Date(Date.now() - 60000).toISOString() });
      out.stale = Telemetry.onRoad();

      Store.db.live = null;
      out.nothing = Telemetry.onRoad();
      return out;
    })()`);
    check('reporting right now is on the road', pin.live === true, 'a fresh frame');
    check('the link dropping takes the truck off it', pin.linkGone === false,
      pin.linkGone ? 'STILL ON THE MAP' : 'off the map');
    check('so does a frame nobody has refreshed', pin.stale === false,
      pin.stale ? 'a minute-old frame STILL COUNTS' : 'a minute old is not now');
    check('and no frame at all is not a position', pin.nothing === false, 'off the map');

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
