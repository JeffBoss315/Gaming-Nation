/* ============================================================
   GAMING NATION — the company service

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
const PORT = Number(flag('--port') || process.env.HLL_PORT || 7040);
const HOST = args.includes('--lan') ? '0.0.0.0' : '127.0.0.1';

/* The tests point these at a temp directory so a run never touches the
   real company. Same reason the paths are read here and not inlined. */
const COMPANY_FILE = process.env.HLL_COMPANY_FILE || path.join(ROOT, 'hll-company.json');
const SESSION_FILE = process.env.HLL_SESSION_FILE || path.join(ROOT, 'hll-sessions.json');
const CHAT_FILE = process.env.HLL_CHAT_FILE || path.join(ROOT, 'hll-chat.json');
const DM_FILE = process.env.HLL_DM_FILE || path.join(ROOT, 'hll-dms.json');
const FILES_FILE = process.env.HLL_FILES_FILE || path.join(ROOT, 'hll-files.json');

/* Attachments are written to disk rather than into the JSON beside the
   message. A photo of a delivery note base64'd into a message file turns a
   200 KB conversation into a 2 MB one that has to be parsed in full every
   time anybody says anything. */
const FILES_DIR = process.env.HLL_FILES_DIR || path.join(ROOT, 'hll-files');

/* Big enough for a phone photo of a CMR note, small enough that one driver
   cannot fill the disk by holding the button down. */
const MAX_UPLOAD = Number(process.env.HLL_MAX_UPLOAD || 25 * 1024 * 1024);
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

let dms = readJSON(DM_FILE, null) || {};                /* threadId -> [message] */
let uploads = readJSON(FILES_FILE, null) || {};         /* fileId -> metadata */

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

/* To one driver, on every stream they have open — the desktop client and a
   browser at the same time is normal, and both should ring. */
function sendTo(driverId, kind, data) {
  if (!driverId) return 0;
  let n = 0;
  listeners.forEach((res) => {
    if (res.hllDriverId === String(driverId)) { send(res, kind, data); n++; }
  });
  return n;
}

/* Whether somebody is holding a stream open — what "online" means for a
   call. Ringing a driver who is not connected would ring nowhere. */
function isOnline(driverId) {
  let live = false;
  listeners.forEach((res) => { if (res.hllDriverId === String(driverId)) live = true; });
  return live;
}

/* Everybody holding a stream open, once each. A driver with the desktop
   client and a browser open is two listeners and one person, and both the
   room's member count and the group call have to count them as one. */
function onlineDrivers() {
  const ids = new Set();
  listeners.forEach((res) => { if (res.hllDriverId) ids.add(res.hllDriverId); });
  return Array.from(ids);
}

/* To everyone except one person — the shape every room announcement wants,
   because the one who caused it does not need telling. */
