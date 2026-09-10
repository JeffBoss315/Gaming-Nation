/* ============================================================
   Gaming Nation Trucker — Electron shell

   Wraps the client in a real desktop window and provides what a web
   page cannot do for itself: file pickers, launching the game,
   starting with Windows, and living in the system tray.

     npm start          run it
     npm run dist       build the installer + portable exe
   ============================================================ */
const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const net = require('net');
const TelemetryPlugin = require('./telemetry-plugin');
const { spawn, execFile } = require('child_process');

let win = null;
let tray = null;
let trayEnabled = true;
let quitting = false;

/* ---------------- window ---------------- */
function createWindow() {
  win = new BrowserWindow({
    width: 1180,
    height: 800,
    minWidth: 900,
    minHeight: 600,
    title: 'Gaming Nation Trucker',
    icon: path.join(__dirname, 'icons', 'icon-512.png'),
    backgroundColor: '#0a0c0f',
    frame: false,                 /* the app draws its own title bar */
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  win.loadFile('tracker.html');

  win.once('ready-to-show', () => {
    if (!process.argv.includes('--start-minimized')) win.show();
  });

  /* links to the web HQ open in the default browser, not inside the client */
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/i.test(url)) { shell.openExternal(url); return { action: 'deny' }; }
    return { action: 'allow' };
  });

  /* closing goes to the tray while that is switched on */
  win.on('close', (e) => {
    if (!quitting && trayEnabled) {
      e.preventDefault();
      win.hide();
    }
  });
  win.on('closed', () => { win = null; });
}

/* ---------------- tray ---------------- */
function buildTray() {
  if (tray) return;
  let image = nativeImage.createFromPath(path.join(__dirname, 'icons', 'icon-192.png'));
  if (!image.isEmpty()) image = image.resize({ width: 16, height: 16 });
  tray = new Tray(image);
  tray.setToolTip('Gaming Nation Trucker');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Gaming Nation Trucker', click: () => { if (win) { win.show(); win.focus(); } } },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
  tray.on('double-click', () => { if (win) { win.show(); win.focus(); } });
}
function destroyTray() {
  if (tray) { tray.destroy(); tray = null; }
}

/* ---------------- window controls ---------------- */
ipcMain.on('win:minimize', () => win && win.minimize());
ipcMain.on('win:maximize', () => {
  if (!win) return;
  win.isMaximized() ? win.unmaximize() : win.maximize();
});
ipcMain.on('win:close', () => win && win.close());

/* ---------------- file system ---------------- */
/* Whether this copy is the build the website is offering. The fetch lives
   in update-check.js so a test can require it - see the note at its top. */
require('./update-check').register(ipcMain);

ipcMain.handle('fs:exists', (_e, p) => {
  try { return !!p && fs.existsSync(p); } catch (err) { return false; }
});

ipcMain.handle('fs:pickFile', async (_e, opts) => {
  opts = opts || {};
  const res = await dialog.showOpenDialog(win, {
    title: opts.title || 'Select a program',
    defaultPath: opts.defaultPath || undefined,
    properties: ['openFile'],
    filters: [{ name: 'Programs', extensions: ['exe'] }, { name: 'All files', extensions: ['*'] }],
  });
  if (res.canceled || !res.filePaths.length) return null;
  return res.filePaths[0];
});

/* ---------------- finding the games ---------------- */
function steamLibraries() {
  /* the default library plus every extra one listed in libraryfolders.vdf */
  const roots = [];
  const bases = [
    process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'Steam'),
    process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'Steam'),
    'C:\\Steam',
  ].filter(Boolean);

  for (const base of bases) {
    if (!fs.existsSync(base)) continue;
    roots.push(path.join(base, 'steamapps', 'common'));
    const vdf = path.join(base, 'steamapps', 'libraryfolders.vdf');
    if (fs.existsSync(vdf)) {
      try {
        const text = fs.readFileSync(vdf, 'utf8');
        const re = /"path"\s+"([^"]+)"/g;
        let m;
        while ((m = re.exec(text))) {
          roots.push(path.join(m[1].replace(/\\\\/g, '\\'), 'steamapps', 'common'));
        }
      } catch (err) { /* a malformed vdf just means fewer candidates */ }
    }
  }
  ['D:\\', 'E:\\', 'F:\\'].forEach((d) => roots.push(path.join(d, 'Games')));
  return [...new Set(roots)];
}

