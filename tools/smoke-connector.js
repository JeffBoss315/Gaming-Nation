/* ============================================================
   Smoke test — the Game Connector.

     node tools/smoke-connector.js

   Stands up the real company service and a fake game, then runs
   game-connector.js as a separate process exactly as a driver
   would, and checks that a whole run reaches Gaming Nation through
   it: the game being seen, the driver appearing on the board, a
   job being taken and tracked, and the delivery being filed and
   credited through the API.

   Plain node — no electron, no browser, no dependencies.
   ============================================================ */
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const FLEET_PORT = Number((process.env.GMN_SMOKE_PORT || process.env.HLL_SMOKE_PORT) || 7096);
const GAME_PORT = 25598;
const COMPANY_FILE = path.join(os.tmpdir(), 'hll-connector-smoke.json');
const DRIVER = 'HLL-4242';

try { fs.unlinkSync(COMPANY_FILE); } catch (e) { /* first run */ }

process.env.GMN_COMPANY_FILE = COMPANY_FILE;
process.argv = [process.argv[0], 'fleet-server.js', '--port', String(FLEET_PORT)];

const say = console.log;
console.log = () => {};
require(path.join(__dirname, '..', 'fleet-server.js'));
console.log = say;

let failures = 0;
const check = (name, ok, detail) => {
  say((ok ? '  ✓  ' : '  ✗  ') + name + (detail ? ': ' + detail : ''));
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---- the fake game ---- */
const truck = { running: true, speed: 0, odometer: 250000, job: null };
const game = http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
  res.end(JSON.stringify({
    game: { connected: truck.running, paused: false, gameName: 'ETS2' },
    truck: {
      make: 'Volvo', model: 'FH16', speed: truck.speed, odometer: truck.odometer,
      fuel: 700, fuelCapacity: 1000,
      wearEngine: 0.02, wearTransmission: 0, wearCabin: 0, wearChassis: 0, wearWheels: 0,
      placement: { x: 5000, y: 0, z: -3000, heading: 0.5 },
    },
    job: truck.job ? {
      cargo: truck.job.cargo, income: truck.job.income,
      sourceCity: truck.job.from, destinationCity: truck.job.to,
    } : {},
    navigation: { estimatedDistance: truck.job ? truck.job.remainingM : 0, speedLimit: 90 },
  }));
});

const req = (method, p, body) => new Promise((done, fail) => {
  const payload = body ? JSON.stringify(body) : null;
  const r = http.request({
    port: FLEET_PORT, path: p, method,
    headers: payload
      ? { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) }
      : {},
  }, (res) => {
    let raw = ''; res.setEncoding('utf8');
    res.on('data', (c) => { raw += c; });
    res.on('end', () => { try { done(JSON.parse(raw)); } catch (e) { done(raw); } });
  });
  r.on('error', fail);
  r.end(payload);
});

