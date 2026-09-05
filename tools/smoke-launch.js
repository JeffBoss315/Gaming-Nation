/* ============================================================
   Smoke test — does the BUILT app actually start?

     npm run smoke:launch      (after npm run dist)

   Every other check in this project runs against the checkout,
   where every file is obviously present. That is exactly how a
   client shipped that could not start at all:

     Cannot find module './service-host'
     C:\Program Files\Gaming Nation Trucker\resources\app.asar\electron-main.js

   electron-builder ships what build.files lists and nothing else.
   The module was required and never listed, so it was absent from
   the installer and only from the installer. tools/scan.js now
   catches that specific mistake by walking the requires — but the
   general question, "does the thing we are about to hand people
   open", is only answerable by opening it.

   So this runs the packaged executable and waits. A main-process
   throw kills Electron immediately, so an app still alive after a
   few seconds has got through require, app.whenReady() and its
   first window.

   ONE TRAP, and it cost an hour: ELECTRON_RUN_AS_NODE. With that
   set in the environment, ANY Electron binary — including a
   packaged app — runs as plain node, electron-main.js throws on
   ipcMain being undefined, and the app exits in a second. That
   looks exactly like the bug this is meant to detect. The
   variable is stripped below, and it is stripped rather than
   merely unset because the smoke harnesses set it deliberately.
   ============================================================ */
const { spawn, spawnSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const steps = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(44) + v);
let problems = 0;
const fail = (why) => { problems++; steps.push('  ! ' + why); };

/* How long to give it. Electron on a cold start with a virus scanner
   in the way is not fast, and a false failure here would send somebody
   looking for a bug that is not there. */
const ALIVE_FOR_MS = 9000;

function distDir() {
  const r = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'dist-out.js')], {
    encoding: 'utf8',
    env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }),
  });
  return (r.stdout || '').trim();
}

(async () => {
  const out = distDir();
  const unpacked = out && path.join(out, 'win-unpacked');

  if (!unpacked || !fs.existsSync(unpacked)) {
    say('a build to test', 'none — run npm run dist first');
    console.log('\nlaunching the built app\n' + steps.join('\n'));
    console.log('\nnothing to check');
    process.exit(0);
  }

  const exe = fs.readdirSync(unpacked).find((f) => f.endsWith('.exe'));
  if (!exe) {
    fail('no executable in ' + unpacked);
    console.log('\nlaunching the built app\n' + steps.join('\n'));
    console.log('\n' + problems + ' problem(s)');
    process.exit(1);
  }

  say('the built app', exe);

  /* asar is a virtual filesystem only Electron reads, so this is the one
     way to know a required module is really in there. */
  const asar = path.join(unpacked, 'resources', 'app.asar');
  if (fs.existsSync(asar)) {
    const index = fs.readFileSync(asar).slice(0, 65536).toString('utf8');
    const required = [];
    for (const f of ['electron-main.js', 'preload.js']) {
      const abs = path.join(ROOT, f);
      if (!fs.existsSync(abs)) continue;
      const src = fs.readFileSync(abs, 'utf8');
      for (const m of src.matchAll(/require\(\s*'\.\/([a-zA-Z0-9_.-]+)'\s*\)/g)) {
        const name = m[1].endsWith('.js') ? m[1] : m[1] + '.js';
        if (fs.existsSync(path.join(ROOT, name))) required.push(name);
      }
    }
    const absent = [...new Set(required)].filter((n) => index.indexOf(n) < 0);
    say('modules the shell requires are in the asar',
      absent.length ? 'MISSING: ' + absent.join(', ') : [...new Set(required)].join(', ') || 'none');
    absent.forEach((n) => fail(n + ' is required but not inside app.asar'));
  }

  /* ---- and then simply open it ---- */

  const env = Object.assign({}, process.env);
  delete env.ELECTRON_RUN_AS_NODE;      /* see the header */

  const child = spawn(path.join(unpacked, exe), [], {
    cwd: unpacked,
    env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });

  let output = '';
  child.stdout.on('data', (c) => { output += c; });
  child.stderr.on('data', (c) => { output += c; });

  let exited = null;
  child.on('exit', (code) => { exited = code; });
  child.on('error', (e) => { exited = -1; output += e.message; });

  await new Promise((r) => setTimeout(r, ALIVE_FOR_MS));

  if (exited === null) {
    say('still running after ' + (ALIVE_FOR_MS / 1000) + 's', 'yes — it starts');
    try { child.kill(); } catch (e) { /* already gone */ }
  } else {
    fail('the app exited on its own with code ' + exited
      + (output.trim() ? ' — ' + output.trim().split('\n')[0] : ' and said nothing'));
    if (output.trim()) {
      output.trim().split('\n').slice(0, 6).forEach((l) => steps.push('    ' + l));
    }
  }

  console.log('\nlaunching the built app\n' + steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
  process.exit(problems ? 1 : 0);
})();