const GAME_CANDIDATES = {
  ets2: [
    ['Euro Truck Simulator 2', 'bin', 'win_x64', 'eurotrucks2.exe'],
    ['Euro Truck Simulator 2', 'bin', 'win_x86', 'eurotrucks2.exe'],
  ],
  ats: [
    ['American Truck Simulator', 'bin', 'win_x64', 'amtrucks.exe'],
    ['American Truck Simulator', 'bin', 'win_x86', 'amtrucks.exe'],
  ],
};

ipcMain.handle('game:autoDetect', (_e, kind) => {
  if (kind === 'tmp') {
    const spots = [
      process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'TruckersMP', 'TruckersMP.exe'),
      process.env.ProgramFiles && path.join(process.env.ProgramFiles, 'TruckersMP', 'TruckersMP.exe'),
      process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs', 'TruckersMP', 'TruckersMP.exe'),
      process.env.APPDATA && path.join(process.env.APPDATA, 'TruckersMP', 'TruckersMP.exe'),
      process.env['ProgramFiles(x86)'] && path.join(process.env['ProgramFiles(x86)'], 'TrucksBook Client', 'TB Client.exe'),
    ].filter(Boolean);
    for (const s of spots) if (fs.existsSync(s)) return s;
    return null;
  }

  const rel = GAME_CANDIDATES[kind === 'ats' ? 'ats' : 'ets2'];
  for (const root of steamLibraries()) {
    if (!fs.existsSync(root)) continue;
    for (const parts of rel) {
      const full = path.join(root, ...parts);
      if (fs.existsSync(full)) return full;
    }
  }
  return null;
});

/* The game's own icon, out of the game's own executable.

   The launch tiles used a generic truck glyph, which tells a driver
   nothing about which of two trucking games a button starts. The real
   marks are somebody else's trademarks and are not ours to ship - but
   the driver already has them, on their own disk, inside the .exe this
   button launches. Windows will hand them over.

   Fails quietly to null: a tile with no icon falls back to the glyph,
   which is exactly what it looked like before. */
/* Which game profiles this driver actually has.

   Telemetry never says which profile is loaded, so the client used to ask
   the driver to type the name and then trusted whatever they typed. A
   typo went on every run they filed, and somebody who renamed a profile
   in game had no idea the label had stopped matching.

   The games write it down. Each profile is a folder under Documents whose
   NAME is the profile name in hex - 414652494341 is AFRICA - and the
   folder's timestamp moves every time that profile is saved. So the list
   is real, and the most recently saved one is the profile being played.

   Both folders are read: Steam Cloud keeps them in steam_profiles and a
   non-Steam copy uses profiles, and a driver can have both. */
const PROFILE_DIRS = { ets2: 'Euro Truck Simulator 2', ats: 'American Truck Simulator' };

function decodeProfileName(folder) {
  if (!/^[0-9A-Fa-f]+$/.test(folder) || folder.length % 2) return null;
  let out = '';
  for (let i = 0; i < folder.length; i += 2) {
    const code = parseInt(folder.slice(i, i + 2), 16);
    /* a real name is printable; anything else means this is not a name */
    if (code < 32 || code > 126) return null;
    out += String.fromCharCode(code);
  }
  return out.trim() || null;
}