function sendToOthers(exceptId, kind, data) {
  let n = 0;
  listeners.forEach((res) => {
    if (res.hllDriverId && res.hllDriverId !== String(exceptId)) {
      send(res, kind, data); n++;
    }
  });
  return n;
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

/* ---------------- direct messages ---------------- */

/* One thread per pair, named by both ids in a fixed order — so the thread
   is the same object whichever end opens it. */
function threadId(a, b) {
  return [String(a), String(b)].sort().join('~');
}

/* The room the whole company is in.

   Deliberately a thread id that no pair can ever produce: a pair thread is
   two ids joined with '~', and a driver code never starts with '#'. So the
   room lives in the same store as every direct thread, is paged by the
   same code, and is delivered down the same channel — it is one more
   conversation, not a second messaging system.

   What it does need of its own is unread: a direct message is read when
   the one other person reads it, and there is no "the other person" here.
   Each driver carries their own mark instead. */
const FLEET_ROOM = '#fleet';
const FLEET_ROOM_NAME = 'Fleet room';

const isRoom = (id) => String(id) === FLEET_ROOM;

const ROOM_READS_FILE = process.env.HLL_ROOM_READS_FILE
  || path.join(ROOT, 'hll-room-reads.json');

let roomReads = readJSON(ROOM_READS_FILE, null) || {};   /* driverId -> ISO */

function roomUnread(driverId) {
  const since = roomReads[String(driverId)];
  return dmFor(FLEET_ROOM).filter((m) =>
    String(m.driverId) !== String(driverId)
    && (!since || m.at > since)).length;
}

const dmFor = (id) => dms[id] || (dms[id] = []);

function dmPage(id, limit, before) {
  const all = dmFor(id);
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

/* Every conversation this driver is part of, most recent first, with the
   number they have not read yet. */
function threadsFor(me) {
  const mine = String(me.id);
  const out = [];

  Object.keys(dms).forEach((id) => {
    if (isRoom(id)) return;                 /* pinned separately, below */

    const parts = id.split('~');
    if (parts.indexOf(mine) === -1) return;

    const otherId = parts[0] === mine ? parts[1] : parts[0];
    const list = dms[id] || [];
    if (!list.length) return;

    const last = list[list.length - 1];
    const other = driverRecord(otherId);

    out.push({
      threadId: id,
      withId: otherId,
      withName: (other && other.name) || otherId,
      withRole: (other && other.role) || 'driver',
      online: isOnline(otherId),
      last,
      unread: list.filter((m) => String(m.driverId) !== mine && !m.readAt).length,
    });
  });

  out.sort((a, b) => new Date(b.last.at) - new Date(a.last.at));

  /* The room goes first and stays first, whether or not anybody has spoken
     in it — it is a place, not a conversation somebody started, and a
     driver looking for it should not have to remember when it was last
     used. */
  const roomList = dmFor(FLEET_ROOM);

  out.unshift({
    threadId: FLEET_ROOM,
    withId: FLEET_ROOM,
    withName: FLEET_ROOM_NAME,
    withRole: 'room',
    room: true,
    online: true,
    members: onlineDrivers().length,
    last: roomList.length ? roomList[roomList.length - 1] : null,
    unread: roomUnread(mine),
  });

  return out;
}

/* ---------------- attachments ---------------- */

/* The JSON body reader caps at 8 MB and parses what it gets, so an upload
   cannot go through it. This one collects bytes, stops at the limit, and
   hands back a buffer. */
function rawBody(req, limit) {
  return new Promise((done, fail) => {
    const chunks = [];
    let size = 0;
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { req.destroy(); fail(new Error('too big')); return; }
      chunks.push(c);
    });
    req.on('end', () => done(Buffer.concat(chunks)));
    req.on('error', fail);
  });
}

/* Only what a browser will render inline or a driver would sensibly send.
   Anything else is stored as a download rather than served as itself —
   serving an arbitrary content-type back to a browser from a shared server
   is how a chat becomes an attack. */
