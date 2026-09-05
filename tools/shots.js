/* Screenshots of the real pages.

     node_modules/electron/dist/electron.exe tools/shots.js . [outdir]

   Loads each page from the file system, waits for it to settle, and writes
   a PNG. Used to look at the design rather than reason about it — a CSS
   change that parses cleanly can still be wrong on the screen.

   The splash is captured too, in its own shot, because it is the first
   thing anybody sees and it hides itself after a moment. */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const OUT = path.resolve(process.argv[3] || path.join(ROOT, '.shots'));
const BASE = (process.env.GMN_SHOT_BASE || process.env.HLL_SHOT_BASE) || null;   /* http://host:port to shoot the served site */

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-shots'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* Sign in as the owner so the console renders something worth looking at,
   rather than the signed-out landing page. */
const ROUTE = (process.env.GMN_SHOT_ROUTE || process.env.HLL_SHOT_ROUTE) || '#/dashboard';
const SIGN_IN = `(async () => {
  const ROUTE = '${(process.env.GMN_SHOT_ROUTE || process.env.HLL_SHOT_ROUTE) || "#/dashboard"}';
  try {
    const acc = Accounts.all().find(a => a.email === 'jeffboss730@gmail.com')
             || Accounts.all()[0];
    if (acc) {
      state.user = Store.driver(acc.driverId);
      Store.writeSession({ id: acc.driverId });
    }
    const s = document.getElementById('splash');
    if (s) s.classList.add('gone');
    /* setting the hash only updates state.route on the hashchange event,
       which has not fired by the time render() runs — so set it directly */
    location.hash = ROUTE;
    state.route = parseHash();
    render();
    const view = document.querySelector('#view');
    return 'user=' + !!state.user + ' route=' + state.route.name
      + ' view=' + (view ? view.innerHTML.length : 'MISSING') + ' chars';
  } catch (e) { return 'error: ' + e.message; }
})()`;

async function shot(win, name) {
  const img = await win.webContents.capturePage();
  fs.writeFileSync(path.join(OUT, name + '.png'), img.toPNG());
  console.log('  wrote ' + name + '.png');
}

app.whenReady().then(async () => {
  fs.mkdirSync(OUT, { recursive: true });

  for (const page of ['login.html', 'admin.html', 'tracker.html']) {
    const win = new BrowserWindow({
      width: 1440, height: 900, show: false,
      webPreferences: { partition: 'shots-' + page },
    });

    win.webContents.on('console-message', (e, level, message) => {
      if (level >= 2) console.log('    console: ' + message.slice(0, 160));
    });
    if (BASE) { await win.loadURL(BASE + '/' + page); } else { await win.loadFile(path.join(ROOT, page)); }

    /* the splash, before anything dismisses it */
    await wait(700);
    await shot(win, page.replace('.html', '') + '-splash');

    /* the app has to have booted before Accounts and Store exist; give it
       time, then dismiss the splash whatever happened */
    await wait(3200);
    const signedIn = await win.webContents.executeJavaScript(SIGN_IN).catch((e) => 'threw: ' + e.message);
    console.log('    signed in: ' + signedIn);
    await win.webContents.executeJavaScript(
      '(function(){var s=document.getElementById("splash");if(s)s.remove();return true;})()').catch(() => {});
    await wait(1800);
    await shot(win, page.replace('.html', ''));

    win.destroy();
  }

  console.log('\nshots in ' + OUT + '\n');
  app.exit(0);
});
