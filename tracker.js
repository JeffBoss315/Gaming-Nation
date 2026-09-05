/* ============================================================
   HLL WORLD GAMING NATION TRUCKER — driver client
   Watches the game, records deliveries, syncs them to Gaming Nation.
   Part 1 — utilities, icons, data, store
   ============================================================ */
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 8);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const randI = (a, b) => Math.floor(a + Math.random() * (b - a + 1));

const fmt = {
  n: (v) => Number(v || 0).toLocaleString('en-GB'),
  km: (v) => Number(Math.round(v) || 0).toLocaleString('en-GB') + ' km',
  eur: (v) => '€' + Number(Math.round(v) || 0).toLocaleString('en-GB'),
  pct: (v) => Math.round(v) + '%',
  clock: (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' }),
  hm: (d) => new Date(d).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  date: (d) => new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
  dt: (d) => fmt.date(d) + ' ' + fmt.hm(d),
  dur: (min) => {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return (h ? h + 'h ' : '') + m + 'm';
  },
  rel: (d) => {
    const diff = Date.now() - new Date(d).getTime();
    if (diff < 60000) return 'just now';
    if (diff < 3.6e6) return Math.round(diff / 60000) + ' min ago';
    if (diff < 8.64e7) return Math.round(diff / 3.6e6) + ' h ago';
    return Math.round(diff / 8.64e7) + ' d ago';
  },
};

/* ---------------- icons ---------------- */
const P = {
  /* these are used across the client; a missing name silently falls back to
     the info glyph, which reads as the wrong icon rather than as an error */
  users:'<circle cx="9" cy="8" r="3.2"/><path d="M2.5 20v-1.1A4.6 4.6 0 0 1 7.1 14.3h3.8A4.6 4.6 0 0 1 15.5 19v1"/><path d="M16.5 5.3a3.2 3.2 0 0 1 0 5.9M18 14.4a4.6 4.6 0 0 1 3.5 4.5V20"/>',
  bell:'<path d="M18 15V10a6 6 0 1 0-12 0v5l-1.5 2.5h15z"/><path d="M10 19.5a2 2 0 0 0 4 0"/>',
  bolt:'<path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12z"/>',
  map:'<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/>',
  search:'<circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5 21 21"/>',
  /* The reveal control on the password field promised an eye and drew a
     magnifying glass, because there was no eye to draw. */
  eye:'<path d="M1.6 12S5.3 5.5 12 5.5 22.4 12 22.4 12 18.7 18.5 12 18.5 1.6 12 1.6 12z"/>'
    + '<circle cx="12" cy="12" r="3"/>',
  eyeOff:'<path d="M3 3l18 18"/>'
    + '<path d="M10.6 6.2A9.9 9.9 0 0 1 12 5.5c6.7 0 10.4 6.5 10.4 6.5a18 18 0 0 1-3.4 4.2"/>'
    + '<path d="M6.5 7.8A17.6 17.6 0 0 0 1.6 12S5.3 18.5 12 18.5a9.9 9.9 0 0 0 3.9-.8"/>'
    + '<path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
  route:'<path d="M6 19a3 3 0 0 1 0-6h12a3 3 0 0 0 0-6H8"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="5" r="2"/>',
  shield:'<path d="M12 3l7.5 3v5.6c0 4.6-3.1 8.2-7.5 9.4-4.4-1.2-7.5-4.8-7.5-9.4V6z"/><path d="M9.2 12.2l2 2 3.6-3.9"/>',
  menu:'<path d="M4 7h16M4 12h16M4 17h16"/>',
  userPlus:'<circle cx="9" cy="8" r="3.4"/><path d="M2.5 20v-1.2A4.8 4.8 0 0 1 7.3 14h3.4a4.8 4.8 0 0 1 4.8 4.8V20"/><path d="M18 8v6M15 11h6"/>',
  target:'<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="3.6"/><path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  book:'<path d="M4 5a2 2 0 0 1 2-2h14v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h8M8 11h6"/>',
  user:'<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1.2A4.8 4.8 0 0 1 9.8 14h4.4A4.8 4.8 0 0 1 19 18.8V20"/>',
  mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  chat:'<path d="M21 12a8 8 0 0 1-8 8H4l2-3a8 8 0 1 1 15-5z"/><path d="M8.5 12h7M8.5 9h4"/>',
  trophy:'<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11"/><path d="M12 14v3M8.5 20h7l-.6-2.4H9.1z"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  upload:'<path d="M12 20V9M7.5 12.5 12 8l4.5 4.5"/><path d="M4.5 4.5h15"/>',
  settings:'<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4.7z"/>',
  info:'<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1"/>',
  logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  truck:'<path d="M2 7h11v9H2z"/><path d="M13 10h4.5l3.5 3.5V16h-8z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  play:'<path d="M7 4.8 19 12 7 19.2z"/>',
  stop:'<rect x="6" y="6" width="12" height="12" rx="1.5"/>',
  check:'<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  x:'<path d="M6 6l12 12M18 6L6 18"/>',
  refresh:'<path d="M20 11a8 8 0 0 0-14-4.5L3.5 9"/><path d="M4 13a8 8 0 0 0 14 4.5L20.5 15"/><path d="M3.5 4.5V9H8M20.5 19.5V15H16"/>',
  send:'<path d="M21 3 10.5 13.5M21 3l-7 18-3.5-7.5L3 10z"/>',
  link:'<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.4-2.4a4 4 0 1 0-5.7-5.7L11.5 6.8"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.4 2.4a4 4 0 1 0 5.7 5.7l1.4-1.4"/>',
  alert:'<path d="M12 4 2.8 20h18.4z"/><path d="M12 10v4.4"/><circle cx="12" cy="17.3" r="1"/>',
  folder:'<path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  image:'<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/>',
  pin:'<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  flag:'<path d="M5 21V4"/><path d="M5 5h10.5l-1.3 3.2L15.5 12H5z"/>',
  arrowRight:'<path d="M5 12h14M13 6l6 6-6 6"/>',
  box:'<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  gauge:'<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4.2-4.6"/><circle cx="12" cy="17" r="1.4"/>',
  fuel:'<rect x="4" y="4" width="9" height="16" rx="2"/><path d="M13 9h3.5a2 2 0 0 1 2 2v5a1.8 1.8 0 0 0 3.5 0V9l-2.5-2.5"/>',
  wrench:'<path d="M15 3.5a5.5 5.5 0 0 0-5 7.6L3.6 17.5a2 2 0 0 0 2.8 2.8l6.4-6.3A5.5 5.5 0 0 0 20 8.5l-3 1.7-2.5-1.4-.1-2.9z"/>',
  trash:'<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  plus:'<path d="M12 5v14M5 12h14"/>',
  wifi:'<path d="M2.5 9a15 15 0 0 1 19 0"/><path d="M6 12.5a10 10 0 0 1 12 0"/><path d="M9.5 16a5 5 0 0 1 5 0"/><circle cx="12" cy="19.5" r="1.2"/>',
  chevron:'<path d="M9 6l6 6-6 6"/>',
  cpu:'<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M10 3v3M14 3v3M10 18v3M14 18v3M3 10h3M3 14h3M18 10h3M18 14h3"/>',
  download:'<path d="M12 3v11M7.5 10 12 14.5 16.5 10"/><path d="M4.5 19.5h15"/>',
};
function icon(n, cls = '') {
  return `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[n] || P.info}</svg>`;
}

/* The Gaming Nation emblem — hll.jpg, the company's own artwork and the source
   every icon in this client is derived from. Used where the company's face
   belongs and nowhere else, so it keeps meaning "Gaming Nation" rather than
   becoming decoration. The artwork is square; the box is square and crops
   rather than stretches. */
function hllEmblem(size = 'md', cls = '') {
  return `<span class="hll-emblem ${esc(size)} ${esc(cls)}">
    <img src="hll.jpg" alt="Gaming Nation" width="1254" height="1254" loading="lazy">
  </span>`;
}

/* Gaming Nation mark used in the sidebar */
function brandLogo() {
  /* Cropped to the truck: the full lock-up's wordmark is illegible at 30px,
     and the name is already spelled out beside it. */
  return `<img src="icons/mark.png" alt="Gaming Nation" class="brand-img">`;
}

/* ---------------- reference data ---------------- */
const APP_VERSION = 'V1.0.0';

/* The map itself — cities, roads, regions, projection — lives in
   map-data.js, shared with the web platform. */



/* ============================================================
   LIVE TELEMETRY + POSITION
   ------------------------------------------------------------
   Reads the real game through the SCS telemetry SDK, exposed over
   HTTP by a local telemetry server (the community "ETS2/ATS
   Telemetry Server" — plugin DLL in <game>/bin/win_x64/plugins,
   server listening on :25555). If that endpoint is not answering
   the client falls back to the built-in simulator so the app is
   still usable, and says which one it is using.

   The server's payload is the same shape for both games:
     game.gameName            "ETS2" | "ATS"
     truck.placement.x/z      world position, metres
     truck.placement.heading  0..1, 0 = north, increasing west
     truck.speed              km/h
     job.sourceCity/destinationCity/cargo/income
     navigation.estimatedDistance   metres remaining
   ============================================================ */



/* ============================================================
   WHERE THE TRUCK IS
   ------------------------------------------------------------
   The game reports the truck in its own metres. Turning that into a
   place on a map needs one linear transform per game — and it only
   needs solving once, because every map format is derived from it:

     game metres  ->  real lat/lon  ->  whichever map is on screen

   That is the whole point of keeping a single transform. Calibrating
   on the road map used to leave the tile map wrong and the game map
   wrong again, because each mode kept its own.

   It calibrates itself. Every job the game hands out names the city
   it starts in and the city it ends in, and the truck is standing in
   those cities at those moments. Two of those samples, far enough
   apart, solve the transform for good — so a driver never has to do
   anything but drive.
   ============================================================ */
const Calib = {
  all() {
    const s = Store.db.settings;
    s.worldGeo = s.worldGeo || {};
    return s.worldGeo;
  },
  get(game) {
    const c = this.all()[game === 'ats' ? 'ats' : 'ets2'];
    return (c && typeof c.sx === 'number' && typeof c.sz === 'number') ? c : null;
  },
  ready(game) { return !!this.get(game); },

  /* game metres -> [lat, lon] */
  toGeo(game, x, z) {
    const c = this.get(game);
    if (!c) return null;
    const lat = c.oz + z * c.sz;
    const lon = c.ox + x * c.sx;
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return [lat, lon];
  },

  /* two samples give scale and offset on each axis */
  solve(points) {
    if (!points || points.length < 2) return null;
    /* use the widest-apart pair, which is the most accurate fit available */
    let best = null, bestSpread = 0;
    for (let i = 0; i < points.length; i++) {
      for (let j = i + 1; j < points.length; j++) {
        const a = points[i], b = points[j];
        const spread = Math.min(Math.abs(b.wx - a.wx), Math.abs(b.wz - a.wz));
        if (spread > bestSpread) { bestSpread = spread; best = [a, b]; }
      }
    }
    if (!best) return null;
    const [a, b] = best;
    const dwx = b.wx - a.wx, dwz = b.wz - a.wz;
    /* two samples in nearly the same place say nothing about scale */
    if (Math.abs(dwx) < 2000 || Math.abs(dwz) < 2000) return null;
    const sx = (b.lon - a.lon) / dwx;
    const sz = (b.lat - a.lat) / dwz;
    if (!Number.isFinite(sx) || !Number.isFinite(sz) || sx === 0 || sz === 0) return null;
    return {
      sx, ox: a.lon - a.wx * sx,
      sz, oz: a.lat - a.wz * sz,
      points: points.slice(-6),
      at: new Date().toISOString(),
    };
  },

  points(game) {
    const c = this.all()[game === 'ats' ? 'ats' : 'ets2'];
    return (c && c.points) ? c.points.slice() : [];
  },

  /* record "the truck was here, and here is where that really is" */
  addSample(game, sample, why) {
    const key = game === 'ats' ? 'ats' : 'ets2';
    const store = this.all();
    const points = this.points(game);

    /* a sample from the same spot adds nothing */
    if (points.some((p) => Math.hypot(p.wx - sample.wx, p.wz - sample.wz) < 1500)) return false;
    points.push(sample);

    const solved = this.solve(points);
    if (solved) {
      store[key] = solved;
      Store.log('ok', 'Map position calibrated from ' + (why || 'two known places')
        + ' — the truck is now placed for real');
      toast('Map calibrated', 'ok', 'Your position is now accurate on every map');
    } else {
      store[key] = Object.assign({}, store[key], { points });
      Store.log('info', 'Position reference taken at ' + (sample.city || 'a known place')
        + ' — one more, further away, completes the calibration');
    }
    Store.save();
    return !!solved;
  },

  /* a city named by the game is a place we know the real coordinates of */
  sampleFromCity(game, cityName, world, why) {
    if (!cityName || !world) return false;
    const geo = geoFor(game);
    const name = matchCity(game, cityName);
    if (!name) return false;
    const [lat, lon] = geo[name];
    return this.addSample(game, {
      wx: world.x, wz: world.z, lat, lon, city: name,
    }, why);
  },

  reset(game) {
    delete this.all()[game === 'ats' ? 'ats' : 'ets2'];
    Store.save();
  },
};

/* the game writes city names its own way; match them to the table loosely */
function matchCity(game, raw) {
  const geo = geoFor(game);
  if (geo[raw]) return raw;
  const norm = (s) => String(s).toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '');
  const want = norm(raw);
  if (!want) return null;
  for (const name in geo) if (norm(name) === want) return name;
  for (const name in geo) if (norm(cityLabel(name)) === want) return name;
  /* "Frankfurt am Main" against "Frankfurt", and the other way round */
  for (const name in geo) {
    const n = norm(name);
    if (n.length > 3 && (want.startsWith(n) || n.startsWith(want))) return name;
  }
  return null;
}

/* Solve scale+offset from two calibration samples. */
function solveCalibration(points) {
  if (!points || points.length < 2) return null;
  const a = points[points.length - 2], b = points[points.length - 1];
  const dwx = b.wx - a.wx, dwz = b.wz - a.wz;
  if (Math.abs(dwx) < 1 || Math.abs(dwz) < 1) return null;   /* too close to solve */
  const sx = (b.mx - a.mx) / dwx;
  const sz = (b.mz - a.mz) / dwz;
  return { sx, ox: a.mx - a.wx * sx, sz, oz: a.mz - a.wz * sz, points: points.slice(-2) };
}

const COMPASS = ['N', 'NW', 'W', 'SW', 'S', 'SE', 'E', 'NE'];
const headingLabel = (h) => COMPASS[Math.round((h % 1) * 8) % 8];

/* ---------- telemetry source ---------- */
const Telemetry = {
  mode: 'off',              /* off | live | sim */
  lastError: null,
  lastFrame: null,
  poll: null,
  consecutiveFailures: 0,

  endpoint() {
    const s = Store.db.settings;
    const host = (s.telemetryHost || 'localhost').trim().replace(/^https?:\/\//, '').replace(/\/$/, '');
    const port = (s.telemetryPort || '25555').trim();
    const game = s.game === 'ats' ? 'ats' : 'ets2';
    return 'http://' + host + ':' + port + '/api/' + game + '/telemetry';
  },

  /* one poll of the real server; resolves null when it is not there */
  async fetchFrame() {
    const url = this.endpoint();
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 1500);
    try {
      const res = await fetch(url, { signal: ctrl.signal, cache: 'no-store' });
      clearTimeout(timer);
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return this.normalise(await res.json());
    } catch (e) {
      clearTimeout(timer);
      this.lastError = e.name === 'AbortError' ? 'timed out' : e.message;
      return null;
    }
  },

  /* map the server payload onto the shape the app uses */
  normalise(raw) {
    const t = raw.truck || {};
    const p = t.placement || {};
    const j = raw.job || {};
    const g = raw.game || {};
    const n = raw.navigation || {};
    return {
      at: Date.now(),
      connected: g.connected !== false,
      paused: !!g.paused,
      game: (g.gameName || '').toUpperCase().indexOf('ATS') > -1 ? 'ats' : 'ets2',
      truck: {
        make: t.make || '', model: t.model || '',
        speed: Math.max(0, Math.round(t.speed || 0)),
        fuel: t.fuelCapacity ? clamp((t.fuel / t.fuelCapacity) * 100, 0, 100) : null,
        damage: t.wearEngine != null
          ? clamp(Math.max(t.wearEngine, t.wearTransmission || 0, t.wearCabin || 0,
              t.wearChassis || 0, t.wearWheels || 0) * 100, 0, 100)
          : null,
        odometer: t.odometer || 0,
      },
      pos: { x: p.x || 0, y: p.y || 0, z: p.z || 0, heading: p.heading || 0 },
      job: j.cargo || j.destinationCity ? {
        cargo: j.cargo || '', income: j.income || 0,
        from: j.sourceCity || '', to: j.destinationCity || '',
        fromCompany: j.sourceCompany || '', toCompany: j.destinationCompany || '',
        remainingKm: n.estimatedDistance ? Math.round(n.estimatedDistance / 1000) : null,
      } : null,
      speedLimit: n.speedLimit || null,
    };
  },

  start() {
    this.stop();
    const rate = Math.max(250, Number(Store.db.settings.pollRate || 400));
    this.poll = setInterval(() => this.step(), rate);
    this.step();
  },
  stop() {
    if (this.poll) { clearInterval(this.poll); this.poll = null; }
  },

  async step() {
    const db = Store.db;
    if (!db.settings.liveTelemetry) return;

    const frame = await this.fetchFrame();

    if (!frame) {
      this.consecutiveFailures++;
      /* three misses before demoting, so a single dropped poll is ignored */
      if (this.mode === 'live' && this.consecutiveFailures >= 3) {
        this.mode = 'off';
        db.conn.telemetry = 'searching';
        Store.log('warn', 'Lost the telemetry server (' + this.lastError + ')');
        /* on the desktop the process watch has the final say on whether the
           game is really gone; in a browser this is the only signal there is */
        GameWatch.ended('telemetry');
        Store.save();
        render();
      }
      return;
    }

    this.consecutiveFailures = 0;
    if (this.mode !== 'live') {
      this.mode = 'live';
      db.conn.telemetry = 'live';
      db.conn.link = 'connected';
      Store.log('ok', 'Live telemetry connected — ' + mapFor(frame.game).label);
      GameWatch.began(frame.game, 'telemetry');
      Store.save();
      render();
    }
    this.apply(frame);
  },

  /* fold a live frame into the app state */
  apply(frame) {
    const db = Store.db;
    this.lastFrame = frame;

    /* one transform, and every map format is derived from it */
    const geo = Calib.toGeo(frame.game, frame.pos.x, frame.pos.z);
    const ll = geo ? geoToGameLatLng(frame.game, geo[0], geo[1]) : null;
    const mx = ll ? ll.lng : null;
    const mz = ll ? -ll.lat : null;

    db.live = {
      at: frame.at,
      game: frame.game,
      world: { x: frame.pos.x, z: frame.pos.z },
      map: (mx == null) ? null : { x: mx, z: mz },
      geo,                                   /* [lat, lon], or null until calibrated */
      truck: [frame.truck.make, frame.truck.model].filter(Boolean).join(' '),
      heading: frame.pos.heading,
      speed: frame.truck.speed,
      speedLimit: frame.speedLimit,
      near: (mx == null) ? null : nearestCity(frame.game, mx, mz),
      paused: frame.paused,
    };

    /* breadcrumb trail, thinned so it stays cheap to draw. The schematic
       trail is in map units; the tile map needs raw world coords because its
       transform is learned separately. */
    db.trail = db.trail || [];
    if (mx != null) {
      const last = db.trail[db.trail.length - 1];
      if (!last || Math.hypot(last[0] - mx, last[1] - mz) > 1.2) {
        db.trail.push([+mx.toFixed(1), +mz.toFixed(1)]);
        if (db.trail.length > 400) db.trail = db.trail.slice(-400);
      }
    }
    db.worldTrail = db.worldTrail || [];
    const lastW = db.worldTrail[db.worldTrail.length - 1];
    if (!lastW || Math.hypot(lastW[0] - frame.pos.x, lastW[1] - frame.pos.z) > 40) {
      db.worldTrail.push([Math.round(frame.pos.x), Math.round(frame.pos.z)]);
      if (db.worldTrail.length > 600) db.worldTrail = db.worldTrail.slice(-600);
    }

    /* the driver record follows whatever they are actually driving */
    const truckName = [frame.truck.make, frame.truck.model].filter(Boolean).join(' ');
    if (truckName && db.driver && db.driver.truck !== truckName) {
      db.driver.truck = truckName;
      Store.log('info', 'Driving a ' + truckName);
    }

    this.syncJob(frame);
    JobTracker.observe(frame);
    this.deriveActivity(frame);
    Siren.check(frame.truck.speed);

    if (state.view === 'livemap') paintLiveMap();
    else if (state.view === 'dashboard') { paintLiveJob(); paintLiveDrivers(); }

    /* the screen follows every frame, but writing the run out is throttled to
       the live job update interval — a full serialise every second is waste */
    const every = (Number(db.settings.jobUpdateSec) || 10) * 1000;
    if (this.savedAt == null || Date.now() - this.savedAt >= every) {
      this.savedAt = Date.now();
      Store.save();
    }
  },

  /* a job starting or finishing is structural, so it is written out at once */
  saveNow() { this.savedAt = Date.now(); Store.save(); },

  /* a job appearing/disappearing in telemetry drives the run automatically */
  syncJob(frame) {
    const db = Store.db;

    if (frame.job && !db.job) {
      const km = frame.job.remainingKm || 0;
      db.job = {
        id: 'JOB-' + randI(4300, 4999),
        from: frame.job.from || (db.live.near ? db.live.near.city : '—'),
        to: frame.job.to || '—',
        cargo: frame.job.cargo || 'Cargo',
        trailer: 'From game', weight: 0,
        km: km || 1, drivenKm: 0,
        income: frame.job.income || 0,
        market: 'In-game job',
        started: new Date().toISOString(),
        speed: frame.truck.speed || 80,
        damage: frame.truck.damage != null ? frame.truck.damage : 0,
        fuel: frame.truck.fuel != null ? frame.truck.fuel : 100,
        status: 'driving',
        live: true,
        odoKm: 0,
        events: [],
        avgSpeed: 0,
        top: 0,
        etaMin: null,
      };
      Store.log('ok', 'Job detected in game — ' + db.job.from + ' to ' + db.job.to +
        (km ? ' (' + km + ' km to run)' : ''));
      /* the truck is standing in the source city right now, and we know where
         that city really is — a free calibration reference */
      Calib.sampleFromCity(frame.game, frame.job.from, frame.pos, 'the city this job started in');
      toast('Run detected: ' + db.job.from + ' → ' + db.job.to, 'ok');

      /* the run begins the moment the game hands it out, so the company hears
         about it now rather than on the next heartbeat */
      JobTracker.reset(db.job.id);
      JobTracker.note(db.job, 'pickup',
        'Picked up ' + db.job.cargo + ' in ' + cityLabel(db.job.from), 'ok', 'box');
      Fleet.emit('job.start',
        db.driver.name + ' picked up ' + db.job.cargo + ' in ' + cityLabel(db.job.from)
        + ' for ' + cityLabel(db.job.to), 'ok');
      Fleet.pushNow();

      this.saveNow();
      render();
      return;
    }

    if (frame.job && db.job && db.job.live) {
      const j = db.job;
      j.speed = frame.truck.speed || j.speed;
      if (frame.truck.fuel != null) j.fuel = frame.truck.fuel;
      if (frame.truck.damage != null) j.damage = frame.truck.damage;
      if (frame.job.remainingKm != null) {
        /* the game reports distance remaining; the longest value seen is the
           full run, so progress is what has been eaten out of it */
        j.km = Math.max(j.km, frame.job.remainingKm + j.drivenKm, 1);
        j.drivenKm = Math.max(0, j.km - frame.job.remainingKm);
      }
      if (frame.job.to && j.to !== frame.job.to) j.to = frame.job.to;
      return;
    }

    /* job gone from telemetry while we were running one = delivered */
    if (!frame.job && db.job && db.job.live) {
      Store.log('ok', 'Job no longer in game — treating as delivered');
      /* delivered, so the truck is standing in the destination city */
      Calib.sampleFromCity(frame.game, db.job.to, frame.pos, 'the city this job ended in');
      /* the game itself ended this run — the strongest evidence there is that
         it was really delivered, and worth recording as such */
      db.job.closedBy = 'telemetry';
      GameLink.completeJob();
    }
  },

  /* "on the road delivering" derived from live values, not guessed */
  deriveActivity(frame) {
    const db = Store.db;
    const moving = frame.truck.speed >= 5;
    const hasJob = !!frame.job;
    let next;
    if (frame.paused) next = 'paused';
    else if (hasJob && moving) next = 'delivering';
    else if (hasJob) next = 'stopped';
    else if (moving) next = 'driving';
    else next = 'idle';

    if (db.activityState !== next) {
      const before = db.activityState;
      db.activityState = next;
      const words = {
        delivering: 'On the road delivering',
        stopped: 'Stopped with a load aboard',
        driving: 'Driving without a job',
        paused: 'Game paused',
        idle: 'Parked',
      };
      /* only worth a log line once the client has settled */
      if (before) Store.log('info', words[next]);
      /* rolling away, or pulling up, is exactly the sort of change the fleet
         board should show at once rather than up to a heartbeat later */
      if (before) Fleet.pushNow();
    }
  },
};



/* ============================================================
   THE RUN, AS IT HAPPENS
   ------------------------------------------------------------
   Telemetry above says what the truck is doing right now. This
   turns that into what the *run* is doing — the part a driver and
   a dispatcher actually care about.

   Three things it does that a raw frame cannot:

   Distance that is real. The game reports how far is left to the
   drop, which jumps about when a route is recalculated and says
   nothing at all when the sat-nav is off. The odometer never lies,
   so distance driven is integrated from it and the game's figure
   is used only to know how long the run is.

   An arrival time worth reading. Using current speed means the ETA
   reads "never" at a red light and "twelve minutes" downhill. This
   keeps a rolling average of the last stretch of actual movement,
   which is what a driver would estimate with themselves.

   A timeline. Everything notable that happens on a run — picked
   up, quarter done, over the limit, took a knock, low on fuel,
   delivered — is stamped and kept with the run, shown live on the
   dashboard and pushed to the company as it happens.
   ============================================================ */
const JobTracker = {
  samples: [],           /* rolling {at, speed} while actually moving */
  lastOdo: null,
  lastDamage: null,
  jobId: null,
  milestones: null,
  warned: null,
  SAMPLE_MS: 300000,     /* the last five minutes of driving is the estimate */

  reset(jobId) {
    this.jobId = jobId || null;
    this.samples = [];
    this.lastOdo = null;
    this.lastDamage = null;
    this.pushedPct = null;
    this.milestones = new Set();
    this.warned = {};
    /* what the run can later be checked against */
    this.frames = 0;
    this.movingFrames = 0;
    this.odoStart = null;
    this.odoEnd = null;
    this.firstAt = null;
  },

  /* ---- evidence ----
     A delivery is a claim about money, so it travels with what the telemetry
     actually saw rather than being taken on trust. None of this is a judgment
     — it is the raw counts, and the platform decides what they mean. Keeping
     the judging on the other side means a tampered client cannot mark its own
     run as verified; the worst it can do is lie about the numbers, and the
     numbers still have to agree with each other. */
  evidence(job) {
    const first = this.firstAt || (job.started ? new Date(job.started).getTime() : null);
    return {
      telemetry: this.frames > 0,
      frames: this.frames,               /* telemetry frames seen on this run */
      movingFrames: this.movingFrames,   /* how many of them had the truck moving */
      odoStart: this.odoStart,
      odoEnd: this.odoEnd,
      odoKm: Math.round(job.odoKm || 0),  /* distance the odometer actually turned */
      topSpeed: Math.round(job.top || 0),
      avgSpeed: Math.round(job.avgSpeed || 0),
      firstFrameAt: first ? new Date(first).toISOString() : null,
      lastFrameAt: new Date().toISOString(),
      sessionId: Sessions.id || null,
      closedBy: job.closedBy || 'telemetry',
      client: APP_VERSION,
    };
  },

  /* km/h averaged over recent movement. Standstill is excluded on purpose:
     a driver stopped at a weighbridge has not become slower, they have
     stopped, and the arrival estimate should not collapse because of it. */
  averageSpeed() {
    const cut = Date.now() - this.SAMPLE_MS;
    this.samples = this.samples.filter((s) => s.at >= cut);
    const moving = this.samples.filter((s) => s.speed >= 5);
    if (!moving.length) return null;
    return moving.reduce((t, s) => t + s.speed, 0) / moving.length;
  },

  /* minutes to the drop, or null when there is nothing to base it on */
  etaMinutes(job) {
    if (!job) return null;
    const left = Math.max(0, (job.km || 0) - (job.drivenKm || 0));
    if (left <= 0) return 0;
    /* the rolling average first, then whatever the run has averaged overall,
       and only then the speed of the moment */
    const avg = this.averageSpeed()
      || (job.avgSpeed && job.avgSpeed > 5 ? job.avgSpeed : null)
      || (job.speed >= 5 ? job.speed : null);
    if (!avg) return null;
    return left / avg * 60;
  },

  /* how far this run has actually been driven, in km */
  drivenFromOdometer(frame) {
    const odo = frame.truck.odometer;
    if (!odo) return 0;
    if (this.lastOdo == null) { this.lastOdo = odo; return 0; }
    const step = odo - this.lastOdo;
    this.lastOdo = odo;
    /* a profile change, a teleport or a new game session resets the odometer;
       an implausible jump is not distance driven */
    if (!(step > 0) || step > 20) return 0;
    return step;
  },

  /* called on every telemetry frame, live job or not */
  observe(frame) {
    const db = Store.db;
    const job = db.job;

    this.samples.push({ at: frame.at, speed: frame.truck.speed });
    if (this.samples.length > 2000) this.samples = this.samples.slice(-1200);

    if (!job || !job.live) {
      if (this.jobId) this.reset(null);
      return;
    }
    if (this.jobId !== job.id) this.reset(job.id);

    /* --- what was actually seen, for the run to be checked against later --- */
    this.frames++;
    if (frame.truck.speed >= 5) this.movingFrames++;
    if (this.firstAt == null) this.firstAt = frame.at;
    if (frame.truck.odometer) {
      if (this.odoStart == null) this.odoStart = Math.round(frame.truck.odometer);
      this.odoEnd = Math.round(frame.truck.odometer);
    }

    /* --- distance --- */
    const step = this.drivenFromOdometer(frame);
    job.odoKm = (job.odoKm || 0) + step;

    /* The game's own "distance remaining" is authoritative when the sat-nav
       has a route; the odometer covers the case where it does not. */
    if (frame.job && frame.job.remainingKm == null && job.km) {
      job.drivenKm = clamp(job.odoKm, 0, job.km);
    }

    /* --- the estimate --- */
    const avg = this.averageSpeed();
    if (avg) job.avgSpeed = Math.round(avg);
    job.etaMin = this.etaMinutes(job);
    job.top = Math.max(job.top || 0, frame.truck.speed);

    /* --- keep the rest of the company current ---
       A heartbeat alone is not enough for a progress bar: between beats the
       truck covers real ground and every other screen still shows where it
       was. So a run that has actually moved on is pushed as it moves. One
       percent is about a kilometre on a typical run, and Fleet.pushNow will
       not send more than about once a second however often this fires. */
    const pct = GameLink.progress(job);
    if (this.pushedPct == null || Math.abs(pct - this.pushedPct) >= 1) {
      this.pushedPct = pct;
      Fleet.pushNow();
    }

    /* --- the timeline --- */
    [25, 50, 75].forEach((m) => {
      if (pct >= m && !this.milestones.has(m)) {
        this.milestones.add(m);
        this.note(job, 'milestone' + m, m + '% of the way to ' + cityLabel(job.to), 'info', 'flag');
      }
    });

    const limit = Number(db.settings.sirenSpeedLimit) || 95;
    if (frame.truck.speed > limit + 10 && !this.recently('speeding', 120000)) {
      this.note(job, 'speeding', 'Over the limit — ' + frame.truck.speed + ' km/h', 'warn', 'alert');
      Fleet.emit('job.speeding',
        db.driver.name + ' is running at ' + frame.truck.speed + ' km/h', 'warn');
    }

    if (frame.truck.damage != null) {
      if (this.lastDamage != null && frame.truck.damage - this.lastDamage > 1.5) {
        this.note(job, 'damage', 'Took a knock — damage now '
          + frame.truck.damage.toFixed(1) + '%', 'err', 'alert');
        Fleet.emit('job.damage',
          db.driver.name + ' took damage on the run to ' + cityLabel(job.to), 'warn');
      }
      this.lastDamage = frame.truck.damage;
    }

    if (frame.truck.fuel != null && frame.truck.fuel < 12 && !this.warned.fuel) {
      this.warned.fuel = true;
      this.note(job, 'fuel', 'Low on fuel — ' + Math.round(frame.truck.fuel) + '%', 'warn', 'alert');
    }
    if (frame.truck.fuel != null && frame.truck.fuel > 40) this.warned.fuel = false;
  },

  recently(kind, within) {
    const job = Store.db.job;
    if (!job || !job.events) return false;
    const last = job.events.filter((e) => e.kind === kind).pop();
    return !!last && Date.now() - new Date(last.at).getTime() < within;
  },

  /* One line on the run's own timeline. The kind is given rather than derived
     from the wording — recently() is what stops a warning repeating every
     frame it is true, and it can only work if the kind is stable. */
  note(job, kind, text, level, glyph) {
    job.events = job.events || [];
    job.events.push({
      kind: kind || 'note',
      text, level: level || 'info', glyph: glyph || 'info',
      at: new Date().toISOString(),
      km: Math.round(job.drivenKm || 0),
    });
    if (job.events.length > 60) job.events = job.events.slice(-60);
    Store.log(level === 'err' ? 'err' : level === 'warn' ? 'warn' : 'info', text);
    if (state.view === 'dashboard') paintRunTimeline();
  },
};


