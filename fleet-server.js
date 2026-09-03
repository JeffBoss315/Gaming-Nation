/* ============================================================
   HEAVYLINE — the company service

     npm run fleet                 (or: node fleet-server.js --port 8787)

   One company, held in one place, so every machine sees the same
   thing. It carries four things:

     the company    /api/company, the shared record every install
                    reads on load and writes back after a change
     the fleet      /api/fleet, where everybody's truck is right now
     the live       /api/stream, server-sent events, so a change
     channel        reaches every client without anyone polling
     convoy chat    /api/convoy/..., who said what on a convoy

   It also serves the website, so a company set up this way needs no
   configuration at all: open the address this prints and the page is
   already joined up.

   Nothing here is a dependency. Plain node, three JSON files, and
   the fleet positions live in memory because a position more than a
   few seconds old is not worth keeping.

   NOTE ON SUPABASE. The platform's own company sync has moved to
   Supabase; script.js no longer calls /api/company at all. This
   service is still the backend for the driver client's live fleet
   channel and convoy chat, for the game connector, and for the
   smoke harnesses in tools/. It is opt-in: the client only talks to
   it when a service address is set in settings.
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

/* ---------------- configuration ---------------- */
const args = process.argv.slice(2);
const flag = (name) => {
  const i = args.indexOf(name);
  return i > -1 ? args[i + 1] : null;
};

const ROOT = __dirname;
const PORT = Number(flag('--port') || process.env.HLL_PORT || 8787);
const HOST = args.includes('--lan') ? '0.0.0.0' : '127.0.0.1';

/* The tests point these at a temp directory so a run never touches the
   real company. Same reason the paths are read here and not inlined. */
const COMPANY_FILE = process.env.HLL_COMPANY_FILE || path.join(ROOT, 'hll-company.json');
const SESSION_FILE = process.env.HLL_SESSION_FILE || path.join(ROOT, 'hll-sessions.json');
const CHAT_FILE = process.env.HLL_CHAT_FILE || path.join(ROOT, 'hll-chat.json');
const SITE_DIR = process.env.HLL_SITE_DIR || ROOT;

/* ---------------- small helpers ---------------- */
function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return fallback; }
}

/* Written to a neighbouring file and renamed, so a crash mid-write leaves
   the previous copy intact rather than a half-written one. */
function writeJSON(file, value) {
  try {
    const tmp = file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(value));
    fs.renameSync(tmp, file);
  } catch (e) {
    console.warn('[hll] could not write ' + path.basename(file) + ': ' + e.message);
  }
}

/* A burst of messages is one write, not sixty. */
const saveTimers = {};
function save(file, value) {
  clearTimeout(saveTimers[file]);
  saveTimers[file] = setTimeout(() => writeJSON(file, value), 120);
}
function flushSaves() {
  Object.keys(saveTimers).forEach((f) => clearTimeout(saveTimers[f]));
  writeJSON(COMPANY_FILE, company);
  writeJSON(SESSION_FILE, sessions);
  writeJSON(CHAT_FILE, chat);
}

const sha = (pw, salt) =>
  crypto.createHash('sha256').update(salt + '::' + pw, 'utf8').digest('hex');

/* the same ladder the platform uses; the service decides, never the caller */
const ROLE_LEVEL = {
  driver: 1, recruiter: 4, dispatcher: 4, event_manager: 5,
  moderator: 6, management: 8, admin: 9, super_admin: 10,
};
const levelOf = (role) => ROLE_LEVEL[role] || 1;

/* who may moderate a convoy conversation, and who speaks as control */
const CONTROL_LEVEL = 5;

/* ---------------- state ---------------- */
let company = readJSON(COMPANY_FILE, null) || { version: 0, at: Date.now(), data: {} };
let sessions = readJSON(SESSION_FILE, null) || {};      /* token -> { driverId, at } */
let chat = readJSON(CHAT_FILE, null) || {};             /* convoyId -> [message] */

const fleet = new Map();      /* driverId -> last position; memory only */
let events = [];              /* recent run events, for catch-up */
let seq = 0;
const listeners = new Set();  /* open /api/stream responses */

/* ---------------- the live channel ---------------- */
function send(res, kind, data) {
  try {
    res.write('event: ' + kind + '\n');
    res.write('data: ' + JSON.stringify(data) + '\n\n');
  } catch (e) { listeners.delete(res); }
}

function broadcast(kind, data) {
  listeners.forEach((res) => send(res, kind, data));
}