/* ---------------- which map the driver is actually on ----------------

   ProMods and the other map mods change the world the truck is driving in:
   new countries, new cities, roads a thousand kilometres past where the
   base game stops. A client that only knows the base map puts those
   drivers nowhere, or clamps them to the edge, and the map quietly lies.

   TWO SOURCES, because neither is enough on its own.

   mods_info.sii, beside the profiles under Documents, is plain text and
   lists every mod the game knows about - Steam Workshop included, which
   is most of them and which never appears in the mod folder at all.

   The mod folder itself carries the manually installed .scs archives,
   with their sizes. Size matters: the smallest real map mod is hundreds
   of megabytes, so a 4 GB archive is a map whatever it is called and a
   4 MB one is a skin whatever it is called.

   WHAT NEITHER CAN SEE is which mods a profile has ENABLED. That lives in
   the profile's own profile.sii, which SCS ships encrypted. So this
   reports what is INSTALLED and says so in those words. Confirming one is
   in use is the client's job, and there is only one honest way to do it:
   a truck turning up somewhere the base map does not reach. */
const MOD_DIRS = { ets2: 'Euro Truck Simulator 2', ats: 'American Truck Simulator' };

/* Below this, it is not a map. */
const MAP_MOD_MIN = 64 * 1024 * 1024;

/* Longest key first, so 'promods-middle-east' is not read as plain
   ProMods and 'RIW_Heart_of_Africa' is not read as RIW. */
const KNOWN_MAPS = [
  ['promods middle-east', 'ProMods Middle-East'],
  ['promods-middle-east', 'ProMods Middle-East'],
  ['promods_middle_east', 'ProMods Middle-East'],
  ['promods canada', 'ProMods Canada'],
  ['promods-canada', 'ProMods Canada'],
  ['promods_canada', 'ProMods Canada'],
  ['promods', 'ProMods'],
  ['heart_of_africa', 'RIW Heart of Africa'],
  ['heart of africa', 'RIW Heart of Africa'],
  ['riw_beyond', 'RIW Beyond'],
  ['riw', 'Road to Asia'],
  ['hoa_', 'Heart of Asia'],
  ['land down under', 'The Land Down Under'],
  ['far east russia', 'Far East Russia'],
  ['africa_', 'Africa'],
  ['roextended', 'RoExtended'],
  ['rusmap', 'RusMap'],
  ['southern_region', 'Southern Region'],
  ['great_steppe', 'The Great Steppe'],
  ['sibirmap', 'SibirMap'],
  ['coast_to_coast', 'Coast to Coast'],
  ['reforma', 'Reforma'],
  ['midwest_expansion', 'Midwest Expansion'],
];

function nameMapMod(text) {
  const low = String(text || '').toLowerCase();
  for (const [key, label] of KNOWN_MAPS) if (low.indexOf(key) > -1) return label;
  return null;
}

/* 'The Land Down Under v1.0' -> 'The Land Down Under'. A version on a
   label is noise; the driver knows which version they installed. */
function tidyModName(raw) {
  return String(raw || '')
    .replace(/\.scs$/i, '')
    .replace(/[_]+/g, ' ')
    .replace(/\s*(v?\d+(\.\d+)*|alpha|beta|rc)\s*$/i, '')
    .trim() || String(raw || '');
}