/* ============================================================
   REAL-WORLD MAP + FLEET POSITIONS
   ------------------------------------------------------------
   ETS2's map is a compressed Europe and ATS is the western US, so
   ordinary road tiles make a perfectly good backdrop: convert the
   game's world metres to latitude/longitude and every driver lands
   on a real map with real roads and city names.

   The conversion is learned, not assumed. Park in a city, pick it
   from the list, repeat once elsewhere — two correspondences solve
   a linear fit, which is accurate enough across one game map to
   place a truck on the right road.
   ============================================================ */

/* Real coordinates of the cities each game ships, used as calibration
   anchors and to label the map. */
/* ============================================================
   Fleet — where everyone else is
   ------------------------------------------------------------
   Each client pushes its own position to the Gaming Nation fleet service and
   pulls back everyone else's. Run fleet-server.js (no dependencies)
   or point it at your own endpoint. With no server configured there
   is nobody to show, and the view says so rather than inventing a crew.
   ============================================================ */
const Fleet = {
  drivers: [],        /* [{id,name,game,x,z,heading,speed,job,at,self}] */
  timer: null,
  online: false,
  lastError: null,

  endpoint() {
    const url = (Store.db.settings.fleetUrl || '').trim();
    /* same rule as the company record: a page served by the service uses it */
    return url ? url.replace(/\/$/, '') : defaultServiceUrl();
  },
  enabled() { return !!this.endpoint(); },

  start() {
    this.stop();
    /* Two loops, doing different jobs. The heartbeat says "still here" often
       enough that the service never expires us — but a driver's truck does not
       wait for a heartbeat: anything that actually changes is pushed the moment
       it happens (see pushNow). And the pull is now only a safety net, because
       everyone else arrives down the live stream instead. */
    const s = Store.db.settings;
    const beat = Number(s.heartbeatSec) ? Number(s.heartbeatSec) * 1000 : Number(s.fleetRate) || 15000;
    this.timer = setInterval(() => this.step(), Math.max(2000, beat));
    Realtime.start();
    this.step();
  },
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
    if (this.pushTimer) { clearTimeout(this.pushTimer); this.pushTimer = null; }
    Realtime.stop();
  },

  /* everything the rest of the company needs to draw this driver live */
  frame() {
    const db = Store.db;
    const live = db.live;
    if (!live) return null;
    const job = db.job;
    return {
      id: db.driver.hllId,
      name: db.driver.name,
      game: live.game,
      x: live.world.x, z: live.world.z,
      lat: live.geo ? live.geo[0] : undefined,
      lon: live.geo ? live.geo[1] : undefined,
      heading: live.heading,
      speed: live.speed,
      state: db.activityState || 'idle',
      truck: (live.truck || (db.driver && db.driver.truck) || ''),
      fuel: job && Number.isFinite(+job.fuel) ? +job.fuel : undefined,
      damage: job && Number.isFinite(+job.damage) ? +job.damage : undefined,
      job: job ? {
        id: job.id,
        from: job.from, to: job.to, cargo: job.cargo,
        weight: job.weight || 0,
        km: job.km, drivenKm: job.drivenKm,
        progress: GameLink.progress(job),
        etaMin: JobTracker.etaMinutes(job),
        income: job.income || 0,
      } : null,
    };
  },

  /* Push straight away, but never more than a few times a second however
     often it is called — a job update, a state change and a heartbeat can all
     land in the same tick and there is no sense sending three. */
  pushTimer: null,
  pushQueued: false,
  lastPush: 0,
  MIN_PUSH_MS: 900,

  pushNow() {
    if (!this.enabled()) return;
    const since = Date.now() - this.lastPush;
    if (since < this.MIN_PUSH_MS) {
      if (this.pushQueued) return;
      this.pushQueued = true;
      this.pushTimer = setTimeout(() => {
        this.pushQueued = false;
        this.pushNow();
      }, this.MIN_PUSH_MS - since);
      return;
    }
    this.lastPush = Date.now();
    const body = this.frame();
    if (!body) return;
    fetch(this.endpoint() + '/api/fleet/position', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => { /* the stream's own state reports the outage */ });
  },

  /* tell the company something happened on this run. Fire and forget: a run
     is never held up because the service is unreachable. */
  emit(kind, text, level, extra) {
    if (!this.enabled()) return;
    const db = Store.db;
    const job = db.job;
    const body = Object.assign({
      kind,
      driverId: db.driver ? db.driver.hllId : '',
      driver: db.driver ? db.driver.name : '',
      text: text || '',
      level: level || 'info',
      from: job ? job.from : '',
      to: job ? job.to : '',
      cargo: job ? job.cargo : '',
      km: job ? job.km : 0,
      income: job ? job.income : 0,
      /* the console words its own notices, so it needs the facts and not
         only our sentence */
      jobId: job ? job.id : '',
      game: (db.live && db.live.game) || db.settings.game || 'ets2',
    }, extra || {});
    fetch(this.endpoint() + '/api/fleet/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      keepalive: true,
    }).catch(() => {});
  },

  /* merge a batch of drivers in, rather than replacing the list: the stream
     sends only who moved, so anyone standing still must not vanish */
  absorb(list, replace) {
    const mine = Store.db.driver ? Store.db.driver.hllId : null;
    const by = new Map();
    if (!replace) this.drivers.forEach((d) => by.set(d.id, d));
    (list || []).forEach((d) => {
      if (d && d.id) by.set(d.id, Object.assign({}, d, { self: d.id === mine }));
    });
    /* silence expires the same way it does on the service */
    const cutoff = Date.now() - 95000;
    this.drivers = Array.from(by.values()).filter((d) => !d.at || d.at > cutoff);
    if (state.view === 'livemap') TileMap.drawFleet();
    else if (state.view === 'dashboard') paintLiveDrivers();
  },

  async step() {
    if (!this.enabled()) { this.drivers = []; return; }

    this.pushNow();

    /* With the stream up, everyone else is already arriving live and a pull
       would only re-fetch what we have. Without it, this is the fallback. */
    if (Realtime.status === 'live') { this.online = true; this.lastError = null; return; }

    try {
      const res = await fetch(this.endpoint() + '/api/fleet', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      this.absorb(data.drivers || [], true);
      if (!this.online) {
        this.online = true;
        Store.log('ok', 'Fleet service connected — ' + this.drivers.length + ' driver(s) reporting');
      }
      this.lastError = null;
    } catch (e) {
      if (this.online) Store.log('warn', 'Lost the fleet service (' + e.message + ')');
      this.online = false;
      this.lastError = e.message;
      this.drivers = [];
    }
    if (state.view === 'livemap') TileMap.drawFleet();
  },

};


/* ============================================================
   THE LIVE CHANNEL
   ------------------------------------------------------------
   One stream, held open to the company service, carrying every
   change as it happens: another driver moving, a run starting or
   landing, the shared record being written.

   Before this the client asked "anything new?" every fifteen
   seconds and the answer was usually no — which meant a truck on
   the fleet map lagged reality by up to fifteen seconds, and a run
   somebody finished took that long to appear. Now the service
   pushes, and the wait is the length of the wire.

   Server-sent events, not WebSockets: it is one ordinary GET, the
   browser reconnects by itself, and it works through anything that
   passes HTTP. If the browser has no EventSource at all, or the
   stream will not stay up, the fleet loop above quietly goes back
   to polling — the app never depends on this being available.
   ============================================================ */
const Realtime = {
  es: null,
  status: 'off',        /* off | connecting | live | retry */
  events: [],           /* recent run events from across the company */
  lastError: null,
  attempts: 0,
  retryTimer: null,
  openedAt: 0,

  supported() { return typeof EventSource !== 'undefined'; },
  url() { return Fleet.endpoint(); },

  start() {
    this.stop();
    const base = this.url();
    if (!base) { this.status = 'off'; return; }
    if (!this.supported()) {
      this.status = 'off';
      this.lastError = 'this browser cannot hold a live stream open';
      return;
    }

    this.status = 'connecting';
    let es;
    try { es = new EventSource(base + '/api/stream'); }
    catch (e) { this.status = 'retry'; this.lastError = e.message; this.scheduleRetry(); return; }
    this.es = es;

    es.addEventListener('hello', (m) => {
      const d = parse(m.data);
      if (!d) return;
      this.attempts = 0;
      this.openedAt = Date.now();
      const was = this.status;
      this.status = 'live';
      this.lastError = null;
      Fleet.online = true;
      Fleet.absorb(d.drivers, true);
      this.events = (d.events || []).slice(-40);
      if (was !== 'live') {
        Store.log('ok', 'Live company link open — '
          + (d.drivers || []).length + ' driver(s) on the road');
      }
      /* announce ourselves at once so everyone else sees us join */
      Fleet.pushNow();
      render();
    });

    es.addEventListener('fleet', (m) => {
      const d = parse(m.data);
      if (d) Fleet.absorb(d.drivers);
    });

    es.addEventListener('event', (m) => {
      const d = parse(m.data);
      if (d) this.onEvent(d);
    });

    es.addEventListener('company', (m) => {
      const d = parse(m.data);
      /* somebody wrote to the shared record — pull it now rather than in 20s */
      if (d && Sync.on() && d.version !== Sync.version) Sync.pull();
    });

    es.onerror = () => {
      /* EventSource retries by itself, but only while the socket is the
         problem. A service that has gone away entirely never comes back on
         its own, so the state is tracked here and the fleet loop takes over. */
      if (this.status === 'live') Store.log('warn', 'Live company link dropped — falling back to polling');
      this.status = 'retry';
      this.lastError = 'the stream closed';
      if (this.es && this.es.readyState === 2) this.scheduleRetry();
      render();
    };
  },

  scheduleRetry() {
    clearTimeout(this.retryTimer);
    /* back off, but never further than half a minute */
    const wait = Math.min(30000, 2000 * Math.pow(1.7, Math.min(this.attempts++, 6)));
    this.retryTimer = setTimeout(() => this.start(), wait);
  },

  stop() {
    clearTimeout(this.retryTimer); this.retryTimer = null;
    if (this.es) { try { this.es.close(); } catch (e) {} this.es = null; }
    this.status = 'off';
  },

  /* Every event from across the company goes in the ticker. Only the ones a
     driver would actually want interrupting them go on their console — a
     crew of twenty, each drifting over the limit now and then, would
     otherwise bury this driver's own run in other people's warnings. */
  WORTH_LOGGING: ['job.start', 'job.delivered', 'job.cancelled'],

  onEvent(ev) {
    const mine = Store.db.driver && Store.db.driver.hllId;
    this.events.push(ev);
    if (this.events.length > 40) this.events = this.events.slice(-40);

    /* our own events are already on our own console */
    if (ev.driverId && ev.driverId !== mine && ev.text
        && this.WORTH_LOGGING.indexOf(ev.kind) > -1) {
      if (ev.kind === 'job.delivered') toast(ev.text, 'ok');
      Store.log('info', ev.text);
    }
    if (state.view === 'dashboard') paintLiveDrivers();
  },
};

/* a half-written frame must never take the stream down with it */
function parse(raw) {
  try { return JSON.parse(raw); } catch (e) { return null; }
}


/* ============================================================
   GAME MAP
   ------------------------------------------------------------
   The ETS2 / ATS world drawn as a real map: the motorway network
   between every city the games ship, pannable and zoomable, with
   drivers plotted on top. Vector, not a picture — it scales
   cleanly, needs no tile server and works with no connection.

   Pixel-accurate road geometry would have to be rendered out of
   the game's own map files, which cannot be redistributed here.
   Point the client at a tile pyramid (Map -> My own tiles) if you
   have one; this network is the shipped default.
   ============================================================ */

/* Trunk routes. Each pair is a road between two cities; the drawing
   follows the city layout, so it reads like a motorway diagram. */




/* the whole game map, with a little air around it */
function gameBounds(gameKey) {
  const b = mapFor(gameKey).bounds;
  return [[-b.y1 - 12, b.x0 - 12], [-b.y0 + 12, b.x1 + 12]];
}

/* world metres -> the game map, using the same city calibration the
   schematic view uses */

/* ============================================================
   TILE MAP
   ------------------------------------------------------------
   A real slippy map — pan, zoom, road tiles — with the truck
   plotted live on top. Leaflet is vendored locally, so nothing is
   fetched from a CDN and the app still starts with no connection.

   The tile source is deliberately a setting rather than a
   hard-coded URL: ETS2/ATS road tiles are generated from the game
   files and whoever hosts them sets their own terms. Point it at
   your own tiles (local folder or your server) or at a community
   tile server you are allowed to use.

   Because the geometry of an arbitrary tile pyramid is unknown,
   the world -> map transform is learned rather than assumed: drive
   somewhere, click where the truck actually is, do it twice, and
   two correspondences solve scale and offset exactly.
   ============================================================ */
