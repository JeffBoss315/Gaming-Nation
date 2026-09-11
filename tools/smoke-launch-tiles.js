/* ============================================================
   Smoke test — the launch bar, and finding the games itself.

     npm run smoke:tiles

   Two things, and the second is the one that was missing.

   THE TILES. There is a tile per game, and a driver picks the
   one they are about to play. American Truck Simulator was added
   and the bar is easy to edit by hand, so this pins down that
   all three are there and each starts the right thing.

   FINDING THEM. Settings has a Detect button per game and, until
   this test existed, that button was the only thing that ever
   ran the search: a fresh install showed tiles wearing a warning
   badge, and clicking one sent the driver to Settings to press a
   button the client could press itself.

   It presses it itself. The rules that keep that from being rude
   are what is actually checked here, because each of them is a
   way to ruin somebody's settings:

     a blank is filled,
     a path they chose by hand is LEFT ALONE,
     a path whose file has gone is replaced,
     and a game found nowhere leaves the blank blank rather than
       writing in a guess.

   The search itself is stubbed, so this finds the same things on
   a build machine as on a driver's, and never depends on which
   games happen to be installed where it runs.
   ============================================================ */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const steps = [];
let problems = 0;
const check = (name, ok, detail) => {
  steps.push((ok ? '  ' : '! ') + String(name).padEnd(54)
    + (detail === undefined ? '' : detail));
  if (!ok) problems++;
};

/* what the search would find on this pretend machine, and which files
   pretend to be there */
