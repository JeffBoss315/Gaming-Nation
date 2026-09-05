/* ============================================================
   GAMING NATION GAME CONNECTOR
   ------------------------------------------------------------
   A small program that sits on a driver's Windows PC, watches the
   game, and reports it to Gaming Nation. No window, no records of its
   own — it starts with Windows and is never thought about again.

     node game-connector.js --service http://hll-host:7040 \
                            --driver HLL-1001

   Or put the settings in hll-connector.json beside it and just
   run it.

   The driver never tells anybody they are playing. The game comes
   up, the connector sees it, and Gaming Nation knows:

     game launched  ->  driver identified  ->  ONLINE  ->  telemetry
                                                             |
                            job taken  ->  tracked live  ->  delivered

   Three things make this trustworthy rather than merely clever:

   Nothing is lost. A delivery is worth money, so it is written to
   an outbox on disk before anything is sent, and retried until
   Gaming Nation accepts it. The service being down, the network
   dropping or the PC rebooting mid-run costs the driver nothing.

   Silence is not the same as leaving. A telemetry server that
   stops answering is a connection lost; a telemetry server that
   answers and says the game is gone is a session ended. They are
   reported as different things because they mean different things
   to whoever is watching the board.

   Nothing is trusted. Every run is filed with what the telemetry
   actually saw, and Gaming Nation decides whether that story holds
   together. The connector never marks its own work as verified.
   ============================================================ */
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

/* ---------------- settings ---------------- */
const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i > -1 && args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : fallback;
};
const has = (name) => args.indexOf('--' + name) > -1;