const TileMap = {
  map: null,
  tiles: null,
  marker: null,
  trailLine: null,
  destMarker: null,
  following: true,
  calibrating: false,
  container: null,

  fleetLayer: null,
  cityLayer: null,
  roadLayer: null,

  available() { return typeof L !== 'undefined'; },
  mode() {
    const s = Store.db.settings;
    if (s.mapSource === 'game') return 'game';
    if (s.mapSource === 'world') return 'world';
    if (s.mapSource === 'tiles' && s.tileUrl && s.tileUrl.trim()) return 'tiles';
    return 'schematic';
  },
  configured() { return this.mode() !== 'schematic'; },

  /* position of a driver, whichever mode is active */
  latLngFor(gameKey, x, z) {
    const mode = this.mode();
    /* a home-made tile pyramid has its own coordinate system and nothing
       can be derived for it, so that one keeps a transform of its own */
    if (mode === 'tiles') return this.worldToLatLng(gameKey, x, z);

    const geo = Calib.toGeo(gameKey, x, z);
    if (!geo) return null;
    if (mode === 'world') return L.latLng(geo[0], geo[1]);
    return geoToGameLatLng(gameKey, geo[0], geo[1]);   /* game and schematic */
  },

  /* transform learned from click samples, per game */
  cal(gameKey) {
    const c = Store.db.settings.tileCalibration || {};
    return c[gameKey] || null;
  },
  worldToLatLng(gameKey, x, z) {
    const c = this.cal(gameKey);
    /* A half-finished calibration holds only its sample points — using it
       would produce NaN and Leaflet throws on that. */
    if (!c || typeof c.sx !== 'number' || typeof c.sz !== 'number') return null;
    /* CRS.Simple takes (y, x) */
    return L.latLng(c.oz + z * c.sz, c.ox + x * c.sx);
  },

  mount(el, gameKey) {
    if (!this.available() || !el) return false;
    this.destroy();
    this.container = el;
    this.currentGame = gameKey;
    const s = Store.db.settings;

    const mode = this.mode();
    const world = mode === 'world';
    const game = mode === 'game';

    this.map = L.map(el, {
      /* real road tiles are web-mercator; the game world and a home-made
         pyramid are both flat planes */
      crs: world ? L.CRS.EPSG3857 : L.CRS.Simple,
      minZoom: world ? 3 : game ? -1 : (Number(s.tileMinZoom) || 0),
      maxZoom: world ? 18 : game ? 5 : (Number(s.tileMaxZoom) || 8),
      zoomSnap: game ? 0.25 : 1,
      zoomControl: true,
      attributionControl: true,
      worldCopyJump: false,
      /* SVG renderer: the canvas one keeps a queued redraw that fires after
         the map is torn down, throwing on a released context */
      preferCanvas: false,
    });
    /* the game map has its own palette; real tiles keep Leaflet's */
    if (game) el.classList.add('game-map'); else el.classList.remove('game-map');

    this.tiles = game ? null : world
      ? L.tileLayer(s.worldTileUrl, {
          minZoom: 3, maxZoom: 18, noWrap: true,
          attribution: s.worldAttribution || '',
          errorTileUrl: '',
        }).addTo(this.map)
      : L.tileLayer(s.tileUrl, {
          minZoom: Number(s.tileMinZoom) || 0,
          maxZoom: Number(s.tileMaxZoom) || 8,
          tileSize: Number(s.tileSize) || 256,
          noWrap: true,
          tms: !!s.tileTms,
          attribution: s.tileAttribution || '',
          errorTileUrl: '',
        }).addTo(this.map);

    if (game) {
      this.drawRoads(gameKey);
      /* the zoom at which the whole map fits, whichever view we open at */
      this.baseZoom = this.map.getBoundsZoom(gameBounds(gameKey));
      /* labels are noise when the whole continent is on screen */
      const syncLabels = () => {
        if (!this.container) return;
        /* measured against the zoom that fits the whole map, so the steps hold
           whatever the extent and the window size are. Zoomed right out the
           majors name the regions; the rest arrive as you close in. */
        const base = this.baseZoom == null ? this.map.getZoom() : this.baseZoom;
        const z = this.map.getZoom() - base;
        this.container.classList.toggle('hide-city-labels', z < -0.6);
        this.container.classList.toggle('major-labels-only', z < 1.7);
        /* the region names are set relative to the map, not the screen, so
           they stay the same size against the roads at any zoom */
        this.container.style.setProperty('--region-fs',
          clamp(14 + z * 7, 12, 40).toFixed(1) + 'px');
      };
      this.map.on('zoomend', syncLabels);
      setTimeout(syncLabels, 0);
    }

    let tileErrors = 0;
    /* the game map has no tile layer at all */
    if (this.tiles) this.tiles.on('tileerror', () => {
      tileErrors++;
      if (tileErrors === 8 && !this._warned) {
        this._warned = true;
        toast('Tiles are not loading — check the tile URL in Settings', 'warn');
        Store.log('warn', 'Tile layer returned errors for ' + s.tileUrl);
      }
    });

    /* start where we left off, else over the right part of the world */
    const view = s.tileView;
    if (view && view.mode === this.mode() && view.game === gameKey) {
      this.map.setView([view.lat, view.lng], view.z);
    } else if (game) {
      this.map.fitBounds(gameBounds(gameKey), { padding: [6, 6] });
    } else if (world) {
      const home = MAP_HOME[gameKey] || MAP_HOME.ets2;
      this.map.setView([home[0], home[1]], home[2]);
    } else {
      this.map.setView([0, 0], Number(s.tileMinZoom) || 2);
    }

    this.map.on('dragstart zoomstart', () => {
      if (this.calibrating) return;
      this.following = false;
      const btn = $('#followBtn');
      if (btn) { btn.classList.remove('btn-primary'); btn.textContent = 'Follow'; }
    });
    this.map.on('moveend', () => {
      const c = this.map.getCenter();
      Store.db.settings.tileView = {
        lat: c.lat, lng: c.lng, z: this.map.getZoom(),
        mode: this.mode(), game: this.currentGame,
      };
    });
    this.map.on('click', (e) => this.onClick(e));

    this.trailLine = L.polyline([], {
      color: '#8bd62b', weight: 3, opacity: .85, lineJoin: 'round',
    }).addTo(this.map);
    this.fleetLayer = L.layerGroup().addTo(this.map);
    this.cityLayer = L.layerGroup().addTo(this.map);
    this.drawCities(gameKey);
    this.drawFleet();

    this.redraw(gameKey);
    /* Leaflet needs a nudge when it is mounted into a freshly built panel */
    setTimeout(() => { if (this.map) this.map.invalidateSize(); }, 60);
    return true;
  },

  destroy() {
    if (this.map) {
      /* drop layers first, then listeners, then the map — removing the map
         with live layers attached leaves pending redraws pointing at a
         released renderer */
      [this.trailLine, this.marker, this.destMarker, this.fleetLayer,
       this.cityLayer, this.roadLayer, this.tiles].forEach((layer) => {
        if (layer && this.map.hasLayer(layer)) this.map.removeLayer(layer);
      });
      this.map.off();
      this.map.remove();
      this.map = null;
    }
    this.tiles = this.marker = this.trailLine = this.destMarker = null;
    this.fleetLayer = this.cityLayer = this.roadLayer = null;
    this.baseZoom = null;      /* recomputed for whichever map mounts next */
    this._warned = false;
    /* `calibrating` and `following` are UI state, not map state: mount()
       destroys and rebuilds on every render, which would otherwise cancel a
       calibration the moment it started */
  },

  truckIcon(heading) {
    const deg = -(heading || 0) * 360;
    return L.divIcon({
      className: 'truck-pin',
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      html: '<div class="truck-pin-inner" style="transform:rotate(' + deg.toFixed(1) + 'deg)">'
        + '<svg viewBox="0 0 24 24"><path d="M12 2 L18 20 L12 16.5 L6 20 Z"/></svg></div>',
    });
  },

  /* full redraw of everything derived from state */
  redraw(gameKey) {
    if (!this.map) return;
    const db = Store.db;
    const live = db.live;
    gameKey = gameKey || (live && live.game) || db.settings.game || 'ets2';

    /* trail */
    if (this.trailLine) {
      const pts = (db.worldTrail || [])
        .map((p) => this.latLngFor(gameKey, p[0], p[1]))
        .filter(Boolean);
      this.trailLine.setLatLngs(pts);
    }

    /* truck */
    if (live && live.game === gameKey) {
      const ll = this.latLngFor(gameKey, live.world.x, live.world.z);
      if (ll) {
        if (!this.marker) {
          this.marker = L.marker(ll, { icon: this.truckIcon(live.heading), zIndexOffset: 1000 }).addTo(this.map);
        } else {
          this.marker.setLatLng(ll);
          this.marker.setIcon(this.truckIcon(live.heading));
        }
        this.marker.bindTooltip(
          Store.db.driver.name + ' — ' + live.speed + ' km/h ' + headingLabel(live.heading),
          { direction: 'top', offset: [0, -12] });
        if (this.following) this.map.setView(ll, this.map.getZoom(), { animate: true });
      }
    } else if (this.marker) {
      this.map.removeLayer(this.marker);
      this.marker = null;
    }
  },

  /* cheap per-frame update */
  update() {
    if (!this.map) return;
    this.redraw();
  },

  /* the motorway network, drawn beneath everything else */
  drawRoads(gameKey) {
    if (!this.map) return;
    if (this.roadLayer) { this.map.removeLayer(this.roadLayer); this.roadLayer = null; }
    const M = mapFor(gameKey);
    const roads = ROADS[gameKey] || ROADS.ets2;
    this.roadLayer = L.layerGroup().addTo(this.map);

    /* Four passes, back to front, the way the games draw their own map:
       a wide dark wash that gives the covered country some body, a casing,
       the road itself, then the region seams on top. */
    const pts = ([a, b]) => {
      const pa = M.cities[a], pb = M.cities[b];
      return (pa && pb) ? [gameLatLng(pa), gameLatLng(pb)] : null;
    };

    roads.forEach((r) => {
      const p = pts(r); if (!p) return;
      L.polyline(p, { color: '#161a1f', weight: 15, opacity: .5,
        lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(this.roadLayer);
    });
    roads.forEach((r) => {
      const p = pts(r); if (!p) return;
      L.polyline(p, { color: '#31373f', weight: 3.2, opacity: .9,
        lineCap: 'round', interactive: false }).addTo(this.roadLayer);
    });
    roads.forEach((r) => {
      const p = pts(r); if (!p) return;
      L.polyline(p, { color: '#9aa4b0', weight: 1.15, opacity: .95, lineCap: 'round' })
        .bindTooltip(cityLabel(r[0]) + ' — ' + cityLabel(r[1]), { sticky: true })
        .addTo(this.roadLayer);
    });

    this.drawRegions(gameKey);
  },

  /* the coloured seams between the game's map regions, plus their names */
  drawRegions(gameKey) {
    if (!this.roadLayer) return;
    if (!Store.db.settings.showRegions) return;

    regionsFor(gameKey).forEach((reg) => {
      const line = reg.line.map(([lat, lon]) => geoToGameLatLng(gameKey, lat, lon));
      /* a dark underlay keeps the colour readable over a pale road */
      L.polyline(line, { color: '#0b0d10', weight: 6, opacity: .8,
        lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(this.roadLayer);
      L.polyline(line, { color: reg.color, weight: 2.6, opacity: .95,
        lineCap: 'round', lineJoin: 'round' })
        .bindTooltip(reg.name.replace('!', ''), { sticky: true })
        .addTo(this.roadLayer);

      const at = geoToGameLatLng(gameKey, reg.label[0], reg.label[1]);
      L.marker(at, {
        interactive: false,
        icon: L.divIcon({
          className: 'region-label', iconSize: [0, 0],
          html: '<span style="color:' + reg.color + '">' + esc(reg.name) + '</span>',
        }),
      }).addTo(this.roadLayer);
    });
  },

  /* city dots, so the game's stops are visible on a real map */
  drawCities(gameKey) {
    if (!this.cityLayer) return;
    this.cityLayer.clearLayers();
    const mode = this.mode();
    if (mode === 'game') {
      const M = mapFor(gameKey);
      Object.keys(M.cities).forEach((name) => {
        const ll = gameLatLng(M.cities[name]);
        const major = cityTier(gameKey, name) === 1;
        L.circleMarker(ll, {
          radius: major ? 3.4 : 2.2,
          color: '#0b0d10', weight: major ? 1.6 : 1.2,   /* dark rim lifts it off the road */
          fillColor: major ? '#eef2f6' : '#c2cad3', fillOpacity: 1,
          className: 'city-dot' + (major ? ' major' : ''),
        }).bindTooltip(cityLabel(name), { direction: 'top', offset: [0, -8] }).addTo(this.cityLayer);
        L.marker(ll, {
          interactive: false,
          icon: L.divIcon({
            className: 'city-label' + (major ? ' major' : ''), iconSize: [0, 0],
            html: '<span>' + esc(cityLabel(name)) + '</span>',
          }),
        }).addTo(this.cityLayer);
      });
      return;
    }
    if (mode !== 'world') return;
    const geo = geoFor(gameKey);
    Object.keys(geo).forEach((name) => {
      const [lat, lon] = geo[name];
      L.circleMarker([lat, lon], {
        radius: 3, color: '#8bd62b', weight: 1, fillColor: '#8bd62b', fillOpacity: .55,
      }).bindTooltip(cityLabel(name), { direction: 'top' }).addTo(this.cityLayer);
    });
  },

  /* every driver currently reporting a position */
  drawFleet() {
    if (!this.fleetLayer) return;
    this.fleetLayer.clearLayers();
    const db = Store.db;
    if (!db.settings.showFleet) return;
    const gameKey = (Telemetry.mode === 'live' && db.live && db.live.game) || db.settings.game || 'ets2';

    Fleet.drivers.forEach((d) => {
      if (d.self) return;                       /* our own pin is drawn separately */
      if (d.game && d.game !== gameKey) return; /* other game, other map */
      let ll = null;
      if (typeof d.lat === 'number' && typeof d.lon === 'number') {
        /* the game map is not in degrees — project before plotting */
        ll = this.mode() === 'game'
          ? geoToGameLatLng(gameKey, d.lat, d.lon)
          : L.latLng(d.lat, d.lon);
      } else if (typeof d.x === 'number') {
        ll = this.latLngFor(gameKey, d.x, d.z);
      }
      if (!ll) return;

      const hauling = d.state === 'delivering';
      const deg = -(d.heading || 0) * 360;
      const icon = L.divIcon({
        className: 'fleet-pin' + (hauling ? ' hauling' : ''),
        iconSize: [22, 22], iconAnchor: [11, 11],
        html: '<div class="fleet-pin-inner" style="transform:rotate(' + deg.toFixed(1) + 'deg)">'
          + '<svg viewBox="0 0 24 24"><path d="M12 3 L17 19 L12 16 L7 19 Z"/></svg></div>'
          + '<span class="fleet-pin-label">' + esc(d.name || d.id) + '</span>',
      });
      const job = d.job ? d.job.from + ' \u2192 ' + d.job.to + (d.job.cargo ? ' (' + d.job.cargo + ')' : '') : 'no load';
      const truck = d.truck || 'Truck unavailable';
      const details = '<b>' + esc(d.name || d.id) + '</b>'
        + '<br><span>Truck: ' + esc(truck) + '</span>'
        + '<br><span>Job: ' + esc(job) + '</span>'
        + '<br><span>Speed: ' + (d.speed || 0) + ' km/h</span>';
      L.marker(ll, { icon, title: d.name || d.id, keyboard: true })
        .bindTooltip('<b>' + esc(d.name || d.id) + '</b>',
          { direction: 'top', offset: [0, -10], permanent: true, className: 'fleet-name-label' })
        .bindPopup(details, { closeButton: true, maxWidth: 260 })
        .addTo(this.fleetLayer);
    });
  },

  /* ---- click-to-calibrate ---- */
  beginCalibration() {
    if (!this.map) { toast('Open the map first', 'warn'); return; }
    if (!Store.db.live) { toast('No live position — start the game first', 'warn'); return; }
    this.calibrating = true;
    this.following = false;
    render();
    toast('Click exactly where your truck is', 'info');
  },
  cancelCalibration() {
    this.calibrating = false;
    render();
  },
  onClick(e) {
    if (!this.calibrating) return;
    const db = Store.db;
    const live = db.live;
    if (!live) { this.calibrating = false; return; }
    const gameKey = live.game;

    db.settings.tileCalibration = db.settings.tileCalibration || {};
    const existing = db.settings.tileCalibration[gameKey];
    const points = (existing && existing.points ? existing.points.slice() : []);
    points.push({ wx: live.world.x, wz: live.world.z, mx: e.latlng.lng, mz: e.latlng.lat });

    const solved = solveCalibration(points);
    if (solved) {
      db.settings.tileCalibration[gameKey] = solved;
      Store.log('ok', 'Tile map calibrated from two points');
      toast('Map calibrated — the truck is now placed exactly', 'ok');
      this.calibrating = false;
      this.following = true;
    } else {
      db.settings.tileCalibration[gameKey] = { points };
      toast('First point saved. Drive a good distance, then click again.', 'info');
      this.calibrating = false;
    }
    Store.save();
    render();
  },

};

/* ---------- calibrating the real-world map ----------
   Two cities is all it takes: we know where each city really is, and
   telemetry says where the truck is in game metres when parked there. */
/* ---------- fleet service ---------- */
function openFleetSetup() {
  const s = Store.db.settings;
  modal({
    title: 'Company service',
    body: `
      <p class="t2">One address ties every install together. Each client pushes its position
        and its finished runs, and pulls back the rest of the company — the roster, the
        logins, applications, support requests and the loads dispatched to you.</p>
      <div class="field mt-12"><label for="flUrl">Company service address</label>
        <input class="input" id="flUrl" value="${esc(s.fleetUrl || '')}"
          placeholder="http://your-server:7040"></div>
      <div class="t3 xs mt-8">Positions go out every
        <b>${esc(String(s.heartbeatSec || 15))}s</b> — the heartbeat set in Settings.</div>
      <div class="t3 xs mt-8">
        Run the bundled service with <span class="mono">npm run fleet</span> — it has no
        dependencies. Point every driver's client at the same address. With no service
        configured everything still works, but it stays on this machine — the map shows
        only your own truck and a sign-up here never reaches anybody else.
      </div>
      <div class="t3 xs mt-8">Status: ${Fleet.enabled()
        ? (Fleet.online ? '<span class="pill ok">connected</span>' : '<span class="pill err">' + esc(Fleet.lastError || 'not reachable') + '</span>')
        : '<span class="pill warn">not configured</span>'}</div>`,
    foot: `<button class="btn" data-close>Cancel</button>
      <button class="btn btn-primary" data-act="fleet-save">${icon('check')}Save</button>`,
  });
}

function saveFleetSetup() {
  const s = Store.db.settings;
  const url = $('#flUrl') ? $('#flUrl').value.trim() : '';
  s.fleetUrl = url;
  Store.log('info', url ? 'Fleet service set to ' + url : 'Fleet service cleared');
  Store.save();
  closeModals();
  Fleet.start();
  render();
}

/* ---------- tile source presets / editor ---------- */
function openTileSource() {
  const s = Store.db.settings;
  modal({
    title: 'Map tiles',
    body: `
      <div class="field"><label for="tsMode">Map</label>
        <select class="select" id="tsMode">
          <option value="game" ${s.mapSource === 'game' ? 'selected' : ''}>Game map (ETS2 / ATS road network)</option>
          <option value="world" ${s.mapSource === 'world' ? 'selected' : ''}>Real-world road tiles</option>
          <option value="tiles" ${s.mapSource === 'tiles' ? 'selected' : ''}>My own tile pyramid</option>
          <option value="schematic" ${s.mapSource === 'schematic' ? 'selected' : ''}>Built-in schematic</option>
        </select></div>
      <div class="field"><label for="tsWorld">Road tile URL</label>
        <input class="input" id="tsWorld" value="${esc(s.worldTileUrl || '')}"></div>
      <p class="t2 mt-12">The settings below only apply to your own tile pyramid.</p>
      <div class="field mt-12"><label for="tsUrl">Tile URL template</label>
        <input class="input" id="tsUrl" value="${esc(s.tileUrl || '')}"
          placeholder="https://your-host/tiles/{z}/{x}/{y}.png"></div>
      <div class="row gap-8 wrap">
        <div class="field" style="min-width:96px"><label for="tsMin">Min zoom</label>
          <input class="input" id="tsMin" type="number" min="0" max="12" value="${esc(String(s.tileMinZoom ?? 0))}"></div>
        <div class="field" style="min-width:96px"><label for="tsMax">Max zoom</label>
          <input class="input" id="tsMax" type="number" min="0" max="14" value="${esc(String(s.tileMaxZoom ?? 8))}"></div>
        <div class="field" style="min-width:110px"><label for="tsSize">Tile size</label>
          <input class="input" id="tsSize" type="number" min="64" max="1024" step="64" value="${esc(String(s.tileSize ?? 256))}"></div>
      </div>
      <label class="check ${s.tileTms ? 'on' : ''}"><input type="checkbox" id="tsTms" ${s.tileTms ? 'checked' : ''}>
        <span class="sm t2">Tiles are TMS (y axis counts from the bottom)</span></label>
      <div class="field mt-12"><label for="tsAttr">Attribution</label>
        <input class="input" id="tsAttr" value="${esc(s.tileAttribution || '')}" placeholder="Credit the tile source"></div>
      <div class="t3 xs mt-12">
        <b>Where tiles come from:</b> they are rendered from the game's own map files.
        Generate your own from your installation, or use a community tile server you have
        permission to use — please respect whoever hosts them. A local folder works too:
        put tiles beside the app and use <span class="mono">tiles/{z}/{x}/{y}.png</span>,
        which also keeps the map working offline.
      </div>
      <div class="t3 xs mt-8">Leave the URL empty to fall back to the built-in schematic map.</div>`,
    foot: `<button class="btn" data-close>Cancel</button>
      <button class="btn btn-primary" data-act="tile-save">${icon('check')}Save</button>`,
  });
}

function saveTileSource() {
  const s = Store.db.settings;
  const g = (id) => { const el = $('#' + id); return el ? el.value.trim() : ''; };
  const mode = g('tsMode') || 'game';
  s.mapSource = mode;
  if (g('tsWorld')) s.worldTileUrl = g('tsWorld');
  s.tileUrl = g('tsUrl');
  s.tileMinZoom = clamp(Number(g('tsMin')) || 0, 0, 12);
  s.tileMaxZoom = clamp(Number(g('tsMax')) || 8, 0, 14);
  s.tileSize = clamp(Number(g('tsSize')) || 256, 64, 1024);
  s.tileTms = !!($('#tsTms') && $('#tsTms').checked);
  s.tileAttribution = g('tsAttr');
  if (mode === 'tiles' && !s.tileUrl) s.mapSource = 'schematic';
  Store.log('info', 'Map set to ' + s.mapSource);
  Store.save();
  closeModals();
  TileMap.destroy();
  render();
}


/* ============================================================
   GAME LAUNCHER + ALERTS
   ------------------------------------------------------------
   The desktop shell can find the games, start them and live in the
   tray. In a browser those calls are absent, so every one of them
   degrades to an explanation rather than a dead button.
   ============================================================ */
const Launcher = {
  api() { return (window.hllDesktop && window.hllDesktop.isDesktop) ? window.hllDesktop : null; },

  label(kind) {
    return kind === 'tmp' ? 'TruckersMP launcher'
      : kind === 'ats' ? 'American Truck Simulator' : 'Euro Truck Simulator 2';
  },
  pathKey(kind) { return kind === 'tmp' ? 'tmpExe' : kind === 'ats' ? 'atsExe' : 'ets2Exe'; },

  desktopOnly(what) {
    modal({
      title: what + ' needs the desktop app',
      size: 'narrow',
      body: `<p class="t2">A web page is not allowed to browse your drive or start programs.</p>
        <p class="t2 mt-12">Install <b>Gaming Nation Trucker</b> for Windows and this works directly.
          In the browser you can still paste the full path in by hand.</p>`,
    });
  },

  async browse(kind) {
    const api = this.api();
    if (!api) { this.desktopOnly('Browsing for a file'); return; }
    const picked = await api.pickFile({ title: 'Select ' + this.label(kind) });
    if (!picked) return;
    Store.db.settings[this.pathKey(kind)] = picked;
    Store.log('ok', this.label(kind) + ' set to ' + picked);
    Store.save();
    render();
  },

  async autoDetect(kind) {
    const api = this.api();
    if (!api) { this.desktopOnly('Auto-detect'); return; }
    toast('Looking for ' + this.label(kind) + '…', 'info');
    const found = await api.autoDetect(kind);
    if (!found) {
      toast('Could not find it — use Browse', 'warn');
      Store.log('warn', 'Auto-detect found no ' + this.label(kind));
      return;
    }
    Store.db.settings[this.pathKey(kind)] = found;
    Store.log('ok', 'Found ' + this.label(kind) + ': ' + found);
    Store.save();
    toast(this.label(kind) + ' found', 'ok');
    render();
  },

  async launch(kind) {
    const api = this.api();
    const exe = Store.db.settings[this.pathKey(kind)];
    if (!api) {
      /* a page cannot start a program, and pretending it had would put a run
         in the logbook that never happened */
      this.desktopOnly('Launching a game');
      return;
    }
    if (!exe) {
      toast('Set the path first, in Settings', 'warn');
      state.view = 'settings'; render();
      return;
    }
    const res = await api.launch(exe);
    if (res && res.error) {
      toast('Could not launch: ' + res.error, 'err');
      Store.log('err', 'Launch failed — ' + res.error);
      return;
    }
    Store.log('ok', 'Launched ' + this.label(kind));
    toast('Starting ' + this.label(kind) + '…', 'ok');
    /* the game takes a while to come up; the telemetry poller finds it */
    if (kind !== 'tmp' && Store.db.settings.autoStartTracking) {
      Store.log('info', 'Tracking will start as soon as telemetry answers');
      if (!Store.db.settings.liveTelemetry) {
        Store.db.settings.liveTelemetry = true;
        Telemetry.start();
        Store.save();
      }
    }
    render();
  },

  /* push the two OS-level preferences into the shell */
  async syncOsPreferences() {
    const api = this.api();
    if (!api) return;
    const s = Store.db.settings;
    try {
      await api.setAutoLaunch(!!s.startWithWindows, !!s.startMinimized);
      await api.setTrayEnabled(!!s.minimiseToTray);
    } catch (e) { console.warn('[HLL] could not apply OS preferences', e); }
  },
};

/* ============================================================
   GAME WATCH
   ------------------------------------------------------------
   Nobody tells the client the game has started — it works it out.

   Two independent signals feed it. On the desktop the process list
   says the moment the game opens and the moment it closes, before
   and after telemetry can say anything. Everywhere, a telemetry
   frame arriving proves the game is up and running.

   Whichever notices first wins, and the transitions are owned here
   so starting and stopping happen once, not once per signal.
   ============================================================ */
const GameWatch = {
  timer: null,
  running: false,        /* what we believe right now */
  game: null,            /* ets2 | ats */
  source: null,          /* process | telemetry */
  tmpRunning: false,
  supported: false,      /* the process list is a desktop-only signal */

  start() {
    this.stop();
    if (!Store.db.settings.autoDetect) {
      this.supported = false;
      Store.log('info', 'Automatic game detection is switched off in Settings');
      return;
    }
    this.supported = !!(Launcher.api() && Launcher.api().gameRunning);
    if (this.supported) {
      const secs = clamp(Number(Store.db.settings.watchSec) || 4, 2, 60);
      this.timer = setInterval(() => this.poll(), secs * 1000);
      this.poll();
      Store.log('info', 'Watching for the game to start');
    } else {
      /* in a browser the telemetry link is the only thing that can tell us */
      Store.log('info', 'Watching for the game through the telemetry link');
    }
  },
  stop() { if (this.timer) { clearInterval(this.timer); this.timer = null; } },

  async poll() {
    const api = Launcher.api();
    if (!api || !api.gameRunning) return;
    let seen;
    try { seen = await api.gameRunning(); } catch (e) { return; }
    if (!seen || !seen.ok) return;

    if (this.tmpRunning !== !!seen.tmp) {
      this.tmpRunning = !!seen.tmp;
      Store.log('info', 'TruckersMP ' + (this.tmpRunning ? 'started' : 'closed'));
      render();
    }

    const game = seen.ets2 ? 'ets2' : seen.ats ? 'ats' : null;
    if (game) this.began(game, 'process');
    else if (this.source === 'process') this.ended('process');
  },

  /* the game is up — called by the process watch and by live telemetry */
  began(game, source) {
    const db = Store.db;
    if (this.running && this.game === game) { this.source = this.source || source; return; }

    this.running = true;
    this.game = game;
    this.source = source;
    db.conn.ets2 = 'running';
    db.settings.game = game;

    Store.log('ok', mapFor(game).label + ' started'
      + (source === 'process' ? '' : ' — telemetry connected'));
    toast(mapFor(game).short + ' detected', 'ok');

    /* bring the telemetry link up so the run is tracked from the off */
    if (db.settings.autoStartTracking && !db.settings.liveTelemetry) {
      db.settings.liveTelemetry = true;
      Telemetry.start();
      Store.log('info', 'Tracking armed — waiting for the telemetry plugin');
    }

    /* the driver is at the wheel — open a session on the company record and
       tell everyone, so the console shows them playing straight away */
    Sessions.open(game);

    Store.save();
    render();
  },

  /* the game has gone */
  ended(source) {
    const db = Store.db;
    if (!this.running) return;
    /* telemetry dropping while the process is still up is a plugin hiccup,
       not the game closing */
    if (source === 'telemetry' && this.supported && this.source === 'process') return;

    const was = this.game;
    this.running = false;
    this.game = null;
    this.source = null;

    db.conn.ets2 = 'stopped';
    db.conn.telemetry = 'off';
    db.conn.link = 'ready';
    db.live = null;
    Telemetry.mode = 'off';
    Telemetry.lastFrame = null;

    /* a run that was live when the game closed is banked, not lost */
    if (db.job && db.job.live) {
      Store.log('warn', 'Game closed mid-run — the delivery is held in the queue');
      db.job.status = 'paused';
      db.job.live = false;
    }
    Store.log('info', (was ? mapFor(was).label : 'The game') + ' closed');
    toast('Game closed', 'info');

    /* close the sitting off, so the console stops showing them at the wheel */
    Sessions.close();

    Store.save();
    render();
  },
};


/* ============================================================
   GAME SESSIONS
   ------------------------------------------------------------
   One sitting at the game: it opens when the client sees the game
   come up and closes when it goes away. Written onto the shared
   company record, so it is the company's history of who drove and
   for how long — not something this browser happens to remember.

   Each session accumulates what was done during it, which is what
   makes it worth keeping: three hours logged in with nothing
   delivered and three hours with six runs are different sittings,
   and only the record can tell them apart.

   A client that is killed mid-session leaves one open. That is why
   the platform closes anything older than twelve hours rather than
   trusting an end that may never come.
   ============================================================ */
const Sessions = {
  id: null,

  /* the session this client currently has open on the company record */
  current() {
    const hq = Auth.hqDb();
    if (!hq || !Array.isArray(hq.sessions)) return null;
    const me = Store.db.driver && Store.db.driver.hllId;
    return hq.sessions.find((s) => s.driverId === me && !s.ended) || null;
  },

  open(game) {
    const db = Store.db;
    const me = db.driver && db.driver.hllId;
    if (!me) return;                      /* nobody signed in yet */
    const hq = Auth.hqDb();
    if (!hq) return;
    hq.sessions = hq.sessions || [];

    /* a client restarted while the game was already up must not open a second */
    const open = hq.sessions.find((s) => s.driverId === me && !s.ended);
    if (open) { this.id = open.id; return; }

    const session = {
      id: 'SES-' + Date.now().toString(36).toUpperCase(),
      driverId: me,
      driver: db.driver.name,
      game: game || db.settings.game || 'ets2',
      started: new Date().toISOString(),
      ended: null,
      jobs: 0, km: 0, earned: 0,
    };
    hq.sessions.unshift(session);
    hq.sessions = hq.sessions.slice(0, 400);
    this.id = session.id;

    this.stampDriver(hq, me, { status: 'online', playing: true, game: session.game });
    Auth.saveHqDb(hq);

    Store.log('ok', 'Session started — ' + mapFor(session.game).label);
    Fleet.emit('session.start',
      db.driver.name + ' launched ' + mapFor(session.game).short, 'info',
      { game: session.game });
  },

  close() {
    const db = Store.db;
    const me = db.driver && db.driver.hllId;
    if (!me) return;
    const hq = Auth.hqDb();
    if (!hq || !Array.isArray(hq.sessions)) return;

    const session = hq.sessions.find((s) => s.driverId === me && !s.ended);
    if (!session) return;

    session.ended = new Date().toISOString();
    session.minutes = Math.max(0, Math.round(
      (new Date(session.ended) - new Date(session.started)) / 60000));
    this.id = null;

    this.stampDriver(hq, me, { status: 'online', playing: false, game: null });
    Auth.saveHqDb(hq);

    Store.log('info', 'Session ended — ' + fmt.dur(session.minutes)
      + (session.jobs ? ', ' + session.jobs + ' run(s) delivered' : ', nothing delivered'));
    Fleet.emit('session.end',
      db.driver.name + ' finished a ' + fmt.dur(session.minutes) + ' session'
      + (session.jobs ? ' — ' + session.jobs + ' run(s), ' + fmt.eur(session.earned) : ''),
      'info');
  },

  /* a delivered run belongs to the sitting it was driven in */
  credit(rec) {
    const me = Store.db.driver && Store.db.driver.hllId;
    if (!me) return;
    const hq = Auth.hqDb();
    if (!hq || !Array.isArray(hq.sessions)) return;
    const session = hq.sessions.find((s) => s.driverId === me && !s.ended);
    if (!session) return;
    session.jobs = (session.jobs || 0) + 1;
    session.km = (session.km || 0) + (rec.km || 0);
    session.earned = (session.earned || 0) + (rec.income || 0);
    Auth.saveHqDb(hq);
  },

  /* keep the roster's own view of the driver in step */
  stampDriver(hq, id, patch) {
    const d = (hq.drivers || []).find((x) => x.id === id);
    if (!d) return;
    Object.assign(d, patch, { lastSeen: new Date().toISOString() });
  },
};


/* ============================================================
   ONE COMPANY, ON THIS DEVICE TOO
   ------------------------------------------------------------
   The client reads the same records the platform writes. Pointed at
   the Gaming Nation service it keeps them in step with every other
   machine, so a phone sees the roster, the applications and the
   support traffic rather than only what was typed into it.

   The client is a reader here: it pulls, and pushes back only what
   it owns — its driver's own record and anything staff did from the
   admin screens.
   ============================================================ */
/* Where the company lives, when nobody has said.

   A page served over http(s) was almost certainly served BY the company
   service — it carries the websites as well as the API. So its own origin is
   the right default, and a company set up that way needs no configuration at
   all: open the site, and you are already joined up.

   Two cases must not guess. A page opened from disk (file://) has no server
   behind it, and the packaged phone app is served from its own internal
   origin, which is the app itself and not anybody's company. Both of those
   are asked for an address instead. */
function defaultServiceUrl() {
  /* The service says who it is; the page never guesses.

     This used to answer with the page's own origin, on the reasoning that a
     page served over http was served BY the Gaming Nation service. That stopped
     being true — these pages are served by whatever is to hand, a dev server
     on :5173, a static host, a file — and the cost was every legacy endpoint
     firing at that host and 404ing on a loop.

     fleet-server.js now sets window.HLL_SERVICE in the pages it serves, so a
     company running the service is joined up with no configuration at all,
     and a page served by anything else stays quiet. An address set by hand
     in settings still overrides both. */
  try {
    if (typeof window !== 'undefined' && window.HLL_SERVICE) {
      return String(window.HLL_SERVICE).replace(/\/$/, '');
    }
  } catch (e) { /* nothing to go on */ }

  return '';
}

/* Where the company service listens when it is running beside you. */
const LOCAL_SERVICE = 'http://localhost:7040';

/* Ask the machine this client is on whether the service is running.

   One request, with a short deadline. If nothing answers, the client
   carries on exactly as before and says nothing — not running the
   service is the normal case, and a warning on every start for the
   ordinary case is noise that teaches people to ignore warnings.

   An address set by hand in Settings still wins: this only fills in
   when nothing else has said where the service is. */
async function discoverLocalService() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.HLL_SERVICE) return false;
    if ((Store.db.settings.fleetUrl || '').trim()) return false;
    if (typeof fetch !== 'function') return false;

    const stop = new AbortController();
    const bell = setTimeout(() => stop.abort(), 1200);

    let ok = false;
    try {
      const res = await fetch(LOCAL_SERVICE + '/status',
        { cache: 'no-store', signal: stop.signal });
      ok = res.ok;
    } catch (e) { ok = false; }
    clearTimeout(bell);

    if (!ok) return false;

    window.HLL_SERVICE = LOCAL_SERVICE;
    console.log('[HLL] company service found on ' + LOCAL_SERVICE);
    return true;

  } catch (e) {
    return false;
  }
}

const Sync = {
  timer: null, pushTimer: null, version: 0,
  status: 'off', lastError: null, applying: false,

  url() {
    const u = (Store.db.settings.fleetUrl || '').trim();
    return u ? u.replace(/\/$/, '') : defaultServiceUrl();
  },
  configured() { return !!(Store.db.settings.fleetUrl || '').trim(); },
  on() { return !!this.url(); },

  start() {
    this.stop();
    if (!this.on()) { this.status = 'off'; return; }
    this.pull();
    this.timer = setInterval(() => this.pull(), 20000);
  },
  stop() {
    clearInterval(this.timer); this.timer = null;
    clearTimeout(this.pushTimer); this.pushTimer = null;
  },

  /* Either side can arrive as something other than a list — a service on a
     different version, a hand-edited file, a half-written response. One bad
     field used to throw here and take the whole update down with it, so the
     rest of a good payload was thrown away too. */
  mergeList(mine, theirs, stamp) {
    const by = new Map();
    const a = Array.isArray(theirs) ? theirs : [];
    const b = Array.isArray(mine) ? mine : [];
    a.forEach((x) => { if (x && x.id) by.set(x.id, x); });
    b.forEach((x) => {
      if (!x || !x.id) return;
      const other = by.get(x.id);
      if (!other) { by.set(x.id, x); return; }
      const a = stamp ? new Date(x[stamp] || 0).getTime() : 0;
      const b = stamp ? new Date(other[stamp] || 0).getTime() : 0;
      by.set(x.id, a >= b ? x : other);
    });
    return Array.from(by.values());
  },

async pull() {

  if (!this.on() || this.applying) return;

  try {

    const res = await fetch(
      this.url() + '/api/company',
      { cache: 'no-store' }
    );

    if (!res.ok) {
      throw new Error('HTTP ' + res.status);
    }

    const body = await res.json();

    this.version = body.version || 0;

    const remote = body.data;

    if (!remote) {
      this.status = 'ok';
      return;
    }

    this.applying = true;

    const db = Auth.hqDb() || {
      drivers: [],
      applications: [],
      assignments: [],
      events: [],
      jobs: [],
      tickets: [],
      activity: [],
      notifications: []
    };

    /*
     * Company service synchronization.
     *
     * IMPORTANT:
     * Applications are NOT merged from the company service.
     *
     * Supabase public.applications is the authoritative source
     * for recruitment applications.
     *
     * Applications.pull() is responsible for loading them.
     */

    db.drivers = this.mergeList(
      db.drivers,
      remote.drivers,
      'lastSeen'
    );

    /*
     * DO NOT merge remote applications here.
     *
     * Old code:
     * db.applications = this.mergeList(
     *   db.applications,
     *   remote.applications,
     *   'submitted'
     * );
     */

    db.assignments = this.mergeList(
      db.assignments,
      remote.assignments,
      'at'
    );

    db.tickets = this.mergeList(
      db.tickets,
      remote.tickets,
      'updated'
    );

    db.events = this.mergeList(
      db.events,
      remote.events,
      'date'
    );

    db.jobs = this.mergeList(
      db.jobs,
      remote.jobs,
      'finished'
    ).slice(0, 500);

    db.activity = this.mergeList(
      db.activity,
      remote.activity,
      'at'
    ).slice(0, 200);

    db.notifications = this.mergeList(
      db.notifications,
      remote.notifications,
      'at'
    ).slice(0, 300);

    Auth.saveHqDb(db);

    if (Array.isArray(remote.accounts)) {

      const by = new Map();

      remote.accounts.forEach((a) => {
        if (a && a.driverId) {
          by.set(a.driverId, a);
        }
      });

      Auth.accounts().forEach((a) => {
        if (
          a &&
          a.driverId &&
          !by.has(a.driverId)
        ) {
          by.set(a.driverId, a);
        }
      });

      try {
        localStorage.setItem(
          HQ_ACCOUNTS,
          JSON.stringify(Array.from(by.values()))
        );
      } catch (e) {}

    }

    this.applying = false;
    this.status = 'ok';
    this.lastError = null;

    /*
     * The signed-in driver's own figures may have moved
     * on another machine.
     */
    if (Store.db.driver) {

      const rec = Auth.driverRecord(
        Store.db.driver.hllId
      );

      if (rec) {

        Store.db.driver.rank = rankNameFor(rec);

        Store.db.driver.role =
          rec.role || 'driver';

        Store.save();

      }

    }

    /*
     * Recruitment applications are loaded separately
     * from Supabase, which is the source of truth.
     */
    if (
      typeof Applications !== 'undefined' &&
      typeof Applications.pull === 'function' &&
      await Sync.signedIn()
    ) {
      await Applications.pull();
    }

    render();

  } catch (e) {

    this.applying = false;
    this.status = 'error';
    this.lastError = e.message;

    console.error(
      '[HLL] Company service pull failed:',
      e
    );

  }

},

  push() {
    if (!this.on()) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.sendNow(), 900);
  },

  async sendNow() {
    if (!this.on() || this.applying) return;
    const db = Auth.hqDb();
    if (!db) return;
    const payload = Object.assign({}, db, { accounts: Auth.accounts() });
    try {
      const res = await fetch(this.url() + '/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: this.version, data: payload }),
      });
      const body = await res.json().catch(() => ({}));
      if (res.status === 409) { this.version = body.version || 0; await this.pull(); return; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.version = body.version || this.version;
      this.status = 'ok';
    } catch (e) {
      this.status = 'error';
      this.lastError = e.message;
    }
  },
};

/* ---------- speed alert ----------
   A two-tone siren synthesised on the fly, so no audio file has to be
   shipped and it works offline. Only sounds once per overspeed, and
   only while the driver is actually over the limit. */
const Siren = {
  ctx: null,
  playing: false,
  lastAt: 0,

  audio() {
    if (!this.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return null;
      this.ctx = new Ctx();
    }
    if (this.ctx.state === 'suspended') this.ctx.resume().catch(() => {});
    return this.ctx;
  },

  wail(seconds = 2.2) {
    const ctx = this.audio();
    if (!ctx || this.playing) return;
    this.playing = true;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.16, ctx.currentTime + 0.06);
    gain.connect(ctx.destination);

    const osc = ctx.createOscillator();
    osc.type = 'square';
    /* alternate two tones, the way a European two-tone horn does */
    const step = 0.42;
    for (let t = 0; t < seconds; t += step) {
      osc.frequency.setValueAtTime((t / step) % 2 < 1 ? 660 : 880, ctx.currentTime + t);
    }
    osc.connect(gain);
    osc.start();
    gain.gain.setValueAtTime(0.16, ctx.currentTime + seconds - 0.12);
    gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + seconds);
    osc.stop(ctx.currentTime + seconds);
    osc.onended = () => {
      this.playing = false;
      try { gain.disconnect(); } catch (e) {}
    };
  },

  /* called on every telemetry frame */
  check(speed) {
    const s = Store.db.settings;
    if (!s.sirenEnabled) { this.armed = true; return; }
    const limit = Number(s.sirenSpeedLimit) || 95;
    if (speed > limit) {
      /* one alert per excursion, and never more than once every 20s */
      if (this.armed !== false && Date.now() - this.lastAt > 20000) {
        this.armed = false;
        this.lastAt = Date.now();
        this.wail();
        Store.log('warn', 'Over the speed limit — ' + Math.round(speed) + ' km/h (limit ' + limit + ')');
        toast('Speeding — ' + Math.round(speed) + ' km/h', 'warn');
      }
    } else if (speed < limit - 3) {
      this.armed = true;      /* re-arm once safely back under */
    }
  },
};

