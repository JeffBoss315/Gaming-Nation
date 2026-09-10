/* ============================================================
   Smoke test — the client knows when it is out of date.

     npm run smoke:update

   The website publishes the build it is offering at
   /version.json and the client compares it to its own, so a
   driver is told their copy is behind rather than finding out
   when something does not work.

   THE FAILURE THIS EXISTS TO PREVENT is not "it says the wrong
   version". It is a check that cannot reach the site and reports
   nothing, which reads as up to date - somebody running old code
   with a screen that says everything is fine. So "could not ask"
   is a third answer here, never folded into "current", and the
   tooltip says so in those words.

   The other one worth pinning is the comparison itself. Done as
   text, '1.0.10' sorts BELOW '1.0.9', so the client would call
   the newest build old and nag every driver on it forever.

   The feed is served by a local stub, so this never depends on
   the real site being up or on what it currently offers.
   ============================================================ */
const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const http = require('http');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const FEED_PORT = 7191;

const steps = [];
let problems = 0;
const check = (name, ok, detail) => {
  steps.push((ok ? '  ' : '! ') + String(name).padEnd(52)
    + (detail === undefined ? '' : detail));
  if (!ok) problems++;
};

let mode = { status: 200, body: JSON.stringify({ version: '9.9.9' }) };
const feed = http.createServer((req, res) => {
  if (mode.hang) return;
  res.writeHead(mode.status, { 'content-type': 'application/json' });
  res.end(mode.body);
});

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-update'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  await new Promise((r) => feed.listen(FEED_PORT, '127.0.0.1', r));
  const FEED = 'http://127.0.0.1:' + FEED_PORT + '/version.json';

  /* The REAL handler, not a stand-in: the same module electron-main
     registers, reached the same way the client reaches it. */
  require(path.join(ROOT, 'update-check')).register(ipcMain);

  /* The shell registers a dozen other channels and this harness is not the
     shell. Signing in starts the client's services, which call several of
     them; unhandled, each one is an unhandled rejection in the renderer and
     the "no errors" check below stops meaning anything. Answered with the
     shape each caller expects, so nothing here is testing a stub - the
     handler under test is the real one above. */
  const stubs = {
    'service:status': () => ({ running: false }),
    'service:start': () => ({ error: 'not in this harness' }),
    'service:stop': () => ({ ok: true }),
    'game:running': () => ({ ok: false }),
    'game:autoDetect': () => null,
    'game:profiles': () => [],
    'game:icon': () => null,
    'telemetry:adapter': () => ({ running: false, reason: 'not in this harness' }),
    'fs:exists': () => false,
  };
  Object.keys(stubs).forEach((ch) => ipcMain.handle(ch, stubs[ch]));

  const win = new BrowserWindow({
    width: 1100, height: 800, show: false,
    webPreferences: { preload: path.join(ROOT, 'preload.js') },
  });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Electron Security Warning/.test(msg)) errors.push(msg);
  });

  await win.loadFile(path.join(ROOT, 'tracker.html'));
  await new Promise((r) => setTimeout(r, 1600));
  const run = (js) => win.webContents.executeJavaScript(js);

  /* point the client at the stub */
  await run(`(() => { window.__FEED = ${JSON.stringify(FEED)};
    Updates.fetch = () => window.gmnDesktop.latestVersion(window.__FEED);
    return 1; })()`);

  /* Long enough for the answer being tested. A host that never replies is
     only known to be unreachable once the six-second timeout in
     update-check.js fires, and waiting less would read the PREVIOUS
     answer and call the test passed. */
  const ask = async (waitMs) => {
    await run('Updates.at = 0; Updates.check(true)');
    await new Promise((r) => setTimeout(r, waitMs || 900));
    return run(`JSON.parse(JSON.stringify({ state: Updates.state,
      latest: Updates.latest, reason: Updates.reason, chip: Updates.chip() }))`);
  };

  try {
    /* ---- the comparison, before anything talks to a network ---- */
    const cmp = await run(`[
      Updates.compare('V1.0.3', '1.0.4'),
      Updates.compare('V1.0.4', '1.0.4'),
      Updates.compare('V1.0.5', '1.0.4'),
      Updates.compare('V1.0.9', '1.0.10'),
      Updates.compare('V1.2.0', '1.10.0'),
    ]`);
    check('older reads as older', cmp[0] === -1, '1.0.3 vs 1.0.4');
    check('the same reads as the same', cmp[1] === 0, '1.0.4 vs 1.0.4');
    check('newer reads as newer', cmp[2] === 1, '1.0.5 vs 1.0.4');
    check('1.0.9 is BELOW 1.0.10, not above it', cmp[3] === -1,
      cmp[3] === -1 ? 'compared as numbers' : 'COMPARED AS TEXT');
    check('and 1.2 is below 1.10', cmp[4] === -1, '1.2.0 vs 1.10.0');

    /* ---- behind ---- */
    mode = { status: 200, body: JSON.stringify({ version: '9.9.9', downloads: 'https://example.test/#/download' }) };
    let r = await ask();
    check('a newer build on the site reads as behind', r.state === 'behind',
      r.state + ' — site has ' + r.latest);
    check('and the status bar says Outdated, in words',
      r.chip.cls === 'warn' && /Outdated/.test(r.chip.text), r.chip.text);
    check('with both versions in the tooltip',
      r.chip.title.indexOf('9.9.9') > -1 && r.chip.title.indexOf('V') > -1,
      r.chip.title.slice(0, 80));

    /* chip() being right is not the same as it reaching the screen - the
       status bar and the rail interpolate it, and a typo there is silent. */
    const shown = await run(`(() => {
      const a = Auth.accounts()[0];
      if (a) Auth.signIn(a, Auth.driverRecord(a.driverId), false);
      state.view = 'dashboard';
      render();
      return {
        bar: (document.querySelector('.statusbar') || {}).innerText || '',
        rail: (document.querySelector('.rail-build') || {}).innerText || '',
        clickable: !!document.querySelector('[data-act="open-update"]'),
      };
    })()`);
    check('and it actually reaches the status bar',
      /Outdated/.test(shown.bar), shown.bar.split(String.fromCharCode(10)).pop());
    check('and sits beside the driver’s own name',
      /outdated/i.test(shown.rail), shown.rail || 'NOTHING IN THE RAIL');
    check('and it is something you can press',
      shown.clickable === true, 'opens the download page');

    /* ---- current ---- */
    const mine = await run('APP_VERSION');
    mode = { status: 200, body: JSON.stringify({ version: String(mine).replace(/^V/, '') }) };
    r = await ask();
    check('the same build reads as current', r.state === 'current',
      r.state + ' — both ' + mine);
    check('and the bar goes back to just the build number',
      r.chip.cls !== 'warn' && !/Outdated/.test(r.chip.text), r.chip.text);

    /* ---- an older site than this client ---- */
    mode = { status: 200, body: JSON.stringify({ version: '0.0.1' }) };
    r = await ask();
    check('a client ahead of the site is not called old', r.state === 'current',
      r.state + ' — this is ' + mine + ', site offers 0.0.1');

    /* ---- and the answer that matters: could not ask ---- */
    for (const [what, m] of [
      ['the site is down', { status: 503, body: 'nope' }],
      ['it answers something else', { status: 200, body: '<html>not json</html>' }],
      ['it never answers at all', { hang: true }],
    ]) {
      mode = m;
      r = await ask(m.hang ? 8000 : 900);
      check('  ' + what + ' is not "up to date"', r.state === 'unreachable',
        r.state === 'unreachable' ? r.reason : 'CLAIMED ' + r.state);
      check('  and the tooltip says so in those words',
        /not the same as being up to date/.test(r.chip.title),
        r.chip.title.slice(0, 60));
    }

    check('the renderer logged no errors', errors.length === 0,
      errors.length ? errors.slice(0, 2).join(' | ') : 'none');
  } catch (e) {
    check('the test itself ran', false, (e && e.message) || String(e));
  } finally {
    feed.close();
  }

  console.log('\nthe client knows when it is out of date');
  console.log(steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
  app.exit(problems ? 1 : 0);
});