const UPLOAD_TYPES = {
  'image/jpeg': '.jpg', 'image/png': '.png', 'image/gif': '.gif',
  'image/webp': '.webp', 'application/pdf': '.pdf', 'text/plain': '.txt',
  'text/csv': '.csv', 'application/zip': '.zip',
  'video/mp4': '.mp4', 'audio/webm': '.weba', 'audio/mpeg': '.mp3',
};

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

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

  /* ---- direct messages ---- */

  if (p === '/api/dm/threads' && method === 'GET') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });
    return json(res, 200, { threads: threadsFor(me) });
  }

  const dmGet = p.match(/^\/api\/dm\/([^/]+)$/);
  if (dmGet && method === 'GET') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });

    const withId = decodeURIComponent(dmGet[1]);

    /* The room is a thread like any other; it just is not a person, so it
       is not looked up as one. */
    if (isRoom(withId)) {
      const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
      const page = dmPage(FLEET_ROOM, limit, url.searchParams.get('before'));
      return json(res, 200, Object.assign({
        withId: FLEET_ROOM,
        room: true,
        online: true,
        members: onlineDrivers().length,
      }, page));
    }

    if (!driverRecord(withId)) return json(res, 404, { error: 'no such driver' });

    const limit = Math.min(200, Math.max(1, Number(url.searchParams.get('limit')) || 50));
    const page = dmPage(threadId(me.id, withId), limit, url.searchParams.get('before'));
    return json(res, 200, Object.assign({ withId, online: isOnline(withId) }, page));
  }

  if (p === '/api/dm/send' && method === 'POST') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });
    if (!allowWrite(req)) return json(res, 429, { error: 'slow down' });

    const b = await body(req);
    const to = String((b && b.to) || '');
    const toRoom = isRoom(to);

    /* Talking to yourself is a mistake; talking to the room you are in is
       the whole point of it, so the self check does not apply there. */
    const other = toRoom ? null : driverRecord(to);
    if (!toRoom && !other) return json(res, 404, { error: 'no such driver' });
    if (other && String(other.id) === String(me.id)) {
      return json(res, 400, { error: 'that is your own thread' });
    }

    const text = String((b && b.text) || '').trim().slice(0, 4000);

    /* An attachment is a message on its own — a photo of a delivery note
       needs no caption. But something has to be there. */
    const attachment = (b && b.attachment && uploads[b.attachment.id])
      ? uploads[b.attachment.id]
      : null;

    if (!text && !attachment) {
      return json(res, 400, { error: 'an empty message is not a message' });
    }

    /* Identity comes from the token, never from the body — otherwise
       anyone could post as anyone. */
    const message = {
      id: 'DM-' + crypto.randomBytes(8).toString('hex'),
      driverId: me.id,
      driver: me.name,
      role: levelOf(me.role) >= CONTROL_LEVEL ? 'staff' : 'driver',
      to: toRoom ? FLEET_ROOM : other.id,
      room: toRoom || undefined,
      text,
      attachment,
      at: new Date().toISOString(),
      /* A room message is never "read" by one person, so the field that
         means that is left off rather than set to something untrue. */
      readAt: toRoom ? undefined : null,
    };

    const id = toRoom ? FLEET_ROOM : threadId(me.id, other.id);
    dmFor(id).push(message);

    /* A thread nobody will ever scroll back through does not need to grow
       without limit. */
    if (dms[id].length > 2000) dms[id] = dms[id].slice(-2000);

    save(DM_FILE, dms);

    /* Both ends: the sender's other windows as well, so a message typed on
       the desktop appears in the browser they left open. */
    if (toRoom) {
      /* Everyone, including the sender's other windows. */
      broadcast('dm', { kind: 'dm.message', threadId: id, room: true, message });
    } else {
      sendTo(other.id, 'dm', { kind: 'dm.message', threadId: id, message });
      sendTo(me.id, 'dm', { kind: 'dm.message', threadId: id, message });
    }

    return json(res, 200, { message });
  }

  if (p === '/api/dm/read' && method === 'POST') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });

    const b = await body(req);
    const withId = String((b && b.withId) || '');

    /* Nobody is told when the room is read: in a room of twenty, twenty
       read receipts per message is noise, and there is no one sender
       waiting to see a tick. The mark is kept for the reader alone. */
    if (isRoom(withId)) {
      roomReads[String(me.id)] = new Date().toISOString();
      save(ROOM_READS_FILE, roomReads);
      return json(res, 200, { read: 0, room: true });
    }

    if (!driverRecord(withId)) return json(res, 404, { error: 'no such driver' });

    const id = threadId(me.id, withId);
    const now = new Date().toISOString();
    let n = 0;

    /* Only the other side's messages — marking your own as read is
       meaningless and would tell them you had read yourself. */
    dmFor(id).forEach((m) => {
      if (String(m.driverId) !== String(me.id) && !m.readAt) { m.readAt = now; n++; }
    });

    if (n) {
      save(DM_FILE, dms);
      sendTo(withId, 'dm', { kind: 'dm.read', threadId: id, by: me.id, at: now });
    }
    return json(res, 200, { read: n });
  }

  if (p === '/api/dm/message/delete' && method === 'POST') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });

    const b = await body(req);
    const id = String((b && b.id) || '');

    let found = null;
    let inThread = null;
    Object.keys(dms).some((tid) => {
      const hit = dms[tid].find((m) => m.id === id);
      if (hit) { found = hit; inThread = tid; }
      return !!hit;
    });
    if (!found) return json(res, 404, { error: 'no such message' });

    const mine = String(found.driverId) === String(me.id);
    if (!mine && levelOf(me.role) < CONTROL_LEVEL) {
      return json(res, 403, { error: 'not yours to remove' });
    }

    /* A hole, not a disappearance — the same as convoy chat. */
    found.deleted = true;
    found.text = '';
    found.attachment = null;
    found.deletedBy = me.id;
    found.deletedAt = new Date().toISOString();

    save(DM_FILE, dms);
    inThread.split('~').forEach((who) => {
      sendTo(who, 'dm', { kind: 'dm.message.deleted', threadId: inThread, message: found });
    });
    return json(res, 200, { ok: true });
  }

  /* ---- attachments ---- */

  if (p === '/api/files' && method === 'POST') {
    const me = whoami(req);
    if (!me) return json(res, 401, { error: 'no identity' });
    if (!allowWrite(req)) return json(res, 429, { error: 'slow down' });

    const type = String(req.headers['content-type'] || '').split(';')[0].trim();
    const ext = UPLOAD_TYPES[type];
    if (!ext) {
      return json(res, 415, {
        error: 'that kind of file cannot be sent here',
        accepted: Object.keys(UPLOAD_TYPES),
      });
    }

    let buf;
    try {
      buf = await rawBody(req, MAX_UPLOAD);
    } catch (e) {
      return json(res, 413, {
        error: 'that file is larger than ' + Math.round(MAX_UPLOAD / 1e6) + ' MB',
      });
    }
    if (!buf.length) return json(res, 400, { error: 'that file was empty' });

    const id = crypto.randomBytes(16).toString('hex');

    /* The name is decoration: it is shown, never used as a path. The file on
       disk is named by its id, so nothing a client sends can escape the
       directory or overwrite anything. */
    const name = String(req.headers['x-hll-filename'] || 'file' + ext)
      .replace(/[\r\n]/g, '').slice(0, 120);

    try {
      fs.mkdirSync(FILES_DIR, { recursive: true });
      fs.writeFileSync(path.join(FILES_DIR, id + ext), buf);
    } catch (e) {
      console.warn('[hll] could not store an upload: ' + e.message);
      return json(res, 500, { error: 'the file could not be stored' });
    }

    const meta = {
      id,
      name,
      type,
      ext,
      size: buf.length,
      image: IMAGE_TYPES.indexOf(type) > -1,
      url: '/files/' + id,
      by: me.id,
      at: new Date().toISOString(),
    };

    uploads[id] = meta;
    save(FILES_FILE, uploads);
    return json(res, 200, { file: meta });
  }

  return json(res, 404, { error: 'no such endpoint' });
}