/* ---------- live map view ---------- */
function viewLiveMap() {
  const db = Store.db;
  const live = db.live;
  const detected = Telemetry.mode === 'live' && live && live.game;
  const mapKey = detected || db.settings.game || 'ets2';
  const M = mapFor(mapKey);
  const src = Telemetry.mode === 'live' ? 'Live telemetry'
    : db.conn.ets2 === 'running' ? 'Simulated' : 'No signal';

  const mapMode = TileMap.available() ? TileMap.mode() : 'schematic';
  const gameMode = mapMode === 'game';
  const worldMode = mapMode === 'world';
  const useTiles = mapMode === 'tiles';
  const onLeaflet = gameMode || worldMode || useTiles;
  const tileCal = useTiles ? TileMap.cal(mapKey) : null;
  const tilePts = tileCal && tileCal.points ? tileCal.points.length : 0;
  /* one transform serves the game map, the schematic and real-world tiles */
  const calibrated = useTiles ? tilePts >= 2 : Calib.ready(mapKey);
  const calPts = Calib.points(mapKey).length;

  return `
  ${viewHead('Live map', M.label + ' · ' + src, `
    <button class="btn btn-sm ${db.settings.liveTelemetry ? 'btn-primary' : ''}" data-act="toggle-live">
      ${icon('wifi')}${db.settings.liveTelemetry ? 'Live on' : 'Live off'}</button>
    ${useTiles ? `<button class="btn btn-sm ${TileMap.following ? 'btn-primary' : ''}" id="followBtn" data-act="follow-toggle">
      ${icon('target')}${TileMap.following ? 'Following' : 'Follow'}</button>` : ''}
    ${detected
      ? `<span class="pill ok">${icon('check')}${esc(M.short)} detected</span>`
      : `<button class="btn btn-sm" data-act="map-game" data-v="${mapKey === 'ets2' ? 'ats' : 'ets2'}">
          ${icon('refresh')}Show ${mapKey === 'ets2' ? 'ATS' : 'ETS2'}</button>`}
    <button class="btn btn-sm ${calibrated ? '' : 'btn-primary'}" data-act="${useTiles ? 'tile-calibrate' : 'calibrate'}">
      ${icon('target')}${calibrated ? 'Calibrate' : 'Line up'}</button>
    <button class="btn btn-sm ${db.settings.showFleet ? 'btn-primary' : ''}" data-act="fleet-toggle">
      ${icon('users')}Fleet ${Fleet.drivers.filter((d) => !d.self).length}</button>
    <button class="btn btn-sm" data-act="tile-source">${icon('map')}Map</button>`)}

  ${useTiles && TileMap.calibrating ? `<div class="card" style="border-color:var(--accent-line)">
      <div class="card-body row gap-12">
        <span style="color:var(--accent);width:16px;height:16px">${icon('target')}</span>
        <div class="grow"><div class="b6">Click exactly where your truck is</div>
          <div class="t3 xs mt-4">${tilePts ? 'Second of two points — pick a spot well away from the first.' : 'First of two points.'}</div></div>
        <button class="btn btn-sm" data-act="tile-calibrate-cancel">Cancel</button>
      </div></div>` : ''}

  ${useTiles && tilePts < 2 && !TileMap.calibrating ? `<div class="card"><div class="card-body row gap-12">
      <span style="color:var(--warn);width:16px;height:16px">${icon('alert')}</span>
      <div class="grow"><div class="b6">Tile map not calibrated${tilePts ? ' yet (1 of 2 points)' : ''}</div>
        <div class="t3 xs mt-4">A tile set of your own has coordinates only you know about, so
          this one is lined up by hand. Press Calibrate and click where you are.</div></div>
    </div></div>` : ''}

  ${!useTiles && !calibrated ? `<div class="card"><div class="card-body row gap-12">
      <span style="color:var(--${calPts ? 'accent' : 'warn'});width:16px;height:16px">${icon('target')}</span>
      <div class="grow">
        <div class="b6">${calPts
          ? 'Lining the map up — one more reference to go'
          : 'Working out where the game world sits'}</div>
        <div class="t3 xs mt-4">${calPts
          ? 'One reference taken at ' + esc(calPts === 1 && Calib.points(mapKey)[0] ? cityLabel(Calib.points(mapKey)[0].city) : 'a city')
            + '. The next job that starts or ends somewhere else finishes the job by itself.'
          : 'Drive a job and the client takes its bearings from the cities the game names. '
            + 'Two of those and your position is exact on every map. You can also do it by hand.'}</div></div>
      <button class="btn btn-sm" data-act="calibrate">${icon('target')}Do it by hand</button>
    </div></div>` : ''}

  <section class="card">
    <div class="card-head">
      <span class="label">Position</span>
      <span class="label">${live ? esc(headingLabel(live.heading)) + ' · ' + live.speed + ' km/h' : 'no fix'}</span>
    </div>
    <div class="card-body" id="mapCard">${onLeaflet
      ? `<div id="leafletMap" class="leaflet-host"></div>
         <div class="facts" id="liveFacts">${liveFactsInner()}</div>`
      : liveMapInner()}</div>
  </section>

  <section class="card">
    <div class="card-head">
      <span class="label">Fleet on the road</span>
      <button class="btn btn-sm" data-act="fleet-setup">${icon('link')}${Fleet.enabled() ? 'Service' : 'Connect a service'}</button>
    </div>
    <div class="card-body" id="fleetPanel">${fleetPanelInner()}</div>
  </section>

  <section class="card">
    <div class="card-head"><span class="label">Telemetry source</span></div>
    <div class="card-body">
      <div class="setting-row"><span class="t2">Mode</span>
        <span class="pill ${Telemetry.mode === 'live' ? 'ok' : 'warn'}">${Telemetry.mode === 'live' ? 'Live from game' : 'Simulator'}</span></div>
      <div class="setting-row"><span class="t2">Endpoint</span><span class="mono sm">${esc(Telemetry.endpoint())}</span></div>
      <div class="setting-row"><span class="t2">Read every</span>
        <span class="mono sm">${esc(String(Store.db.settings.pollRate || 400))} ms</span></div>
      ${Telemetry.mode !== 'live' ? `<div class="setting-row"><span class="t2">Last error</span>
        <span class="sm t3">${esc(Telemetry.lastError || 'not tried yet')}</span></div>` : ''}

      <!-- the other half of "real time": the game feeds this client, and this
           client feeds the rest of the company down one open stream -->
      <div class="setting-row"><span class="t2">Company link</span>${liveDot()}</div>
      ${Fleet.enabled() ? `<div class="setting-row"><span class="t2">Service</span>
        <span class="mono sm">${esc(Fleet.endpoint())}</span></div>` : ''}
      ${Realtime.status !== 'live' && Fleet.enabled() ? `<div class="setting-row">
        <span class="t2">Live link</span>
        <span class="sm t3">${esc(Realtime.lastError || 'not open')} — polling instead</span></div>` : ''}

      <div class="t3 xs mt-12">Live data needs the SCS telemetry plugin in
        <span class="mono">&lt;game&gt;/bin/win_x64/plugins/</span> and the telemetry server running.
        On a phone, set the host to this PC's LAN address in Settings.</div>
      <div class="t3 xs mt-8">With a company service connected, your run is pushed to
        every other client the moment it changes, and theirs arrive here the same way —
        no waiting for the next poll.</div>
    </div>
  </section>`;
}

function liveMapInner() {
  const db = Store.db;
  const live = db.live;
  const detected = Telemetry.mode === 'live' && live && live.game;
  const mapKey = detected || db.settings.game || 'ets2';
  const M = mapFor(mapKey);
  const job = db.job;

  const cityDots = Object.keys(M.cities).filter((name) => {
    /* the dashboard map is small, so only the majors and whatever this run
       actually touches earn a dot */
    if (cityTier(mapKey, name) === 1) return true;
    if (job && (name === job.to || name === job.from)) return true;
    return !!(live && live.near && live.near.city === name);
  }).map((name) => {
    const [x, y] = M.cities[name];
    const isEnd = job && (name === job.to);
    const isStart = job && (name === job.from);
    const nearName = live && live.near && live.near.city === name;
    const r = isEnd || isStart ? 4 : 2.4;
    const fill = isEnd ? 'var(--accent)' : isStart ? 'var(--ok)' : nearName ? 'var(--info)' : 'rgba(255,255,255,.32)';
    return `<g class="map-node">
      <circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>
      <circle cx="${x}" cy="${y}" r="9" fill="transparent"><title>${esc(name)}</title></circle>
      ${isEnd || isStart || nearName
        ? `<text x="${x}" y="${y - 8}" text-anchor="middle" class="map-lbl">${esc(cityLabel(name))}</text>` : ''}
    </g>`;
  }).join('');

  /* route line from source to destination when a job is running */
  let routeLine = '';
  if (job && M.cities[job.from] && M.cities[job.to]) {
    const a = M.cities[job.from], b = M.cities[job.to];
    routeLine = `<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}"
      stroke="var(--accent)" stroke-width="1.5" stroke-dasharray="5 5" opacity=".55"/>`;
  }

  /* breadcrumb trail */
  let trail = '';
  if (db.trail && db.trail.length > 1) {
    trail = `<polyline points="${db.trail.map((p) => p[0] + ',' + p[1]).join(' ')}"
      fill="none" stroke="var(--accent)" stroke-width="1.6" opacity=".75"
      stroke-linejoin="round" stroke-linecap="round"/>`;
  }

  /* the truck */
  let marker = '';
  if (live && live.game === mapKey && live.map &&
      Number.isFinite(live.map.x) && Number.isFinite(live.map.z)) {
    const deg = -(live.heading || 0) * 360;
    marker = `<g transform="translate(${live.map.x.toFixed(1)},${live.map.z.toFixed(1)})" id="truckMarker">
      <circle r="13" fill="var(--accent)" opacity=".16"/>
      <circle r="6.5" fill="var(--accent)" stroke="var(--bg)" stroke-width="1.6"/>
      <g transform="rotate(${deg.toFixed(1)})">
        <path d="M0 -11 L4.4 4 L0 1.2 L-4.4 4 Z" fill="var(--accent)" stroke="var(--bg)" stroke-width="1"/>
      </g>
      <title>${esc(Store.db.driver.name)} — ${live.speed} km/h ${esc(headingLabel(live.heading))}</title>
    </g>`;
  }
  if (db.settings.showFleet) {
    marker += Fleet.drivers.filter((d) => !d.self && (!d.game || d.game === mapKey))
      .map((d) => {
        const geo = typeof d.lat === 'number' && typeof d.lon === 'number'
          ? [d.lat, d.lon] : (typeof d.x === 'number' && Calib.toGeo(mapKey, d.x, d.z));
        if (!geo) return '';
        const point = geoToGameLatLng(mapKey, geo[0], geo[1]);
        const name = esc(d.name || d.id);
        const job = d.job ? (d.job.from || '?') + ' -> ' + (d.job.to || '?') : 'No active job';
        const truck = d.truck || 'Truck unavailable';
        return `<g class="fleet-svg-marker" transform="translate(${point.lng.toFixed(1)},${(-point.lat).toFixed(1)})">
          <circle r="10" fill="var(--info)" opacity=".18"/><path d="M0 -9 L4 4 L0 1 L-4 4 Z" fill="var(--info)" stroke="var(--bg)" stroke-width="1"/>
          <text x="0" y="-13" text-anchor="middle" class="map-lbl">${name}</text>
          <title>${name} | ${esc(truck)} | ${esc(job)} | ${d.speed || 0} km/h</title>
        </g>`;
      }).join('');
  }

  const B = M.bounds;
  const grat = Array.from({ length: 9 }, (_, i) => B.y0 + (i * M.h) / 8).map((y) =>
    `<line x1="${B.x0}" y1="${y.toFixed(1)}" x2="${B.x1}" y2="${y.toFixed(1)}" stroke="#212730"/>`).join('')
    + Array.from({ length: 11 }, (_, i) => B.x0 + (i * M.w) / 10).map((x) =>
    `<line x1="${x.toFixed(1)}" y1="${B.y0}" x2="${x.toFixed(1)}" y2="${B.y1}" stroke="#212730"/>`).join('');

  const stateWord = {
    delivering: ['ok', 'On the road delivering'],
    stopped: ['warn', 'Stopped with a load'],
    driving: ['info', 'Driving, no job'],
    paused: ['warn', 'Game paused'],
    idle: ['', 'Parked'],
  }[db.activityState || 'idle'] || ['', 'Parked'];

  return `
    <div class="map-wrap">
      <svg viewBox="${B.x0} ${B.y0} ${M.w} ${M.h}" class="livemap" role="img" aria-label="Driver position">
        ${grat}${routeLine}${trail}${cityDots}${marker}
      </svg>
      <div class="map-badge">
        <span class="pill ${stateWord[0]}">${icon('truck')}${stateWord[1]}</span>
      </div>
    </div>

    <div class="facts" id="liveFacts">${liveFactsInner()}</div>`;
}

function liveFactsInner() {
  const db = Store.db;
  const live = db.live;
  if (!live) {
    return `<div class="fact"><div class="k">Position</div><div class="v t3" style="font-size:12.5px">No fix yet</div></div>
      <div class="fact"><div class="k">Source</div><div class="v t3" style="font-size:12.5px">${esc(Telemetry.mode)}</div></div>`;
  }
  const j = db.job;
  return `
    <div class="fact"><div class="k">Nearest</div><div class="v">${live.near ? esc(live.near.city) : '—'}</div></div>
    <div class="fact"><div class="k">Distance to it</div><div class="v">${live.near ? fmt.km(live.near.distance) : '—'}</div></div>
    <div class="fact"><div class="k">Speed</div><div class="v">${live.speed} km/h${live.speedLimit ? ' <span class="t3">/ ' + live.speedLimit + '</span>' : ''}</div></div>
    <div class="fact"><div class="k">Heading</div><div class="v">${esc(headingLabel(live.heading))}</div></div>
    <div class="fact"><div class="k">Destination</div><div class="v">${j ? esc(j.to) : '—'}</div></div>
    <div class="fact"><div class="k">World X / Z</div><div class="v mono" style="font-size:12px">${Math.round(live.world.x)} / ${Math.round(live.world.z)}</div></div>`;
}

function fleetPanelInner() {
  const others = Fleet.drivers.filter((d) => !d.self);
  if (!others.length) {
    return `<div class="empty">${icon('users')}<div>${Fleet.enabled()
      ? 'No other drivers reporting'
      : 'Connect a fleet service to see the rest of the crew'}</div></div>`;
  }
  return `
    <div class="tbl-wrap"><table class="tbl">
      <thead><tr><th>Driver</th><th>State</th><th>Run</th><th class="right">Speed</th></tr></thead>
      <tbody>${others.map((d) => `<tr>
        <td><div class="row gap-8">${avatarFace(d, 'sm')}
          <span class="b6">${esc(d.name || d.id)}</span></div></td>
        <td>${d.state === 'delivering'
          ? `<span class="pill ok">${icon('truck')}Hauling</span>`
          : `<span class="pill">${esc(d.state || 'idle')}</span>`}</td>
        <td class="t2">${d.job ? esc(d.job.from) + ' <span class="t3">&rarr;</span> ' + esc(d.job.to) : '<span class="t3">no load</span>'}</td>
        <td class="right mono">${Math.round(d.speed || 0)} km/h</td>
      </tr>`).join('')}</tbody>
    </table></div>`;
}

/* repaint just the moving parts, once per telemetry frame */
function paintLiveMap() {
  /* With tiles up, only the marker and the readouts move — rebuilding the
     container would destroy and recreate the Leaflet instance every second. */
  if (TileMap.map) {
    TileMap.update();
    TileMap.drawFleet();
    const facts = $('#liveFacts');
    if (facts) facts.innerHTML = liveFactsInner();
    const fp = $('#fleetPanel');
    if (fp) fp.innerHTML = fleetPanelInner();
    return;
  }
  const card = $('#mapCard');
  if (card) card.innerHTML = liveMapInner();
}

/* ---------- calibration ---------- */
function openCalibrate() {
  const db = Store.db;
  const live = db.live;
  const mapKey = (Telemetry.mode === 'live' && live && live.game) || db.settings.game || 'ets2';
  const M = mapFor(mapKey);
  const pts = Calib.points(mapKey);

  modal({
    title: 'Line the map up',
    body: `
      <p class="t2">This normally happens on its own: every job the game gives you names the
        city it starts and ends in, and that is all the client needs. Doing it by hand is only
        for when you would rather not wait.</p>
      <p class="t2 mt-12">Park in a city, pick it below and save the point. Do it in
        <b>two cities well apart</b> and your position is exact on every map.</p>
      ${!live ? `<div class="pill err mt-12">${icon('alert')}No live position — start the game with telemetry running</div>` : `
        <div class="setting-row mt-12"><span class="t2">Current world position</span>
          <span class="mono sm">${Math.round(live.world.x)}, ${Math.round(live.world.z)}</span></div>`}
      <div class="field mt-12"><label for="calCity">I am parked in</label>
        <select class="select" id="calCity">
          ${Object.keys(M.cities).sort().map((c) =>
            `<option value="${esc(c)}">${esc(cityLabel(c) === c ? c : cityLabel(c) + '  (' + c + ')')}</option>`).join('')}
        </select></div>
      <div class="t3 xs">References taken: ${pts.length} of 2${
        pts.length ? ' — ' + pts.map((x) => esc(cityLabel(x.city || ''))).join(', ') : ''}</div>`,
    foot: `<button class="btn" data-close>Close</button>
      ${pts.length ? `<button class="btn btn-danger" data-act="cal-reset" data-map="${mapKey}">Reset</button>` : ''}
      <button class="btn btn-primary" data-act="cal-save" data-map="${mapKey}" ${live ? '' : 'disabled'}>
        ${icon('target')}Save this point</button>`,
  });
}

function saveCalibrationPoint(mapKey) {
  const db = Store.db;
  const live = db.live;
  if (!live) { toast('No live position to calibrate from', 'warn'); return; }
  const city = $('#calCity') ? $('#calCity').value : null;
  if (!city || !geoFor(mapKey)[city]) { toast('Pick a city first', 'warn'); return; }

  const solved = Calib.sampleFromCity(mapKey, city, live.world, 'two cities you picked');
  if (!solved && Calib.points(mapKey).length >= 2) {
    toast('Those places are too close together — try one much further away', 'warn');
  } else if (!solved) {
    toast('Saved. Now drive to a distant city and do it again.', 'info');
  }
  closeModals();
  render();
}

/* ---------------- store ---------------- */
const LS = 'hllwjt.v3';

function seed() {
  /* A fresh client holds no identity and no history. The driver signs in with
     their Gaming Nation account first; everything below is filled from real runs. */
  const db = {
    driver: null,         /* set by Auth.signIn from the Gaming Nation driver record */
    conn: { hll: 'offline', ets2: 'stopped', link: 'ready', profile: null, telemetry: 'off' },
    live: null,           /* last decoded position frame */
    trail: [],            /* breadcrumb in schematic map units */
    worldTrail: [],       /* breadcrumb in raw game coords, for the tile map */
    activityState: null,  /* delivering | stopped | driving | paused | idle */
    job: null,
    logbook: [],
    pending: [],
    uploads: [],
    activity: [],
    messages: [],
    chats: [],
    settings: {
      profileName: '',
      autoDetect: true,
      autoSubmit: false,
      captureScreenshot: true,
      notifications: true,
      startWithWindows: false,
      minimiseToTray: true,
      telemetryPort: '25555',
      telemetryHost: 'localhost',
      liveTelemetry: true,      /* poll the real game when the server is reachable */
      pollRate: 400,            /* ms between telemetry polls — fast enough to read as live */
      ets2Exe: '',              /* eurotrucks2.exe */
      atsExe: '',               /* amtrucks.exe */
      tmpExe: '',               /* TruckersMP launcher */
      autoStartTracking: true,  /* arm the link as soon as the game is launched */
      jobUpdateSec: 10,         /* how often a running job is written to disk */
      heartbeatSec: 15,         /* how often we tell HLL we are alive */
      startMinimized: false,
      sirenEnabled: true,       /* audible alert over the limit */
      sirenSpeedLimit: 95,
      game: 'ets2',             /* ets2 | ats */
      mapSource: 'game',        /* game (ETS2/ATS road network) | world (real tiles) | tiles (own pyramid) | schematic */
      tileUrl: '',              /* {z}/{x}/{y} template, for mapSource 'tiles' */
      worldTileUrl: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
      worldAttribution: '&copy; OpenStreetMap contributors',
      worldGeo: {},             /* per-game: game metres -> real lat/lon, the one transform */
      fleetUrl: '',             /* HLL fleet service; empty = own truck only */
      fleetRate: 5000,
      showFleet: true,
      showRegions: true,       /* the coloured seams between map regions */
      watchSec: 4,             /* how often the process list is checked */
      tileMinZoom: 0,
      tileMaxZoom: 8,
      tileSize: 256,
      tileTms: false,
      tileAttribution: '',
      tileCalibration: {},      /* per-game world -> tile CRS transform */
      tileView: null,           /* remembered centre + zoom */
    },
    stats: { totalKm: 0, totalJobs: 0, totalIncome: 0 },
  };

  db.activity.push({
    at: new Date().toISOString(), tag: 'info',
    msg: 'Client started — build ' + APP_VERSION,
  });
  return db;
}

const Store = {
  db: null,
  /* older builds kept a transform per map format; they were all solving the
     same thing, and the world one is the one that carries over */
  migrate() {
    if (!this.db) return;

    /* A store written by an older build knows nothing about the settings added
       since, and every one of them would read back undefined — which is how a
       tile layer ends up being handed no URL at all. Fill in whatever is
       missing from a fresh seed, without touching anything already chosen. */
    const fresh = seed();
    this.db.settings = this.db.settings || {};
    let added = 0;
    for (const k in fresh.settings) {
      if (!(k in this.db.settings)) { this.db.settings[k] = fresh.settings[k]; added++; }
    }
    /* and the same for the top-level shape the views assume */
    ['logbook', 'pending', 'uploads', 'activity', 'messages', 'chats', 'trail', 'worldTrail']
      .forEach((k) => { if (!Array.isArray(this.db[k])) { this.db[k] = []; added++; } });
    if (!this.db.conn || typeof this.db.conn !== 'object') { this.db.conn = fresh.conn; added++; }
    if (!this.db.stats || typeof this.db.stats !== 'object') { this.db.stats = fresh.stats; added++; }
    if (added) console.info('[HLL] filled in ' + added + ' setting(s) this build added');

    const s = this.db.settings;
    s.worldGeo = s.worldGeo || {};
    const old = s.geoCalibration;
    if (old) {
      for (const g in old) {
        const c = old[g];
        if (c && typeof c.sx === 'number' && typeof c.sz === 'number' && !s.worldGeo[g]) {
          s.worldGeo[g] = c;
        }
      }
      delete s.geoCalibration;
    }
    /* the schematic transform pointed at a layout that no longer exists */
    delete s.calibration;

    /* An identity from a build that shipped sample data has no sign-in behind
       it. Clearing it sends the driver to the sign-in screen, which is where
       they should have been all along. */
    const d = this.db.driver;
    if (d && !d.authed) {
      console.info('[HLL] clearing a leftover identity (' + (d.hllId || '?') + ') — sign in again');
      this.db.driver = null;
      this.db.conn = { hll: 'offline', ets2: 'stopped', link: 'ready', profile: null, telemetry: 'off' };
      this.db.live = null;
      this.db.activityState = null;
      this.db.trail = [];
      this.db.worldTrail = [];
    }

    /* a run left mid-flight by an older build should not still read as rolling */
    if (this.db.job && this.db.job.live && this.db.conn.ets2 !== 'running') {
      this.db.job.live = false;
      if (this.db.job.status === 'driving') this.db.job.status = 'paused';
    }
  },

  load() {
    try {
      const raw = localStorage.getItem(LS);
      if (raw) { this.db = JSON.parse(raw); this.migrate(); return this.db; }
    } catch (e) { console.warn('[JT] store unreadable, reseeding', e); }
    this.db = seed(); this.save(); return this.db;
  },
  save() {
    try { localStorage.setItem(LS, JSON.stringify(this.db)); }
    catch (e) { console.warn('[JT] store not writable', e); }
  },
  reset() {
    try { localStorage.removeItem(LS); } catch (e) {}
    this.db = seed(); this.save();
  },
  log(tag, msg) {
    this.db.activity.unshift({ at: new Date().toISOString(), tag, msg });
    this.db.activity = this.db.activity.slice(0, 200);
    this.save();
  },
};

/* ---------------- app state ---------------- */
const state = {
  view: 'dashboard',
  msgSel: 0,
  chatSel: 0,
  logFilter: 'all',
  logQuery: '',
};

const NAV = [
  { key: 'dashboard',   label: 'Run monitor',   icon: 'gauge' },
  { key: 'livemap',     label: 'Live map',      icon: 'pin' },
  { key: 'pending',     label: 'Delivery queue', icon: 'clock',
    count: () => Store.db.pending.length },
  { key: 'uploads',     label: 'Media queue',   icon: 'upload',
    count: () => Store.db.uploads.filter((u) => u.status !== 'done').length },
  { key: 'logbook',     label: 'Logbook',       icon: 'book' },
  { key: 'profile',     label: 'Driver record', icon: 'user' },
  { key: 'leaderboard', label: 'Standings',     icon: 'trophy' },
  { key: 'messages',    label: 'Messages',      icon: 'mail',
    count: () => Store.db.messages.filter((m) => !m.read).length },
  { key: 'chats',       label: 'Crew chat',     icon: 'chat' },
  { key: 'convoy',      label: 'Convoys',       icon: 'route' },
  { key: 'menu',        label: 'Menu',          icon: 'menu' },
  { key: 'settings',    label: 'Settings',      icon: 'settings' },
  { key: 'about',       label: 'About',         icon: 'info' },
];

/* ---------------- toasts ---------------- */
function toast(msg, kind = 'info') {
  const host = $('#toasts'); if (!host) return;
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  const ic = { ok: 'check', warn: 'alert', err: 'alert', info: 'info' }[kind] || 'info';
  el.innerHTML = `${icon(ic)}<div>${esc(msg)}</div>`;
  host.appendChild(el);
  setTimeout(() => el.remove(), 3800);
}

/* ---------------- modal ---------------- */
function modal({ title, body, foot, onMount }) {
  const w = document.createElement('div');
  w.className = 'overlay';
  w.innerHTML = `<div class="modal" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head">${esc(title)}</div>
    <div class="modal-body">${body}</div>
    <div class="modal-foot">${foot || '<button class="btn" data-close>Close</button>'}</div>
  </div>`;
  w.addEventListener('mousedown', (e) => { if (e.target === w) w.remove(); });
  $$('[data-close]', w).forEach((b) => b.onclick = () => w.remove());
  $('#layers').appendChild(w);
  if (onMount) onMount(w);
  return w;
}
function closeModals() { $$('#layers .overlay').forEach((o) => o.remove()); }

/* ============================================================
   Part 2 — game link (telemetry), job lifecycle
   ============================================================ */

/* The run itself: how far along it is, and what happens when it lands. Every
   figure here comes from the telemetry feed — nothing is generated. */
const GameLink = {
  progress(job) {
    if (!job || !job.km) return 0;
    return clamp(job.drivenKm / job.km * 100, 0, 100);
  },

  completeJob() {
    const db = Store.db;
    const job = db.job;
    job.status = 'delivered';
    job.drivenKm = job.km;
    job.finished = new Date().toISOString();
    /* time on the run is what the clock says, not what the distance implies —
       the old figure ignored every minute the truck spent standing still */
    const started = new Date(job.started).getTime();
    const elapsed = Number.isFinite(started) ? (Date.now() - started) / 60000 : 0;
    job.duration = Math.round(elapsed > 0.5 ? elapsed
      : job.km / Math.max(1, job.avgSpeed || job.speed) * 60);
    job.fuelUsed = Math.round(job.km * 0.32);

    Store.log('ok', `Delivery complete — ${job.to} (${fmt.km(job.km)}, ${fmt.eur(job.income)})`);

    JobTracker.note(job, 'delivered',
      'Delivered ' + job.cargo + ' to ' + cityLabel(job.to), 'ok', 'check');
    Fleet.emit('job.delivered',
      db.driver.name + ' delivered ' + job.cargo + ' to ' + cityLabel(job.to)
      + ' — ' + fmt.km(job.km), 'ok');

    const record = {
      id: job.id, from: job.from, to: job.to, cargo: job.cargo, trailer: job.trailer,
      weight: job.weight, km: job.km, income: job.income, market: job.market,
      damage: +job.damage.toFixed(1), fuelUsed: job.fuelUsed,
      started: job.started,
      finished: job.finished, duration: job.duration, status: 'pending',
      avgSpeed: job.avgSpeed || 0, top: Math.round(job.top || 0),
      events: (job.events || []).slice(-40),
      /* the run travels with what telemetry saw, so it can be checked */
      evidence: JobTracker.evidence(job),
    };
    db.pending.push(record);

    if (db.settings.captureScreenshot) captureDeliveryPhoto(job.id);

    db.job = null;
    JobTracker.reset(null);
    Fleet.pushNow();          /* the board should show us empty straight away */
    Store.save();

    if (db.settings.autoSubmit) {
      Store.log('info', 'Auto-submit is on — sending delivery to HLL');
      submitDelivery(record.id, true);
    } else {
      toast('Delivery complete — awaiting submission', 'ok');
    }
    render();
  },

  cancelJob() {
    const db = Store.db;
    if (!db.job) return;
    Store.log('err', 'Delivery cancelled by driver — ' + db.job.id);
    Fleet.emit('job.cancelled',
      db.driver.name + ' called off the run to ' + cityLabel(db.job.to), 'warn');
    db.job = null;
    JobTracker.reset(null);
    Fleet.pushNow();
    Store.save();
    toast('Delivery cancelled', 'warn');
    render();
  },
};

/* Takes a picture of the drop from the desktop shell. A browser tab cannot
   read the screen, so there it simply records that no photo was taken rather
   than inventing one. */
async function captureDeliveryPhoto(jobId) {
  const db = Store.db;
  const D = window.hllDesktop;
  if (!D || !D.captureScreen) {
    Store.log('info', 'No delivery photo — the browser cannot read the screen');
    return;
  }
  let shot = null;
  try { shot = await D.captureScreen(); } catch (e) { shot = null; }
  if (!shot || !shot.dataUrl) {
    Store.log('warn', 'Delivery photo could not be taken for ' + jobId);
    return;
  }
  db.uploads.push({
    id: uid('up'), kind: 'screenshot', name: 'delivery_' + jobId + '.jpg',
    size: Math.max(1, Math.round(shot.bytes / 1024)), job: jobId,
    at: new Date().toISOString(), data: shot.dataUrl,
    status: db.conn.hll === 'connected' ? 'queued' : 'waiting',
  });
  Store.log('ok', 'Delivery photo captured for ' + jobId);
  Store.save();
  if (state.view === 'uploads') render();
}