let FOUND = {};
let PRESENT = new Set();

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-tiles'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  ipcMain.handle('game:autoDetect', (_e, kind) => FOUND[kind] || null);
  ipcMain.handle('fs:exists', (_e, p) => PRESENT.has(p));
  /* the tiles ask for each game's icon; there is no real exe here to read
     one out of, and a tile without an icon is not what is under test */
  ipcMain.handle('game:icon', () => null);

  const win = new BrowserWindow({
    width: 1200, height: 820, show: false,
    webPreferences: { preload: path.join(ROOT, 'preload.js') },
  });
  /* Electron warns every unpackaged renderer about its own CSP and says so
     itself: "This warning will not show up once the app is packaged." It is
     not the app reporting anything, and counting it means this test can
     never come back clean. */
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Electron Security Warning/.test(msg)) errors.push(msg);
  });

  await win.loadFile(path.join(ROOT, 'tracker.html'));
  await new Promise((r) => setTimeout(r, 1800));

  const run = (js) => win.webContents.executeJavaScript(js);

  try {
    /* ---------------- the tiles ---------------- */
    const bar = await run('launchBarHTML()');
    for (const [kind, label] of [['ets2', 'EURO TRUCK'],
                                 ['ats', 'AMERICAN TRUCK'],
                                 ['tmp', 'MULTIPLAYER']]) {
      check('a tile for ' + kind,
        bar.indexOf('data-kind="' + kind + '"') > -1 && bar.indexOf(label) > -1,
        bar.indexOf('data-kind="' + kind + '"') > -1 ? label : 'MISSING');
    }

    /* The third launcher is not one program. TruckersMP and TrucksBook are
       different companies doing different jobs and the search looks for
       both, so a driver running one was shown the other's name - the
       settings field said "TruckersMP launcher" over a path ending in
       TB Client.exe. It is named after the file that is set. */
    for (const [exe, want] of [
      ['C:/Program Files (x86)/TrucksBook Client/TB Client.exe', 'TrucksBook Client'],
      ['C:/Program Files/TruckersMP/TruckersMP.exe', 'TruckersMP launcher'],
      ['', 'TruckersMP or TrucksBook'],
    ]) {
      const got = await run(`(() => {
        Store.db.settings.tmpExe = ${JSON.stringify(exe)};
        return tmpLabel();
      })()`);
      check('  ' + (exe.split('/').pop() || 'nothing set') + ' reads as ' + want,
        got === want, got);
    }

    /* ---------------- a fresh machine ---------------- */
    FOUND = { ets2: 'C:/Games/ETS2/eurotrucks2.exe',
              ats:  'C:/Games/ATS/amtrucks.exe',
              tmp:  null };
    await run(`(async () => {
      Object.assign(Store.db.settings, { ets2Exe: '', atsExe: '', tmpExe: '' });
      await GamePaths.fill();
    })()`);
    let s = await run('JSON.parse(JSON.stringify(Store.db.settings))');
    check('a blank path is filled without being asked',
      s.ets2Exe === FOUND.ets2 && s.atsExe === FOUND.ats,
      'ets2=' + (s.ets2Exe || 'blank') + '  ats=' + (s.atsExe || 'blank'));
    check('and a game found nowhere stays blank, not guessed at',
      s.tmpExe === '', s.tmpExe === '' ? 'blank' : s.tmpExe);

    /* the badge belongs to the tile whose path is missing, and only that
       one - tmp was found nowhere above and must still be wearing it */
    const badge = (kind) => run(`(function(){
      var h = launchBarHTML(), i = h.indexOf('data-kind="${kind}"');
      return h.slice(i, h.indexOf('</button>', i)).indexOf('lt-warn') > -1;})()`);
    check('the warning badge goes when the path arrives',
      (await badge('ats')) === false, 'ats tile is clean');
    check('and stays on the game that was not found',
      (await badge('tmp')) === true, 'tmp tile still warns');

    /* ---------------- a machine somebody has set up ---------------- */
    const HAND = 'D:/SteamLibrary/ATS/amtrucks.exe';
    PRESENT = new Set([HAND]);
    await run(`(async () => {
      Store.db.settings.atsExe = ${JSON.stringify(HAND)};
      await GamePaths.fill();
    })()`);
    s = await run('JSON.parse(JSON.stringify(Store.db.settings))');
    check('a path chosen by hand is left alone', s.atsExe === HAND, s.atsExe);

    /* ---------------- and one where the game has moved ---------------- */
    PRESENT = new Set();                       /* that file is gone now */
    await run('GamePaths.fill()');
    await new Promise((r) => setTimeout(r, 400));
    s = await run('JSON.parse(JSON.stringify(Store.db.settings))');
    check('a path whose file has gone is replaced', s.atsExe === FOUND.ats, s.atsExe);

    /* the drive is merely unplugged: nothing found, and blanking the
       setting would lose what the driver chose for no reason */
    const KEEP = 'E:/Removable/ETS2/eurotrucks2.exe';
    FOUND = {};
    await run(`(async () => {
      Store.db.settings.ets2Exe = ${JSON.stringify(KEEP)};
      await GamePaths.fill();
    })()`);
    s = await run('JSON.parse(JSON.stringify(Store.db.settings))');
    check('an unplugged drive does not wipe the setting', s.ets2Exe === KEEP, s.ets2Exe);

    /* ---------------- upgrading from a version that had a switch ----------
       "Detect the game automatically" was a setting, defaulted on, and it is
       gone. Every driver upgrading still has the old value saved in their
       browser store, and for anyone who had turned it OFF, honouring it now
       would mean the tiles never fill in and nothing explains why - there is
       no longer a switch on screen to put back. Nothing reads it. */
    FOUND = { ats: 'C:/Elsewhere/amtrucks.exe' };
    await run(`(async () => {
      Store.db.settings.autoDetect = false;      /* a leftover from 1.0.2 */
      Store.db.settings.atsExe = '';
      await GamePaths.fill();
    })()`);
    s = await run('JSON.parse(JSON.stringify(Store.db.settings))');
    check('a switch left over from an older version is ignored',
      s.atsExe === FOUND.ats, s.atsExe || 'STILL BLANK');

    check('and the renderer logged no errors', errors.length === 0,
      errors.length ? errors.slice(0, 3).join(' | ') : 'none');
  } catch (e) {
    check('the test itself ran', false, (e && e.message) || String(e));
  }

  console.log('\nthe launch bar, and finding the games itself');
  console.log(steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
  app.exit(problems ? 1 : 0);
});