/* ---------------- calls ---------------- */

/* The media never comes through here. Two browsers negotiate a direct
   connection and the audio and video go between them; all this service does
   is carry the handshake — the offer, the answer, and the ICE candidates —
   from one to the other, because they have no other way to reach each other
   before the connection exists.

   That is why there is no bandwidth cost to a call and no recording of one:
   the service sees who rang whom, and never a second of it. */
/* join and leave are the room's two extra signals: a group call has no
   ringing and no answering, you are either in it or you are not. */
const CALL_SIGNALS = ['ring', 'offer', 'answer', 'ice', 'accept', 'decline',
  'hangup', 'busy', 'join', 'leave'];

/* Who is in the group call right now.

   Held in memory only, and on purpose: a call is happening or it is not,
   and a participant list that survived a restart would list people who
   hung up when the process died. */
const roomCall = new Map();       /* driverId -> { name, at, video } */

function roomCallList() {
  return Array.from(roomCall.entries()).map(([id, v]) => ({
    driverId: id, name: v.name, video: !!v.video, since: v.at,
  }));
}

/* Somebody who closed the tab without leaving is still in the map. They
   are not on the stream any more, so drop them when anybody asks. */
function pruneRoomCall() {
  const live = new Set(onlineDrivers());
  let changed = false;
  roomCall.forEach((_v, id) => {
    if (!live.has(id)) { roomCall.delete(id); changed = true; }
  });
  return changed;
}