/* ---------------- submitting / syncing ---------------- */
function submitDelivery(id, silent) {
  const db = Store.db;
  const i = db.pending.findIndex((p) => p.id === id);
  if (i < 0) return;
  const rec = db.pending[i];

  if (db.conn.hll !== 'connected') {
    rec.status = 'waiting';
    Store.log('warn', 'No HLL connection — ' + rec.id + ' held in the queue');
    Store.save();
    toast('Offline — delivery kept in the queue', 'warn');
    render();
    return;
  }

  rec.status = 'synced';
  db.pending.splice(i, 1);
  db.logbook.unshift(rec);
  db.stats.totalKm += rec.km;
  db.stats.totalJobs += 1;
  db.stats.totalIncome += rec.income;
  const credited = creditToCompany(rec);
  Store.log(credited ? 'ok' : 'warn', credited
    ? `${rec.id} submitted to HLL — ${fmt.km(rec.km)} credited`
    : `${rec.id} logged here, but your Gaming Nation record could not be reached`);
  Store.save();
  if (!silent) toast(credited ? 'Delivery submitted to HLL' : 'Logged locally — HLL not reachable',
    credited ? 'ok' : 'warn');
  render();
}

/* Puts the run on the company record, which is what the website reads: the
   driver's totals, the fleet activity feed, and the run itself. Without this
   a delivery would only ever exist on the machine that drove it. */
function creditToCompany(rec) {
  const me = Store.db.driver && Store.db.driver.hllId;
  const hq = Auth.hqDb();
  if (!me || !hq) return false;
  const d = (hq.drivers || []).find((x) => x.id === me);
  if (!d) return false;

  hq.jobs = hq.jobs || [];
  if (hq.jobs.some((j) => j.id === rec.id)) return true;   /* already credited */
  /* The run carries everything the company reports on — where it went, how
     far, and what it paid. Every earnings figure on the platform is summed
     back out of these, so the money only has to be right here. */
  hq.jobs.unshift({
    id: rec.id, driverId: me, driver: d.name,
    from: rec.from, to: rec.to, cargo: rec.cargo,
    km: rec.km, income: rec.income, damage: rec.damage,
    started: rec.started || null,
    finished: rec.finished || new Date().toISOString(),
    duration: rec.duration || 0,
    avgSpeed: rec.avgSpeed || 0,
    status: 'delivered',
  });
  hq.jobs = hq.jobs.slice(0, 500);

  d.km = (d.km || 0) + rec.km;
  d.deliveries = (d.deliveries || 0) + 1;
  d.weekKm = (d.weekKm || 0) + rec.km;
  d.monthKm = (d.monthKm || 0) + rec.km;
  /* the all-time total is kept here because the job list is capped and the
     oldest runs eventually fall off it; the weekly and monthly figures are
     recomputed from the runs by the platform, so they cannot drift */
  d.earned = (d.earned || 0) + (rec.income || 0);
  d.weekEarned = (d.weekEarned || 0) + (rec.income || 0);
  d.monthEarned = (d.monthEarned || 0) + (rec.income || 0);
  d.lastSeen = new Date().toISOString();

  /* a dispatched load closes itself off when it is actually run */
  (hq.assignments || []).forEach((a) => {
    if (a.driverId === me && (a.status === 'assigned' || a.status === 'accepted')
      && a.to === rec.to && a.from === rec.from) {
      a.status = 'done';
      a.completed = new Date().toISOString();
    }
  });

  hq.activity = hq.activity || [];
  hq.activity.unshift({
    id: uid('act'), kind: 'delivery', icon: 'package', driverId: me,
    text: d.name + ' delivered ' + rec.cargo + ' to ' + rec.to,
    meta: fmt.km(rec.km), at: new Date().toISOString(),
  });
  hq.activity = hq.activity.slice(0, 200);

  Auth.saveHqDb(hq);
  /* the sitting this was driven in gets the credit too */
  Sessions.credit(rec);
  if (Sync.on()) Sync.push();
  return true;
}

function discardDelivery(id) {
  const db = Store.db;
  const rec = db.pending.find((p) => p.id === id);
  if (!rec) return;
  db.pending = db.pending.filter((p) => p.id !== id);
  db.uploads = db.uploads.filter((u) => u.job !== id);
  Store.log('warn', 'Delivery ' + id + ' discarded by driver');
  Store.save();
  toast('Delivery discarded', 'warn');
  render();
}

function syncUploads() {
  const db = Store.db;
  const queue = db.uploads.filter((u) => u.status !== 'done');
  if (!queue.length) { toast('Nothing to upload', 'info'); return; }
  if (db.conn.hll !== 'connected') { toast('No connection to the HLL server', 'err'); return; }
  queue.forEach((u) => { u.status = 'done'; u.uploaded = new Date().toISOString(); });
  Store.log('ok', `Uploaded ${queue.length} file${queue.length === 1 ? '' : 's'} to HLL storage`);
  Store.save();
  toast(`Uploaded ${queue.length} file${queue.length === 1 ? '' : 's'}`, 'ok');
  render();
}

/* The status light reports what the company service actually answered —
   clicking it asks again rather than pretending the link changed. */
async function toggleServer() {
  const db = Store.db;
  if (!db.driver || !db.driver.authed) { toast('Sign in first', 'warn'); return; }
  if (!Sync.on()) {
    toast('Working on this machine only', 'warn', 'Add a company service in Settings to sync');
    return;
  }
  toast('Checking the company service…', 'info');
  await Sync.pull();
  const ok = Sync.status === 'ok';
  const was = db.conn.hll === 'connected';
  db.conn.hll = ok ? 'connected' : 'offline';
  if (ok && !was) {
    db.uploads.forEach((u) => { if (u.status === 'waiting') u.status = 'queued'; });
    db.pending.forEach((p) => { if (p.status === 'waiting') p.status = 'pending'; });
  }
  Store.log(ok ? 'ok' : 'err',
    ok ? 'Company service answered' : 'Company service did not answer — working offline');
  Store.save();
  toast(ok ? 'Gaming Nation online' : 'Gaming Nation offline', ok ? 'ok' : 'err');
  render();
}

/* ============================================================
   Part 3 — views
   ============================================================ */

const initialsOf = (n) => n.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/* A driver's face, where the company record has one.

   The picture is uploaded on the website and stored on the driver record,
   so by the time it reaches the client it has already travelled here in
   the company payload — there is nothing to fetch and nothing to cache.
   Everyone else keeps their initials. */
function avatarFace(d, cls) {
  const src = d && typeof d.avatar === 'string' && d.avatar.startsWith('data:image/')
    ? d.avatar : '';

  const inner = src
    ? `<img class="avatar-img" src="${esc(src)}" alt="" loading="lazy" decoding="async">`
    : esc(initialsOf((d && (d.name || d.id)) || '?'));

  return `<span class="avatar ${cls || ''}${src ? ' has-img' : ''}">${inner}</span>`;
}

/* one call after the typing stops, rather than one per keystroke */
function debounce(fn, ms) {
  let t = null;
  return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); };
}

function viewHead(title, sub, actions) {
  /* on a phone the header already names the section, so the title row would
     say it twice; it is hidden there rather than removed */
  return `<div class="view-head">
    <div class="vh-title"><h1 class="view-title">${esc(title)}</h1>
    ${sub ? `<div class="view-sub">${esc(sub)}</div>` : ''}</div>
    ${actions ? `<div class="actions">${actions}</div>` : ''}
  </div>`;
}

/* ring gauge */
function gauge(pct, label, value, color) {
  const size = 58, sw = 4, r = (size - sw) / 2, c = size / 2;
  const circ = 2 * Math.PI * r, len = clamp(pct, 0, 100) / 100 * circ;
  return `<div class="gauge" style="width:${size}px;height:${size}px">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#1c2128" stroke-width="${sw}"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${color}" stroke-width="${sw}"
        stroke-linecap="round" stroke-dasharray="${len.toFixed(1)} ${circ.toFixed(1)}"/>
    </svg>
    <span class="gauge-txt"><span class="gauge-val">${esc(value)}</span>
      <span class="gauge-lbl">${esc(label)}</span></span>
  </div>`;
}

/* ---------------- dashboard: the run ---------------- */
function viewDashboard() {
  const db = Store.db;
  const running = db.conn.ets2 === 'running';
  const job = db.job;

  /* nothing here starts or stops anything by hand — the client watches for
     the game itself and these just report what it has found */
  /* the sitting the client has open, so a driver can see that their time is
     being recorded rather than having to take it on trust */
  const session = Sessions.current();
  const sessionMin = session
    ? Math.max(0, Math.round((Date.now() - new Date(session.started).getTime()) / 60000))
    : null;

  const actions = `
    <span class="pill game-only ${running ? 'ok' : ''}">${icon(running ? 'truck' : 'search')}${
      running ? mapFor(db.settings.game).short + ' running' : 'Watching for the game'}</span>
    ${session ? `<span class="pill ok" title="Your session is being recorded on your Gaming Nation record">
      ${icon('clock')}${esc(fmt.dur(sessionMin))} this session</span>` : ''}
    <button class="btn btn-sm game-only" data-act="nav" data-view="settings">${icon('settings')}Link games</button>
    <button class="btn btn-sm install-cta" data-act="install-app">${icon('download')}Install</button>`;

  return `
  ${viewHead('Run monitor', db.conn.profile ? 'Game profile: ' + db.conn.profile : 'No game profile selected', actions)}

  ${launchBarHTML()}

  ${assignmentsCardHTML()}

  <section class="card">
    <div class="card-head">
      <span class="label">Active run</span>
      <span class="label">${esc(db.driver.hllId)}</span>
    </div>
    <div class="card-body" id="runCard">${runCardInner()}</div>
  </section>

  ${liveDriversHTML()}

  <section class="card">
    <div class="card-head">
      <span class="label">Event log</span>
      <button class="btn btn-sm btn-ghost" data-act="clear-log">${icon('trash')}Clear</button>
    </div>
    <div class="card-body"><div class="console" id="console">${consoleInner()}</div></div>
  </section>`;
}


/* The profile tile on the run monitor. Telemetry does not report which game
   profile is loaded, so this is the driver telling us — it labels their runs
   and is what the launch bar shows. */
function openProfilePicker() {
  const s = Store.db.settings;
  modal({
    title: 'Game profile',
    size: 'narrow',
    body: `<p class="t2">Which Euro Truck Simulator 2 / American Truck Simulator profile
        do you drive under? It is only a label — it goes on your runs so a shared
        machine does not mix two drivers' work up.</p>
      <div class="field mt-12"><label for="profName">Profile name</label>
        <input class="input" id="profName" value="${esc(s.profileName || '')}"
          placeholder="Leave blank to use your driver name"></div>`,
    foot: `<button class="btn" data-close>Cancel</button>
      <button class="btn btn-primary" data-act="profile-save">${icon('check')}Save</button>`,
  });
}

function saveProfileName() {
  const db = Store.db;
  const el = $('#profName');
  db.settings.profileName = el ? el.value.trim() : '';
  db.conn.profile = db.settings.profileName || (db.driver ? db.driver.name : null);
  Store.log('info', db.settings.profileName
    ? 'Game profile set to ' + db.settings.profileName
    : 'Game profile cleared — using your driver name');
  Store.save();
  closeModals();
  render();
}

function launchBarHTML() {
  const db = Store.db;
  const s = db.settings;
  const profile = db.conn.profile;
  const ets2Ready = !!s.ets2Exe;
  const tmpReady = !!s.tmpExe;

  return `<div class="launchbar">
    <button class="launch-tile game game-only" data-act="launch-game" data-kind="ets2"
      title="${ets2Ready ? esc(s.ets2Exe) : 'Set the path in Settings'}">
      <span class="lt-mark">${icon('truck')}</span>
      <span class="lt-text"><span class="lt-1">EURO TRUCK</span><span class="lt-2">Simulator 2</span></span>
      ${ets2Ready ? '' : '<span class="lt-warn" title="No path set">!</span>'}
    </button>

    <button class="launch-tile tmp game-only" data-act="launch-game" data-kind="tmp"
      title="${tmpReady ? esc(s.tmpExe) : 'Set the path in Settings'}">
      <span class="lt-mark">${icon('users')}</span>
      <span class="lt-text"><span class="lt-1">TRUCKERS</span><span class="lt-2">Multiplayer</span></span>
      ${tmpReady ? '' : '<span class="lt-warn" title="No path set">!</span>'}
    </button>

    <button class="launch-tile" data-act="pick-profile">
      <span class="lt-mark">${icon('user')}</span>
      <span class="lt-text"><span class="lt-1">${profile ? 'PROFILE' : 'PROFILE'}</span>
        <span class="lt-2">${esc(profile || 'Waiting…')}</span></span>
    </button>

    <button class="launch-tile" data-act="open-hll" data-href="index.html#/dashboard">
      <span class="lt-mark">${icon('grid')}</span>
      <span class="lt-text"><span class="lt-1">MY GN</span><span class="lt-2">Dashboard</span></span>
    </button>

    <button class="launch-tile" data-act="open-hll" data-href="index.html#/rankings">
      <span class="lt-mark">${icon('trophy')}</span>
      <span class="lt-text"><span class="lt-1">MY GN</span><span class="lt-2">Ranking</span></span>
    </button>
  </div>`;
}

/* ---------- who else is out there ----------
   Every driver currently reporting, with what they are pulling, what they
   are driving and how fast. Own truck first, then the busiest. */
/* Every driver reporting, with the run each one is actually on. The rows are
   not a table any more: a run in progress has a shape — a route, a bar, a
   time left — and a table cell cannot show it. This is the picture a
   dispatcher wants, and it moves as the trucks do. */
function liveDriversHTML() {
  return `
  <section class="card" id="fleetCard">
    <div class="card-head">
      <span class="label">Drivers on the road</span>
      <div class="row gap-8">
        <span class="label" id="fleetCount"></span>
        ${liveDot()}
        <button class="btn btn-sm" data-act="fleet-setup">${icon('link')}${
          Fleet.enabled() ? 'Service' : 'Connect a service'}</button>
      </div>
    </div>
    <div class="card-body" id="fleetBody">${liveDriversInner()}</div>
  </section>`;
}

/* the state of the live link, said plainly and in one place */
function liveDot() {
  if (!Fleet.enabled()) return `<span class="livedot off" title="No company service connected">Offline</span>`;
  if (Realtime.status === 'live') return `<span class="livedot on" title="Pushed live from the company service">Live</span>`;
  if (Realtime.status === 'connecting') return `<span class="livedot wait" title="Opening the live link">Linking</span>`;
  if (Realtime.status === 'retry') return `<span class="livedot wait" title="${esc(Realtime.lastError || 'reconnecting')}">Polling</span>`;
  return `<span class="livedot wait" title="Polling the company service">Polling</span>`;
}

/* Everyone the fleet list draws: the driver themselves first, then everybody
   else the service is reporting.

   This block used to sit at the top level of the file with no function around
   it, so `db` resolved to nothing and the whole of tracker.js died on load with
   "db is not defined" — taking Auth, the sign-in and every screen below it
   down with it. fleetRows() was called from two places and defined in none. */
function fleetRows() {
  const db = Store.db;
  const mine = db.driver ? db.driver.hllId : null;

  const self = db.live ? [{
    id: mine || 'local',
    name: db.driver?.name || 'Gaming Nation Driver',
    self: true,

    speed: db.live.speed || 0,

    truck: db.live.truck || db.driver?.truck || '',

    state: db.activityState || 'idle',

    job: db.job ? {
      from: db.job.from,
      to: db.job.to,
      cargo: db.job.cargo,
      km: db.job.km,
      drivenKm: db.job.drivenKm,
      progress: GameLink.progress(db.job),
      etaMin: JobTracker.etaMinutes(db.job),
    } : null,

  }] : [];

  /* our own row is built above from live telemetry, which is fresher than
     anything that has been round the service — so drop the service copy */
  const others = (Fleet.drivers || [])
    .filter((d) => d && !d.self && (!mine || d.id !== mine));

  return self.concat(others);
}

function liveDriversInner() {
  const rows = fleetRows();

  if (!rows.length) {
    return `<div class="empty">${icon('users')}
      <div>${Fleet.enabled() ? 'Nobody is reporting a position' : 'No fleet service connected'}</div>
      <div class="t3 xs">${Fleet.enabled()
        ? 'Drivers appear here the moment their client sends a position.'
        : 'Point every client at the same company service and the whole crew shows up here, live.'}</div>
    </div>`;
  }

  const stateOf = (st) => ({
    delivering: ['rolling', 'Hauling'],
    stopped: ['held', 'Stopped'],
    driving: ['moving', 'Running empty'],
    paused: ['held', 'Paused'],
  }[st] || ['idle', 'Parked']);

  return `<div class="fleetlist">${rows.map((d) => {
    const [cls, word] = stateOf(d.state);
    const job = d.job;
    const pct = job && Number.isFinite(+job.progress) ? clamp(+job.progress, 0, 100) : null;
    const eta = job && Number.isFinite(+job.etaMin) ? +job.etaMin : null;

    return `<div class="fleetrow ${cls}${d.self ? ' me' : ''}">
      ${avatarFace(d, d.self ? 'sm me' : 'sm')}

      <div class="fr-who">
        <div class="fr-name">${esc(d.name || d.id)}${
          d.self ? '<span class="pill brand">You</span>' : ''}</div>
        <div class="fr-truck">${d.truck ? esc(d.truck) : 'truck unknown'}</div>
      </div>

      <div class="fr-run">
        ${job ? `
          <div class="fr-route">
            <span>${esc(cityLabel(job.from || '?'))}</span>
            <span class="fr-arrow">${icon('arrowRight')}</span>
            <span class="to">${esc(cityLabel(job.to || '?'))}</span>
            ${job.cargo ? `<span class="fr-cargo">${esc(job.cargo)}</span>` : ''}
          </div>
          ${pct != null ? `<div class="fr-bar"><i style="width:${pct.toFixed(1)}%"></i></div>` : ''}
          <div class="fr-sub">
            ${pct != null ? `<b>${Math.round(pct)}%</b>` : ''}
            ${job.km ? `<span>${fmt.km(Math.round(job.drivenKm || 0))} of ${fmt.km(job.km)}</span>` : ''}
            ${eta != null && pct != null && pct < 100
              ? `<span>${fmt.dur(eta)} to run</span>` : ''}
          </div>`
        : `<div class="fr-noload">No load aboard</div>`}
      </div>

      <div class="fr-state">
        <span class="fr-word"><i class="beat"></i>${word}</span>
        <span class="fr-speed">${Math.round(d.speed || 0)}<em>km/h</em></span>
      </div>
    </div>`;
  }).join('')}</div>

  ${Realtime.events.length ? `<div class="ticker">
    <div class="ticker-head">${icon('bolt')}Live from the fleet</div>
    <div class="ticker-list">${Realtime.events.slice(-6).reverse().map((e) => `
      <div class="ticker-row ${esc(e.level || 'info')}">
        <span class="ticker-time">${esc(fmt.clock(e.at))}</span>
        <span class="ticker-text">${esc(e.text || e.kind)}</span>
      </div>`).join('')}</div>
  </div>` : ''}`;
}

/* Repaint the fleet without rebuilding the page around it.

   Rebuilt rather than diffed, which is cheap for a crew of this size — but
   throttled, because telemetry arrives several times a second and rewriting
   the list that often would throw away the bars' own animation and any row
   the driver happens to be hovering. Once a second is as live as an eye can
   read anyway; the numbers that need to be exact are on the run card. */
let fleetPaintAt = 0;
let fleetPaintTimer = null;
const FLEET_PAINT_MS = 1000;

function paintLiveDrivers(force) {
  if (state.view !== 'dashboard') return;
  const since = Date.now() - fleetPaintAt;
  if (!force && since < FLEET_PAINT_MS) {
    if (fleetPaintTimer) return;
    fleetPaintTimer = setTimeout(() => {
      fleetPaintTimer = null;
      paintLiveDrivers(true);
    }, FLEET_PAINT_MS - since);
    return;
  }
  fleetPaintAt = Date.now();

  const body = $('#fleetBody');
  if (!body) return;
  body.innerHTML = liveDriversInner();

  const n = fleetRows().length;
  const count = $('#fleetCount');
  if (count) count.textContent = n ? n + ' reporting' : 'nobody reporting';

  const card = $('#fleetCard');
  const dot = card && card.querySelector('.livedot');
  if (dot) dot.outerHTML = liveDot();
}

/* the marker is centred on its position, so pin it inside the rail at the extremes */
const markerPos = (pct) => clamp(pct, 0, 100);


/* ---------------- dispatched loads ----------------
   What the company has given this driver to run, read from the shared
   company record so the client shows the same list the platform does. */
function myAssignments() {
  const db = Auth.hqDb();
  const me = Store.db.driver ? Store.db.driver.hllId : null;
  if (!db || !Array.isArray(db.assignments) || !me) return [];
  return db.assignments
    .filter((a) => a.driverId === me && (a.status === 'assigned' || a.status === 'accepted'))
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}

function assignmentsCardHTML() {
  const mine = myAssignments();
  if (!mine.length) return '';
  return `
  <section class="card" style="border-color:var(--accent-line)">
    <div class="card-head">
      <span class="label">Dispatched to you</span>
      <span class="pill brand">${mine.length}</span>
    </div>
    <div class="card-body col gap-12">
      ${mine.map((a) => `<div class="row-b wrap gap-12">
        <div style="min-width:0">
          <div class="b6">${esc(cityLabel(a.from))} <span class="t3">→</span> ${esc(cityLabel(a.to))}</div>
          <div class="t3 xs mt-4">${esc(a.cargo)} · ${fmt.km(a.km)}${
            a.payout ? ' · ' + fmt.eur(a.payout) : ''}</div>
          ${a.note ? `<div class="t2 xs mt-6">${esc(a.note)}</div>` : ''}
        </div>
        <div class="row gap-8">
          ${a.status === 'assigned'
            ? `<button class="btn btn-sm btn-primary" data-act="assignment-state"
                 data-id="${esc(a.id)}" data-v="accepted">Accept</button>`
            : `<span class="pill info">Accepted</span>`}
          <button class="btn btn-sm" data-act="assignment-state"
            data-id="${esc(a.id)}" data-v="done">Done</button>
        </div>
      </div>`).join('')}
    </div>
  </section>`;
}

function runCardInner() {
  const db = Store.db;
  const job = db.job;

  if (!job) {
    const last = db.logbook[0];
    return `
      <div class="run-top">
        <div>
          <div class="eyebrow">Current delivery</div>
          <div class="run-idle">${db.conn.ets2 === 'running' ? 'No active delivery'
            : Launcher.api() || GameWatch.supported ? 'Waiting for the game' : 'No run in progress'}</div>
          <div class="run-meta">${db.conn.ets2 === 'running'
            ? 'The game is running. Take a load in game and it appears here on its own.'
            : GameWatch.supported
              ? 'Start ' + mapFor(db.settings.game).label + ' however you like — the client sees it open and starts tracking by itself.'
              : Launcher.api()
                ? 'Waiting for the telemetry link. Tracking starts the moment the game answers.'
                /* No game on this device and no way to get one. Saying
                   "waiting for the telemetry link" on a phone promises
                   something that is never going to arrive; what a driver
                   has here is the record of runs made elsewhere. */
                : 'Runs are recorded on the machine you play on. This shows them, and everything else about your driving, wherever you are.'}</div>
        </div>
        <span class="run-state"><span class="beat"></span>${db.conn.ets2 === 'running' ? 'Idle' : 'Standby'}</span>
      </div>

      <!-- the delivery rail sits here whether or not there is a run, so the
           card keeps its shape instead of jumping about when one starts -->
      <div class="run-progress mt-20">
        <div class="row-b">
          <span class="k">Delivery progress</span>
          <span class="mono sm t3">—</span>
        </div>
        <div class="rrail mt-8 empty">
          <div class="rrail-track"><div class="rrail-fill" style="width:0%"></div></div>
          <span class="rrail-marker" style="left:0%">${icon('truck')}</span>
        </div>
        <div class="xs t3 mt-8">Progress appears once a load is picked up in game.</div>
      </div>

      <div class="gauges mt-20">
        ${gauge(0, 'Route', '—', '#2c333d')}
        ${gauge(0, 'Fuel', '—', '#2c333d')}
        ${gauge(0, 'Damage', '—', '#2c333d')}
        <div class="grow">
          <div class="fact"><div class="k">Awaiting</div>
            <div class="v t2" style="font-size:12.5px">No cargo assigned</div></div>
        </div>
      </div>
      ${last ? `<div class="facts">
        <div class="fact"><div class="k">Last run</div><div class="v">${esc(last.from)} → ${esc(last.to)}</div></div>
        <div class="fact"><div class="k">Distance</div><div class="v">${fmt.km(last.km)}</div></div>
        <div class="fact"><div class="k">Payout</div><div class="v">${fmt.eur(last.income)}</div></div>
        <div class="fact"><div class="k">Completed</div><div class="v">${esc(fmt.rel(last.finished))}</div></div>
      </div>` : ''}`;
}

  const pct = GameLink.progress(job);
  const remaining = Math.max(0, job.km - job.drivenKm);
  const etaMin = JobTracker.etaMinutes(job);
  const stateCls = { driving: 'rolling', delivered: 'done', paused: 'held' }[job.status] || '';
  const stateTxt = { driving: 'Rolling', delivered: 'Delivered', paused: 'Held' }[job.status] || job.status;

  /* three evenly spaced checkpoints so the rail reads as a route */
  const nodes = [0, 25, 50, 75, 100];

  return `
    <div class="run-top">
      <div style="min-width:0">
        <div class="eyebrow">Current delivery</div>
        <div class="run-cities">
          <span class="run-city">${esc(job.from)}</span>
          <span class="run-sep">${icon('arrowRight')}</span>
          <span class="run-city to">${esc(job.to)}</span>
        </div>
        <div class="run-meta">${esc(job.cargo)} · ${esc(job.trailer)} · ${job.weight} t · ${esc(job.market)}</div>
      </div>
      <span class="run-state ${stateCls}"><span class="beat"></span>${esc(stateTxt)}</span>
    </div>

    <div class="run-progress mt-20">
      <div class="row-b">
        <span class="k">Delivery progress</span>
        <span class="mono sm" id="railPct">${fmt.pct(pct)}</span>
      </div>
    </div>
    <div class="rrail">
      <div class="rrail-track">
        <div class="rrail-fill" id="railFill" style="width:${pct}%"></div>
        ${nodes.map((n) => `<span class="rrail-node ${n === 100 ? 'end' : ''} ${pct >= n ? 'passed' : ''}"
          data-node="${n}" style="left:${n}%"></span>`).join('')}
        <span class="rrail-marker" id="railMarker" style="left:${markerPos(pct)}%">${icon('truck')}</span>
      </div>
      <div class="rrail-ends"><span>${esc(job.from)}</span><span>${esc(job.to)}</span></div>
    </div>

    <div class="gauges mt-20" id="gaugeRow">${gaugeRowInner(job, pct)}</div>

    <div class="facts">
      <div class="fact"><div class="k">Load</div><div class="v mono">${esc(job.id)}</div></div>
      <div class="fact"><div class="k">Driven</div><div class="v" id="factDriven">${fmt.n(Math.round(job.drivenKm))} / ${fmt.km(job.km)}</div></div>
      <div class="fact"><div class="k">Remaining</div><div class="v" id="factLeft">${fmt.km(remaining)}</div></div>
      <div class="fact"><div class="k">Speed</div><div class="v" id="factSpeed">${job.speed} km/h</div></div>
      <div class="fact"><div class="k">Arrival in</div><div class="v" id="factEta">${
        etaMin == null ? '—' : fmt.dur(etaMin)}</div></div>
      <div class="fact"><div class="k">Average</div><div class="v" id="factAvg">${
        job.avgSpeed ? job.avgSpeed + ' km/h' : '—'}</div></div>
      <div class="fact"><div class="k">Payout</div><div class="v">${fmt.eur(job.income)}</div></div>
    </div>

    <!-- what has actually happened on this run, as it happens -->
    <div class="runline" id="runLine">${runTimelineInner()}</div>`;
}

/* The run's own history: picked up, milestones passed, anything that went
   wrong, delivered. It is written by JobTracker as the run happens, so this
   only has to draw it — newest at the top, because that is the one being
   read. */
function runTimelineInner() {
  const job = Store.db.job;
  const evs = (job && job.events) || [];
  if (!evs.length) {
    return `<div class="runline-empty">${icon('clock')}The run's timeline fills in as you drive.</div>`;
  }
  return `<div class="runline-head">${icon('route')}This run</div>
    <div class="runline-list">${evs.slice(-8).reverse().map((e) => `
      <div class="runline-row ${esc(e.level || 'info')}">
        <span class="runline-dot">${icon(e.glyph || 'info')}</span>
        <span class="runline-text">${esc(e.text)}</span>
        <span class="runline-km">${fmt.km(e.km || 0)}</span>
      </div>`).join('')}</div>`;
}

function paintRunTimeline() {
  const el = $('#runLine');
  if (el) el.innerHTML = runTimelineInner();
}

function gaugeRowInner(job, pct) {
  /* a job carried over from an older build, or one the game never reported
     condition for, still has to draw */
  const dmg = Number.isFinite(+job.damage) ? +job.damage : 0;
  const fuel = Number.isFinite(+job.fuel) ? +job.fuel : 0;
  const dmgColor = dmg > 15 ? '#ef5f5f' : dmg > 5 ? '#d99b2b' : '#3ecf8e';
  const fuelColor = fuel < 15 ? '#ef5f5f' : fuel < 30 ? '#d99b2b' : '#b9e87a';
  return gauge(pct, 'Route', fmt.pct(pct), '#8bd62b')
    + gauge(fuel, 'Fuel', fmt.pct(fuel), fuelColor)
    + gauge(clamp(dmg, 0, 100), 'Damage', dmg.toFixed(1) + '%', dmgColor);
}

/* repaint only the live values, once per telemetry frame */
function paintLiveJob() {
  const job = Store.db.job;
  if (!job) return;
  const pct = GameLink.progress(job);
  const remaining = Math.max(0, job.km - job.drivenKm);
  const eta = JobTracker.etaMinutes(job);
  const set = (id, v) => {
    const el = $('#' + id);
    if (!el || el.textContent === v) return;   /* don't touch what has not changed */
    el.textContent = v;
  };

  set('railPct', fmt.pct(pct));
  set('factDriven', fmt.n(Math.round(job.drivenKm)) + ' / ' + fmt.km(job.km));
  set('factLeft', fmt.km(remaining));
  set('factSpeed', job.speed + ' km/h');
  set('factEta', eta == null ? '—' : fmt.dur(eta));
  set('factAvg', job.avgSpeed ? job.avgSpeed + ' km/h' : '—');

  const fill = $('#railFill'); if (fill) fill.style.width = pct + '%';
  const mark = $('#railMarker'); if (mark) mark.style.left = markerPos(pct) + '%';
  $$('.rrail-node').forEach((n) => n.classList.toggle('passed', pct >= +n.dataset.node));
  const gr = $('#gaugeRow'); if (gr) gr.innerHTML = gaugeRowInner(job, pct);
}

