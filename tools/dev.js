/* ============================================================
   Run the whole thing.

     npm run dev

   Starts the two processes the platform needs and stops them
   together:

     the company service   localhost:7040   accounts, messaging, the
                                            shared company, the live feed
     the dev server        localhost:5173   the website and the console,
                                            reloading as you save

   Both are already startable on their own — npm run service and
   npm run serve. What this adds is that they come up together, that
   Ctrl+C takes both down rather than leaving one holding a port, and
   that a crash in either is said out loud instead of the system going
   quietly half-dead.

   Why the order matters: the pages ask localhost:7040 whether the
   service is there, once, at boot. Started second, it would be missed
   and every page would decide it was working alone.
   ============================================================ */
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');

const ROOT = path.join(__dirname, '..');
const SERVICE_PORT = Number(process.env.HLL_PORT || 7040);
const SITE_PORT = Number(process.env.HLL_SITE_PORT || 5173);

const children = [];
let stopping = false;

function start(name, file, args) {
  const child = spawn(process.execPath, [path.join(ROOT, file)].concat(args || []), {
    cwd: ROOT,
    stdio: ['ignore', 'pipe', 'pipe'],
    /* Electron sets this for its own child processes, and inheriting it
       makes plain node behave oddly here. */
    env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: undefined }),
  });

  const tag = (line) => '  [' + name + '] ' + line;
  const pipe = (stream, to) => {
    let buf = '';
    stream.on('data', (d) => {
      buf += d.toString();
      const lines = buf.split('\n');
      buf = lines.pop();
      lines.forEach((l) => { if (l.trim()) to(tag(l.trimEnd())); });
    });
  };
  pipe(child.stdout, (l) => console.log(l));
  pipe(child.stderr, (l) => console.error(l));

  child.on('exit', (code, signal) => {
    if (stopping) return;
    console.error('\n  ' + name + ' stopped'
      + (signal ? ' (' + signal + ')' : ' with code ' + code)
      + ' — shutting the rest down so this is not missed.\n');
    stop(1);
  });

  child.on('error', (err) => {
    if (stopping) return;
    console.error('\n  could not start ' + name + ': ' + err.message + '\n');
    stop(1);
  });

  children.push({ name, child });
  return child;
}

function stop(code) {
  if (stopping) return;
  stopping = true;
  for (const { child } of children) {
    try { child.kill(); } catch (e) { /* already gone */ }
  }
  /* Give them a moment to go on their own before the process ends. */
  setTimeout(() => process.exit(code), 250);
}

process.on('SIGINT', () => { console.log('\n  stopping…'); stop(0); });
process.on('SIGTERM', () => stop(0));

/* Waits for the service to answer, so the pages find it on their first ask. */
function waitFor(port, tries, done) {
  const attempt = (left) => {
    const req = http.get({ host: '127.0.0.1', port, path: '/status', timeout: 800 }, (res) => {
      res.resume();
      done(true);
    });
    req.on('error', () => { left > 0 ? setTimeout(() => attempt(left - 1), 200) : done(false); });
    req.on('timeout', () => { req.destroy(); });
  };
  attempt(tries);
}

console.log('\n  Gaming Nation — starting\n');

start('service', 'fleet-server.js', ['--port', String(SERVICE_PORT)]);

waitFor(SERVICE_PORT, 25, (up) => {
  if (stopping) return;

  if (!up) {
    console.warn('  the company service did not answer on ' + SERVICE_PORT + ' —'
      + ' starting the site anyway,\n  but accounts and messaging will be offline.\n');
  }

  start('site', 'serve.js', ['--port', String(SITE_PORT)]);

  setTimeout(() => {
    if (stopping) return;
    console.log('');
    console.log('  Website   http://localhost:' + SITE_PORT + '/');
    console.log('  Console   http://localhost:' + SITE_PORT + '/admin.html');
    console.log('  Client    http://localhost:' + SITE_PORT + '/tracker.html');
    console.log('  Service   http://localhost:' + SERVICE_PORT + '/status');
    console.log('');
    console.log('  Save a file and the page follows. Ctrl+C stops both.');
    console.log('');
  }, 700);
});
