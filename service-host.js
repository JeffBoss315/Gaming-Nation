/* ============================================================
   Hosting the company service from inside the desktop app.

   Messages, calls and the crew room all run through
   fleet-server.js. Until now that meant somebody opening a
   terminal and typing `npm run fleet` — a fair thing to ask of
   whoever set the project up, and an absurd thing to ask of a
   driver who installed an app and pressed Messages. The commonest
   report about chat was that it did not work, and the commonest
   reason was that nothing was running the thing chat runs on.

   Its own module rather than more of electron-main, so a test can
   start and stop it without a window, an IPC channel or the rest
   of the shell — see tools/smoke-host-service.js.
   ============================================================ */
const { app, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn } = require('child_process');

let service = null;          /* the child process, while it is up */
let serviceState = {
  running: false,
  port: 7040,
  lan: false,
  error: null,
  startedAt: 0,
};

/* Where the service keeps its files.

   NOT beside the executable: on Windows that is Program Files, which is
   not writable, and the service would come up and then fail on the first
   write with nothing on screen to say why. userData is per-machine, is
   writable, and survives an upgrade. */
function serviceDir() {
  const dir = path.join(app.getPath('userData'), 'company-service');
  try { fs.mkdirSync(dir, { recursive: true }); } catch (e) { /* reported on start */ }
  return dir;
}

/* fleet-server.js is asarUnpack'd, so it is a real file on disk rather
   than a path inside the archive. Spawning a script that only exists
   inside app.asar works in some Electron versions and not others; a file
   that is actually there works in all of them. */
function serviceScript() {
  const packed = app.getAppPath();
  const unpacked = packed.replace(/app\.asar$/, 'app.asar.unpacked');
  const candidates = [
    path.join(unpacked, 'fleet-server.js'),
    path.join(packed, 'fleet-server.js'),
    path.join(__dirname, 'fleet-server.js'),
  ];
  return candidates.find((p) => { try { return fs.existsSync(p); } catch (e) { return false; } }) || null;
}

/* The address to give the other drivers. A machine has several; the one
   worth printing is the private IPv4 everybody else on the network can
   actually route to. */
function lanAddress(port) {
  const nets = os.networkInterfaces();
  for (const name of Object.keys(nets)) {
    for (const net of nets[name] || []) {
      if (net.family !== 'IPv4' && net.family !== 4) continue;
      if (net.internal) continue;
      return 'http://' + net.address + ':' + port;
    }
  }
  return null;
}

function stopService() {
  if (!service) return;
  try { service.kill(); } catch (e) { /* already gone */ }
  service = null;
  serviceState = Object.assign({}, serviceState, { running: false, startedAt: 0 });
}

function startService(opts) {
  opts = opts || {};
  const port = Number(opts.port) || 7040;
  const lan = !!opts.lan;

  if (service) stopService();

  const script = serviceScript();
  if (!script) {
    serviceState = Object.assign({}, serviceState, {
      running: false,
      error: 'The company service is missing from this install.',
    });
    return serviceState;
  }

  const dir = serviceDir();
  const args = [script, '--port', String(port)];
  if (lan) args.push('--lan');

  try {
    service = spawn(process.execPath, args, {
      cwd: path.dirname(script),
      env: Object.assign({}, process.env, {
        /* run the Electron binary as plain node */
        ELECTRON_RUN_AS_NODE: '1',
        GMN_COMPANY_FILE: path.join(dir, 'company.json'),
        GMN_SESSION_FILE: path.join(dir, 'sessions.json'),
        GMN_CHAT_FILE: path.join(dir, 'chat.json'),
        GMN_DM_FILE: path.join(dir, 'dms.json'),
        GMN_ROOM_READS_FILE: path.join(dir, 'room-reads.json'),
        GMN_FILES_FILE: path.join(dir, 'files.json'),
        GMN_FILES_DIR: path.join(dir, 'files'),
        /* so another driver can open the site from this machine and have
           it joined up with no address to type */
        GMN_SITE_DIR: path.dirname(script),
      }),
      stdio: 'ignore',
      windowsHide: true,
    });
  } catch (err) {
    service = null;
    serviceState = Object.assign({}, serviceState, { running: false, error: err.message });
    return serviceState;
  }

  service.on('exit', (code) => {
    /* Only report an unexpected exit. A stop asked for by the driver has
       already cleared `service`, and saying "the service stopped" to
       somebody who just stopped it is noise. */
    if (service) {
      service = null;
      serviceState = Object.assign({}, serviceState, {
        running: false,
        error: code ? 'The company service stopped unexpectedly (code ' + code + ').' : null,
      });
    }
  });

  service.on('error', (err) => {
    service = null;
    serviceState = Object.assign({}, serviceState, { running: false, error: err.message });
  });

  serviceState = {
    running: true,
    port,
    lan,
    error: null,
    startedAt: Date.now(),
  };

  return serviceState;
}

/* Everything above is plain functions; this is the only part that needs
   Electron to be running, which is what makes the rest testable. */
function register() {
  ipcMain.handle('service:start', (_e, opts) => Object.assign({},
    startService(opts),
    { lanUrl: (opts && opts.lan) ? lanAddress(Number(opts && opts.port) || 7040) : null }));

  ipcMain.handle('service:stop', () => { stopService(); return serviceState; });

  ipcMain.handle('service:status', () => status());

  /* A service left running after the app closes is a process nobody can
     see and nobody asked for. */
  app.on('before-quit', stopService);
  app.on('will-quit', stopService);
  process.on('exit', stopService);
}

function status() {
  return Object.assign({}, serviceState, {
    available: !!serviceScript(),
    lanUrl: serviceState.running && serviceState.lan ? lanAddress(serviceState.port) : null,
  });
}

module.exports = { register, startService, stopService, status, serviceScript, lanAddress };