ipcMain.handle('game:mods', async (_e, kind) => {
  const game = MOD_DIRS[kind === 'ats' ? 'ats' : 'ets2'];
  const home = path.join(app.getPath('documents'), game);
  const found = new Map();          /* label -> { name, known, size, from } */

  const add = (raw, size, from) => {
    const known = nameMapMod(raw);
    const name = known || tidyModName(raw);
    const prev = found.get(name);
    if (prev) {
      /* the same map arrives as several archives - assets, def, models */
      prev.size += size || 0;
      if (from && prev.from.indexOf(from) === -1) prev.from.push(from);
      return;
    }
    found.set(name, { name, known: !!known, size: size || 0, from: [from] });
  };

  /* ---- what the game knows about, workshop included ---- */
  let info = '';
  try { info = await fs.promises.readFile(path.join(home, 'mods_info.sii'), 'latin1'); }
  catch (err) { /* no file: this driver has never had a mod */ }
  if (info) {
    /* entries read  info[3]: "hoa_assets1|1788904229"  — the id after the
       bar is the workshop item and is not worth showing anybody */
    const re = /"([^"|]+)\|/g;
    let m;
    while ((m = re.exec(info))) {
      const raw = m[1];
      /* the workshop's own bookkeeping package is not a mod */
      if (/^mod_workshop_package\./i.test(raw)) continue;
      if (nameMapMod(raw)) add(raw, 0, 'game');
    }
  }

  /* ---- and the archives sitting in the mod folder ---- */
  let files = [];
  try { files = await fs.promises.readdir(path.join(home, 'mod')); }
  catch (err) { /* no mod folder is normal */ }
  for (const file of files) {
    if (!/\.scs$/i.test(file)) continue;
    let size = 0;
    try { size = (await fs.promises.stat(path.join(home, 'mod', file))).size; }
    catch (err) { continue; }
    /* named, or big enough that nothing else could be that size */
    if (nameMapMod(file) || size >= MAP_MOD_MIN) add(file, size, 'folder');
  }

  const maps = Array.from(found.values()).sort((a, b) =>
    (b.known - a.known) || (b.size - a.size) || a.name.localeCompare(b.name));

  return { ok: true, home, maps };
});

ipcMain.handle('game:profiles', async (_e, kind) => {
  const game = PROFILE_DIRS[kind === 'ats' ? 'ats' : 'ets2'];
  const docs = app.getPath('documents');
  const found = [];

  for (const box of ['steam_profiles', 'profiles']) {
    const dir = path.join(docs, game, box);
    let names = [];
    try { names = fs.readdirSync(dir); } catch (err) { continue; }
    for (const folder of names) {
      const name = decodeProfileName(folder);
      if (!name) continue;
      try {
        const st = fs.statSync(path.join(dir, folder));
        if (!st.isDirectory()) continue;
        found.push({ name, at: st.mtimeMs, steam: box === 'steam_profiles' });
      } catch (err) { /* a folder that vanished mid-read is not a profile */ }
    }
  }

  /* most recently saved first: that is the one being played */
  found.sort((a, b) => b.at - a.at);
  return found;
});

ipcMain.handle('game:icon', async (_e, exe) => {
  if (!exe || !fs.existsSync(exe)) return null;
  try {
    const img = await app.getFileIcon(exe, { size: 'large' });
    return img && !img.isEmpty() ? img.toDataURL() : null;
  } catch (err) {
    return null;
  }
});

ipcMain.handle('game:launch', async (_e, exe) => {
  if (!exe) return { error: 'No path set' };
  if (!fs.existsSync(exe)) return { error: 'That file no longer exists' };
  try {
    const child = spawn(exe, [], { detached: true, stdio: 'ignore', cwd: path.dirname(exe) });
    child.unref();
    return { ok: true };
  } catch (err) {
    return { error: err.message };
  }
});


/* ---------------- is the game actually running? ----------------
   The telemetry plugin only answers once the game is well into its start-up,
   so the process list is what tells us the moment it opens and the moment it
   closes.

   A filtered query per executable costs about a fifth of a full listing, and
   the three run together, so a check is ~250ms of mostly-idle wait rather
   than a second and a half of work while somebody is trying to play. The
   answer is cached briefly on top of that. */
const GAME_PROCESSES = {
  ets2: ['eurotrucks2.exe'],
  ats:  ['amtrucks.exe'],
  tmp:  ['truckersmp.exe', 'tb client.exe'],
};

let processCache = { at: 0, value: null };