const CONFIG_FILE = flag('config', path.join(__dirname, 'gmn-connector.json'));
let file = {};
try { file = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
catch (e) { if (e.code !== 'ENOENT') console.warn('  config unreadable:', e.message); }

const CFG = {
  service: flag('service', file.service || (process.env.GMN_SERVICE || process.env.HLL_SERVICE) || ''),
  driverId: flag('driver', file.driverId || (process.env.GMN_DRIVER || process.env.HLL_DRIVER) || ''),
  name: flag('name', file.name || (process.env.GMN_NAME || process.env.HLL_NAME) || ''),
  key: flag('key', file.key || (process.env.GMN_API_KEY || process.env.HLL_API_KEY) || ''),
  game: (flag('game', file.game || 'ets2') === 'ats') ? 'ats' : 'ets2',
  telemetryHost: flag('telemetry-host', file.telemetryHost || 'localhost'),
  telemetryPort: flag('telemetry-port', file.telemetryPort || '25555'),
  pollMs: Number(flag('poll', file.pollMs || 400)),
  outbox: flag('outbox', file.outbox || path.join(__dirname, 'gmn-outbox.json')),
  quiet: has('quiet') || !!file.quiet,
};

function usage() {
  console.log(`
  Gaming Nation Game Connector

    node game-connector.js --service <url> --driver <GMN id>

  Options
    --service <url>          the Gaming Nation company service, e.g. http://hll:7040
    --driver <id>            the driver's Gaming Nation id, e.g. HLL-1001
    --name <name>            overrides the name on the roster
    --key <key>              the service's API key, if it requires one
    --game ets2|ats          which game to read (default ets2)
    --telemetry-host <host>  where the telemetry server is (default localhost)
    --telemetry-port <port>  its port (default 25555)
    --poll <ms>              how often to read the game (default 400)
    --config <file>          settings file (default hll-connector.json)
    --outbox <file>          where unsent work is kept (default hll-outbox.json)
    --quiet                  only report what changes

  Or put any of these in hll-connector.json beside this file:

    { "service": "http://hll:7040", "driverId": "HLL-1001" }

  Needs the SCS telemetry plugin in <game>/bin/win_x64/plugins/ and the
  telemetry server running. Start it before or after the game — it waits.
`);
}

if (has('help') || !CFG.service || !CFG.driverId) {
  usage();
  if (!has('help')) { console.log('  --service and --driver are both required.\n'); process.exit(1); }
  process.exit(0);
}

const BASE = CFG.service.replace(/\/$/, '');
const POLL = Math.max(200, CFG.pollMs || 400);
let NAME = CFG.name || CFG.driverId;

const log = (msg) => console.log('  ' + new Date().toTimeString().slice(0, 8) + '  ' + msg);
const say = (msg) => { if (!CFG.quiet) log(msg); };

/* ---------------- talking to Gaming Nation ---------------- */
function request(method, pathname, body) {
  return new Promise((resolve) => {
    let url;
    try { url = new URL(BASE + pathname); } catch (e) { resolve(null); return; }
    const payload = body ? JSON.stringify(body) : null;
    const headers = {};
    if (payload) {
      headers['Content-Type'] = 'application/json';
      headers['Content-Length'] = Buffer.byteLength(payload);
    }
    if (CFG.key) headers['X-HLL-Key'] = CFG.key;

    const lib = url.protocol === 'https:' ? https : http;
    const req = lib.request({
      protocol: url.protocol, hostname: url.hostname, port: url.port,
      path: url.pathname + url.search, method, headers, timeout: 8000,
    }, (res) => {
      let raw = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { raw += c; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { /* not json */ }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('timeout', () => { req.destroy(); resolve(null); });
    req.on('error', () => resolve(null));
    req.end(payload);
  });
}
const post = (p, b) => request('POST', p, b);
const get = (p) => request('GET', p, null);


/* ============================================================
   THE OUTBOX
   ------------------------------------------------------------
   A delivery is worth money. Losing one because the service was
   restarting is not acceptable, so nothing that matters is sent
   directly: it is written to disk first, then sent, and only
   removed once Gaming Nation has said it has it.

   That makes every write survive the service being down, the
   network dropping, and the PC being switched off mid-run — the
   connector picks the queue back up next time it starts.

   Positions are deliberately NOT queued. A position is only worth
   anything while it is current; a stale one replayed ten minutes
   later would put a truck somewhere it no longer is.
   ============================================================ */
const Outbox = {
  items: [],
  sending: false,
  dirty: false,

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(CFG.outbox, 'utf8'));
      if (Array.isArray(raw)) this.items = raw;
    } catch (e) {
      if (e.code !== 'ENOENT') console.warn('  outbox unreadable:', e.message);
    }
    if (this.items.length) log(this.items.length + ' unsent item(s) from last time — will retry');
  },

  save() {
    if (!this.dirty) return;
    this.dirty = false;
    const tmp = CFG.outbox + '.tmp';
    try {
      /* write then rename, so being killed mid-write cannot leave half a file */
      fs.writeFileSync(tmp, JSON.stringify(this.items), 'utf8');
      fs.renameSync(tmp, CFG.outbox);
    } catch (e) { console.warn('  could not save the outbox:', e.message); }
  },

  add(kind, pathname, body) {
    this.items.push({
      kind, path: pathname, body,
      at: Date.now(), tries: 0, next: 0,
    });
    if (this.items.length > 500) this.items = this.items.slice(-500);
    this.dirty = true;
    this.save();
    this.flush();
  },

  /* Send what is due. One at a time and in order, because a job.start that
     arrives after its own job.delivered reads as nonsense on the board. */
  async flush() {
    if (this.sending || !this.items.length) return;
    this.sending = true;
    try {
      while (this.items.length) {
        const item = this.items[0];
        if (item.next && Date.now() < item.next) break;    /* still backing off */

        const res = await post(item.path, item.body);
        const ok = res && res.status >= 200 && res.status < 300;

        if (ok) {
          this.items.shift();
          this.dirty = true;
          if (item.tries > 0) log('sent a queued ' + item.kind + ' after ' + item.tries + ' retries');
          continue;
        }

        /* A refusal is not a network problem: retrying a request the service
           has rejected will be rejected for ever. Drop it, loudly. */
        if (res && res.status >= 400 && res.status < 500 && res.status !== 429) {
          log('Gaming Nation refused a ' + item.kind + ' (' + res.status + ') — dropping it'
            + (res.body && res.body.error ? ': ' + res.body.error : ''));
          this.items.shift();
          this.dirty = true;
          continue;
        }

        item.tries++;
        item.next = Date.now() + Math.min(60000, 2000 * Math.pow(1.8, Math.min(item.tries, 6)));
        this.dirty = true;
        break;                       /* keep order: nothing after it goes yet */
      }
    } finally {
      this.sending = false;
      this.save();
    }
  },

  pending() { return this.items.length; },
};


/* ---------------- reading the game ---------------- */
const TELEMETRY = 'http://' + CFG.telemetryHost + ':' + CFG.telemetryPort
  + '/api/' + CFG.game + '/telemetry';

const readGame = () => new Promise((resolve) => {
  const req = http.get(TELEMETRY, { timeout: 1500 }, (res) => {
    if (res.statusCode !== 200) { res.resume(); resolve(null); return; }
    let raw = '';
    res.setEncoding('utf8');
    res.on('data', (c) => { raw += c; });
    res.on('end', () => {
      try { resolve(normalise(JSON.parse(raw))); } catch (e) { resolve(null); }
    });
  });
  req.on('timeout', () => { req.destroy(); resolve(null); });
  req.on('error', () => resolve(null));
});

/* The server's payload in the shape the rest of this file uses. Everything
   the SCS SDK exposes that Gaming Nation has a use for — including the trailer,
   which is half of what a lorry is. */
function normalise(raw) {
  const t = raw.truck || {};
  const p = t.placement || {};
  const j = raw.job || {};
  const g = raw.game || {};
  const n = raw.navigation || {};
  const tr = raw.trailer || (Array.isArray(raw.trailers) ? raw.trailers[0] : {}) || {};
  const share = (v, of_) => (of_ ? Math.min(100, Math.max(0, (v / of_) * 100)) : null);
  const worst = (o, keys) => {
    let m = null;
    keys.forEach((k) => { if (typeof o[k] === 'number') m = Math.max(m == null ? 0 : m, o[k]); });
    return m == null ? null : Math.min(100, Math.max(0, m * 100));
  };

  return {
    at: Date.now(),
    /* the telemetry server answered; whether the GAME is up is separate */
    connected: g.connected !== false,
    paused: !!g.paused,
    game: String(g.gameName || '').toUpperCase().indexOf('ATS') > -1 ? 'ats' : 'ets2',
    truck: {
      make: t.make || '', model: t.model || '',
      speed: Math.max(0, Math.round(t.speed || 0)),
      odometer: t.odometer || 0,
      fuel: share(t.fuel, t.fuelCapacity),
      fuelLitres: typeof t.fuel === 'number' ? Math.round(t.fuel) : null,
      fuelCapacity: typeof t.fuelCapacity === 'number' ? Math.round(t.fuelCapacity) : null,
      damage: worst(t, ['wearEngine', 'wearTransmission', 'wearCabin', 'wearChassis', 'wearWheels']),
      engineOn: t.engineOn !== false,
    },
    trailer: (tr.attached || tr.present) ? {
      attached: true,
      name: tr.name || tr.model || '',
      id: tr.id || '',
      mass: typeof tr.mass === 'number' ? Math.round(tr.mass / 1000) : null,   /* tonnes */
      damage: worst(tr, ['wear', 'wearChassis', 'wearWheels', 'wearBody']),
    } : { attached: false },
    pos: { x: p.x || 0, y: p.y || 0, z: p.z || 0, heading: p.heading || 0 },
    job: (j.cargo || j.destinationCity) ? {
      cargo: j.cargo || '',
      mass: typeof j.mass === 'number' ? Math.round(j.mass / 1000) : null,
      income: j.income || 0,
      from: j.sourceCity || '', to: j.destinationCity || '',
      fromCompany: j.sourceCompany || '', toCompany: j.destinationCompany || '',
      remainingKm: n.estimatedDistance ? Math.round(n.estimatedDistance / 1000) : null,
    } : null,
    speedLimit: n.speedLimit || null,
  };
}


/* ============================================================
   STATE
   ------------------------------------------------------------
   Two separate questions, deliberately not conflated:

     is the telemetry link answering?   (link)
     is the game running behind it?     (gameUp)

   A telemetry server that stops answering is a CONNECTION LOST —
   the driver may still be playing and we simply cannot see them.
   A telemetry server that answers and reports the game gone is a
   SESSION ENDED — they have stopped. Reporting both as "offline"
   would tell whoever is watching the board the wrong thing.
   ============================================================ */
const S = {
  link: true,           /* the telemetry server is answering */
  gameUp: false,        /* a game is running behind it */
  misses: 0,
  lostAt: null,
  job: null,
  lastPush: 0,
  lastPct: null,
  serviceUp: null,
  samples: [],
  odoLast: null,
  drivingMs: 0,         /* time actually moving, this session */
  lastTick: null,
  sessionStart: null,
};

/* three misses before believing the link has gone, so one dropped read is
   not reported as a driver vanishing */
const MISSES_BEFORE_LOST = 3;
/* how long a lost link is tolerated before the session is called over */
const LOST_GRACE_MS = 90000;

const SAMPLE_MS = 300000;
function averageSpeed() {
  const cut = Date.now() - SAMPLE_MS;
  S.samples = S.samples.filter((s) => s.at >= cut);
  const moving = S.samples.filter((s) => s.speed >= 5);
  if (!moving.length) return null;
  return moving.reduce((t, s) => t + s.speed, 0) / moving.length;
}

/* an event is worth keeping, so it goes through the outbox */
function emit(kind, text, level, extra) {
  Outbox.add('event', '/api/fleet/event', Object.assign({
    kind, driverId: CFG.driverId, driver: NAME,
    text: text || '', level: level || 'info',
    game: (S.job && S.job.game) || CFG.game,
  }, extra || {}));
}


/* ---------------- the run ---------------- */
async function openJob(frame) {
  const km = frame.job.remainingKm || 0;

  /* the number comes from Gaming Nation so it runs in one sequence across the
     whole company; if the service cannot be reached the run still starts,
     under a local number that says so */
  let id = null;
  const res = await post('/api/jobs/id', {});
  if (res && res.status === 200 && res.body && res.body.id) id = res.body.id;
  if (!id) {
    id = 'GMN-L' + Date.now().toString(36).toUpperCase().slice(-6);
    log('could not get a job number from Gaming Nation — using ' + id + ' for now');
  }

  S.job = {
    id,
    from: frame.job.from || '', to: frame.job.to || '',
    fromCompany: frame.job.fromCompany || '', toCompany: frame.job.toCompany || '',
    cargo: frame.job.cargo || 'Cargo',
    mass: frame.job.mass || null,
    income: frame.job.income || 0,
    truck: [frame.truck.make, frame.truck.model].filter(Boolean).join(' '),
    trailer: frame.trailer.attached ? (frame.trailer.name || 'Trailer') : '',
    km: km || 1, drivenKm: 0, odoKm: 0,
    started: new Date().toISOString(),
    game: frame.game,
    top: 0, frames: 0, movingFrames: 0, drivingMs: 0,
    odoStart: frame.truck.odometer ? Math.round(frame.truck.odometer) : null,
    odoEnd: null,
  };
  S.lastPct = null;

  log('JOB STARTED  ' + id);
  say('  ' + (S.job.from || '?') + ' -> ' + (S.job.to || '?')
    + '  ' + S.job.cargo + (S.job.mass ? ' (' + S.job.mass + ' t)' : '')
    + (km ? '  ' + km + ' km' : '') + '  ' + S.job.income);

  emit('job.start',
    NAME + ' started ' + id + (S.job.from && S.job.to
      ? ' — ' + S.job.from + ' to ' + S.job.to : ''), 'ok',
    { jobId: id, from: S.job.from, to: S.job.to, cargo: S.job.cargo,
      km: S.job.km, income: S.job.income });

  pushPosition(frame, true);
}

function updateJob(frame, deltaMs) {
  const j = S.job;
  j.frames++;
  if (frame.truck.speed >= 5) {
    j.movingFrames++;
    j.drivingMs += deltaMs;
  }
  j.top = Math.max(j.top, frame.truck.speed);
  if (frame.truck.odometer) j.odoEnd = Math.round(frame.truck.odometer);
  if (!j.trailer && frame.trailer.attached) j.trailer = frame.trailer.name || 'Trailer';

  /* distance from the odometer: it does not jump when the sat-nav recalculates
     and it still works when there is no route set at all */
  if (frame.truck.odometer) {
    if (S.odoLast != null) {
      const step = frame.truck.odometer - S.odoLast;
      if (step > 0 && step < 20) j.odoKm += step;
    }
    S.odoLast = frame.truck.odometer;
  }

  if (frame.job.remainingKm != null) {
    j.km = Math.max(j.km, frame.job.remainingKm + j.drivenKm, 1);
    j.drivenKm = Math.max(0, j.km - frame.job.remainingKm);
  } else {
    j.drivenKm = Math.min(j.odoKm, j.km);
  }
  if (frame.job.to && frame.job.to !== j.to) j.to = frame.job.to;
  if (frame.job.income) j.income = frame.job.income;
}

function closeJob(frame, delivered) {
  const j = S.job;
  S.job = null;
  if (!j) return;

  if (!delivered) {
    log('JOB CANCELLED  ' + j.id);
    emit('job.cancelled',
      NAME + ' called off ' + j.id + (j.to ? ' to ' + j.to : ''), 'warn',
      { jobId: j.id, from: j.from, to: j.to, cargo: j.cargo });
    return;
  }

  const finished = new Date();
  const minutes = Math.max(0, Math.round((finished - new Date(j.started)) / 60000));
  const avg = averageSpeed();

  const record = {
    id: j.id, driverId: CFG.driverId, driver: NAME,
    from: j.from, to: j.to,
    fromCompany: j.fromCompany, toCompany: j.toCompany,
    cargo: j.cargo, mass: j.mass,
    truck: j.truck, trailer: j.trailer,
    km: Math.round(j.km), income: j.income,
    damage: frame && frame.truck.damage != null ? +frame.truck.damage.toFixed(1) : 0,
    started: j.started, finished: finished.toISOString(),
    duration: minutes,
    drivingMin: Math.round(j.drivingMs / 60000),
    avgSpeed: Math.round(avg || 0),
    /* the same evidence the desktop client attaches, so a run reported by the
       connector is checked exactly as strictly as one reported by the app */
    evidence: {
      telemetry: j.frames > 0,
      frames: j.frames,
      movingFrames: j.movingFrames,
      odoStart: j.odoStart, odoEnd: j.odoEnd,
      odoKm: Math.round(j.odoKm),
      topSpeed: Math.round(j.top),
      avgSpeed: Math.round(avg || 0),
      drivingMin: Math.round(j.drivingMs / 60000),
      firstFrameAt: j.started,
      lastFrameAt: finished.toISOString(),
      sessionId: null,
      closedBy: 'telemetry',
      client: 'connector',
    },
  };

  log('DELIVERY COMPLETED  ' + j.id + '  ' + record.km + ' km  ' + record.income
    + '  in ' + minutes + ' min');

  /* through the outbox, so it survives the service being down */
  Outbox.add('job', '/api/jobs', { job: record });
}


/* ---------------- reporting position ---------------- */
async function pushPosition(frame, force) {
  const nowMs = Date.now();
  if (!force && nowMs - S.lastPush < 900) return;
  S.lastPush = nowMs;

  const j = S.job;
  const avg = averageSpeed();
  const left = j ? Math.max(0, j.km - j.drivenKm) : null;

  const body = {
    id: CFG.driverId, name: NAME,
    game: frame.game,
    x: frame.pos.x, z: frame.pos.z,
    heading: frame.pos.heading,
    speed: frame.truck.speed,
    state: frame.paused ? 'paused'
      : j && frame.truck.speed >= 5 ? 'delivering'
      : j ? 'stopped'
      : frame.truck.speed >= 5 ? 'driving' : 'idle',
    truck: [frame.truck.make, frame.truck.model].filter(Boolean).join(' '),
    fuel: frame.truck.fuel,
    damage: frame.truck.damage,
    job: j ? {
      id: j.id, from: j.from, to: j.to, cargo: j.cargo,
      weight: j.mass || 0,
      km: Math.round(j.km), drivenKm: Math.round(j.drivenKm),
      progress: j.km ? Math.min(100, (j.drivenKm / j.km) * 100) : 0,
      etaMin: (left != null && avg) ? (left / avg) * 60 : null,
      income: j.income,
    } : null,
  };

  /* a position is only worth anything while it is current, so this one is
     sent directly and never queued — a stale one replayed later would put a
     truck somewhere it no longer is */
  const res = await post('/api/fleet/position', body);
  const up = !!(res && res.status >= 200 && res.status < 300);
  if (S.serviceUp !== up) {
    S.serviceUp = up;
    if (up) {
      log('Gaming Nation reachable' + (Outbox.pending() ? ' — sending ' + Outbox.pending() + ' queued item(s)' : ''));
      Outbox.flush();
    } else {
      log('Gaming Nation unreachable — work is being queued, nothing will be lost');
    }
  }
  if (res && res.status === 401) log('  the service rejected our key — check --key');
}


/* ---------------- game up and down ---------------- */
function gameLaunched(frame) {
  S.gameUp = true;
  S.odoLast = null;
  S.drivingMs = 0;
  S.sessionStart = Date.now();
  log('GAME LAUNCHED  ' + (frame.game === 'ats'
    ? 'American Truck Simulator' : 'Euro Truck Simulator 2'));
  emit('session.start', NAME + ' is now connected to '
    + (frame.game === 'ats' ? 'ATS' : 'ETS2'), 'info', { game: frame.game });
}

function gameClosed(why) {
  if (!S.gameUp) return;
  S.gameUp = false;
  if (S.job) closeJob(null, false);
  const mins = S.sessionStart ? Math.round((Date.now() - S.sessionStart) / 60000) : 0;
  log('GAME CLOSED  (' + why + ')  session ' + mins + ' min, '
    + Math.round(S.drivingMs / 60000) + ' min driving');
  emit('session.end', NAME + ' has stopped playing', 'info',
    { game: CFG.game });
  S.sessionStart = null;
}


/* ---------------- the loop ---------------- */
async function tick() {
  const tickAt = Date.now();
  const delta = S.lastTick ? Math.min(5000, tickAt - S.lastTick) : 0;
  S.lastTick = tickAt;

  const frame = await readGame();

  /* ---- the telemetry link is not answering at all ---- */
  if (!frame) {
    S.misses++;
    if (S.link && S.misses >= MISSES_BEFORE_LOST) {
      S.link = false;
      S.lostAt = Date.now();
      if (S.gameUp) {
        log('CONNECTION LOST  the telemetry link stopped answering');
        emit('connection.lost',
          NAME + ' has disconnected from the game', 'warn', { game: CFG.game });
      }
    }
    /* a link that stays gone long enough is a driver who has stopped, not a
       hiccup — otherwise they would sit on the board for ever */
    if (!S.link && S.gameUp && Date.now() - S.lostAt > LOST_GRACE_MS) {
      gameClosed('link gone for good');
    }
    Outbox.flush();
    return;
  }

  /* ---- the link is answering ---- */
  if (!S.link) {
    S.link = true;
    S.lostAt = null;
    if (S.gameUp) {
      log('CONNECTION RESTORED');
      emit('connection.restored', NAME + ' is back on the link', 'ok', { game: CFG.game });
    }
  }
  S.misses = 0;

  /* the link is up but the game behind it is not — a clean close */
  if (!frame.connected) {
    if (S.gameUp) gameClosed('the game reported itself closed');
    Outbox.flush();
    return;
  }

  S.samples.push({ at: frame.at, speed: frame.truck.speed });
  if (S.samples.length > 2000) S.samples = S.samples.slice(-1200);
  if (frame.truck.speed >= 5) S.drivingMs += delta;

  if (!S.gameUp) gameLaunched(frame);

  /* the run */
  if (frame.job && !S.job) { await openJob(frame); }
  else if (frame.job && S.job) updateJob(frame, delta);
  else if (!frame.job && S.job) closeJob(frame, true);

  /* report. A run that has moved on is worth saying at once; otherwise the
     heartbeat is enough to stay on the board. */
  if (S.job) {
    const pct = S.job.km ? (S.job.drivenKm / S.job.km) * 100 : 0;
    const moved = S.lastPct == null || Math.abs(pct - S.lastPct) >= 1;
    if (moved) S.lastPct = pct;
    await pushPosition(frame, moved);
  } else {
    await pushPosition(frame, false);
  }

  Outbox.flush();
}


/* ---------------- identifying the driver ---------------- */
async function identify() {
  const res = await get('/api/drivers/' + encodeURIComponent(CFG.driverId));
  if (!res) {
    log('Gaming Nation is not answering yet — starting anyway, and will keep trying');
    return true;
  }
  if (res.status === 404) {
    console.log('');
    console.log('  No driver "' + CFG.driverId + '" on the Gaming Nation roster.');
    console.log('  Check the id, or ask an administrator to approve the account first.');
    console.log('');
    return false;
  }
  if (res.status !== 200 || !res.body) {
    log('could not identify the driver (HTTP ' + res.status + ') — starting anyway');
    return true;
  }
  if (!CFG.name && res.body.name) NAME = res.body.name;
  log('driver identified — ' + NAME + '  (' + res.body.deliveries + ' runs, '
    + Math.round(res.body.km) + ' km)');
  if (res.body.active === false) log('  note: this account is suspended on the roster');
  return true;
}


/* ---------------- go ---------------- */
(async () => {
  console.log('');
  console.log('  Gaming Nation Game Connector');
  console.log('  ------------------------');
  console.log('  Driver    :  ' + CFG.driverId);
  console.log('  Gaming Nation :  ' + BASE + (CFG.key ? '  (keyed)' : ''));
  console.log('  Game      :  ' + TELEMETRY);
  console.log('  Reading every ' + POLL + 'ms. Ctrl+C to stop.');
  console.log('');

  Outbox.load();
  if (!(await identify())) process.exit(2);
  log('waiting for the game');

  const timer = setInterval(() => {
    tick().catch((e) => log('trouble: ' + e.message));
  }, POLL);

  /* a driver closing the window should not be left showing as on the road */
  let closing = false;
  const shutdown = async () => {
    if (closing) return;
    closing = true;
    clearInterval(timer);
    console.log('');
    log('stopping');
    if (S.job) closeJob(null, false);
    if (S.gameUp) {
      S.gameUp = false;
      emit('session.end', NAME + ' has stopped playing', 'info');
    }
    /* one last go at the queue, then leave the rest on disk for next time */
    await Outbox.flush();
    Outbox.save();
    if (Outbox.pending()) {
      log(Outbox.pending() + ' item(s) still queued — they will be sent next time');
    }
    log('stopped');
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
})();
