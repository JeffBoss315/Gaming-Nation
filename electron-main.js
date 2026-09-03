/* ============================================================
   Heavyline Trucker — Electron shell

   Wraps the client in a real desktop window and provides what a web
   page cannot do for itself: file pickers, launching the game,
   starting with Windows, and living in the system tray.

     npm start          run it
     npm run dist       build the installer + portable exe
   ============================================================ */
const { app, BrowserWindow, ipcMain, dialog, shell, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
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
    title: 'Heavyline Trucker',
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
  tray.setToolTip('Heavyline Trucker');
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Open Heavyline Trucker', click: () => { if (win) { win.show(); win.focus(); } } },
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

/* ---------------- lifecycle ---------------- */
app.whenReady().then(() => {
  createWindow();
  buildTray();
  app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });
});

app.on('before-quit', () => { quitting = true; });
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && !trayEnabled) app.quit();
});