function anyProcessRunning(names) {
  if (process.platform !== 'win32') {
    return new Promise((resolve) => {
      execFile('ps', ['-axco', 'command'], { maxBuffer: 4 << 20 }, (err, out) => {
        const list = String(err ? '' : out).toLowerCase();
        resolve(names.some((n) => list.includes(n.replace('.exe', ''))));
      });
    });
  }
  /* tasklist prints a plain "no tasks" line when nothing matches, and that
     line never contains the name we asked for */
  return Promise.all(names.map((name) => new Promise((resolve) => {
    execFile('tasklist', ['/fi', 'imagename eq ' + name, '/fo', 'csv', '/nh'],
      { windowsHide: true, maxBuffer: 1 << 20 }, (err, out) => {
        resolve(!err && String(out).toLowerCase().includes(name));
      });
  }))).then((hits) => hits.some(Boolean));
}

ipcMain.handle('game:running', async () => {
  const now = Date.now();
  if (processCache.value && now - processCache.at < 2500) return processCache.value;

  const keys = Object.keys(GAME_PROCESSES);
  let hits;
  try {
    hits = await Promise.all(keys.map((k) => anyProcessRunning(GAME_PROCESSES[k])));
  } catch (err) {
    return { ets2: false, ats: false, tmp: false, ok: false };
  }
  const value = { ok: true };
  keys.forEach((k, i) => { value[k] = hits[i]; });
  processCache = { at: now, value };
  return value;
});

/* ---------------- delivery photo ---------------- */
require('./desktop-capture').register();

/* ---------------- startup + tray ---------------- */
ipcMain.handle('app:autoLaunch', (_e, on, minimized) => {
  try {
    app.setLoginItemSettings({
      openAtLogin: !!on,
      /* the driver decides whether sign-in opens a window or goes to the tray */
      args: on && minimized ? ['--start-minimized'] : [],
    });
    return { ok: true };
  } catch (err) { return { error: err.message }; }
});
ipcMain.handle('app:autoLaunchState', () => {
  try { return app.getLoginItemSettings().openAtLogin; } catch (err) { return false; }
});
ipcMain.handle('app:tray', (_e, on) => {
  trayEnabled = !!on;
  if (trayEnabled) buildTray(); else destroyTray();
  return { ok: true };
});

/* ---------------- the telemetry adapter ----------------
   The game does not talk to this app. A plugin inside ETS2/ATS writes the
   truck into shared memory many times a second, and gmn-telemetry-adapter.exe
   turns that into the JSON on 127.0.0.1 that the client polls.

   Nothing used to start it, and the installer did not even ship it. So a
   driver who had installed the plugin correctly still got "waiting for the
   game" for ever: no position, no fuel, no damage, and no delivery ever
   detected, because the one process that can read the game was never
   running. The desktop shell is the only part of this that can start a
   process, so it owns the adapter's life. */
const TELEMETRY_PORT = Number(process.env.GMN_TELEMETRY_PORT) || 25555;
let adapter = null;
let pluginReport = null;
let adapterRetry = null;
let adapterState = { running: false, reason: 'not started yet' };

/* Every Euro Truck / American Truck install this machine has, found the same
   way the game launcher finds them. */
function gameRoots() {
  const names = { ets2: 'Euro Truck Simulator 2', ats: 'American Truck Simulator' };
  const out = [];
  for (const lib of steamLibraries()) {
    for (const game of Object.keys(names)) {
      const root = path.join(lib, names[game]);
      try {
        if (fs.existsSync(path.join(root, 'bin', 'win_x64'))
            && !out.some((g) => g.root === root)) out.push({ game, root });
      } catch (e) { /* an unreadable library is simply not a candidate */ }
    }
  }
  return out;
}

/* The game will not report anything until its telemetry plugin is in place,
   and until now nothing put it there — the app only ever told the driver to
   go and do it. Run once per session, before the adapter starts, so the
   plugin is already in the folder the next time the game launches. */