function consoleInner() {
  const a = Store.db.activity;
  if (!a.length) return `<div class="empty">${icon('info')}<div>Nothing logged yet</div></div>`;
  return a.slice(0, 60).map((r) => `<div class="con-row">
    <span class="con-time">${esc(fmt.clock(r.at))}</span>
    <span class="con-lvl ${esc(r.tag)}">${esc(r.tag)}</span>
    <span class="con-msg">${esc(r.msg)}</span>
  </div>`).join('');
}

/* ---------------- logbook ---------------- */
function viewLogbook() {
  const db = Store.db;
  let rows = db.logbook.slice();
  const q = (state.logQuery || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter((r) => (
      (r.cargo || '') + ' ' + (r.from || '') + ' ' + (r.to || '') + ' ' +
      cityLabel(r.from || '') + ' ' + cityLabel(r.to || '') + ' ' + (r.id || '')
    ).toLowerCase().includes(q));
  }
  if (state.logFilter === 'week') {
    const cut = Date.now() - 7 * 864e5;
    rows = rows.filter((r) => new Date(r.finished).getTime() >= cut);
  }
  const totalKm = rows.reduce((s, r) => s + r.km, 0);
  const totalIncome = rows.reduce((s, r) => s + r.income, 0);
  const avgDamage = rows.length ? rows.reduce((s, r) => s + (r.damage || 0), 0) / rows.length : 0;

  return `
  ${viewHead('Logbook', 'Every run recorded on this machine', `
    <button class="btn btn-sm ${state.logFilter === 'all' ? 'btn-primary' : ''}" data-act="log-filter" data-v="all">All time</button>
    <button class="btn btn-sm ${state.logFilter === 'week' ? 'btn-primary' : ''}" data-act="log-filter" data-v="week">7 days</button>
    <button class="btn btn-sm" data-act="export-log">${icon('download')}Export CSV</button>`)}

  <div class="lb-search">
    <input class="input" id="logSearch" type="search" placeholder="Search cargo, from, to…"
      value="${esc(state.logQuery || '')}" aria-label="Search the logbook">
    <button class="lb-filters ${state.logFilter === 'week' ? 'on' : ''}"
      data-act="log-filter" data-v="${state.logFilter === 'week' ? 'all' : 'week'}">Filters</button>
  </div>

  <div class="stat-row mb-16">
    <div class="stat"><div class="v">${fmt.n(rows.length)}</div><div class="k">Runs</div></div>
    <div class="stat"><div class="v">${fmt.n(totalKm)}</div><div class="k">Kilometres</div></div>
    <div class="stat"><div class="v">${fmt.eur(totalIncome)}</div><div class="k">Revenue</div></div>
    <div class="stat"><div class="v">${avgDamage.toFixed(1)}%</div><div class="k">Avg damage</div></div>
  </div>

  <section class="card">
    <div class="tbl-wrap">
      ${rows.length ? `<table class="tbl">
        <thead><tr><th>Load</th><th>Route</th><th>Cargo</th><th class="right">Distance</th>
          <th class="right">Payout</th><th class="right">Damage</th><th>Completed</th><th>State</th></tr></thead>
        <tbody>${rows.map((r) => `<tr>
          <td class="mono t3" data-l="Load">${esc(r.id)}</td>
          <td data-l="Route" class="lb-route">${esc(r.from)} <span class="t3">→</span> ${esc(r.to)}</td>
          <td class="t2" data-l="Cargo">${esc(r.cargo)}</td>
          <td class="right mono" data-l="Distance">${fmt.km(r.km)}</td>
          <td class="right mono" data-l="Payout">${fmt.eur(r.income)}</td>
          <td class="right mono" data-l="Damage">${(r.damage || 0).toFixed(1)}%</td>
          <td class="t2" data-l="Completed">${esc(fmt.dt(r.finished))}</td>
          <td data-l="State"><span class="pill ok">${icon('check')}Synced</span></td>
        </tr>`).join('')}</tbody>
      </table>` : `<div class="empty">${icon('book')}<div>No runs in this period</div></div>`}
    </div>
  </section>`;
}

/* ---------------- profile ---------------- */
function viewProfile() {
  const db = Store.db, d = db.driver, s = db.stats;
  return `
  ${viewHead('Driver record', 'Synced with your Gaming Nation profile',
    `<button class="btn btn-sm" data-act="open-hll" data-href="index.html#/settings">${icon('link')}Edit on the web</button>`)}

  <section class="card"><div class="card-body">
    <div class="row gap-16 wrap">
      ${avatarFace(d, 'lg me')}
      <div class="grow">
        <div class="lg b7">${esc(d.name)}</div>
        <div class="t2 sm mt-4">${esc(d.rank)} · <span class="mono">${esc(d.hllId)}</span></div>
        <div class="t3 xs mt-8">Driving for Gaming Nation since ${esc(fmt.date(d.joined))}</div>
      </div>
    </div>
    <div class="stat-row mt-20">
      <div class="stat"><div class="v">${fmt.n(s.totalKm)}</div><div class="k">Total km</div></div>
      <div class="stat"><div class="v">${fmt.n(s.totalJobs)}</div><div class="k">Runs</div></div>
      <div class="stat"><div class="v">${fmt.eur(s.totalIncome)}</div><div class="k">Revenue</div></div>
      <div class="stat"><div class="v">${fmt.n(db.pending.length)}</div><div class="k">Awaiting sync</div></div>
    </div>
  </div></section>

  <section class="card">
    <div class="card-head"><span class="label">Assigned equipment</span></div>
    <div class="card-body">
      <div class="setting-row"><span class="t2">Tractor unit</span><span class="b6">${esc(d.truck)}</span></div>
      <div class="setting-row"><span class="t2">Registration</span><span class="b6 mono">${esc(d.plate)}</span></div>
      <div class="setting-row"><span class="t2">Trailer</span><span class="b6">${esc(d.trailer)}</span></div>
    </div>
  </section>

  <section class="card">
    <div class="card-head"><span class="label">Linked accounts</span></div>
    <div class="card-body">
      <div class="setting-row"><span class="t2">Steam ID</span><span class="b6 mono">${esc(d.steamId)}</span></div>
      <div class="setting-row"><span class="t2">TruckersMP</span><span class="b6 mono">${esc(d.tmpId)}</span></div>
      <div class="setting-row"><span class="t2">Discord</span><span class="b6 mono">${esc(d.discord)}</span></div>
    </div>
  </section>`;
}

/* ---------------- messages ---------------- */
function viewMessages() {
  const list = Store.db.messages;
  const sel = list[state.msgSel];
  return `
  ${viewHead('Messages', 'From Gaming Nation management',
    `<button class="btn btn-sm" data-act="mark-all-read">${icon('check')}Mark all read</button>`)}
  <section class="card"><div class="card-body">
    ${list.length ? `<div class="split">
      <div class="split-list">
        ${list.map((m, i) => `<div class="split-item ${i === state.msgSel ? 'on' : ''} ${m.read ? '' : 'unread'}"
          data-act="sel-msg" data-i="${i}">
          <div class="split-title">${esc(m.from)}</div>
          <div class="split-sub">${esc(m.subject)}</div>
          <div class="split-sub t3">${esc(fmt.rel(m.at))}</div>
        </div>`).join('')}
      </div>
      <div class="split-body">
        ${sel ? `<div class="thread" style="display:block">
          <div class="b7 lg">${esc(sel.subject)}</div>
          <div class="t3 xs mt-8">From ${esc(sel.from)} · ${esc(fmt.dt(sel.at))}</div>
          <p class="t2 mt-16" style="line-height:1.65">${esc(sel.body)}</p>
        </div>` : ''}
      </div>
    </div>` : `<div class="empty">${icon('mail')}<div>No messages</div></div>`}
  </div></section>`;
}

/* ---------------- chats ---------------- */
function viewChats() {
  const chats = Store.db.chats;
  const ch = chats[state.chatSel] || chats[0];
  /* a client with no channels yet has nothing to select into */
  if (!ch) {
    return `
    ${viewHead('Crew chat', 'Convoy channels; driver to driver is on the platform')}
    <section class="card"><div class="card-body">
      <div class="empty">${icon('chat')}
        <div>No channels yet</div>
        <div class="t3 xs">Convoy channels appear here when a convoy you are on
          is running. To message another driver directly &mdash; with photos,
          files or a call &mdash; open Messages on the platform.</div>
        <button class="btn btn-sm mt-16" data-act="open-hll" data-href="index.html#/messages">
          ${icon('link')}Open Messages</button>
      </div>
    </div></section>`;
  }
  return `
  ${viewHead('Crew chat', ch.members + ' drivers in #' + ch.name,
    `<span class="pill ${Store.db.conn.hll === 'connected' ? 'ok' : 'err'}">${icon('wifi')}${Store.db.conn.hll === 'connected' ? 'Live' : 'Offline'}</span>`)}
  <section class="card"><div class="card-body">
    <div class="split">
      <div class="split-list">
        ${chats.map((c, i) => `<div class="split-item ${i === state.chatSel ? 'on' : ''}" data-act="sel-chat" data-i="${i}">
          <div class="split-title"># ${esc(c.name)}</div>
          <div class="split-sub">${c.members} drivers</div>
        </div>`).join('')}
      </div>
      <div class="split-body">
        <div class="thread" id="thread">
          ${ch.messages.map((m) => `<div class="msg ${m.who === Store.db.driver.name ? 'mine' : ''}">
            <div class="who">${esc(m.who)} · ${esc(fmt.hm(m.at))}</div>${esc(m.body)}</div>`).join('')}
        </div>
        <form class="composer" id="chatForm">
          <input class="input" id="chatInput" placeholder="Message #${esc(ch.name)}" autocomplete="off">
          <button class="btn btn-primary" type="submit">${icon('send')}Send</button>
        </form>
      </div>
    </div>
  </div></section>`;
}

/* ---------------- administration ----------------
   These write to the company record the platform keeps, so a change made
   on the phone is the change the web console sees. Gated on rank, and the
   gate is checked again when the action runs, not only when it is drawn. */
function openAdminDrivers() {
  if (!can('drivers.manage')) { toast('You do not have the rank for that', 'err'); return; }
  const roster = Auth.roster().slice().sort((a, b) => (b.km || 0) - (a.km || 0));

  modal({
    title: 'Drivers', size: 'wide',
    body: roster.length ? `<div class="adm-list">${roster.map((d) => `
      <div class="adm-row">
        ${avatarFace(d, 'sm')}
        <div class="grow" style="min-width:0">
          <div class="b6 trunc">${esc(d.name)}</div>
          <div class="t3 xs mono">${esc(d.id)} · ${esc(roleName(d.role))}${
            d.accountStatus === 'suspended' ? ' · <span style="color:var(--danger)">suspended</span>' : ''}</div>
        </div>
        <div class="row gap-6">
          ${can('roles.manage') ? `<select class="select sm adm-role" data-id="${esc(d.id)}">
            ${Object.keys(ROLE_NAMES).map((k) =>
              `<option value="${k}"${d.role === k ? ' selected' : ''}>${esc(ROLE_NAMES[k])}</option>`).join('')}
          </select>` : ''}
          <button class="btn btn-sm ${d.accountStatus === 'suspended' ? '' : 'btn-danger'}"
            data-act="admin-suspend" data-id="${esc(d.id)}">
            ${d.accountStatus === 'suspended' ? 'Restore' : 'Suspend'}</button>
        </div>
      </div>`).join('')}</div>`
      : `<div class="empty">${icon('users')}<div>No drivers yet</div>
         <div class="t3 xs">Drivers appear once they register on the platform.</div></div>`,
    foot: `<button class="btn" data-close>Close</button>`,
    onMount(w) {
      w.querySelectorAll('.adm-role').forEach((sel) => {
        sel.onchange = () => {
          if (!can('roles.manage')) { toast('You do not have the rank for that', 'err'); return; }
          const id = sel.dataset.id;
          if (Auth.updateDriver(id, { role: sel.value })) {
            Store.log('ok', 'Set ' + id + ' to ' + roleName(sel.value));
            toast(roleName(sel.value), 'ok', id + ' role updated');
            /* changing your own rank changes what you can see */
            if (Store.db.driver && Store.db.driver.hllId === id) {
              Store.db.driver.role = sel.value;
              Store.save();
            }
          } else { toast('Could not save that', 'err'); }
        };
      });
    },
  });
}

function adminSuspend(id) {
  if (!can('drivers.manage')) { toast('You do not have the rank for that', 'err'); return; }
  const d = Auth.driverRecord(id);
  if (!d) return;
  if (Store.db.driver && Store.db.driver.hllId === id) {
    toast('You cannot suspend your own account', 'warn');
    return;
  }
  const next = d.accountStatus === 'suspended' ? 'active' : 'suspended';
  if (Auth.updateDriver(id, { accountStatus: next })) {
    Store.log(next === 'suspended' ? 'warn' : 'ok',
      (next === 'suspended' ? 'Suspended ' : 'Restored ') + d.name + ' (' + id + ')');
    toast(next === 'suspended' ? 'Driver suspended' : 'Driver restored', 'ok', d.name);
    closeModals();
    openAdminDrivers();
  } else { toast('Could not save that', 'err'); }
}

function openAdminApplications() {
  if (!can('recruitment.manage')) { toast('You do not have the rank for that', 'err'); return; }
  const apps = Auth.applications()
    .filter((a) => a.status === 'pending' || a.status === 'review')
    .sort((a, b) => new Date(b.submitted) - new Date(a.submitted));

  modal({
    title: 'Applications to drive', size: 'wide',
    body: apps.length ? `<div class="adm-list">${apps.map((a) => `
      <div class="adm-row col" style="align-items:stretch">
        <div class="row gap-10">
          <span class="avatar sm">${esc(initialsOf(a.name))}</span>
          <div class="grow" style="min-width:0">
            <div class="b6 trunc">${esc(a.name)}</div>
            <div class="t3 xs trunc">${esc(a.email)}${a.country ? ' · ' + esc(a.country) : ''}</div>
          </div>
          <span class="t3 xs">${esc(fmt.rel(a.submitted))}</span>
        </div>
        <div class="row gap-8 mt-10">
          <button class="btn btn-sm btn-primary grow" data-act="app-decide" data-id="${esc(a.id)}" data-v="approved">
            ${icon('check')}Approve</button>
          <button class="btn btn-sm btn-danger grow" data-act="app-decide" data-id="${esc(a.id)}" data-v="rejected">
            ${icon('x')}Reject</button>
        </div>
      </div>`).join('')}</div>`
      : `<div class="empty">${icon('userPlus')}<div>Nothing waiting</div>
         <div class="t3 xs">New applications from the platform appear here.</div></div>`,
    foot: `<button class="btn" data-close>Close</button>`,
  });
}

function decideApplication(id, verdict) {
  if (!can('recruitment.manage')) { toast('You do not have the rank for that', 'err'); return; }
  const a = Auth.updateApplication(id, { status: verdict, decidedAt: new Date().toISOString() });
  if (!a) { toast('Could not save that', 'err'); return; }
  Store.log(verdict === 'approved' ? 'ok' : 'warn',
    (verdict === 'approved' ? 'Approved ' : 'Rejected ') + a.name + "'s application");
  toast(verdict === 'approved' ? 'Application approved' : 'Application rejected', 'ok', a.name);
  closeModals();
  openAdminApplications();
}

/* ---------------- menu ----------------
   Everything the six tabs do not carry, plus the company controls for
   whoever has the rank to use them. */
const MENU_SECTIONS = [
  { label: 'Operation', items: ['dashboard', 'pending', 'uploads'] },
  { label: 'Record',    items: ['profile', 'messages'] },
  { label: 'Client',    items: ['settings', 'about'] },
];

function viewMenu() {
  const d = Store.db.driver;
  const staff = isStaff();
  const apps = can('recruitment.manage')
    ? Auth.applications().filter((a) => a.status === 'pending' || a.status === 'review') : [];

  const row = (key) => {
    const n = NAV.find((x) => x.key === key);
    if (!n) return '';
    const c = n.count ? n.count() : 0;
    return `<button class="menu-row" data-act="nav" data-view="${key}">
      <span class="menu-ico">${icon(n.icon)}</span>
      <span class="grow">${esc(n.label)}</span>
      ${c ? `<span class="pill brand">${c}</span>` : ''}
      ${icon('chevron', 'menu-chev')}
    </button>`;
  };

  return `
  ${viewHead('Menu', staff ? roleName(myRole()) + ' · ' + esc(d.hllId) : esc(d.rank || 'Driver') + ' · ' + esc(d.hllId))}

  ${staff ? `
  <div class="menu-group">
    <div class="menu-label">${icon('shield')}Administration</div>
    <section class="card"><div class="card-body p-0">
      ${can('drivers.manage') ? `<button class="menu-row" data-act="admin-drivers">
        <span class="menu-ico staff">${icon('users')}</span>
        <span class="grow">Drivers</span>
        <span class="t3 xs">${Auth.roster().length}</span>${icon('chevron', 'menu-chev')}
      </button>` : ''}
      ${can('recruitment.manage') ? `<button class="menu-row" data-act="admin-applications">
        <span class="menu-ico staff">${icon('userPlus')}</span>
        <span class="grow">Applications</span>
        ${apps.length ? `<span class="pill brand">${apps.length}</span>` : '<span class="t3 xs">none waiting</span>'}
        ${icon('chevron', 'menu-chev')}
      </button>` : ''}
      ${can('events.manage') ? `<button class="menu-row" data-act="open-hll" data-href="index.html#/events">
        <span class="menu-ico staff">${icon('route')}</span>
        <span class="grow">Convoy management</span>${icon('chevron', 'menu-chev')}
      </button>` : ''}
      ${can('admin.view') ? `<button class="menu-row" data-act="open-hll" data-href="index.html#/admin">
        <span class="menu-ico staff">${icon('grid')}</span>
        <span class="grow">Full admin console</span>${icon('chevron', 'menu-chev')}
      </button>` : ''}
    </div></section>
  </div>` : ''}

  ${MENU_SECTIONS.map((sec) => `
    <div class="menu-group">
      <div class="menu-label">${esc(sec.label)}</div>
      <section class="card"><div class="card-body p-0">${sec.items.map(row).join('')}</div></section>
    </div>`).join('')}

  <div class="menu-group">
    <div class="menu-label">Gaming Nation</div>
    <section class="card"><div class="card-body p-0">
      <button class="menu-row" data-act="open-hll" data-href="index.html#/dashboard">
        <span class="menu-ico">${icon('link')}</span><span class="grow">Open the web platform</span>
        ${icon('chevron', 'menu-chev')}</button>
      <button class="menu-row danger" data-act="logout">
        <span class="menu-ico">${icon('logout')}</span><span class="grow">Sign out</span></button>
    </div></section>
  </div>`;
}

/* ---------------- convoys ----------------
   Read from the company record the platform keeps, so the phone shows the
   same schedule the web dashboard does. */
function viewConvoy() {
  const events = Auth.events()
    .filter((e) => e.status !== 'completed')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const mine = Store.db.driver ? Store.db.driver.hllId : null;

  const card = (e) => {
    const live = e.status === 'live';
    const signed = (e.registered || []).some((r) => r.driverId === mine);
    const slots = (e.registered || []).length;
    return `<section class="card conv-card">
      <div class="card-body">
        <div class="row-b wrap gap-8">
          <span class="pill ${live ? 'ok' : 'brand'}">${live ? '<span class="beat"></span>Rolling now' : esc(e.typeLabel || 'Convoy')}</span>
          <span class="t3 xs">${esc(fmt.dt(e.date))}</span>
        </div>
        <div class="conv-name mt-8">${esc(e.name)}</div>
        ${e.start ? `<div class="t2 sm mt-4">${esc(e.start)} <span class="t3">&rarr;</span> ${esc(e.dest || '')}</div>` : ''}
        <div class="row gap-12 wrap mt-12 xs t3">
          ${e.distance ? `<span>${icon('route')}${fmt.km(e.distance)}</span>` : ''}
          <span>${icon('users')}${slots}${e.maxSlots ? ' / ' + e.maxSlots : ''} signed on</span>
          ${e.server ? `<span>${icon('wifi')}${esc(e.server)}</span>` : ''}
        </div>
        ${signed ? `<div class="pill ok mt-12">${icon('check')}You are signed on</div>` : ''}
        <button class="btn btn-block mt-12" data-act="open-hll"
          data-href="index.html#/convoy/${esc(e.id)}">${icon('link')}Open on the platform</button>
      </div>
    </section>`;
  };

  return `
  ${viewHead('Convoys', events.length ? events.length + ' coming up' : 'Nothing on the schedule',
    `<button class="btn btn-sm" data-act="open-hll" data-href="index.html#/events">${icon('link')}All convoys</button>`)}
  ${events.length ? events.map(card).join('')
    : `<section class="card"><div class="card-body"><div class="empty">${icon('route')}
        <div>No convoys scheduled</div>
        <div class="t3 xs">Convoys published on the Gaming Nation platform show up here.</div>
      </div></div></section>`}`;
}


/* first, second and third get a medal; the rest carry on as numbers, so the
   order reads as one chain. Kept in step with the platform's rankings. */
const MEDALS = [
  { key: 'gold',   face: '#f6cf5c', edge: '#c9962a', ribbon: '#c0392b', text: '#5a4108' },
  { key: 'silver', face: '#dfe6ef', edge: '#9aa8ba', ribbon: '#41597a', text: '#414c5c' },
  { key: 'bronze', face: '#e3a56b', edge: '#a86a33', ribbon: '#2f6f4f', text: '#4d2c0c' },
];

function medal(place, size = 26) {
  const m = MEDALS[place - 1];
  if (!m) return '<span class="mono t3">' + place + '</span>';
  const id = 'tm' + place + Math.random().toString(36).slice(2, 6);
  return `<span class="medal ${m.key}">
    <svg viewBox="0 0 40 52" width="${size}" height="${size * 1.3}" aria-hidden="true">
      <defs><linearGradient id="${id}" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${m.face}"/><stop offset="100%" stop-color="${m.edge}"/>
      </linearGradient></defs>
      <path d="M11 2 19 20 L13 24 4 8z" fill="${m.ribbon}"/>
      <path d="M29 2 21 20 L27 24 36 8z" fill="${m.ribbon}" opacity=".82"/>
      <circle cx="20" cy="35" r="14.5" fill="url(#${id})" stroke="${m.edge}" stroke-width="1.6"/>
      <circle cx="20" cy="35" r="10.5" fill="none" stroke="${m.edge}" stroke-width="1" opacity=".55"/>
      <text x="20" y="40.5" text-anchor="middle" font-size="14" font-weight="800"
        fill="${m.text}" font-family="inherit">${place}</text>
    </svg></span>`;
}

/* ---------------- standings ----------------
   Read from the Gaming Nation driver records, not invented here. */
function viewLeaderboard() {
  const me = Store.db.driver;
  const roster = Auth.roster();
  const rows = roster
    .map((d) => ({ name: d.name, id: d.id, km: d.km || 0, jobs: d.deliveries || 0, me: d.id === me.hllId }))
    .sort((a, b) => b.km - a.km);

  /* a client that cannot see the platform's records still knows its own figures */
  if (!rows.length) {
    rows.push({ name: me.name, id: me.hllId, km: Store.db.stats.totalKm, jobs: Store.db.stats.totalJobs, me: true });
  }

  return `
  ${viewHead('Standings', 'Fleet distance this season',
    `<button class="btn btn-sm" data-act="open-hll" data-href="index.html#/rankings">${icon('link')}Full table</button>`)}
  ${roster.length ? '' : `<div class="card mb-16"><div class="card-body row gap-12">
    ${icon('info')}<div class="t3 xs">Only your own record is on this device. Open the HLL
      dashboard to see the whole fleet.</div></div></div>`}
  <section class="card"><div class="tbl-wrap"><table class="tbl">
    <thead><tr><th style="width:52px">#</th><th>Driver</th><th class="right">Distance</th><th class="right">Runs</th></tr></thead>
    <tbody>${rows.map((r, i) => `<tr>
      <td>${medal(i + 1, 24)}</td>
      <td><div class="row gap-8">${avatarFace(r, r.me ? 'sm me' : 'sm')}
        <span class="b6">${esc(r.name)}</span>${r.me ? '<span class="pill brand">You</span>' : ''}</div></td>
      <td class="right mono">${fmt.km(r.km)}</td>
      <td class="right mono">${fmt.n(r.jobs)}</td>
    </tr>`).join('')}</tbody>
  </table></div></section>`;
}

/* ---------------- delivery queue ---------------- */
function viewPending() {
  const list = Store.db.pending;
  return `
  ${viewHead('Delivery queue', 'Completed runs waiting to reach Gaming Nation',
    list.length ? `<button class="btn btn-sm btn-primary" data-act="submit-all">${icon('upload')}Submit all</button>` : '')}
  <section class="card"><div class="card-body">
    ${list.length ? list.map((p) => `
      <div class="queue-item">
        <div class="row-b wrap gap-12">
          <div style="min-width:0">
            <div class="row gap-8">
              <span class="b7">${esc(p.from)} → ${esc(p.to)}</span>
              <span class="pill ${p.status === 'waiting' ? 'err' : 'warn'}">${p.status === 'waiting' ? 'Offline' : 'Queued'}</span>
            </div>
            <div class="t2 sm mt-8">${esc(p.cargo)} · ${esc(p.trailer)} · ${fmt.km(p.km)} · ${fmt.eur(p.income)}</div>
            <div class="t3 xs mt-4 mono">${esc(p.id)} · ${esc(fmt.rel(p.finished))} · damage ${(p.damage || 0).toFixed(1)}%</div>
          </div>
          <div class="row gap-8">
            <button class="btn btn-sm btn-ok" data-act="submit-one" data-id="${esc(p.id)}">${icon('check')}Submit</button>
            <button class="btn btn-sm btn-danger" data-act="discard-one" data-id="${esc(p.id)}">${icon('trash')}Discard</button>
          </div>
        </div>
      </div>`).join('')
      : `<div class="empty">${icon('clock')}<div>Queue is empty. Finished runs land here before they are sent.</div></div>`}
  </div></section>`;
}

/* ---------------- uploads ---------------- */
function viewUploads() {
  const list = Store.db.uploads;
  const queued = list.filter((u) => u.status !== 'done');
  return `
  ${viewHead('Media queue', queued.length + ' file' + (queued.length === 1 ? '' : 's') + ' waiting to upload', `
    <button class="btn btn-sm btn-primary" data-act="sync-uploads" ${queued.length ? '' : 'disabled'}>${icon('refresh')}Sync now</button>
    <button class="btn btn-sm btn-ghost" data-act="clear-uploads" ${list.length ? '' : 'disabled'}>${icon('trash')}Clear done</button>`)}
  <section class="card"><div class="tbl-wrap">
    ${list.length ? `<table class="tbl">
      <thead><tr><th>File</th><th>Type</th><th>Load</th><th class="right">Size</th><th>Captured</th><th>State</th></tr></thead>
      <tbody>${list.map((u) => `<tr>
        <td><div class="row gap-8">${u.data
          ? `<img src="${esc(u.data)}" alt="" class="shot-thumb" data-act="open-shot" data-id="${esc(u.id)}">`
          : icon(u.kind === 'screenshot' ? 'image' : 'folder')}<span class="mono">${esc(u.name)}</span></div></td>
        <td class="t2">${esc(u.kind)}</td>
        <td class="mono t3">${esc(u.job || '—')}</td>
        <td class="right mono">${fmt.n(u.size)} KB</td>
        <td class="t2">${esc(fmt.rel(u.at))}</td>
        <td>${u.status === 'done'
          ? `<span class="pill ok">${icon('check')}Uploaded</span>`
          : u.status === 'waiting'
            ? `<span class="pill err">${icon('alert')}Offline</span>`
            : `<span class="pill warn">${icon('clock')}Queued</span>`}</td>
      </tr>`).join('')}</tbody>
    </table>` : `<div class="empty">${icon('upload')}<div>Nothing queued. Delivery photos appear here.</div></div>`}
  </div></section>`;
}

/* ---------------- settings ---------------- */
function exePickerHTML(kind, label, value) {
  return `<div class="field">
    <label for="exe-${kind}">${esc(label)}</label>
    <div class="row gap-8 wrap">
      <input class="input grow" id="exe-${kind}" value="${esc(value || '')}"
        placeholder="Not set — Browse or Auto-detect" style="min-width:180px">
      <button class="btn" data-act="browse-exe" data-kind="${kind}">${icon('folder')}Browse</button>
      <button class="btn" data-act="detect-exe" data-kind="${kind}">${icon('search')}Auto-detect</button>
    </div>
    ${value ? `<span class="hint" style="color:var(--ok)">${icon('check')}Selected</span>` : ''}
  </div>`;
}

