/* ============================================================
   Smoke test — the app hosting the company service itself.

     npm run smoke:host

   The commonest report about chat was that it did not work, and
   the commonest reason was that nothing was running the service
   it runs on. The answer used to be "type npm run fleet", which
   is not an answer you can give a driver who installed an app.

   So the desktop build can start it. This checks the part that
   would fail silently on somebody else's machine:

     1. the script is actually findable — it is asarUnpack'd, and
        a path that resolves in a checkout and not in an install
        is the whole failure mode here
     2. starting it produces a service that answers
     3. it writes to userData, not next to the executable, because
        Program Files is not writable and the failure would be a
        service that starts and then dies on first write
     4. stopping it stops it — a leftover server holding port 7040
        is worse than none, since the next start silently fails
     5. --lan reports an address to give the rest of the crew

   Run as an Electron main process because service-host.js needs
   app.getPath('userData'). No window is opened: the module is
   deliberately separate from the IPC that exposes it so this can
   call it directly.
   ============================================================ */
const { app } = require('electron');
const path = require('path');
const fs = require('fs');
const http = require('http');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-host'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const steps = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(46) + v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let problems = 0;
const fail = (why) => { problems++; steps.push('  ! ' + why); };
const check = (what, ok, detail) => {
  say(what, detail);
  if (!ok) fail(what);
};

/* Does anything answer on the port, and is it ours? */
const ping = (port) => new Promise((done) => {
  const req = http.get({ host: '127.0.0.1', port, path: '/status', timeout: 2500 }, (res) => {
    let body = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { body += c; });
    res.on('end', () => done({ status: res.statusCode, body }));
  });
  req.on('timeout', () => { req.destroy(); done({ status: 0, body: '' }); });
  req.on('error', () => done({ status: 0, body: '' }));
});

app.whenReady().then(async () => {
  const host = require(path.join(ROOT, 'service-host.js'));

  /* A port of its own: 7040 is the real one and a developer may well have
     it open, which would make this test pass against somebody else's
     service and prove nothing. */
  const PORT = Number((process.env.GMN_HOST_SMOKE_PORT || process.env.HLL_HOST_SMOKE_PORT) || 7089);

  try {
    /* ---- 1. is the service even shipped? ---- */

    const script = host.serviceScript();
    check('the service script is findable', !!script,
      script ? path.basename(script) : 'NOT FOUND — asarUnpack missing?');

    if (!script) throw new Error('nothing to start');

    /* Nothing of ours should be up yet; if something is, every check
       below would be reading somebody else's server. */
    const before = await ping(PORT);
    check('the port is free to begin with', before.status === 0,
      before.status ? 'SOMETHING IS ALREADY ON ' + PORT : 'free');

    /* ---- 2. it starts, and answers ---- */

    const started = host.startService({ port: PORT, lan: false });
    check('starting it reports no error', !started.error, started.error || 'started');

    let up = { status: 0 };
    for (let i = 0; i < 20 && up.status !== 200; i++) {
      await wait(300);
      up = await ping(PORT);
    }
    check('the service answers', up.status === 200, 'HTTP ' + up.status);

    /* ---- 3. it writes somewhere writable ---- */

    const dir = path.join(app.getPath('userData'), 'company-service');
    check('it keeps its files under userData', fs.existsSync(dir),
      fs.existsSync(dir) ? path.basename(path.dirname(dir)) + '/company-service' : 'MISSING');

    /* Beside the executable is Program Files on an installed copy, which
       is not writable — a service that starts and then cannot save is the
       failure this guards. */
    check('and not beside the script',
      !fs.existsSync(path.join(path.dirname(script), 'gmn-company.json'))
      || path.dirname(script) === ROOT,
      'checked');

    const st = host.status();
    check('status reports it running', st.running && st.port === PORT,
      st.running ? 'on ' + st.port : 'NOT RUNNING');

    /* ---- 4. stopping it actually stops it ---- */

    host.stopService();

    let down = { status: 200 };
    for (let i = 0; i < 20 && down.status !== 0; i++) {
      await wait(300);
      down = await ping(PORT);
    }
    check('stopping it frees the port', down.status === 0,
      down.status ? 'STILL ANSWERING' : 'stopped');
    check('and status agrees', !host.status().running,
      host.status().running ? 'STILL SAYS RUNNING' : 'stopped');

    /* ---- 5. hosting for the crew reports an address ---- */

    const lan = host.startService({ port: PORT, lan: true });
    check('it can host for the whole network', !lan.error, lan.error || 'listening on 0.0.0.0');

    const addr = host.lanAddress(PORT);
    /* A machine with no network at all has none to report, and that is a
       fact about the machine rather than a failure of this. */
    say('an address to give the crew', addr || '(no network interface)');

    host.stopService();

  } catch (err) {
    fail('the walk stopped: ' + (err && err.message ? err.message : err));
  }

  /* Whatever happened above, leave no server behind: one still holding
     the port makes the NEXT run fail on a check that has nothing to do
     with what is broken. */
  try { host.stopService(); } catch (e) { /* never started */ }

  console.log('\nhosting the company service\n' + steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');

  app.exit(problems ? 1 : 0);
});