function ensurePlugin() {
  if (process.platform !== 'win32') return null;
  try {
    pluginReport = TelemetryPlugin.ensure(
      gameRoots(), app.isPackaged ? process.resourcesPath : null);
    for (const done of pluginReport.installed) {
      console.log('[GMN] installed the telemetry plugin for ' + done.game
        + ' -> ' + done.dest);
    }
    for (const bad of pluginReport.problems) {
      console.warn('[GMN] ' + bad.game + ': ' + bad.reason);
    }
  } catch (e) {
    pluginReport = { checked: [], installed: [], already: [], mapNames: [],
      problems: [{ game: '-', reason: e.message }] };
  }
  return pluginReport;
}

function adapterPath() {
  const name = 'gmn-telemetry-adapter.exe';
  const places = app.isPackaged
    ? [path.join(process.resourcesPath, name),
       path.join(path.dirname(app.getPath('exe')), name)]
    : [path.join(__dirname, name)];
  return places.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
}

/* Something may already be serving that port — an adapter the driver
   started by hand, or a second copy of this app. Starting another one would
   leave two readers where one of them silently loses, so we look first and
   stand down if the port is taken. */
function portBusy(port) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (busy) => { socket.destroy(); resolve(busy); };
    socket.setTimeout(500);
    socket.once('connect', () => done(true));
    socket.once('timeout', () => done(false));
    socket.once('error', () => done(false));
    socket.connect(port, '127.0.0.1');
  });
}

async function startAdapter() {
  if (quitting || adapter || process.platform !== 'win32') return;

  const exe = adapterPath();
  if (!exe) {
    adapterState = { running: false, reason: 'the telemetry adapter is not installed beside the app' };
    return;
  }
  if (await portBusy(TELEMETRY_PORT)) {
    adapterState = { running: false, port: TELEMETRY_PORT,
      reason: 'something is already serving telemetry on ' + TELEMETRY_PORT + ', so this one stood down' };
    return;
  }

  /* Tell the adapter the mapping name read out of the DLL that is really
     installed, rather than leaving it to guess from a fixed list. A renamed
     build writes a name no list can know in advance. */
  const argv = ['--port', String(TELEMETRY_PORT)];
  const names = (pluginReport && pluginReport.mapNames) || [];
  if (names.length) argv.push('--also-map', names.join(','));

  try {
    adapter = spawn(exe, argv, { stdio: 'ignore', windowsHide: true });
  } catch (e) {
    adapterState = { running: false, reason: e.message };
    return;
  }
  adapterState = { running: true, reason: 'reading the game', exe };

  adapter.on('error', (e) => {
    adapter = null;
    adapterState = { running: false, reason: e.message };
  });

  /* It falling over is not the same as us shutting it down: only the first
     is worth restarting. A tight restart loop on a broken install is worse
     than being off, so it waits between goes. */
  adapter.on('exit', () => {
    adapter = null;
    if (quitting) { adapterState = { running: false, reason: 'the app is closing' }; return; }
    adapterState = { running: false, reason: 'the adapter stopped on its own — starting it again' };
    clearTimeout(adapterRetry);
    adapterRetry = setTimeout(startAdapter, 5000);
  });
}

function stopAdapter() {
  clearTimeout(adapterRetry);
  adapterRetry = null;
  if (adapter) { try { adapter.kill(); } catch (e) { /* already gone */ } adapter = null; }
}

ipcMain.handle('telemetry:adapter', () => Object.assign(
  { port: TELEMETRY_PORT, plugin: pluginReport }, adapterState));

/* Ask again — after the driver has installed a game, or after granting the
   rights the first attempt was refused. */
ipcMain.handle('telemetry:installPlugin', () => {
  const report = ensurePlugin();
  /* a plugin that has only just arrived may write a name the running adapter
     was never told about, so bring it back up with the new one */
  if (report && report.installed.length) { stopAdapter(); startAdapter(); }
  return report;
});


/* ---------------- hosting the company service ---------------- */
require('./service-host').register();



/* ---------------- lifecycle ---------------- */
app.whenReady().then(() => {
  createWindow();
  buildTray();
  ensurePlugin();
  startAdapter();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { quitting = true; stopAdapter(); });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !trayEnabled) app.quit();
});
