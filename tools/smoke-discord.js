/* ============================================================
   Smoke test — runs and deliveries reach the crew's Discord.

     npm run smoke:discord

   The service posts fleet events to a Discord webhook. Three things
   about that are worth pinning down, and only one of them is "does
   it post":

     It posts the events worth a person's attention, and NOT the
     ones that would make people mute the channel. session.start and
     session.end fire every time anybody opens or closes the game.

     A webhook URL is a credential. It must never reach a log, a
     client, or the source. Whoever holds it can post into that
     channel as this app for as long as it exists.

     Discord being slow or down must not become a failed delivery
     report. The driver's client is waiting on that request.

   The webhook here points at a local stub, so this never posts to
   the real channel however often it runs.
   ============================================================ */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const HOOK_PORT = 7186;
const FLEET_PORT = 7187;

const steps = [];
let problems = 0;
const check = (name, ok, detail) => {
  steps.push((ok ? '  ' : '! ') + name.padEnd(52) + (detail === undefined ? '' : detail));
  if (!ok) problems++;
};

const posted = [];
let stubMode = 204;

const stub = http.createServer((req, res) => {
  let body = '';
  req.on('data', (c) => { body += c; });
  req.on('end', () => {
    posted.push({ path: req.url, body });
    if (stubMode === 'hang') return;                 /* never answers */
    res.writeHead(stubMode); res.end();
  });
});

const post = (kind, extra) => new Promise((resolve) => {
  const payload = JSON.stringify(Object.assign({ kind, driver: 'Ana Vos',
    driverId: 'GMN-1001', text: kind + ' happened', from: 'Hannover', to: 'Bremen',
    cargo: 'Cut Flowers', km: 214, income: 4200 }, extra || {}));
  const r = http.request({ host: '127.0.0.1', port: FLEET_PORT, method: 'POST',
    path: '/api/fleet/event',
    headers: { 'content-type': 'application/json',
               'content-length': Buffer.byteLength(payload) } },
    (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  r.on('error', () => resolve(0));
  r.end(payload);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const log = [];
  let fleet;
  try {
    await new Promise((r) => stub.listen(HOOK_PORT, '127.0.0.1', r));
    const WEBHOOK = 'http://127.0.0.1:' + HOOK_PORT + '/webhooks/test/SECRET-TOKEN-VALUE';

    fleet = spawn(process.execPath, [path.join(ROOT, 'fleet-server.js')], {
      cwd: ROOT,
      env: Object.assign({}, process.env, {
        GMN_PORT: String(FLEET_PORT),
        GMN_DISCORD_WEBHOOK: WEBHOOK,
        GMN_COMPANY_FILE: path.join(ROOT, '.smoke-discord-company.json'),
        GMN_SESSION_FILE: path.join(ROOT, '.smoke-discord-sessions.json'),
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    fleet.stdout.on('data', (d) => log.push(String(d)));
    fleet.stderr.on('data', (d) => log.push(String(d)));
    await wait(2500);

    /* ---- the events a person wants ---- */
    const code = await post('job.delivered');
    await wait(700);
    check('a delivery reaches Discord', posted.length === 1,
      posted.length + ' post(s)');
    check('and the driver is not made to wait for it', code === 200,
      'the client got HTTP ' + code);

    if (posted.length) {
      let embed = null;
      try { embed = JSON.parse(posted[0].body).embeds[0]; } catch (e) { /* checked below */ }
      check('it arrives as a readable embed', !!embed && embed.title === 'Delivered',
        embed ? embed.title : 'UNPARSEABLE');
      const names = ((embed && embed.fields) || []).map((f) => f.name);
      check('carrying who, what and how far',
        ['Driver', 'Cargo', 'Route', 'Distance'].every((n) => names.includes(n)),
        names.join(', ') || 'no fields');
    }

    posted.length = 0;
    await post('job.start'); await wait(500);
    check('so does a run starting', posted.length === 1, posted.length + ' post(s)');

    /* ---- and the ones that would get the channel muted ---- */
    posted.length = 0;
    await post('session.start'); await post('session.end');
    await post('job.speeding'); await post('job.damage');
    await wait(700);
    check('but opening the game does not post', posted.length === 0,
      posted.length + ' post(s) — expected 0');

    /* ---- the credential ---- */
    const out = log.join('');
    check('the webhook URL is never logged', out.indexOf('SECRET-TOKEN-VALUE') === -1,
      out.indexOf('SECRET-TOKEN-VALUE') === -1 ? 'absent from the output' : 'LEAKED TO THE LOG');
    check('and the banner says whether it is on, not what it is',
      /Discord\s+:/.test(out) && out.indexOf('SECRET-TOKEN-VALUE') === -1,
      /Discord\s+:/.test(out) ? 'banner reports the mode' : 'banner says nothing');

    /* ---- Discord having a bad day ---- */
    posted.length = 0; stubMode = 500;
    const stillOk = await post('job.delivered');
    await wait(700);
    check('Discord refusing does not fail the delivery report', stillOk === 200,
      'the client got HTTP ' + stillOk);

    posted.length = 0; stubMode = 'hang';
    const hung = await post('job.delivered');
    check('nor does Discord never answering', hung === 200,
      'the client got HTTP ' + hung);
  } catch (e) {
    check('the test itself ran', false, e && e.message);
  } finally {
    if (fleet) fleet.kill();
    stub.close();
    for (const f of ['.smoke-discord-company.json', '.smoke-discord-sessions.json']) {
      try { require('fs').rmSync(path.join(ROOT, f), { force: true }); } catch (e) { /* fine */ }
    }
  }

  console.log('\nruns and deliveries reach the crew Discord');
  console.log(steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
  process.exit(problems ? 1 : 0);
})();