(async () => {
  game.listen(GAME_PORT, '127.0.0.1');
  await wait(300);
  say('\nGaming Nation Game Connector\n');

  /* a company for the run to be filed against */
  await req('PUT', '/api/company', {
    version: 0,
    data: {
      drivers: [{ id: DRIVER, name: 'Connector Driver', km: 0, deliveries: 0, earned: 0 }],
      jobs: [],
    },
  });

  /* run the connector exactly as a driver would */
  const child = spawn(process.execPath, [
    path.join(__dirname, '..', 'game-connector.js'),
    '--service', 'http://localhost:' + FLEET_PORT,
    '--driver', DRIVER,
    '--name', 'Connector Driver',
    '--telemetry-port', String(GAME_PORT),
    '--poll', '300',
  ], { env: Object.assign({}, process.env, { ELECTRON_RUN_AS_NODE: '1' }), stdio: 'pipe' });

  let out = '';
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (c) => { out += c; });
  child.stderr.setEncoding('utf8');
  child.stderr.on('data', (c) => { out += c; });

  await wait(2200);
  check('it sees the game come up', /GAME LAUNCHED/.test(out),
    (out.match(/GAME LAUNCHED.*/) || [''])[0].trim());

  const ev1 = await req('GET', '/api/events?since=0');
  check('and tells Gaming Nation the driver is online',
    (ev1.events || []).some((e) => e.kind === 'session.start'),
    (ev1.events || []).map((e) => e.kind).join(',') || 'none');

  const fleet1 = await req('GET', '/api/fleet');
  const me1 = (fleet1.drivers || []).find((d) => d.id === DRIVER);
  check('the driver appears on the fleet board', !!me1,
    me1 ? me1.name + ', ' + me1.truck : 'NOT REPORTING');

  /* ---- take a job ---- */
  truck.job = { cargo: 'Machinery', income: 6800, from: 'Duisburg', to: 'Lyon', remainingM: 720000 };
  truck.speed = 82;
  await wait(1800);

  check('a job taken in game is picked up', /JOB STARTED/.test(out),
    (out.match(/JOB STARTED.*/) || [''])[0].trim());
  check('the job number comes from Gaming Nation, in sequence',
    /GMN-\d{6}/.test(out), (out.match(/GMN-\d{6}/) || ['none'])[0]);

  const ev2 = await req('GET', '/api/events?since=0');
  const start = (ev2.events || []).find((e) => e.kind === 'job.start');
  check('the job start reaches Gaming Nation', !!start, start ? start.text : 'NOT SENT');
  check('carrying its job number', !!start && /^GMN-/.test(start.jobId || ''),
    start ? start.jobId : '-');

  /* ---- drive it ---- */
  truck.job.remainingM = 360000;
  truck.odometer += 360;
  await wait(1800);

  const fleet2 = await req('GET', '/api/fleet');
  const me2 = (fleet2.drivers || []).find((d) => d.id === DRIVER);
  check('the run is tracked live on the board',
    !!me2 && !!me2.job && Math.round(me2.job.progress) === 50,
    me2 && me2.job ? Math.round(me2.job.progress) + '% ' + me2.job.from + ' -> ' + me2.job.to : '-');
  check('with an arrival time', !!me2 && me2.job && me2.job.etaMin > 0,
    me2 && me2.job && me2.job.etaMin ? Math.round(me2.job.etaMin) + ' min' : 'none');

  /* ---- deliver ---- */
  truck.job = null;
  truck.speed = 0;
  await wait(2000);

  check('the delivery is noticed', /DELIVERY COMPLETED/.test(out),
    (out.match(/DELIVERY COMPLETED.*/) || [''])[0].trim());

  const company = await req('GET', '/api/company');
  const jobs = (company.data && company.data.jobs) || [];
  const filed = jobs[0];
  check('the run is on the company record', !!filed,
    filed ? filed.from + ' -> ' + filed.to : 'NOT RECORDED');
  check('with the money and the distance on it',
    !!filed && filed.income === 6800 && filed.km === 720 && filed.cargo === 'Machinery',
    filed ? filed.cargo + ', ' + filed.km + ' km, ' + filed.income : '-');
  check('and the evidence to check it against',
    !!filed && filed.evidence && filed.evidence.frames > 0
      && filed.evidence.closedBy === 'telemetry',
    filed && filed.evidence ? filed.evidence.frames + ' frames, closed by '
      + filed.evidence.closedBy : 'NO EVIDENCE');

  const d = ((company.data && company.data.drivers) || []).find((x) => x.id === DRIVER);
  check('the driver is credited',
    !!d && d.earned === 6800 && d.deliveries === 1 && d.km === 720,
    d ? d.deliveries + ' run, ' + d.km + ' km, ' + d.earned : 'NOT CREDITED');

  /* filing the same run twice must not pay twice */
  await req('POST', '/api/jobs', { job: { id: filed.id, driverId: DRIVER, km: 720, income: 6800 } });
  const again = await req('GET', '/api/company');
  const d2 = ((again.data && again.data.drivers) || []).find((x) => x.id === DRIVER);
  check('the same run cannot be filed twice',
    !!d2 && d2.earned === 6800 && d2.deliveries === 1,
    d2 ? d2.deliveries + ' run, ' + d2.earned : '-');

  /* ---- nothing is left unsent ----
     Everything that matters goes through an outbox on disk and is only
     removed once Gaming Nation has taken it, so an empty outbox is the proof
     that the whole run actually landed. */
  const outbox = path.join(__dirname, '..', 'hll-outbox.json');
  let queued = null;
  try { queued = JSON.parse(fs.readFileSync(outbox, 'utf8')); } catch (e) { queued = []; }
  check('nothing is left unsent', Array.isArray(queued) && queued.length === 0,
    Array.isArray(queued) ? queued.length + ' queued' : 'unreadable');

  /* ---- the telemetry link drops ----
     The server stops answering while the driver may well still be playing.
     That is a connection lost, not a driver who has left, and the board
     should say so. */
  game.close();
  await wait(2500);
  check('a dead telemetry link is a connection lost', /CONNECTION LOST/.test(out),
    (out.match(/CONNECTION LOST.*/) || [''])[0].trim() || 'NOT REPORTED');

  const ev3 = await req('GET', '/api/events?since=0');
  check('and is reported as such, not as leaving',
    (ev3.events || []).some((e) => e.kind === 'connection.lost')
      && !(ev3.events || []).some((e) => e.kind === 'session.end'),
    (ev3.events || []).map((e) => e.kind).join(','));

  /* ---- the link comes back ---- */
  await new Promise((r) => game.listen(GAME_PORT, '127.0.0.1', r));
  await wait(1500);
  check('and the link coming back is reported too', /CONNECTION RESTORED/.test(out),
    (out.match(/CONNECTION RESTORED.*/) || [''])[0].trim() || 'NOT REPORTED');

  /* ---- the driver actually quits the game ----
     The link is fine; the game behind it reports itself gone. That is a
     session ending, and it is a different thing. */
  truck.running = false;
  await wait(2000);
  check('the game reporting itself closed ends the session',
    /GAME CLOSED/.test(out), (out.match(/GAME CLOSED.*/) || [''])[0].trim() || 'NOT NOTICED');

  const ev4 = await req('GET', '/api/events?since=0');
  check('and Gaming Nation is told they are offline',
    (ev4.events || []).some((e) => e.kind === 'session.end'),
    (ev4.events || []).map((e) => e.kind).join(','));

  child.kill();
  game.close();

  try { child.kill('SIGKILL'); } catch (e) {}
  try { fs.unlinkSync(COMPANY_FILE); } catch (e) {}
  say('\n' + (failures ? failures + ' failed\n' : 'all passed\n'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { say('\n  ERROR  ' + e.stack + '\n'); process.exit(1); });