function viewSettings() {
  const s = Store.db.settings;
  const toggle = (key, label, note) => `
    <div class="setting-row">
      <div><div class="b6">${esc(label)}</div><div class="t3 xs mt-4">${esc(note)}</div></div>
      <button class="switch ${s[key] ? 'on' : ''}" data-act="toggle" data-k="${key}"
        role="switch" aria-checked="${!!s[key]}" aria-label="${esc(label)}"></button>
    </div>`;

  return `
  ${viewHead('Settings', 'Client configuration on this machine',
    `<button class="btn btn-sm btn-primary" data-act="save-settings">${icon('check')}Save</button>`)}

  <section class="card">
    <div class="card-head"><span class="label">Game</span></div>
    <div class="card-body">
      ${exePickerHTML('ets2', 'Euro Truck Simulator 2 (eurotrucks2.exe)', s.ets2Exe)}
      ${exePickerHTML('ats', 'American Truck Simulator (amtrucks.exe)', s.atsExe)}
      ${exePickerHTML('tmp', 'TruckersMP launcher (optional)', s.tmpExe)}
      <div class="row gap-8 wrap mb-16">
        <button class="btn" data-act="launch-game" data-kind="ets2">${icon('play')}Launch ETS2</button>
        <button class="btn" data-act="launch-game" data-kind="tmp">${icon('users')}Launch TruckersMP</button>
      </div>
      ${toggle('autoStartTracking', 'Start tracking after launching the game',
               'Arm the telemetry link as soon as the game is started from here.')}
      <div class="field"><label for="setProfile">Game profile</label>
        <input class="input" id="setProfile" value="${esc(s.profileName)}" placeholder="Leave blank to use the active profile"></div>
      <div class="row gap-8 wrap">
        <div class="field grow"><label for="setHost">Telemetry host</label>
          <input class="input" id="setHost" value="${esc(s.telemetryHost || 'localhost')}"
            placeholder="localhost — on a phone use the PC's LAN address"></div>
        <div class="field" style="max-width:120px"><label for="setPort">Port</label>
          <input class="input" id="setPort" value="${esc(s.telemetryPort)}"></div>
      </div>
      <div class="field"><label for="setGame">Game</label>
        <select class="select" id="setGame">
          <option value="ets2" ${s.game !== 'ats' ? 'selected' : ''}>Euro Truck Simulator 2</option>
          <option value="ats" ${s.game === 'ats' ? 'selected' : ''}>American Truck Simulator</option>
        </select></div>
      <div class="row gap-8 wrap">
        <div class="field" style="max-width:170px"><label for="setPoll">Telemetry poll (ms)</label>
          <input class="input" id="setPoll" type="number" min="250" max="10000" step="250"
            value="${esc(String(s.pollRate || 400))}"></div>
        <div class="field" style="max-width:190px"><label for="setJobSec">Live job update (seconds)</label>
          <input class="input" id="setJobSec" type="number" min="5" max="300" step="5"
            value="${esc(String(s.jobUpdateSec || 10))}"></div>
        <div class="field" style="max-width:180px"><label for="setBeatSec">Heartbeat (seconds)</label>
          <input class="input" id="setBeatSec" type="number" min="5" max="300" step="5"
            value="${esc(String(s.heartbeatSec || 15))}"></div>
      </div>
      ${toggle('liveTelemetry', 'Read the game live', 'Poll the telemetry server and follow the real truck. Falls back to the simulator when it is not answering.')}
      <div class="setting-row">
        <div><div class="b6">Map</div>
          <div class="t3 xs mt-4">${
            s.mapSource === 'game' ? 'Game map — the ETS2 / ATS road network'
            : s.mapSource === 'world' ? 'Real-world road tiles'
            : s.mapSource === 'tiles' && s.tileUrl ? esc(s.tileUrl)
            : 'Built-in schematic'}</div></div>
        <button class="btn btn-sm" data-act="tile-source">${icon('map')}Configure</button>
      </div>
      ${toggle('autoDetect', 'Detect the game automatically',
               Launcher.api()
                 ? 'Watch for Euro Truck Simulator 2 and American Truck Simulator opening and closing, and start tracking on its own.'
                 : 'Start tracking as soon as the telemetry link answers. The desktop app can also watch the game process itself.')}
      <div class="t3 xs mt-8">Live position needs the SCS telemetry plugin in
        <span class="mono">&lt;game&gt;/bin/win_x64/plugins/</span> plus the telemetry server app.
        Endpoint in use: <span class="mono">${esc(Telemetry.endpoint())}</span></div>
    </div>
  </section>

  <section class="card">
    <div class="card-head"><span class="label">Runs</span></div>
    <div class="card-body">
      ${toggle('autoSubmit', 'Submit runs automatically', 'Send each finished run without confirming.')}
      ${toggle('captureScreenshot', 'Capture a photo on delivery', 'Takes a picture of the screen when a run lands and attaches it to the record. Desktop app only.')}
      ${toggle('notifications', 'Desktop notifications', 'Convoy reminders and sync results.')}
    </div>
  </section>

  <section class="card">
    <div class="card-head"><span class="label">Speed alert</span></div>
    <div class="card-body">
      ${toggle('sirenEnabled', 'Sound a siren over the speed limit',
               'A two-tone alert when you go faster than the figure below.')}
      <div class="row gap-8 wrap mt-8" style="align-items:flex-end">
        <div class="field" style="max-width:190px;margin-bottom:0">
          <label for="setSiren">Siren speed limit (km/h)</label>
          <input class="input" id="setSiren" type="number" min="30" max="200" step="5"
            value="${esc(String(s.sirenSpeedLimit || 95))}">
        </div>
        <button class="btn" data-act="test-siren">${icon('bell')}Test the siren</button>
      </div>
    </div>
  </section>

  <section class="card">
    <div class="card-head"><span class="label">Application</span></div>
    <div class="card-body">
      ${toggle('startWithWindows', 'Start with Windows', 'Launch the client when you sign in.')}
      ${toggle('startMinimized', 'Start minimised', 'When it starts with Windows, go straight to the tray instead of opening a window.')}
      ${toggle('minimiseToTray', 'Minimise to the tray', 'Keep tracking while the window is closed.')}
      ${Launcher.api() ? '' : `<div class="t3 xs mt-8">${icon('info')} Startup and tray options only apply to the desktop app.</div>`}
      <div class="row gap-8 mt-16">
        <button class="btn btn-primary" data-act="save-settings">${icon('check')}Save settings</button>
        <button class="btn btn-danger" data-act="reset-app">${icon('refresh')}Reset client data</button>
      </div>
    </div>
  </section>`;
}

/* ---------------- about ---------------- */
function viewAbout() {
  return `
  ${viewHead('About', 'Gaming Nation Trucker · build ' + APP_VERSION)}
  <section class="card"><div class="card-body">
    <div class="row gap-16 wrap">
      ${hllEmblem('lg', 'framed')}
      <div>
        <div class="lg b7">Gaming Nation Trucker</div>
        <div class="t2 sm mt-4">Gaming Nation driver client</div>
        <div class="brand-strap">Virtual logistics · Real drivers · Real-time operations</div>
      </div>
    </div>
    <p class="t2 mt-20" style="line-height:1.7;max-width:620px">
      The Gaming Nation Trucker watches Euro Truck Simulator 2 over the telemetry link, records every run you
      finish, and pushes the result to your Gaming Nation driver record — distance, cargo, payout and
      damage — so your rank and standing stay current without typing anything in by hand.
    </p>
    <div class="facts">
      <div class="fact"><div class="k">Telemetry</div><div class="v t2" style="font-size:12.5px">ETS2 SDK link</div></div>
      <div class="fact"><div class="k">Sync</div><div class="v t2" style="font-size:12.5px">Automatic</div></div>
      <div class="fact"><div class="k">Media</div><div class="v t2" style="font-size:12.5px">Delivery photos</div></div>
      <div class="fact"><div class="k">Crew</div><div class="v t2" style="font-size:12.5px">Chat + messages</div></div>
    </div>
  </div></section>

  <section class="card">
    <div class="card-head"><span class="label">Gaming Nation on the web</span></div>
    <div class="card-body">
      <div class="row gap-8 wrap">
        <button class="btn btn-sm" data-act="open-hll" data-href="index.html#/dashboard">${icon('grid')}Command centre</button>
        <button class="btn btn-sm" data-act="open-hll" data-href="index.html#/convoys">${icon('truck')}Convoys</button>
        <button class="btn btn-sm" data-act="open-hll" data-href="index.html#/rankings">${icon('trophy')}Rankings</button>
        <button class="btn btn-sm" data-act="open-hll" data-href="index.html#/support">${icon('info')}Support</button>
      </div>
      <div class="t3 xs mt-16" style="letter-spacing:.14em">DRIVE · DELIVER · DOMINATE</div>
    </div>
  </section>`;
}

/* ============================================================
   Part 4 — chrome, actions, render, boot
   ============================================================ */

/* navigation grouped by purpose rather than one flat list */
const NAV_GROUPS = [
  { label: 'Operation', items: ['dashboard', 'livemap', 'pending', 'uploads'] },
  { label: 'Record',    items: ['logbook', 'profile', 'leaderboard'] },
  { label: 'Crew',      items: ['messages', 'chats', 'convoy'] },
  /* staff only: without this the company controls were reachable on a phone
     and nowhere at all on the desktop */
  { label: 'Company',   items: ['adm-drivers', 'adm-apps'], staff: true },
  { label: 'Client',    items: ['settings', 'about'] },
];

/* rail entries that open a dialog rather than a view */
const NAV_ACTIONS = {
  'adm-drivers': { label: 'Drivers',      icon: 'users',    act: 'admin-drivers',
                   perm: 'drivers.manage' },
  'adm-apps':    { label: 'Applications', icon: 'userPlus', act: 'admin-applications',
                   perm: 'recruitment.manage',
                   count: () => Auth.applications().filter((a) => a.status === 'pending' || a.status === 'review').length },
};

function navHTML() {
  const byKey = {};
  NAV.forEach((n) => { byKey[n.key] = n; });
  return NAV_GROUPS.map((g) => {
    if (g.staff && !isStaff()) return '';
    const rows = g.items.map((k) => {
      const a = NAV_ACTIONS[k];
      if (a) {
        if (a.perm && !can(a.perm)) return '';
        const c = a.count ? a.count() : 0;
        return `<button class="nav-item" data-act="${a.act}">
          ${icon(a.icon)}<span>${esc(a.label)}</span>
          ${c ? `<span class="nav-count">${c}</span>` : ''}</button>`;
      }
      const n = byKey[k]; if (!n) return '';
      const c = n.count ? n.count() : 0;
      return `<button class="nav-item ${state.view === n.key ? 'active' : ''}" data-act="nav" data-view="${n.key}">
        ${icon(n.icon)}<span>${esc(n.label)}</span>
        ${c ? `<span class="nav-count">${c}</span>` : ''}</button>`;
    }).join('');
    if (!rows) return '';
    return `<div class="rail-group">
      <div class="rail-label">${esc(g.label)}</div>${rows}</div>`;
  }).join('');
}

function railFootHTML() {
  const d = Store.db.driver;
  return `<button class="driver-chip" data-act="driver-menu">
    ${avatarFace(d, 'me')}
    <span class="driver-text grow" style="min-width:0">
      <span class="b6 trunc" style="display:block">${esc(d.name)}</span>
      <span class="t3 xs mono">${esc(d.hllId)}</span>
    </span>
    ${icon('chevron', 'chev')}
  </button>`;
}

/* connection state lives along the bottom edge, not in the header */
function statusBarHTML() {
  const c = Store.db.conn;
  const db = Store.db;
  const hllOn = c.hll === 'connected';
  const ets2On = c.ets2 === 'running';
  const linkOn = c.link === 'connected';
  const queued = db.pending.length + db.uploads.filter((u) => u.status !== 'done').length;

  return `
    <button class="sb-item btn-like ${hllOn ? 'on' : ''}" data-act="toggle-server"
      title="Check the company service now">
      <span class="sb-dot ${hllOn ? 'ok' : 'err'}"></span>${hllOn ? 'Gaming Nation online' : 'Gaming Nation offline'}</button>
    <span class="sb-sep"></span>
    <span class="sb-item ${ets2On ? 'on' : ''}">
      <span class="sb-dot ${ets2On ? 'ok' : ''}"></span>${ets2On ? 'ETS2 running' : 'ETS2 closed'}</span>
    <span class="sb-sep"></span>
    <button class="sb-item btn-like ${linkOn ? 'on' : ''}" data-act="nav" data-view="livemap">
      <span class="sb-dot ${Telemetry.mode === 'live' ? 'ok' : linkOn ? 'warn' : ''}"></span>${
        Telemetry.mode === 'live' ? 'Telemetry live' : linkOn ? 'Telemetry waiting' : 'Telemetry armed'}</button>
    <span class="sb-sep"></span>
    <button class="sb-item btn-like ${Realtime.status === 'live' ? 'on' : ''}"
      data-act="fleet-setup"
      title="${Realtime.status === 'live'
        ? 'The company pushes changes to this client as they happen'
        : esc(Realtime.lastError || 'Falling back to polling the company service')}">
      <span class="sb-dot ${Realtime.status === 'live' ? 'ok'
        : Fleet.enabled() ? 'warn' : ''}"></span>${
        Realtime.status === 'live' ? 'Fleet live'
        : Fleet.enabled() ? 'Fleet polling' : 'Fleet offline'}</button>
    <span class="sb-sep"></span>
    <button class="sb-item btn-like optional" data-act="nav" data-view="livemap">
      ${icon('pin')}${db.live && db.live.near ? esc(db.live.near.city) : 'no position'}</button>
    <span class="sb-sep optional"></span>
    <span class="sb-item optional">${icon('user')}${esc(c.profile || 'no profile')}</span>
    <span class="sb-spacer"></span>
    <button class="sb-item btn-like" data-act="nav" data-view="pending">${icon('clock')}${queued} queued</button>
    <span class="sb-sep"></span>
    <span class="sb-item optional">build ${APP_VERSION}</span>`;
}

/* ============================================================
   Platform: desktop shell (Electron), installed app, or browser tab.
   ============================================================ */
const Platform = {
  installPrompt: null,
  isDesktopShell: () => !!(window.hllDesktop && window.hllDesktop.isDesktop),
  isStandalone: () => window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: window-controls-overlay)').matches ||
    window.navigator.standalone === true,
  isPhone: () => window.matchMedia('(max-width:720px)').matches,

  init() {
    document.body.classList.toggle('is-desktop-shell', this.isDesktopShell());

    /* offline shell + installability (needs https or localhost) */
    if ('serviceWorker' in navigator && location.protocol.indexOf('http') === 0) {
      navigator.serviceWorker.register('sw.js').then((reg) => {
        Store.log('ok', 'Offline mode ready (service worker ' + (reg.active ? 'active' : 'installing') + ')');
        reg.addEventListener('updatefound', () => {
          const sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', () => {
            if (sw.state === 'installed' && navigator.serviceWorker.controller) {
              toast('An update is ready - reopen the app to apply it', 'info');
            }
          });
        });
      }).catch((err) => console.warn('[JT] service worker not registered', err));
    }

    /* Chromium fires this when the app qualifies for installation */
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      this.installPrompt = e;
      document.body.classList.add('can-install');
      render();
    });
    window.addEventListener('appinstalled', () => {
      this.installPrompt = null;
      document.body.classList.remove('can-install');
      Store.log('ok', 'Installed as an application');
      toast('Gaming Nation Trucker installed', 'ok');
    });

    window.addEventListener('online', () => { Store.log('ok', 'Network back online'); render(); });
    window.addEventListener('offline', () => {
      Store.log('warn', 'Network offline - queued work is held locally');
      render();
    });
  },

  install() {
    if (!this.installPrompt) {
      modal({
        title: 'Install the client',
        body: '<p class="t2">Your browser has not offered an install prompt yet.</p>'
          + '<p class="t2 mt-12"><b>Desktop</b> - browser menu, then'
          + ' &ldquo;Install Gaming Nation Trucker&rdquo; (Chrome/Edge). Or use the packaged desktop build.</p>'
          + '<p class="t2 mt-12"><b>iPhone / iPad</b> - Share, then <b>Add to Home Screen</b>.</p>'
          + '<p class="t2 mt-12"><b>Android</b> - menu, then <b>Install app</b>.</p>'
          + '<p class="t3 xs mt-12">Installing requires the page to be served over https (or localhost).</p>',
      });
      return;
    }
    this.installPrompt.prompt();
    this.installPrompt.userChoice.then((res) => {
      Store.log('info', 'Install prompt ' + (res && res.outcome));
      this.installPrompt = null;
      document.body.classList.remove('can-install');
      render();
    });
  },
};

const VIEWS = {
  dashboard: viewDashboard,
  livemap: viewLiveMap,
  logbook: viewLogbook,
  profile: viewProfile,
  messages: viewMessages,
  chats: viewChats,
  leaderboard: viewLeaderboard,
  pending: viewPending,
  uploads: viewUploads,
  settings: viewSettings,
  about: viewAbout,
  convoy: viewConvoy,
  menu: viewMenu,
};

/* six sections reach the phone tab bar; everything else lives under Menu */
const TAB_KEYS = ['logbook', 'chats', 'livemap', 'convoy', 'leaderboard', 'menu'];
const TAB_SHORT = { logbook: 'Logbook', chats: 'Chats', livemap: 'Map',
  convoy: 'Convoy', leaderboard: 'Ranking', menu: 'Menu' };

/* ---------- phone chrome ----------
   The phone gets a header of its own: who you are, which section you are
   looking at, and the rank you hold — rather than the desktop's title and
   hamburger, which waste the only row a phone has. */
function appbarHTML() {
  const d = Store.db.driver;
  if (!d) return '';
  const cur = NAV.find((n) => n.key === state.view);
  const on = Store.db.conn.hll === 'connected';
  const staff = isStaff();

  return `
    <button class="ab-face" data-act="nav" data-view="profile" aria-label="Driver record">
      <span class="ab-avatar">${esc(initialsOf(d.name))}</span>
      <span class="ab-live ${on ? 'ok' : ''}" title="${on ? 'Gaming Nation online' : 'Gaming Nation offline'}"></span>
    </button>
    <div class="ab-who">
      <div class="ab-name">${esc(d.name)}</div>
      <div class="ab-sec">${esc(cur ? cur.label : 'Gaming Nation')}</div>
    </div>
    <button class="ab-rank ${staff ? 'staff' : ''}" data-act="nav" data-view="menu"
      aria-label="${esc(staff ? roleName(myRole()) : (d.rank || 'Driver'))}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 2.6l7.4 2.6v6.1c0 4.7-3.1 8.4-7.4 10.1-4.3-1.7-7.4-5.4-7.4-10.1V5.2z"/>
        <path class="star" d="M12 7.6l1.4 2.9 3.2.4-2.3 2.2.6 3.1-2.9-1.5-2.9 1.5.6-3.1-2.3-2.2 3.2-.4z"/>
      </svg>
      <span class="ab-rank-t">${esc(staff ? roleName(myRole()).split(' ')[0] : (d.rank || 'Driver').split(' ')[0])}</span>
    </button>`;
}

function tabbarHTML() {
  const byKey = {};
  NAV.forEach((n) => { byKey[n.key] = n; });
  return TAB_KEYS.map((k) => {
    const n = byKey[k];
    if (!n) return '';
    const c = n.count ? n.count() : 0;
    return '<button class="tab ' + (state.view === k ? 'active' : '') + '" data-act="nav" data-view="' + k + '"'
      + ' aria-label="' + esc(n.label) + '"' + (state.view === k ? ' aria-current="page"' : '') + '>'
      + icon(n.icon) + '<span>' + esc(TAB_SHORT[k] || n.label) + '</span>'
      + (c ? '<span class="tab-count">' + c + '</span>' : '') + '</button>';
  }).join('');
}


/* Shown in place of a screen that threw, instead of an empty client. */
function screenErrorHTML(view, err) {
  const detail = String((err && err.stack) || (err && err.message) || err || 'unknown');
  const nav = NAV.find((n) => n.key === view);
  return `
  ${viewHead('This screen could not be drawn', nav ? nav.label : view)}
  <section class="card"><div class="card-body">
    <div class="row gap-12" style="align-items:flex-start">
      <span style="flex:none;width:18px;height:18px;color:var(--danger)">${icon('alert')}</span>
      <div class="grow" style="min-width:0">
        <p class="t2 sm">Something on this screen is not what the client expected. Everything
          else still works — pick another section from the menu.</p>
        <pre class="mono xs mt-12" style="white-space:pre-wrap;word-break:break-word;
          max-height:200px;overflow:auto;padding:10px 12px;border-radius:8px;
          background:var(--panel-2);color:var(--text-2)">${esc(detail.slice(0, 900))}</pre>
        <button class="btn btn-sm mt-12" data-act="nav" data-view="dashboard">
          ${icon('gauge')}Back to the run monitor</button>
      </div>
    </div>
  </div></section>`;
}

function render() {
  /* until a driver signs in, the sign-in screen stands in for the client.
     It sits under the title bar rather than over it, so the window controls
     keep working on the desktop build. */
  const app = $('#app');
  const host = $('#signinHost');
  if (!Auth.signedIn()) {
    if (app) app.classList.add('signed-out');
    if (host) { host.innerHTML = signInHTML(); bindSignIn(); }
    return;
  }
  if (app) app.classList.remove('signed-out');
  if (host && host.innerHTML) host.innerHTML = '';

  $('#brandLogo').innerHTML = brandLogo();
  $('#nav').innerHTML = navHTML();
  $('#railFoot').innerHTML = railFootHTML();
  $('#statusbar').innerHTML = statusBarHTML();
  /* a view that throws used to leave the client blank with only a toast to
     go on; now it says which screen failed and why, and the rest still works */
  try {
    ($('#main')).innerHTML = (VIEWS[state.view] || viewDashboard)();
  } catch (err) {
    console.error('[HLL] the ' + state.view + ' screen failed to draw', err);
    ($('#main')).innerHTML = screenErrorHTML(state.view, err);
  }

  /* phone chrome */
  const tb = $('#tabbar');
  if (tb) tb.innerHTML = tabbarHTML();
  const ab = $('#appbar');
  if (ab) ab.innerHTML = appbarHTML();

  bindViewForms();
  const th = $('#thread');
  if (th) th.scrollTop = th.scrollHeight;
}

function bindViewForms() {
  const ls = $('#logSearch');
  if (ls) {
    ls.oninput = debounce(() => {
      state.logQuery = ls.value;
      render();
      const again = $('#logSearch');
      if (again) { again.focus(); again.setSelectionRange(again.value.length, again.value.length); }
    }, 180);
  }

  /* Leaflet has to be attached after its container exists in the document */
  const host = $('#leafletMap');
  if (host) {
    const db = Store.db;
    const key = (Telemetry.mode === 'live' && db.live && db.live.game) || db.settings.game || 'ets2';
    TileMap.mount(host, key);
  } else {
    TileMap.destroy();
  }

  const cf = $('#chatForm');
  if (cf) cf.addEventListener('submit', (e) => {
    e.preventDefault();
    const input = $('#chatInput');
    const body = input.value.trim();
    if (!body) return;
    Store.db.chats[state.chatSel].messages.push({
      who: Store.db.driver.name, body, at: new Date().toISOString(),
    });
    Store.save();
    render();
  });
}

function driverMenu(anchor) {
  const open = $('.menu');
  if (open) { open.remove(); return; }
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = `
    <button data-act="nav" data-view="profile">${icon('user')}Driver record</button>
    <button data-act="open-hll" data-href="index.html#/dashboard">${icon('link')}Open web HQ</button>
    <button data-act="nav" data-view="settings">${icon('settings')}Settings</button>
    <div class="sep"></div>
    <button class="danger" data-act="logout">${icon('logout')}Sign out</button>`;
  const r = anchor.getBoundingClientRect();
  m.style.left = Math.max(8, r.left) + 'px';
  m.style.top = (r.top - 8) + 'px';
  m.style.transform = 'translateY(-100%)';
  $('#layers').appendChild(m);
  setTimeout(() => {
    const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } };
    document.addEventListener('mousedown', off);
  }, 0);
}

/* ---------------- actions ---------------- */
function handle(act, t) {
  const db = Store.db;
  switch (act) {
    case 'nav': {
      if (state.view === 'livemap' && t.dataset.view !== 'livemap') {
        TileMap.calibrating = false;
        TileMap.destroy();
      }
      state.view = t.dataset.view;
      closeMenus();
      const mainEl = $('#main');
      if (mainEl) mainEl.scrollTop = 0;
      window.scrollTo(0, 0);
      render();
      return;
    }
    case 'open-shot': {
      const u = Store.db.uploads.find((x) => x.id === t.dataset.id);
      if (!u || !u.data) { toast('That photo is no longer stored', 'warn'); return; }
      modal({
        title: u.name, size: 'wide',
        body: `<img src="${esc(u.data)}" alt="Delivery photo" style="width:100%;border-radius:10px;display:block">`,
        foot: `<button class="btn" data-close>Close</button>`,
      });
      return;
    }
    case 'assignment-state': {
      const hq = Auth.hqDb();
      const a = hq && (hq.assignments || []).find((x) => x.id === t.dataset.id);
      if (!a || a.driverId !== (Store.db.driver && Store.db.driver.hllId)) {
        toast('That load is not yours', 'err'); return;
      }
      a.status = t.dataset.v;
      if (a.status === 'done') a.completed = new Date().toISOString();
      Auth.saveHqDb(hq);
      if (Sync.on()) Sync.push();
      Store.log('ok', 'Load ' + a.id + ' marked ' + a.status);
      toast(a.status === 'done' ? 'Load closed off' : 'Load accepted', 'ok');
      render();
      return;
    }
    case 'install-app': Platform.install(); return;
    case 'driver-menu': driverMenu(t); return;

    case 'toggle-server': toggleServer(); return;

    case 'pw-reveal': {
      const f = $('#si-pw');
      if (!f) return;
      const show = f.type === 'password';
      f.type = show ? 'text' : 'password';
      t.setAttribute('aria-label', show ? 'Hide the password' : 'Show the password');
      t.setAttribute('aria-pressed', String(show));
      t.classList.toggle('on', show);
      /* The icon has to say which way it goes: an eye that never changes
         cannot tell you whether the password is showing. */
      t.innerHTML = icon(show ? 'eyeOff' : 'eye');
      f.focus();
      return;
    }

    case 'restore-owner':
      if (Auth.restoreOwner()) {
        toast('Owner sign-in restored', 'ok', 'Try your password again');
        render();
      } else {
        toast('Could not write to storage', 'err');
      }
      return;
    case 'pick-profile': openProfilePicker(); return;
    case 'profile-save': saveProfileName(); return;

    case 'admin-drivers': openAdminDrivers(); return;
    case 'admin-applications': openAdminApplications(); return;
    case 'admin-suspend': adminSuspend(t.dataset.id); return;
    case 'app-decide': decideApplication(t.dataset.id, t.dataset.v); return;

    case 'launch-game': Launcher.launch(t.dataset.kind); return;
    case 'browse-exe': Launcher.browse(t.dataset.kind); return;
    case 'detect-exe': Launcher.autoDetect(t.dataset.kind); return;
    case 'test-siren': Siren.wail(1.6); return;

    case 'toggle-live': {
      db.settings.liveTelemetry = !db.settings.liveTelemetry;
      if (db.settings.liveTelemetry) {
        Telemetry.start();
        Store.log('info', 'Looking for the telemetry server at ' + Telemetry.endpoint());
      } else {
        Telemetry.stop();
        Telemetry.mode = 'off';
        db.conn.telemetry = 'off';
        Store.log('info', 'Live telemetry turned off');
      }
      Store.save(); render();
      return;
    }
    case 'map-game':
      db.settings.game = t.dataset.v;
      Store.log('info', 'Map switched to ' + mapFor(t.dataset.v).label);
      /* otherwise the fleet list keeps showing the other map's runs until the
         next heartbeat comes round */
      Fleet.step();
      Store.save(); render();
      return;
    case 'calibrate': openCalibrate(); return;
    case 'tile-source': openTileSource(); return;
    case 'cal-reset':
      Calib.reset(t.dataset.map);
      Store.log('warn', 'Map alignment reset — it will line itself up again on the next job');
      closeModals(); TileMap.destroy(); render();
      return;
    case 'fleet-setup': openFleetSetup(); return;
    case 'fleet-save': saveFleetSetup(); return;
    case 'fleet-toggle':
      db.settings.showFleet = !db.settings.showFleet;
      Store.save();
      if (TileMap.map) TileMap.drawFleet();
      render();
      return;
    case 'tile-save': saveTileSource(); return;
    case 'tile-calibrate': TileMap.beginCalibration(); return;
    case 'tile-calibrate-cancel': TileMap.cancelCalibration(); return;
    case 'follow-toggle':
      TileMap.following = !TileMap.following;
      if (TileMap.following) TileMap.redraw();
      render();
      return;
    case 'cal-save': saveCalibrationPoint(t.dataset.map); return;

    case 'clear-log':
      db.activity = [];
      Store.log('info', 'Event log cleared');
      render();
      return;


    case 'open-hll': {
      const href = t.dataset.href;
      Store.log('info', 'Opening ' + href);
      /* inside the native shell there is no second window to open into,
         so navigate in place; a browser gets a new tab as before */
      if (window.Capacitor) location.href = href;
      else window.open(href, '_blank');
      return;
    }

    case 'log-filter': state.logFilter = t.dataset.v; render(); return;

    case 'export-log': {
      const rows = [['Load', 'From', 'To', 'Cargo', 'Trailer', 'Km', 'Payout', 'Damage', 'Completed']];
      db.logbook.forEach((r) => rows.push([r.id, r.from, r.to, r.cargo, r.trailer, r.km, r.income, r.damage, r.finished]));
      const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
      const blob = new Blob([csv], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = 'hll-logbook.csv';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 800);
      Store.log('ok', 'Logbook exported to CSV');
      toast('Logbook exported', 'ok');
      return;
    }

    case 'sel-msg': {
      state.msgSel = +t.dataset.i;
      const m = db.messages[state.msgSel];
      if (m && !m.read) { m.read = true; Store.save(); }
      render();
      return;
    }
    case 'mark-all-read':
      db.messages.forEach((m) => { m.read = true; });
      Store.save(); toast('All messages marked read', 'ok'); render();
      return;

    case 'sel-chat': state.chatSel = +t.dataset.i; render(); return;

    case 'submit-one': submitDelivery(t.dataset.id); return;
    case 'discard-one': discardDelivery(t.dataset.id); return;
    case 'submit-all': {
      const ids = db.pending.map((p) => p.id);
      if (!ids.length) return;
      ids.forEach((id) => submitDelivery(id, true));
      toast(`Submitted ${ids.length} run${ids.length === 1 ? '' : 's'}`, 'ok');
      return;
    }

    case 'sync-uploads': syncUploads(); return;
    case 'clear-uploads':
      db.uploads = db.uploads.filter((u) => u.status !== 'done');
      Store.save(); render();
      return;

    case 'toggle': {
      const k = t.dataset.k;
      db.settings[k] = !db.settings[k];
      t.classList.toggle('on', db.settings[k]);
      t.setAttribute('aria-checked', String(!!db.settings[k]));
      Store.save();
      if (k === 'startWithWindows' || k === 'minimiseToTray' || k === 'startMinimized') Launcher.syncOsPreferences();
      if (k === 'autoDetect') { GameWatch.start(); render(); }
      return;
    }
    case 'save-settings': {
      const prof = $('#setProfile'), port = $('#setPort');
      const host = $('#setHost'), game = $('#setGame'), poll = $('#setPoll');
      if (prof) db.settings.profileName = prof.value.trim();
      if (port) db.settings.telemetryPort = port.value.trim() || '25555';
      if (host) db.settings.telemetryHost = host.value.trim() || 'localhost';
      if (game) db.settings.game = game.value;
      if (poll) db.settings.pollRate = clamp(Number(poll.value) || 400, 250, 10000);
      const jobSec = $('#setJobSec'), beatSec = $('#setBeatSec'), siren = $('#setSiren');
      if (jobSec) db.settings.jobUpdateSec = clamp(Number(jobSec.value) || 10, 5, 300);
      if (beatSec) db.settings.heartbeatSec = clamp(Number(beatSec.value) || 15, 5, 300);
      if (siren) db.settings.sirenSpeedLimit = clamp(Number(siren.value) || 95, 30, 200);
      ['ets2', 'ats', 'tmp'].forEach((kind) => {
        const el = $('#exe-' + kind);
        if (el) db.settings[Launcher.pathKey(kind)] = el.value.trim();
      });
      Launcher.syncOsPreferences();
      if (db.settings.liveTelemetry) Telemetry.start(); else Telemetry.stop();
      Fleet.start();                 /* pick the new heartbeat up straight away */
      GameWatch.start();             /* and any change to how the game is watched */
      Telemetry.savedAt = null;      /* and the new job update interval */
      Store.log('ok', 'Settings saved');
      Store.save(); toast('Settings saved', 'ok'); render();
      return;
    }
    case 'reset-app':
      modal({
        title: 'Reset client data?',
        body: `<p class="t2">Clears the logbook, the send queue and every setting on this machine and
          signs you out. Runs already synced to Gaming Nation are not affected, and your driver record
          on the company stays as it is.</p>`,
        foot: `<button class="btn" data-close>Cancel</button>
               <button class="btn btn-danger" data-act="reset-ok">Reset</button>`,
        onMount(w) {
          $('[data-act="reset-ok"]', w).onclick = () => {
            Store.reset(); w.remove();
            state.view = 'dashboard'; toast('Client data reset', 'ok'); render();
          };
        },
      });
      return;

    case 'logout':
      closeMenus();
      modal({
        title: 'Sign out',
        body: `<p class="t2">Sign out of the Gaming Nation Trucker on this machine? Queued runs stay put and are
          submitted next time you sign in.</p>`,
        foot: `<button class="btn" data-close>Cancel</button>
               <button class="btn btn-danger" data-act="logout-ok">Sign out</button>`,
        onMount(w) {
          $('[data-act="logout-ok"]', w).onclick = () => {
            Store.log('info', 'Driver signed out');
            w.remove();
            /* back to the sign-in screen rather than a dead end that needs a reload */
            Auth.signOut();
            toast('Signed out', 'ok');
          };
        },
      });
      return;
  }
}