const fleetList = () => Array.from(fleet.values());

/* Positions arrive far faster than anyone can read them — a truck reports
   several times a second. Coalesced into one frame per window so a busy
   convoy does not flood every listener. */
let fleetFlush = null;
function announceFleet() {
  if (fleetFlush) return;
  fleetFlush = setTimeout(() => {
    fleetFlush = null;
    broadcast('fleet', { drivers: fleetList() });
  }, 250);
}

/* a truck that stopped reporting is not on the road any more */
setInterval(() => {
  const cutoff = Date.now() - 90000;
  let dropped = false;
  fleet.forEach((d, id) => {
    if ((d.at || 0) < cutoff) { fleet.delete(id); dropped = true; }
  });
  if (dropped) announceFleet();
}, 30000).unref();

/* ---------------- identity ---------------- */
const accounts = () => (company.data && company.data.accounts) || [];
const drivers = () => (company.data && company.data.drivers) || [];
const convoys = () => (company.data && company.data.events) || [];

function driverRecord(driverId) {
  const d = drivers().find((x) => x && x.id === driverId);
  if (d) return Object.assign({}, d, { role: d.role || 'driver' });
  /* an account with no driver record still has an identity */
  const a = accounts().find((x) => x && x.driverId === driverId);
  return { id: driverId, name: (a && a.name) || driverId, role: 'driver' };
}

/* The identity behind a request. Taken from the token and nowhere else —
   anything the body claims about who it is, is ignored. */
function whoami(req) {
  const raw = req.headers.authorization || '';
  const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
  if (!token) return null;
  const session = sessions[token];
  if (!session) return null;
  return driverRecord(session.driverId);
}

/* ---------------- writes are paced, per address ---------------- */
const buckets = new Map();
function allowWrite(req) {
  const who = req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const b = buckets.get(who) || { count: 0, until: now + 2000 };
  if (now > b.until) { b.count = 0; b.until = now + 2000; }
  b.count++;
  buckets.set(who, b);
  /* Generous on purpose. This is here to stop a runaway loop or an abusive
     client, not to pace a busy convoy — sixty people talking at once during a
     departure is normal, and a limit that clips them is a bug, not safety. */
  return b.count <= 100;
}

/* ---------------- http plumbing ---------------- */
function json(res, code, body) {
  const text = JSON.stringify(body);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(text);
}

function body(req) {
  return new Promise((done) => {
    let raw = '';
    req.setEncoding('utf8');
    req.on('data', (c) => {
      raw += c;
      if (raw.length > 8e6) { raw = ''; req.destroy(); }   /* not a file upload */
    });
    req.on('end', () => {
      try { done(raw ? JSON.parse(raw) : {}); } catch (e) { done(null); }
    });
    req.on('error', () => done(null));
  });
}

const TYPES = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json', '.jpg': 'image/jpeg',
  '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.map': 'application/json',
};

function serveFile(res, pathname) {
  /* never outside the site directory, whatever the request says */
  const rel = path.normalize(decodeURIComponent(pathname)).replace(/^(\.\.[/\\])+/, '');
  let file = path.join(SITE_DIR, rel);
  if (!file.startsWith(path.resolve(SITE_DIR))) { json(res, 403, { error: 'no' }); return; }

  if (rel === '/' || rel === '\\' || rel === '') file = path.join(SITE_DIR, 'index.html');

  /* '/admin' as well as '/admin.html', the way a website behaves */
  if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';

  fs.stat(file, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('Not found');
      return;
    }
    const type = TYPES[path.extname(file).toLowerCase()] || 'application/octet-stream';

    /* A page served BY the company service is already joined up and should
       not have to be told where the company is. Rather than have the browser
       guess from its own origin — wrong the moment the site is served by a
       plain file server, and the source of a steady drip of 404s against it —
       the service says so itself, in the page it hands over. Nothing else
       sets this, so nothing else can be mistaken for the service. */
    if (type.indexOf('text/html') === 0) {
      const marker = '<script>window.HLL_SERVICE = location.origin;</script>';
      let html = fs.readFileSync(file, 'utf8');
      html = html.indexOf('</head>') > -1
        ? html.replace('</head>', '  ' + marker + '\n</head>')
        : marker + html;
      res.writeHead(200, {
        'Content-Type': type,
        'Content-Length': Buffer.byteLength(html),
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      });
      return res.end(html);
    }

    res.writeHead(200, {
      'Content-Type': type,
      'Content-Length': stat.size,
      'Access-Control-Allow-Origin': '*',
    });
    return fs.createReadStream(file).pipe(res);
  });
}

