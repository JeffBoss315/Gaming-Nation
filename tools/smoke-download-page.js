/* The downloads page, against the hosts this site is actually deployed to.

     npm run smoke:downloadpage

   The bug this exists to prevent, because it cost a working download and
   looked like a server fault:

     netlify.toml and vercel.json both rewrite every unknown path to
     login.html with a 200. So on a host where the download Function is
     not deployed, POST /api/download-link does not answer 404 — it
     answers 200 with a PAGE. Code that only checked the status believed
     the service had replied, failed to parse HTML as JSON, and told the
     driver "the download service did not answer" while refusing to hand
     over a file that was sitting there in public.

   What separates "no Function here" from "the Function refused you" is
   not the status. It is whether the reply is JSON. Four hosts are stood
   up here, one per behaviour, and the page is driven against each.

   npm run smoke:downloads covers the Function itself; this covers the
   page's half of the conversation.
*/
const { app, BrowserWindow } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const PORT = Number((process.env.GMN_DLPAGE_PORT || process.env.HLL_DLPAGE_PORT) || 7099);

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-dlpage'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const steps = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(46) + v);

function check(what, got, want) {
  if (String(got) === String(want)) say(what, String(got));
  else fails.push(what + ': expected ' + want + ', got ' + got);
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.jpg': 'image/jpeg',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
};

/* mode is swapped between runs; one server, four behaviours */
let mode = 'spa';

const server = http.createServer((req, res) => {
  if (req.url.startsWith('/api/download-link')) {
    if (mode === '404') { res.writeHead(404); return res.end('nope'); }

    /* The readiness probe the page sends before anything is pressed —
       but ONLY where a Function exists. In 'spa' this path has to keep
       answering with a page, because that is the whole case it stands
       for: a host that rewrites a missing endpoint into login.html. */
    if (req.method === 'GET' && mode !== 'spa') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ gate: mode === 'halfbuilt' ? 'off' : 'on' }));
    }

    const answer = (status, body) => {
      let b = '';
      req.on('data', (c) => { b += c; });
      req.on('end', () => {
        res.writeHead(status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(body));
      });
    };

    if (mode === 'json') return answer(200, { url: '/files/pretend.exe', expiresIn: 300 });

    /* deployed, but with no secret and no bucket: it must step aside */
    if (mode === 'halfbuilt') return answer(200, { gate: 'off', reason: 'no bucket' });
    if (mode === 'refuse') return answer(403, { error: 'Your application has not been approved yet.' });

    /* 'spa' — exactly what the deploy configs do */
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    return res.end(fs.readFileSync(path.join(ROOT, 'login.html')));
  }

  const p = req.url === '/' ? '/login.html' : req.url.split('?')[0];
  const file = path.join(ROOT, decodeURIComponent(p));

  fs.readFile(file, (err, data) => {
    if (err) {   /* the same rewrite, for everything else */
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(fs.readFileSync(path.join(ROOT, 'login.html')));
    }
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' });
    res.end(data);
  });
});

const DRIVE = `
  (async function () {
    var s = document.getElementById('splash'); if (s) s.classList.add('gone');

    /* a signed-in driver, which is what request() expects to find */
    window.gmnSupabase = { auth: { getSession: async () => ({
      data: { session: { access_token: 'test-token' } } }) } };

    var toasts = [];
    window.toast = function (a, b, c) { toasts.push(a + ' | ' + (c || '')); };

    /* location.href cannot be stubbed, so the public URL is observed by
       intercepting the call that builds it. */
    var asked = null;
    var real = clientDownloadUrl;
    window.clientDownloadUrl = function (b) { asked = real(b); return 'about:blank'; };

    Downloads.gated = 'unknown';
    await Downloads.check();
    var gated = Downloads.gated;

    /* What a staff member is told about the gate, and whether the wording
       matches where they are. The test server answers on 127.0.0.1, so
       isLocal() is true here and the alarming version must NOT appear. */
    state.user = Object.assign({}, state.user || {}, { role: 'super_admin' });
    var page = (typeof viewDownloads === 'function') ? viewDownloads() : '';
    var banner = /not running on this site/.test(page) ? 'deployed-warning'
      : /ungated on this machine/.test(page) ? 'local-note'
      : 'none';

    await Downloads.request('win-setup');

    return JSON.stringify({ gated: gated, toasts: toasts, asked: asked, banner: banner });
  })();
`;

async function run(win, which) {
  mode = which;
  await win.loadURL('http://127.0.0.1:' + PORT + '/login.html?m=' + which);
  await wait(1500);
  return JSON.parse(await win.webContents.executeJavaScript(DRIVE, true));
}

app.whenReady().then(async () => {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));

  const win = new BrowserWindow({ width: 1100, height: 800, show: false });

  try {
    /* ---- the host that rewrites everything: the one that broke ---- */
    const spa = await run(win, 'spa');
    check('a page answering the API is not a gate', spa.gated, 'off');
    check('and the driver still gets their download',
      /Gaming-Nation-Trucker-1\.0\.0-windows-setup\.exe$/.test(spa.asked || ''), 'true');
    check('with nothing shouted at them', spa.toasts.length, 0);

    /* The banner has to know the difference between "there is no gate on
       this machine, as designed" and "there is no gate on the live site".
       Warning an owner about production while they look at localhost is
       alarming about the wrong thing, and unactionable where they are. */
    check('and a local copy is told so calmly', spa.banner, 'local-note');

    /* ---- a plain static host ---- */
    const notFound = await run(win, '404');
    check('a 404 is not a gate either', notFound.gated, 'off');
    check('and the download still works',
      /windows-setup\.exe$/.test(notFound.asked || ''), 'true');

    /* ---- the Function actually there, and allowing ---- */
    const ok = await run(win, 'json');
    check('a JSON answer IS the gate', ok.gated, 'on');
    check('and a working gate says nothing at all', ok.banner, 'none');
    check('and the public URL is never touched', ok.asked, 'null');
    check('nothing is refused', ok.toasts.length, 0);

    /* ---- the Function deployed but not able to gate ----
       The state a half-finished setup is actually in, and the one that
       must not lock everybody out. */
    const half = await run(win, 'halfbuilt');
    check('a gate that cannot gate says so', half.gated, 'off');
    check('and the download still works',
      /windows-setup\.exe$/.test(half.asked || ''), 'true');
    check('without refusing anybody', half.toasts.length, 0);

    /* ---- the Function there, and refusing ---- */
    const no = await run(win, 'refuse');
    check('a refusal is honoured', no.gated, 'on');
    check('the public URL is still never touched', no.asked, 'null');
    check('and the reason is the one the service gave',
      (no.toasts[0] || '').includes('has not been approved'), 'true');

  } catch (err) {
    fails.push('the walk stopped: ' + (err && err.message ? err.message : err));
  }

  console.log('\ndownloads page\n' + steps.join('\n'));

  if (fails.length) {
    console.log('\n' + fails.length + ' problem(s)');
    fails.forEach((f) => console.log('  ' + f));
  } else {
    console.log('\nclean');
  }

  server.close();
  app.exit(fails.length ? 1 : 0);
});
