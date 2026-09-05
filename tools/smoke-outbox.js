/* ============================================================
   Smoke test — a delivery survives Gaming Nation being down.

     node tools/smoke-outbox.js

   The claim worth testing hardest: a driver finishes an €8,450 run
   while the service happens to be restarting, and does not lose a
   penny.

   So this runs the connector against an address where nothing is
   listening, drives a whole job through it, and checks the run is
   sitting safely on disk. Then it starts the service and checks
   the run arrives and is credited without anybody doing anything.
   ============================================================ */
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const PORT = Number((process.env.GMN_SMOKE_PORT || process.env.HLL_SMOKE_PORT) || 7095);
const GAME_PORT = 25597;
const DRIVER = 'HLL-7788';
const COMPANY_FILE = path.join(os.tmpdir(), 'gmn-outbox-smoke.json');
const OUTBOX = path.join(os.tmpdir(), 'gmn-outbox-smoke-queue.json');

[COMPANY_FILE, OUTBOX].forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });

let failures = 0;
const say = console.log;
const check = (name, ok, detail) => {
  say((ok ? '  ✓  ' : '  ✗  ') + name + (detail ? ': ' + detail : ''));
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- the fake game ---- */
const truck = { running: true, speed: 0, odometer: 90000, job: null };
const game = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({
    game: { connected: truck.running, paused: false, gameName: 'ATS' },
    truck: {
      make: 'Peterbilt', model: '579', speed: truck.speed, odometer: truck.odometer,
      fuel: 400, fuelCapacity: 800, wearEngine: 0.01,
      placement: { x: 100, y: 0, z: 200, heading: 0.1 },
    },
    job: truck.job ? {
      cargo: truck.job.cargo, income: truck.job.income,
      sourceCity: truck.job.from, destinationCity: truck.job.to,
    } : {},
    navigation: { estimatedDistance: truck.job ? truck.job.remainingM : 0 },
  }));
});

const req = (method, p, body) => new Promise((done) => {
  const payload = body ? JSON.stringify(body) : null;
  const r = http.request({
    port: PORT, path: p, method,
    headers: payload
      ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      : {},
  }, (res) => {
    let raw = ''; res.setEncoding('utf8');
    res.on('data', (c) => { raw += c; });
    res.on('end', () => { try { done(JSON.parse(raw)); } catch (e) { done(raw); } });
  });
  r.on('error', () => done(null));
  r.end(payload);
});

const readQueue = () => {
  try { return JSON.parse(fs.readFileSync(OUTBOX, 'utf8')); } catch (e) { return null; }
};

(async () => {
  game.listen(GAME_PORT, '127.0.0.1');
  await wait(300);
  say('\nA delivery survives Gaming Nation being down\n');

  /* ---- the connector starts with nothing listening at the other end ---- */
  const child = spawn(process.execPath, [
    path.join(__dirname, '..', 'game-connector.js'),
    '--service', 'http://localhost:' + PORT,
    '--driver', DRIVER,
    '--name', 'Outbox Driver',
    '--telemetry-port', String(GAME_PORT),
    '--outbox', OUTBOX,
    '--poll', '300',
  ], { env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }), stdio: 'pipe' });

  let out = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c) => { out += c; });

  await wait(2500);
  check('it starts even with Gaming Nation unreachable', /GAME LAUNCHED/.test(out),
    (out.match(/GAME LAUNCHED.*/) || [''])[0].trim() || 'DID NOT START');
  check('and says so plainly', /unreachable|queued|nothing will be lost/.test(out),
    (out.match(/.*unreachable.*/) || [''])[0].trim() || 'said nothing');

  /* ---- a whole job, with nobody listening ---- */
  truck.job = { cargo: 'Reefer goods', income: 8450, from: 'Phoenix', to: 'Las Vegas',
                remainingM: 480000 };
  truck.speed = 95;
  await wait(1500);
  truck.job.remainingM = 0;
  truck.odometer += 480;
  await wait(1200);
  truck.job = null;
  truck.speed = 0;
  await wait(1800);

  check('the delivery still completes', /DELIVERY COMPLETED/.test(out),
    (out.match(/DELIVERY COMPLETED.*/) || [''])[0].trim() || 'NOT COMPLETED');

  const queued = readQueue();
  const job = (queued || []).find((q) => q.kind === 'job');
  check('and is held safely on disk', !!job,
    queued ? queued.length + ' item(s) queued' : 'NO OUTBOX FILE');
  check('with the money intact',
    !!job && job.body.job.income === 8450 && job.body.job.km === 480,
    job ? job.body.job.km + ' km, ' + job.body.job.income : '-');
  check('and its evidence intact',
    !!job && job.body.job.evidence && job.body.job.evidence.frames > 0,
    job && job.body.job.evidence ? job.body.job.evidence.frames + ' frames' : '-');
  /* no job number could be fetched, so it took a local one and said so —
     the run still happens, and still lands, under a number marked as local */
  check('an unreachable service does not stop the run getting a number',
    !!job && /^GMN-L/.test(job.body.job.id), job ? job.body.job.id : '-');

  /* ---- Gaming Nation comes back ---- */
  say('');
  say('  (starting Gaming Nation)');
  const server = spawn(process.execPath, [
    path.join(__dirname, '..', 'fleet-server.js'), '--port', String(PORT),
  ], {
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1', GMN_COMPANY_FILE: COMPANY_FILE,
    }),
    stdio: 'ignore',
  });
  await wait(1500);

  await req('PUT', '/api/company', {
    version: 0,
    data: {
      drivers: [{ id: DRIVER, name: 'Outbox Driver', km: 0, deliveries: 0, earned: 0 }],
      jobs: [],
    },
  });

  /* nobody touches the connector — it should notice and drain by itself */
  await wait(6000);

  /* matched on the whole phrase: "reachable" alone also matches the
     "unreachable" line above it, which would pass without proving anything */
  check('the connector notices Gaming Nation is back', /Gaming Nation reachable/.test(out),
    (out.match(/.*Gaming Nation reachable.*/) || [''])[0].trim() || 'DID NOT NOTICE');

  const after = readQueue();
  check('the queue drains on its own', Array.isArray(after) && after.length === 0,
    Array.isArray(after) ? after.length + ' left' : 'unreadable');

  const company = await req('GET', '/api/company');
  const filed = ((company && company.data && company.data.jobs) || [])[0];
  check('the run reaches the company record', !!filed,
    filed ? filed.from + ' -> ' + filed.to : 'NOT RECORDED');
  check('with nothing lost',
    !!filed && filed.income === 8450 && filed.km === 480 && filed.cargo === 'Reefer goods',
    filed ? filed.cargo + ', ' + filed.km + ' km, ' + filed.income : '-');

  const d = ((company && company.data && company.data.drivers) || [])
    .find((x) => x.id === DRIVER);
  check('and the driver is paid', !!d && d.earned === 8450 && d.deliveries === 1,
    d ? d.deliveries + ' run, ' + d.earned : 'NOT CREDITED');

  child.kill();
  try { server.kill(); } catch (e) {}
  game.close();
  [COMPANY_FILE, OUTBOX].forEach((f) => { try { fs.unlinkSync(f); } catch (e) {} });
  say('\n' + (failures ? failures + ' failed\n' : 'all passed\n'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { say('\n  ERROR  ' + e.stack + '\n'); process.exit(1); });
