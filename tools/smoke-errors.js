/* Runtime error sweep.

   The static audit in tools/scan.js can only see what the source says. This
   runs the real thing: it walks every screen of a page and clicks every
   control it finds, recording anything the console complains about and any
   exception a handler throws. Nothing here asserts behaviour — it is looking
   for things that break.

     node_modules/electron/dist/electron.exe tools/smoke-errors.js . [page]
*/
const { app, BrowserWindow } = require('electron');
const path = require('path');

/* resolved, not taken as given: 'npm run smoke:*' passes '.', and a relative
   root turns require(ROOT + '/desktop-capture') into a bare module name */
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const PAGES = process.argv[3] ? [process.argv[3]] : ['login.html', 'admin.html', 'tracker.html'];

app.setPath('userData', path.join(app.getPath('temp'), 'hll-smoke-errors'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

/* Things that would end the walk rather than exercise it: signing out, wiping
   the store, leaving the page — and anything that opens a dialog owned by the
   operating system, which nobody is here to dismiss. */
const SKIP = [
  'logout', 'switch-account', 'reset-demo', 'reset-app', 'site-admin',
  'site-drivers', 'export-data', 'install-app', 'copy-error', 'toggle-server',
  'browse-exe', 'detect-exe', 'launch-game',
  /* asks the server for a signed link and then navigates to it, which
     ends the walk — and off a served page it would start an 80 MB
     download. The gate itself is covered by npm run smoke:downloads. */
  'download-client',
];

const WALK = `(async (skip) => {
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));
  const seen = new Set();
  const out = { clicked: 0, screens: 0, thrown: [] };

  const signIn = async () => {
    if (typeof Auth !== 'undefined' && Auth.accounts) {           /* the client */
      const acc = Auth.accounts().find((a) => a.email === 'jeffboss730@gmail.com');
      if (acc) Auth.signIn(acc, Auth.driverRecord(acc.driverId), false);
    } else if (typeof Accounts !== 'undefined') {                 /* the websites */
      const acc = Accounts.all().find((a) => a.email === 'jeffboss730@gmail.com');
      if (acc) state.user = Store.driver(acc.driverId);
    }
    render(); await wait(400);
  };

  /* Describes a control by what it does rather than by its element: clicking
     one re-renders the screen, which detaches every other node we are holding.
     So each control is looked up again, immediately before it is clicked. */
  const describe = (el) => {
    const d = el.dataset;
    return ['[data-act="' + d.act + '"]',
      d.id ? '[data-id="' + CSS.escape(d.id) + '"]' : '',
      d.tab ? '[data-tab="' + d.tab + '"]' : '',
      d.view ? '[data-view="' + d.view + '"]' : '',
      d.v ? '[data-v="' + d.v + '"]' : '',
      d.kind ? '[data-kind="' + d.kind + '"]' : '',
      d.href ? '[data-href="' + CSS.escape(d.href) + '"]' : ''].join('');
  };

  const clickAll = async (label) => {
    const wanted = [...document.querySelectorAll('[data-act]')]
      .filter((el) => !skip.includes(el.dataset.act))
      .map(describe);

    for (const sel of [...new Set(wanted)]) {
      const key = label + ' ' + sel;
      if (seen.has(key)) continue;
      seen.add(key);
      let el = null;
      try { el = document.querySelector(sel); } catch (e) { continue; }
      if (!el) continue;                       /* the screen moved on without it */
      try {
        el.click();
        out.clicked++;
        await wait(60);
        /* close anything the click opened so the next one is reachable */
        if (typeof closeAllLayers === 'function') closeAllLayers();
        else if (typeof closeModals === 'function') closeModals();
        await wait(30);
      } catch (e) {
        out.thrown.push(label + ' -> ' + sel + ': ' + (e && e.message));
      }
    }
  };

  await signIn();

  /* every screen the shell can reach */
  const screens = typeof VIEWS !== 'undefined' ? Object.keys(VIEWS)
    : Object.keys(ROUTES).filter((r) => !ROUTES[r].hidden);
  for (const v of screens) {
    try {
      if (typeof VIEWS !== 'undefined') { state.view = v; render(); }
      else go('#/' + v);
      await wait(220);
      out.screens++;
      if (document.body.textContent.includes('Something went wrong')
        || document.body.textContent.includes('This page could not be drawn')) {
        out.thrown.push('screen ' + v + ' rendered an error state');
      }
      await clickAll(v);
      /* the click walk may have navigated away — come back */
      if (typeof VIEWS !== 'undefined') { state.view = v; render(); } else { go('#/' + v); }
      await wait(120);
    } catch (e) {
      out.thrown.push('screen ' + v + ': ' + (e && e.message));
    }
  }

  /* and every tab of the console */
  const tabs = [...document.querySelectorAll('[data-act="admin-tab"]')].map((b) => b.dataset.tab);
  for (const t of tabs) {
    try {
      state.ui.adminTab = t; render(); await wait(200);
      await clickAll('admin/' + t);
    } catch (e) { out.thrown.push('admin tab ' + t + ': ' + (e && e.message)); }
  }
  return out;
})(${JSON.stringify(SKIP)})`;

app.whenReady().then(async () => {
  let problems = 0;

  for (const page of PAGES) {
    const win = new BrowserWindow({
      width: 1400, height: 950, show: false,
      webPreferences: { preload: path.join(ROOT, 'preload.js') },
    });
    const noise = [];
    win.webContents.on('console-message', (_e, level, msg, line, src) => {
      /* level 2 = warning, 3 = error */
      if (level < 2) return;
      if (/Content-Security-Policy|Autofill|DevTools/.test(msg)) return;
      noise.push({ level: level === 3 ? 'error' : 'warn', msg: String(msg).slice(0, 300), src, line });
    });
    win.webContents.on('render-process-gone', (_e, d) => {
      noise.push({ level: 'error', msg: 'renderer gone: ' + d.reason });
    });

    await win.loadFile(path.join(ROOT, page));
    await new Promise((r) => setTimeout(r, 1600));

    /* a control that hangs must fail the sweep, not stall it forever */
    let res;
    try {
      res = await Promise.race([
        win.webContents.executeJavaScript(WALK),
        new Promise((_r, rej) => setTimeout(() => rej(new Error('the walk did not finish within 120s — '
          + 'something it clicked is still waiting')), 120000)),
      ]);
    } catch (e) {
      res = { clicked: 0, screens: 0, thrown: ['walk failed: ' + e.message] };
    }

    const errors = noise.filter((n) => n.level === 'error');
    const warns = noise.filter((n) => n.level === 'warn');
    console.log(`\n${page}`);
    console.log(`  ${res.screens} screens · ${res.clicked} controls clicked`);
    res.thrown.forEach((t) => { problems++; console.log('  ✗ ' + t); });
    errors.forEach((e) => { problems++; console.log(`  ✗ console error: ${e.msg}${e.src ? '  (' + String(e.src).split(/[\\/]/).pop() + ':' + e.line + ')' : ''}`); });
    warns.forEach((w) => console.log(`  · warning: ${w.msg}`));
    if (!res.thrown.length && !errors.length) console.log('  no errors');
    win.destroy();
  }

  console.log(problems ? `\n${problems} problem(s)\n` : '\nclean\n');
  app.exit(problems ? 1 : 0);
});
