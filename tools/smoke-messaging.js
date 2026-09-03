/* ============================================================
   Smoke test — direct messages, attachments and calls.

     node tools/smoke-messaging.js

   Three things have to be true for driver-to-driver messaging to
   be worth having, and none of them is obvious from the code:

     1. A private message reaches the two people in it and nobody
        else. broadcast() reaches every open stream, so a direct
        message written the easy way is delivered to the whole
        fleet — which is not a bug you notice until it matters.

     2. An attachment survives being sent, comes back with the
        bytes that went in, and cannot be used to write anywhere
        outside the upload directory.

     3. A call rings the person being called and nobody else, and
        the handshake — offer, answer, candidates — arrives in
        the order it was sent.

   So this signs two drivers in, opens a live stream for each,
   and watches what actually arrives on each one. A third driver
   holds a stream open throughout: nothing private should ever
   land on it, and that is checked explicitly rather than assumed.

   The service runs as a child process against temp files, so a
   run never touches the real company.
   ============================================================ */
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = Number(process.env.HLL_SMOKE_PORT || 7094);
const ROOT = path.join(__dirname, '..');
const TMP = path.join(os.tmpdir(), 'hll-msg-smoke');

const COMPANY_FILE = path.join(TMP, 'company.json');
const SESSION_FILE = path.join(TMP, 'sessions.json');
const CHAT_FILE = path.join(TMP, 'chat.json');
const DM_FILE = path.join(TMP, 'dms.json');
const FILES_FILE = path.join(TMP, 'files.json');
const FILES_DIR = path.join(TMP, 'files');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(TMP, { recursive: true });

let failures = 0;
const say = console.log;
const check = (name, ok, detail) => {
  say((ok ? '  ✓  ' : '  ✗  ') + name + (detail ? ': ' + detail : ''));
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const sha = (pw, salt) => crypto.createHash('sha256').update(salt + '::' + pw, 'utf8').digest('hex');

const req = (method, p, body, token, headers) => new Promise((done) => {
  const isBuffer = Buffer.isBuffer(body);
  const payload = body == null ? null : (isBuffer ? body : JSON.stringify(body));
  const h = Object.assign({}, headers || {});
  if (payload) {
    if (!h['Content-Type']) h['Content-Type'] = 'application/json';
    h['Content-Length'] = Buffer.byteLength(payload);
  }
  if (token) h.Authorization = 'Bearer ' + token;
  const r = http.request({ port: PORT, path: p, method, headers: h }, (res) => {
    const chunks = [];
    res.on('data', (c) => chunks.push(c));
    res.on('end', () => {
      const buf = Buffer.concat(chunks);
      let parsed = null;
      try { parsed = JSON.parse(buf.toString('utf8')); } catch (e) {}
      done({ status: res.statusCode, body: parsed, buf, headers: res.headers });
    });
  });
  r.on('error', () => done({ status: 0, body: null, buf: Buffer.alloc(0), headers: {} }));
  r.end(payload);
});

/* An open /api/stream, collecting what lands on it. This is the whole point
   of the test: not what the endpoint returns, but what each listener sees. */
function openStream(token) {
  const got = [];
  const r = http.request(
    { port: PORT, path: '/api/stream?token=' + encodeURIComponent(token || ''), method: 'GET' },
    (res) => {
      let buf = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        buf += c;
        /* SSE frames are separated by a blank line */
        let i;
        while ((i = buf.indexOf('\n\n')) > -1) {
          const frame = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const kind = (frame.match(/^event: (.+)$/m) || [])[1];
          const data = (frame.match(/^data: (.+)$/m) || [])[1];
          if (kind && data) {
            try { got.push({ kind, data: JSON.parse(data) }); } catch (e) {}
          }
        }
      });
    }
  );
  r.on('error', () => {});
  r.end();
  return { got, stop: () => { try { r.destroy(); } catch (e) {} } };
}

const SALT = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const PW = 'DriverPass#7';

const COMPANY = {
  drivers: [
    { id: 'HLL-1001', name: 'Anna Bergen', role: 'driver', accountStatus: 'active' },
    { id: 'HLL-2002', name: 'Marek Kowal', role: 'driver', accountStatus: 'active' },
    { id: 'HLL-3003', name: 'Nosy Parker', role: 'driver', accountStatus: 'active' },
  ],
  accounts: [
    { driverId: 'HLL-1001', email: 'anna@example.com', salt: SALT, hash: sha(PW, SALT) },
    { driverId: 'HLL-2002', email: 'marek@example.com', salt: SALT, hash: sha(PW, SALT) },
    { driverId: 'HLL-3003', email: 'nosy@example.com', salt: SALT, hash: sha(PW, SALT) },
  ],
  events: [],
  jobs: [],
};