/* ---------------- convoy chat ---------------- */
const messagesFor = (id) => chat[id] || (chat[id] = []);

function convoyById(id) {
  return convoys().find((e) => e && e.id === id) || null;
}

/* On the convoy, or senior enough to oversee it. */
function onConvoy(convoy, me) {
  if (!convoy || !me) return false;
  if (levelOf(me.role) >= CONTROL_LEVEL) return true;
  if (convoy.leaderId === me.id) return true;
  return (convoy.registered || []).some((r) => r && r.driverId === me.id);
}

function chatPage(id, limit, before) {
  const all = messagesFor(id);
  let end = all.length;
  if (before) {
    const i = all.findIndex((m) => m.id === before);
    if (i > -1) end = i;
  }
  const start = Math.max(0, end - limit);
  const page = all.slice(start, end);
  return {
    messages: page,
    total: all.length,
    olderCursor: start > 0 && page.length ? page[0].id : null,
  };
}

/* ---------------- the API ---------------- */
async function api(req, res, url) {
  const p = url.pathname;
  const method = req.method;

  /* ---- the company record ---- */
  if (p === '/api/company' && method === 'GET') {
    return json(res, 200, { version: company.version, at: company.at, data: company.data });
  }

  if (p === '/api/company' && method === 'PUT') {
    const b = await body(req);
    if (!b || typeof b !== 'object') return json(res, 400, { error: 'unreadable body' });
    /* The version comes from the client, not from the file. A client PUTs the
       version it last pulled, and this is the next one after it — so a company
       counts up in step with the machines using it rather than with whatever
       happens to be on this disk. */
    const claimed = Number(b.version);
    company = {
      version: (Number.isFinite(claimed) ? claimed : (company.version || 0)) + 1,
      at: Date.now(),
      data: b.data && typeof b.data === 'object' ? b.data : {},
    };
    save(COMPANY_FILE, company);
    /* everybody hears about it now rather than on their next poll */
    broadcast('company', { version: company.version, at: company.at });
    return json(res, 200, { version: company.version, at: company.at });
  }

  /* ---- who is where ---- */
  if (p === '/api/fleet' && method === 'GET') {
    return json(res, 200, { drivers: fleetList(), online: true, at: Date.now() });
  }

  if (p === '/api/fleet/position' && method === 'POST') {
    const b = await body(req);
    if (!b || !b.id) return json(res, 400, { error: 'a position needs an id' });
    fleet.set(b.id, Object.assign({}, b, { at: Date.now() }));
    announceFleet();
    return json(res, 200, { ok: true });
  }

  if (p === '/api/fleet/event' && method === 'POST') {
    const b = await body(req);
    if (!b || !b.kind) return json(res, 400, { error: 'an event needs a kind' });
    seq++;
    const e = Object.assign({}, b, { seq, at: b.at || new Date().toISOString() });
    events.push(e);
    if (events.length > 500) events = events.slice(-500);
    broadcast('event', e);
    return json(res, 200, { ok: true, seq });
  }

  /* a client that could not hold the stream open catches up here */
  if (p === '/api/events' && method === 'GET') {
    const since = Number(url.searchParams.get('since') || 0);
    return json(res, 200, { events: events.filter((e) => e.seq > since), seq });
  }

  if (p === '/api/jobs' && method === 'GET') {
    return json(res, 200, { jobs: (company.data && company.data.jobs) || [] });
  }

  /* A run's number comes from here so it is unique across the whole company
     rather than per machine. The counter lives beside the record and not in
     it, because a PUT of /api/company replaces data wholesale and would
     otherwise reset the sequence every time anybody saved. */
  if (p === '/api/jobs/id' && method === 'POST') {
    company.jobSeq = (company.jobSeq || 0) + 1;
    save(COMPANY_FILE, company);
    return json(res, 200, { id: 'HLL-' + String(company.jobSeq).padStart(6, '0') });
  }

  /* A finished run, filed by the game connector. */
  if (p === '/api/jobs' && method === 'POST') {
    const b = await body(req);
    const job = b && b.job;
    if (!job || !job.id) return json(res, 400, { error: 'a run needs an id' });

    const data = company.data || (company.data = {});
    const jobs = data.jobs || (data.jobs = []);

    /* The connector files through an outbox that retries, so the same run
       can arrive twice after a dropped connection. Paying it twice would
       credit distance and money that was never driven. */
    if (jobs.some((j) => j && j.id === job.id)) {
      return json(res, 200, { ok: true, duplicate: true });
    }

    jobs.unshift(job);
    if (jobs.length > 500) data.jobs = jobs.slice(0, 500);

    const d = (data.drivers || []).find((x) => x && x.id === job.driverId);
    if (d) {
      d.km = (d.km || 0) + (Number(job.km) || 0);
      d.deliveries = (d.deliveries || 0) + 1;
      d.earned = (d.earned || 0) + (Number(job.income) || 0);
      d.lastSeen = new Date().toISOString();
    }

    company.version = (company.version || 0) + 1;
    company.at = Date.now();
    save(COMPANY_FILE, company);
    broadcast('company', { version: company.version, at: company.at });
    return json(res, 200, { ok: true, job });
  }

  /* The connector asks who it is before it starts, so a mistyped driver id
     is told plainly rather than reporting positions for nobody. */
  const driverGet = p.match(/^\/api\/drivers\/([^/]+)$/);
  if (driverGet && method === 'GET') {
    const d = drivers().find((x) => x && x.id === decodeURIComponent(driverGet[1]));
    if (!d) return json(res, 404, { error: 'no such driver' });
    return json(res, 200, d);
  }

  /* ---- identity ---- */
  if (p === '/api/auth/login' && method === 'POST') {
    const b = await body(req);
    const handle = String((b && b.email) || '').trim().toLowerCase();
    const password = String((b && b.password) || '');

    const account = accounts().find((a) => a
      && (String(a.email || '').toLowerCase() === handle
        || String(a.driverId || '').toLowerCase() === handle));

    /* An unknown account and a wrong password answer identically, so this
       cannot be used to find out who has an account here. */
    if (!account || !account.salt || sha(password, account.salt) !== account.hash) {
      return json(res, 401, { error: 'those details were not accepted' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    sessions[token] = { driverId: account.driverId, at: Date.now() };
    save(SESSION_FILE, sessions);
    return json(res, 200, { token, driver: driverRecord(account.driverId) });
  }

  if (p === '/api/auth/me' && method === 'GET') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });
    return json(res, 200, me);
  }

  if (p === '/api/auth/logout' && method === 'POST') {
    const raw = req.headers.authorization || '';
    const token = raw.startsWith('Bearer ') ? raw.slice(7).trim() : '';
    if (token && sessions[token]) { delete sessions[token]; save(SESSION_FILE, sessions); }
    return json(res, 200, { ok: true });
  }

  /* ---- convoy chat ---- */
  const chatGet = p.match(/^\/api\/convoy\/([^/]+)\/chat$/);
  if (chatGet && method === 'GET') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });

    const convoy = convoyById(decodeURIComponent(chatGet[1]));
    if (!convoy) return json(res, 404, { error: 'no such convoy' });
    if (!onConvoy(convoy, me)) return json(res, 403, { error: 'not your convoy' });

    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
    return json(res, 200, chatPage(convoy.id, limit, url.searchParams.get('before')));
  }

  const convoyGet = p.match(/^\/api\/convoy\/([^/]+)$/);
  if (convoyGet && method === 'GET') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });
    const convoy = convoyById(decodeURIComponent(convoyGet[1]));
    if (!convoy) return json(res, 404, { error: 'no such convoy' });
    if (!onConvoy(convoy, me)) return json(res, 403, { error: 'not your convoy' });
    return json(res, 200, { convoy });
  }

  if (p === '/api/convoy/message' && method === 'POST') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });
    if (!allowWrite(req)) return json(res, 429, { error: 'slow down' });

    const b = await body(req);
    const convoy = convoyById(String((b && b.convoyId) || ''));
    if (!convoy) return json(res, 404, { error: 'no such convoy' });
    if (!onConvoy(convoy, me)) return json(res, 403, { error: 'not your convoy' });

    const text = String((b && b.text) || '').trim().slice(0, 2000);
    if (!text) return json(res, 400, { error: 'an empty message is not a message' });

    /* Identity and role come from the token. Whatever the body says about
       who is speaking is discarded — otherwise any driver could label
       themselves as control. */
    const message = {
      id: 'MSG-' + crypto.randomBytes(8).toString('hex'),
      convoyId: convoy.id,
      driverId: me.id,
      driver: me.name,
      role: levelOf(me.role) >= CONTROL_LEVEL ? 'staff' : 'driver',
      text,
      at: new Date().toISOString(),
    };

    messagesFor(convoy.id).push(message);
    save(CHAT_FILE, chat);
    broadcast('convoy', { kind: 'convoy.message', convoyId: convoy.id, message });
    return json(res, 200, { message });
  }

  if (p === '/api/convoy/message/delete' && method === 'POST') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });

    const b = await body(req);
    const id = String((b && b.id) || '');

    let found = null;
    let convoyId = null;
    Object.keys(chat).some((cid) => {
      const hit = chat[cid].find((m) => m.id === id);
      if (hit) { found = hit; convoyId = cid; }
      return !!hit;
    });
    if (!found) return json(res, 404, { error: 'no such message' });

    const mine = found.driverId === me.id;
    if (!mine && levelOf(me.role) < CONTROL_LEVEL) {
      return json(res, 403, { error: 'not yours to remove' });
    }

    /* A hole, not a disappearance — a conversation that silently loses a
       message reads as though it was never said. */
    found.deleted = true;
    found.text = '';
    found.deletedBy = me.id;
    found.deletedAt = new Date().toISOString();

    save(CHAT_FILE, chat);
    broadcast('convoy', { kind: 'convoy.message.deleted', convoyId, message: found });
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { error: 'no such endpoint' });
}

