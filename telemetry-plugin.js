/* ============================================================
   GETTING THE GAME TO TALK AT ALL
   ------------------------------------------------------------
   Euro Truck Simulator 2 and American Truck Simulator do not
   report anything to anybody until an SCS telemetry plugin — a
   DLL — is sitting in the game's own plugins folder. Without it
   there is no shared memory, so the adapter has nothing to read,
   so the client detects no delivery however far you drive.

   Nothing in this app used to put that DLL anywhere. It was not
   shipped, not installed, not even checked for: the client simply
   told the driver to go and find one. That is the difference
   between "works on the machine it was built on" and "works on a
   driver's machine", and it is the reason a real delivery sat
   undetected for an entire run.

   Three things go wrong when a person does this by hand, and all
   three are silent:

     Wrong folder. A 64-bit game loads bin\win_x64\plugins and
     never looks at win_x86. A 32-bit DLL in the 32-bit folder
     next to a 64-bit game is the commonest way to have "installed
     the plugin" and have nothing happen — it is exactly what was
     found on the machine this was written for.

     Wrong build. A 32-bit DLL in the 64-bit folder is not loaded
     either, and the game does not complain.

     Wrong file entirely. Any DLL can be dropped in that folder.

   So nothing here is taken on trust. Every candidate is opened
   and read before it is used or believed: its PE header must say
   64-bit, it must export the SCS entry points, and it must carry
   the name of the shared memory it writes — which is also how the
   adapter is told where to look, instead of guessing from a fixed
   list of names.
   ============================================================ */
const fs = require('fs');
const path = require('path');

/* The plugins directory a 64-bit game actually reads. win_x86 is
   deliberately not offered: putting a file there feels like progress
   and achieves nothing. */
const pluginDir = (gameRoot) => path.join(gameRoot, 'bin', 'win_x64', 'plugins');

/* ---------- reading a DLL rather than believing its filename ---------- */

/* PE machine type, from the header. 0x8664 is x64; anything else will not
   be loaded by a 64-bit game no matter where it is put. */
function machineOf(buf) {
  try {
    if (buf.length < 0x40 || buf.readUInt16LE(0) !== 0x5a4d) return null;   /* MZ */
    const pe = buf.readUInt32LE(0x3c);
    if (pe + 6 > buf.length || buf.readUInt32LE(pe) !== 0x00004550) return null;  /* PE\0\0 */
    return buf.readUInt16LE(pe + 4);
  } catch (e) { return null; }
}

/* The name of the shared-memory block this plugin writes, read out of the
   binary itself. scs-sdk-plugin stores it as a wide string, and builds that
   have been renamed change it — Local\TelemetryTB rather than
   Local\SCSTelemetry — which is precisely the case a hardcoded list of
   names gets wrong. */
function mapNameOf(buf) {
  /* UTF-16LE: every ASCII character followed by a zero byte */
  const wide = buf.toString('binary').match(/(?:[\x20-\x7e]\x00){6,}/g) || [];
  for (const raw of wide) {
    const text = Buffer.from(raw, 'binary').toString('utf16le');
    const hit = text.match(/Local\\[A-Za-z0-9_.-]{3,60}/);
    if (hit) return hit[0];
  }
  return null;
}

/* Everything worth knowing about one candidate file, with a reason when it
   is not usable — a refusal that does not say why is not much better than
   silence. */
function inspect(file) {
  let buf;
  try { buf = fs.readFileSync(file); }
  catch (e) { return { file, ok: false, reason: 'could not be read: ' + e.message }; }

  const machine = machineOf(buf);
  if (machine === null) return { file, ok: false, reason: 'is not a Windows DLL' };
  if (machine !== 0x8664) {
    return {
      file, ok: false, machine,
      reason: machine === 0x14c
        ? 'is the 32-bit build, which a 64-bit game will not load'
        : 'is built for another processor (PE machine 0x' + machine.toString(16) + ')',
    };
  }

  const isScs = buf.includes('scs_telemetry_init') && buf.includes('scs_telemetry_shutdown');
  if (!isScs) return { file, ok: false, machine, reason: 'is not an SCS telemetry plugin' };

  const mapName = mapNameOf(buf);
  if (!mapName) {
    return { file, ok: false, machine, reason: 'never names the shared memory it writes' };
  }

  return { file, ok: true, machine, mapName, size: buf.length };
}

/* ---------- where a usable plugin might already be ---------- */