function startServer() {
  return spawn(process.execPath, [path.join(ROOT, 'fleet-server.js'), '--port', String(PORT)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1',
      HLL_COMPANY_FILE: COMPANY_FILE,
      HLL_SESSION_FILE: SESSION_FILE,
      HLL_CHAT_FILE: CHAT_FILE,
      HLL_DM_FILE: DM_FILE,
      HLL_FILES_FILE: FILES_FILE,
      HLL_FILES_DIR: FILES_DIR,
    }),
    stdio: 'ignore',
  });
}

const login = async (email) => {
  const r = await req('POST', '/api/auth/login', { email, password: PW });
  return r.body && r.body.token;
};

(async () => {
  let server = startServer();
  await wait(1400);
  say('\nDirect messages, attachments and calls\n');

  await req('PUT', '/api/company', { version: 0, data: COMPANY });

  const anna = await login('anna@example.com');
  const marek = await login('marek@example.com');
  const nosy = await login('nosy@example.com');
  check('three drivers sign in', !!(anna && marek && nosy));

  const sAnna = openStream(anna);
  const sMarek = openStream(marek);
  const sNosy = openStream(nosy);
  await wait(500);

  /* ---------- 1. a message reaches both ends and no one else ---------- */
  const sent = await req('POST', '/api/dm/send',
    { to: 'HLL-2002', text: 'Are you running the Rotterdam load?' }, anna);
  check('a direct message is accepted',
    sent.status === 200 && !!sent.body.message, 'HTTP ' + sent.status);

  await wait(400);

  const marekGot = sMarek.got.filter((e) => e.kind === 'dm');
  const annaGot = sAnna.got.filter((e) => e.kind === 'dm');
  const nosyGot = sNosy.got.filter((e) => e.kind === 'dm');

  check('it arrives at the driver it was sent to',
    marekGot.length === 1 && marekGot[0].data.message.text.includes('Rotterdam'),
    marekGot.length + ' frame(s)');
  check('and back to the sender, so their other windows agree',
    annaGot.length === 1, annaGot.length + ' frame(s)');
  check('and NOT to anybody else on the fleet',
    nosyGot.length === 0, nosyGot.length + ' frame(s) — must be 0');

  /* ---------- 2. identity is the service's to decide ---------- */
  const forged = await req('POST', '/api/dm/send',
    { to: 'HLL-1001', text: 'this is control speaking', driverId: 'HLL-9999',
      driver: 'Control', role: 'staff' }, marek);
  check('the sender cannot label themselves',
    forged.status === 200 && forged.body.message.driverId === 'HLL-2002'
      && forged.body.message.role === 'driver',
    forged.body && forged.body.message ? forged.body.message.driver : 'no message');

  const noIdent = await req('POST', '/api/dm/send', { to: 'HLL-1001', text: 'hello' });
  check('and a message with no token is refused', noIdent.status === 401,
    'HTTP ' + noIdent.status);

  const empty = await req('POST', '/api/dm/send', { to: 'HLL-2002', text: '   ' }, anna);
  check('an empty message is not a message', empty.status === 400, 'HTTP ' + empty.status);

  /* ---------- 3. the thread reads back ---------- */
  const thread = await req('GET', '/api/dm/HLL-2002', null, anna);
  check('the thread holds both messages',
    thread.status === 200 && thread.body.messages.length === 2,
    (thread.body ? thread.body.messages.length : '?') + ' message(s)');

  const threads = await req('GET', '/api/dm/threads', null, marek);
  const t = threads.body && threads.body.threads[0];
  check('the conversation is listed with who it is with',
    !!t && t.withId === 'HLL-1001' && t.withName === 'Anna Bergen',
    t ? t.withName : 'no thread');
  check('and the unread count is the other side only',
    !!t && t.unread === 1, t ? String(t.unread) : '?');

  const read = await req('POST', '/api/dm/read', { withId: 'HLL-1001' }, marek);
  check('marking read clears it', read.status === 200 && read.body.read === 1,
    (read.body ? read.body.read : '?') + ' marked');

  /* ---------- 4. attachments ---------- */
  /* a real PNG, one red pixel */
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64');

  const up = await req('POST', '/api/files', png, anna, {
    'Content-Type': 'image/png',
    'X-HLL-Filename': 'delivery-note.png',
  });
  check('an image uploads', up.status === 200 && !!up.body.file, 'HTTP ' + up.status);
  check('and is recognised as an image, not a download',
    !!up.body.file && up.body.file.image === true);

  const back = await req('GET', up.body.file.url, null, anna);
  check('it comes back byte for byte',
    back.status === 200 && back.buf.equals(png),
    back.buf.length + ' of ' + png.length + ' bytes');
  check('served as the type it was stored as, and told not to sniff',
    back.headers['content-type'] === 'image/png'
      && back.headers['x-content-type-options'] === 'nosniff');

  const script = await req('POST', '/api/files', Buffer.from('<script>alert(1)</script>'), anna, {
    'Content-Type': 'text/html',
    'X-HLL-Filename': 'evil.html',
  });
  check('a file the browser would run is refused', script.status === 415,
    'HTTP ' + script.status);

  const traversal = await req('POST', '/api/files', png, anna, {
    'Content-Type': 'image/png',
    'X-HLL-Filename': '../../../../escaped.png',
  });
  check('a filename cannot escape the upload directory',
    traversal.status === 200
      && fs.existsSync(path.join(FILES_DIR, traversal.body.file.id + '.png'))
      && !fs.existsSync(path.join(ROOT, 'escaped.png')),
    'stored as its id');

  const withFile = await req('POST', '/api/dm/send',
    { to: 'HLL-2002', text: '', attachment: { id: up.body.file.id } }, anna);
  check('an attachment can be sent with no words at all',
    withFile.status === 200 && !!withFile.body.message.attachment
      && withFile.body.message.attachment.name === 'delivery-note.png',
    'HTTP ' + withFile.status);

  /* ---------- 5. calls ---------- */
  sMarek.got.length = 0;
  sNosy.got.length = 0;

  const ring = await req('POST', '/api/call/signal',
    { to: 'HLL-2002', kind: 'ring', callId: 'CALL-1', video: false }, anna);
  check('a call rings the driver it is for',
    ring.status === 200 && ring.body.delivered === 1,
    (ring.body ? ring.body.delivered : '?') + ' listener(s)');

  await wait(300);
  check('and nobody else hears it ring',
    sNosy.got.filter((e) => e.kind === 'call').length === 0);

  const heard = sMarek.got.filter((e) => e.kind === 'call');
  check('the call says who is calling',
    heard.length === 1 && heard[0].data.from === 'HLL-1001'
      && heard[0].data.fromName === 'Anna Bergen',
    heard.length ? heard[0].data.fromName : 'nothing heard');

  /* the handshake, in order */
  await req('POST', '/api/call/signal',
    { to: 'HLL-2002', kind: 'offer', callId: 'CALL-1', payload: { sdp: 'v=0 offer' } }, anna);
  await req('POST', '/api/call/signal',
    { to: 'HLL-1001', kind: 'answer', callId: 'CALL-1', payload: { sdp: 'v=0 answer' } }, marek);
  await req('POST', '/api/call/signal',
    { to: 'HLL-2002', kind: 'ice', callId: 'CALL-1', payload: { candidate: 'a=candidate:1' } }, anna);
  await wait(400);

  const order = sMarek.got.filter((e) => e.kind === 'call').map((e) => e.data.kind);
  check('the handshake arrives in the order it was sent',
    order.join(',') === 'ring,offer,ice', order.join(','));

  const annaHeard = sAnna.got.filter((e) => e.kind === 'call').map((e) => e.data.kind);
  check('and the answer comes back to the caller',
    annaHeard.join(',') === 'answer', annaHeard.join(',') || 'nothing');

  const offline = await req('POST', '/api/call/signal',
    { to: 'HLL-3003', kind: 'ring', callId: 'CALL-2' }, anna);
  sNosy.stop();
  await wait(300);
  const nowOffline = await req('POST', '/api/call/signal',
    { to: 'HLL-3003', kind: 'ring', callId: 'CALL-3' }, anna);
  check('ringing a driver who is not connected says so rather than ringing nowhere',
    offline.status === 200 && nowOffline.status === 409,
    'connected ' + offline.status + ', gone ' + nowOffline.status);

  const nonsense = await req('POST', '/api/call/signal',
    { to: 'HLL-2002', kind: 'drop-tables', callId: 'CALL-1' }, anna);
  check('an unknown signal is refused', nonsense.status === 400, 'HTTP ' + nonsense.status);

  /* ---------- 6. it survives a restart ---------- */
  sAnna.stop(); sMarek.stop();
  await wait(200);
  server.kill();
  await wait(700);
  server = startServer();
  await wait(1400);

  const again = await login('anna@example.com');
  const after = await req('GET', '/api/dm/HLL-2002', null, again);
  check('the conversation is still there after a restart',
    after.status === 200 && after.body.messages.length === 3,
    (after.body ? after.body.messages.length : '?') + ' message(s)');

  const fileAfter = await req('GET', up.body.file.url, null, again);
  check('and so is the attachment',
    fileAfter.status === 200 && fileAfter.buf.equals(png));

  server.kill();
  say(failures ? '\n' + failures + ' failure(s)\n' : '\nall passed\n');
  process.exit(failures ? 1 : 0);
})();