async function callSignal(req, res) {
  const me = whoami(req);
  if (!me) return json(res, 401, { error: 'no identity' });

  const b = await body(req);
  const kind = String((b && b.kind) || '');
  if (CALL_SIGNALS.indexOf(kind) === -1) {
    return json(res, 400, { error: 'unknown signal' });
  }

  const to = String((b && b.to) || '');

  /* ---- the group call ----

     Joining and leaving are announcements to the room; everything else in
     a group call is still one peer talking to one other peer, because a
     mesh is exactly that — an offer, an answer and some candidates, per
     pair. So only join and leave are handled here, and the rest falls
     through to the ordinary one-to-one path with a real driver id on it. */
  if (isRoom(to)) {
    pruneRoomCall();

    if (kind === 'join') {
      /* The list is taken BEFORE adding them, so what comes back is who
         to call — a joiner offers to everyone already in, and everyone
         already in waits to be offered to. One offer per pair, and no
         race about which end starts it. */
      const peers = roomCallList().filter((p) => p.driverId !== String(me.id));

      roomCall.set(String(me.id), {
        name: me.name, at: new Date().toISOString(), video: !!(b && b.video),
      });

      sendToOthers(me.id, 'call', {
        kind: 'room.joined',
        room: FLEET_ROOM,
        from: me.id,
        fromName: me.name,
        video: !!(b && b.video),
        at: new Date().toISOString(),
      });

      return json(res, 200, { peers, joined: true });
    }

    if (kind === 'leave' || kind === 'hangup') {
      roomCall.delete(String(me.id));

      sendToOthers(me.id, 'call', {
        kind: 'room.left',
        room: FLEET_ROOM,
        from: me.id,
        fromName: me.name,
        at: new Date().toISOString(),
      });

      return json(res, 200, { left: true });
    }

    return json(res, 400, { error: 'that signal needs a driver, not the room' });
  }

  const other = driverRecord(to);
  if (!other) return json(res, 404, { error: 'no such driver' });

  /* Ringing somebody with nothing open would ring nowhere, and the caller
     would sit listening to a tone that was never going to be answered. */
  if (kind === 'ring' && !isOnline(to)) {
    return json(res, 409, { error: 'that driver is not connected' });
  }

  const delivered = sendTo(to, 'call', {
    kind,
    callId: String((b && b.callId) || ''),
    from: me.id,
    fromName: me.name,
    video: !!(b && b.video),
    payload: (b && b.payload) || null,
    at: new Date().toISOString(),
  });

  return json(res, 200, { delivered });
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

    /* A direct message and a ringing call have to reach one person. The
       header cannot be set on an EventSource, so the token comes on the
       query string — it is the same token, over the same connection, and
       it never leaves this service. */
    const streamToken = url.searchParams.get('token') || '';
    const streamSession = streamToken ? sessions[streamToken] : null;
    res.hllDriverId = streamSession ? String(streamSession.driverId) : null;

    listeners.add(res);

    /* Somebody who was ringing while this driver was away has long since
       given up, so the arrival is announced rather than the backlog
       replayed: the people talking to them can see they are back. */
    if (res.hllDriverId) {
      broadcast('presence', { driverId: res.hllDriverId, online: true });
    }

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

    const drop = () => {
      clearInterval(beat);
      listeners.delete(res);
      /* Only once the last window closes — a driver moving between the
         client and a browser has not gone offline. */
      if (res.hllDriverId && !isOnline(res.hllDriverId)) {
        broadcast('presence', { driverId: res.hllDriverId, online: false });
      }
    };
    req.on('close', drop);
    req.on('error', drop);
    return undefined;
  }

  /* ---- a plain look at what the service is doing ---- */
  if (url.pathname === '/status') {
    const n = listeners.size;
    const lines = [
      'Gaming Nation company service',
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

  /* Who is in the group call, for a page that wants to show it without
     joining — the button says "Join (3)" rather than making somebody dial
     in to find out whether anybody is there. */
  if (url.pathname === '/api/call/room' && req.method === 'GET') {
    if (!whoami(req)) return json(res, 401, { error: 'no identity' });
    pruneRoomCall();
    return json(res, 200, { room: FLEET_ROOM, peers: roomCallList() });
  }

  if (url.pathname === '/api/call/signal' && req.method === 'POST') {
    return callSignal(req, res).catch((e) => {
      console.warn('[hll] call signal: ' + e.message);
      try { json(res, 500, { error: 'the service failed on that' }); } catch (x) { /* gone */ }
    });
  }

  /* An attachment. Served from the upload directory by id — never by the
     name the sender gave it, so nothing in that name can reach the disk. */
  const wantFile = url.pathname.match(/^\/files\/([a-f0-9]{32})$/);
  if (wantFile) {
    const meta = uploads[wantFile[1]];
    if (!meta) return json(res, 404, { error: 'no such file' });

    const onDisk = path.join(FILES_DIR, meta.id + meta.ext);
    let data;
    try { data = fs.readFileSync(onDisk); } catch (e) {
      return json(res, 404, { error: 'that file is no longer held' });
    }

    return res.writeHead(200, {
      'Content-Type': meta.type,
      'Content-Length': data.length,
      /* Named for the save dialog, and shown inline when it is something a
         browser can show. Anything else downloads rather than rendering,
         which is what stops an upload behaving like a page. */
      'Content-Disposition': (meta.image ? 'inline' : 'attachment')
        + '; filename="' + meta.name.replace(/"/g, '') + '"',
      'Cache-Control': 'private, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Access-Control-Allow-Origin': '*',
    }).end(data);
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
  console.log('  Gaming Nation — company service');
  console.log('  --------------------------------------');
  console.log('  Website      :  ' + base + '/');
  console.log('  Console      :  ' + base + '/admin.html');
  console.log('  Live channel :  ' + base + '/api/stream');
  console.log('  Messages     :  ' + base + '/api/dm/threads');
  console.log('  Attachments  :  ' + base + '/files/<id>');
  console.log('  Calls        :  ' + base + '/api/call/signal');
  console.log('  Fleet room   :  ' + base + '/api/dm/%23fleet   (group chat)');
  console.log('  Group call   :  ' + base + '/api/call/room');
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
