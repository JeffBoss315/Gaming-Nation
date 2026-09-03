/* ============================================================
   Smoke test — the live channel.

     node tools/smoke-realtime.js

   Stands the company service up on a spare port, holds a stream
   open the way a driver's app or the HQ website does, then pushes
   a position and a run event through the normal endpoints and
   checks both come back down the stream.

   Plain node: no electron, no browser, no dependencies. This is
   the test that says "real time actually is real time" — if it
   passes, a driver's truck moving in game reaches every other
   client without anybody polling for it.
   ============================================================ */
const http = require('http');
const os = require('os');
const path = require('path');

const PORT = Number(process.env.HLL_SMOKE_PORT || 7099);

/* keep the real company file out of the way */
process.env.HLL_COMPANY_FILE = path.join(os.tmpdir(), 'hll-smoke-company.json');
process.argv = [process.argv[0], 'fleet-server.js', '--port', String(PORT)];

/* the service prints a banner on listen; not wanted in test output */
const say = console.log;
console.log = () => {};
require(path.join(__dirname, '..', 'fleet-server.js'));
console.log = say;

let failures = 0;
const check = (name, ok) => {
  say((ok ? '  ✓  ' : '  ✗  ') + name);
  if (!ok) failures++;
};

const post = (p, body) => new Promise((done, fail) => {
  const b = JSON.stringify(body);
  const r = http.request({
    port: PORT, path: p, method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) },
  }, (res) => { res.resume(); res.on('end', done); });
  r.on('error', fail);
  r.end(b);
});

const get = (p) => new Promise((done, fail) => {
  http.get({ port: PORT, path: p }, (res) => {
    let t = ''; res.setEncoding('utf8');
    res.on('data', (c) => { t += c; });
    res.on('end', () => done(t));
  }).on('error', fail);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* hold the stream open and collect whatever arrives, exactly as a browser
   EventSource would */
function listen() {
  const seen = [];
  const req = http.get({ port: PORT, path: '/api/stream' }, (res) => {
    res.setEncoding('utf8');
    let buf = '';
    res.on('data', (chunk) => {
      buf += chunk;
      let i;
      while ((i = buf.indexOf('\n\n')) > -1) {
        const frame = buf.slice(0, i);
        buf = buf.slice(i + 2);
        const kind = (frame.match(/^event: (.+)$/m) || [])[1];
        const data = (frame.match(/^data: (.+)$/m) || [])[1];
        if (kind && data) seen.push({ kind, data: JSON.parse(data) });
      }
    });
  });
  req.end();
  return { seen, close: () => req.destroy() };
}

(async () => {
  await wait(250);
  say('\nHLL live channel\n');

  const stream = listen();
  await wait(300);
  check('the stream opens with a snapshot', stream.seen.some((s) => s.kind === 'hello'));

  await post('/api/fleet/position', {
    id: 'HLL-001', name: 'Test Driver', game: 'ets2', x: 1000, z: 2000,
    heading: 0.25, speed: 84, state: 'delivering', truck: 'Scania S',
    fuel: 62, damage: 3.2,
    job: {
      id: 'JOB-1', from: 'Berlin', to: 'Praha', cargo: 'Steel',
      km: 350, drivenKm: 120, progress: 34.3, etaMin: 164, income: 12400,
    },
  });

  await post('/api/fleet/event', {
    kind: 'job.start', driverId: 'HLL-001', driver: 'Test Driver',
    text: 'Test Driver picked up Steel in Berlin',
    from: 'Berlin', to: 'Praha', cargo: 'Steel', km: 350, level: 'ok',
  });

  /* positions are coalesced, so allow one flush window */
  await wait(700);

  const fleet = stream.seen.find((s) => s.kind === 'fleet');
  const event = stream.seen.find((s) => s.kind === 'event');

  check('a position is pushed without being asked for', !!fleet);
  check('live run progress travels with it',
    !!fleet && fleet.data.drivers[0].job.progress === 34.3);
  check('so does truck condition',
    !!fleet && fleet.data.drivers[0].fuel === 62 && fleet.data.drivers[0].damage === 3.2);
  check('a run event is pushed', !!event && event.data.kind === 'job.start');
  check('the event keeps its wording', !!event && /picked up Steel/.test(event.data.text));
  check('events are sequenced for catch-up', !!event && event.data.seq === 1);

  /* a client that cannot hold a stream open still catches up */
  const replay = JSON.parse(await get('/api/events?since=0'));
  check('missed events can be replayed', replay.events.length === 1);
  const nothingNew = JSON.parse(await get('/api/events?since=' + replay.seq));
  check('replay respects the sequence', nothingNew.events.length === 0);

  /* a company write wakes every listener rather than waiting for a poll */
  await new Promise((done) => {
    const b = JSON.stringify({ version: 0, data: { drivers: [] } });
    const r = http.request({
      port: PORT, path: '/api/company', method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(b) },
    }, (res) => { res.resume(); res.on('end', done); });
    r.end(b);
  });
  await wait(300);
  check('a company change is announced live',
    stream.seen.some((s) => s.kind === 'company' && s.data.version === 1));

  const status = await get('/status');
  check('status counts the listener', /1 live listener/.test(status));
  check('status draws live progress', /34% Berlin -> Praha/.test(status));

  stream.close();
  say('\n' + (failures ? failures + ' failed\n' : 'all passed\n'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { say('\n  ERROR  ' + e.message + '\n'); process.exit(1); });