/* A copy shipped with the app, if one was put there. Kept first because it
   is the only source whose version this project controls. */
function bundled(resourcesPath) {
  const names = ['scs-telemetry.dll', 'telemetry_tb_64.dll'];
  const dirs = [
    resourcesPath && path.join(resourcesPath, 'plugin'),
    /* NOT vendor/. That folder is web assets, and build-www.js copies the
       whole tree into both the public website and the Android bundle - so a
       Windows game DLL parked there would be published at a public URL and
       shipped inside an APK that can never use it. */
    path.join(__dirname, 'game-plugin'),
  ].filter(Boolean);

  for (const dir of dirs) {
    for (const name of names) {
      const file = path.join(dir, name);
      if (fs.existsSync(file)) {
        const found = inspect(file);
        if (found.ok) return found;
      }
    }
  }
  return null;
}

/* Any working plugin the driver already has, in either game. Somebody who
   has ever used a telemetry app for one game has the right DLL sitting on
   their disk already; there is no reason to make them go and find it again
   for the other. */
function installedAnywhere(gameRoots) {
  const found = [];
  for (const g of gameRoots) {
    const dir = pluginDir(g.root);
    let names = [];
    try { names = fs.readdirSync(dir); } catch (e) { continue; }
    for (const name of names) {
      if (!/\.dll$/i.test(name)) continue;
      const got = inspect(path.join(dir, name));
      if (got.ok) found.push(Object.assign({ game: g.game }, got));
    }
  }
  return found;
}

/* ---------- putting it where the game will load it ---------- */

/* Reports rather than throws. A game folder under Program Files needs
   administrator rights to write to, and a driver who is told "could not
   install the plugin: permission denied" can act on that, where a silent
   failure leaves them driving a run nobody records. */
function install(gameRoot, source) {
  const dir = pluginDir(gameRoot);
  const dest = path.join(dir, path.basename(source.file));
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(source.file, dest);
    return { ok: true, dest };
  } catch (e) {
    return {
      ok: false, dest,
      reason: e.code === 'EPERM' || e.code === 'EACCES'
        ? 'the game folder is write-protected — running Gaming Nation as '
          + 'administrator once is enough to install it'
        : e.message,
    };
  }
}

/* The whole job, in one call: look at every game, leave a working plugin
   alone, install one where it is missing, and say what the adapter should
   be looking for afterwards. */
function ensure(gameRoots, resourcesPath) {
  const report = { checked: [], installed: [], already: [], problems: [], mapNames: [] };
  if (process.platform !== 'win32' || !gameRoots.length) return report;

  const have = installedAnywhere(gameRoots);
  const source = bundled(resourcesPath) || have[0] || null;

  for (const g of gameRoots) {
    report.checked.push(g.game);

    const mine = have.find((h) => h.game === g.game);
    if (mine) {
      report.already.push({ game: g.game, file: mine.file, mapName: mine.mapName });
      continue;
    }

    /* Nothing usable in this game's folder. Say what IS in there, because
       "a 32-bit plugin is sitting in the wrong folder" is a different
       problem from "there is no plugin", and only one of them is the
       driver's mistake. */
    const wrong = [];
    try {
      for (const name of fs.readdirSync(path.join(g.root, 'bin', 'win_x86', 'plugins'))) {
        if (/\.dll$/i.test(name)) {
          const got = inspect(path.join(g.root, 'bin', 'win_x86', 'plugins', name));
          if (!got.ok) wrong.push(name + ' — ' + got.reason);
        }
      }
    } catch (e) { /* no 32-bit folder is the normal case */ }

    if (!source) {
      report.problems.push({
        game: g.game,
        reason: 'no telemetry plugin is installed for this game, and none was '
          + 'found anywhere on this machine to copy in'
          + (wrong.length ? ' (found in the 32-bit folder: ' + wrong.join('; ') + ')' : ''),
      });
      continue;
    }

    const done = install(g.root, source);
    if (done.ok) {
      report.installed.push({ game: g.game, dest: done.dest, mapName: source.mapName,
        from: source.file });
    } else {
      report.problems.push({ game: g.game, reason: done.reason });
    }
  }

  for (const entry of report.already.concat(report.installed)) {
    if (entry.mapName && report.mapNames.indexOf(entry.mapName) < 0) {
      report.mapNames.push(entry.mapName);
    }
  }
  return report;
}

module.exports = { ensure, inspect, pluginDir, mapNameOf, machineOf };