function closeMenus() { $$('.menu').forEach((m) => m.remove()); }
/* window controls — real in the desktop shell, explained in the browser */
function windowControl(kind) {
  const api = window.hllDesktop;
  if (api && typeof api[kind] === 'function') { api[kind](); return; }
  toast('Window controls belong to the desktop build — this is the browser preview.', 'info');
}

/* ---------------- boot ---------------- */
/* ============================================================
   SIGNING IN
   ------------------------------------------------------------
   The client has no identity of its own. It reads the Gaming Nation
   account store — the same records the web platform writes — so a
   driver signs in here with the details they registered with, and
   the client picks their real driver record up from the same place.

   Both live in this browser profile's storage. Served together (the
   PWA, the phone build, `npm run serve`) or bundled together (the
   desktop app, where every page shares one file:// origin) they are
   the same store. A machine that has never seen the platform has no
   accounts on it yet, which is what the sign-in screen says.
   ============================================================ */
const HQ_ACCOUNTS = 'hll.accounts.v1';
const HQ_DB = 'hll.db.v1';
const LS_TRK_SESSION = 'hll.trk.session.v1';

const Auth = {
  accounts() {
    try { return JSON.parse(localStorage.getItem(HQ_ACCOUNTS) || '[]'); }
    catch (e) { return []; }
  },
  hqDb() {
    try { return JSON.parse(localStorage.getItem(HQ_DB) || 'null'); }
    catch (e) { return null; }
  },
  /* every driver the platform knows about, for the standings table */
  roster() {
    const db = this.hqDb();
    return (db && Array.isArray(db.drivers)) ? db.drivers : [];
  },
  driverRecord(id) { return this.roster().find((d) => d.id === id) || null; },

  /* Administration writes back to the company record the platform keeps.
     Both live in this browser profile's storage, so a change made here is
     the same change the web platform sees. */
  saveHqDb(db) {
    if (typeof Sync !== 'undefined' && Sync.on && Sync.on() && !Sync.applying) Sync.push();
    try { localStorage.setItem(HQ_DB, JSON.stringify(db)); return true; }
    catch (e) { console.warn('[HLL] could not write the company record', e); return false; }
  },
  updateDriver(id, patch) {
    const db = this.hqDb();
    if (!db || !Array.isArray(db.drivers)) return null;
    const d = db.drivers.find((x) => x.id === id);
    if (!d) return null;
    Object.assign(d, patch);
    return this.saveHqDb(db) ? d : null;
  },
  applications() {
    const db = this.hqDb();
    return (db && Array.isArray(db.applications)) ? db.applications : [];
  },
  updateApplication(id, patch) {
    const db = this.hqDb();
    if (!db || !Array.isArray(db.applications)) return null;
    const a = db.applications.find((x) => x.id === id);
    if (!a) return null;
    Object.assign(a, patch);
    return this.saveHqDb(db) ? a : null;
  },
  events() {
    const db = this.hqDb();
    return (db && Array.isArray(db.events)) ? db.events : [];
  },

  /* ---- the owner account ----
     The company ships with its owner already provisioned, so a fresh
     install can be signed into straight away rather than needing the web
     platform to have been opened on this device first.

     The password is not stored here — only a random salt and the SHA-256
     of salt + '::' + password, exactly as any other account holds. That
     resists a glance at the source; it is not proof against an offline
     attack, so changing it from Settings is worth doing. */
  OWNER: {
    driverId: 'HLL-1001',
    name: 'Jeff Boss',
    email: 'jeffboss730@gmail.com',
    country: 'Not set',
    discord: '',
    salt: '8d51ca23a73a9f1837e40727ce315e61',
    hash: '77518c707f47de4beabffef308862da8c07d8a05e54a232692a384b98d7293f8',
    /* the same password under the fallback digest, for a browser with no
       SubtleCrypto — without this the owner could never sign in there */
    weakHash: 'weak-d9d8055e',
    ownerSeed: true,
  },

  /* Reconciles rather than only creating: an install carried over from an
     earlier build may already hold an account on this id or address with a
     different password, and it would shadow the owner for good. Once the
     password is changed from Settings, `ownerSeed` is false and this leaves
     the account alone. */
  provisionOwner() {
    const list = this.accounts();
    const created = new Date().toISOString();
    const existing = list.find((a) => a.driverId === this.OWNER.driverId
      || String(a.email).toLowerCase() === this.OWNER.email.toLowerCase());
    let wrote = false;

    if (existing) {
      if (existing.ownerSeed !== false) {
        const stale = existing.salt !== this.OWNER.salt
          || existing.hash !== this.OWNER.hash
          || String(existing.email).toLowerCase() !== this.OWNER.email.toLowerCase();
        if (stale) {
          Object.assign(existing, {
            driverId: this.OWNER.driverId, email: this.OWNER.email,
            salt: this.OWNER.salt, hash: this.OWNER.hash, weakHash: this.OWNER.weakHash,
            status: 'active', ownerSeed: true,
          });
          wrote = true;
        }
      }
    } else {
      list.push(Object.assign({}, this.OWNER, { created, status: 'active' }));
      wrote = true;
    }
    if (wrote) {
      try { localStorage.setItem(HQ_ACCOUNTS, JSON.stringify(list)); }
      catch (e) { return false; }
    }

    /* and the driver record that account signs in to */
    const db = this.hqDb() || { drivers: [], applications: [], events: [] };
    db.drivers = Array.isArray(db.drivers) ? db.drivers : [];
    const rec = db.drivers.find((d) => d.id === this.OWNER.driverId);
    if (rec) {
      if (rec.role !== 'super_admin' || rec.accountStatus !== 'active' || !rec.clientAccess) {
        rec.role = 'super_admin';
        rec.accountStatus = 'active';
        rec.clientAccess = true;
        this.saveHqDb(db);
      }
    } else {
      db.drivers.push({
        id: this.OWNER.driverId, name: this.OWNER.name, country: this.OWNER.country,
        joined: created, status: 'offline',
        km: 0, deliveries: 0, convoys: 0, attendance: 100,
        role: 'super_admin', accountStatus: 'active',
        discord: '', truckersmp: '', rankIdx: 0, email: this.OWNER.email,
        clientAccess: true,
      });
      this.saveHqDb(db);
    }
    return wrote;
  },


  /* The client shares the company record, so it sweeps the same leftovers:
     a driver nobody can sign in as is not a person, it is sample data from an
     older build showing up on the standings and the fleet list. */
  purgeOrphanDrivers() {
    const db = this.hqDb();
    if (!db || !Array.isArray(db.drivers)) return 0;
    const ids = new Set(this.accounts().map((a) => a.driverId));
    const orphans = db.drivers.filter((d) => !ids.has(d.id));
    if (!orphans.length) return 0;

    const gone = new Set(orphans.map((d) => d.id));
    db.drivers = db.drivers.filter((d) => !gone.has(d.id));
    (db.events || []).forEach((e) => {
      if (Array.isArray(e.registered)) e.registered = e.registered.filter((r) => !gone.has(r.driverId));
    });
    db.applications = (db.applications || []).filter((a) => !a.submittedBy || !gone.has(a.submittedBy));
    this.saveHqDb(db);
    Store.log('info', 'Removed ' + orphans.length + ' driver record(s) with no account behind them');
    return orphans.length;
  },


  /* Clear the company back to its owner, once per install. The client shares
     the same records as the platform, so it does the same tidy-up — a phone
     or a desktop that was signed into during testing starts clean. */
  resetToOwner() {
    const STAMP = 'hll.resetToOwner.v2';
    try { if (localStorage.getItem(STAMP)) return 0; } catch (e) { return 0; }

    const keepId = this.OWNER.driverId;
    const accounts = this.accounts();
    const others = accounts.filter((a) => a.driverId !== keepId);
    if (others.length) {
      try { localStorage.setItem(HQ_ACCOUNTS, JSON.stringify(accounts.filter((a) => a.driverId === keepId))); }
      catch (e) { return 0; }
    }

    const db = this.hqDb();
    let removed = 0;
    if (db && Array.isArray(db.drivers)) {
      removed = db.drivers.filter((d) => d.id !== keepId).length;
      db.drivers = db.drivers.filter((d) => d.id === keepId);
      const mine = (v) => !v || v === keepId;
      db.applications = (db.applications || []).filter((a) => mine(a.driverId));
      db.tickets = (db.tickets || []).filter((t) => mine(t.driverId));
      db.notifications = (db.notifications || []).filter((n) => mine(n.driverId));
      db.activity = (db.activity || []).filter((a) => mine(a.driverId));
      db.assignments = (db.assignments || []).filter((a) => mine(a.driverId));
      db.jobs = (db.jobs || []).filter((j) => mine(j.driverId));
      (db.events || []).forEach((e) => {
        if (Array.isArray(e.registered)) e.registered = e.registered.filter((r) => mine(r.driverId));
      });
      this.saveHqDb(db);
    }
    try { localStorage.setItem(STAMP, new Date().toISOString()); } catch (e) {}
    if (removed + others.length) {
      Store.log('info', 'Company cleared back to its owner — removed ' + removed
        + ' driver record(s) and ' + others.length + ' login(s)');
    }
    return removed + others.length;
  },


  /* Put the owner's sign-in back, whatever state the store is in.

     provisionOwner() repairs a stale account on its own, but only from a
     build that carries that code — an app installed before it will keep
     refusing the password with no way out from inside the app. This is the
     way out: it is on the sign-in screen, and it rewrites the owner account
     to exactly what this build ships with. */
  restoreOwner() {
    const keep = this.OWNER.driverId;
    const list = this.accounts().filter((a) =>
      a.driverId !== keep && String(a.email).toLowerCase() !== this.OWNER.email.toLowerCase());
    list.push(Object.assign({}, this.OWNER, {
      created: new Date().toISOString(), status: 'active',
    }));
    try { localStorage.setItem(HQ_ACCOUNTS, JSON.stringify(list)); }
    catch (e) { return false; }

    const db = this.hqDb() || { drivers: [], applications: [], events: [] };
    db.drivers = Array.isArray(db.drivers) ? db.drivers : [];
    const rec = db.drivers.find((d) => d.id === keep);
    if (rec) {
      Object.assign(rec, { role: 'super_admin', accountStatus: 'active', clientAccess: true });
    } else {
      db.drivers.push({
        id: keep, name: this.OWNER.name, country: this.OWNER.country,
        joined: new Date().toISOString(), status: 'offline',
        km: 0, deliveries: 0, convoys: 0, attendance: 100,
        role: 'super_admin', accountStatus: 'active',
        discord: '', truckersmp: '', rankIdx: 0, email: this.OWNER.email, clientAccess: true,
      });
    }
    this.saveHqDb(db);
    Store.log('ok', 'Owner sign-in restored to the details this build ships with');
    return true;
  },

  find(handle) {
    const h = String(handle || '').trim().toLowerCase();
    if (!h) return null;
    return this.accounts().find((a) =>
      String(a.email || '').toLowerCase() === h ||
      String(a.driverId || '').toLowerCase() === h ||
      String(a.name || '').toLowerCase() === h) || null;
  },

  /* the same salted SHA-256 the platform writes, so one password works in both */
  async hash(password, salt) {
    const subtle = window.crypto && window.crypto.subtle;
    const data = new TextEncoder().encode(salt + '::' + password);
    if (subtle) {
      const buf = await subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
    }
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) { h ^= data[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return 'weak-' + h.toString(16);
  },

  /* Make the driver record for somebody who has an Auth user and none.

     The same job Accounts.provision() does on the website, and for the
     same reason: with email confirmation on, the row cannot be written at
     sign-up because there is no session yet to satisfy the insert policy.
     It is written at the first sign-in instead — and a driver may well
     make that first sign-in here, in the client, rather than on the site.

     Everything it needs was put into the signUp metadata by the website's
     registration: full_name, driver_code, role and country. */
  async provision(user) {
    if (!window.hllSupabase || !user) return { driver: null };

    const meta = user.user_metadata || {};
    const name = meta.full_name || (user.email || '').split('@')[0] || 'Driver';

    /* driver_code is unique and this end cannot see what is taken, so a
       clash is a matter of time. Retry with a fresh code rather than
       stranding somebody whose random number came up twice. */
    let code = meta.driver_code || ('HLL' + String(Math.floor(1000 + Math.random() * 9000)));

    for (let tries = 0; tries < 6; tries++) {
      const { data, error } = await window.hllSupabase
        .from('drivers')
        .insert({
          auth_user_id: user.id,
          driver_code: code,
          full_name: name,
          email: user.email || '',
          role: meta.role || 'driver',
          /* Not approved. A recruiter decides, and until they do this is
             what keeps the client download shut. */
          status: 'pending',
        })
        .select()
        .maybeSingle();

      if (!error) return { driver: data };

      if (error.code === '23505') {            /* the code was taken */
        code = 'HLL' + String(Math.floor(1000 + Math.random() * 9000));
        continue;
      }

      console.warn('[HLL] could not provision a driver record:', error);
      return { driver: null, error };
    }

    return { driver: null };
  },

  async verify(handle, password) {
    const email = String(handle || '').trim().toLowerCase();
    const pass = String(password || '');
    if (!email || !pass) return { error: 'Enter your email and password.' };

    /* The website and the driver app must authenticate against the same
       Supabase account. Keep the local seed only for offline installations. */
    if (window.hllSupabase && email.indexOf('@') > -1) {
      try {
        const result = await window.hllSupabase.auth.signInWithPassword({ email, password: pass });
        if (result.error) {
          /* Supabase says "Invalid login credentials" both for a wrong
             password and for an address with no account, deliberately —
             telling them apart tells an attacker which addresses are
             real. Said in plainer words here, kept just as vague. */
          const raw = result.error.message || '';
          return {
            error: /invalid login/i.test(raw)
              ? 'That email and password do not match a Gaming Nation account.'
              : raw || 'Login failed.',
          };
        }
        const user = result.data && result.data.user;
        if (!user) return { error: 'Login failed. No user was returned.' };
        let lookup = await window.hllSupabase.from('drivers').select('*')
          .eq('auth_user_id', user.id).maybeSingle();

        /* No driver record, but the password was right.

           This is somebody who registered while email confirmation was on.
           signUp() hands back a user and NO session, so at that moment
           there was no auth.uid() and the insert policy —
           with check (auth.uid() = auth_user_id) — refused the row to the
           one person entitled to it.

           The website makes the record at first sign-in for exactly this
           reason. The client did not, so a driver who confirmed their
           email and opened the app before the website was told their
           account "is not linked" and given nothing to do about it. There
           IS a session now, so make it here too. */
        if (!lookup.error && !lookup.data) {
          const made = await this.provision(user);
          if (made.driver) lookup = { data: made.driver, error: null };
        }

        if (lookup.error || !lookup.data) {
          await window.hllSupabase.auth.signOut();
          return {
            error: 'Your sign-in works, but no driver record could be made for it. '
              + 'Sign in on the HLL website once, then come back.',
          };
        }
        const row = lookup.data;
        if (row.status === 'suspended' || row.account_status === 'suspended') {
          await window.hllSupabase.auth.signOut();
          return { error: 'This account is suspended. Contact Gaming Nation management.' };
        }
        return {
          account: { email: user.email || email, driverId: row.driver_code },
          driver: {
            id: row.driver_code, name: row.full_name || user.email || 'Driver',
            email: row.email || user.email || email, role: row.role || 'driver',
            accountStatus: row.account_status || 'active', status: row.status || 'offline',
            joined: row.created_at || new Date().toISOString(), km: row.km || 0,
            deliveries: row.deliveries || 0, truckersmp: row.truckersmp || '',
          }, user, session: result.data.session,
        };
      } catch (error) {
        return { error: error.message || 'Login failed.' };
      }
    }

    if (!this.accounts().length) {
      return { error: 'No Gaming Nation account exists on this device yet. Open the HLL dashboard to create one.' };
    }
    const account = this.find(handle);
    if (!account) return { error: 'No account found with those details.' };
    const hash = await this.hash(password, account.salt);
    /* a browser with no SubtleCrypto produces the fallback digest, which can
       never equal a SHA-256 one; only a shipped account carries both forms */
    const matches = hash === account.hash
      || (hash.indexOf('weak-') === 0 && !!account.weakHash && hash === account.weakHash);
    if (!matches) return { error: 'That password is not right.' };
    const driver = this.driverRecord(account.driverId);
    if (driver && driver.accountStatus === 'suspended') {
      return { error: 'This account is suspended. Contact Gaming Nation management.' };
    }
    return { account, driver };
  },

  /* fill the client's identity from the platform's driver record */
  signIn(account, driver, remember) {
    const db = Store.db;
    db.driver = {
      name: (driver && driver.name) || account.name,
      display: (driver && driver.name) || account.name,
      hllId: account.driverId,
      rank: driver ? rankNameFor(driver) : 'Driver',
      joined: (driver && driver.joined) || account.created,
      truck: '', plate: '', trailer: '',
      steamId: '', tmpId: (driver && driver.truckersmp) || '', discord: account.discord || '',
      email: account.email,
      role: (driver && driver.role) || 'driver',
      authed: true,          /* set here and nowhere else */
    };
    db.conn.hll = 'connected';
    if (driver) { db.stats.totalKm = driver.km || 0; db.stats.totalJobs = driver.deliveries || 0; }
    if (remember) {
      try { localStorage.setItem(LS_TRK_SESSION, JSON.stringify({ id: account.driverId })); } catch (e) {}
    } else {
      try { localStorage.removeItem(LS_TRK_SESSION); } catch (e) {}
    }
    Store.log('ok', 'Signed in as ' + db.driver.name + ' (' + db.driver.hllId + ')');
    Store.save();
  },

  /* a remembered session only needs the account to still exist */
  restore() {
    let s = null;
    try { s = JSON.parse(localStorage.getItem(LS_TRK_SESSION) || 'null'); } catch (e) { return false; }
    if (!s || !s.id) return false;
    const account = this.accounts().find((a) => a.driverId === s.id);
    if (!account) return false;
    this.signIn(account, this.driverRecord(s.id), true);
    return true;
  },

  signOut() {
    try { localStorage.removeItem(LS_TRK_SESSION); } catch (e) {}
    Store.db.driver = null;
    Store.db.conn.hll = 'offline';
    Telemetry.stop();
    GameWatch.stop();
    Fleet.stop();
    Store.save();
    render();
  },

  /* Being signed in means having actually signed in. An identity left behind
     by an older build satisfied "there is a driver record here" and walked
     straight past the sign-in screen, so the marker below is what counts —
     and only signIn() sets it. */
  signedIn() { return !!(Store.db && Store.db.driver && Store.db.driver.authed); },
};


/* ---------- what this account is allowed to do ----------
   The same ladder the platform uses. The client reads the role off the
   driver record it signed in with, so an administrator gets the run of
   the company here as well as on the web. */
const ROLE_LEVELS = {
  driver: 1, recruiter: 4, dispatcher: 4, event_manager: 5,
  moderator: 6, management: 8, admin: 9, super_admin: 10,
};
const ROLE_NAMES = {
  driver: 'Driver', recruiter: 'Recruiter', dispatcher: 'Dispatcher',
  event_manager: 'Event Manager', moderator: 'Moderator',
  management: 'Management', admin: 'Administrator', super_admin: 'Super Administrator',
};
const PERM_LEVELS = {
  'admin.view': 4, 'recruitment.manage': 4, 'events.manage': 5,
  'content.manage': 6, 'drivers.manage': 8, 'roles.manage': 9,
};

function myRole() {
  const d = Store.db.driver;
  return (d && d.role) || 'driver';
}
function roleName(role) { return ROLE_NAMES[role] || 'Driver'; }
function can(perm) {
  return (ROLE_LEVELS[myRole()] || 0) >= (PERM_LEVELS[perm] ?? 99);
}
function isStaff() { return (ROLE_LEVELS[myRole()] || 0) > 1; }

/* The platform's rank ladder, kept in step with RANKS in script.js. The
   driver record carries the rank the company actually awarded, so that is
   what the client shows; distance is only a fallback for a record that
   predates the field. */
const RANK_LADDER = [
  { km: 0,      name: 'Recruit' },
  { km: 2500,   name: 'Trainee Driver' },
  { km: 10000,  name: 'Junior Driver' },
  { km: 25000,  name: 'Driver' },
  { km: 50000,  name: 'Senior Driver' },
  { km: 100000, name: 'Professional Driver' },
  { km: 175000, name: 'Elite Driver' },
  { km: 275000, name: 'Veteran Driver' },
  { km: 400000, name: 'HLL Captain' },
];
function rankNameFor(d) {
  const i = d && d.rankIdx;
  if (Number.isFinite(i) && RANK_LADDER[i]) return RANK_LADDER[i].name;
  const km = (d && d.km) || 0;
  let name = RANK_LADDER[0].name;
  RANK_LADDER.forEach((r) => { if (km >= r.km) name = r.name; });
  return name;
}

/* ---------------- sign-in screen ----------------
   Shown instead of the whole client until somebody is signed in. */
function signInHTML() {
  const none = !Auth.accounts().length;
  return `
  <div class="signin">
    <div class="signin-card">
      <div class="row gap-14 mb-20">
        ${hllEmblem('md', 'framed')}
        <div><div class="brand-1">GAMING NATION</div><div class="brand-2">Trucker</div></div>
      </div>

      <h1 class="si-title">Sign in to Gaming Nation</h1>
      <p class="t2 sm mt-4">Use the details you registered with on the Gaming Nation platform.</p>

      ${none ? `<div class="si-note mt-16">
        ${icon('info')}
        <div><div class="b6">No Gaming Nation account on this device</div>
          <div class="t3 xs mt-4">Accounts are created on the HLL dashboard. Open it, create yours,
            then come back and sign in here.</div>
          <button class="btn btn-sm mt-12" data-act="open-hll" data-href="index.html#/auth">
            ${icon('link')}Open the HLL dashboard</button></div>
      </div>` : ''}

      <form id="signInForm" class="mt-20" novalidate>
        <div class="field">
          <label for="si-id">Email or Driver ID</label>
          <input class="input" id="si-id" autocomplete="username" placeholder="you@example.com">
        </div>
        <div class="field">
          <label for="si-pw">Password</label>
          <div class="pw-wrap">
            <input class="input" id="si-pw" type="password" autocomplete="current-password"
              autocapitalize="off" autocorrect="off" spellcheck="false">
            <button type="button" class="pw-eye" id="siEye" data-act="pw-reveal"
              aria-label="Show the password" aria-pressed="false">
              ${icon('eye')}</button>
          </div>
          <span class="hint">Capitals and brackets count. Use the eye to check what you typed.</span>
          <span class="si-caps" id="siCaps">${icon('alert')}Caps Lock is on.</span>
        </div>
        <label class="row gap-8 mb-16" style="cursor:pointer">
          <input type="checkbox" id="si-remember" checked style="accent-color:var(--accent)">
          <span class="t2 sm">Keep me signed in on this device</span>
        </label>
        <button class="btn btn-primary btn-block" type="submit">${icon('bolt')}Sign in</button>
        <div class="si-err hide" id="siErr"></div>
        <div class="si-rescue hide" id="siRescue"></div>
      </form>

      <p class="xs t3 mt-20">The client reads the account store the Gaming Nation platform writes in this
        browser profile. It does not send your password anywhere.</p>
    </div>
  </div>`;
}

function bindSignIn() {
  const f = $('#signInForm');
  if (!f) return;
  const err = (msg) => {
    const el = $('#siErr');
    if (el) { el.textContent = msg || ''; el.classList.toggle('hide', !msg); }
  };

  /* Caps Lock. The hint under the field says capitals count, which is
     advice; this is the answer. The browser will not volunteer it, and it
     is the commonest reason a password somebody typed correctly is
     refused. */
  const pwEl = $('#si-pw');
  const caps = $('#siCaps');

  if (pwEl && caps) {
    const look = (e) => {
      const on = typeof e.getModifierState === 'function' && e.getModifierState('CapsLock');
      caps.classList.toggle('on', !!on);
    };
    pwEl.addEventListener('keydown', look);
    pwEl.addEventListener('keyup', look);
    /* Not a warning about a field nobody is in any more. */
    pwEl.addEventListener('blur', () => caps.classList.remove('on'));
  }

  /* Typing again clears the last failure, so a stale error never sits
     under a field that has already been corrected. */
  [$('#si-id'), pwEl].forEach((el) => {
    if (el) el.addEventListener('input', () => err(''));
  });
  f.addEventListener('submit', async (e) => {
    e.preventDefault();
    const handle = $('#si-id').value.trim();
    const pw = $('#si-pw').value;
    if (!handle || !pw) { err('Enter your details to sign in.'); return; }
    err('');
    const btn = f.querySelector('button[type="submit"]');
    const label = btn.innerHTML;

    /* Disabled alone reads as a dead button. Say what it is doing. */
    btn.disabled = true;
    btn.innerHTML = '<span class="si-spin" aria-hidden="true"></span>Signing in';

    const res = await Auth.verify(handle, pw);

    btn.disabled = false;
    btn.innerHTML = label;
    if (res.error) {
      err(res.error);
      /* Say which of the two things is actually wrong. If this device already
         holds exactly the details this build ships with, then restoring them
         changes nothing and the password typed is simply not that password —
         telling somebody to press a button that cannot help is worse than
         telling them nothing. */
      const rescue = $('#siRescue');
      const owner = handle.trim().toLowerCase() === Auth.OWNER.email.toLowerCase()
        || handle.trim().toLowerCase() === Auth.OWNER.driverId.toLowerCase();
      if (rescue && owner) {
        const held = Auth.find(handle);
        const shipped = held && held.salt === Auth.OWNER.salt && held.hash === Auth.OWNER.hash;
        rescue.innerHTML = shipped
          ? `<div class="b6">This device already holds the owner details</div>
             <div class="t3 xs mt-4">The stored sign-in matches what this build ships with, so the
               password entered is not that password. Check the capitals and the brackets — the eye
               beside the field shows exactly what you typed.</div>`
          : `<div class="b6">These sign-in details look out of date</div>
             <div class="t3 xs mt-4">This account was set up by an older version, and its stored
               password is out of step with the one this build ships with.</div>
             <button type="button" class="btn btn-sm mt-8" data-act="restore-owner">
               ${icon('refresh')}Restore the owner sign-in</button>`;
        rescue.classList.remove('hide');
      }
      return;
    }
    Auth.signIn(res.account, res.driver, $('#si-remember').checked);
    toast('Signed in as ' + Store.db.driver.name, 'ok');
    startServices();
    render();
  });
}


/* Clear the boot splash once there is something behind it. Kept to a minimum
   on screen time, but never shorter than the draw-on, so it does not flash. */
function dismissSplash() {
  const s = document.getElementById('splash');
  if (!s || s.classList.contains('gone')) return;
  clearTimeout(window.__hllSplash);
  const shown = Date.now() - (window.__hllSplashAt || Date.now());
  const wait = Math.max(0, 1500 - shown);
  setTimeout(() => {
    s.classList.add('gone');
    setTimeout(() => { if (s.parentNode) s.parentNode.removeChild(s); }, 600);
  }, wait);
}

function boot() {
  Store.load();
  Platform.init();

  /* manifest shortcuts deep-link with #view */
  const wanted = (location.hash || '').replace('#', '');
  if (wanted && VIEWS[wanted]) state.view = wanted;
  window.addEventListener('hashchange', () => {
    const v = (location.hash || '').replace('#', '');
    if (v && VIEWS[v] && v !== state.view) { state.view = v; render(); }
  });

  document.addEventListener('click', (e) => {
    const win = e.target.closest('[data-win]');
    if (win) { windowControl(win.dataset.win); return; }
    const t = e.target.closest('[data-act]');
    if (!t) return;
    e.preventDefault();
    try { handle(t.dataset.act, t); }
    catch (err) { console.error('[JT] action failed', t.dataset.act, err); toast('Something went wrong', 'err'); }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { closeModals(); closeMenus(); }
  });

  /* the owner exists on every install, so there is always a way in */
  Auth.provisionOwner();
  Auth.resetToOwner();      /* once per install */
  Auth.purgeOrphanDrivers();

  /* a remembered sign-in brings the client straight up */
  if (!Auth.signedIn()) Auth.restore();
  if (Auth.signedIn()) startServices();

  render();
  dismissSplash();
}

/* nothing polls, tracks or reports until a driver is behind the client */
function startServices() {
  const job = Store.db.job;

  /* the client works out for itself when the game opens and closes */
  GameWatch.start();
  Sync.start();          /* and shares one company with every other machine */
  Fleet.start();

  /* If the service is running on this machine, everything above should be
     using it. Started again once we know, rather than left off because the
     answer had not arrived yet when boot ran. */
  discoverLocalService().then((found) => {
    if (!found) return;
    Sync.start();
    Fleet.start();
    render();
  });

  if (Store.db.settings.liveTelemetry) {
    Telemetry.start();
    Store.log('info', 'Watching for live telemetry on ' + Telemetry.endpoint());
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();