/* ---------------- the server ---------------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));

  /* the website and the service are often on different origins in
     development, so say plainly that this is open */
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400',
    });
    return res.end();
  }

  /* ---- the live channel ---- */
  if (url.pathname === '/api/stream') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    listeners.add(res);

    /* whoever just arrived gets the picture as it stands, not only what
       happens from now on */
    send(res, 'hello', {
      drivers: fleetList(),
      events: events.slice(-30),
      version: company.version,
      seq,
    });

    const beat = setInterval(() => {
      try { res.write(': beat\n\n'); } catch (e) { /* gone */ }
    }, 25000);

    const drop = () => { clearInterval(beat); listeners.delete(res); };
    req.on('close', drop);
    req.on('error', drop);
    return undefined;
  }

  /* ---- a plain look at what the service is doing ---- */
  if (url.pathname === '/status') {
    const n = listeners.size;
    const lines = [
      'Heavyline company service',
      '',
      'company version  ' + company.version,
      'drivers reporting  ' + fleet.size,
      'events held  ' + events.length,
      n + ' live listener' + (n === 1 ? '' : 's'),
      '',
    ];
    fleetList().forEach((d) => {
      const j = d.job;
      lines.push('  ' + (d.name || d.id) + '  ' + Math.round(d.speed || 0) + ' km/h'
        + (j ? '  ' + Math.round(j.progress || 0) + '% ' + j.from + ' -> ' + j.to : '  parked'));
    });
    const text = lines.join('\n') + '\n';
    res.writeHead(200, {
      'Content-Type': 'text/plain; charset=utf-8',
      'Content-Length': Buffer.byteLength(text),
      'Access-Control-Allow-Origin': '*',
    });
    return res.end(text);
  }

  if (url.pathname.startsWith('/api/')) {
    return api(req, res, url).catch((e) => {
      console.warn('[hll] ' + url.pathname + ': ' + e.message);
      try { json(res, 500, { error: 'the service failed on that' }); } catch (x) { /* gone */ }
    });
  }

  return serveFile(res, url.pathname);
});

server.listen(PORT, HOST, () => {
  const base = 'http://localhost:' + PORT;
  console.log('');
  console.log('  Heavyline Logistics — company service');
  console.log('  --------------------------------------');
  console.log('  Website      :  ' + base + '/');
  console.log('  Console      :  ' + base + '/admin.html');
  console.log('  Live channel :  ' + base + '/api/stream');
  console.log('  Status       :  ' + base + '/status');
  console.log('');
  console.log('  Company file :  ' + COMPANY_FILE);
  if (HOST === '127.0.0.1') {
    console.log('  (this machine only — pass --lan to let phones reach it)');
  }
  console.log('');
});

server.on('error', (e) => {
  if (e.code === 'EADDRINUSE') {
    console.error('  Port ' + PORT + ' is already in use. '
      + 'Pass --port with a free one.');
    process.exit(1);
  }
  throw e;
});

/* whatever is held in memory reaches disk before the process goes */
['SIGINT', 'SIGTERM'].forEach((sig) => {
  process.on(sig, () => { flushSaves(); process.exit(0); });
});
process.on('exit', flushSaves);

module.exports = server;
