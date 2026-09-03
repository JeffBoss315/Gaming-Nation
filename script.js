/* ============================================================
   HEAVYLINE LOGISTICS — HLL Digital Headquarters
   Part 1/4 — utilities, icons, domain constants, seed data, store
   ============================================================ */
'use strict';

/* ---------------- 1. Micro utilities ---------------- */
const $  = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));
const sum   = (a) => a.reduce((x, y) => x + y, 0);
const uid   = (p) => p + '-' + Math.random().toString(36).slice(2, 9);
const byId  = (arr, id) => arr.find((x) => x.id === id);

/* deterministic PRNG so the seeded fleet looks the same on first run */
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rng   = mulberry32(20260822);
const rand  = (lo, hi) => lo + rng() * (hi - lo);
const randI = (lo, hi) => Math.floor(rand(lo, hi + 1));
const pick  = (arr) => arr[randI(0, arr.length - 1)];

const DAY = 86400000;

const fmt = {
  n:   (v) => Number(v || 0).toLocaleString('en-GB'),
  km:  (v) => Number(v || 0).toLocaleString('en-GB') + ' km',
  kmS: (v) => v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 1 : 2) + 'M km'
            : v >= 1e3 ? Math.round(v / 1e3) + 'k km' : v + ' km',
  pct: (v, d = 0) => Number(v || 0).toFixed(d) + '%',
  eur: (v) => '€' + Number(v || 0).toLocaleString('en-GB'),
  dur: (min) => {
    const h = Math.floor(min / 60), m = Math.round(min % 60);
    return (h ? h + 'h ' : '') + (m ? m + 'm' : (h ? '' : '0m'));
  },
  date: (iso, o) => new Date(iso).toLocaleDateString('en-GB',
    o || { day: 'numeric', month: 'short', year: 'numeric' }),
  dayMon: (iso) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
  time: (iso) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }),
  dt:   (iso) => fmt.date(iso) + ' · ' + fmt.time(iso) + ' UTC',
  rel:  (iso) => {
    const d = Date.now() - new Date(iso).getTime();
    const abs = Math.abs(d), fut = d < 0;
    const unit = (n, u) => (fut ? 'in ' : '') + n + ' ' + u + (n === 1 ? '' : 's') + (fut ? '' : ' ago');
    if (abs < 60000) return fut ? 'shortly' : 'just now';
    if (abs < 3.6e6) return unit(Math.round(abs / 60000), 'min');
    if (abs < 8.64e7) return unit(Math.round(abs / 3.6e6), 'hour');
    if (abs < 2.6e9) return unit(Math.round(abs / 8.64e7), 'day');
    return fmt.date(iso);
  },
};

const initials = (name) => name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

/* ---------------- 2. Icon set (inline SVG, no CDN) ---------------- */
const ICON_PATHS = {
  truck:      '<path d="M2 7h11v9H2z"/><path d="M13 10h4.5l3.5 3.5V16h-8z"/><circle cx="7" cy="18" r="2"/><circle cx="17" cy="18" r="2"/>',
  grid:       '<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/>',
  users:      '<path d="M16 20v-1.5A3.5 3.5 0 0 0 12.5 15h-5A3.5 3.5 0 0 0 4 18.5V20"/><circle cx="10" cy="8" r="3.2"/><path d="M20 20v-1.5a3.5 3.5 0 0 0-2.6-3.4"/><path d="M15.5 5.2a3.2 3.2 0 0 1 0 5.6"/>',
  user:       '<circle cx="12" cy="8" r="3.4"/><path d="M5 20v-1.2A4.8 4.8 0 0 1 9.8 14h4.4A4.8 4.8 0 0 1 19 18.8V20"/>',
  route:      '<circle cx="6" cy="6" r="2.6"/><circle cx="18" cy="18" r="2.6"/><path d="M8.6 6H14a3.4 3.4 0 0 1 0 6.8h-4A3.4 3.4 0 0 0 10 18h5.4"/>',
  map:        '<path d="M9 4 3 6.5v13L9 17l6 2.5 6-2.5v-13L15 6.5z"/><path d="M9 4v13M15 6.5v13"/>',
  calendar:   '<rect x="3" y="5" width="18" height="16" rx="2.5"/><path d="M3 10h18M8 3v4M16 3v4"/>',
  trophy:     '<path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4.5v1.5A3.5 3.5 0 0 0 8 11M17 6h2.5v1.5A3.5 3.5 0 0 1 16 11"/><path d="M12 14v3M8.5 20h7l-.6-2.4H9.1z"/>',
  medal:      '<circle cx="12" cy="14.5" r="5.5"/><path d="M12 12.4l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z"/><path d="M8.5 3h7l-1.6 5.4M8.5 3l1.7 5.6"/>',
  userPlus:   '<circle cx="9" cy="8" r="3.4"/><path d="M3 20v-1.2A4.8 4.8 0 0 1 7.8 14h2.4A4.8 4.8 0 0 1 15 18.8V20"/><path d="M18 8v6M15 11h6"/>',
  discord:    '<path d="M8.4 6.2A14 14 0 0 0 5 7.6C2.9 10.8 2.3 14 2.6 17.1a15 15 0 0 0 4.5 2.3l1-1.7"/><path d="M15.6 6.2A14 14 0 0 1 19 7.6c2.1 3.2 2.7 6.4 2.4 9.5a15 15 0 0 1-4.5 2.3l-1-1.7"/><path d="M7.5 17.2c3 1.4 6 1.4 9 0"/><ellipse cx="9.3" cy="12.4" rx="1.5" ry="1.9"/><ellipse cx="14.7" cy="12.4" rx="1.5" ry="1.9"/>',
  bell:       '<path d="M18 9a6 6 0 1 0-12 0c0 5-2 6-2 6h16s-2-1-2-6"/><path d="M13.7 19a2 2 0 0 1-3.4 0"/>',
  lifeBuoy:   '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3.6"/><path d="M5.6 5.6l3.9 3.9M14.5 14.5l3.9 3.9M18.4 5.6l-3.9 3.9M9.5 14.5l-3.9 3.9"/>',
  shield:     '<path d="M12 3l7.5 3v5.6c0 4.6-3.1 8.2-7.5 9.4-4.4-1.2-7.5-4.8-7.5-9.4V6z"/><path d="M9.2 12.2l2 2 3.6-3.9"/>',
  chart:      '<path d="M4 20V4"/><path d="M4 20h16"/><rect x="7.5" y="11" width="3" height="6" rx="1"/><rect x="13" y="7" width="3" height="10" rx="1"/><rect x="18" y="13" width="2.5" height="4" rx="1"/>',
  settings:   '<circle cx="12" cy="12" r="3.2"/><path d="M19.4 14.5a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1V21a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.7-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0-1.1-2.7H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 2.7-1.1V3a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7H21a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.4.7z"/>',
  logout:     '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5M21 12H9"/>',
  search:     '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/>',
  bolt:       '<path d="M13 2 4.5 13.5H11l-1 8.5 8.5-11.5H12z"/>',
  flag:       '<path d="M5 21V4"/><path d="M5 5h10.5l-1.3 3.2L15.5 12H5z"/>',
  clock:      '<circle cx="12" cy="12" r="9"/><path d="M12 7v5.3l3.4 2"/>',
  pin:        '<path d="M12 21s7-5.6 7-11a7 7 0 1 0-14 0c0 5.4 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
  check:      '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/>',
  checkCircle:'<circle cx="12" cy="12" r="9"/><path d="M8.2 12.3l2.6 2.6 5-5.4"/>',
  x:          '<path d="M6 6l12 12M18 6L6 18"/>',
  plus:       '<path d="M12 5v14M5 12h14"/>',
  minus:      '<path d="M5 12h14"/>',
  edit:       '<path d="M4 20h4L20 8l-4-4L4 16z"/><path d="M14.5 5.5l4 4"/>',
  trash:      '<path d="M4 7h16M9 7V5h6v2M6 7l1 13h10l1-13"/>',
  eye:        '<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>',
  arrowRight: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  arrowLeft:  '<path d="M19 12H5M11 18l-6-6 6-6"/>',
  arrowUp:    '<path d="M12 19V5M6 11l6-6 6 6"/>',
  arrowDown:  '<path d="M12 5v14M18 13l-6 6-6-6"/>',
  chevron:    '<path d="M9 6l6 6-6 6"/>',
  menu:       '<path d="M4 7h16M4 12h16M4 17h16"/>',
  lock:       '<rect x="4.5" y="10" width="15" height="10.5" rx="2.5"/><path d="M8 10V7.5a4 4 0 0 1 8 0V10"/>',
  mail:       '<rect x="3" y="5" width="18" height="14" rx="2.5"/><path d="M3.5 7l8.5 6 8.5-6"/>',
  chat:       '<path d="M20 14.5a2.5 2.5 0 0 1-2.5 2.5H8l-4 3.5V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5z"/>',
  video:      '<rect x="3" y="6" width="12.5" height="12" rx="2.5"/><path d="M15.5 10.5l5-2.6v8.2l-5-2.6z"/>',
  phoneOff:   '<path d="M10.7 5.6A15.5 15.5 0 0 1 13 5.3"/><path d="M3 3l18 18"/><path d="M8.4 8.4l-2 1.2a1.6 1.6 0 0 0-.6 2l1 2.2a15.6 15.6 0 0 0 4.4 4.4l2.2 1a1.6 1.6 0 0 0 2-.6l1.2-2"/><path d="M18.6 13.8l.8-1.4a1.6 1.6 0 0 0-.6-2l-2-1.2"/>',
  mic:        '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0"/><path d="M12 18v3"/>',
  micOff:     '<path d="M3 3l18 18"/><path d="M9.5 4.9A3 3 0 0 1 15 6v4"/><path d="M9 9.4V11a3 3 0 0 0 4.3 2.7"/><path d="M5.5 11.5a6.5 6.5 0 0 0 9.9 5.6"/><path d="M18.4 13.6a6.5 6.5 0 0 0 .1-2.1"/><path d="M12 18v3"/>',
  paperclip:  '<path d="M20 11.5l-7.6 7.6a4.6 4.6 0 0 1-6.5-6.5l8-8a3.1 3.1 0 0 1 4.4 4.4l-8 8a1.6 1.6 0 0 1-2.2-2.2l7.1-7.1"/>',
  megaphone:  '<path d="M4 10v4a2 2 0 0 0 2 2h1l9 4V4l-9 4H6a2 2 0 0 0-2 2z"/><path d="M19 9.5a3.2 3.2 0 0 1 0 5"/>',
  wrench:     '<path d="M15 3.5a5.5 5.5 0 0 0-5 7.6L3.6 17.5a2 2 0 0 0 2.8 2.8l6.4-6.3A5.5 5.5 0 0 0 20 8.5l-3 1.7-2.5-1.4-.1-2.9z"/>',
  package:    '<path d="M12 3 3.5 7.5v9L12 21l8.5-4.5v-9z"/><path d="M3.5 7.5 12 12l8.5-4.5M12 12v9"/>',
  gauge:      '<path d="M4 17a8 8 0 1 1 16 0"/><path d="M12 17l4.2-4.6"/><circle cx="12" cy="17" r="1.4"/>',
  fuel:       '<rect x="4" y="4" width="9" height="16" rx="2"/><path d="M13 9h3.5a2 2 0 0 1 2 2v5a1.8 1.8 0 0 0 3.5 0V9l-2.5-2.5"/><path d="M6.5 8h4"/>',
  star:       '<path d="m12 3.6 2.6 5.4 5.9.8-4.3 4.1 1 5.9L12 17l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z"/>',
  target:     '<circle cx="12" cy="12" r="8.5"/><circle cx="12" cy="12" r="4.6"/><circle cx="12" cy="12" r="1.2"/>',
  activity:   '<path d="M3 12h4l3-7 4 14 3-7h4"/>',
  filter:     '<path d="M3.5 5h17l-6.5 7.6V19l-4 2v-8.4z"/>',
  download:   '<path d="M12 3v11M7.5 10 12 14.5 16.5 10"/><path d="M4.5 19.5h15"/>',
  phone:      '<rect x="6.5" y="2.5" width="11" height="19" rx="2.4"/><path d="M10.5 5.4h3"/><path d="M10.8 18.6h2.4"/>',
  upload:     '<path d="M12 20V9M7.5 12.5 12 8l4.5 4.5"/><path d="M4.5 4.5h15"/>',
  refresh:    '<path d="M20 11a8 8 0 0 0-14-4.5L3.5 9"/><path d="M4 13a8 8 0 0 0 14 4.5L20.5 15"/><path d="M3.5 4.5V9H8M20.5 19.5V15H16"/>',
  info:       '<circle cx="12" cy="12" r="9"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1"/>',
  alert:      '<path d="M12 4 2.8 20h18.4z"/><path d="M12 10v4.4"/><circle cx="12" cy="17.3" r="1"/>',
  home:       '<path d="M4 11 12 4l8 7"/><path d="M6 10.5V20h12v-9.5"/><path d="M10 20v-5h4v5"/>',
  building:   '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 7h2M13 7h2M9 11h2M13 11h2M9 15h2M13 15h2"/>',
  key:        '<circle cx="8" cy="12" r="4.2"/><path d="M12.2 12H21l-1.5 2.5M17 12v3"/>',
  play:       '<path d="M7 4.8 19 12 7 19.2z"/>',
  ticket:     '<path d="M4 8.5V6.5h16v2a2.6 2.6 0 0 0 0 5.2v3.8H4v-3.8a2.6 2.6 0 0 0 0-5.2z"/><path d="M12 7v3M12 13.5v3.5"/>',
  send:       '<path d="M21 3 10.5 13.5M21 3l-7 18-3.5-7.5L3 10z"/>',
  book:       '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M8 7h7M8 11h5"/>',
  link:       '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.4-2.4a4 4 0 1 0-5.7-5.7L11.5 6.8"/><path d="M13.5 10.5a4 4 0 0 0-5.7 0l-2.4 2.4a4 4 0 1 0 5.7 5.7l1.4-1.4"/>',
};
function icon(name, cls = '') {
  const p = ICON_PATHS[name] || ICON_PATHS.info;
  return `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7"
    stroke-linecap="round" stroke-linejoin="round" class="ic ${cls}" aria-hidden="true">${p}</svg>`;
}
/* filled variant for solid marks */

/* ---------------- 3. Domain constants ---------------- */

/* 3.1 Rank ladder — spec §10 */
const RANKS = [
  { i: 0, key: 'recruit',      name: 'Recruit',              abbr: 'RCT', km: 0,      convoys: 0,  att: 0,  color: '#8b98ab' },
  { i: 1, key: 'trainee',      name: 'Trainee Driver',       abbr: 'TRN', km: 2500,   convoys: 1,  att: 50, color: '#9fb4cc' },
  { i: 2, key: 'junior',       name: 'Junior Driver',        abbr: 'JNR', km: 10000,  convoys: 4,  att: 60, color: '#5eb0e8' },
  { i: 3, key: 'driver',       name: 'Driver',               abbr: 'DRV', km: 25000,  convoys: 10, att: 65, color: '#4aa3f0' },
  { i: 4, key: 'senior',       name: 'Senior Driver',        abbr: 'SNR', km: 50000,  convoys: 20, att: 70, color: '#3ecf8e' },
  { i: 5, key: 'professional', name: 'Professional Driver',  abbr: 'PRO', km: 100000, convoys: 40, att: 75, color: '#8b7cf0' },
  { i: 6, key: 'elite',        name: 'Elite Driver',         abbr: 'ELT', km: 175000, convoys: 65, att: 80, color: '#d99b2b' },
  { i: 7, key: 'veteran',      name: 'Veteran Driver',       abbr: 'VET', km: 275000, convoys: 90, att: 85, color: '#4f7fff' },
  { i: 8, key: 'captain',      name: 'HLL Captain',          abbr: 'CPT', km: 400000, convoys: 130, att: 90, color: '#9db8ff' },
];
const rankOf = (d) => RANKS[clamp(d.rankIdx ?? 0, 0, RANKS.length - 1)];
/* rank a driver *qualifies* for, from their stats */
function earnedRank(d) {
  let r = RANKS[0];
  for (const R of RANKS) if (d.km >= R.km && d.convoys >= R.convoys && d.attendance >= R.att) r = R;
  return r;
}

/* 3.2 Roles & permissions — spec §17 */
const ROLES = {
  driver:        { name: 'Driver',              level: 1,  color: '#8b98ab' },
  recruiter:     { name: 'Recruiter',           level: 4,  color: '#4aa3f0' },
  dispatcher:    { name: 'Dispatcher',          level: 4,  color: '#3ecf8e' },
  event_manager: { name: 'Event Manager',       level: 5,  color: '#8b7cf0' },
  moderator:     { name: 'Moderator',           level: 6,  color: '#d99b2b' },
  management:    { name: 'Management',          level: 8,  color: '#4f7fff' },
  admin:         { name: 'Administrator',       level: 9,  color: '#4f7fff' },
  super_admin:   { name: 'Super Administrator', level: 10, color: '#9db8ff' },
};
const PERMS = {
  'admin.view':        4,
  'recruitment.manage': 4,
  'fleet.manage':      4,
  'events.manage':     5,
  'content.manage':    6,
  'drivers.manage':    8,
  'analytics.view':    4,
  'roles.manage':      9,
};
function can(perm, user = state.user) {
  if (!user) return false;
  return (ROLES[user.role]?.level ?? 0) >= (PERMS[perm] ?? 99);
}

/* 3.3 Achievements — spec §10 */
const ACHIEVEMENTS = [
  { id: 'a-first',    name: 'First Delivery',       desc: 'Complete your first HLL delivery.',            icon: 'package',  tier: 'bronze', metric: 'deliveries', goal: 1 },
  { id: 'a-10k',      name: '10,000 KM Driven',     desc: 'Cover 10,000 km under HLL colours.',           icon: 'route',    tier: 'bronze', metric: 'km', goal: 10000 },
  { id: 'a-50k',      name: '50,000 KM Driven',     desc: 'Cover 50,000 km under HLL colours.',           icon: 'route',    tier: 'silver', metric: 'km', goal: 50000 },
  { id: 'a-100k',     name: '100,000 KM Driven',    desc: 'Join the six-figure mileage club.',            icon: 'gauge',    tier: 'gold',   metric: 'km', goal: 100000 },
  { id: 'a-250k',     name: 'Quarter Million',      desc: 'Cover 250,000 km under HLL colours.',          icon: 'bolt',     tier: 'plat',   metric: 'km', goal: 250000 },
  { id: 'a-conv10',   name: '10 Convoys',           desc: 'Attend 10 official HLL convoys.',              icon: 'truck',    tier: 'bronze', metric: 'convoys', goal: 10 },
  { id: 'a-conv50',   name: '50 Convoys',           desc: 'Attend 50 official HLL convoys.',              icon: 'truck',    tier: 'silver', metric: 'convoys', goal: 50 },
  { id: 'a-conv100',  name: '100 Convoys',          desc: 'Attend 100 official HLL convoys.',             icon: 'trophy',   tier: 'gold',   metric: 'convoys', goal: 100 },
  { id: 'a-perfect',  name: 'Perfect Attendance',   desc: 'Hold 100% attendance across a full season.',   icon: 'checkCircle', tier: 'gold', metric: 'attendance', goal: 100 },
  { id: 'a-deliv100', name: 'Century Hauler',       desc: 'Complete 100 deliveries.',                     icon: 'package',  tier: 'silver', metric: 'deliveries', goal: 100 },
  { id: 'a-deliv500', name: 'Freight Machine',      desc: 'Complete 500 deliveries.',                     icon: 'package',  tier: 'plat',   metric: 'deliveries', goal: 500 },
  { id: 'a-veteran',  name: 'Veteran Driver',       desc: 'Reach the rank of Veteran Driver.',            icon: 'medal',    tier: 'gold',   metric: 'rank', goal: 7 },
  { id: 'a-elite',    name: 'Elite Driver',         desc: 'Reach the rank of Elite Driver.',              icon: 'star',     tier: 'gold',   metric: 'rank', goal: 6 },
  { id: 'a-lead',     name: 'Convoy Leader',        desc: 'Lead an official HLL convoy.',                 icon: 'flag',     tier: 'silver', metric: 'manual', goal: 1 },
  { id: 'a-community',name: 'Community Contributor',desc: 'Recognised for outstanding community work.',   icon: 'users',    tier: 'gold',   metric: 'manual', goal: 1 },
  { id: 'a-founder',  name: 'Founding Member',      desc: 'Joined Heavyline Logistics in its first year.',icon: 'shield',   tier: 'plat',   metric: 'manual', goal: 1 },
];
const TIER_COLOR = { bronze: '#a8794f', silver: '#9aa3af', gold: '#e8913a', plat: '#6fb6c9' };

/* 3.4 Map graph — schematic European network (viewBox 640 x 470) */
const CITIES = {
  'Dublin': [145, 172], 'Edinburgh': [201, 118], 'Manchester': [211, 163], 'Birmingham': [216, 186],
  'London': [232, 206], 'Calais': [252, 216], 'Amsterdam': [321, 189], 'Rotterdam': [306, 200],
  'Brussels': [300, 234], 'Paris': [256, 285], 'Duisburg': [353, 214], 'Cologne': [360, 234],
  'Frankfurt': [385, 264], 'Stuttgart': [390, 300], 'Munich': [430, 310], 'Berlin': [470, 190],
  'Hamburg': [415, 156], 'Bremen': [390, 166], 'Hannover': [405, 191], 'Leipzig': [450, 220],
  'Dresden': [480, 226], 'Prague': [500, 255], 'Vienna': [530, 300], 'Zurich': [372, 322],
  'Geneva': [332, 331], 'Lyon': [291, 336], 'Marseille': [301, 385], 'Bordeaux': [216, 346],
  'Toulouse': [241, 376], 'Madrid': [141, 411], 'Barcelona': [251, 396], 'Lisbon': [56, 412],
  'Milan': [391, 356], 'Venice': [421, 341], 'Rome': [431, 416], 'Warsaw': [560, 191],
  'Krakow': [556, 236], 'Budapest': [556, 311], 'Copenhagen': [421, 121], 'Oslo': [401, 56],
  'Stockholm': [476, 71], 'Helsinki': [560, 56], 'Luxembourg': [330, 258], 'Strasbourg': [350, 285],
};
const cityXY = (n) => CITIES[n] || [320, 235];

/* straight-line length of a convoy route, in km. The schematic is about
   3.1 km per unit, which is the scale the games quote distances at. */
function routeDistance(path) {
  let d = 0;
  for (let i = 1; i < path.length; i++) {
    const [x1, y1] = cityXY(path[i - 1]), [x2, y2] = cityXY(path[i]);
    d += Math.hypot(x2 - x1, y2 - y1);
  }
  return Math.round(d * 3.1);
}

/* 3.5 Vehicle catalogue */
const TRUCK_MODELS = [
  { make: 'Scania',  model: 'S 730 V8',      hp: 730, cab: 'Highline S', gearbox: 'Opticruise 12-spd', chassis: '6x2' },
  { make: 'Scania',  model: 'R 660 V8',      hp: 660, cab: 'Highline R',  gearbox: 'Opticruise 12-spd', chassis: '4x2' },
  { make: 'Volvo',   model: 'FH16 750',      hp: 750, cab: 'Globetrotter XL', gearbox: 'I-Shift 12-spd', chassis: '6x4' },
  { make: 'Volvo',   model: 'FH 540',        hp: 540, cab: 'Globetrotter',    gearbox: 'I-Shift 12-spd', chassis: '4x2' },
  { make: 'MAN',     model: 'TGX 640',       hp: 640, cab: 'GX',        gearbox: 'TipMatic 12-spd', chassis: '6x2' },
  { make: 'DAF',     model: 'XG+ 530',       hp: 530, cab: 'XG+',       gearbox: 'TraXon 12-spd',  chassis: '4x2' },
  { make: 'Mercedes',model: 'Actros L 630',  hp: 625, cab: 'GigaSpace', gearbox: 'PowerShift 12-spd', chassis: '6x2' },
  { make: 'Iveco',   model: 'S-Way 570',     hp: 570, cab: 'Active Space', gearbox: 'Hi-Tronix 12-spd', chassis: '4x2' },
  { make: 'Renault', model: 'T High 520',    hp: 520, cab: 'T High',    gearbox: 'Optidriver 12-spd', chassis: '4x2' },
];
const LIVERIES = [
  { key: 'heavyline',  name: 'Heavyline Signature', a: '#4f7fff', b: '#141b26' },
  { key: 'midnight',   name: 'Midnight Steel',      a: '#4aa3f0', b: '#0f1721' },
  { key: 'gold',       name: 'Gold Standard',       a: '#9db8ff', b: '#1b1508' },
  { key: 'arctic',     name: 'Arctic Haul',         a: '#e6edf6', b: '#1a2230' },
  { key: 'forest',     name: 'Forest Line',         a: '#3ecf8e', b: '#0e1a16' },
  { key: 'crimson',    name: 'Crimson Freight',     a: '#ef5f5f', b: '#1d1113' },
];

/* Every country, so nobody has to pick something that is not theirs. */
const COUNTRIES = [
  'Afghanistan', 'Albania', 'Algeria', 'Andorra', 'Angola', 'Antigua and Barbuda', 'Argentina',
  'Armenia', 'Australia', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh',
  'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia',
  'Bosnia and Herzegovina', 'Botswana', 'Brazil', 'Brunei', 'Bulgaria', 'Burkina Faso',
  'Burundi', 'Cabo Verde', 'Cambodia', 'Cameroon', 'Canada', 'Central African Republic', 'Chad',
  'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Congo (DRC)', 'Costa Rica', 'Croatia',
  'Cuba', 'Cyprus', 'Czechia', 'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic',
  'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea', 'Estonia', 'Eswatini',
  'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana',
  'Greece', 'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras',
  'Hungary', 'Iceland', 'India', 'Indonesia', 'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy',
  'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati', 'Kosovo',
  'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya',
  'Liechtenstein', 'Lithuania', 'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives',
  'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius', 'Mexico', 'Micronesia',
  'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia',
  'Nauru', 'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria',
  'North Korea', 'North Macedonia', 'Norway', 'Oman', 'Pakistan', 'Palau', 'Palestine',
  'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal',
  'Qatar', 'Romania', 'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia',
  'Saint Vincent and the Grenadines', 'Samoa', 'San Marino', 'Sao Tome and Principe',
  'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia',
  'Slovenia', 'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan',
  'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden', 'Switzerland', 'Syria', 'Taiwan',
  'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
  'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates',
  'United Kingdom', 'United States', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City',
  'Venezuela', 'Vietnam', 'Yemen', 'Zambia', 'Zimbabwe'
];
/* the sample drivers that ship with the demo stay European, so the seeded
   leaderboard still reads like a European VTC */
/* ---------------- 4. Seed generator ---------------- */
/* ---------------- 4. A new company ----------------
   Nothing is invented here. A fresh install holds no people and no
   vehicles: the first person to open the platform creates the owner
   account, and drivers, fleet, convoys and announcements are all added
   from the admin console after that. */
function seedDB() {
  return {
    drivers: [], trucks: [], trailers: [], events: [], applications: [], assignments: [], jobs: [],
    tickets: [], announcements: [], notifications: [], activity: [], sessions: [],
    meta: { season: new Date().getFullYear() + ' Season', founded: null },
  };
}

/* Counting helpers for the charts and tiles. They read the company records —
   there is no synthetic series anywhere in the reporting. */
const inWindow = (iso, from, to) => {
  if (!iso) return false;
  const t = new Date(iso).getTime();
  return t >= from && t < to;
};

/* Walks back `n` whole months and asks `count` for each one. */
function monthlySeries(n, count) {
  const out = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const from = new Date(now.getFullYear(), now.getMonth() - i, 1).getTime();
    const to = new Date(now.getFullYear(), now.getMonth() - i + 1, 1).getTime();
    out.push(count(from, to));
  }
  return out;
}

/* week and month distance are rolling windows, so they are counted from the
   runs each time rather than added up forever. */
/* Distance and money over the recent windows, recomputed from the runs
   themselves rather than counted up as they land. Derived figures cannot
   drift: a run credited twice, a record merged from another machine or a
   clock that moved all come out right on the next pass. The all-time totals
   stay incremental because the job list is capped and the oldest runs fall
   off it. */
function rollDistanceWindows() {
  const jobs = Store.db.jobs || [];
  const now = Date.now();
  const week = now - 7 * DAY;
  const month = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const by = new Map();
  jobs.forEach((j) => {
    if (!j.driverId || !j.finished) return;
    const t = new Date(j.finished).getTime();
    const e = by.get(j.driverId)
      || { week: 0, month: 0, weekPay: 0, monthPay: 0 };
    if (t >= week) { e.week += j.km || 0; e.weekPay += j.income || 0; }
    if (t >= month) { e.month += j.km || 0; e.monthPay += j.income || 0; }
    by.set(j.driverId, e);
  });
  (Store.db.drivers || []).forEach((d) => {
    const e = by.get(d.id);
    d.weekKm = Math.round(e ? e.week : 0);
    d.monthKm = Math.round(e ? e.month : 0);
    d.weekEarned = Math.round(e ? e.weekPay : 0);
    d.monthEarned = Math.round(e ? e.monthPay : 0);
  });
}

/* What the company has taken, over a window. The runs carry the money, so
   this is the same figure however it is sliced. */
function companyRevenue(fromMs, toMs) {
  return (Store.db.jobs || []).reduce((sum, j) => {
    if (!j.finished) return sum;
    const t = new Date(j.finished).getTime();
    if (fromMs != null && t < fromMs) return sum;
    if (toMs != null && t >= toMs) return sum;
    return sum + (j.income || 0);
  }, 0);
}

/* ---------------- game sessions ----------------
   A session is one sitting at the game: it opens when a driver's client sees
   the game come up and closes when it goes away. The client writes them, so
   they are a record of what actually happened rather than of who had a page
   open. */
function sessionsFor(driverId) {
  return (Store.db.sessions || [])
    .filter((s) => s.driverId === driverId)
    .sort((a, b) => new Date(b.started) - new Date(a.started));
}

function openSessionFor(driverId) {
  return (Store.db.sessions || []).find((s) => s.driverId === driverId && !s.ended) || null;
}

/* minutes at the wheel across a window */
function sessionMinutes(driverId, fromMs) {
  return (Store.db.sessions || []).reduce((sum, s) => {
    if (s.driverId !== driverId) return sum;
    const started = new Date(s.started).getTime();
    if (fromMs != null && started < fromMs) return sum;
    const ended = s.ended ? new Date(s.ended).getTime() : Date.now();
    return sum + Math.max(0, (ended - started) / 60000);
  }, 0);
}

function deliveriesThisMonth(driverId) {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  return (Store.db.jobs || []).filter((j) => j.driverId === driverId
    && inWindow(j.finished, from, Date.now() + 1)).length;
}

/* achievement evaluation */
function achEarned(a, d) {
  switch (a.metric) {
    case 'km':          return d.km >= a.goal;
    case 'deliveries':  return d.deliveries >= a.goal;
    case 'convoys':     return d.convoys >= a.goal;
    case 'attendance':  return d.attendance >= a.goal;
    case 'rank':        return (d.rankIdx ?? 0) >= a.goal;
    case 'manual':      return (d.achievements || []).includes(a.id);
    default:            return false;
  }
}
function achProgress(a, d) {
  const cur = { km: d.km, deliveries: d.deliveries, convoys: d.convoys, attendance: d.attendance, rank: (d.rankIdx ?? 0) + 1 }[a.metric];
  if (a.metric === 'manual') return achEarned(a, d) ? 1 : 0;
  return clamp((cur || 0) / a.goal, 0, 1);
}


/* ============================================================
   ACCOUNTS
   ------------------------------------------------------------
   Real sign-in: an account has to exist and the password has to
   match before anyone reaches the platform. New drivers register
   first, which files a recruitment application at the same time.

   Passwords are salted and hashed with SHA-256 through the Web
   Crypto API, so nothing readable is written to storage. This is
   still browser-side: it stops casual snooping of localStorage, it
   is NOT a substitute for server-side authentication. When the HLL
   backend exists, Accounts.verify() is the single call to replace.
   ============================================================ */
const LS_ACCOUNTS = 'hll.accounts.v1';

const Accounts = {
  all() {
    try { return JSON.parse(localStorage.getItem(LS_ACCOUNTS) || '[]'); }
    catch (e) { return []; }
  },
  save(list) {
    if (typeof Sync !== 'undefined' && Sync.on && Sync.on() && !Sync.applying) Sync.push();
    try { localStorage.setItem(LS_ACCOUNTS, JSON.stringify(list)); }
    catch (e) { console.warn('[HLL] could not persist accounts', e); }
  },
  find(handle) {
    const h = String(handle || '').trim().toLowerCase();
    if (!h) return null;
    return this.all().find((a) =>
      a.email.toLowerCase() === h ||
      a.driverId.toLowerCase() === h ||
      (a.username || '').toLowerCase() === h) || null;
  },

  randomSalt() {
    const b = new Uint8Array(16);
    (window.crypto || window.msCrypto).getRandomValues(b);
    return Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  },
  async hash(password, salt) {
    const subtle = window.crypto && window.crypto.subtle;
    const data = new TextEncoder().encode(salt + '::' + password);
    if (subtle) {
      const buf = await subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(buf)).map((x) => x.toString(16).padStart(2, '0')).join('');
    }
    /* file:// in some browsers has no SubtleCrypto; degrade rather than break */
    let h = 0x811c9dc5;
    for (let i = 0; i < data.length; i++) { h ^= data[i]; h = Math.imul(h, 0x01000193) >>> 0; }
    return 'weak-' + h.toString(16);
  },

  /* true until somebody has created the owner account */
  needsSetup() { return this.all().length === 0; },

  /* the next free driver number; Math.max of nothing is -Infinity, which is
     exactly the case a brand new company hits */
  nextDriverId() {
    const ids = Store.db.drivers.map((d) => +String(d.id).split('-')[1]).filter(Number.isFinite);
    return 'HLL-' + (Math.max(1000, ...ids) + 1);
  },

  /* staff create logins for drivers who did not register themselves */
  async createForDriver(driver, email, password) {
    const list = this.all();
    if (list.some((a) => a.email.toLowerCase() === email.toLowerCase())) {
      return { error: 'An account already uses that email address.' };
    }
    if (list.some((a) => a.driverId === driver.id)) {
      return { error: 'That driver already has a login.' };
    }
    const salt = this.randomSalt();
    const account = {
      driverId: driver.id, name: driver.name, email: email.trim(),
      country: driver.country, discord: driver.discord,
      salt, hash: await this.hash(password, salt),
      created: new Date().toISOString(), status: 'active',
    };
    list.push(account);
    this.save(list);
    return { account };
  },

  /* One registration writes four things, in this order:

       Supabase Auth user  --+
                             | user.id
       drivers row  <--------+  auth_user_id
       applications row         driver_id, as the HLL driver code
       local record             what the platform actually draws with

     The order is the point: verify() finds a driver by auth_user_id, so the
     Auth user has to exist before the row that points at it.

     applications.driver_id is text and has no foreign key behind it, so it
     holds the driver code rather than the bigint drivers.id. Nothing in the
     database stops it holding a code that belongs to nobody.

     A failure at any step throws — nothing further is written, and the
     caller puts the message on the form. */
  async register(account, password, country = 'Not set') {
    try {
      /* ============================================================
         1. CREATE SUPABASE AUTH USER
         ============================================================ */

      const driverId = 'HLL' + String(Math.floor(1000 + Math.random() * 9000));

      /* The founding account. account.owner is what the owner setup screen
         sends; the address is the one this company was opened with. */
      const isOwner = account.owner === true
        || account.email === 'jeffboss730@gmail.com';

      const role = isOwner ? 'admin' : 'driver';

      if (!window.hllSupabase) {
        throw new Error('Supabase is not connected. Please try again.');
      }

      const { data: authData, error: authError } =
        await window.hllSupabase.auth.signUp({
          email: account.email,
          password: password,

          options: {
            data: {
              full_name: account.name,
              driver_code: driverId,
              role: role,
              country: country || 'Not set'
            }
          }
        });

      if (authError) {
        console.error('[HLL] Supabase Auth registration failed:', authError);

        /* A sign-up that failed after the Auth user was made leaves that user
           behind — the browser cannot delete it, that needs the service key.
           So the second attempt on the same address is refused for a reason
           that sounds like a mistake and is really the first attempt's
           remains. Say so, and point at the way through. */
        if (/already registered|already exists/i.test(authError.message || '')) {
          throw new Error(
            'That email address already has a Heavyline sign-in.\n\n'
            + 'If this is you and an earlier attempt failed part way, the '
            + 'sign-in survived — use Sign in with the same password, or '
            + 'reset it from the sign-in tab. There is no need to register '
            + 'again.');
        }

        throw authError;
      }

      const user = authData && authData.user;

      if (!user) {
        throw new Error('Supabase created no Auth user.');
      }

      console.log('[HLL] Supabase Auth user created:', {
        id: user.id,
        email: user.email,
        driver_code: driverId
      });


      /* ============================================================
         2. CREATE HEAVYLINE DRIVER ROW
         ============================================================ */

      /* The row is made by a trigger on auth.users — see
         supabase/migrations/20260903_driver_row_on_signup.sql. It has to
         be, because with email confirmation on signUp() returns a user and
         no session, so there is no auth.uid() yet and the insert policy
         (auth.uid() = auth_user_id) refuses the one person entitled to
         make the row. That is the "new row violates row-level security
         policy for table drivers" a new driver was seeing.

         Give the trigger a moment, then read what it made. */
      let driver = null;
      for (let tries = 0; tries < 5 && !driver; tries++) {
        if (tries) await new Promise((r) => setTimeout(r, 250));
        const { data } = await window.hllSupabase
          .from('drivers')
          .select('*')
          .eq('auth_user_id', user.id)
          .maybeSingle();
        driver = data || null;
      }

      if (driver) {
        console.log('[HLL] Driver record created by Supabase:', driver);
      }

      /* No trigger installed yet: fall back to making it here. This only
         works when there is a session — that is, with email confirmation
         off — which is exactly the case where it used to work. */
      const { data: inserted, error: driverError } = driver
        ? { data: driver, error: null }
        : await window.hllSupabase
          .from('drivers')
          .insert({
            /* Every column public.drivers actually has. country is not one
               of them — sending it fails the insert with 42703 and takes
               registration down here, leaving an Auth user with nothing to
               sign in to. The country is kept on the local record and in the
               Auth metadata until the migration adds the column. */
            driver_code: driverId,
            full_name: account.name,
            email: account.email,
            role: role,
            status: 'pending',
            auth_user_id: user.id
          })
          .select()
          .maybeSingle();

      driver = inserted || driver;

      /* Nothing made the row, and nothing said why. Almost always the
         trigger is not installed and email confirmation is on, so the
         browser could not make it either — name that, rather than
         repeating Supabase's wording at somebody who cannot act on it. */
      if (!driverError && !driver) {
        throw new Error('Your account was created but your driver record was '
          + 'not. Run supabase/migrations/20260903_driver_row_on_signup.sql, '
          + 'which makes that record on the database side where it is allowed '
          + 'to, then sign in — the record will be waiting.');
      }

      if (driverError) {
        console.error('[HLL] Failed to create driver row:', driverError);

        /* This failure has exactly one shape and two possible cures, and
           "new row violates row-level security policy for table drivers"
           names neither of them. Anyone reading that on a sign-up form can
           do nothing with it.

           The policy on this table is with check (auth.uid() = auth_user_id),
           which is correct — it stops anybody creating a driver record for
           somebody else. But when email confirmation is on, signUp() hands
           back a user and no session, so there is no auth.uid() yet and the
           insert is refused for the one person entitled to make it.

           Whether a session came back tells us which cure to name. */
        const refused = driverError.code === '42501'
          || /row-level security/i.test(driverError.message || '');

        if (refused) {
          const noSession = !(authData && authData.session);

          throw new Error(
            'Your sign-in was created, but your driver record could not be — '
            + 'the database refused it.\n\n'
            + (noSession
              ? 'Email confirmation is on, so there is no session yet and the '
                + 'browser is not allowed to write that record. The database '
                + 'has to make it instead: run '
                + 'supabase/migrations/20260903_driver_row_on_signup.sql in '
                + 'the Supabase SQL editor. It also creates the record for '
                + 'anyone already stuck like this, so afterwards just sign in '
                + 'with the details you have entered here.'
              : 'A session was returned, so this is a policy problem rather '
                + 'than a timing one. Run supabase/setup.sql, which creates '
                + 'the insert policy this needs.'));
        }

        /* The Auth user exists but has nothing to sign in to. Stop here
           rather than filing an application against a driver that is not
           there. */
        throw driverError;
      }

      console.log('[HLL] Heavyline driver created:', driver);


      /* ============================================================
         3. CREATE DRIVER APPLICATION
         ============================================================ */

      let application = null;

      if (!isOwner) {
        application = {
          id: 'APP-' + Math.floor(9100 + Math.random() * 900),
          name: account.name,
          age: null,
          email: account.email,
          discord: account.discord || '',
          truckersmp: '',
          country: country || 'Not set',
          experience: 'Not stated',
          hours: 0,
          previousVtc: 'None',
          why: 'Registered through the Heavyline platform.',
          status: 'pending',
          submitted: account.created || new Date().toISOString(),
          notes: [],
          submittedBy: driverId
        };

        /* reviewed_by is who is handling this, not who filed it. reviewed_at
           stays null until a decision is actually made, which is what
           separates "assigned to him" from "decided by him". */
        const recruiterId = await recruiterSupabaseId();
        application.assignedTo = recruiterId;

        /* the same link, kept locally so a pulled row can be matched back
           to this record without going through the email */
        application.driverSupabaseId = driver.id;

        /* keep the local application */
        Store.db.applications.unshift(application);

        /* select() so the new row comes back — its id is what setStatus
           needs later to move this application through the stages. An
           insert on its own returns no data. */
        const { data: savedApplication, error: applicationError } =
          await window.hllSupabase
            .from('applications')
            .insert({
              full_name: application.name,
              email: application.email,
              country: application.country || 'Not set',
              status: 'pending',

              /* Who applied — the primary key of the drivers row written a
                 moment ago, not the HLL code and not the auth uuid.

                 The column is text and carries no foreign key, so Postgres
                 stores the number as a string and enforces nothing. The
                 migration file has the SQL to make it a real bigint
                 reference. */
              driver_id: driver.id,

              /* who is handling it, not who decided it — reviewed_at stays
                 null until somebody actually decides */
              reviewed_by: recruiterId,
              onboarding_status: 'pending'
            })
            .select()
            .maybeSingle();

        if (applicationError) {
          console.error(
            '[HLL] Could not file the registration application:',
            applicationError
          );

          /* The driver row is already written. Take it back out, or the
             person is left half-registered: a driver record with no
             application, which the recruitment screen will never show and
             nobody will ever action. */
          const { error: rollbackError } = await window.hllSupabase
            .from('drivers')
            .delete()
            .eq('id', driver.id);

          if (rollbackError) {
            console.warn('[HLL] Rolled back driver row', driver.id,
              '— the Auth user remains and must be removed in Supabase.');
          }

          throw applicationError;
        }

        /* the row this application is, so setStatus can find it again */
        application.supabaseId = savedApplication ? savedApplication.id : null;

        console.log('[HLL] Registration application saved:', savedApplication);
      }


      /* ============================================================
         4. KEEP LOCAL RECORDS FOR THE EXISTING UI
         ============================================================ */

      /* The local login list is still written, even though verify() no longer
         reads it. purgeOrphanDrivers() runs on every boot and deletes any
         local driver whose id is not in this list — so without it the driver
         record written just below disappears on the next reload, taking their
         tickets and notifications with it. */
      const salt = this.randomSalt();
      const list = this.all();
      list.push({
        driverId,
        name: account.name,
        email: account.email,
        country: country || 'Not set',
        discord: account.discord || '',
        salt,
        hash: await this.hash(password, salt),
        created: account.created || new Date().toISOString(),
        /* the owner is active from the start; everyone else waits */
        status: isOwner ? 'active' : 'pending'
      });
      this.save(list);

      Store.db.drivers.push({
        id: driverId,
        supabaseId: driver.id,
        authUserId: user.id,

        name: account.name,
        initials: initials(account.name),
        country: country || 'Not set',
        joined: account.created || new Date().toISOString(),
        status: 'offline',

        km: 0,
        deliveries: 0,
        convoys: 0,
        attendance: 100,

        role: role,
        accountStatus: 'active',

        discord: account.discord
          || account.name.toLowerCase().replace(/\W/g, ''),

        truckersmp: '',
        truckId: null,
        trailerId: null,

        bio: '',
        achievements: [],
        rankIdx: 0,

        weekKm: 0,
        monthKm: 0,
        seasonPoints: 0,

        lastSeen: account.created || new Date().toISOString(),
        email: account.email,

        /* The owner has the client from the start; everybody else is
           released it by a recruiter. */
        clientAccess: isOwner
      });


      /* ============================================================
         5. ACTIVITY / NOTIFICATION
         ============================================================ */

      Store.logActivity(driverId, 'join', 'userPlus',
        isOwner ? account.name + ' opened Heavyline Logistics'
                : account.name + ' registered and is waiting to be let in',
        '', !isOwner);   /* the fleet hears about them when they are approved */

      if (isOwner) {
        Store.db.meta.founded = account.created || new Date().toISOString();
      } else {
        const notice = {
          type: 'info',
          icon: 'userPlus',
          title: 'New driver signed up',
          body: account.name + ' has registered and is waiting to be let in. '
            + 'Approve them to release the Heavyline Trucker download.',
          href: '#/admin'
        };

        /* The recruiter is told directly. notifyStaff only reaches drivers
           whose record happens to be in this browser's copy of the company,
           and a person registering on a fresh machine may not have pulled
           one yet — so the one notification that matters is not left to
           that. It travels to him in the company payload. */
        const recruiter = recruiterDriver();

        if (recruiter) {
          Store.notify(recruiter.id, {
            ...notice,
            title: 'New application for you',
            body: account.name + ' has applied to drive and is waiting on you. '
              + 'Approve them to release the Heavyline Trucker download.'
          });
        }

        /* and everybody else who recruits, minus him — no duplicate */
        notifyStaff('recruitment.manage', notice, recruiter ? recruiter.id : undefined);
      }


      /* ============================================================
         6. SAVE LOCAL DATABASE
         ============================================================ */

      Store.save();

      console.log('[HLL] Registration completed successfully:', {
        auth_user_id: user.id,
        driver_code: driverId,
        driver_uuid: driver.id,
        role: role
      });

      return {
        account,
        user,
        driver,
        application: isOwner ? null : true
      };

    } catch (error) {
      console.error('[HLL] Registration failed:', error);
      throw error;
    }
  },

/* A `drivers` row is not the shape the app draws with: the columns are
   snake_case, the primary key is a Supabase uuid, and the fleet numbers the
   platform shows (distance, rank, achievements) have no column at all yet.

   This is the one place that difference lives. Identity comes from Supabase —
   it is the thing that just proved itself. Everything with no column keeps
   coming from the local record, matched on driver_code, so the platform still
   renders while the remaining tables do not exist. Every field defaulted here
   is a column still to be added; see MIGRATION below. */
fromRow(row, authUser) {
    /* driver_code is the id the whole platform is keyed on — HLL-1001. The
       Supabase uuid is carried alongside for writes, not used as the id: the
       app joins on it in 213 places and every stored reference uses it. */
    const id = row.driver_code || row.id;
    /* Store.load() has always run by the time anything calls this — a form
       submit, or the boot restore — so db is there. */
    const local = Store.db ? Store.driver(id) : null;

    return {
        ...(local || {}),

        /* --- Supabase is the source of truth for identity --- */
        id,
        supabaseId: row.id,
        authUserId: row.auth_user_id,
        name: row.full_name || (local && local.name) || 'Driver',
        email: row.email || (authUser && authUser.email) || '',
        country: row.country || (local && local.country) || 'Not set',
        discord: row.discord || (local && local.discord) || '',
        status: row.status || 'offline',
        accountStatus: row.account_status || 'active',

        /* --- columns that exist, but only sometimes carry a value --- */
        attendance: row.attendance ?? (local && local.attendance) ?? 100,
        convoys: row.convoys ?? (local && local.convoys) ?? 0,

        /* drivers.role does exist, and it decides what somebody may do.
           Reading it off the local record instead meant a recruiter signing
           in on a machine that had never seen them came through as a plain
           driver — level 1, no recruitment screen, no application to
           action. Supabase is the authority on who someone is; that has to
           include what they are. */
        role: row.role || (local && local.role) || 'driver',

        /* --- no column yet: local record, then a safe default --- */
        initials: (local && local.initials) || initials(row.full_name || 'Driver'),
        rankIdx: (local && local.rankIdx) ?? 0,
        km: (local && local.km) ?? 0,
        deliveries: (local && local.deliveries) ?? 0,
        clientAccess: (local && local.clientAccess) ?? false,
        achievements: (local && local.achievements) || [],
        joined: (local && local.joined) || row.created_at || new Date().toISOString(),
    };
},

async verify(handle, password) {
    try {
        const email = String(handle || '').trim().toLowerCase();
        const pass = String(password || '');

        if (!email || !pass) {
            return {
                error: 'Enter your email and password.'
            };
        }

        // Make sure Supabase is available
        if (!window.hllSupabase) {
            console.error('[HLL] Supabase client is missing.');

            return {
                error: 'Supabase is not connected.'
            };
        }

        // Authenticate using Supabase Auth
        const { data, error } =
            await window.hllSupabase.auth.signInWithPassword({
                email: email,
                password: pass
            });

        if (error) {
            console.error(
                '[HLL] Supabase authentication failed:',
                error
            );

            return {
                error: error.message || 'Login failed.'
            };
        }

        const user = data?.user;

        if (!user) {
            return {
                error: 'Login failed. No user was returned.'
            };
        }

        console.log('[HLL] Supabase user authenticated:', {
            id: user.id,
            email: user.email
        });

        // Find the Heavyline driver linked to this Auth user
        const { data: driver, error: driverError } =
            await window.hllSupabase
                .from('drivers')
                .select('*')
                .eq('auth_user_id', user.id)
                .maybeSingle();

        if (driverError || !driver) {
            console.error(
                '[HLL] Driver lookup failed:',
                driverError
            );

            await window.hllSupabase.auth.signOut();

            return {
                error:
                    'Your login is valid, but your Heavyline driver account is not linked. Contact management.'
            };
        }

        // Check account status
        if (
            driver.status === 'suspended' ||
            driver.account_status === 'suspended'
        ) {
            await window.hllSupabase.auth.signOut();

            return {
                error:
                    'This account is suspended. Contact HLL management.'
            };
        }

        console.log('[HLL] Heavyline driver authenticated:', {
            driverId: driver.id,
            driverCode: driver.driver_code,
            name: driver.full_name,
            email: driver.email
        });

        /* The rest of the app renders a driver, not a database row. Hand it
           one. Both call sites read { error } | { account, driver }. */
        return {
            account: {
                email: user.email,
                driverId: driver.driver_code,
            },
            driver: Accounts.fromRow(driver, user),
            user: user,
            session: data.session,
        };

    } catch (err) {
        console.error('[HLL] Authentication error:', err);

        return {
            error: err.message || 'Login failed.'
        };
    }
  },
};

/* ============================================================
   THE OWNER ACCOUNT
   ------------------------------------------------------------
   Heavyline ships with its owner already provisioned, so there is
   no setup step and no window in which the company has no
   administrator.

   The password is not here. What is stored is a random salt and
   the SHA-256 of salt + '::' + password — the same shape every
   other account has — so reading this file does not hand anyone
   the password. Be aware that it is still a hash sitting in a
   public file: it resists a glance, not an offline attack. Change
   it from Settings and this seed stops mattering.
   ============================================================ */
/* ============================================================
   THE RECRUITER
   ------------------------------------------------------------
   Applications are addressed to a person, not to a permission
   level. This is that person: they are told the moment somebody
   applies, and they are the one the application is put in front
   of to decide.

   Held as the Supabase auth uid, because it is the only thing
   about an account that does not change. A driver code can be
   reissued and an email can be edited; the uid is the account.
   ============================================================ */
const RECRUITER_AUTH_ID = '5aa94154-a4de-4ede-b6db-9aae677966d4';
const RECRUITER_EMAIL = 'jeffboss730@gmail.com';

/* The recruiter's local driver record — what Store.notify and the
   recruitment screen are keyed on.

   Three ways in, because the same person is identified differently
   depending on how their record was made: a driver registered through
   this build carries the auth uid, one pulled from the company blob may
   only carry the email, and the seeded owner predates both. */
function recruiterDriver() {
  const list = Store.db && Array.isArray(Store.db.drivers) ? Store.db.drivers : [];
  return list.find((d) => d.authUserId === RECRUITER_AUTH_ID)
    || list.find((d) => String(d.email || '').toLowerCase() === RECRUITER_EMAIL)
    || (Store.db ? Store.driver(OWNER_SEED.driverId) : null)
    || null;
}

/* The recruiter's drivers.id — the uuid, which is what
   applications.reviewed_by is a foreign key onto. Cached on the local
   record once resolved, so this is one query per browser and not one per
   registration. */
async function recruiterSupabaseId() {
  const local = recruiterDriver();
  if (local && local.supabaseId) return local.supabaseId;
  if (!window.hllSupabase) return null;

  try {
    const { data, error } = await window.hllSupabase
      .from('drivers')
      .select('id')
      .eq('auth_user_id', RECRUITER_AUTH_ID)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      console.warn('[HLL] No drivers row for the recruiter:', RECRUITER_AUTH_ID);
      return null;
    }

    if (local) local.supabaseId = data.id;
    return data.id;

  } catch (error) {
    /* Not fatal. The application is still filed; it just goes in
       unassigned, and the recruiter still gets the notification. */
    console.warn('[HLL] Could not resolve the recruiter driver row:', error);
    return null;
  }
}

/* Where the company talks. A driver has been asked for a Discord username
   since the application form existed, and until now the platform never once
   told them where to actually go — the word appeared eleven times and the
   server appeared nowhere.

   Kept as a constant because it is quoted on the community page, on the
   application form and in the welcome a new driver is sent, and an invite
   that has been changed in two of those three places is worse than none. */
const DISCORD_INVITE = 'https://discord.gg/zWvwPsyDK';

/* Where this platform lives, as far as the outside world is concerned.

   This matters for one thing above all: the address a password-reset email
   points back at. That link is opened later, on whatever machine the person
   happens to be at, so it cannot be built from the origin the request was
   made from — a driver who asked for a reset while the site was open on a
   dev server got an email pointing at localhost:3000, which is nothing at
   all on their machine.

   tools/build-www.js writes window.HLL_SITE_URL into the pages it builds,
   from site.config.json. Falling back to the origin keeps development
   working, where localhost really is the right answer. */
function publicSiteUrl() {
  try {
    if (typeof window !== 'undefined' && window.HLL_SITE_URL) {
      return String(window.HLL_SITE_URL).replace(/\/$/, '');
    }
  } catch (e) { /* nothing to go on */ }
  return String(location.origin || '').replace(/\/$/, '');
}

/* target and rel together: an invite opens away from the platform, and
   without noopener the page it opens can reach back into this one */
function discordLink(label, cls) {
  return '<a class="' + (cls || 'btn btn-primary') + '" href="' + DISCORD_INVITE
    + '" target="_blank" rel="noopener noreferrer">'
    + icon('discord') + esc(label || 'Join the Discord') + '</a>';
}

const OWNER_SEED = {
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
};

/* Runs on every boot.

   It reconciles rather than only creating. An install that has been through
   an earlier build may already hold an account on this id or this address
   with a different password on it, and that account would shadow the owner
   for good — you would be told the password is wrong, with no way to put it
   right. So: if the shipped credentials are not the ones stored, they are
   made the ones stored. Nothing else about the record is disturbed.

   A password changed from Settings clears `ownerSeed`, and from then on this
   leaves the account alone. */
function provisionOwner() {
  const list = Accounts.all();
  const created = new Date().toISOString();

  const existing = list.find((a) => a.driverId === OWNER_SEED.driverId
    || String(a.email).toLowerCase() === OWNER_SEED.email.toLowerCase());

  if (existing) {
    /* somebody has set their own password: that decision stands */
    if (existing.ownerSeed === false) return false;
    const stale = existing.salt !== OWNER_SEED.salt
      || existing.hash !== OWNER_SEED.hash
      || String(existing.email).toLowerCase() !== OWNER_SEED.email.toLowerCase();
    if (stale) {
      Object.assign(existing, {
        driverId: OWNER_SEED.driverId, email: OWNER_SEED.email,
        salt: OWNER_SEED.salt, hash: OWNER_SEED.hash, weakHash: OWNER_SEED.weakHash,
        status: 'active', ownerSeed: true,
      });
      Accounts.save(list);
      console.info('[HLL] owner sign-in details restored to the ones this build ships with');
    }
  } else {
    list.push(Object.assign({}, OWNER_SEED, { created, status: 'active' }));
    Accounts.save(list);
  }

  const db = Store.db;
  const rec = db.drivers.find((d) => d.id === OWNER_SEED.driverId);
  if (rec) {
    /* the owner is always active, always top role, and never gated
       out of their own client download */
    if (rec.role !== 'super_admin' || rec.accountStatus !== 'active' || !rec.clientAccess) {
      rec.role = 'super_admin';
      rec.accountStatus = 'active';
      rec.clientAccess = true;
      Store.save();
    }
  } else {
    db.drivers.push({
      id: OWNER_SEED.driverId, name: OWNER_SEED.name, initials: initials(OWNER_SEED.name),
      country: OWNER_SEED.country, joined: created, status: 'offline',
      km: 0, deliveries: 0, convoys: 0, attendance: 100,
      role: 'super_admin', accountStatus: 'active',
      discord: OWNER_SEED.discord, truckersmp: '', truckId: null, trailerId: null,
      bio: '', achievements: [], rankIdx: 0,
      weekKm: 0, monthKm: 0, seasonPoints: 0, lastSeen: created,
      email: OWNER_SEED.email, clientAccess: true,
    });
  }
  if (!db.meta.founded) db.meta.founded = created;
  Store.save();
  return true;
}

/* Change the signed-in account's password for real.

   The old button only raised a toast, which is worse than no button: it told
   people their password had changed when nothing had. */
async function changePassword() {
  const cur = $('#sec-cur') ? $('#sec-cur').value : '';
  const next = $('#sec-new') ? $('#sec-new').value : '';
  const again = $('#sec-new2') ? $('#sec-new2').value : '';

  if (!cur || !next) { toast('Fill both password fields', 'warn'); return; }
  if (next.length < 8) { toast('Use at least 8 characters', 'warn'); return; }
  if (next !== again) { toast('The two new passwords do not match', 'warn'); return; }
  if (next === cur) { toast('That is already your password', 'warn'); return; }

  if (!window.hllSupabase) { toast('Supabase is not connected', 'danger'); return; }

  /* Reauthenticate before changing anything. Note this takes the account's
     email: passing state.user.id sends a driver code — HLL-1001 — to a call
     that wants an address, and it is rejected every time. */
  const email = state.user.email;
  if (!email) { toast('This account has no email on record', 'danger'); return; }

  const { error: authError } =
    await window.hllSupabase.auth.signInWithPassword({ email, password: cur });
  if (authError) { toast('Your current password is not right', 'danger'); return; }

  const { error: updateError } =
    await window.hllSupabase.auth.updateUser({ password: next });
  if (updateError) {
    console.error('[HLL] password update failed:', updateError);
    toast('Could not update the password', 'danger', updateError.message);
    return;
  }

  /* Supabase holds the password now, so the local salt/hash is no longer
     consulted by verify(). Clear it rather than leave a stale copy that looks
     authoritative. */
  const list = Accounts.all();
  const account = list.find((a) => a.driverId === state.user.id);
  if (account) {
    delete account.hash;
    delete account.weakHash;
    delete account.salt;
    account.ownerSeed = false;
    account.supabaseManaged = true;
    account.passwordChanged = new Date().toISOString();
    Accounts.save(list);
  }

  ['#sec-cur', '#sec-new', '#sec-new2'].forEach((s) => { if ($(s)) $(s).value = ''; });
  toast('Password updated', 'ok', 'Use the new one next time you sign in.');
}

/* ---------------- 5. Store (localStorage-backed, API-shaped) ---------------- */
const LS_DB = 'hll.db.v1';
const LS_SESSION = 'hll.session.v1';

const Store = {
  db: null,
  load() {
    try {
      const raw = localStorage.getItem(LS_DB);
      if (raw) { this.db = JSON.parse(raw); return this.db; }
    } catch (e) { console.warn('[HLL] store read failed, reseeding', e); }
    this.db = seedDB();
    this.save();
    return this.db;
  },
  save() {
    /* anything written locally is offered to the service a moment later */
    if (typeof Sync !== 'undefined' && Sync.on && Sync.on() && !Sync.applying) Sync.push();
    try { localStorage.setItem(LS_DB, JSON.stringify(this.db)); }
    catch (e) { console.warn('[HLL] store write failed', e); }
  },
  reset() {
    try {
      localStorage.removeItem(LS_DB);
      localStorage.removeItem(LS_SESSION);
      localStorage.removeItem(LS_ACCOUNTS);   /* else the logins outlive their drivers */
    } catch (e) {}
    this.db = seedDB(); this.save();
  },

  /* --- session --- */
  readSession() {
    try { return JSON.parse(localStorage.getItem(LS_SESSION) || 'null'); } catch (e) { return null; }
  },
  writeSession(s) {
    try { s ? localStorage.setItem(LS_SESSION, JSON.stringify(s)) : localStorage.removeItem(LS_SESSION); }
    catch (e) {}
  },

  /* --- queries --- */
  driver(id) { return byId(this.db.drivers, id); },
  truck(id)  { return byId(this.db.trucks, id); },
  trailer(id){ return byId(this.db.trailers, id); },
  event(id)  { return byId(this.db.events, id); },
  ticket(id) { return byId(this.db.tickets, id); },
  application(id) { return byId(this.db.applications, id); },

  upcomingEvents() {
    const now = Date.now();
    return this.db.events.filter((e) => e.status !== 'completed' && e.status !== 'cancelled' && new Date(e.date) > now - 6 * 3.6e6)
      .sort((a, b) => new Date(a.date) - new Date(b.date));
  },
  pastEvents() {
    return this.db.events.filter((e) => e.status === 'completed')
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },
  registrationOf(ev, driverId) { return ev.registered.find((r) => r.driverId === driverId); },

  leaderboard(metric = 'km', period = 'all') {
    const field = { km: 'km', deliveries: 'deliveries', convoys: 'convoys', attendance: 'attendance' }[metric] || 'km';
    const scale = { week: 0.02, month: 0.09, year: 0.55, all: 1 }[period] ?? 1;
    return this.db.drivers
      .filter((d) => d.accountStatus === 'active')
      .map((d) => ({
        driver: d,
        value: field === 'attendance' ? d.attendance
             : period === 'week' && field === 'km' ? d.weekKm
             : period === 'month' && field === 'km' ? d.monthKm
             : Math.round(d[field] * scale),
      }))
      .sort((a, b) => b.value - a.value);
  },
  rankPosition(driverId, metric = 'km', period = 'all') {
    const lb = this.leaderboard(metric, period);
    return lb.findIndex((r) => r.driver.id === driverId) + 1;
  },

  notificationsFor(driverId) {
    return this.db.notifications.filter((n) => !n.driverId || n.driverId === driverId)
      .sort((a, b) => new Date(b.at) - new Date(a.at));
  },
  unreadCount(driverId) { return this.notificationsFor(driverId).filter((n) => !n.read).length },

  /* --- mutations --- */
  notify(driverId, { type = 'info', icon = 'info', title, body = '', href = '' }) {
    this.db.notifications.unshift({ id: uid('n'), driverId, type, icon, title, body, href, at: new Date().toISOString(), read: false });
    this.db.notifications = this.db.notifications.slice(0, 300);
    this.save();
  },
  /* `staffOnly` keeps company business — who signed up, who was approved,
     who was suspended — off the feed every driver reads. */
  logActivity(driverId, kind, icon, text, meta = '', staffOnly = false) {
    this.db.activity.unshift({ id: uid('act'), kind, icon, driverId, text, meta,
      staffOnly: !!staffOnly, at: new Date().toISOString() });
    this.db.activity = this.db.activity.slice(0, 200);
    this.save();
  },
  /* the feed as a given driver is allowed to see it */
  activityFor(user) {
    const staff = can('admin.view', user);
    return this.db.activity.filter((a) => staff || !a.staffOnly);
  },
};



/* Make the company record match the shape the views assume.

   Two apps write this store — the platform and the client — and a record
   carried over from an older build can be missing a field that was added
   since. Four separate convoy views crashed on an event with no `path`,
   which is the sort of thing that should be impossible rather than caught
   in four places. Everything below is a shape guarantee, not a default:
   nothing here invents content. */
function normaliseCompany() {
  const db = Store.db;
  if (!db) return 0;
  let fixed = 0;
  const arr = (o, k) => { if (!Array.isArray(o[k])) { o[k] = []; fixed++; } };

  ['drivers', 'trucks', 'trailers', 'events', 'applications', 'assignments', 'jobs',
   'tickets', 'announcements', 'notifications', 'activity', 'sessions'].forEach((k) => arr(db, k));
  if (!db.meta || typeof db.meta !== 'object') { db.meta = { season: new Date().getFullYear() + ' Season', founded: null }; fixed++; }

  db.events.forEach((e) => {
    arr(e, 'path');
    arr(e, 'registered');
    arr(e, 'instructions');
    /* what happened on the convoy, kept for good — who joined, who actually
       turned up, who finished. Chat is deliberately not kept here; see the
       note on the service's convoy endpoints. */
    arr(e, 'activity');
    if (typeof e.distance !== 'number') { e.distance = 0; fixed++; }
    if (!e.status) { e.status = 'scheduled'; fixed++; }
    if (!CONVOY_STATES[e.status]) { e.status = 'scheduled'; fixed++; }
    /* convoys made before the leader was put on the roster */
    if (e.leaderId && Array.isArray(e.registered)
      && !e.registered.some((r) => r.driverId === e.leaderId)
      && (db.drivers || []).some((x) => x.id === e.leaderId)) {
      e.registered.unshift({ driverId: e.leaderId, state: 'confirmed', leader: true });
      fixed++;
    }
  });
  db.drivers.forEach((d) => {
    arr(d, 'achievements');
    if (typeof d.rankIdx !== 'number') { d.rankIdx = 0; fixed++; }
    if (!d.accountStatus) { d.accountStatus = 'active'; fixed++; }
    if (!d.role) { d.role = 'driver'; fixed++; }
    if (!d.initials) { d.initials = initials(d.name || '?'); fixed++; }
    /* Money earned arrived after the first records did, so a driver from an
       older install has none. Their finished runs carry it, so the total is
       recovered from those rather than started from zero — a driver does not
       lose their earnings because the field was added later. */
    if (typeof d.earned !== 'number') {
      d.earned = (db.jobs || [])
        .filter((j) => j.driverId === d.id)
        .reduce((sum, j) => sum + (j.income || 0), 0);
      fixed++;
    }
  });

  /* a session left open by a client that was closed mid-run would otherwise
     count as "still playing" for ever */
  const STALE_SESSION = 12 * 3600 * 1000;
  db.sessions.forEach((s) => {
    if (s.ended || !s.started) return;
    if (Date.now() - new Date(s.started).getTime() > STALE_SESSION) {
      s.ended = new Date(new Date(s.started).getTime() + STALE_SESSION).toISOString();
      s.abandoned = true;
      fixed++;
    }
  });
  db.tickets.forEach((t) => arr(t, 'messages'));
  db.applications.forEach((a) => arr(a, 'notes'));

  if (fixed) { Store.save(); console.info('[HLL] repaired ' + fixed + ' missing field(s) on the company record'); }
  return fixed;
}


/* Clear the company back to its owner.

   Runs once per install, stamped so it never fires twice — otherwise nobody
   could ever register again. It removes every account and driver except the
   owner's, and everything that hung off them: applications, tickets,
   notifications, activity and convoy sign-ups.

   The owner is left as a full driver as well as the administrator, so the
   same login runs the company and drives for it. */
const RESET_STAMP = 'hll.resetToOwner.v2';

/* Empties the company back to its owner. Only records belonging to someone
   else go — the owner's own tickets, applications and history survive, so a
   later re-run cannot wipe work the company has done since. */
   
function resetToOwner() {

  try {
    if (localStorage.getItem(RESET_STAMP)) return 0;
  } catch (e) {
    return 0;
  }

  const keepId = OWNER_SEED.driverId;

  const mine = (v) => !v || v === keepId;

  const accounts = Accounts.all();
  const others = accounts.filter((a) => a.driverId !== keepId);

  if (others.length) {
    Accounts.save(
      accounts.filter((a) => a.driverId === keepId)
    );
  }

  const db = Store.db;

  /*
   * Drivers
   * Keep only the owner driver.
   */
  const removedDrivers = (db.drivers || [])
    .filter((d) => d.id !== keepId);

  db.drivers = (db.drivers || [])
    .filter((d) => d.id === keepId);

  /*
   * IMPORTANT:
   *
   * Applications are NOT touched here.
   *
   * Supabase is the source of truth for recruitment
   * applications. Applications.pull() is responsible for
   * replacing Store.db.applications with the Supabase data.
   *
   * Do NOT filter, seed, restore, or preserve applications
   * from the local company blob.
   */

  db.tickets = (db.tickets || [])
    .filter((t) => mine(t.driverId));

  db.notifications = (db.notifications || [])
    .filter((n) => mine(n.driverId));

  db.activity = (db.activity || [])
    .filter((a) => mine(a.driverId));

  db.assignments = (db.assignments || [])
    .filter((a) => mine(a.driverId));

  db.jobs = (db.jobs || [])
    .filter((j) => mine(j.driverId));

  (db.events || []).forEach((e) => {

    if (Array.isArray(e.registered)) {
      e.registered = e.registered.filter(
        (r) => mine(r.driverId)
      );
    }

    if (e.leaderId && e.leaderId !== keepId) {
      e.leaderId = null;
    }

  });

  (db.trucks || []).forEach((t) => {

    if (t.assignedTo && t.assignedTo !== keepId) {
      t.assignedTo = null;
    }

  });

  db.announcements = (db.announcements || [])
    .filter((a) => mine(a.author));

  Store.save();

  try {
    localStorage.setItem(
      RESET_STAMP,
      new Date().toISOString()
    );
  } catch (e) {}

  const n = removedDrivers.length + others.length;

  if (n) {

    console.info(
      '[HLL] company cleared back to its owner — removed '
      + removedDrivers.length
      + ' driver record(s) and '
      + others.length
      + ' login(s)'
    );

  }

  return n;
}

/* The owner drives as well as runs the company, so their record has to be a
   complete driver record rather than an administrator stub. */
function ensureOwnerDrives() {
  const d = Store.driver(OWNER_SEED.driverId);
  if (!d) return false;
  let changed = false;
  const want = {
    role: 'super_admin', accountStatus: 'active', clientAccess: true,
    status: d.status || 'offline',
  };
  for (const k in want) { if (d[k] !== want[k]) { d[k] = want[k]; changed = true; } }
  ['km', 'deliveries', 'convoys', 'weekKm', 'monthKm', 'seasonPoints'].forEach((k) => {
    if (typeof d[k] !== 'number') { d[k] = 0; changed = true; }
  });
  if (typeof d.attendance !== 'number') { d.attendance = 100; changed = true; }
  if (typeof d.rankIdx !== 'number') { d.rankIdx = 0; changed = true; }
  if (!Array.isArray(d.achievements)) { d.achievements = []; changed = true; }
  if (!d.initials) { d.initials = initials(d.name || 'Jeff Boss'); changed = true; }
  if (!d.joined) { d.joined = new Date().toISOString(); changed = true; }
  if (changed) Store.save();
  return changed;
}

/* Sweep out records nobody can sign in to.

   Every real driver has an account: they either registered, or staff created
   one for them. A driver record with no account behind it is left over from
   the builds that shipped sample people, and it clutters the roster, the
   standings and the convoy sign-ups with names that are not anybody.

   Runs once per load, and says what it removed rather than doing it quietly. */
function purgeOrphanDrivers() {
  const db = Store.db;
  if (!db || !Array.isArray(db.drivers)) return 0;

  const ids = new Set(Accounts.all().map((a) => a.driverId));
  const orphans = db.drivers.filter((d) => !ids.has(d.id));
  if (!orphans.length) return 0;

  const gone = new Set(orphans.map((d) => d.id));
  db.drivers = db.drivers.filter((d) => !gone.has(d.id));

  /* and everything that pointed at them, so nothing is left dangling */
  (db.trucks || []).forEach((t) => { if (gone.has(t.assignedTo)) t.assignedTo = null; });
  (db.events || []).forEach((e) => {
    if (Array.isArray(e.registered)) e.registered = e.registered.filter((r) => !gone.has(r.driverId));
    if (gone.has(e.leaderId)) e.leaderId = null;
  });
  db.tickets = (db.tickets || []).filter((t) => !gone.has(t.driverId));
  db.applications = (db.applications || []).filter((a) => !a.submittedBy || !gone.has(a.submittedBy));
  db.announcements = (db.announcements || []).filter((a) => !gone.has(a.author));
  db.activity = (db.activity || []).filter((a) => !gone.has(a.driverId));
  db.notifications = (db.notifications || []).filter((n) => !gone.has(n.driverId));

  Store.save();
  console.info('[HLL] removed ' + orphans.length + ' driver record(s) with no account: '
    + orphans.map((d) => d.name + ' (' + d.id + ')').join(', '));
  return orphans.length;
}

/* Tell everyone who holds a permission. A broadcast (driverId null) would
   reach the whole fleet, and a sign-up is not the fleet's business. */
/* Tell everyone who holds a permission, optionally skipping one person —
   normally whoever caused the event, who does not need telling about it. */
function notifyStaff(perm, payload, exceptId) {
  const seen = Store.db.drivers.filter((d) => d.id !== exceptId && can(perm, d));
  seen.forEach((d) => Store.notify(d.id, payload));
  return seen.length;
}

/* ============================================================
   Part 2/6 — reusable UI components (charts, map, rig, chrome)
   ============================================================ */

/* ---------------- 6. Small chrome components ---------------- */
/* ---------------- the Heavyline emblem ----------------
   hll.jpg is the company's own artwork and the source every icon in the app
   is derived from. It is used as the emblem — the company's face — where a
   company's face belongs: the way in, the top of the command centre, and on
   a convoy, which is the company acting as one.

   It is deliberately not used as a general-purpose picture. Everything else
   stays on the stroked icon set, so the emblem keeps meaning "Heavyline"
   rather than becoming decoration.

   The artwork is square (1410x1414). Every size below is a square box with
   object-fit: cover, so it can never be stretched however it is placed. */
function hllEmblem(size = 'md', cls = '') {
  return `<span class="hll-emblem ${esc(size)} ${esc(cls)}">
    <img src="hll.jpg" alt="Heavyline Logistics" width="1410" height="1414" loading="lazy">
  </span>`;
}

function avatar(d, size = 40, ring = false) {
  const pres = d.status ? `<span class="presence ${d.status}"></span>` : '';
  /* one neutral tone for everyone; only the signed-in driver is tinted, so the
     accent colour still means something instead of being decoration */
  const me = state.user && d.id === state.user.id ? 'me' : '';
  return `<span class="avatar a-${size} ${me} ${ring ? 'avatar-ring' : ''}"
    title="${esc(d.name)}">${esc(d.initials || initials(d.name))}${pres}</span>`;
}
function avatarStack(drivers, max = 5, size = 32) {
  const shown = drivers.slice(0, max);
  const rest = drivers.length - shown.length;
  return `<div class="stack">${shown.map((d) => avatar(d, size)).join('')}
    ${rest > 0 ? `<span class="more">+${rest}</span>` : ''}</div>`;
}
function rankChip(d) {
  const r = rankOf(d);
  return `<span class="rank-chip"><span class="rank-ins" style="background:${r.color}">${r.abbr}</span>
    <span>${esc(r.name)}</span></span>`;
}
function roleBadge(role) {
  if (!role || role === 'driver') return '';
  const R = ROLES[role]; if (!R) return '';
  return `<span class="badge" style="color:${R.color};border-color:${R.color}44;background:${R.color}18">${esc(R.name)}</span>`;
}
function statusBadge(s) {
  const map = {
    active:      ['ok', 'Active'],       available: ['info', 'Available'],
    maintenance: ['warn', 'Maintenance'], retired:  ['', 'Retired'],
    scheduled:   ['info', 'Scheduled'],  live:      ['ok', 'Live now'],
    completed:   ['', 'Completed'],      cancelled: ['danger', 'Cancelled'],
    open:        ['info', 'Open'],       in_progress: ['warn', 'In progress'],
    resolved:    ['ok', 'Resolved'],     closed:    ['', 'Closed'],
    pending:     ['', 'Pending'],        review:    ['info', 'In review'],
    interview:   ['violet', 'Interview'], approved: ['ok', 'Approved'],
    rejected:    ['danger', 'Rejected'], suspended: ['danger', 'Suspended'],
    registered:  ['info', 'Registered'], confirmed: ['ok', 'Confirmed'],
    no_show:     ['danger', 'No show'],
    online:      ['ok', 'Online'],       driving:   ['info', 'Driving'], offline: ['', 'Offline'],
    low:         ['', 'Low'],            normal:    ['info', 'Normal'], high: ['danger', 'High'],
  };
  const [tone, label] = map[s] || ['', String(s || '')];
  const dot = (s === 'live') ? '<span class="live-dot"></span>' : '';
  return `<span class="badge ${tone}">${dot}${esc(label)}</span>`;
}
function statTile({ label, value, icon: ic, tone = 'brand', delta, sub, raw }) {
  const colors = { brand: 'var(--accent)', info: 'var(--info)', ok: 'var(--ok)', violet: 'var(--violet)', warn: 'var(--warn)' };
  /* only count up when the value starts with a plain number — "#4" or "1.2M km" stay static */
  const numeric = raw != null && /^[\d,]+(\.\d+)?(?!.*\d)/.test(String(value))
    ? String(value).match(/^[\d,]+(?:\.\d+)?(.*)$/) : null;
  return `<div class="stat">
    <div class="row-b">
      <span class="stat-ico" style="color:${colors[tone]}">${icon(ic)}</span>
      ${delta ? `<span class="delta ${delta.dir}">${icon(delta.dir === 'up' ? 'arrowUp' : delta.dir === 'down' ? 'arrowDown' : 'minus')}${esc(delta.text)}</span>` : ''}
    </div>
    <div class="stat-val" ${numeric ? `data-count="${raw}" data-suffix="${esc(numeric[1] || '')}"` : ''}>${esc(value)}</div>
    <div class="stat-lbl">${esc(label)}</div>
    ${sub ? `<div class="xs t3 mt-8">${sub}</div>` : ''}
  </div>`;
}
function bar(pct, tone = '', h) {
  return `<div class="bar ${tone} ${h || ''}"><i style="width:${clamp(pct, 0, 100)}%"></i></div>`;
}
function emptyState(ic, title, body, action = '') {
  return `<div class="empty"><span class="empty-ico">${icon(ic)}</span>
    <div><div class="b7 lg" style="color:var(--text-2)">${esc(title)}</div>
    <div class="sm mt-4" style="max-width:380px">${esc(body)}</div></div>${action}</div>`;
}
function kv(k, v) { return `<div class="kv"><span class="k">${esc(k)}</span><span class="v">${v}</span></div>`; }
function crumbs(items) {
  return `<div class="breadcrumb">${items.map((it, i) =>
    (i ? icon('chevron') : '') + (it.href
      ? `<span class="b-link" data-act="go" data-href="${esc(it.href)}">${esc(it.label)}</span>`
      : `<span>${esc(it.label)}</span>`)).join('')}</div>`;
}

/* ---------------- 7. Charts (hand-rolled SVG) ---------------- */

/* 7.1 area / line chart */
function areaChart(series, labels, opts = {}) {
  const W = opts.w || 720, H = opts.h || 220;
  const pad = { l: 42, r: 14, t: 14, b: 26 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const all = series.flatMap((s) => s.values);
  const max = opts.max ?? Math.max(1, ...all) * 1.12;
  const min = opts.min ?? 0;
  const x = (i, n) => pad.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
  const y = (v) => pad.t + ih - ((v - min) / (max - min || 1)) * ih;

  const gridN = 4;
  const grid = Array.from({ length: gridN + 1 }, (_, i) => {
    const gy = pad.t + (i / gridN) * ih;
    const val = max - (i / gridN) * (max - min);
    return `<line class="grid-line" x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}"/>
      <text class="axis-lbl" x="${pad.l - 8}" y="${gy + 3.5}" text-anchor="end">${opts.fmtY ? opts.fmtY(val) : Math.round(val)}</text>`;
  }).join('');

  const xlabels = labels.map((l, i) =>
    (labels.length > 10 && i % 2) ? '' :
    `<text class="axis-lbl" x="${x(i, labels.length)}" y="${H - 6}" text-anchor="middle">${esc(l)}</text>`).join('');

  /* ids must be unique per chart instance: two charts on one page would otherwise
     both define #ag0, and the second would silently paint with the first's colour */
  const uid_ = 'c' + Math.random().toString(36).slice(2, 8);
  const defs = series.map((s, si) => `
    <linearGradient id="${uid_}-${si}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${s.color}" stop-opacity=".22"/>
      <stop offset="100%" stop-color="${s.color}" stop-opacity="0"/>
    </linearGradient>`).join('');

  const paths = series.map((s, si) => {
    const n = s.values.length;
    const pts = s.values.map((v, i) => [x(i, n), y(v)]);
    const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ');
    const area = `${line} L ${pts[pts.length - 1][0].toFixed(1)} ${pad.t + ih} L ${pts[0][0].toFixed(1)} ${pad.t + ih} Z`;
    const dots = pts.map((p, i) => `<g class="map-node"><circle class="pt" cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="3" fill="${s.color}" stroke="var(--bg)" stroke-width="1.6"/>
      <circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="10" fill="transparent"><title>${esc(labels[i] || '')}: ${opts.fmtT ? opts.fmtT(s.values[i]) : fmt.n(s.values[i])}</title></circle></g>`).join('');
    return `<path class="area" d="${area}" fill="url(#${uid_}-${si})"/><path class="line" d="${line}" stroke="${s.color}"/>${dots}`;
  }).join('');

  const legend = series.length > 1
    ? `<div class="chart-legend mt-12">${series.map((s) => `<span><i style="background:${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : '';

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'Chart')}">
    <defs>${defs}</defs>${grid}${xlabels}${paths}</svg>${legend}`;
}

/* 7.2 bar chart */
function barChart(items, opts = {}) {
  const W = opts.w || 720, H = opts.h || 220;
  const pad = { l: 42, r: 12, t: 14, b: 30 };
  const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
  const max = Math.max(1, ...items.map((i) => i.value)) * 1.12;
  const bw = Math.min(46, (iw / items.length) * 0.62);
  const step = iw / items.length;

  const grid = Array.from({ length: 5 }, (_, i) => {
    const gy = pad.t + (i / 4) * ih;
    return `<line class="grid-line" x1="${pad.l}" y1="${gy}" x2="${W - pad.r}" y2="${gy}"/>
      <text class="axis-lbl" x="${pad.l - 8}" y="${gy + 3.5}" text-anchor="end">${opts.fmtY ? opts.fmtY(max - (i / 4) * max) : Math.round(max - (i / 4) * max)}</text>`;
  }).join('');

  const bars = items.map((it, i) => {
    const bh = Math.max(2, (it.value / max) * ih);
    const bx = pad.l + i * step + (step - bw) / 2;
    const by = pad.t + ih - bh;
    const c = it.color || '#4f7fff';
    return `<g><rect class="bar-r" x="${bx.toFixed(1)}" y="${by.toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="5" fill="${c}">
        <title>${esc(it.label)}: ${opts.fmtT ? opts.fmtT(it.value) : fmt.n(it.value)}</title></rect>
      <text class="axis-lbl" x="${(bx + bw / 2).toFixed(1)}" y="${H - 9}" text-anchor="middle">${esc(it.short || it.label)}</text></g>`;
  }).join('');

  return `<svg class="chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(opts.aria || 'Bar chart')}">
    ${grid}${bars}</svg>`;
}

/* 7.3 donut */
const DONUT_FALLBACK = ['#4f7fff', '#4aa3f0', '#3ecf8e', '#8b7cf0', '#d99b2b', '#ef5f5f', '#5b7a99'];
function donut(segments, opts = {}) {
  const size = opts.size || 190, sw = opts.stroke || 20, r = (size - sw) / 2, c = size / 2;
  const circ = 2 * Math.PI * r;
  const total = sum(segments.map((s) => s.value)) || 1;
  let off = 0;
  const arcs = segments.map((s, si) => {
    const frac = s.value / total, len = frac * circ;
    const col = s.color || DONUT_FALLBACK[si % DONUT_FALLBACK.length];
    const el = `<circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}"
      stroke-dasharray="${len.toFixed(2)} ${(circ - len).toFixed(2)}" stroke-dashoffset="${(-off).toFixed(2)}"
      stroke-linecap="butt" transform="rotate(-90 ${c} ${c})"><title>${esc(s.label)}: ${fmt.n(s.value)}</title></circle>`;
    off += len; return el;
  }).join('');
  const legend = `<div class="col gap-8" style="min-width:150px">${segments.map((s, si) => `
    <div class="row-b sm"><span class="row gap-8"><i style="width:9px;height:9px;border-radius:3px;background:${s.color || DONUT_FALLBACK[si % DONUT_FALLBACK.length]};display:inline-block"></i>
    <span class="t2">${esc(s.label)}</span></span><span class="b7 tnum">${fmt.n(s.value)}</span></div>`).join('')}</div>`;
  return `<div class="row gap-20 wrap" style="justify-content:center">
    <div class="ring" style="width:${size}px;height:${size}px;flex:none">
      <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:none">
        <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#1c2128" stroke-width="${sw}"/>${arcs}</svg>
      <div class="ring-val col center" style="line-height:1.1">
        <span style="font-size:23px">${esc(opts.centerValue ?? fmt.n(total))}</span>
        <span class="xs t3 b7 cap" style="font-size:9.5px">${esc(opts.centerLabel || 'Total')}</span></div>
    </div>${opts.legend === false ? '' : legend}</div>`;
}

/* 7.4 progress ring */
function progressRing(pct, opts = {}) {
  const size = opts.size || 92, sw = opts.stroke || 8, r = (size - sw) / 2, c = size / 2;
  const circ = 2 * Math.PI * r, len = clamp(pct, 0, 100) / 100 * circ;
  const col = opts.color || 'var(--accent)';
  return `<div class="ring" style="width:${size}px;height:${size}px;flex:none">
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="#1c2128" stroke-width="${sw}"/>
      <circle cx="${c}" cy="${c}" r="${r}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"
        stroke-dasharray="${len.toFixed(2)} ${circ.toFixed(2)}"/></svg>
    <div class="ring-val col center" style="line-height:1.05">
      <span style="font-size:${opts.fs || 19}px">${Math.round(pct)}%</span>
      ${opts.label ? `<span class="t3 b7 cap" style="font-size:8.5px">${esc(opts.label)}</span>` : ''}</div></div>`;
}

/* 7.5 sparkline */
function sparkline(values, color = 'var(--accent)') {
  const W = 160, H = 36, max = Math.max(1, ...values), min = Math.min(...values);
  const x = (i) => (i / (values.length - 1 || 1)) * W;
  const y = (v) => H - 3 - ((v - min) / ((max - min) || 1)) * (H - 8);
  const line = values.map((v, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ' ' + y(v).toFixed(1)).join(' ');
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  const gid = 'sp' + Math.random().toString(36).slice(2, 7);
  return `<svg class="spark" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%" stop-color="${color}" stop-opacity=".4"/><stop offset="100%" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${gid})"/><path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

/* ---------------- 8. Route map ---------------- */
/* Schematic network map of the HLL operating area. Nodes are positioned
   to mirror the relative geography of the European road network; the
   landmass is deliberately abstract rather than a survey-accurate map. */
function routeMap(path, opts = {}) {
  const W = 640, H = 470;
  const nodes = (path && path.length ? path : []).map((n) => ({ name: n, xy: cityXY(n) }));
  const showAll = opts.showAllCities !== false && !opts.fit;
  const showLabels = opts.labels !== false && !opts.fit;

  /* "fit" crops the viewBox to the route itself — used for the small convoy-card banners,
     where the whole-of-Europe view would be an illegible smudge. */
  let viewBox = `0 0 ${W} ${H}`;
  if (opts.fit && nodes.length) {
    const xs = nodes.map((n) => n.xy[0]), ys = nodes.map((n) => n.xy[1]);
    const pad = 34;
    let x0 = Math.min(...xs) - pad, y0 = Math.min(...ys) - pad;
    let w = (Math.max(...xs) + pad) - x0, h = (Math.max(...ys) + pad) - y0;
    /* grow the short side to the banner's aspect ratio so "slice" never crops an endpoint */
    const ar = opts.ar || 3.1;
    if (w / h < ar) { const nw = h * ar; x0 -= (nw - w) / 2; w = nw; }
    else { const nh = w / ar; y0 -= (nh - h) / 2; h = nh; }
    viewBox = `${x0.toFixed(1)} ${y0.toFixed(1)} ${w.toFixed(1)} ${h.toFixed(1)}`;
  }

  const line = nodes.map((n, i) => (i ? 'L' : 'M') + n.xy[0] + ' ' + n.xy[1]).join(' ');

  /* No decorative landmass: a plain graticule reads as a schematic and keeps the
     route the only thing with colour. Also avoids a blur filter per map instance. */
  const land = '';

  const graticule = Array.from({ length: 9 }, (_, i) =>
    `<line x1="0" y1="${i * 60}" x2="${W}" y2="${i * 60}" stroke="#212730" stroke-width="1"/>`).join('') +
    Array.from({ length: 11 }, (_, i) =>
    `<line x1="${i * 64}" y1="0" x2="${i * 64}" y2="${H}" stroke="#212730" stroke-width="1"/>`).join('');

  const otherCities = showAll ? Object.entries(CITIES)
    .filter(([n]) => !path.includes(n))
    .map(([n, [x, y]]) => `<g class="map-node" opacity=".5">
      <circle cx="${x}" cy="${y}" r="2.4" fill="rgba(255,255,255,.42)"/>
      <circle class="hit" cx="${x}" cy="${y}" r="8" fill="transparent"><title>${esc(n)}</title></circle></g>`).join('') : '';

  const stops = nodes.map((n, i) => {
    const first = i === 0, last = i === nodes.length - 1;
    const col = first ? 'var(--ok)' : last ? 'var(--accent)' : 'var(--info)';
    const label = first ? 'START' : last ? 'DESTINATION' : 'CHECKPOINT ' + i;
    const ly = n.xy[1] - 15;
    return `<g class="map-node">
      <circle cx="${n.xy[0]}" cy="${n.xy[1]}" r="${first || last ? 9 : 6.5}" fill="${col}" opacity=".22"/>
      <circle cx="${n.xy[0]}" cy="${n.xy[1]}" r="${first || last ? 5.2 : 4}" fill="${col}" stroke="#06090f" stroke-width="1.6"/>
      <circle class="hit" cx="${n.xy[0]}" cy="${n.xy[1]}" r="12" fill="transparent"><title>${esc(n.name)} — ${label}</title></circle>
      ${showLabels ? `<text class="map-lbl" x="${n.xy[0]}" y="${ly}" text-anchor="middle">${esc(n.name)}</text>` : ''}
      ${showLabels && (first || last) ? `<text class="map-lbl sub" x="${n.xy[0]}" y="${ly + 11}" text-anchor="middle">${label}</text>` : ''}
    </g>`;
  }).join('');

  /* live convoy marker at a point along the route */
  let marker = '';
  if (opts.progress != null && nodes.length > 1) {
    const p = clamp(opts.progress, 0, 1);
    const segs = [];
    let total = 0;
    for (let i = 1; i < nodes.length; i++) {
      const d = Math.hypot(nodes[i].xy[0] - nodes[i - 1].xy[0], nodes[i].xy[1] - nodes[i - 1].xy[1]);
      segs.push(d); total += d;
    }
    let want = p * total, idx = 0;
    while (idx < segs.length && want > segs[idx]) { want -= segs[idx]; idx++; }
    idx = Math.min(idx, segs.length - 1);
    const t = segs[idx] ? want / segs[idx] : 0;
    const mx = nodes[idx].xy[0] + (nodes[idx + 1].xy[0] - nodes[idx].xy[0]) * t;
    const my = nodes[idx].xy[1] + (nodes[idx + 1].xy[1] - nodes[idx].xy[1]) * t;
    marker = `<g class="truck-marker" transform="translate(${mx.toFixed(1)},${my.toFixed(1)})">
      <circle r="13" fill="rgba(79,127,255,.20)"><animate attributeName="r" values="11;18;11" dur="2.4s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values=".5;0;.5" dur="2.4s" repeatCount="indefinite"/></circle>
      <circle r="8" fill="#4f7fff" stroke="#06090f" stroke-width="2"/>
      <g transform="translate(-5.5,-5.5) scale(.46)" fill="none" stroke="#150a03" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICON_PATHS.truck}</g>
      <title>Convoy position — ${Math.round(p * 100)}% of route complete</title></g>`;
  }

  return `<div class="map ${opts.cls || ''}" style="${opts.style || ''}">
    <svg viewBox="${viewBox}" preserveAspectRatio="${opts.fit ? 'xMidYMid slice' : 'xMidYMid meet'}"
      role="img" aria-label="Route map">
      ${land}${graticule}${otherCities}
      ${nodes.length > 1 ? `<path class="map-route-bg" d="${line}"/><path class="map-route" d="${line}"/>` : ''}
      ${stops}${marker}
    </svg>
    ${opts.overlay || ''}
    ${opts.legend === false ? '' : `<div class="map-legend">
      <span><i style="background:var(--ok)"></i>Start</span>
      <span><i style="background:var(--info)"></i>Checkpoint</span>
      <span><i style="background:var(--accent)"></i>Destination</span></div>`}
  </div>`;
}

/* ---------------- 9. Truck illustration ---------------- */
function rigSvg(liveryKey, opts = {}) {
  const L = LIVERIES.find((l) => l.key === liveryKey) || LIVERIES[0];
  const cls = opts.cls || 'rig';
  /* Flat line-drawing: no gradients (which would repeat ids across a fleet grid),
     the livery colour used only as a single stripe. */
  const stroke = '#39414c';
  return `<svg class="${cls}" viewBox="0 0 300 110" fill="none" aria-hidden="true">
    <!-- trailer -->
    <rect x="8" y="26" width="150" height="50" rx="3" fill="#1c2128" stroke="${stroke}"/>
    <rect x="8" y="47" width="150" height="4" fill="${L.a}" opacity=".8"/>
    <text x="83" y="42" text-anchor="middle" font-family="Inter,sans-serif" font-size="11" font-weight="600"
      fill="#69727f" letter-spacing="2.5">HEAVYLINE</text>
    <!-- chassis -->
    <rect x="8" y="76" width="240" height="4" rx="2" fill="${stroke}"/>
    <!-- cab -->
    <path d="M172 26h48c5 0 9 3 10 8l10 22v20h-68z" fill="#1c2128" stroke="${stroke}"/>
    <rect x="176" y="34" width="40" height="20" rx="2" fill="#252c35"/>
    <path d="M222 36h9l7 17h-16z" fill="#252c35"/>
    <rect x="168" y="60" width="76" height="5" rx="1.5" fill="${L.a}" opacity=".8"/>
    <!-- wheels -->
    ${[36, 62, 118, 190, 232].map((cx) => `<circle cx="${cx}" cy="86" r="10" fill="#141920" stroke="${stroke}" stroke-width="1.5"/>`).join('')}
  </svg>`;
}

/* ---------------- 10. Toasts / modals / drawer ---------------- */
function toast(title, type = 'info', body = '') {
  const host = $('#toasts'); if (!host) return;
  const ic = { ok: 'checkCircle', info: 'info', warn: 'alert', danger: 'alert' }[type] || 'info';
  const node = document.createElement('div');
  node.className = 'toast ' + type;
  node.innerHTML = `<span class="toast-ico">${icon(ic)}</span>
    <div class="grow"><div class="b7 md">${esc(title)}</div>${body ? `<div class="sm t2 mt-4">${esc(body)}</div>` : ''}</div>
    <button class="icon-btn" style="width:26px;height:26px" data-act="toast-close" aria-label="Dismiss">${icon('x')}</button>`;
  host.appendChild(node);
  const kill = () => { node.classList.add('out'); setTimeout(() => node.remove(), 260); };
  node.querySelector('[data-act="toast-close"]').onclick = kill;
  setTimeout(kill, 4600);
}

/* ============================================================
   HEAVYLINE MODAL SYSTEM
   ============================================================ */

let modalStack = [];

function openModal({
    title,
    sub = '',
    body,
    foot = '',
    size = '',
    onMount
}) {
    const wrap = document.createElement('div');

    wrap.className = 'overlay';

    wrap.innerHTML = `
        <div
            class="modal ${size}"
            role="dialog"
            aria-modal="true"
            aria-label="${esc(title)}"
        >
            <div class="modal-head">
                <div>
                    <div class="b8" style="font-size:17px">
                        ${esc(title)}
                    </div>

                    ${
                        sub
                            ? `<div class="sm t2 mt-4">${esc(sub)}</div>`
                            : ''
                    }
                </div>

                <button
                    class="icon-btn"
                    data-close
                    aria-label="Close"
                >
                    ${icon('x')}
                </button>
            </div>

            <div class="modal-body">
                ${body}
            </div>

            ${
                foot
                    ? `<div class="modal-foot">${foot}</div>`
                    : ''
            }
        </div>
    `;

    wrap.addEventListener('mousedown', (e) => {
        if (e.target === wrap) {
            closeModal();
        }
    });

    const closeButton = wrap.querySelector('[data-close]');

    if (closeButton) {
        closeButton.onclick = () => closeModal();
    }

    const layers = document.getElementById('layers');

    if (!layers) {
        console.error(
            'Heavyline error: #layers element was not found.'
        );
        return null;
    }

    layers.appendChild(wrap);

    modalStack.push(wrap);

    document.body.style.overflow = 'hidden';

    if (typeof onMount === 'function') {
        onMount(wrap);
    }

    const firstField = wrap.querySelector(
        'input, select, textarea, button:not([data-close])'
    );

    if (firstField) {
        setTimeout(() => {
            firstField.focus();
        }, 60);
    }

    return wrap;
}


function closeModal() {

    const modal = modalStack.pop();

    if (modal) {
        modal.remove();
    }

    if (
        modalStack.length === 0 &&
        !document.querySelector('.drawer')
    ) {
        document.body.style.overflow = '';
    }
}


function confirmDialog(
    title,
    message,
    onYes,
    {
        danger = false,
        yes = 'Confirm'
    } = {}
) {

    openModal({
        title: title,
        size: 'narrow',

        body: `
            <p class="t2">
                ${esc(message)}
            </p>
        `,

        foot: `
            <button
                class="btn btn-ghost"
                data-act="modal-cancel"
            >
                Cancel
            </button>

            <button
                class="btn ${
                    danger
                        ? 'btn-danger'
                        : 'btn-primary'
                }"
                data-act="modal-yes"
            >
                ${esc(yes)}
            </button>
        `,

        onMount(wrap) {

            const cancel =
                wrap.querySelector(
                    '[data-act="modal-cancel"]'
                );

            const confirm =
                wrap.querySelector(
                    '[data-act="modal-yes"]'
                );

            if (cancel) {
                cancel.onclick = () => {
                    closeModal();
                };
            }

            if (confirm) {
                confirm.onclick = () => {
                    closeModal();

                    if (typeof onYes === 'function') {
                        onYes();
                    }
                };
            }
        }
    });
}


function openDrawer(title, body, onMount) {

    const scrim =
        document.createElement('div');

    scrim.className = 'scrim';

    const drawer =
        document.createElement('aside');

    drawer.className = 'drawer';

    drawer.innerHTML = `
        <div class="drawer-head">

            <div class="b8 lg">
                ${esc(title)}
            </div>

            <button
                class="icon-btn"
                data-close
                aria-label="Close"
            >
                ${icon('x')}
            </button>

        </div>

        <div class="drawer-body">
            ${body}
        </div>
    `;

    const close = () => {

        drawer.remove();
        scrim.remove();

        if (
            modalStack.length === 0
        ) {
            document.body.style.overflow = '';
        }
    };

    scrim.onclick = close;

    const closeButton =
        drawer.querySelector('[data-close]');

    if (closeButton) {
        closeButton.onclick = close;
    }

    const layers =
        document.getElementById('layers');

    if (!layers) {
        console.error(
            'Heavyline error: #layers element was not found.'
        );
        return null;
    }

    layers.append(
        scrim,
        drawer
    );

    document.body.style.overflow =
        'hidden';

    if (typeof onMount === 'function') {
        onMount(drawer, close);
    }

    return close;
}


/* ============================================================
   SUPABASE PASSWORD RESET
   ============================================================ */

async function resetHeavylinePassword(email) {

    email = email.trim();

    if (!email) {

        alert(
            'Please enter your email address.'
        );

        return false;
    }

    if (!window.hllSupabase) {

        console.error(
            'Supabase client is not available.'
        );

        alert(
            'Supabase is not connected.'
        );

        return false;
    }

    try {

        const {
            error
        } =
            await window.hllSupabase.auth
                .resetPasswordForEmail(
                    email,
                    {
                        /* the public address, not this browser's origin —
                           see publicSiteUrl() for why that difference is
                           the whole bug */
                        redirectTo:
                            publicSiteUrl() +
                            '/reset-password.html'
                    }
                );

        if (error) {

            console.error(
                'Password reset error:',
                error
            );

            alert(
                'Could not send password reset email:\n\n' +
                error.message
            );

            return false;
        }

        alert(
            'Password reset email sent!\n\n' +
            'Check your email inbox for the password reset link.'
        );

        return true;

    } catch (error) {

        console.error(
            'Password reset exception:',
            error
        );

        alert(
            'Something went wrong while sending the password reset email.'
        );

        return false;
    }
}


/* ============================================================
   FORGOT PASSWORD MODAL
   ============================================================ */

function openForgotPasswordModal() {

    openModal({

        title: 'Reset Password',

        sub:
            'Enter your Heavyline account email',

        size: 'narrow',

        body: `
            <div>

                <label
                    for="resetEmail"
                    class="sm"
                >
                    Email Address
                </label>

                <input
                    id="resetEmail"
                    type="email"
                    placeholder="jeffboss730@gmail.com"
                    autocomplete="email"
                    style="
                        width:100%;
                        margin-top:8px;
                        padding:12px;
                        border-radius:8px;
                        border:1px solid #263244;
                        background:#080b14;
                        color:white;
                    "
                >

                <div
                    id="resetMessage"
                    style="
                        margin-top:12px;
                        color:#9ca3af;
                        font-size:14px;
                    "
                ></div>

            </div>
        `,

        foot: `
            <button
                class="btn btn-ghost"
                id="cancelResetBtn"
            >
                Cancel
            </button>

            <button
                class="btn btn-primary"
                id="sendResetBtn"
            >
                SEND RESET LINK
            </button>
        `,

        onMount(wrap) {

            const emailInput =
                wrap.querySelector(
                    '#resetEmail'
                );

            const sendButton =
                wrap.querySelector(
                    '#sendResetBtn'
                );

            const cancelButton =
                wrap.querySelector(
                    '#cancelResetBtn'
                );

            const message =
                wrap.querySelector(
                    '#resetMessage'
                );

            /*
             * Pre-fill the email if the login
             * page already has an email field.
             */

            const loginEmail =
                document.querySelector(
                    'input[type="email"]'
                );

            if (
                loginEmail &&
                loginEmail.value
            ) {
                emailInput.value =
                    loginEmail.value;
            }

            cancelButton.onclick = () => {
                closeModal();
            };

            sendButton.onclick =
                async () => {

                    const email =
                        emailInput.value.trim();

                    if (!email) {

                        message.textContent =
                            'Please enter your email address.';

                        return;
                    }

                    sendButton.disabled =
                        true;

                    sendButton.textContent =
                        'SENDING...';

                    message.textContent =
                        'Sending reset link...';

                    const success =
                        await resetHeavylinePassword(
                            email
                        );

                    if (success) {

                        message.textContent =
                            'Reset email sent. Check your inbox.';

                        sendButton.textContent =
                            'EMAIL SENT';

                        setTimeout(() => {
                            closeModal();
                        }, 2500);

                    } else {

                        sendButton.disabled =
                            false;

                        sendButton.textContent =
                            'SEND RESET LINK';
                    }
                };
        }
    });
}


/* ---------------- 11. Count-up animation ---------------- */
function animateCounts(root = document) {
  $$('[data-count]', root).forEach((el) => {
    const target = parseFloat(el.dataset.count);
    if (!isFinite(target)) return;
    const suffix = el.dataset.suffix || '';
    const dur = 900, t0 = performance.now();
    const step = (t) => {
      const p = clamp((t - t0) / dur, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const v = target * eased;
      el.textContent = (target % 1 ? v.toFixed(1) : Math.round(v)).toLocaleString('en-GB') + suffix;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}

/* ============================================================
   Part 3/6 — state, router, shell, auth, dashboard
   ============================================================ */

/* ---------------- 12. Application state ---------------- */
const state = {
  user: null,          /* the signed-in driver record */
  route: { name: 'dashboard', params: [] },
  ui: {
    sidebar: false,
    driverView: 'grid', driverRank: 'all', driverQuery: '', driverSort: 'km',
    fleetTab: 'trucks', fleetStatus: 'all',
    opsView: 'board',        /* the live board, or the plain driver table */
    convoyTab: 'upcoming',
    calMonth: new Date().getMonth(), calYear: new Date().getFullYear(),
    lbMetric: 'km', lbPeriod: 'all',
    achFilter: 'all',
    profileTab: 'overview',
    authMode: 'signin',
    regDraft: {},
    adminTab: 'overview',
    applyDraft: {},
    supportFilter: 'all',
  },
};

/* ---------------- 12b. Which site is this? ----------------

   The company runs two web front-ends off one application:

     index.html  the drivers' website — what a driver signs in to
     admin.html  the management console — what runs the company

   Each page declares which it is before this script loads, and names the
   other so the two can link to each other. The bundle in www/ renames the
   drivers' site to hq.html (index.html there is the tracking client), and
   the build rewrites these declarations to match. */
const SITE = window.HLL_SITE === 'admin' ? 'admin' : 'drivers';
const PAGES = Object.assign({ drivers: 'index.html', admin: 'admin.html' },
  window.HLL_PAGES || {});
const isAdminSite = () => SITE === 'admin';

/* Sends the browser to the other site, keeping the driver where they were
   when that makes sense. */
function goSite(which, hash) {
  const page = PAGES[which] || PAGES.drivers;
  location.href = page + (hash || (which === 'admin' ? '#/admin' : '#/dashboard'));
}

/* ---------------- 13. Routing ---------------- */
const ROUTES = {
  dashboard:    { title: 'Command Center',   icon: 'home' },
  drivers:      { title: 'Drivers',          icon: 'users' },
  driver:       { title: 'Driver Profile',   icon: 'user',   hidden: true },
  fleet:        { title: 'Fleet',            icon: 'truck' },
  vehicle:      { title: 'Vehicle',          icon: 'truck',  hidden: true },
  convoys:      { title: 'Convoys',          icon: 'route' },
  convoy:       { title: 'Convoy',           icon: 'route',  hidden: true },
  events:       { title: 'Events',           icon: 'calendar' },
  rankings:     { title: 'Rankings',         icon: 'trophy' },
  achievements: { title: 'Achievements',     icon: 'medal' },
  recruitment:  { title: 'Recruitment',      icon: 'userPlus' },
  community:    { title: 'Community',        icon: 'discord' },
  support:      { title: 'Driver Support',   icon: 'lifeBuoy' },
  ticket:       { title: 'Support Ticket',   icon: 'ticket', hidden: true },
  notifications:{ title: 'Notifications',    icon: 'bell' },
  messages:     { title: 'Messages',         icon: 'chat' },
  livemap:      { title: 'Live map',         icon: 'map' },
  ops:          { title: 'Live Operations',  icon: 'activity', perm: 'admin.view' },
  downloads:    { title: 'Get the client',   icon: 'download' },
  settings:     { title: 'Settings',         icon: 'settings' },
  admin:        { title: 'Admin Console',    icon: 'shield', perm: 'admin.view' },
};

function parseHash() {
  const home = isAdminSite() ? 'admin' : 'dashboard';
  const raw = (location.hash || '#/' + home).replace(/^#\/?/, '');
  const parts = raw.split('/').filter(Boolean);
  const name = parts[0] || home;
  return { name: ROUTES[name] ? name : home, params: parts.slice(1) };
}
function go(href) {
  if (location.hash === href) { render(); return; }
  location.hash = href;
}
function onHashChange() {
  state.route = parseHash();
  state.ui.sidebar = false;
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
  render();
}

/* ---------------- 14. Shell ---------------- */
/* The drivers' site is about driving. The console is about running the
   company, so it leads with the work waiting and drops the pages a manager
   has no use for. */
const NAV_DRIVERS = [
  { label: 'Operations', items: ['dashboard', 'livemap', 'convoys', 'events', 'fleet'] },
  { label: 'Crew',       items: ['drivers', 'messages', 'rankings', 'achievements'] },
  { label: 'Company',    items: ['recruitment', 'community', 'support', 'downloads'] },
];
const NAV_ADMIN = [
  /* Live Operations leads: the first question a manager opens the console
     with is who is on and what they are doing right now, not what the
     paperwork says. */
  { label: 'Management', items: ['ops', 'admin', 'recruitment', 'support'] },
  { label: 'Company',    items: ['drivers', 'messages', 'fleet', 'convoys', 'events', 'community'] },
  { label: 'Oversight',  items: ['livemap', 'rankings', 'dashboard'] },
];
const NAV_GROUPS = isAdminSite() ? NAV_ADMIN : NAV_DRIVERS;

function navHTML() {
  const unread = Store.unreadCount(state.user.id);
  const pendingApps = Store.db.applications.filter((a) => ['pending', 'review'].includes(a.status)).length;
  const visibleTickets = can('admin.view')
    ? Store.db.tickets
    : Store.db.tickets.filter((t) => t.driverId === state.user.id);
  const openTickets = visibleTickets.filter((t) => t.status !== 'resolved').length;
  const upcoming = Store.upcomingEvents().length;

  const badges = {
    admin: pendingApps,
    /* how many are out on the road, so the number is worth glancing at */
    ops: (LiveMap.drivers || []).filter((d) => d.job).length,
    /* a recruiter looks at Recruitment, not only at the admin console */
    recruitment: can('recruitment.manage') ? pendingApps : 0,
    support: openTickets,
    convoys: upcoming,
    messages: Messages.unread(),
  };

  return NAV_GROUPS.map((g) => {
    const items = g.items.filter((k) => !ROUTES[k].perm || can(ROUTES[k].perm));
    if (!items.length) return '';
    return `<div class="nav-group"><div class="nav-label">${esc(g.label)}</div>
      ${items.map((k) => {
        const r = ROUTES[k];
        const active = state.route.name === k || (k === 'drivers' && state.route.name === 'driver')
          || (k === 'fleet' && state.route.name === 'vehicle') || (k === 'convoys' && state.route.name === 'convoy')
          || (k === 'support' && state.route.name === 'ticket');
        const b = badges[k];
        /* Messages keeps its badge in the markup whether or not anything is
           waiting, because a message arriving has to be able to light it
           without redrawing the sidebar — a redraw mid-sentence would take
           the caret out of the composer. */
        const badgeId = k === 'messages' ? ' id="dmBadge"' : '';
        const badge = k === 'messages'
          ? `<span class="nav-badge"${badgeId}${b ? '' : ' style="display:none"'}>${b || ''}</span>`
          : (b ? `<span class="nav-badge ${k === 'convoys' ? 'muted' : ''}">${b}</span>` : '');
        return `<a class="nav-item ${active ? 'active' : ''}" href="#/${k}">
          ${icon(r.icon)}<span class="grow trunc">${esc(r.title)}</span>
          ${badge}</a>`;
      }).join('')}</div>`;
  }).join('') + `
    <div class="nav-group">
      <a class="nav-item ${state.route.name === 'notifications' ? 'active' : ''}" href="#/notifications">
        ${icon('bell')}<span class="grow">Notifications</span>
        ${unread ? `<span class="nav-badge">${unread}</span>` : ''}</a>
      <a class="nav-item ${state.route.name === 'settings' ? 'active' : ''}" href="#/settings">
        ${icon('settings')}<span class="grow">Settings</span></a>
    </div>`;
}

function shellHTML() {
  const u = state.user;
  return `
  <div class="shell" id="shell">
    <aside class="sidebar" id="sidebar">
      <div class="brand">
        <span class="brand-mark ${isAdminSite() ? 'admin' : ''}"><img src="icons/mark.png" alt="Heavyline Logistics"></span>
        <div class="grow">
          <div class="brand-name">HEAVYLINE</div>
          <div class="brand-sub">${isAdminSite() ? 'Management' : 'Logistics'}</div>
        </div>
        <button class="icon-btn mobile-only" data-act="close-sidebar" aria-label="Close menu">${icon('x')}</button>
      </div>
      <nav class="nav" id="nav" aria-label="Primary">${navHTML()}</nav>
      <div class="side-foot">
        <button class="side-user" data-act="user-menu">
          ${avatar(u, 32)}
          <span class="grow" style="min-width:0">
            <span class="b7 md trunc" style="display:block">${esc(u.name)}</span>
            <span class="xs t3 mono">${esc(u.id)}</span>
          </span>
          ${icon('chevron', 'chev')}
        </button>
        <div class="side-motto">DRIVE · DELIVER · DOMINATE</div>
      </div>
    </aside>

    <div class="main">
      <header class="topbar">
        <button class="icon-btn mobile-only" data-act="open-sidebar" aria-label="Open menu">${icon('menu')}</button>
        <div class="search">
          ${icon('search')}
          <input id="globalSearch" type="search" placeholder="Search drivers, convoys, fleet…" aria-label="Search" autocomplete="off">
          <span class="kbd">Ctrl K</span>
        </div>
        <div class="grow"></div>
        ${siteSwitchHTML()}
        <div class="status-pill desktop-only"><span class="live-dot"></span>Fleet operational</div>
        <button class="icon-btn tip" data-tip="Notifications" data-act="notif-drawer" aria-label="Notifications">
          ${icon('bell')}${Store.unreadCount(u.id) ? '<span class="dot"></span>' : ''}
        </button>
        <button class="icon-btn tip desktop-only" data-tip="Community" data-act="go" data-href="#/community" aria-label="Community">${icon('discord')}</button>
        <button data-act="user-menu" class="icon-btn" style="width:auto;padding:0 4px" aria-label="Account">${avatar(u, 32)}</button>
      </header>
      <main id="view" role="main"></main>
    </div>

    <!-- A call outlives the page it started on: it sits outside #view so
         moving between screens does not hang up on somebody. -->
    <div id="callLayer" aria-live="polite"></div>
  </div>`;
}

/* The way across to the other site. Staff get it on the drivers' site; on
   the console everybody gets the way back. */
function siteSwitchHTML() {
  if (isAdminSite()) {
    return `<button class="btn btn-sm btn-ghost site-switch" data-act="site-drivers">
      ${icon('home')}<span class="desktop-only">Drivers' site</span></button>`;
  }
  if (!can('admin.view')) return '';
  const waiting = Store.db.applications.filter((a) => a.status === 'pending' || a.status === 'review').length
    + Store.db.tickets.filter((t) => t.status !== 'resolved').length;
  return `<button class="btn btn-sm site-switch admin" data-act="site-admin">
    ${icon('shield')}<span class="desktop-only">Console</span>
    ${waiting ? `<span class="badge brand">${waiting}</span>` : ''}</button>`;
}

/* Somebody without management rights has opened the console. Say so plainly
   and send them where they meant to go. */
/* Reached by an old bookmark to #/admin on the drivers' site. */
function viewAdminElsewhere() {
  return `<div class="page">
    <div class="empty-state" style="max-width:520px;margin:60px auto;text-align:center">
      <span class="stat-ico" style="margin:0 auto;width:56px;height:56px;color:var(--accent)">${icon('shield')}</span>
      <h1 class="page-title mt-16">The console has its own site</h1>
      <p class="t2 mt-8">Running the company — recruitment, dispatch, the fleet register and
        support — now lives on the management console, away from the drivers' site.</p>
      <div class="row gap-10 mt-20" style="justify-content:center">
        <button class="btn btn-primary" data-act="site-admin">${icon('shield')}Open the console</button>
      </div>
    </div>
  </div>`;
}

function viewWrongSite() {
  return `<div class="page">
    <div class="empty-state" style="max-width:520px;margin:60px auto;text-align:center">
      <span class="stat-ico" style="margin:0 auto;width:56px;height:56px;color:var(--warn)">${icon('shield')}</span>
      <h1 class="page-title mt-16">This is the management console</h1>
      <p class="t2 mt-8">Your account drives for Heavyline; it does not run it. Everything you
        need — your runs, convoys, standings and the client download — is on the drivers' site.</p>
      <div class="row gap-10 mt-20" style="justify-content:center">
        <button class="btn btn-primary" data-act="site-drivers">${icon('home')}Go to the drivers' site</button>
        <button class="btn btn-ghost" data-act="logout">${icon('logout')}Sign out</button>
      </div>
    </div>
  </div>`;
}

function userMenu(anchor) {
  const existing = $('.menu'); if (existing) { existing.remove(); return; }
  const m = document.createElement('div');
  m.className = 'menu';
  m.innerHTML = `
    <div class="row gap-10" style="padding:10px 11px 12px">
      ${avatar(state.user, 40)}
      <div style="min-width:0">
        <div class="b7 trunc">${esc(state.user.name)}</div>
        <div class="xs t3 mono">${esc(state.user.id)} · ${esc(rankOf(state.user).name)}</div>
      </div>
    </div>
    <div class="sep"></div>
    <button data-act="go" data-href="#/driver/${state.user.id}">${icon('user')}My driver profile</button>
    <button data-act="go" data-href="#/achievements">${icon('medal')}Achievements</button>
    <button data-act="go" data-href="#/settings">${icon('settings')}Account settings</button>
    <button data-act="go" data-href="#/support">${icon('lifeBuoy')}Driver support</button>
    <div class="sep"></div>
    ${isAdminSite()
      ? `<button data-act="site-drivers">${icon('home')}Drivers' site</button>`
      : (can('admin.view') ? `<button data-act="site-admin">${icon('shield')}Management console</button>` : '')}
    <button data-act="switch-account">${icon('refresh')}Switch account</button>
    <button class="danger" data-act="logout">${icon('logout')}Sign out</button>`;
  const r = anchor.getBoundingClientRect();
  m.style.top = (r.bottom + 8) + 'px';
  const left = Math.min(r.left, window.innerWidth - 220);
  m.style.left = Math.max(10, left) + 'px';
  $('#layers').appendChild(m);
  setTimeout(() => {
    const off = (e) => { if (!m.contains(e.target)) { m.remove(); document.removeEventListener('mousedown', off); } };
    document.addEventListener('mousedown', off);
  }, 0);
}

/* ---------------- 15. Auth screen ---------------- */
function viewAuth() {
  const db = Store.db;
  const totalKm = sum(db.drivers.map((d) => d.km));
  const setup = Accounts.needsSetup();
  const mode = setup ? 'setup' : (state.ui.authMode === 'register' ? 'register' : 'signin');

  return `
  <div class="auth">
    <section class="auth-vis">
      <div class="row gap-16" style="position:relative">
        ${hllEmblem('lg', 'framed')}
        <div><div class="brand-name" style="font-size:17px">HEAVYLINE LOGISTICS</div>
        <div class="brand-sub">Digital Headquarters</div>
        <div class="brand-strap">Virtual logistics · Real drivers · Real-time operations</div></div>
      </div>

      <div style="position:relative;max-width:520px">
        <div class="hero-motto mb-12">${db.meta.founded
          ? 'Est. ' + new Date(db.meta.founded).getFullYear() + ' · Europe-wide'
          : 'Virtual trucking company · Europe-wide'}</div>
        <h1 class="hero-title">The digital <span class="grad-text">headquarters</span> of the Heavyline fleet.</h1>
        <p class="t2 mt-16" style="font-size:15px;line-height:1.65">
          Convoys, driver records, fleet assignments, rankings and achievements —
          one command centre for every HLL driver, and a full management console for the people running it.</p>
        <div class="row gap-8 wrap mt-20">
          ${['Convoy management', 'Live route maps', 'Driver progression', 'Fleet control'].map((t) =>
            `<span class="badge brand">${icon('check')}${t}</span>`).join('')}
        </div>

        <div class="mt-24">
          <div class="eyebrow mb-12">Follow Heavyline</div>
          ${socialHTML()}
        </div>
      </div>

      ${db.drivers.length ? `<div class="auth-stats">
        ${[['Active drivers', fmt.n(db.drivers.length)], ['Fleet units', fmt.n(db.trucks.length + db.trailers.length)],
           ['Distance driven', fmt.kmS(totalKm)], ['Convoys run', fmt.n(Store.pastEvents().length)]]
          .map(([k, v]) => `<div class="auth-stat"><div class="v">${esc(v)}</div><div class="k">${esc(k)}</div></div>`).join('')}
      </div>` : ''}
    </section>

    <section class="auth-form-wrap">
      <div class="auth-card">
        ${setup ? '' : `<div class="seg mb-20" style="width:100%">
          <button class="${mode === 'signin' ? 'on' : ''}" data-act="auth-mode" data-v="signin" style="flex:1">Sign in</button>
          <button class="${mode === 'register' ? 'on' : ''}" data-act="auth-mode" data-v="register" style="flex:1">Create account</button>
        </div>`}

        ${setup ? setupFormHTML() : mode === 'signin' ? signInFormHTML() : registerFormHTML()}
      </div>
    </section>
  </div>`;
}

/* First run: no accounts exist yet, so the person opening the platform is
   the one standing the company up. They get the owner account outright —
   no password is shipped in this file for anyone to find. */
/* ---------------- social links ----------------
   One definition, rendered on the sign-in screen and the community page.
   The marks come from the sprite in index.html rather than icon(), which
   draws stroked outlines on a 24px grid and would mangle a solid logo. */
const SOCIALS = [
  { brand: 'github',   href: 'https://github.com/JeffBoss315',                          label: 'GitHub profile' },
  { brand: 'linkedin', href: 'https://www.linkedin.com/in/jeff-boss-301366264/',        label: 'LinkedIn profile' },
  { brand: 'youtube',  href: 'https://www.youtube.com/@jeffboss254',                    label: 'YouTube channel' },
  { brand: 'tiktok',   href: 'https://www.tiktok.com/@jeff_boss_254',                   label: 'TikTok profile' },
  { brand: 'facebook', href: 'https://www.facebook.com/profile.php?id=100086530118861', label: 'Facebook profile' },
];

function socialHTML(cls = '') {
  return `<div class="social ${cls}">
    ${SOCIALS.map((s) => `<a href="${esc(s.href)}" target="_blank" rel="noopener noreferrer"
      data-magnetic data-brand="${s.brand}" aria-label="${esc(s.label)} (opens in a new tab)">
      <svg class="icon" aria-hidden="true"><use href="#i-${s.brand}"></use></svg>
    </a>`).join('')}
  </div>`;
}

/* The links pull gently towards the pointer. Purely decorative, so it is
   skipped for anyone who has asked for less motion, and never runs on a
   touch screen where there is no pointer to follow. */
function bindMagnetic(root = document) {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  root.querySelectorAll('[data-magnetic]').forEach((el) => {
    if (el.dataset.magneticBound) return;
    el.dataset.magneticBound = '1';

    const reset = () => { el.style.transform = ''; };
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      /* offset from the centre, damped so the link never leaves its slot */
      const dx = (e.clientX - (r.left + r.width / 2)) * 0.35;
      const dy = (e.clientY - (r.top + r.height / 2)) * 0.35;
      el.style.transform = `translate(${dx.toFixed(1)}px, ${dy.toFixed(1)}px)`;
    });
    el.addEventListener('pointerleave', reset);
    el.addEventListener('blur', reset);
  });
}

function setupFormHTML() {
  const d = state.ui.regDraft || {};
  return `
    <div class="eyebrow">First run</div>
    <h2 style="font-size:24px;font-weight:800;letter-spacing:-.02em">Create the owner account</h2>
    <p class="t2 sm mt-4">Heavyline is empty. This first account owns the company and
      has every administrator permission; everyone else registers as a driver.</p>

    <form id="setupForm" class="mt-20" novalidate>
      <div class="field">
        <label for="su-name">Your full name</label>
        <input class="input" id="su-name" value="${esc(d.name || '')}" autocomplete="name">
        <span class="err-msg hide" data-err="name"></span>
      </div>
      <div class="field">
        <label for="su-email">Email address</label>
        <input class="input" id="su-email" type="email" value="${esc(d.email || '')}" autocomplete="email">
        <span class="err-msg hide" data-err="email"></span>
      </div>
      <div class="field">
        <label for="su-country">Country</label>
        <select class="select" id="su-country">
          <option value="">Select…</option>
          ${COUNTRIES.map((c) => `<option ${d.country === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <span class="err-msg hide" data-err="country"></span>
      </div>
      <div class="field">
        <label for="su-pw">Password</label>
        <input class="input" id="su-pw" type="password" autocomplete="new-password"
          placeholder="At least 8 characters">
        <span class="err-msg hide" data-err="pw"></span>
      </div>
      <div class="field">
        <label for="su-pw2">Confirm password</label>
        <input class="input" id="su-pw2" type="password" autocomplete="new-password">
        <span class="err-msg hide" data-err="pw2"></span>
      </div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('shield')}Create the owner account</button>
      <div class="err-msg hide mt-12 center" data-err="form"></div>
    </form>

    <p class="sm t3 center mt-20">Keep these details safe — there is no server to reset
      them against, and the owner account can only be created once.</p>`;
}

function signInFormHTML() {
  return `
    <div class="eyebrow">Driver access</div>
    <h2 style="font-size:24px;font-weight:800;letter-spacing:-.02em">Sign in to HLL</h2>
    <p class="t2 sm mt-4">Use the account you registered with.</p>

    <form id="loginForm" class="mt-20" novalidate>
      <div class="field">
        <label for="li-id">Email or HLL Driver ID</label>
        <input class="input" id="li-id" name="id" placeholder="you@example.com" autocomplete="username">
        <span class="err-msg hide" data-err="id"></span>
      </div>
      <div class="field">
        <label for="li-pw">Password</label>
        <input class="input" id="li-pw" name="pw" type="password" placeholder="Your password" autocomplete="current-password">
        <span class="err-msg hide" data-err="pw"></span>
      </div>
      <div class="row-b sm" style="margin:-4px 0 16px">
        <label class="row gap-8" style="cursor:pointer">
          <input type="checkbox" id="li-remember" checked style="accent-color:var(--accent)">
          <span class="t2">Keep me signed in</span></label>
        <span class="link" data-act="forgot">Forgot password?</span>
      </div>
      <button class="btn btn-primary btn-lg btn-block" type="submit">${icon('bolt')}Sign in</button>
      <div class="err-msg hide mt-12 center" data-err="form"></div>
    </form>

    <p class="sm t3 center mt-20">No account yet?
      <span class="link" data-act="auth-mode" data-v="register">Create one</span></p>`;
}

function registerFormHTML() {
  const d = state.ui.regDraft || {};
  return `
    <div class="eyebrow">Join the fleet</div>
    <h2 style="font-size:24px;font-weight:800;letter-spacing:-.02em">Create your account</h2>
    <p class="t2 sm mt-4">This also files your application to drive for Heavyline.</p>

    <form id="registerForm" class="mt-20" novalidate>
      <div class="field">
        <label for="rg-name">Full name</label>
        <input class="input" id="rg-name" name="name" value="${esc(d.name || '')}" placeholder="Alex Mercer" autocomplete="name">
        <span class="err-msg hide" data-err="name"></span>
      </div>
      <div class="field">
        <label for="rg-email">Email address</label>
        <input class="input" id="rg-email" name="email" type="email" value="${esc(d.email || '')}"
          placeholder="you@example.com" autocomplete="email">
        <span class="err-msg hide" data-err="email"></span>
      </div>
      <div class="field">
        <label for="rg-country">Country</label>
        <select class="select" id="rg-country" name="country">
          <option value="">Select…</option>
          ${COUNTRIES.map((c) => `<option ${d.country === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
        </select>
        <span class="err-msg hide" data-err="country"></span>
      </div>
      <div class="field">
        <label for="rg-discord">Discord username <span class="t3">(optional)</span></label>
        <input class="input" id="rg-discord" name="discord" value="${esc(d.discord || '')}" placeholder="yourname">
      </div>
      <div class="field">
        <label for="rg-pw">Password</label>
        <input class="input" id="rg-pw" name="pw" type="password" placeholder="At least 8 characters" autocomplete="new-password">
        <div class="bar thin mt-8"><i id="pwMeter" style="width:0%"></i></div>
        <span class="hint" id="pwHint">Use 8 characters or more.</span>
        <span class="err-msg hide" data-err="pw"></span>
      </div>
      <div class="field">
        <label for="rg-pw2">Confirm password</label>
        <input class="input" id="rg-pw2" name="pw2" type="password" placeholder="Repeat it" autocomplete="new-password">
        <span class="err-msg hide" data-err="pw2"></span>
      </div>
      <label class="check ${d.agree ? 'on' : ''}" id="rg-agree-wrap">
        <input type="checkbox" id="rg-agree" ${d.agree ? 'checked' : ''}>
        <span class="sm t2">I agree to follow the HLL convoy standards and community rules.</span>
      </label>
      <span class="err-msg hide mt-8" data-err="agree"></span>

      <button class="btn btn-primary btn-lg btn-block mt-16" type="submit">${icon('userPlus')}Create account</button>
      <div class="err-msg hide mt-12 center" data-err="form"></div>
    </form>

    <p class="sm t3 center mt-20">Already registered?
      <span class="link" data-act="auth-mode" data-v="signin">Sign in</span></p>`;
}

let sessionOnly = false;   /* set when "keep me signed in" is unticked */

/* The page somebody asked for before they were asked to sign in. Set by
   render() when it puts the sign-in screen up over a real route, and spent
   by doLogin() the moment they are through. */
let wantedRoute = null;

function doLogin(driver, msg) {
    // Save the authenticated driver
    state.user = driver;

    // Keep the existing session behavior
    if (!sessionOnly) {
        Store.writeSession({ id: driver.id });
    } else {
        Store.writeSession(null);
    }

    // Clear the app shell if necessary
    if (!$('#shell')) {
        $('#app').innerHTML = '';
    }

    // Support both old HLL records and Supabase driver records
    const driverName =
        driver.full_name ||
        driver.name ||
        'Driver';

    const driverId =
        driver.driver_code ||
        driver.id ||
        'HLL';

    // Show welcome message without crashing
    toast(
        msg || `Welcome back, ${driverName.split(' ')[0]}`,
        'ok',
        `${driver.rank || 'Driver'} · ${driverId}`
    );

    /* Where they were going before they were stopped, or the dashboard.
       Spent on use, so it cannot send the next sign-in somewhere unexpected. */
    const going = wantedRoute || '#/dashboard';
    wantedRoute = null;
    go(going);

    render();
}

/* Ending a session means ending it in all three places that hold one: the
   local record the app paints from, the service token, and Supabase. Leaving
   the Supabase session behind meant "log out" put the login screen up while
   the browser was still authenticated. */
function signOutEverywhere() {
  Store.writeSession(null);
  state.user = null;
  Sync.driverKey = null;         /* the next person in gets their own row */
  window.currentDriver = null;
  ServiceAuth.logout();
  if (window.hllSupabase) {
    window.hllSupabase.auth.signOut()
      .catch((err) => console.warn('[HLL] Supabase sign-out failed', err));
  }
}

/* Asked once on boot, after the local record has already painted. Supabase is
   the authority on whether this browser is still signed in — a local session
   record outlives an expired or revoked one, which is how a signed-out browser
   keeps showing a dashboard. */
async function restoreSupabaseSession() {
  if (!window.hllSupabase) return;   /* offline or packaged: local record stands */

  try {
    const { data, error } = await window.hllSupabase.auth.getSession();

    if (error) {
      console.warn('[HLL] could not read the Supabase session:', error);
      return;                        /* a lookup that failed is not a sign-out */
    }

    const session = data && data.session;

    if (!session) {
      if (state.user) { signOutEverywhere(); render(); }
      return;
    }

    const { data: row, error: rowError } =
      await window.hllSupabase
        .from('drivers')
        .select('*')
        .eq('auth_user_id', session.user.id)
        .maybeSingle();

    if (rowError || !row) {
      console.warn('[HLL] the session has no driver record:', rowError);
      signOutEverywhere();
      render();
      return;
    }

    state.user = Accounts.fromRow(row, session.user);
    Store.writeSession({ id: state.user.id });
    render();

  } catch (err) {
    console.error('[HLL] session restore failed:', err);
  }
}

/* ---------------- 16. Command Center dashboard (spec §3) ---------------- */
/* Somebody who has signed up but not been let in yet needs to know what
   happens next and where to do it. Shown until a recruiter approves them. */
function onboardingBannerHTML(u) {
  if (u.clientAccess || can('admin.view')) return '';
  const app = Store.db.applications
    .filter((a) => a.submittedBy === u.id)
    .sort((a, b) => new Date(b.submitted) - new Date(a.submitted))[0];



  const isDriver =
    !!(
        state.user &&
        (
            state.user.driver_code ||
            state.user.auth_user_id
        )
    );

const waiting =
    !isDriver &&
    !!app &&
    (
        app.status === 'pending' ||
        app.status === 'review' ||
        app.status === 'interview'
    );

const rejected =
    !isDriver &&
    !!app &&
    app.status === 'rejected';

  return `<section class="card reveal mb-16" style="border-color:var(--accent-line);
      background:linear-gradient(160deg,var(--accent-soft),var(--panel) 62%)">
    <div class="card-body row gap-14 wrap" style="align-items:flex-start">
      <span class="stat-ico" style="flex:none">${icon(waiting ? 'clock' : 'userPlus')}</span>
      <div class="grow" style="min-width:220px">
        <div class="b8 lg">${waiting ? 'Your application is with recruitment'
          : rejected ? 'Your last application was not taken up'
          : 'One step left — apply to drive'}</div>
        <p class="t2 sm mt-8">${waiting
          ? 'Sent ' + esc(fmt.rel(app.submitted)) + ' as <span class="mono">' + esc(app.id) + '</span>. '
            + 'A recruiter reviews it and you will get a notification here. The Heavyline Trucker '
            + 'download is released at the same time.'
          : 'You have an account, but you are not on the roster yet. Send a short application — '
            + 'name, email and country is all it asks for — and recruitment picks it up straight away.'}</p>
        ${waiting ? '' : `<button class="btn btn-primary mt-12" data-act="go" data-href="#/recruitment">
          ${icon('send')}${rejected ? 'Apply again' : 'Apply to drive'}</button>`}
      </div>
      ${waiting ? `<div class="col gap-6" style="min-width:150px">
        ${['Sent', 'With recruitment', 'Decision'].map((t, i) => `
          <div class="row gap-8 xs ${i === 0 ? '' : 't3'}">
            <span style="width:14px;height:14px;color:${i === 0 ? 'var(--ok)' : 'var(--text-3)'}">
              ${icon(i === 0 ? 'checkCircle' : 'clock')}</span>${esc(t)}</div>`).join('')}
      </div>` : ''}
    </div>
  </section>`;
}


/* What has been dispatched to the driver looking at the page. Sits at the top
   of the dashboard, because a load you have been given is the first thing you
   need to see. */
/* Who has signed up and is waiting. Read straight off the applications, so it
   is right even if a notification was missed, cleared or never arrived. */
function pendingApplicationsHTML() {
  if (!can('recruitment.manage')) return '';
  const waiting = Store.db.applications
    .filter((a) => a.status === 'pending' || a.status === 'review')
    .sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
  if (!waiting.length) return '';
  return `<section class="card reveal mb-16" style="border-color:var(--accent-line)">
    <div class="card-head">
      <div class="card-title">${icon('userPlus')}Waiting on you</div>
      <span class="badge brand">${waiting.length}</span>
    </div>
    <div class="card-body col gap-12">
      ${waiting.slice(0, 5).map((a) => `<div class="row-b wrap gap-12">
        <div class="row gap-10" style="min-width:0">
          <span class="feed-ico">${icon('userPlus')}</span>
          <div style="min-width:0">
            <div class="b7">${esc(a.name)}</div>
            <div class="xs t3 mt-4">${esc(a.country)} · signed up ${esc(fmt.rel(a.submitted))}${
              a.detailed ? '' : ' · not filled in yet'}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-primary" data-act="app-open" data-id="${esc(a.id)}">${icon('eye')}Review</button>
      </div>`).join('')}
      ${waiting.length > 5 ? `<button class="btn btn-sm btn-ghost" data-act="go" data-href="#/admin">
        See all ${waiting.length}</button>` : ''}
    </div>
  </section>`;
}

/* The honest answer to "somebody signed up and I heard nothing".

   A page served by the company service uses it automatically, so most of the
   time there is nothing to say here and this draws nothing. It speaks up in
   the two cases where a sign-up really cannot reach anybody: no service at
   all, or one that is not answering. */
function serviceWarningHTML() {
  if (!can('recruitment.manage')) return '';
  if (state.ui.serviceNoticeHidden) return '';

  const notice = (tone, title, body, cta) => `
    <section class="card reveal mb-16" style="border-color:var(--accent-line)">
      <div class="card-body row gap-12 wrap">
        <span class="stat-ico ${tone}" style="flex:none">${icon('alert')}</span>
        <div class="grow" style="min-width:220px">
          <div class="b7">${title}</div>
          <div class="sm t2 mt-4">${body}</div>
        </div>
        <div class="row gap-8">
          <button class="btn btn-ghost btn-sm" data-act="service-notice-hide">Not now</button>
          ${cta}
        </div>
      </div>
    </section>`;

  if (!Sync.on()) {
    return notice('warn', 'This company is not joined up across machines yet',
      'Sign-ups, applications and support requests are stored only in this browser. '
      + 'The company lives in Supabase, and the Supabase library has not loaded here — '
      + 'check the connection and reload.',
      '');
  }

  if (Sync.status === 'error') {
    return notice('warn', 'Supabase is not answering',
      `Nothing can travel between machines while it is down, so a sign-up made elsewhere
       will not reach you${Sync.lastError ? ' — ' + esc(Sync.lastError) : ''}.`,
      `<button class="btn btn-primary btn-sm" data-act="service-retry">${icon('refresh')}Try again</button>`);
  }

  if (typeof location !== 'undefined' && /^https?:$/.test(location.protocol) &&
      (location.port === '7040' || location.hostname === 'hll-host')) {
    return location.origin;
  }
  return '';
}

function myAssignmentsHTML(u) {
  const mine = assignmentsFor(u.id).filter(isOpenLoad);
  if (!mine.length) return '';
  return `<section class="card reveal mb-16" style="border-color:var(--accent-line)">
    <div class="card-head">
      <div class="card-title">${icon('route')}Dispatched to you</div>
      <span class="badge brand">${mine.length}</span>
    </div>
    <div class="card-body col gap-12">
      ${mine.map((a) => `<div class="row-b wrap gap-12" style="padding:2px 0">
        <div style="min-width:0">
          <div class="b7">${esc(a.from)} <span class="t3">→</span> ${esc(a.to)}</div>
          <div class="xs t3 mt-4">${esc(a.cargo)} · ${fmt.km(a.km)}${
            a.payout ? ' · ' + fmt.eur(a.payout) : ''}${
            a.due ? ' · by ' + esc(fmt.date(a.due)) : ''}</div>
          ${a.note ? `<div class="xs t2 mt-6">${esc(a.note)}</div>` : ''}
        </div>
        <div class="row gap-8">
          ${a.status === 'assigned'
            ? `<button class="btn btn-sm btn-primary" data-act="assignment-state"
                 data-id="${esc(a.id)}" data-v="accepted">${icon('check')}Accept</button>`
            : `<span class="pill info">${icon('check')}Accepted</span>`}
          <button class="btn btn-sm" data-act="assignment-state"
            data-id="${esc(a.id)}" data-v="done">${icon('checkCircle')}Done</button>
        </div>
      </div>`).join('')}
    </div>
  </section>`;
}

function viewDashboard() {
  const u = state.user, db = Store.db;
  const next = Store.upcomingEvents()[0];
  const live = db.events.find((e) => e.status === 'live');
  const pos = Store.rankPosition(u.id, 'km', 'all');
  const rank = rankOf(u), nextRank = RANKS[rank.i + 1];

  /* progress toward next rank across the three gates */
  let rankPct = 100, gates = [];
  if (nextRank) {
    gates = [
      { k: 'Distance',   cur: u.km,         goal: nextRank.km,      f: fmt.km },
      { k: 'Convoys',    cur: u.convoys,    goal: nextRank.convoys, f: fmt.n },
      { k: 'Attendance', cur: u.attendance, goal: nextRank.att,     f: (v) => fmt.pct(v) },
    ];
    rankPct = Math.round(sum(gates.map((g) => clamp(g.cur / g.goal, 0, 1))) / gates.length * 100);
  }

  /* 12-week mileage series */
  const weeks = Array.from({ length: 12 }, (_, i) => {
    const base = u.weekKm || 1200;
    return Math.max(80, Math.round(base * (0.45 + Math.abs(Math.sin(i * 1.7 + u.km % 7)) * 1.05)));
  });
  const weekLabels = Array.from({ length: 12 }, (_, i) => 'W' + (i + 1));
  const fleetWeeks = weeks.map((v) => Math.round(v * rand(6, 9)));

  const myActivity = db.activity.filter((a) => a.driverId === u.id).slice(0, 5);
  const feed = Store.activityFor(u).slice(0, 7);
  const notes = Store.notificationsFor(u.id).slice(0, 4);
  const topDrivers = Store.leaderboard('km', 'all').slice(0, 5);
  const myAch = ACHIEVEMENTS.filter((a) => achEarned(a, u));
  const pinned = db.announcements.find((a) => a.pinned) || db.announcements[0];

  return `
  <div class="page">
    ${onboardingBannerHTML(u)}
    ${serviceWarningHTML()}
    ${pendingApplicationsHTML()}
    ${myAssignmentsHTML(u)}
    <!-- header -->
    <section class="page-head reveal" style="margin-bottom:18px">
      <div>
        <div class="eyebrow">${esc(greeting())} · ${esc(db.meta.season)}</div>
        <h1 class="page-title" style="font-size:23px">Welcome back, ${esc(u.name.split(' ')[0])}</h1>
        <div class="row gap-12 wrap mt-8 sm t2">
          ${rankChip(u)}
          <span class="t3">·</span><span class="mono t3">${esc(u.id)}</span>
          <span class="t3">·</span><span class="t3">#${pos} of ${db.drivers.length}</span>
          ${roleBadge(u.role)}
        </div>
      </div>
      <div class="row gap-8 wrap">
        ${nextRank ? `<div class="row gap-10" style="padding:8px 14px;border-radius:var(--r);border:1px solid var(--line);background:var(--panel)">
          <div style="min-width:132px">
            <div class="row-b xs mb-8"><span class="t3">Next: ${esc(nextRank.name)}</span><span class="t2 tnum">${rankPct}%</span></div>
            ${bar(rankPct, '', 'thin')}
          </div></div>` : `<span class="badge brand">${icon('star')}Highest rank</span>`}
        <button class="btn" data-act="go" data-href="#/driver/${u.id}">${icon('user')}My profile</button>
        <button class="btn btn-primary" data-act="go" data-href="#/convoys">${icon('route')}Browse convoys</button>
      </div>
    </section>

    ${live ? `<div class="card mt-20 reveal d1" style="border-color:rgba(62,207,142,.30)">
      <div class="card-body row-b wrap gap-16">
        <div class="row gap-12">
          <span class="stat-ico" style="color:var(--ok);border-color:rgba(62,207,142,.30)">${icon('play')}</span>
          <div><div class="row gap-8"><span class="badge ok"><span class="live-dot"></span>Live now</span>
            <span class="b7">${esc(live.name)}</span></div>
            <div class="sm t2 mt-4">${esc(live.start)} → ${esc(live.dest)} · ${fmt.km(live.distance)} · ${live.registered.length} drivers rolling</div></div>
        </div>
        <button class="btn btn-ok" data-act="go" data-href="#/convoy/${live.id}">${icon('eye')}Track convoy</button>
      </div></div>` : ''}

    <!-- stat row -->
    <div class="grid g-5 mt-20 reveal d1">
      ${statTile({ label: 'Total distance', value: fmt.n(u.km) + ' km', raw: u.km, icon: 'route', tone: 'brand', delta: { dir: 'up', text: fmt.n(u.weekKm) + ' this week' } })}
      ${(() => { const m = deliveriesThisMonth(u.id); return statTile({ label: 'Deliveries', value: fmt.n(u.deliveries), raw: u.deliveries, icon: 'package', tone: 'info',
        delta: m ? { dir: 'up', text: '+' + m + ' this month' } : null }); })()}
      ${statTile({ label: 'Convoys attended', value: fmt.n(u.convoys), raw: u.convoys, icon: 'truck', tone: 'ok' })}
      ${statTile({ label: 'Attendance', value: fmt.pct(u.attendance), raw: u.attendance, icon: 'checkCircle', tone: u.attendance >= 85 ? 'ok' : 'warn', sub: bar(u.attendance, u.attendance >= 85 ? 'ok' : 'warn', 'thin') })}
      ${statTile({ label: 'Leaderboard', value: '#' + pos, raw: pos, icon: 'trophy', tone: 'violet', sub: `<span class="t3">of ${db.drivers.length} drivers</span>` })}
    </div>

    <div class="grid g-main mt-20">
      <!-- main column -->
      <div class="col gap-20" style="min-width:0">

        <div class="card reveal d2">
          <div class="card-head">
            <div class="card-title">${icon('activity')}Your mileage — last 12 weeks</div>
            <div class="seg">
              <button class="on" data-act="noop">Mine</button>
              <button data-act="dash-fleet-toggle">Fleet</button>
            </div>
          </div>
          <div class="card-body" id="mileageChart" data-mine='${JSON.stringify(weeks)}' data-fleet='${JSON.stringify(fleetWeeks)}'>
            ${areaChart([{ name: 'Your distance', values: weeks, color: '#4f7fff' }], weekLabels,
              { aria: 'Weekly distance driven', fmtY: (v) => Math.round(v / 100) / 10 + 'k', fmtT: fmt.km })}
            <div class="row-b mt-16 wrap gap-12">
              ${[['12-week total', fmt.km(sum(weeks))], ['Weekly average', fmt.km(Math.round(sum(weeks) / 12))],
                 ['Best week', fmt.km(Math.max(...weeks))]].map(([k, v]) =>
                `<div><div class="xs t3 cap b7">${k}</div><div class="b7 lg tnum">${v}</div></div>`).join('')}
            </div>
          </div>
        </div>

        ${next ? `<div class="card reveal d3">
          <div class="card-head">
            <div class="card-title">${icon('route')}Next ${next.type === 'convoy' || next.type === 'community' ? 'convoy' : 'event'}</div>
            <span class="badge brand">${icon('clock')}<span data-countdown="${next.date}">—</span></span>
          </div>
          <div class="card-body">
            <div class="row-b wrap gap-16 mb-16">
              <div style="min-width:0">
                <div class="b8" style="font-size:18px">${esc(next.name)}</div>
                <div class="sm t2 mt-4">${esc(fmt.dt(next.date))} · ${esc(next.server)}</div>
              </div>
              ${dashRegisterButton(next)}
            </div>
            ${next.path.length ? routeMap(next.path, { legend: true, style: 'height:300px' }) : ''}
            <div class="grid g-4 mt-16" style="gap:10px">
              ${[[ 'pin', 'From', next.start ], [ 'flag', 'To', next.dest ],
                 [ 'route', 'Distance', next.distance ? fmt.km(next.distance) : '—' ],
                 [ 'clock', 'Duration', fmt.dur(next.duration) ]].map(([ic, k, v]) =>
                `<div class="row gap-8"><span class="stat-ico" style="width:32px;height:32px;color:var(--accent)">${icon(ic)}</span>
                 <div style="min-width:0"><div class="xs t3 cap b7">${k}</div><div class="b7 md trunc">${esc(v)}</div></div></div>`).join('')}
            </div>
          </div>
        </div>` : ''}

        <div class="card reveal d4">
          <div class="card-head">
            <div class="card-title">${icon('activity')}Fleet activity</div>
            <span class="link sm" data-act="go" data-href="#/drivers">All drivers ${icon('arrowRight')}</span>
          </div>
          <div class="card-body"><div class="feed">
            ${feed.map((a) => {
              const d = Store.driver(a.driverId);
              return `<div class="feed-item">
                <span class="feed-ico" style="color:var(--accent)">${icon(a.icon)}</span>
                <div class="grow" style="min-width:0">
                  <div class="md">${esc(a.text)}</div>
                  <div class="xs t3 mt-4">${esc(fmt.rel(a.at))}${a.meta ? ' · ' + esc(a.meta) : ''}</div>
                </div>
                ${d ? `<span data-act="go" data-href="#/driver/${d.id}" style="cursor:pointer">${avatar(d, 32)}</span>` : ''}
              </div>`;
            }).join('')}
          </div></div>
        </div>
      </div>

      <!-- side column -->
      <div class="col gap-20" style="min-width:0">

        <div class="card reveal d2">
          <div class="card-head"><div class="card-title">${icon('megaphone')}Announcements</div>
            <span class="link sm" data-act="go" data-href="#/community">All</span></div>
          <div class="card-body">
            ${pinned ? `
              <div class="badge brand mb-12">${icon('pin')}${esc(pinned.tag)}</div>
              <div class="b7">${esc(pinned.title)}</div>
              <p class="sm t2 mt-8" style="line-height:1.65">${esc(pinned.body.slice(0, 190))}${pinned.body.length > 190 ? '…' : ''}</p>
              <div class="row gap-8 mt-12 xs t3">${avatar(Store.driver(pinned.author) || u, 24)}
                <span>${esc((Store.driver(pinned.author) || u).name)} · ${esc(fmt.rel(pinned.date))}</span></div>`
            : emptyState('megaphone', 'Nothing announced yet',
                can('content.manage') ? 'Post the first announcement from the Community page.'
                                      : 'Company news will appear here.')}
          </div>
        </div>

        <div class="card reveal d3">
          <div class="card-head"><div class="card-title">${icon('trophy')}Top of the fleet</div>
            <span class="link sm" data-act="go" data-href="#/rankings">Full table</span></div>
          <div class="card-body col gap-12">
            ${topDrivers.map((r, i) => `
              <div class="row gap-10" data-act="go" data-href="#/driver/${r.driver.id}" style="cursor:pointer">
                ${i < 3 ? medal(i + 1, 22) : `<span class="rank-num">${i + 1}</span>`}
                ${avatar(r.driver, 32)}
                <div class="grow" style="min-width:0">
                  <div class="md b6 trunc">${esc(r.driver.name)}</div>
                  <div class="xs t3">${esc(rankOf(r.driver).name)}</div>
                </div>
                <div class="mono sm b7 nowrap">${fmt.kmS(r.value)}</div>
              </div>`).join('')}
            ${topDrivers.some((r) => r.driver.id === u.id) ? '' : `
            <div class="divider" style="margin:4px 0"></div>
            <div class="row gap-10" style="opacity:.95">
              <span class="rank-num">${pos}</span>${avatar(u, 32)}
              <div class="grow"><div class="md b6">You</div><div class="xs t3">${esc(rank.name)}</div></div>
              <div class="mono sm b7">${fmt.kmS(u.km)}</div>
            </div>`}
          </div>
        </div>

        <div class="card reveal d4">
          <div class="card-head"><div class="card-title">${icon('medal')}Achievements</div>
            <span class="badge">${myAch.length}/${ACHIEVEMENTS.length}</span></div>
          <div class="card-body">
            <div class="grid" style="grid-template-columns:repeat(4,1fr);gap:10px">
              ${ACHIEVEMENTS.slice(0, 8).map((a) => {
                const got = achEarned(a, u);
                return `<div class="tip" data-tip="${esc(a.name)}" style="display:grid;place-items:center;aspect-ratio:1;border-radius:14px;
                  background:${got ? 'linear-gradient(135deg,#4f7fff,#e8913a)' : 'var(--panel-2)'};
                  border:1px solid ${got ? 'transparent' : 'var(--line)'};color:${got ? '#170b02' : 'var(--text-3)'};opacity:${got ? 1 : .5}">
                  <span style="width:19px;height:19px">${icon(a.icon)}</span></div>`;
              }).join('')}
            </div>
            <button class="btn btn-block mt-16" data-act="go" data-href="#/achievements">${icon('trophy')}View all achievements</button>
          </div>
        </div>

        <div class="card reveal d5">
          <div class="card-head"><div class="card-title">${icon('bell')}Notifications</div>
            <span class="link sm" data-act="go" data-href="#/notifications">All</span></div>
          <div class="card-body" style="padding:8px">
            ${notes.length ? notes.map((n) => `
              <div class="notif ${n.read ? '' : 'unread'}" data-act="notif-open" data-id="${n.id}">
                <span class="notif-ico" style="color:var(--accent)">${icon(n.icon)}</span>
                <div class="grow" style="min-width:0;padding-right:14px">
                  <div class="md b6">${esc(n.title)}</div>
                  ${n.body ? `<div class="xs t3 trunc">${esc(n.body)}</div>` : ''}
                  <div class="xs t3 mt-4">${esc(fmt.rel(n.at))}</div>
                </div></div>`).join('')
              : emptyState('bell', 'All clear', 'You have no notifications right now.')}
          </div>
        </div>

        <div class="card reveal d6">
          <div class="card-head"><div class="card-title">${icon('user')}Your recent record</div></div>
          <div class="card-body">
            ${myActivity.length ? `<div class="feed">${myActivity.map((a) => `
              <div class="feed-item"><span class="feed-ico" style="color:var(--info)">${icon(a.icon)}</span>
              <div class="grow"><div class="md">${esc(a.text.replace(u.name, 'You'))}</div>
              <div class="xs t3 mt-4">${esc(fmt.rel(a.at))}</div></div></div>`).join('')}</div>`
              : emptyState('activity', 'Nothing logged yet', 'Complete a delivery or attend a convoy to build your record.')}
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}

function dashRegisterButton(ev) {
  const reg = Store.registrationOf(ev, state.user.id);
  if (!reg) return `<button class="btn btn-primary" data-act="ev-register" data-id="${ev.id}">${icon('plus')}Register</button>`;
  if (reg.state === 'registered') return `<button class="btn btn-ok" data-act="ev-confirm" data-id="${ev.id}">${icon('check')}Confirm attendance</button>`;
  return `<span class="badge ok">${icon('checkCircle')}Attendance confirmed</span>`;
}

/* ============================================================
   Part 4/6 — drivers, profiles, fleet, convoys
   ============================================================ */

/* ---------------- 17. Drivers (spec §4) ---------------- */
function filteredDrivers() {
  const { driverRank, driverQuery, driverSort } = state.ui;
  let list = Store.db.drivers.slice();
  if (driverRank !== 'all') list = list.filter((d) => rankOf(d).key === driverRank);
  if (driverQuery.trim()) {
    const q = driverQuery.toLowerCase();
    list = list.filter((d) => (d.name + d.id + d.country + rankOf(d).name).toLowerCase().includes(q));
  }
  const sorters = {
    km: (a, b) => b.km - a.km, name: (a, b) => a.name.localeCompare(b.name),
    convoys: (a, b) => b.convoys - a.convoys, attendance: (a, b) => b.attendance - a.attendance,
    joined: (a, b) => new Date(a.joined) - new Date(b.joined), rank: (a, b) => b.rankIdx - a.rankIdx,
  };
  return list.sort(sorters[driverSort] || sorters.km);
}

function viewDrivers() {
  const list = filteredDrivers();
  const db = Store.db;
  const online = db.drivers.filter((d) => d.status !== 'offline').length;

  return `
  <div class="page">
    <div class="page-head">
      <div>
        <div class="eyebrow">Crew roster</div>
        <h1 class="page-title">Drivers</h1>
        <p class="page-sub">${fmt.n(db.drivers.length)} drivers on the books · ${online} active right now</p>
      </div>
      <div class="row gap-8 wrap">
        <div class="seg">
          <button class="${state.ui.driverView === 'grid' ? 'on' : ''}" data-act="dv-view" data-v="grid">${icon('grid')}</button>
          <button class="${state.ui.driverView === 'table' ? 'on' : ''}" data-act="dv-view" data-v="table">${icon('menu')}</button>
        </div>
        ${can('drivers.manage') ? `<button class="btn btn-primary" data-act="admin-add-driver">${icon('userPlus')}Add driver</button>` : ''}
      </div>
    </div>

    <div class="card mb-20">
      <div class="card-body row gap-12 wrap">
        <div class="search grow" style="max-width:340px">${icon('search')}
          <input class="input" id="driverSearch" placeholder="Search name, HLL ID, country…" value="${esc(state.ui.driverQuery)}" style="padding-left:38px">
        </div>
        <select class="select" id="driverRank" style="width:auto;min-width:180px">
          <option value="all">All ranks</option>
          ${RANKS.map((r) => `<option value="${r.key}" ${state.ui.driverRank === r.key ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}
        </select>
        <select class="select" id="driverSort" style="width:auto;min-width:170px">
          ${[['km', 'Distance driven'], ['rank', 'Rank'], ['convoys', 'Convoys'], ['attendance', 'Attendance'], ['joined', 'Longest serving'], ['name', 'Name A–Z']]
            .map(([v, l]) => `<option value="${v}" ${state.ui.driverSort === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
        </select>
        <div class="grow"></div>
        <span class="badge">${list.length} shown</span>
      </div>
    </div>

    ${!list.length ? `<div class="card">${emptyState('users', 'No drivers match', 'Try clearing the search or rank filter.')}</div>`
      : state.ui.driverView === 'grid' ? `
      <div class="grid g-auto">
        ${list.map((d, i) => driverCard(d, i)).join('')}
      </div>` : `
      <div class="card clip"><div class="table-wrap"><table class="tbl">
        <thead><tr><th>Driver</th><th>Rank</th><th class="right">Distance</th><th class="right">Deliveries</th>
          <th class="right">Convoys</th><th>Attendance</th><th>Joined</th><th>Status</th></tr></thead>
        <tbody>${list.map((d) => `
          <tr class="clickable" data-act="go" data-href="#/driver/${d.id}">
            <td><div class="row gap-10">${avatar(d, 32)}
              <div style="min-width:0"><div class="b6 trunc">${esc(d.name)}${d.id === state.user.id ? ' <span class="badge brand xs">You</span>' : ''}</div>
              <div class="xs t3 mono">${esc(d.id)}</div></div></div></td>
            <td>${rankChip(d)}</td>
            <td class="right mono b6">${fmt.n(d.km)}</td>
            <td class="right mono">${fmt.n(d.deliveries)}</td>
            <td class="right mono">${fmt.n(d.convoys)}</td>
            <td style="min-width:120px"><div class="row gap-8"><span class="mono sm b6" style="width:34px">${d.attendance}%</span>
              ${bar(d.attendance, d.attendance >= 85 ? 'ok' : d.attendance >= 70 ? 'warn' : 'danger', 'thin')}</div></td>
            <td class="sm t2 nowrap">${esc(fmt.date(d.joined, { month: 'short', year: 'numeric' }))}</td>
            <td>${statusBadge(d.status)}</td>
          </tr>`).join('')}</tbody>
      </table></div></div>`}
  </div>`;
}

function driverCard(d, i) {
  const truck = Store.truck(d.truckId);
  return `<div class="card hover clip reveal d${clamp(i % 8 + 1, 1, 8)}" data-act="go" data-href="#/driver/${d.id}" style="cursor:pointer">
    <div class="card-body">
      <div class="row-b" style="align-items:flex-start">
        ${avatar(d, 52, true)}
        ${d.id === state.user.id ? '<span class="badge brand">You</span>' : roleBadge(d.role) || statusBadge(d.status)}
      </div>
      <div class="b7 lg mt-12 trunc">${esc(d.name)}</div>
      <div class="row gap-8 mt-4"><span class="xs t3 mono">${esc(d.id)}</span><span class="xs t3">·</span><span class="xs t3">${esc(d.country)}</span></div>
      <div class="mt-12">${rankChip(d)}</div>
      <div class="grid g-3 mt-16" style="gap:8px">
        ${[[fmt.kmS(d.km), 'Distance'], [fmt.n(d.convoys), 'Convoys'], [d.attendance + '%', 'Attend.']]
          .map(([v, k]) => `<div><div class="b7 md tnum">${v}</div><div class="xs t3 cap b7" style="font-size:9.5px">${k}</div></div>`).join('')}
      </div>
      <div class="divider" style="margin:14px 0 10px"></div>
      <div class="row-b xs t3">
        <span class="row gap-6">${icon('truck')}${truck ? esc(truck.make + ' ' + truck.model) : 'No vehicle assigned'}</span>
        <span>${ACHIEVEMENTS.filter((a) => achEarned(a, d)).length} ${icon('medal')}</span>
      </div>
    </div>
  </div>`;
}

/* ---------------- 18. Driver profile ---------------- */
function viewDriver(id) {
  const d = Store.driver(id);
  if (!d) return notFound('Driver not found', 'That HLL ID is not on the roster.', '#/drivers');
  const me = d.id === state.user.id;
  const r = rankOf(d), nextRank = RANKS[r.i + 1];
  const truck = Store.truck(d.truckId), trailer = Store.trailer(d.trailerId);
  const acts = Store.activityFor(state.user).filter((a) => a.driverId === d.id).slice(0, 12);
  const earned = ACHIEVEMENTS.filter((a) => achEarned(a, d));
  const attended = Store.db.events.filter((e) => e.registered.some((x) => x.driverId === d.id && x.state === 'completed'));
  const tab = state.ui.profileTab;

  const gates = nextRank ? [
    { k: 'Distance', cur: d.km, goal: nextRank.km, f: fmt.km },
    { k: 'Convoys', cur: d.convoys, goal: nextRank.convoys, f: fmt.n },
    { k: 'Attendance', cur: d.attendance, goal: nextRank.att, f: (v) => fmt.pct(v) },
  ] : [];
  const rankPct = nextRank ? Math.round(sum(gates.map((g) => clamp(g.cur / g.goal, 0, 1))) / 3 * 100) : 100;

  const monthly = Array.from({ length: 6 }, (_, i) =>
    Math.round(Math.max(200, (d.monthKm || 4000) * (0.55 + Math.abs(Math.sin(i * 2.1 + d.km % 5)) * 0.9))));
  const monthLabels = Array.from({ length: 6 }, (_, i) => {
    const dt = new Date(); dt.setMonth(dt.getMonth() - (5 - i));
    return dt.toLocaleDateString('en-GB', { month: 'short' });
  });

  return `
  <div class="page">
    ${crumbs([{ label: 'Drivers', href: '#/drivers' }, { label: d.name }])}

    <section class="card clip reveal">
      <div class="card-body">
        <div class="row-b wrap gap-20" style="align-items:flex-end">
          <div class="row gap-16 wrap" style="align-items:flex-end">
            ${avatar(d, 120, true)}
            <div style="padding-bottom:4px">
              <div class="row gap-8 wrap">
                <h1 class="page-title">${esc(d.name)}</h1>
                ${me ? '<span class="badge brand">You</span>' : ''}
                ${roleBadge(d.role)}
                ${d.accountStatus === 'suspended' ? statusBadge('suspended') : ''}
              </div>
              <div class="row gap-8 wrap mt-8">
                ${rankChip(d)}
                <span class="badge mono">${esc(d.id)}</span>
                ${statusBadge(d.status)}
                <span class="badge">${esc(d.country)}</span>
              </div>
              <div class="sm t3 mt-8">Joined ${esc(fmt.date(d.joined))} · ${Math.round((Date.now() - new Date(d.joined)) / DAY)} days of service · last seen ${esc(fmt.rel(d.lastSeen))}</div>
            </div>
          </div>
          <div class="row gap-8 wrap" style="padding-bottom:4px">
            ${me ? `<button class="btn" data-act="go" data-href="#/settings">${icon('edit')}Edit profile</button>` : ''}
            ${can('events.manage') ? `<button class="btn" data-act="dispatch-new" data-id="${d.id}">${icon('route')}Dispatch a load</button>` : ''}
            ${can('drivers.manage') && !me ? `<button class="btn" data-act="admin-edit-driver" data-id="${d.id}">${icon('settings')}Manage driver</button>` : ''}
            <button class="btn btn-primary" data-act="go" data-href="#/rankings">${icon('trophy')}#${Store.rankPosition(d.id)} in fleet</button>
          </div>
        </div>
      </div>
    </section>

    <div class="grid g-6 mt-20 reveal d1">
      ${statTile({ label: 'Total distance', value: fmt.n(d.km) + ' km', raw: d.km, icon: 'route', tone: 'brand' })}
      ${statTile({ label: 'Deliveries', value: fmt.n(d.deliveries), raw: d.deliveries, icon: 'package', tone: 'info' })}
      ${statTile({ label: 'Earned', value: fmt.eur(d.earned || 0), raw: d.earned || 0, icon: 'star', tone: 'ok' })}
      ${statTile({ label: 'Convoys', value: fmt.n(d.convoys), raw: d.convoys, icon: 'truck', tone: 'ok' })}
      ${statTile({ label: 'Attendance', value: fmt.pct(d.attendance), raw: d.attendance, icon: 'checkCircle', tone: d.attendance >= 85 ? 'ok' : 'warn' })}
      ${statTile({ label: 'Achievements', value: earned.length + '/' + ACHIEVEMENTS.length, raw: earned.length, icon: 'medal', tone: 'violet' })}
    </div>

    <div class="card mt-20">
      <div class="tabs" style="padding:0 8px">
        ${[['overview', 'Overview'], ['history', 'History'], ['stats', 'Statistics'], ['achievements', 'Achievements'], ['convoys', 'Convoy history'], ['activity', 'Activity']]
          .map(([k, l]) => `<button class="${tab === k ? 'on' : ''}" data-act="profile-tab" data-tab="${k}">${l}</button>`).join('')}
      </div>
      <div class="card-body">
        ${tab === 'overview' ? `
          <div class="grid g-main">
            <div class="col gap-20">
              ${nextRank ? `<div class="card"><div class="card-head"><div class="card-title">${icon('medal')}Progression to ${esc(nextRank.name)}</div>
                <span class="badge brand">${rankPct}%</span></div>
                <div class="card-body col gap-16">
                  ${gates.map((g) => {
                    const pct = clamp(g.cur / g.goal * 100, 0, 100);
                    const met = g.cur >= g.goal;
                    return `<div><div class="row-b sm mb-8"><span class="b6">${g.k}</span>
                      <span class="mono ${met ? '' : 't2'}" style="${met ? 'color:var(--ok)' : ''}">${g.f(g.cur)} / ${g.f(g.goal)}${met ? ' ✓' : ''}</span></div>
                      ${bar(pct, met ? 'ok' : '', 'thin')}</div>`;
                  }).join('')}
                </div></div>` : `<div class="card card-body row gap-12">
                  <span class="stat-ico" style="color:var(--accent)">${icon('star')}</span>
                  <div><div class="b7">Top of the ladder</div><div class="sm t2">${esc(d.name.split(' ')[0])} holds the highest rank Heavyline awards.</div></div></div>`}

              <div class="card"><div class="card-head"><div class="card-title">${icon('activity')}Distance — last 6 months</div></div>
                <div class="card-body">${areaChart([{ name: 'Distance', values: monthly, color: '#4aa3f0' }], monthLabels,
                  { h: 200, fmtY: (v) => Math.round(v / 1000) + 'k', fmtT: fmt.km, aria: 'Monthly distance' })}</div></div>
            </div>

            <div class="col gap-20">
              <div class="card"><div class="card-head"><div class="card-title">${icon('truck')}Assigned vehicle</div></div>
                ${truck ? `<div class="truck-vis" style="height:110px"><div class="floor"></div>${rigSvg(truck.livery)}</div>
                <div class="card-body">
                  <div class="row-b"><div><div class="b7">${esc(truck.make)} ${esc(truck.model)}</div>
                    <div class="xs t3 mono">${esc(truck.id)} · ${esc(truck.plate)}</div></div>${statusBadge(truck.status)}</div>
                  ${kv('Power', truck.hp + ' hp')}${kv('Gearbox', esc(truck.gearbox))}${kv('Chassis', esc(truck.chassis))}
                  ${kv('Trailer', trailer ? esc(trailer.type + ' · ' + trailer.id) : '—')}
                  <button class="btn btn-block mt-12" data-act="go" data-href="#/vehicle/${truck.id}">${icon('eye')}Vehicle profile</button>
                </div>` : `<div class="card-body">${emptyState('truck', 'No vehicle assigned', 'This driver has no truck allocated from the HLL fleet.')}</div>`}
              </div>

              <div class="card"><div class="card-head"><div class="card-title">${icon('info')}Driver record</div></div>
                <div class="card-body">
                  ${kv('HLL ID', `<span class="mono">${esc(d.id)}</span>`)}
                  ${kv('Rank', `<span style="color:${r.color}">${esc(r.name)}</span>`)}
                  ${kv('Role', esc(ROLES[d.role].name))}
                  ${kv('Joined', esc(fmt.date(d.joined)))}
                  ${kv('Discord', `<span class="mono">${esc(d.discord)}</span>`)}
                  ${kv('TruckersMP', `<span class="mono">${esc(d.truckersmp)}</span>`)}
                  ${kv('Account', statusBadge(d.accountStatus))}
                </div></div>
            </div>
          </div>` : ''}

        ${tab === 'history' ? driverHistoryHTML(d) : ''}

        ${tab === 'stats' ? `
          <div class="grid g-2">
            <div class="card"><div class="card-head"><div class="card-title">${icon('chart')}Distance by month</div></div>
              <div class="card-body">${barChart(monthLabels.map((l, i) => ({ label: l, value: monthly[i] })),
                { h: 240, fmtY: (v) => Math.round(v / 1000) + 'k', fmtT: fmt.km })}</div></div>
            <div class="card"><div class="card-head"><div class="card-title">${icon('package')}Cargo mix</div></div>
              <div class="card-body">${donut([
                { label: 'Curtainsider', value: Math.round(d.deliveries * .34), color: '#4f7fff' },
                { label: 'Reefer', value: Math.round(d.deliveries * .24), color: '#4aa3f0' },
                { label: 'Flatbed', value: Math.round(d.deliveries * .18), color: '#3ecf8e' },
                { label: 'Container', value: Math.round(d.deliveries * .14), color: '#8b7cf0' },
                { label: 'Heavy plant', value: Math.round(d.deliveries * .10), color: '#d99b2b' },
              ], { centerValue: fmt.n(d.deliveries), centerLabel: 'Deliveries' })}</div></div>
            <div class="card span-2"><div class="card-head"><div class="card-title">${icon('gauge')}Performance indicators</div></div>
              <div class="card-body grid g-4">
                ${[['Avg. distance / delivery', fmt.km(Math.round(d.km / Math.max(1, d.deliveries))), 'route'],
                   ['Avg. distance / week', fmt.km(d.weekKm), 'activity'],
                   ['Convoy attendance', fmt.pct(d.attendance), 'checkCircle'],
                   ['Season points', fmt.n(d.seasonPoints), 'star']].map(([k, v, ic]) => `
                  <div class="row gap-12"><span class="stat-ico" style="color:var(--accent)">${icon(ic)}</span>
                  <div><div class="xs t3 cap b7">${k}</div><div class="b8 lg tnum">${v}</div></div></div>`).join('')}
              </div></div>
          </div>` : ''}

        ${tab === 'achievements' ? `
          <div class="grid g-auto" style="grid-template-columns:repeat(auto-fill,minmax(190px,1fr))">
            ${ACHIEVEMENTS.map((a) => achCard(a, d)).join('')}
          </div>` : ''}

        ${tab === 'convoys' ? (attended.length ? `
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Convoy</th><th>Route</th><th class="right">Distance</th><th>Date</th><th>Result</th></tr></thead>
            <tbody>${attended.map((e) => `<tr class="clickable" data-act="go" data-href="#/convoy/${e.id}">
              <td class="b6">${esc(e.name)}</td>
              <td class="sm t2">${esc(e.start)} → ${esc(e.dest)}</td>
              <td class="right mono">${e.distance ? fmt.km(e.distance) : '—'}</td>
              <td class="sm t2 nowrap">${esc(fmt.date(e.date))}</td>
              <td>${statusBadge('completed')}</td></tr>`).join('')}</tbody>
          </table></div>` : emptyState('route', 'No convoy history', 'Completed convoys will be recorded here automatically.')) : ''}

        ${tab === 'activity' ? (acts.length ? `<div class="timeline">
            ${acts.map((a, i) => `<div class="tl-item ${i === 0 ? 'now' : 'done'}">
              <div class="row gap-8"><span style="width:15px;height:15px;color:var(--accent)">${icon(a.icon)}</span>
              <span class="b6 md">${esc(a.text)}</span></div>
              <div class="xs t3 mt-4">${esc(fmt.dt(a.at))}${a.meta ? ' · ' + esc(a.meta) : ''}</div></div>`).join('')}
          </div>` : emptyState('activity', 'No activity recorded', 'Driver activity appears here as it happens.')) : ''}
      </div>
    </div>
  </div>`;
}

function achCard(a, d) {
  const got = achEarned(a, d);
  const p = achProgress(a, d);
  const col = TIER_COLOR[a.tier];
  return `<div class="ach ${got ? 'earned' : 'locked'}">
    <div class="ach-medal" ${got ? `style="background:linear-gradient(135deg,${col},${col}aa)"` : ''}>
      ${icon(a.icon)}${got ? '' : `<span class="ach-lock">${icon('lock')}</span>`}
    </div>
    <div><div class="b7 md">${esc(a.name)}</div>
      <div class="xs t3 mt-4" style="line-height:1.5">${esc(a.desc)}</div></div>
    ${got ? `<span class="badge" style="color:${col};border-color:${col}44;background:${col}18">${esc(a.tier.toUpperCase())}</span>`
      : `<div style="width:100%">${bar(p * 100, '', 'thin')}<div class="xs t3 mt-4">${Math.round(p * 100)}% complete</div></div>`}
  </div>`;
}

function notFound(title, body, back) {
  return `<div class="page"><div class="card">${emptyState('alert', title, body,
    `<button class="btn btn-primary mt-8" data-act="go" data-href="${back}">${icon('arrowLeft')}Go back</button>`)}</div></div>`;
}

/* ---------------- 19. Fleet (spec §5) ---------------- */
function viewFleet() {
  const db = Store.db;
  const tab = state.ui.fleetTab, fs = state.ui.fleetStatus;
  const trucks = db.trucks.filter((t) => fs === 'all' || t.status === fs);
  const trailers = db.trailers.filter((t) => fs === 'all' || t.status === fs);
  const util = Math.round(db.trucks.filter((t) => t.status === 'active').length / db.trucks.length * 100);

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Fleet management</div>
        <h1 class="page-title">Fleet</h1>
        <p class="page-sub">${db.trucks.length} tractor units · ${db.trailers.length} trailers · ${util}% utilisation</p></div>
      ${can('fleet.manage') ? `<button class="btn btn-primary" data-act="fleet-add">${icon('plus')}Add vehicle</button>` : ''}
    </div>

    <div class="grid g-4 mb-20 reveal">
      ${statTile({ label: 'Total units', value: fmt.n(db.trucks.length + db.trailers.length), raw: db.trucks.length + db.trailers.length, icon: 'truck', tone: 'brand' })}
      ${statTile({ label: 'In service', value: fmt.n(db.trucks.filter((t) => t.status === 'active').length), raw: db.trucks.filter((t) => t.status === 'active').length, icon: 'checkCircle', tone: 'ok' })}
      ${statTile({ label: 'Available', value: fmt.n(db.trucks.filter((t) => t.status === 'available').length), raw: db.trucks.filter((t) => t.status === 'available').length, icon: 'key', tone: 'info' })}
      ${statTile({ label: 'In maintenance', value: fmt.n(db.trucks.filter((t) => t.status === 'maintenance').length), raw: db.trucks.filter((t) => t.status === 'maintenance').length, icon: 'wrench', tone: 'warn' })}
    </div>

    <div class="card mb-20"><div class="card-body row gap-12 wrap">
      <div class="seg">
        <button class="${tab === 'trucks' ? 'on' : ''}" data-act="fleet-tab" data-tab="trucks">Tractor units</button>
        <button class="${tab === 'trailers' ? 'on' : ''}" data-act="fleet-tab" data-tab="trailers">Trailers</button>
      </div>
      <div class="grow"></div>
      <div class="row gap-6 wrap">
        ${[['all', 'All'], ['active', 'In service'], ['available', 'Available'], ['maintenance', 'Maintenance']]
          .map(([v, l]) => `<button class="chip ${fs === v ? 'on' : ''}" data-act="fleet-status" data-v="${v}">${l}</button>`).join('')}
      </div>
    </div></div>

    ${tab === 'trucks' ? `<div class="grid g-auto-lg">
      ${trucks.length ? trucks.map((t, i) => truckCard(t, i)).join('')
        : `<div class="card span-2">${emptyState('truck', 'No units match', 'Change the status filter to see more of the fleet.')}</div>`}
    </div>` : `<div class="grid g-auto">
      ${trailers.map((t, i) => `<div class="card hover card-body reveal d${clamp(i % 8 + 1, 1, 8)}">
        <div class="row-b"><div class="row gap-10">
          <span class="stat-ico" style="color:var(--info)">${icon('package')}</span>
          <div><div class="b7">${esc(t.type)}</div><div class="xs t3 mono">${esc(t.id)}</div></div>
        </div>${statusBadge(t.status)}</div>
        <div class="mt-12">${kv('Cargo', esc(t.cargo))}${kv('Axles', t.axles)}${kv('Weight', esc(t.weight))}
        ${kv('Coupled to', t.assignedTruck ? `<span class="link" data-act="go" data-href="#/vehicle/${t.assignedTruck}">${esc(t.assignedTruck)}</span>` : '—')}</div>
      </div>`).join('')}
    </div>`}
  </div>`;
}

function truckCard(t, i) {
  const d = t.assignedTo ? Store.driver(t.assignedTo) : null;
  const liv = LIVERIES.find((l) => l.key === t.livery) || LIVERIES[0];
  return `<div class="truck-card reveal d${clamp(i % 8 + 1, 1, 8)}" data-act="go" data-href="#/vehicle/${t.id}" style="cursor:pointer">
    <div class="truck-vis"><div class="floor"></div>${rigSvg(t.livery)}
      <span class="badge ${t.status === 'active' ? 'ok' : t.status === 'maintenance' ? 'warn' : 'info'}"
        style="position:absolute;top:12px;right:12px">${esc(t.status === 'active' ? 'In service' : t.status === 'maintenance' ? 'Maintenance' : 'Available')}</span>
    </div>
    <div class="card-body">
      <div class="row-b">
        <div style="min-width:0"><div class="b7 lg trunc">${esc(t.make)} ${esc(t.model)}</div>
          <div class="xs t3 mono">${esc(t.id)} · ${esc(t.plate)}</div></div>
        <span class="badge" style="color:${liv.a};border-color:${liv.a}44;background:${liv.a}14">${esc(liv.name)}</span>
      </div>
      <div class="spec-grid mt-16">
        <div class="spec"><div class="k">Power</div><div class="v">${t.hp} hp</div></div>
        <div class="spec"><div class="k">Chassis</div><div class="v">${esc(t.chassis)}</div></div>
        <div class="spec"><div class="k">Odometer</div><div class="v">${fmt.kmS(t.mileage)}</div></div>
        <div class="spec"><div class="k">Year</div><div class="v">${t.year}</div></div>
      </div>
      <div class="row-b mt-16">
        ${d ? `<div class="row gap-8">${avatar(d, 32)}<div style="min-width:0">
            <div class="sm b6 trunc">${esc(d.name)}</div><div class="xs t3">Assigned driver</div></div></div>`
           : `<span class="sm t3 row gap-6">${icon('user')}Unassigned</span>`}
        ${icon('chevron', 'chev')}
      </div>
    </div>
  </div>`;
}

function viewVehicle(id) {
  const t = Store.truck(id);
  if (!t) return notFound('Vehicle not found', 'That unit is not in the HLL fleet register.', '#/fleet');
  const d = t.assignedTo ? Store.driver(t.assignedTo) : null;
  const trailer = Store.db.trailers.find((x) => x.assignedTruck === t.id);
  const liv = LIVERIES.find((l) => l.key === t.livery) || LIVERIES[0];
  const svcDue = Math.round((new Date(t.nextService) - Date.now()) / DAY);

  return `
  <div class="page">
    ${crumbs([{ label: 'Fleet', href: '#/fleet' }, { label: t.id }])}
    <div class="grid g-main">
      <div class="col gap-20">
        <div class="card clip reveal">
          <div class="truck-vis" style="height:210px"><div class="floor"></div>${rigSvg(t.livery)}</div>
          <div class="card-body">
            <div class="row-b wrap gap-12">
              <div><h1 class="page-title">${esc(t.make)} ${esc(t.model)}</h1>
                <div class="row gap-8 mt-8 wrap"><span class="badge mono">${esc(t.id)}</span>
                  <span class="badge">${esc(t.plate)}</span>${statusBadge(t.status)}
                  <span class="badge" style="color:${liv.a};border-color:${liv.a}44;background:${liv.a}14">${esc(liv.name)}</span></div></div>
              ${can('fleet.manage') ? `<div class="row gap-8">
                <button class="btn" data-act="fleet-edit" data-id="${t.id}">${icon('edit')}Edit</button>
                <button class="btn" data-act="fleet-assign" data-id="${t.id}">${icon('user')}Assign driver</button></div>` : ''}
            </div>
          </div>
        </div>

        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('gauge')}Specification</div></div>
          <div class="card-body grid g-3" style="gap:12px">
            ${[['Make', t.make], ['Model', t.model], ['Model year', t.year], ['Power output', t.hp + ' hp'],
               ['Cab', t.cab], ['Gearbox', t.gearbox], ['Chassis', t.chassis], ['Registration', t.plate],
               ['Odometer', fmt.km(t.mileage)]].map(([k, v]) => `
              <div class="spec" style="border-radius:12px;border:1px solid var(--line)">
                <div class="k">${esc(k)}</div><div class="v">${esc(v)}</div></div>`).join('')}
          </div></div>

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('wrench')}Maintenance</div>
          <span class="badge ${svcDue < 14 ? 'warn' : 'ok'}">${svcDue > 0 ? `Service due in ${svcDue} days` : 'Service overdue'}</span></div>
          <div class="card-body">
            ${kv('Last service', esc(fmt.date(t.lastService)))}
            ${kv('Next service', esc(fmt.date(t.nextService)))}
            ${kv('Current status', statusBadge(t.status))}
            ${kv('Odometer at last service', t.serviceKm != null ? fmt.km(t.serviceKm) : '—')}
            <div class="mt-16">${bar(clamp(100 - svcDue / 1.8, 5, 100), svcDue < 14 ? 'warn' : 'ok', 'thin')}
              <div class="xs t3 mt-8">Service interval progress</div></div>
          </div></div>
      </div>

      <div class="col gap-20">
        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('user')}Assigned driver</div></div>
          ${d ? `<div class="card-body">
            <div class="row gap-12" data-act="go" data-href="#/driver/${d.id}" style="cursor:pointer">
              ${avatar(d, 52, true)}
              <div style="min-width:0"><div class="b7 lg trunc">${esc(d.name)}</div>
              <div class="xs t3 mono">${esc(d.id)}</div><div class="mt-4">${rankChip(d)}</div></div></div>
            <div class="mt-16">${kv('Distance driven', fmt.km(d.km))}${kv('Deliveries', fmt.n(d.deliveries))}${kv('Convoys', fmt.n(d.convoys))}</div>
          </div>` : `<div class="card-body">${emptyState('user', 'Unassigned', 'This unit is available for allocation.',
            can('fleet.manage') ? `<button class="btn btn-primary btn-sm" data-act="fleet-assign" data-id="${t.id}">${icon('plus')}Assign a driver</button>` : '')}</div>`}
        </div>

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('package')}Coupled trailer</div></div>
          <div class="card-body">
            ${trailer ? `${kv('Unit', `<span class="mono">${esc(trailer.id)}</span>`)}${kv('Type', esc(trailer.type))}
              ${kv('Cargo', esc(trailer.cargo))}${kv('Axles', trailer.axles)}${kv('Gross weight', esc(trailer.weight))}`
              : emptyState('package', 'No trailer coupled', 'Assign a trailer from the fleet register.')}
          </div></div>

        <div class="card reveal d3"><div class="card-head"><div class="card-title">${icon('book')}Unit history</div></div>
          <div class="card-body"><div class="timeline">
            ${[['Entered service', fmt.date(new Date(t.year, 2, 14).toISOString()), 'done'],
               ['Livery applied — ' + liv.name, fmt.date(new Date(Date.now() - 210 * DAY).toISOString()), 'done'],
               ['Last workshop visit', fmt.date(t.lastService), 'done'],
               [d ? 'Assigned to ' + d.name : 'Returned to pool', fmt.date(new Date(Date.now() - 40 * DAY).toISOString()), 'now']]
              .map(([txt, when, cls]) => `<div class="tl-item ${cls}">
                <div class="b6 md">${esc(txt)}</div><div class="xs t3 mt-4">${esc(when)}</div></div>`).join('')}
          </div></div></div>
      </div>
    </div>
  </div>`;
}

/* ---------------- 20. Convoys (spec §6 & §7) ---------------- */
function viewConvoys() {
  const tab = state.ui.convoyTab;
  const list = tab === 'upcoming' ? Store.upcomingEvents().filter((e) => e.path.length)
                                  : Store.pastEvents().filter((e) => e.path.length);
  const mine = Store.db.events.filter((e) => Store.registrationOf(e, state.user.id));

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Convoy operations</div>
        <h1 class="page-title">Convoys</h1>
        <p class="page-sub">${Store.upcomingEvents().filter((e) => e.path.length).length} scheduled · you are registered for ${mine.filter((e) => e.status !== 'completed').length}</p></div>
      <div class="row gap-8">
        <div class="seg">
          <button class="${tab === 'upcoming' ? 'on' : ''}" data-act="convoy-tab" data-tab="upcoming">Upcoming</button>
          <button class="${tab === 'past' ? 'on' : ''}" data-act="convoy-tab" data-tab="past">Completed</button>
        </div>
        ${can('events.manage') ? `<button class="btn btn-primary" data-act="event-create">${icon('plus')}Create convoy</button>` : ''}
      </div>
    </div>

    ${list.length ? `<div class="grid g-auto-lg">${list.map((e, i) => convoyCard(e, i)).join('')}</div>`
      : `<div class="card">${emptyState('route', tab === 'upcoming' ? 'No convoys scheduled' : 'No completed convoys',
          tab === 'upcoming' ? 'New convoys are announced in the community channels.' : 'Convoy history will appear here.')}</div>`}
  </div>`;
}

function convoyCard(e, i) {
  const leader = Store.driver(e.leaderId);
  const regs = e.registered.map((r) => Store.driver(r.driverId)).filter(Boolean);
  const my = Store.registrationOf(e, state.user.id);
  const fill = Math.round(e.registered.length / e.maxSlots * 100);
  const dt = new Date(e.date);

  return `<div class="convoy-card reveal d${clamp(i % 8 + 1, 1, 8)}">
    <div class="convoy-banner">
      <div class="haul">${routeMap(e.path, { legend: false, fit: true })}</div>
      <div class="convoy-date">
        <div class="d">${dt.getDate()}</div>
        <div class="m">${dt.toLocaleDateString('en-GB', { month: 'short' })}</div>
      </div>
      <span style="position:absolute;right:12px;top:12px;z-index:2">${statusBadge(e.status)}</span>
    </div>
    <div class="card-body grow col">
      <div class="row gap-8 mb-8"><span class="badge ${e.tone}">${esc(e.typeLabel)}</span>
        <span class="badge">${esc(fmt.time(e.date))} UTC</span></div>
      <div class="b8 lg" style="cursor:pointer" data-act="go" data-href="#/convoy/${e.id}">${esc(e.name)}</div>

      <div class="route-line mt-12">
        <span class="dotA"></span><span class="b6 sm trunc">${esc(e.start)}</span>
        <span class="dash"></span>
        <span class="b6 sm trunc">${esc(e.dest)}</span><span class="dotB"></span>
      </div>

      <div class="row gap-16 mt-12 sm t2 wrap">
        <span class="row gap-6">${icon('route')}${fmt.km(e.distance)}</span>
        <span class="row gap-6">${icon('clock')}${fmt.dur(e.duration)}</span>
        <span class="row gap-6">${icon('pin')}${e.path.length - 2 > 0 ? e.path.length - 2 + ' checkpoints' : 'Direct'}</span>
      </div>

      <div class="mt-16">
        <div class="row-b xs t3 mb-8"><span>${e.registered.length} of ${e.maxSlots} slots</span><span>${fill}% full</span></div>
        ${bar(fill, fill > 85 ? 'warn' : '', 'thin')}
      </div>

      <div class="divider" style="margin:14px 0 12px"></div>
      <div class="row-b">
        <div class="row gap-8">
          ${avatarStack(regs, 4, 24)}
          ${leader ? `<span class="xs t3">Led by ${esc(leader.name.split(' ')[0])}</span>` : ''}
        </div>
        ${e.status === 'completed'
          ? `<span class="badge ${my && my.state === 'completed' ? 'ok' : ''}">${my && my.state === 'completed' ? 'You attended' : 'Completed'}</span>`
          : my ? `<span class="badge ok">${icon('check')}${my.state === 'confirmed' ? 'Confirmed' : 'Registered'}</span>`
               : `<button class="btn btn-sm btn-primary" data-act="ev-register" data-id="${e.id}">${icon('plus')}Register</button>`}
      </div>
    </div>
  </div>`;
}

function viewConvoy(id) {
  const e = Store.event(id);
  if (!e) return notFound('Convoy not found', 'That event is not in the HLL calendar.', '#/convoys');
  const leader = Store.driver(e.leaderId);
  const my = Store.registrationOf(e, state.user.id);
  const regs = e.registered.map((r) => ({ r, d: Store.driver(r.driverId) })).filter((x) => x.d);
  const fill = Math.round(e.registered.length / e.maxSlots * 100);
  const isLive = e.status === 'live';
  const done = e.status === 'completed';

  const overlay = `<div class="map-overlay">
    <span class="badge ${isLive ? 'ok' : 'brand'}" style="height:26px">${isLive ? '<span class="live-dot"></span>Convoy rolling' : icon('route') + fmt.km(e.distance)}</span>
    <span class="badge" style="height:26px">${icon('clock')}${fmt.dur(e.duration)}</span></div>`;

  return `
  <div class="page">
    ${crumbs([{ label: 'Convoys', href: '#/convoys' }, { label: e.name }])}

    <div class="page-head">
      <div>
        <div class="row gap-8 wrap mb-8">${Convoy.badge(e)}<span class="badge ${e.tone}">${esc(e.typeLabel)}</span>
          <span class="badge mono">${esc(e.id)}</span></div>
        <h1 class="page-title">${esc(e.name)}</h1>
        <p class="page-sub">${esc(fmt.dt(e.date))} · ${esc(e.server)}</p>
      </div>
      <div class="row gap-8 wrap">
        ${!done ? `<span class="badge brand" style="height:38px;padding:0 14px">${icon('clock')}
          <span data-countdown="${e.date}">—</span></span>` : ''}
        ${convoyActionButton(e, my)}
        ${can('events.manage') && (e.status === 'scheduled') ? `<button class="btn btn-ok"
          data-act="convoy-start" data-id="${e.id}">${icon('play')}Start convoy</button>` : ''}
        ${can('events.manage') && e.status === 'live' ? `<button class="btn btn-primary"
          data-act="convoy-end" data-id="${e.id}">${icon('flag')}End convoy</button>` : ''}
        ${can('events.manage') ? `<button class="btn" data-act="event-edit" data-id="${e.id}">${icon('edit')}Edit</button>` : ''}
        ${can('events.manage') && e.status !== 'completed' && e.status !== 'cancelled'
          ? `<button class="btn btn-ghost" data-act="event-cancel" data-id="${e.id}">${icon('x')}Cancel</button>` : ''}
      </div>
    </div>

    ${convoyLiveHTML(e)}

    <div class="grid g-main">
      <div class="col gap-20" style="min-width:0">
        ${convoyChatHTML(e)}

        <div class="card clip reveal">
          <div class="card-head"><div class="card-title">${icon('map')}Route</div>
            <span class="sm t2">${esc(e.path.join('  →  '))}</span></div>
          ${routeMap(e.path, { overlay, progress: isLive ? 0.42 : null, style: 'height:min(56vh,470px)' })}
        </div>

        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('pin')}Stages &amp; checkpoints</div></div>
          <div class="card-body"><div class="timeline">
            ${e.path.map((c, i) => {
              const first = i === 0, last = i === e.path.length - 1;
              const legKm = i ? Math.round(routeDistance([e.path[i - 1], c])) : 0;
              const cls = isLive ? (i / (e.path.length - 1) < 0.42 ? 'done' : i === 1 ? 'now' : '') : (done ? 'done' : first ? 'now' : '');
              return `<div class="tl-item ${cls}">
                <div class="row-b wrap gap-8">
                  <div><div class="b7">${esc(c)}</div>
                    <div class="xs t3 mt-4">${first ? 'Departure point · ' + esc(e.departPoint)
                      : last ? 'Final destination — offload and photo stop'
                      : 'Checkpoint ' + i + ' · rest stop and regroup'}</div></div>
                  <div class="right"><div class="mono sm b6">${legKm ? fmt.km(legKm) : '—'}</div>
                    <div class="xs t3">${first ? 'Start' : 'Leg ' + i}</div></div>
                </div></div>`;
            }).join('')}
          </div></div></div>

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('book')}Convoy instructions</div>
          <span class="badge warn">${icon('alert')}Required reading</span></div>
          <div class="card-body">
            <p class="t2 mb-16" style="line-height:1.7">${esc(e.description)}</p>
            <ul class="col gap-10">${e.instructions.map((s, i) => `<li class="row gap-10">
              <span class="rank-num" style="flex:none">${i + 1}</span><span class="md t2" style="line-height:1.6">${esc(s)}</span></li>`).join('')}</ul>
          </div></div>

        <div class="card reveal d3"><div class="card-head">
          <div class="card-title">${icon('users')}Registered drivers</div>
          <span class="badge">${e.registered.length}/${e.maxSlots}</span></div>
          <div class="table-wrap"><table class="tbl">
            <thead><tr><th>Driver</th><th>Rank</th><th class="right">Convoys</th><th>Attendance</th><th>Status</th></tr></thead>
            <tbody>${regs.map(({ r, d }) => `<tr class="clickable" data-act="go" data-href="#/driver/${d.id}">
              <td><div class="row gap-10">${avatar(d, 32)}<div><div class="b6">${esc(d.name)}${d.id === e.leaderId ? ' <span class="badge brand xs">Leader</span>' : ''}</div>
                <div class="xs t3 mono">${esc(d.id)}</div></div></div></td>
              <td>${rankChip(d)}</td>
              <td class="right mono">${fmt.n(d.convoys)}</td>
              <td class="mono sm">${d.attendance}%</td>
              <td>${statusBadge(r.state)}</td></tr>`).join('')}</tbody>
          </table></div></div>
      </div>

      <div class="col gap-20" style="min-width:0">
        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('info')}Convoy briefing</div></div>
          <div class="card-body">
            ${kv('Meeting point', esc(e.meetPoint))}
            ${kv('Meet time', esc(fmt.time(e.meetTime)) + ' UTC')}
            ${kv('Departure', esc(e.departPoint))}
            ${kv('Departure time', esc(fmt.time(e.date)) + ' UTC')}
            ${kv('Server', esc(e.server))}
            ${kv('Map / DLC', esc(e.dlc))}
            ${kv('Distance', fmt.km(e.distance))}
            ${kv('Est. duration', fmt.dur(e.duration))}
            ${kv('Convoy speed', '80 km/h motorway · 60 km/h town')}
          </div></div>

        ${convoyStatsHTML(e)}

        ${convoyActivityHTML(e)}

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('flag')}Convoy control</div>
          ${hllEmblem('sm')}</div>
          <div class="card-body">
            ${leader ? `<div class="row gap-12" data-act="go" data-href="#/driver/${leader.id}" style="cursor:pointer">
              ${avatar(leader, 52, true)}<div style="min-width:0">
                <div class="b7 trunc">${esc(leader.name)}</div>
                <div class="xs t3">Convoy leader${
                  Ops.liveFor(e.leaderId) ? ' · <span style="color:var(--ok)">reporting</span>'
                                          : ' · <span class="t3">not reporting</span>'}</div>
                <div class="mt-4">${rankChip(leader)}</div></div></div>` : ''}
            <div class="divider"></div>
            <div class="row gap-8 wrap">
              <span class="badge">${icon('discord')}Voice: HLL Convoy 1</span>
              <span class="badge">${icon('shield')}2 marshals</span>
            </div>
          </div></div>

        <div class="card reveal d3"><div class="card-head"><div class="card-title">${icon('users')}Slots</div></div>
          <div class="card-body">
            <div class="row gap-16">
              ${progressRing(fill, { size: 96, label: 'Filled' })}
              <div class="grow">
                ${kv('Registered', e.registered.length)}
                ${kv('Confirmed', e.registered.filter((r) => ['confirmed', 'completed'].includes(r.state)).length)}
                ${kv('Slots left', Math.max(0, e.maxSlots - e.registered.length))}
              </div>
            </div>
            <div class="mt-16">${avatarStack(regs.map((x) => x.d), 8, 32)}</div>
            <div class="mt-16">${convoyActionButton(e, my, true)}</div>
          </div></div>
      </div>
    </div>
  </div>`;
}

function convoyActionButton(e, my, block = false) {
  const b = block ? 'btn-block' : '';
  if (e.status === 'completed') {
    return my && my.state === 'completed'
      ? `<span class="badge ok" style="height:38px;padding:0 14px">${icon('checkCircle')}You completed this convoy</span>`
      : `<span class="badge" style="height:38px;padding:0 14px">Convoy completed</span>`;
  }
  if (e.status === 'cancelled') return `<span class="badge danger" style="height:38px;padding:0 14px">Convoy cancelled</span>`;
  if (!my) {
    const full = e.registered.length >= e.maxSlots;
    return `<button class="btn btn-primary ${b}" ${full ? 'disabled' : ''} data-act="ev-register" data-id="${e.id}">
      ${icon(full ? 'lock' : 'plus')}${full ? 'Convoy full' : 'Register for convoy'}</button>`;
  }
  if (my.state === 'registered') {
    return `<div class="row gap-8 ${block ? 'col' : ''}">
      <button class="btn btn-ok ${b}" data-act="ev-confirm" data-id="${e.id}">${icon('check')}Confirm attendance</button>
      <button class="btn btn-ghost ${b}" data-act="ev-withdraw" data-id="${e.id}">${icon('x')}Withdraw</button></div>`;
  }
  if (my.state === 'confirmed') {
    return `<div class="row gap-8 ${block ? 'col' : ''}">
      ${e.status === 'live' ? `<button class="btn btn-primary ${b}" data-act="ev-complete" data-id="${e.id}">${icon('flag')}Mark convoy complete</button>`
        : `<span class="badge ok" style="height:38px;padding:0 14px">${icon('checkCircle')}Attendance confirmed</span>`}
      <button class="btn btn-ghost ${b}" data-act="ev-withdraw" data-id="${e.id}">${icon('x')}Withdraw</button></div>`;
  }
  return `<span class="badge ok" style="height:38px;padding:0 14px">${icon('checkCircle')}Convoy complete</span>`;
}

/* ============================================================
   Part 5/6 — events, rankings, achievements, recruitment,
              community, support, notifications, settings
   ============================================================ */

/* ---------------- 21. Events calendar (spec §8) ---------------- */
function viewEvents() {
  const { calMonth, calYear } = state.ui;
  const first = new Date(calYear, calMonth, 1);
  const startDow = (first.getDay() + 6) % 7;           /* Monday-first */
  const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
  const prevDays = new Date(calYear, calMonth, 0).getDate();
  const today = new Date();

  const evByDay = {};
  Store.db.events.forEach((e) => {
    const d = new Date(e.date);
    if (d.getMonth() === calMonth && d.getFullYear() === calYear) {
      (evByDay[d.getDate()] ||= []).push(e);
    }
  });

  const cells = [];
  for (let i = 0; i < startDow; i++) cells.push({ n: prevDays - startDow + i + 1, out: true });
  for (let i = 1; i <= daysInMonth; i++) cells.push({ n: i, out: false });
  while (cells.length % 7) cells.push({ n: cells.length - daysInMonth - startDow + 1, out: true });

  const monthEvents = Store.db.events
    .filter((e) => { const d = new Date(e.date); return d.getMonth() === calMonth && d.getFullYear() === calYear; })
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Company calendar</div>
        <h1 class="page-title">Events</h1>
        <p class="page-sub">Convoys, meetings, training and recruitment sessions across the HLL calendar</p></div>
      ${can('events.manage') ? `<button class="btn btn-primary" data-act="event-create">${icon('plus')}Create event</button>` : ''}
    </div>

    <div class="grid g-cal">
      <div class="card reveal">
        <div class="card-head">
          <div class="row gap-8">
            <button class="icon-btn" data-act="cal-prev" aria-label="Previous month">${icon('arrowLeft')}</button>
            <div class="card-title" style="min-width:180px;justify-content:center">
              ${esc(first.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' }))}</div>
            <button class="icon-btn" data-act="cal-next" aria-label="Next month">${icon('arrowRight')}</button>
          </div>
          <button class="btn btn-sm" data-act="cal-today">Today</button>
        </div>
        <div class="card-body">
          <div class="cal mb-8">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
            .map((d) => `<div class="cal-dow">${d}</div>`).join('')}</div>
          <div class="cal">
            ${cells.map((c) => {
              const isToday = !c.out && c.n === today.getDate() && calMonth === today.getMonth() && calYear === today.getFullYear();
              const evs = c.out ? [] : (evByDay[c.n] || []);
              return `<div class="cal-day ${c.out ? 'out' : ''} ${isToday ? 'today' : ''}"
                ${evs.length ? `data-act="cal-day" data-day="${c.n}"` : ''}>
                <div class="n">${c.n}</div>
                ${evs.slice(0, 3).map((e) => `<div class="cal-ev ${e.tone}" title="${esc(e.name)}">${esc(fmt.time(e.date))} ${esc(e.name)}</div>`).join('')}
                ${evs.length > 3 ? `<div class="xs t3">+${evs.length - 3} more</div>` : ''}
              </div>`;
            }).join('')}
          </div>
          <div class="row gap-14 wrap mt-16 xs t3">
            ${[['', 'Official convoy'], ['info', 'Community / recruitment'], ['violet', 'Meeting'], ['ok', 'Training']]
              .map(([t, l]) => `<span class="row gap-6"><i class="cal-ev ${t}" style="width:12px;height:12px;padding:0;border-radius:3px"></i>${l}</span>`).join('')}
          </div>
        </div>
      </div>

      <div class="col gap-18">
        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('calendar')}This month</div>
          <span class="badge">${monthEvents.length}</span></div>
          <div class="card-body col gap-12" style="max-height:560px;overflow-y:auto">
            ${monthEvents.length ? monthEvents.map((e) => {
              const my = Store.registrationOf(e, state.user.id);
              return `<div class="row gap-12" data-act="go" data-href="#/${e.path.length ? 'convoy' : 'convoy'}/${e.id}" style="cursor:pointer">
                <div class="convoy-date" style="position:static;padding:5px 9px">
                  <div class="d">${new Date(e.date).getDate()}</div>
                  <div class="m">${new Date(e.date).toLocaleDateString('en-GB', { month: 'short' })}</div></div>
                <div class="grow" style="min-width:0">
                  <div class="b6 md trunc">${esc(e.name)}</div>
                  <div class="xs t3 mt-4">${esc(fmt.time(e.date))} · ${esc(e.typeLabel)}</div>
                  ${my ? `<span class="badge ok mt-4">${icon('check')}${my.state === 'completed' ? 'Attended' : 'Registered'}</span>` : ''}
                </div>${icon('chevron', 'chev')}</div>`;
            }).join('') : emptyState('calendar', 'Nothing scheduled', 'No events in this month.')}
          </div></div>

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('bolt')}Your next events</div></div>
          <div class="card-body col gap-12">
            ${Store.upcomingEvents().filter((e) => Store.registrationOf(e, state.user.id)).slice(0, 4)
              .map((e) => `<div class="row-b gap-12" data-act="go" data-href="#/convoy/${e.id}" style="cursor:pointer">
                <div style="min-width:0"><div class="b6 md trunc">${esc(e.name)}</div>
                  <div class="xs t3">${esc(fmt.dayMon(e.date))} · ${esc(fmt.time(e.date))}</div></div>
                <span class="badge brand"><span data-countdown="${e.date}">—</span></span></div>`).join('')
              || emptyState('bolt', 'Nothing booked', 'Register for a convoy to see it here.')}
          </div></div>
      </div>
    </div>
  </div>`;
}

/* ---------------- 22. Rankings (spec §9) ---------------- */
function viewRankings() {
  const { lbMetric, lbPeriod } = state.ui;
  const lb = Store.leaderboard(lbMetric, lbPeriod);
  const top3 = lb.slice(0, 3);
  const myPos = lb.findIndex((r) => r.driver.id === state.user.id) + 1;
  const fmtV = { km: fmt.km, deliveries: fmt.n, convoys: fmt.n, attendance: (v) => fmt.pct(v) }[lbMetric];
  const metricLabel = { km: 'Distance driven', deliveries: 'Deliveries completed', convoys: 'Convoys attended', attendance: 'Attendance rate' }[lbMetric];

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Fleet standings · ${esc(Store.db.meta.season)}</div>
        <h1 class="page-title">Rankings</h1>
        <p class="page-sub">${esc(metricLabel)} · ${{ week: 'this week', month: 'this month', year: 'this year', all: 'all time' }[lbPeriod]}</p></div>
      <div class="row gap-8 wrap">
        <div class="seg">${[['week', 'Weekly'], ['month', 'Monthly'], ['year', 'Yearly'], ['all', 'All-time']]
          .map(([v, l]) => `<button class="${lbPeriod === v ? 'on' : ''}" data-act="lb-period" data-v="${v}">${l}</button>`).join('')}</div>
      </div>
    </div>

    <div class="row gap-8 wrap mb-20">
      ${[['km', 'Distance', 'route'], ['deliveries', 'Deliveries', 'package'], ['convoys', 'Convoys', 'truck'], ['attendance', 'Attendance', 'checkCircle']]
        .map(([v, l, ic]) => `<button class="chip ${lbMetric === v ? 'on' : ''}" data-act="lb-metric" data-v="${v}">
          <span style="width:14px;height:14px">${icon(ic)}</span>${l}</button>`).join('')}
    </div>

    <!-- podium -->
    <div class="grid g-3 mb-20">
      ${[1, 0, 2].map((idx) => {
        const r = top3[idx]; if (!r) return '<div></div>';
        const place = idx + 1;
        const hue = ['#ffd76e', '#e2e8f0', '#e0a06a'][idx];
        return `<div class="card hover card-body center reveal d${place}" data-act="go" data-href="#/driver/${r.driver.id}"
          style="cursor:pointer;${place === 1 ? 'border-color:rgba(255,176,32,.4);background:linear-gradient(180deg,rgba(255,176,32,.09),var(--panel))' : ''}">
          <div class="col center gap-12">
            <div style="position:relative">
              ${avatar(r.driver, 96, true)}
              <span class="podium-medal">${medal(place, 38)}</span>
            </div>
            <div>
              <div class="b8 lg">${esc(r.driver.name)}</div>
              <div class="xs t3 mono">${esc(r.driver.id)}</div>
            </div>
            ${rankChip(r.driver)}
            <div><div class="b8" style="font-size:24px;color:${hue}">${fmtV(r.value)}</div>
              <div class="xs t3 cap b7">${esc(metricLabel)}</div></div>
            <div class="row gap-14 xs t3">
              <span>${fmt.n(r.driver.convoys)} convoys</span><span>${r.driver.attendance}% attendance</span>
            </div>
          </div></div>`;
      }).join('')}
    </div>

    <div class="card clip reveal d4">
      <div class="card-head"><div class="card-title">${icon('trophy')}Full standings</div>
        <span class="badge brand">You are #${myPos}</span></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th style="width:60px">#</th><th>Driver</th><th>Rank</th>
          <th class="right">${esc(metricLabel)}</th><th style="width:180px">Share of leader</th><th>Status</th></tr></thead>
        <tbody>${lb.map((r, i) => {
          const me = r.driver.id === state.user.id;
          const share = lb[0].value ? r.value / lb[0].value * 100 : 0;
          return `<tr class="clickable" data-act="go" data-href="#/driver/${r.driver.id}"
            style="${me ? 'background:var(--panel-2)' : ''}">
            <td>${i < 3 ? medal(i + 1, 26) : `<span class="rank-num">${i + 1}</span>`}</td>
            <td><div class="row gap-10">${avatar(r.driver, 32)}
              <div><div class="b6">${esc(r.driver.name)}${me ? ' <span class="badge brand xs">You</span>' : ''}</div>
              <div class="xs t3 mono">${esc(r.driver.id)}</div></div></div></td>
            <td>${rankChip(r.driver)}</td>
            <td class="right mono b7">${fmtV(r.value)}</td>
            <td>${bar(share, i === 0 ? '' : 'info', 'thin')}</td>
            <td>${statusBadge(r.driver.status)}</td></tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>
  </div>`;
}

/* ---------------- 23. Achievements (spec §10) ---------------- */
function viewAchievements() {
  const u = state.user;
  const f = state.ui.achFilter;
  const earned = ACHIEVEMENTS.filter((a) => achEarned(a, u));
  const list = f === 'earned' ? earned : f === 'locked' ? ACHIEVEMENTS.filter((a) => !achEarned(a, u)) : ACHIEVEMENTS;
  const r = rankOf(u);

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Driver progression</div>
        <h1 class="page-title">Achievements</h1>
        <p class="page-sub">${earned.length} of ${ACHIEVEMENTS.length} unlocked · ${Math.round(earned.length / ACHIEVEMENTS.length * 100)}% complete</p></div>
      <div class="seg">${[['all', 'All'], ['earned', 'Unlocked'], ['locked', 'Locked']]
        .map(([v, l]) => `<button class="${f === v ? 'on' : ''}" data-act="ach-filter" data-v="${v}">${l}</button>`).join('')}</div>
    </div>

    <!-- rank ladder -->
    <div class="card mb-20 reveal">
      <div class="card-head"><div class="card-title">${icon('medal')}The Heavyline rank ladder</div>
        <span class="badge" style="color:${r.color};border-color:${r.color}44;background:${r.color}18">Current: ${esc(r.name)}</span></div>
      <div class="card-body">
        <div class="row gap-4" style="overflow-x:auto;padding-bottom:8px">
          ${RANKS.map((R) => {
            const cur = R.i === r.i, past = R.i < r.i;
            return `<div class="col center gap-8" style="min-width:112px;flex:1;opacity:${past || cur ? 1 : .45}">
              <div style="width:100%;height:4px;border-radius:99px;background:${past || cur ? R.color : 'var(--panel-3)'}"></div>
              <div class="rank-ins" style="width:32px;height:32px;border-radius:10px;background:${past || cur ? R.color : 'var(--panel-3)'};font-size:11px;
                ${cur ? `box-shadow:0 0 0 3px ${R.color}33` : ''}">${R.abbr}</div>
              <div class="center"><div class="xs b7" style="color:${cur ? R.color : 'var(--text-2)'}">${esc(R.name)}</div>
                <div class="t3" style="font-size:9.5px">${R.km ? fmt.kmS(R.km) : 'Entry'}</div></div>
              ${cur ? '<span class="badge brand" style="height:18px;font-size:9px">YOU</span>' : ''}
            </div>`;
          }).join('')}
        </div>
        <div class="divider"></div>
        <div class="grid g-3" style="gap:12px">
          ${RANKS[r.i + 1] ? [['Distance', u.km, RANKS[r.i + 1].km, fmt.km],
             ['Convoys', u.convoys, RANKS[r.i + 1].convoys, fmt.n],
             ['Attendance', u.attendance, RANKS[r.i + 1].att, (v) => fmt.pct(v)]].map(([k, cur, goal, f2]) => {
              const met = cur >= goal;
              return `<div><div class="row-b sm mb-8"><span class="b6">${k}</span>
                <span class="mono ${met ? '' : 't2'}" style="${met ? 'color:var(--ok)' : ''}">${f2(cur)} / ${f2(goal)}</span></div>
                ${bar(clamp(cur / goal * 100, 0, 100), met ? 'ok' : '', 'thin')}</div>`;
            }).join('') : `<div class="span-2 row gap-10"><span style="color:var(--accent);width:20px;height:20px">${icon('star')}</span>
              <span class="t2">You hold HLL Captain — the highest rank Heavyline awards.</span></div>`}
        </div>
      </div>
    </div>

    <div class="grid g-auto" style="grid-template-columns:repeat(auto-fill,minmax(210px,1fr))">
      ${list.map((a, i) => `<div class="reveal d${clamp(i % 8 + 1, 1, 8)}">${achCard(a, u)}</div>`).join('')}
    </div>
  </div>`;
}

/* ---------------- 24. Recruitment (spec §11) ---------------- */
function viewRecruitment() {
  const mine = Store.db.applications
    .filter((a) => a.submittedBy === state.user.id)
    .sort((a, b) => new Date(b.submitted) - new Date(a.submitted))[0];
  const manage = can('recruitment.manage');
  const apps = Store.db.applications.slice().sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
  const stages = ['pending', 'review', 'interview', 'approved', 'rejected'];

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Join the fleet</div>
        <h1 class="page-title">Recruitment</h1>
        <p class="page-sub">Heavyline is recruiting professional drivers for the ${esc(Store.db.meta.season)}</p></div>
      ${manage ? `<button class="btn" data-act="go" data-href="#/admin">${icon('shield')}Recruitment console</button>` : ''}
    </div>

    <div class="grid g-main">
      <div class="col gap-20">
        <div class="card reveal"><div class="card-head"><div class="card-title">${icon('route')}How recruitment works</div></div>
          <div class="card-body">
            <div class="timeline">
              ${[['Application', 'Submit the form with your driving history and Discord details.'],
                 ['Review', 'A recruiter checks your application against the HLL entry standard.'],
                 ['Interview / assessment', 'A short voice chat and a supervised assessment drive.'],
                 ['Approval', 'Successful applicants receive an HLL Driver ID and Discord roles.'],
                 ['Driver onboarding', 'Vehicle assignment, livery, and your first convoy briefing.']]
                .map(([t, s], i) => `<div class="tl-item ${i === 0 ? 'now' : ''}">
                  <div class="b7">${i + 1}. ${esc(t)}</div><div class="sm t2 mt-4">${esc(s)}</div></div>`).join('')}
            </div>
          </div></div>

        ${mine ? applicationTracker(mine) : `
        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('userPlus')}Driver application</div>
          <span class="badge ok">${icon('clock')}Takes a minute</span></div>
          <div class="card-body">${applyFormHTML()}</div></div>`}
      </div>

      <div class="col gap-20">
        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('checkCircle')}Entry requirements</div></div>
          <div class="card-body col gap-10">
            ${[['Minimum age 16', true], ['Working microphone for convoys', true],
               ['Discord account', true], ['TruckersMP account in good standing', true],
               ['At least 50 hours in ETS2 / ATS', true], ['Willing to run HLL livery', true]]
              .map(([t]) => `<div class="row gap-10"><span style="width:16px;height:16px;color:var(--ok)">${icon('checkCircle')}</span>
                <span class="md t2">${esc(t)}</span></div>`).join('')}
          </div></div>

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('chart')}Intake this month</div></div>
          <div class="card-body">
            ${donut(stages.map((s, i) => ({
              label: statusLabel(s), value: Store.db.applications.filter((a) => a.status === s).length,
              color: ['#8b98ab', '#4aa3f0', '#8b7cf0', '#3ecf8e', '#ef5f5f'][i],
            })), { size: 150, centerValue: fmt.n(Store.db.applications.length), centerLabel: 'Applications' })}
          </div></div>

        ${manage ? `<div class="card reveal d3"><div class="card-head"><div class="card-title">${icon('users')}Latest applications</div>
          <span class="badge">${apps.filter((a) => a.status === 'pending').length} new</span></div>
          <div class="card-body col gap-12">
            ${apps.slice(0, 5).map((a) => `<div class="row-b gap-10" data-act="app-open" data-id="${a.id}" style="cursor:pointer">
              <div class="row gap-10" style="min-width:0">
                <span class="avatar a-32" style="background:linear-gradient(135deg,#5b7a99,#37485c)">${esc(initials(a.name))}</span>
                <div style="min-width:0"><div class="b6 md trunc">${esc(a.name)}</div>
                <div class="xs t3">${esc(fmt.rel(a.submitted))}</div></div></div>
              ${statusBadge(a.status)}</div>`).join('')}
          </div></div>` : ''}
      </div>
    </div>
  </div>`;
}

/* Application progress for the signed-in applicant (spec §11: track status). */
const APPLICATION_STAGES = [
  ['pending',   'Application received', 'Your application is queued for a recruiter.'],
  ['review',    'Under review',         'A recruiter is checking your details against the HLL entry standard.'],
  ['interview', 'Interview / assessment','You will be invited to a voice chat and an assessment drive.'],
  ['approved',  'Approved',             'Welcome aboard — your HLL Driver ID has been issued.'],
];
function applicationTracker(a) {
  const rejected = a.status === 'rejected';
  const idx = APPLICATION_STAGES.findIndex((st) => st[0] === a.status);
  return `<div class="card reveal d1">
    <div class="card-head">
      <div class="card-title">${icon('userPlus')}Your application</div>
      ${statusBadge(a.status)}
    </div>
    <div class="card-body">
      <div class="row-b wrap gap-12 mb-16">
        <div><div class="b7">${esc(a.name)}</div>
          <div class="xs t3 mono">${esc(a.id)} · submitted ${esc(fmt.rel(a.submitted))}</div></div>
        <span class="badge">${esc(a.experience)}</span>
      </div>
      ${rejected ? `<div class="row gap-10" style="padding:12px;border-radius:var(--r);border:1px solid rgba(239,95,95,.3)">
          <span style="width:16px;height:16px;color:var(--danger)">${icon('alert')}</span>
          <div class="sm t2">This application was not successful. You are welcome to apply again after 30 days.</div>
        </div>`
        : `<div class="timeline">
          ${APPLICATION_STAGES.map(([key, title, desc], i) => `
            <div class="tl-item ${i < idx ? 'done' : i === idx ? 'now' : ''}">
              <div class="row-b gap-8 wrap">
                <div class="b7 md">${esc(title)}</div>
                ${i === idx ? '<span class="badge brand">Current</span>' : i < idx ? `<span class="t3">${icon('check')}</span>` : ''}
              </div>
              <div class="xs t3 mt-4">${esc(desc)}</div>
            </div>`).join('')}
        </div>`}
      ${!rejected && !a.detailed ? `<div class="row gap-10 mt-16" style="padding:12px;border-radius:var(--r);
          border:1px solid var(--accent-line)">
          <span style="width:16px;height:16px;color:var(--accent);flex:none">${icon('info')}</span>
          <div class="sm t2">Signing up filed this for you with the basics. Filling in the rest —
            your Discord, your TruckersMP ID and your hours — is what a recruiter actually reads.</div>
        </div>` : ''}
      <div class="divider"></div>
      <div class="row-b wrap gap-12">
        <div class="xs t3">${a.discord
          ? `Recruitment also reaches you on Discord as <span class="mono">${esc(a.discord)}</span>.`
          : 'No Discord username on file — recruitment can only reach you here.'}</div>
        ${rejected ? '' : `<div class="row gap-8">
          <button class="btn btn-sm" data-act="app-message" data-id="${esc(a.id)}">${icon('mail')}Message recruitment</button>
          <button class="btn btn-sm btn-primary" data-act="app-edit" data-id="${esc(a.id)}">${icon('edit')}${
            a.detailed ? 'Update my application' : 'Complete my application'}</button>
        </div>`}
      </div>
      ${(a.messages || []).length ? `<div class="divider"></div>
        <div class="col gap-10">${a.messages.map((m) => `<div class="row gap-10">
          <span class="feed-ico">${icon(m.from === 'staff' ? 'shield' : 'user')}</span>
          <div style="min-width:0"><div class="sm t2">${esc(m.text)}</div>
            <div class="xs t3 mt-4">${esc(m.from === 'staff' ? 'Recruitment' : 'You')} · ${esc(fmt.rel(m.at))}</div></div>
        </div>`).join('')}</div>` : ''}
    </div>
  </div>`;
}

function statusLabel(s) {
  return {
    pending: 'Pending', review: 'In review', interview: 'Interview',
    approved: 'Approved', rejected: 'Rejected',
    active: 'Active', suspended: 'Suspended',
    open: 'Open', in_progress: 'In progress', resolved: 'Resolved',
  }[s] || s;
}

function applyFormHTML() {
  const d = state.ui.applyDraft;
  const u = state.user;
  return `<form id="applyForm" novalidate>
    <p class="t2 sm mb-16">Three things and you are done. Everything else — your TruckersMP ID,
      your hours, your Discord — is picked up from your driver record once you are in.</p>

    <div class="grid g-2" style="gap:0 14px">
      <div class="field"><label for="ap-name">Your name *</label>
        <input class="input" id="ap-name" name="name" value="${esc(d.name || u.name || '')}" placeholder="Alex Mercer">
        <span class="err-msg hide" data-err="name"></span></div>
      <div class="field"><label for="ap-email">Email address *</label>
        <input class="input" id="ap-email" name="email" type="email"
          value="${esc(d.email || u.email || '')}" placeholder="you@example.com">
        <span class="err-msg hide" data-err="email"></span></div>
    </div>

    <div class="field"><label for="ap-country">Country *</label>
      <select class="select" id="ap-country" name="country">
        <option value="">Select…</option>
        ${COUNTRIES.map((c) => `<option ${(d.country || u.country) === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}
      </select><span class="err-msg hide" data-err="country"></span></div>

    <div class="field"><label for="ap-discord">Discord username</label>
      <div class="xs t3 mb-8">Not on the server yet? ${discordLink('Join the Heavyline Discord', 'link')}</div>
      <input class="input" id="ap-discord" name="discord" value="${esc(d.discord || u.discord || '')}"
        placeholder="yourname">
      <span class="hint">Optional — it is how recruitment usually reaches you.</span></div>

    <div class="field"><label for="ap-why">Anything you want us to know?</label>
      <textarea class="textarea" id="ap-why" name="why" rows="3"
        placeholder="Optional — a line or two about your driving is plenty.">${esc(d.why || '')}</textarea></div>

    <label class="check ${d.agree ? 'on' : ''}" id="ap-agree-wrap">
      <input type="checkbox" id="ap-agree" name="agree" ${d.agree ? 'checked' : ''}>
      <span class="sm t2">I agree to follow the HLL convoy standards and community rules.</span></label>
    <span class="err-msg hide mt-8" data-err="agree"></span>

    <div class="row-b mt-20 wrap gap-12">
      <span class="xs t3">Recruitment sees it the moment you send it.</span>
      <button type="submit" class="btn btn-primary">${icon('send')}Send my application</button>
    </div>
  </form>`;
}

/* An application filed by signing up carries only what the sign-up asked for.
   This is where the applicant fills in the rest — it edits that application
   rather than filing a second one. */
function openApplicationEditor(id) {
  const a = Store.application(id);
  if (!a || a.submittedBy !== state.user.id) { toast('That is not your application', 'danger'); return; }
  const EXPERIENCE = ['Not stated', 'Under a year', '1-2 years', '3-5 years', '5+ years'];
  openModal({
    title: a.detailed ? 'Update your application' : 'Complete your application',
    sub: a.id, size: 'wide',
    body: `<p class="t2 sm mb-16">A recruiter reads this before they decide. None of it is
        required, but the more you fill in the less they have to ask you for.</p>
      <div class="grid g-2" style="gap:0 14px">
        <div class="field"><label for="ae-discord">Discord username</label>
          <input class="input" id="ae-discord" value="${esc(a.discord || '')}" placeholder="yourname"></div>
        <div class="field"><label for="ae-tmp">TruckersMP ID</label>
          <input class="input" id="ae-tmp" value="${esc(a.truckersmp || '')}" placeholder="1234567"></div>
        <div class="field"><label for="ae-hours">Hours in ETS2 / ATS</label>
          <input class="input" id="ae-hours" type="number" min="0" value="${a.hours || ''}" placeholder="250"></div>
        <div class="field"><label for="ae-exp">Experience</label>
          <select class="select" id="ae-exp">${EXPERIENCE
            .map((e) => `<option ${a.experience === e ? 'selected' : ''}>${esc(e)}</option>`).join('')}</select></div>
      </div>
      <div class="field"><label for="ae-vtc">Previous VTC</label>
        <input class="input" id="ae-vtc" value="${esc(a.previousVtc === 'None' ? '' : a.previousVtc || '')}"
          placeholder="Leave blank if this is your first"></div>
      <div class="field"><label for="ae-why">Anything you want us to know?</label>
        <textarea class="textarea" id="ae-why" rows="4"
          placeholder="A line or two about your driving is plenty.">${esc(a.why === 'No note left.' ? '' : a.why || '')}</textarea></div>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="app-update" data-id="${esc(a.id)}">${icon('check')}Save</button>`,
  });
}

function saveApplicationDetails(id) {
  const a = Store.application(id);
  if (!a || a.submittedBy !== state.user.id) return;
  const g = (k) => ($('#' + k)?.value || '').trim();
  a.discord = g('ae-discord').replace(/^@/, '');
  a.truckersmp = g('ae-tmp');
  a.hours = Math.max(0, +g('ae-hours') || 0);
  a.experience = g('ae-exp') || 'Not stated';
  a.previousVtc = g('ae-vtc') || 'None';
  a.why = g('ae-why') || 'No note left.';
  a.detailed = true;
  a.updated = new Date().toISOString();

  /* the driver record carries the same handles, so keep the two in step */
  if (a.discord) state.user.discord = a.discord;
  if (a.truckersmp) state.user.truckersmp = a.truckersmp;

  notifyStaff('recruitment.manage', {
    type: 'info', icon: 'userPlus',
    title: 'An application was filled in',
    body: a.name + ' has completed their application. It is ready to review.',
    href: '#/admin',
  }, state.user.id);
  Store.save();
  closeModal();
  toast('Application updated', 'ok', 'Recruitment can see it now');
  render();
}

/* A line to recruitment, kept on the application itself so the conversation
   stays with the thing it is about. */
function openApplicationMessage(id) {
  const a = Store.application(id);
  if (!a || a.submittedBy !== state.user.id) { toast('That is not your application', 'danger'); return; }
  openModal({
    title: 'Message recruitment', sub: a.id, size: 'narrow',
    body: `<div class="field"><label for="am-text">Your message</label>
      <textarea class="textarea" id="am-text" rows="4"
        placeholder="Ask a question, or add something you left out."></textarea></div>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="app-message-send" data-id="${esc(a.id)}">${icon('send')}Send</button>`,
  });
}

function sendApplicationMessage(id) {
  const a = Store.application(id);
  if (!a || a.submittedBy !== state.user.id) return;
  const text = ($('#am-text')?.value || '').trim();
  if (!text) { toast('Write something first', 'warn'); return; }
  a.messages = a.messages || [];
  a.messages.push({ from: 'driver', text, at: new Date().toISOString() });
  a.updated = new Date().toISOString();
  notifyStaff('recruitment.manage', {
    type: 'info', icon: 'mail',
    title: 'Message from an applicant',
    body: a.name + ': ' + (text.length > 90 ? text.slice(0, 90) + '…' : text),
    href: '#/admin',
  }, state.user.id);
  Store.save();
  closeModal();
  toast('Sent to recruitment', 'ok');
  render();
}

/* ---------------- 25. Community (spec §12) ---------------- */
function viewCommunity() {
  const anns = Store.db.announcements.slice().sort((a, b) => (b.pinned - a.pinned) || (new Date(b.date) - new Date(a.date)));
  const online = Store.db.drivers.filter((d) => d.status !== 'offline');
  const spotlight = Store.leaderboard('convoys', 'month')[0];

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">One fleet · one community</div>
        <h1 class="page-title">Community</h1>
        <p class="page-sub">Announcements, Discord and everything happening around the fleet</p></div>
      <div class="row gap-8">${discordLink('Join the Discord')}</div>
      <button class="btn btn-primary" data-act="discord-connect">${icon('discord')}Open Discord</button>
    </div>

    <div class="grid g-main">
      <div class="col gap-20">
        ${can('content.manage') ? `<button class="btn btn-block" data-act="ann-create">${icon('plus')}Publish announcement</button>` : ''}
        ${anns.length ? '' : `<div class="card"><div class="card-body">
          ${emptyState('megaphone', 'No announcements yet',
            can('content.manage')
              ? 'Publish the first one and it appears here and on every driver dashboard.'
              : 'Company news, convoy notices and standards updates will appear here.')}
        </div></div>`}
        ${anns.map((a, i) => {
          const author = Store.driver(a.author);
          return `<div class="card reveal d${clamp(i + 1, 1, 8)}">
            <div class="card-body">
              <div class="row-b wrap gap-12 mb-12">
                <div class="row gap-8">
                  ${a.pinned ? `<span class="badge brand">${icon('pin')}Pinned</span>` : ''}
                  <span class="badge">${esc(a.tag)}</span>
                </div>
                <span class="xs t3">${esc(fmt.rel(a.date))}</span>
              </div>
              <h2 class="b8" style="font-size:19px;letter-spacing:-.01em">${esc(a.title)}</h2>
              <p class="t2 mt-12" style="line-height:1.75">${esc(a.body)}</p>
              <div class="divider"></div>
              <div class="row-b">
                <div class="row gap-8">${author ? avatar(author, 32) : ''}
                  <div><div class="sm b6">${esc(author ? author.name : 'HLL Management')}</div>
                  <div class="xs t3">${esc(fmt.date(a.date))}</div></div></div>
                ${can('content.manage') ? `<div class="row gap-6">
                  <button class="btn btn-sm btn-ghost" data-act="ann-edit" data-id="${a.id}">${icon('edit')}Edit</button>
                  <button class="btn btn-sm btn-danger" data-act="ann-delete" data-id="${a.id}">${icon('trash')}</button></div>` : ''}
              </div>
            </div></div>`;
        }).join('')}
      </div>

      <div class="col gap-20">
        <div class="card reveal d1" style="border-color:rgba(88,101,242,.3);background:linear-gradient(160deg,rgba(88,101,242,.12),var(--panel) 60%)">
          <div class="card-body center">
            <span class="stat-ico" style="margin:0 auto;width:52px;height:52px;color:#8b93f8;border-color:rgba(139,147,248,.3)">${icon('discord')}</span>
            <div class="b8 lg mt-12">Heavyline Discord</div>
            <p class="sm t2 mt-8">Convoy voice channels, announcements, driver chat and support — all in one server.</p>
            <div class="row gap-16 mt-16" style="justify-content:center">
              <div><div class="b8 lg">${online.length}</div><div class="xs t3 cap b7">Online</div></div>
              <div><div class="b8 lg">${Store.db.drivers.length}</div><div class="xs t3 cap b7">Members</div></div>
            </div>
            <button class="btn btn-primary btn-block mt-16" data-act="discord-connect">${icon('link')}Connect account</button>
            <div class="xs t3 mt-8">Role sync · driver verification · event alerts</div>
          </div></div>

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('link')}Follow Heavyline</div></div>
          <div class="card-body">
            <p class="sm t2">Build notes, convoy footage and everything else the fleet posts.</p>
            ${socialHTML('mt-16')}
          </div></div>

        <div class="card reveal d3"><div class="card-head"><div class="card-title">${icon('star')}Driver spotlight</div></div>
          ${spotlight ? `<div class="card-body center">
            ${`<div style="display:flex;justify-content:center">${avatar(spotlight.driver, 96, true)}</div>`}
            <div class="b8 lg mt-12">${esc(spotlight.driver.name)}</div>
            <div class="mt-8" style="display:flex;justify-content:center">${rankChip(spotlight.driver)}</div>
            <p class="sm t2 mt-12">Most convoys attended this month — ${fmt.n(spotlight.value)} runs and counting.</p>
            <button class="btn btn-block mt-12" data-act="go" data-href="#/driver/${spotlight.driver.id}">${icon('user')}View profile</button>
          </div>` : ''}</div>

        <div class="card reveal d4"><div class="card-head"><div class="card-title">${icon('users')}Online now</div>
          <span class="badge ok"><span class="live-dot"></span>${online.length}</span></div>
          <div class="card-body col gap-10" style="max-height:320px;overflow-y:auto">
            ${online.slice(0, 12).map((d) => `<div class="row gap-10" data-act="go" data-href="#/driver/${d.id}" style="cursor:pointer">
              ${avatar(d, 32)}<div class="grow" style="min-width:0"><div class="sm b6 trunc">${esc(d.name)}</div>
              <div class="xs t3">${d.status === 'driving' ? 'On the road' : 'Online'}</div></div>
              ${statusBadge(d.status)}</div>`).join('')}
          </div></div>

        <div class="card reveal d5"><div class="card-head"><div class="card-title">${icon('link')}Quick links</div></div>
          <div class="card-body col gap-8">
            ${[['Convoy schedule', 'calendar', '#/events'], ['Fleet register', 'truck', '#/fleet'],
               ['Driver rankings', 'trophy', '#/rankings'], ['Apply to drive', 'userPlus', '#/recruitment'],
               ['Driver support', 'lifeBuoy', '#/support']]
              .map(([t, ic, href]) => `<button class="btn btn-block" style="justify-content:flex-start" data-act="go" data-href="${href}">
                ${icon(ic)}${t}</button>`).join('')}
          </div></div>
      </div>
    </div>
  </div>`;
}

/* ---------------- 26. Support (spec §14) ---------------- */
function viewSupport() {
  const staff = can('admin.view');
  const f = state.ui.supportFilter;
  let list = Store.db.tickets.slice().sort((a, b) => new Date(b.updated) - new Date(a.updated));
  if (!staff) list = list.filter((t) => t.driverId === state.user.id);
  if (f !== 'all') list = list.filter((t) => t.status === f);

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Driver support</div>
        <h1 class="page-title">Support</h1>
        <p class="page-sub">${staff ? 'All driver requests across the company' : 'Your requests to HLL management'}</p></div>
      <button class="btn btn-primary" data-act="ticket-new">${icon('plus')}New request</button>
    </div>

    <div class="grid g-4 mb-20 reveal">
      ${statTile({ label: 'Open', value: fmt.n(list.filter((t) => t.status === 'open').length), raw: list.filter((t) => t.status === 'open').length, icon: 'ticket', tone: 'info' })}
      ${statTile({ label: 'In progress', value: fmt.n(list.filter((t) => t.status === 'in_progress').length), raw: list.filter((t) => t.status === 'in_progress').length, icon: 'refresh', tone: 'warn' })}
      ${statTile({ label: 'Resolved', value: fmt.n(list.filter((t) => t.status === 'resolved').length), raw: list.filter((t) => t.status === 'resolved').length, icon: 'checkCircle', tone: 'ok' })}
      ${statTile({ label: 'Avg. first reply', value: '3.4 h', icon: 'clock', tone: 'violet' })}
    </div>

    <div class="card mb-20"><div class="card-body row gap-8 wrap">
      ${[['all', 'All'], ['open', 'Open'], ['in_progress', 'In progress'], ['resolved', 'Resolved']]
        .map(([v, l]) => `<button class="chip ${f === v ? 'on' : ''}" data-act="support-filter" data-v="${v}">${l}</button>`).join('')}
    </div></div>

    ${list.length ? `<div class="card clip"><div class="table-wrap"><table class="tbl">
      <thead><tr><th>Ref</th><th>Subject</th><th>Category</th>${staff ? '<th>Driver</th>' : ''}
        <th>Priority</th><th>Status</th><th>Updated</th></tr></thead>
      <tbody>${list.map((t) => {
        const d = Store.driver(t.driverId);
        return `<tr class="clickable" data-act="go" data-href="#/ticket/${t.id}">
          <td class="mono sm">${esc(t.id)}</td>
          <td class="b6">${esc(t.subject)}</td>
          <td class="sm t2">${esc(t.category)}</td>
          ${staff ? `<td>${d ? `<div class="row gap-8">${avatar(d, 24)}<span class="sm">${esc(d.name)}</span></div>` : '—'}</td>` : ''}
          <td>${statusBadge(t.priority)}</td>
          <td>${statusBadge(t.status)}</td>
          <td class="sm t3 nowrap">${esc(fmt.rel(t.updated))}</td></tr>`;
      }).join('')}</tbody></table></div></div>`
      : `<div class="card">${emptyState('lifeBuoy', 'No support requests', 'Raise a request and HLL management will pick it up.',
          `<button class="btn btn-primary mt-8" data-act="ticket-new">${icon('plus')}New request</button>`)}</div>`}
  </div>`;
}

function viewTicket(id) {
  const t = Store.ticket(id);
  if (!t) return notFound('Ticket not found', 'That support reference does not exist.', '#/support');
  const d = Store.driver(t.driverId);
  const staff = can('admin.view');

  return `
  <div class="page">
    ${crumbs([{ label: 'Support', href: '#/support' }, { label: t.id }])}
    <div class="page-head">
      <div><div class="row gap-8 mb-8">${statusBadge(t.status)}${statusBadge(t.priority)}<span class="badge mono">${esc(t.id)}</span></div>
        <h1 class="page-title">${esc(t.subject)}</h1>
        <p class="page-sub">${esc(t.category)} · opened ${esc(fmt.rel(t.created))}</p></div>
      ${staff ? `<div class="row gap-8">
        <button class="btn btn-ok" data-act="ticket-resolve" data-id="${t.id}">${icon('check')}Mark resolved</button>
        <button class="btn" data-act="ticket-progress" data-id="${t.id}">${icon('refresh')}In progress</button></div>` : ''}
    </div>

    <div class="grid g-main">
      <div class="card reveal"><div class="card-head"><div class="card-title">${icon('ticket')}Conversation</div></div>
        <div class="card-body col gap-16">
          ${t.messages.map((m) => {
            const from = m.from === 'staff' ? null : Store.driver(m.from);
            const isStaff = m.from === 'staff';
            return `<div class="row-t gap-12" style="${isStaff ? 'flex-direction:row-reverse' : ''}">
              ${isStaff ? `<span class="avatar a-40" style="background:var(--accent)">HL</span>` : (from ? avatar(from, 40) : '')}
              <div class="grow" style="max-width:78%">
                <div class="row gap-8 mb-4 ${isStaff ? 'right' : ''}" style="${isStaff ? 'justify-content:flex-end' : ''}">
                  <span class="sm b6">${esc(isStaff ? 'HLL Support' : (from ? from.name : 'Driver'))}</span>
                  <span class="xs t3">${esc(fmt.rel(m.at))}</span></div>
                <div style="padding:12px 14px;border-radius:14px;line-height:1.65;
                  background:${isStaff ? 'var(--accent-soft)' : 'var(--panel-2)'};
                  border:1px solid ${isStaff ? 'var(--accent-line)' : 'var(--line)'}">${esc(m.body)}</div>
              </div></div>`;
          }).join('')}
          <div class="divider"></div>
          <form id="ticketReply">
            <div class="field"><label for="tk-msg">Add a reply</label>
              <textarea class="textarea" id="tk-msg" placeholder="Type your message…"></textarea></div>
            <div class="row-b"><span class="xs t3">Replies notify ${staff ? 'the driver' : 'HLL management'}.</span>
              <button class="btn btn-primary" type="submit">${icon('send')}Send reply</button></div>
          </form>
        </div></div>

      <div class="col gap-20">
        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('info')}Request details</div></div>
          <div class="card-body">
            ${kv('Reference', `<span class="mono">${esc(t.id)}</span>`)}
            ${kv('Category', esc(t.category))}
            ${kv('Priority', statusBadge(t.priority))}
            ${kv('Status', statusBadge(t.status))}
            ${kv('Opened', esc(fmt.date(t.created)))}
            ${kv('Last update', esc(fmt.rel(t.updated)))}
          </div></div>
        ${d ? `<div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('user')}Raised by</div></div>
          <div class="card-body"><div class="row gap-12" data-act="go" data-href="#/driver/${d.id}" style="cursor:pointer">
            ${avatar(d, 52, true)}<div><div class="b7">${esc(d.name)}</div><div class="xs t3 mono">${esc(d.id)}</div>
            <div class="mt-4">${rankChip(d)}</div></div></div></div></div>` : ''}
      </div>
    </div>
  </div>`;
}

/* ---------------- 27. Notifications (spec §13) ---------------- */
function viewNotifications() {
  const list = Store.notificationsFor(state.user.id);
  const unread = list.filter((n) => !n.read).length;
  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Notification centre</div>
        <h1 class="page-title">Notifications</h1>
        <p class="page-sub">${unread ? unread + ' unread' : 'You are all caught up'}</p></div>
      ${unread ? `<button class="btn" data-act="notif-read-all">${icon('check')}Mark all as read</button>` : ''}
    </div>
    <div class="card"><div class="card-body" style="padding:8px">
      ${list.length ? list.map((n) => `
        <div class="notif ${n.read ? '' : 'unread'}" data-act="notif-open" data-id="${n.id}">
          <span class="notif-ico" style="color:${{ ok: 'var(--ok)', warn: 'var(--warn)', danger: 'var(--danger)' }[n.type] || 'var(--accent)'}">${icon(n.icon)}</span>
          <div class="grow" style="min-width:0;padding-right:16px">
            <div class="b6">${esc(n.title)}</div>
            ${n.body ? `<div class="sm t2 mt-4">${esc(n.body)}</div>` : ''}
            <div class="xs t3 mt-4">${esc(fmt.dt(n.at))}</div>
          </div></div>`).join('')
        : emptyState('bell', 'Nothing here yet', 'Convoy reminders, promotions and announcements will appear here.')}
    </div></div>
  </div>`;
}

function notifDrawer() {
  const list = Store.notificationsFor(state.user.id).slice(0, 14);
  openDrawer('Notifications', `
    <div class="row-b" style="padding:8px 6px 12px">
      <span class="sm t3">${Store.unreadCount(state.user.id)} unread</span>
      <button class="btn btn-sm" data-act="notif-read-all">${icon('check')}Mark all read</button></div>
    ${list.length ? list.map((n) => `
      <div class="notif ${n.read ? '' : 'unread'}" data-act="notif-open" data-id="${n.id}">
        <span class="notif-ico" style="color:var(--accent)">${icon(n.icon)}</span>
        <div class="grow" style="min-width:0;padding-right:14px">
          <div class="md b6">${esc(n.title)}</div>
          ${n.body ? `<div class="xs t3">${esc(n.body)}</div>` : ''}
          <div class="xs t3 mt-4">${esc(fmt.rel(n.at))}</div></div></div>`).join('')
      : emptyState('bell', 'All clear', 'No notifications right now.')}
    <button class="btn btn-block mt-16" data-act="go" data-href="#/notifications">${icon('bell')}Open notification centre</button>`);
}

/* ---------------- 28. Settings (spec §4 / §17) ---------------- */
function viewSettings() {
  const u = state.user;
  const prefs = u.prefs || (u.prefs = { convoyReminders: true, announcements: true, emailDigest: false, publicProfile: true, discordSync: true });
  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Account</div><h1 class="page-title">Settings</h1>
        <p class="page-sub">Manage your driver profile, notifications and account security</p></div>
    </div>

    <div class="grid g-main">
      <div class="col gap-20">
        <div class="card reveal"><div class="card-head"><div class="card-title">${icon('user')}Driver profile</div></div>
          <div class="card-body">
            <div class="row gap-16 mb-20 wrap">
              ${avatar(u, 96, true)}
              <div class="grow">
                <div class="b7 lg">${esc(u.name)}</div>
                <div class="sm t3 mono">${esc(u.id)}</div>
                <div class="row gap-8 mt-8">
                  ${rankChip(u)}
                  <span class="xs t3">Your initials are used across Heavyline</span></div>
              </div>
            </div>
            <form id="profileForm">
              <div class="grid g-2" style="gap:0 14px">
                <div class="field"><label for="st-name">Display name</label>
                  <input class="input" id="st-name" name="name" value="${esc(u.name)}"></div>
                <div class="field"><label for="st-country">Country</label>
                  <select class="select" id="st-country" name="country">
                    <option value="" ${u.country ? '' : 'selected'}>Select…</option>
                    ${COUNTRIES.map((c) => `<option ${u.country === c ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
                <div class="field"><label for="st-discord">Discord username</label>
                  <input class="input" id="st-discord" name="discord" value="${esc(u.discord)}"></div>
                <div class="field"><label for="st-tmp">TruckersMP ID</label>
                  <input class="input" id="st-tmp" name="truckersmp" value="${esc(u.truckersmp)}"></div>
              </div>
              <div class="field"><label for="st-bio">Driver bio</label>
                <textarea class="textarea" id="st-bio" name="bio" placeholder="Tell the fleet about yourself…">${esc(u.bio || '')}</textarea></div>
              <div class="row gap-8"><button class="btn btn-primary" type="submit">${icon('check')}Save changes</button>
                <button class="btn btn-ghost" type="reset">Reset</button></div>
            </form>
          </div></div>

        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('bell')}Notifications</div></div>
          <div class="card-body col gap-4">
            ${[['convoyReminders', 'Convoy reminders', 'Get a reminder 24 hours and 1 hour before a convoy you are registered for.'],
               ['announcements', 'Company announcements', 'Be notified when management publishes an announcement.'],
               ['emailDigest', 'Weekly email digest', 'A summary of your stats, upcoming convoys and fleet news.'],
               ['discordSync', 'Discord role sync', 'Keep your Discord roles in step with your HLL rank.'],
               ['publicProfile', 'Public driver profile', 'Allow other drivers to view your full statistics.']]
              .map(([k, t, s]) => `<div class="row-b gap-16" style="padding:11px 0;border-bottom:1px solid var(--line)">
                <div><div class="b6 md">${esc(t)}</div><div class="xs t3 mt-4">${esc(s)}</div></div>
                <button class="switch ${prefs[k] ? 'on' : ''}" data-act="pref-toggle" data-k="${k}" role="switch"
                  aria-checked="${!!prefs[k]}" aria-label="${esc(t)}"></button></div>`).join('')}
          </div></div>

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('lock')}Security</div></div>
          <div class="card-body">
            <div class="grid g-2" style="gap:0 14px">
              <div class="field"><label for="sec-cur">Current password</label>
                <input class="input" id="sec-cur" type="password" placeholder="••••••••"></div>
              <div class="field"><label for="sec-new">New password</label>
                <input class="input" id="sec-new" type="password" placeholder="At least 8 characters"></div>
              <div class="field"><label for="sec-new2">Confirm new password</label>
                <input class="input" id="sec-new2" type="password" placeholder="••••••••"></div>
            </div>
            <button class="btn" data-act="password-change">${icon('key')}Update password</button>
            <div class="divider"></div>
            <div class="row-b gap-16 wrap">
              <div><div class="b6 md">Where you are signed in</div>
                <div class="xs t3 mt-4">Heavyline keeps your session in this browser only. Signing
                  out here does not affect any other machine you have used.</div></div>
              <button class="btn btn-sm" data-act="logout">${icon('logout')}Sign out</button></div>
          </div></div>
      </div>

      <div class="col gap-20">
        <div class="card reveal d1"><div class="card-head"><div class="card-title">${icon('shield')}Account</div></div>
          <div class="card-body">
            ${kv('HLL Driver ID', `<span class="mono">${esc(u.id)}</span>`)}
            ${kv('Rank', `<span style="color:${rankOf(u).color}">${esc(rankOf(u).name)}</span>`)}
            ${kv('Role', esc(ROLES[u.role].name))}
            ${kv('Member since', esc(fmt.date(u.joined)))}
            ${kv('Account status', statusBadge(u.accountStatus))}
          </div></div>

        <div class="card reveal d2"><div class="card-head"><div class="card-title">${icon('link')}Connections</div></div>
          <div class="card-body col gap-10">
            ${CONNECTIONS.map((c) => { const val = (u[c.key] || '').trim(); return `<div class="row-b" style="padding:8px 0">
                <div class="row gap-10"><span class="feed-ico">${icon(c.icon)}</span>
                  <div><div class="sm b6">${c.name}</div>
                    <div class="xs t3 mono">${val ? esc(c.at + val) : 'Not linked'}</div></div></div>
                <div class="row gap-8">
                  ${val ? `<button class="btn btn-sm btn-ghost" data-act="conn-clear" data-id="${c.key}">Remove</button>` : ''}
                  <button class="btn btn-sm" data-act="conn-edit" data-id="${c.key}">${val ? 'Change' : 'Add'}</button>
                </div>
              </div>`; }).join('')}
          </div></div>

        <div class="card reveal d3" style="border-color:rgba(239,95,95,.28)">
          <div class="card-head"><div class="card-title" style="color:var(--danger)">${icon('alert')}Data &amp; danger zone</div></div>
          <div class="card-body col gap-10">
            <button class="btn btn-block" data-act="export-data">${icon('download')}Export my driver data</button>
            <button class="btn btn-block btn-danger" data-act="request-deletion">${icon('trash')}Request account deletion</button>
            ${can('roles.manage') ? `<button class="btn btn-block btn-danger" data-act="reset-demo">${icon('refresh')}Erase the whole company</button>
            <div class="xs t3">Erasing removes every driver, vehicle, convoy and login held in this browser,
              including yours, and returns the platform to first-run setup. There is no undo.</div>`
              : '<div class="xs t3">Only the company owner can erase Heavyline data.</div>'}
          </div></div>
      </div>
    </div>
  </div>`;
}

/* ============================================================
   Part 6/6 — admin console, interactions, render loop, boot
   ============================================================ */

/* ---------------- 29. Admin console (spec §15 & §16) ---------------- */
function viewAdmin() {
  if (!can('admin.view')) return notFound('Access denied', 'Your role does not have access to the admin console.', '#/dashboard');
  const tab = state.ui.adminTab;
  const tabs = [
    ['overview', 'Overview', 'chart', 'analytics.view'],
    ['drivers', 'Drivers', 'users', 'admin.view'],
    ['recruitment', 'Recruitment', 'userPlus', 'recruitment.manage'],
    ['fleet', 'Fleet', 'truck', 'fleet.manage'],
    ['dispatch', 'Dispatch', 'route', 'events.manage'],
    ['events', 'Events', 'calendar', 'events.manage'],
    ['content', 'Content', 'megaphone', 'content.manage'],
  ].filter(([, , , p]) => can(p));

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Management</div>
        <h1 class="page-title">HLL Admin Console</h1>
        <p class="page-sub">Signed in as ${esc(ROLES[state.user.role].name)} · ${esc(state.user.id)}</p></div>
      <div class="row gap-8">
        <button class="btn" data-act="export-data">${icon('download')}Export data</button>
        ${can('events.manage') ? `<button class="btn" data-act="dispatch-new">${icon('route')}Dispatch a load</button>` : ''}
        <button class="btn btn-primary" data-act="admin-add-driver">${icon('userPlus')}Add driver</button>
      </div>
    </div>

    ${adminInboxHTML()}
    ${serviceWarningHTML()}

    <div class="card">
      <div class="tabs" style="padding:0 8px">
        ${tabs.map(([k, l, ic]) => `<button class="${tab === k ? 'on' : ''}" data-act="admin-tab" data-tab="${k}">
          <span class="row gap-8"><span style="width:15px;height:15px;display:inline-block">${icon(ic)}</span>${l}</span></button>`).join('')}
      </div>
      <div class="card-body">${adminPanel(tab)}</div>
    </div>
  </div>`;
}

/* What is sitting on the console waiting to be dealt with. Counted off the
   records rather than off notifications, so it is right even when a message
   was never raised, was cleared, or was written in another browser. */
function adminInboxHTML() {
  const db = Store.db;
  const apps = db.applications.filter((a) => a.status === 'pending' || a.status === 'review');
  const unfilled = apps.filter((a) => !a.detailed).length;
  const tickets = db.tickets.filter((t) => t.status !== 'resolved');
  const unread = db.applications.filter((a) => (a.messages || [])
    .some((m) => m.from === 'driver'))
    .filter((a) => a.status !== 'approved' && a.status !== 'rejected').length;

  /* Name them. "2 drivers have applied" tells you less than knowing it is
     Joined Driver and one other, and the name is what you act on. */
  const names = apps.slice(0, 3).map((a) => a.name);
  const rest = apps.length - names.length;
  const who = names.join(', ') + (rest > 0 ? ' and ' + rest + ' more' : '');

  const rows = [
    apps.length && { icon: 'userPlus', tone: 'brand',
      title: apps.length === 1 ? esc(apps[0].name) + ' has applied to drive'
        : apps.length + ' drivers have applied',
      body: (apps.length === 1 ? '' : esc(who) + '. ')
        + (unfilled ? (apps.length === 1 ? 'Their application is not filled in yet.'
            : unfilled + ' of them have not filled their application in yet.')
          : (apps.length === 1 ? 'Their application is filled in and ready to review.'
            : 'All of them are filled in and ready to review.')),
      cta: 'Review', act: 'admin-tab', data: 'data-tab="recruitment"' },
    unread && { icon: 'mail', tone: 'info',
      title: unread === 1 ? 'An applicant has written to you' : unread + ' applicants have written to you',
      body: 'Open their application to read it and reply.',
      cta: 'Read', act: 'admin-tab', data: 'data-tab="recruitment"' },
    tickets.length && { icon: 'lifeBuoy', tone: 'warn',
      title: tickets.length + (tickets.length === 1 ? ' support request is open' : ' support requests are open'),
      body: 'Drivers are waiting on an answer.',
      cta: 'Open support', act: 'go', data: 'data-href="#/support"' },
  ].filter(Boolean);

  if (!rows.length) {
    return `<section class="card mb-16 reveal">
      <div class="card-body row gap-12">
        <span class="stat-ico" style="color:var(--ok);flex:none">${icon('checkCircle')}</span>
        <div><div class="b7">Nothing is waiting on you</div>
          <div class="sm t2 mt-4">No open applications, messages or support requests.
            New ones appear here the moment they arrive.</div></div>
      </div>
    </section>`;
  }

  return `<section class="card mb-16 reveal inbox">
    <div class="card-head">
      <div class="card-title">${icon('bell')}Waiting on you</div>
      <span class="badge brand">${rows.length}</span>
    </div>
    <div class="card-body col gap-10">
      ${rows.map((r) => `<div class="inbox-row row-b wrap gap-12">
        <div class="row gap-12" style="min-width:0">
          <span class="stat-ico ${r.tone}" style="flex:none">${icon(r.icon)}</span>
          <div style="min-width:0">
            <div class="b7">${r.title}</div>
            <div class="xs t3 mt-4">${r.body}</div>
          </div>
        </div>
        <button class="btn btn-sm btn-primary" data-act="${r.act}" ${r.data}>${esc(r.cta)}</button>
      </div>`).join('')}
    </div>
  </section>`;
}

function adminPanel(tab) {
  const db = Store.db;
  if (tab === 'overview') return adminOverview();

  if (tab === 'dispatch') {
    const list = (db.assignments || []).slice()
      .sort((a, b) => new Date(b.at) - new Date(a.at));
    const open = openLoads().length;
    return `
      <div class="row-b mb-16 wrap gap-12">
        <div><div class="b7 lg">Dispatch</div>
          <div class="xs t3 mt-4">Loads given to drivers, and where each one stands</div></div>
        <div class="row gap-8">
          <span class="badge">${open} open</span>
          <button class="btn btn-sm btn-primary" data-act="dispatch-new">${icon('route')}Dispatch a load</button>
        </div></div>
      ${list.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Load</th><th>Driver</th><th>Run</th><th>Cargo</th>
          <th class="right">Distance</th><th class="right">Payout</th><th>Due</th><th>State</th><th></th></tr></thead>
        <tbody>${list.map((a) => {
          const d = Store.driver(a.driverId);
          const tone = { assigned: '', accepted: 'info', done: 'ok', cancelled: 'err' }[a.status] || '';
          return `<tr>
            <td class="mono t3">${esc(a.id)}</td>
            <td>${d ? `<div class="row gap-8">${avatar(d, 26)}<span class="b6">${esc(d.name)}</span></div>`
                    : '<span class="t3">unknown driver</span>'}</td>
            <td>${esc(a.from)} <span class="t3">→</span> ${esc(a.to)}</td>
            <td class="t2">${esc(a.cargo)}</td>
            <td class="right mono">${fmt.km(a.km)}</td>
            <td class="right mono">${a.payout ? fmt.eur(a.payout) : '<span class="t3">—</span>'}</td>
            <td class="t2">${a.due ? esc(fmt.date(a.due)) : '<span class="t3">—</span>'}</td>
            <td><span class="pill ${tone}">${esc(ASSIGNMENT_STATES[a.status] || a.status)}</span></td>
            <td class="right">${isOpenLoad(a)
              ? `<button class="btn btn-sm btn-danger" data-act="assignment-state"
                   data-id="${esc(a.id)}" data-v="cancelled">Cancel</button>` : ''}</td>
          </tr>`;
        }).join('')}</tbody></table></div>`
      : emptyState('route', 'Nothing dispatched yet',
          'Give a driver a load and it appears here until the run is done.')}`;
  }

  if (tab === 'drivers') {
    const list = db.drivers.slice().sort((a, b) => b.km - a.km);
    return `
      <div class="row-b mb-16 wrap gap-12">
        <div class="b7 lg">Driver management</div>
        <span class="badge">${list.length} drivers</span></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Driver</th><th>Rank</th><th>Role</th><th class="right">Distance</th>
          <th class="right">Convoys</th><th>Account</th><th class="right">Actions</th></tr></thead>
        <tbody>${list.map((d) => `<tr>
          <td><div class="row gap-10">${avatar(d, 32)}<div><div class="b6">${esc(d.name)}</div>
            <div class="xs t3 mono">${esc(d.id)}</div></div></div></td>
          <td>${rankChip(d)}</td>
          <td>${roleBadge(d.role) || '<span class="sm t3">Driver</span>'}</td>
          <td class="right mono">${fmt.n(d.km)}</td>
          <td class="right mono">${fmt.n(d.convoys)}</td>
          <td>${statusBadge(d.accountStatus)}</td>
          <td class="right"><div class="row gap-6" style="justify-content:flex-end">
            <button class="btn btn-sm btn-ghost tip" data-tip="View" data-act="go" data-href="#/driver/${d.id}">${icon('eye')}</button>
            <button class="btn btn-sm btn-ghost tip" data-tip="Manage" data-act="admin-edit-driver" data-id="${d.id}">${icon('edit')}</button>
            ${can('drivers.manage') ? `<button class="btn btn-sm ${d.accountStatus === 'suspended' ? 'btn-ok' : 'btn-danger'} tip"
              data-tip="${d.accountStatus === 'suspended' ? 'Reinstate' : 'Suspend'}" data-act="admin-suspend" data-id="${d.id}">
              ${icon(d.accountStatus === 'suspended' ? 'check' : 'lock')}</button>` : ''}
          </div></td></tr>`).join('')}</tbody>
      </table></div>`;
  }

  if (tab === 'recruitment') {
    const stages = ['pending', 'review', 'interview', 'approved', 'rejected'];
    const apps = db.applications.slice().sort((a, b) => new Date(b.submitted) - new Date(a.submitted));
    return `
      <div class="grid g-5 mb-20" style="gap:12px">
        ${stages.map((s, i) => `<div class="stat">
          <div class="stat-val" style="font-size:23px">${apps.filter((a) => a.status === s).length}</div>
          <div class="stat-lbl">${esc(statusLabel(s))}</div></div>`).join('')}
      </div>
      ${apps.length ? '' : `<div class="empty">${icon('userPlus')}
        <div><div class="b7">No applications yet</div>
          <div class="sm t2 mt-6">Anyone who creates an account on the drivers' website files one
            at the same time, and it appears here straight away.</div></div></div>`}
      ${apps.length ? `<div class="table-wrap"><table class="tbl">
        <thead><tr><th>Applicant</th><th>Country</th><th>Experience</th><th class="right">Hours</th>
          <th>Submitted</th><th>Status</th><th class="right">Actions</th></tr></thead>
        <tbody>${apps.map((a) => `<tr>
          <td><div class="row gap-10">
            <span class="avatar a-32" style="background:linear-gradient(135deg,#5b7a99,#37485c)">${esc(initials(a.name))}</span>
            <div><div class="b6">${esc(a.name)}</div>
              <div class="xs t3 mono">${esc(a.id)}${a.age ? ' · age ' + a.age : ''}</div></div></div></td>
          <td class="sm t2">${esc(a.country)}</td>
          <td class="sm t2">${esc(a.experience || 'Not stated')}</td>
          <td class="right mono">${a.hours ? fmt.n(a.hours) : '<span class="t3">—</span>'}</td>
          <td class="sm t3 nowrap">${esc(fmt.rel(a.submitted))}</td>
          <td>${statusBadge(a.status)}</td>
          <td class="right"><div class="row gap-6" style="justify-content:flex-end">
            <button class="btn btn-sm btn-ghost" data-act="app-open" data-id="${a.id}">${icon('eye')}Review</button>
            ${['approved', 'rejected'].includes(a.status) ? '' : `
              <button class="btn btn-sm btn-ok tip" data-tip="Approve" data-act="app-approve" data-id="${a.id}">${icon('check')}</button>
              <button class="btn btn-sm btn-danger tip" data-tip="Reject" data-act="app-reject" data-id="${a.id}">${icon('x')}</button>`}
          </div></td></tr>`).join('')}</tbody>
      </table></div>` : ''}`;
  }

  if (tab === 'fleet') {
    return `
      <div class="row-b mb-16 wrap gap-12"><div class="b7 lg">Fleet register</div>
        <button class="btn btn-sm btn-primary" data-act="fleet-add">${icon('plus')}Add vehicle</button></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Unit</th><th>Vehicle</th><th>Livery</th><th class="right">Odometer</th>
          <th>Assigned driver</th><th>Status</th><th class="right">Actions</th></tr></thead>
        <tbody>${db.trucks.map((t) => {
          const d = t.assignedTo ? Store.driver(t.assignedTo) : null;
          const liv = LIVERIES.find((l) => l.key === t.livery) || LIVERIES[0];
          return `<tr>
            <td class="mono sm b6">${esc(t.id)}</td>
            <td><div class="b6">${esc(t.make)} ${esc(t.model)}</div><div class="xs t3">${t.hp} hp · ${esc(t.chassis)}</div></td>
            <td><span class="badge" style="color:${liv.a};border-color:${liv.a}44;background:${liv.a}14">${esc(liv.name)}</span></td>
            <td class="right mono">${fmt.n(t.mileage)}</td>
            <td>${d ? `<div class="row gap-8">${avatar(d, 24)}<span class="sm">${esc(d.name)}</span></div>` : '<span class="sm t3">Unassigned</span>'}</td>
            <td>${statusBadge(t.status)}</td>
            <td class="right"><div class="row gap-6" style="justify-content:flex-end">
              <button class="btn btn-sm btn-ghost tip" data-tip="Assign" data-act="fleet-assign" data-id="${t.id}">${icon('user')}</button>
              <button class="btn btn-sm btn-ghost tip" data-tip="Edit" data-act="fleet-edit" data-id="${t.id}">${icon('edit')}</button>
            </div></td></tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }

  if (tab === 'events') {
    const evs = db.events.slice().sort((a, b) => new Date(b.date) - new Date(a.date));
    return `
      <div class="row-b mb-16 wrap gap-12"><div class="b7 lg">Event management</div>
        <button class="btn btn-sm btn-primary" data-act="event-create">${icon('plus')}Create event</button></div>
      <div class="table-wrap"><table class="tbl">
        <thead><tr><th>Event</th><th>Type</th><th>Date</th><th>Leader</th>
          <th class="right">Registered</th><th>Status</th><th class="right">Actions</th></tr></thead>
        <tbody>${evs.map((e) => {
          const l = Store.driver(e.leaderId);
          return `<tr>
            <td><div class="b6">${esc(e.name)}</div><div class="xs t3">${esc(e.start)} → ${esc(e.dest)}</div></td>
            <td><span class="badge ${e.tone}">${esc(e.typeLabel)}</span></td>
            <td class="sm t2 nowrap">${esc(fmt.date(e.date))}<div class="xs t3">${esc(fmt.time(e.date))}</div></td>
            <td>${l ? `<div class="row gap-8">${avatar(l, 24)}<span class="sm">${esc(l.name.split(' ')[0])}</span></div>` : '—'}</td>
            <td class="right mono">${e.registered.length}/${e.maxSlots}</td>
            <td>${statusBadge(e.status)}</td>
            <td class="right"><div class="row gap-6" style="justify-content:flex-end">
              <button class="btn btn-sm btn-ghost tip" data-tip="Open" data-act="go" data-href="#/convoy/${e.id}">${icon('eye')}</button>
              <button class="btn btn-sm btn-ghost tip" data-tip="Edit" data-act="event-edit" data-id="${e.id}">${icon('edit')}</button>
              ${e.status === 'scheduled' ? `<button class="btn btn-sm btn-danger tip" data-tip="Cancel" data-act="event-cancel" data-id="${e.id}">${icon('x')}</button>` : ''}
            </div></td></tr>`;
        }).join('')}</tbody>
      </table></div>`;
  }

  if (tab === 'content') {
    return `
      <div class="row-b mb-16 wrap gap-12"><div class="b7 lg">Announcements &amp; news</div>
        <button class="btn btn-sm btn-primary" data-act="ann-create">${icon('plus')}Publish announcement</button></div>
      <div class="col gap-12">
        ${db.announcements.map((a) => `<div class="card card-body">
          <div class="row-b wrap gap-12">
            <div style="min-width:0">
              <div class="row gap-8 mb-4">${a.pinned ? `<span class="badge brand">${icon('pin')}Pinned</span>` : ''}
                <span class="badge">${esc(a.tag)}</span><span class="xs t3">${esc(fmt.date(a.date))}</span></div>
              <div class="b7">${esc(a.title)}</div>
              <div class="sm t3 trunc" style="max-width:560px">${esc(a.body)}</div>
            </div>
            <div class="row gap-6">
              <button class="btn btn-sm" data-act="ann-pin" data-id="${a.id}">${icon('pin')}${a.pinned ? 'Unpin' : 'Pin'}</button>
              <button class="btn btn-sm btn-ghost" data-act="ann-edit" data-id="${a.id}">${icon('edit')}</button>
              <button class="btn btn-sm btn-danger" data-act="ann-delete" data-id="${a.id}">${icon('trash')}</button>
            </div></div></div>`).join('')}
      </div>`;
  }
  return '';
}

function adminOverview() {
  const db = Store.db;
  const active = db.drivers.filter((d) => d.status !== 'offline').length;
  const totalKm = sum(db.drivers.map((d) => d.km));
  const totalDeliv = sum(db.drivers.map((d) => d.deliveries));
  const avgAtt = Math.round(sum(db.drivers.map((d) => d.attendance)) / db.drivers.length);
  const utilisation = Math.round(db.trucks.filter((t) => t.status === 'active').length / db.trucks.length * 100);
  const newApps = db.applications.filter((a) => Date.now() - new Date(a.submitted) < 30 * DAY).length;

  const months = Array.from({ length: 8 }, (_, i) => {
    const d = new Date(); d.setMonth(d.getMonth() - (7 - i));
    return d.toLocaleDateString('en-GB', { month: 'short' });
  });
  /* every series below is counted off the records — an empty company charts
     as zero rather than as an invented trend */
  const kmSeries = monthlySeries(8, (from, to) => Math.round(sum((db.jobs || [])
    .filter((j) => inWindow(j.finished, from, to)).map((j) => j.km || 0))));
  const signups = monthlySeries(8, (from, to) => db.drivers
    .filter((d) => inWindow(d.joined, from, to)).length);
  const attendance = monthlySeries(8, (from, to) => {
    const held = db.events.filter((e) => inWindow(e.date, from, to));
    if (!held.length) return 0;
    const seats = sum(held.map((e) => (e.registered || []).length));
    const shown = sum(held.map((e) => (e.registered || []).filter((r) => r.attended !== false).length));
    return seats ? Math.round(shown / seats * 100) : 0;
  });

  const rankDist = RANKS.map((r) => ({
    label: r.name, value: db.drivers.filter((d) => d.rankIdx === r.i).length, color: r.color,
  })).filter((s) => s.value);

  return `
    <div class="grid g-4 mb-20">
      ${statTile({ label: 'Total drivers', value: fmt.n(db.drivers.length), raw: db.drivers.length, icon: 'users', tone: 'brand', delta: { dir: 'up', text: '+' + newApps + ' this month' } })}
      ${statTile({ label: 'Active drivers', value: fmt.n(active), raw: active, icon: 'activity', tone: 'ok', sub: bar(active / db.drivers.length * 100, 'ok', 'thin') })}
      ${statTile({ label: 'Fleet distance', value: fmt.kmS(totalKm), icon: 'route', tone: 'info' })}
      ${statTile({ label: 'Deliveries', value: fmt.n(totalDeliv), raw: totalDeliv, icon: 'package', tone: 'violet' })}
      ${statTile({ label: 'Applications', value: fmt.n(db.applications.length), raw: db.applications.length, icon: 'userPlus', tone: 'warn', sub: `<span class="t3">${db.applications.filter((a) => a.status === 'pending').length} awaiting review</span>` })}
      ${statTile({ label: 'Avg. attendance', value: fmt.pct(avgAtt), raw: avgAtt, icon: 'checkCircle', tone: avgAtt >= 80 ? 'ok' : 'warn' })}
      ${statTile({ label: 'Fleet utilisation', value: fmt.pct(utilisation), raw: utilisation, icon: 'truck', tone: 'brand', sub: bar(utilisation, '', 'thin') })}
      ${statTile({ label: 'Open tickets', value: fmt.n(db.tickets.filter((t) => t.status !== 'resolved').length), raw: db.tickets.filter((t) => t.status !== 'resolved').length, icon: 'lifeBuoy', tone: 'info' })}
    </div>

    <div class="grid g-2">
      <div class="card"><div class="card-head"><div class="card-title">${icon('activity')}Fleet distance by month</div></div>
        <div class="card-body">${areaChart([{ name: 'Distance', values: kmSeries, color: '#4f7fff' }], months,
          { h: 230, fmtY: (v) => Math.round(v / 1000) + 'k', fmtT: fmt.km, aria: 'Fleet distance by month' })}</div></div>

      <div class="card"><div class="card-head"><div class="card-title">${icon('userPlus')}New drivers recruited</div></div>
        <div class="card-body">${barChart(months.map((m, i) => ({ label: m, value: signups[i] })), { h: 230 })}</div></div>

      <div class="card"><div class="card-head"><div class="card-title">${icon('medal')}Rank distribution</div></div>
        <div class="card-body">${donut(rankDist, { centerValue: fmt.n(db.drivers.length), centerLabel: 'Drivers' })}</div></div>

      <div class="card"><div class="card-head"><div class="card-title">${icon('checkCircle')}Convoy attendance trend</div></div>
        <div class="card-body">${areaChart([{ name: 'Attendance %', values: attendance, color: '#3ecf8e' }], months,
          { h: 230, max: 100, fmtY: (v) => Math.round(v) + '%', fmtT: (v) => v + '%', aria: 'Attendance trend' })}</div></div>

      <div class="card span-2"><div class="card-head"><div class="card-title">${icon('truck')}Fleet status</div></div>
        <div class="card-body grid g-3" style="gap:16px">
          ${[['In service', db.trucks.filter((t) => t.status === 'active').length, 'ok'],
             ['Available', db.trucks.filter((t) => t.status === 'available').length, 'info'],
             ['Maintenance', db.trucks.filter((t) => t.status === 'maintenance').length, 'warn']]
            .map(([k, v, tone]) => `<div class="row gap-16">
              ${progressRing(v / db.trucks.length * 100, { size: 78, stroke: 7, fs: 15, color: { ok: 'var(--ok)', info: 'var(--info)', warn: 'var(--warn)' }[tone] })}
              <div><div class="b8" style="font-size:22px">${v}</div><div class="xs t3 cap b7">${k}</div></div></div>`).join('')}
        </div></div>
    </div>`;
}

/* ---------------- 30. Modal builders ---------------- */
function openApplication(id) {
  const a = Store.application(id); if (!a) return;
  openModal({
    title: a.name, sub: `${a.id} · submitted ${fmt.rel(a.submitted)}`, size: 'wide',
    body: `
      <div class="row gap-8 wrap mb-16">${statusBadge(a.status)}<span class="badge">${esc(a.country)}</span>
        ${a.age ? `<span class="badge">Age ${a.age}</span>` : ''}
        <span class="badge">${esc(a.experience || 'Not stated')}</span>
        ${a.detailed ? '' : '<span class="badge warn">Not filled in yet</span>'}</div>
      <div class="grid g-2" style="gap:0 18px">
        <div>${kv('Email', esc(a.email))}${kv('Discord', a.discord
            ? `<span class="mono">${esc(a.discord)}</span>` : '<span class="t3">Not given</span>')}
          ${kv('TruckersMP', a.truckersmp
            ? `<span class="mono">${esc(a.truckersmp)}</span>` : '<span class="t3">Not given</span>')}</div>
        <div>${kv('In-game hours', a.hours ? fmt.n(a.hours) : '<span class="t3">Not given</span>')}
          ${kv('Previous VTC', esc(a.previousVtc || 'None'))}
          ${kv('Submitted', esc(fmt.date(a.submitted)))}</div>
      </div>
      <div class="mt-16"><div class="xs t3 cap b7 mb-8">Motivation</div>
        <p class="t2" style="line-height:1.7">${esc(a.why)}</p></div>

      ${(a.messages || []).length ? `<div class="mt-20"><div class="xs t3 cap b7 mb-8">Conversation</div>
        <div class="col gap-10">${a.messages.map((m) => `<div class="row gap-10">
          <span class="feed-ico">${icon(m.from === 'staff' ? 'shield' : 'user')}</span>
          <div style="min-width:0"><div class="sm t2">${esc(m.text)}</div>
            <div class="xs t3 mt-4">${esc(m.from === 'staff' ? 'Recruitment' : a.name)} · ${esc(fmt.rel(m.at))}</div></div>
        </div>`).join('')}</div></div>` : ''}

      ${(a.notes || []).length ? `<div class="mt-20"><div class="xs t3 cap b7 mb-8">Internal notes</div>
        <div class="col gap-8">${a.notes.map((n) => `<div class="sm t2">${esc(n.text)}
          <span class="xs t3">— ${esc((Store.driver(n.by) || {}).name || 'Staff')}, ${esc(fmt.rel(n.at))}</span></div>`).join('')}</div></div>` : ''}

      ${can('recruitment.manage') ? `
        <div class="field mt-20"><label for="app-reply">Reply to the applicant</label>
          <textarea class="textarea" id="app-reply" rows="2"
            placeholder="They see this on their application, and get a notification."></textarea>
          <div class="row mt-8"><button class="btn btn-sm" data-act="app-reply" data-id="${a.id}">${icon('send')}Send reply</button></div></div>
        <div class="field"><label for="app-note">Internal note</label>
          <textarea class="textarea" id="app-note" rows="2" placeholder="Only staff see this."></textarea>
          <div class="row mt-8"><button class="btn btn-sm" data-act="app-note-save" data-id="${a.id}">${icon('plus')}Add note</button></div></div>` : ''}`,
    foot: can('recruitment.manage') ? `
      <button class="btn btn-ghost" data-act="modal-close">Close</button>
      <button class="btn" data-act="app-stage" data-id="${a.id}" data-stage="review">${icon('eye')}In review</button>
      <button class="btn" data-act="app-stage" data-id="${a.id}" data-stage="interview">${icon('users')}Interview</button>
      <button class="btn btn-danger" data-act="app-reject" data-id="${a.id}">${icon('x')}Reject</button>
      <button class="btn btn-ok" data-act="app-approve" data-id="${a.id}">${icon('check')}Approve</button>`
      : `<button class="btn btn-ghost" data-act="modal-close">Close</button>`,
  });
}

function openEventEditor(id) {
  const e = id ? Store.event(id) : null;
  const cityOptions = Object.keys(CITIES).sort().map((c) => `<option>${esc(c)}</option>`).join('');
  const leaders = Store.db.drivers.filter((d) => d.rankIdx >= 4).sort((a, b) => a.name.localeCompare(b.name));
  const dt = e ? new Date(e.date) : new Date(Date.now() + 7 * DAY);
  const isoLocal = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);

  openModal({
    title: e ? 'Edit event' : 'Create event', size: 'wide',
    body: `<form id="eventForm">
      <div class="grid g-2" style="gap:0 14px">
        <div class="field"><label for="ev-name">Event name *</label>
          <input class="input" id="ev-name" value="${esc(e?.name || '')}" placeholder="Northern Steel Run"></div>
        <div class="field"><label for="ev-type">Type</label>
          <select class="select" id="ev-type">
            ${[['convoy', 'Official Convoy'], ['community', 'Community Convoy'], ['meeting', 'Driver Meeting'],
               ['training', 'Training Session'], ['recruitment', 'Recruitment Event']]
              .map(([v, l]) => `<option value="${v}" ${e?.type === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="field"><label for="ev-start">Start city</label>
          <select class="select" id="ev-start">${cityOptions}</select></div>
        <div class="field"><label for="ev-dest">Destination</label>
          <select class="select" id="ev-dest">${cityOptions}</select></div>
        <div class="field"><label for="ev-date">Date &amp; time (UTC)</label>
          <input class="input" id="ev-date" type="datetime-local" value="${isoLocal}"></div>
        <div class="field"><label for="ev-slots">Maximum participants</label>
          <input class="input" id="ev-slots" type="number" min="2" max="200" value="${e?.maxSlots || 30}"></div>
        <div class="field"><label for="ev-leader">Convoy leader</label>
          <select class="select" id="ev-leader">${leaders.map((d) =>
            `<option value="${d.id}" ${e?.leaderId === d.id ? 'selected' : ''}>${esc(d.name)} — ${esc(rankOf(d).name)}</option>`).join('')}</select></div>
        <div class="field"><label for="ev-server">Server</label>
          <input class="input" id="ev-server" value="${esc(e?.server || 'TruckersMP — Simulation 1')}"></div>
      </div>
      <div class="field"><label for="ev-via">Checkpoints (comma separated)</label>
        <input class="input" id="ev-via" value="${esc(e ? e.path.slice(1, -1).join(', ') : '')}" placeholder="Duisburg, Hannover"></div>
      <div class="field"><label for="ev-desc">Description</label>
        <textarea class="textarea" id="ev-desc" placeholder="Brief the drivers…">${esc(e?.description || '')}</textarea></div>
    </form>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="event-save" data-id="${e?.id || ''}">${icon('check')}${e ? 'Save changes' : 'Create event'}</button>`,
    onMount(w) {
      if (e) { w.querySelector('#ev-start').value = e.start; w.querySelector('#ev-dest').value = e.dest; }
      else { w.querySelector('#ev-start').value = 'Rotterdam'; w.querySelector('#ev-dest').value = 'Berlin'; }
    },
  });
}

function openDriverEditor(id) {
  const d = Store.driver(id); if (!d) return;
  openModal({
    title: 'Manage driver', sub: `${d.name} · ${d.id}`,
    body: `<form id="driverAdminForm">
      <div class="field"><label for="dm-rank">Rank</label>
        <select class="select" id="dm-rank">${RANKS.map((r) =>
          `<option value="${r.i}" ${d.rankIdx === r.i ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
        <span class="hint">Qualifies for: ${esc(earnedRank(d).name)}</span></div>
      <div class="field"><label for="dm-role">Role</label>
        <select class="select" id="dm-role" ${can('roles.manage') ? '' : 'disabled'}>
          ${Object.entries(ROLES).map(([k, r]) => `<option value="${k}" ${d.role === k ? 'selected' : ''}>${esc(r.name)}</option>`).join('')}</select>
        ${can('roles.manage') ? '' : '<span class="hint">Only administrators can change roles.</span>'}</div>
      <div class="field"><label for="dm-status">Account status</label>
        <select class="select" id="dm-status">
          ${['active', 'suspended'].map((s) => `<option value="${s}" ${d.accountStatus === s ? 'selected' : ''}>${esc(statusLabel(s) || s)}</option>`).join('')}</select></div>
      <div class="field"><label for="dm-client">Heavyline Trucker client</label>
        <select class="select" id="dm-client">
          <option value="yes" ${d.clientAccess ? 'selected' : ''}>Released — they can download it</option>
          <option value="no" ${d.clientAccess ? '' : 'selected'}>Not released yet</option>
        </select>
        <span class="hint">Approving their application releases it automatically.</span></div>
      <div class="field"><label for="dm-truck">Assigned vehicle</label>
        <select class="select" id="dm-truck"><option value="">— none —</option>
          ${Store.db.trucks.map((t) => `<option value="${t.id}" ${d.truckId === t.id ? 'selected' : ''}>
            ${esc(t.id)} · ${esc(t.make)} ${esc(t.model)}${t.assignedTo && t.assignedTo !== d.id ? ' (assigned)' : ''}</option>`).join('')}</select></div>
    </form>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="driver-save" data-id="${d.id}">${icon('check')}Save changes</button>`,
  });
}

function openFleetEditor(id) {
  const t = id ? Store.truck(id) : null;
  openModal({
    title: t ? 'Edit vehicle' : 'Add vehicle', size: 'wide',
    body: `<form id="fleetForm">
      <div class="grid g-2" style="gap:0 14px">
        <div class="field"><label for="fl-make">Make</label>
          <select class="select" id="fl-make">${[...new Set(TRUCK_MODELS.map((m) => m.make))]
            .map((m) => `<option ${t?.make === m ? 'selected' : ''}>${esc(m)}</option>`).join('')}</select></div>
        <div class="field"><label for="fl-model">Model</label>
          <input class="input" id="fl-model" value="${esc(t?.model || '')}" placeholder="S 730 V8"></div>
        <div class="field"><label for="fl-hp">Power (hp)</label>
          <input class="input" id="fl-hp" type="number" value="${t?.hp || 650}"></div>
        <div class="field"><label for="fl-chassis">Chassis</label>
          <select class="select" id="fl-chassis">${['4x2', '6x2', '6x4', '8x4'].map((c) =>
            `<option ${t?.chassis === c ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label for="fl-plate">Registration</label>
          <input class="input" id="fl-plate" value="${esc(t?.plate || '')}" placeholder="HLL 123A"></div>
        <div class="field"><label for="fl-year">Model year</label>
          <input class="input" id="fl-year" type="number" min="2000" max="2030" value="${t?.year || 2026}"></div>
        <div class="field"><label for="fl-livery">Livery</label>
          <select class="select" id="fl-livery">${LIVERIES.map((l) =>
            `<option value="${l.key}" ${t?.livery === l.key ? 'selected' : ''}>${esc(l.name)}</option>`).join('')}</select></div>
        <div class="field"><label for="fl-mileage">Odometer (km)</label>
          <input class="input" id="fl-mileage" type="number" min="0" value="${t?.mileage || 0}"></div>
        <div class="field"><label for="fl-servicekm">Odometer at last service (km)</label>
          <input class="input" id="fl-servicekm" type="number" min="0"
            value="${t?.serviceKm != null ? t.serviceKm : ''}" placeholder="Leave blank if unknown"></div>
        <div class="field"><label for="fl-status">Status</label>
          <select class="select" id="fl-status">${['active', 'available', 'maintenance'].map((s) =>
            `<option value="${s}" ${t?.status === s ? 'selected' : ''}>${['In service', 'Available', 'Maintenance'][['active', 'available', 'maintenance'].indexOf(s)]}</option>`).join('')}</select></div>
      </div>
    </form>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="fleet-save" data-id="${t?.id || ''}">${icon('check')}${t ? 'Save changes' : 'Add vehicle'}</button>`,
  });
}

function openAssignDriver(truckId) {
  const t = Store.truck(truckId); if (!t) return;
  openModal({
    title: 'Assign driver', sub: `${t.id} · ${t.make} ${t.model}`,
    body: `<div class="field"><label for="as-driver">Driver</label>
      <select class="select" id="as-driver"><option value="">— unassign —</option>
        ${Store.db.drivers.slice().sort((a, b) => a.name.localeCompare(b.name)).map((d) =>
          `<option value="${d.id}" ${t.assignedTo === d.id ? 'selected' : ''}>${esc(d.name)} — ${esc(rankOf(d).name)}${d.truckId && d.truckId !== t.id ? ' (has vehicle)' : ''}</option>`).join('')}
      </select><span class="hint">Assigning moves the driver off any vehicle they currently hold.</span></div>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="assign-save" data-id="${t.id}">${icon('check')}Assign</button>`,
  });
}

function openAnnouncementEditor(id) {
  const a = id ? byId(Store.db.announcements, id) : null;
  openModal({
    title: a ? 'Edit announcement' : 'Publish announcement', size: 'wide',
    body: `<form id="annForm">
      <div class="field"><label for="an-title">Title *</label>
        <input class="input" id="an-title" value="${esc(a?.title || '')}" placeholder="Season update"></div>
      <div class="field"><label for="an-tag">Category</label>
        <select class="select" id="an-tag">${['Company', 'Convoy', 'Fleet', 'Recruitment', 'Standards', 'Community']
          .map((t) => `<option ${a?.tag === t ? 'selected' : ''}>${t}</option>`).join('')}</select></div>
      <div class="field"><label for="an-body">Message *</label>
        <textarea class="textarea" id="an-body" style="min-height:170px" placeholder="Write to the fleet…">${esc(a?.body || '')}</textarea></div>
      <label class="check ${a?.pinned ? 'on' : ''}"><input type="checkbox" id="an-pin" ${a?.pinned ? 'checked' : ''}>
        <span class="sm t2">Pin to the top of the community page and dashboard</span></label>
    </form>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="ann-save" data-id="${a?.id || ''}">${icon('send')}${a ? 'Save changes' : 'Publish'}</button>`,
  });
}

function openTicketModal() {
  openModal({
    title: 'New support request', sub: 'HLL management usually replies within a few hours',
    body: `<form id="ticketForm">
      <div class="field"><label for="tk-sub">Subject *</label>
        <input class="input" id="tk-sub" placeholder="Briefly describe the issue"></div>
      <div class="field"><label for="tk-cat">Category</label>
        <select class="select" id="tk-cat">${['Technical issue', 'Convoy issue', 'Account', 'Fleet request', 'Management']
          .map((c) => `<option>${c}</option>`).join('')}</select></div>
      <div class="field"><label for="tk-pri">Priority</label>
        <select class="select" id="tk-pri"><option value="low">Low</option>
          <option value="normal" selected>Normal</option><option value="high">High</option></select></div>
      <div class="field"><label for="tk-body">Details *</label>
        <textarea class="textarea" id="tk-body" placeholder="What happened, and what did you expect?"></textarea></div>
    </form>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="ticket-save">${icon('send')}Submit request</button>`,
  });
}

function openAddDriver() {
  openModal({
    title: 'Add driver', sub: 'Creates the driver record and a login to go with it',
    body: `<form id="addDriverForm">
      <div class="field"><label for="nd-name">Driver name *</label><input class="input" id="nd-name" placeholder="Alex Mercer"></div>
      <div class="field"><label for="nd-email">Email address *</label>
        <input class="input" id="nd-email" type="email" placeholder="alex@example.com">
        <span class="hint">They sign in with this, or with the HLL Driver ID.</span></div>
      <div class="field"><label for="nd-pw">Temporary password *</label>
        <input class="input" id="nd-pw" value="${esc(tempPassword())}">
        <span class="hint">Pass this on and ask them to change it under Settings.</span></div>
      <div class="field"><label for="nd-country">Country</label>
        <select class="select" id="nd-country">
          <option value="">Select…</option>
          ${COUNTRIES.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
      <div class="field"><label for="nd-discord">Discord username</label><input class="input" id="nd-discord" placeholder="alexm"></div>
      <div class="field"><label for="nd-rank">Starting rank</label>
        <select class="select" id="nd-rank">${RANKS.slice(0, 3).map((r) => `<option value="${r.i}">${esc(r.name)}</option>`).join('')}</select></div>
      ${can('roles.manage') ? `<div class="field"><label for="nd-role">Role</label>
        <select class="select" id="nd-role">${Object.entries(ROLES).map(([k, r]) =>
          `<option value="${k}">${esc(r.name)}</option>`).join('')}</select>
        <span class="hint">Anything above Driver gets management permissions.</span></div>` : ''}
    </form>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="add-driver-save">${icon('userPlus')}Create driver</button>`,
  });
}

function openSearch() {
  openModal({
    title: 'Search Heavyline', size: 'wide',
    body: `<div class="search" style="max-width:none">${icon('search')}
        <input class="input" id="cmdInput" placeholder="Drivers, convoys, vehicles, pages…" style="padding-left:38px;height:48px">
      </div><div id="cmdResults" class="mt-16"></div>`,
    onMount(w) {
      const inp = w.querySelector('#cmdInput'), out = w.querySelector('#cmdResults');
      const run = () => { out.innerHTML = searchResults(inp.value); };
      inp.addEventListener('input', run); run();
    },
  });
}

function searchResults(q) {
  q = (q || '').trim().toLowerCase();
  if (!q) return `<div class="xs t3 cap b7 mb-8">Jump to</div><div class="col gap-4">
    ${Object.entries(ROUTES).filter(([, r]) => !r.hidden && (!r.perm || can(r.perm)))
      .map(([k, r]) => `<button class="btn btn-block" style="justify-content:flex-start" data-act="go" data-href="#/${k}">
        ${icon(r.icon)}${esc(r.title)}</button>`).join('')}</div>`;

  const drivers = Store.db.drivers.filter((d) => (d.name + d.id).toLowerCase().includes(q)).slice(0, 5);
  const events = Store.db.events.filter((e) => (e.name + e.start + e.dest).toLowerCase().includes(q)).slice(0, 5);
  const trucks = Store.db.trucks.filter((t) => (t.id + t.make + t.model + t.plate).toLowerCase().includes(q)).slice(0, 5);
  if (!drivers.length && !events.length && !trucks.length)
    return emptyState('search', 'No matches', `Nothing found for “${q}”.`);

  const sec = (title, items) => items.length ? `<div class="xs t3 cap b7 mb-8 mt-16">${title}</div><div class="col gap-4">${items.join('')}</div>` : '';
  return sec('Drivers', drivers.map((d) => `<button class="btn btn-block" style="justify-content:flex-start" data-act="go" data-href="#/driver/${d.id}">
      ${avatar(d, 24)}<span>${esc(d.name)}</span><span class="xs t3 mono">${esc(d.id)}</span></button>`))
    + sec('Convoys & events', events.map((e) => `<button class="btn btn-block" style="justify-content:flex-start" data-act="go" data-href="#/convoy/${e.id}">
      ${icon('route')}<span>${esc(e.name)}</span><span class="xs t3">${esc(fmt.dayMon(e.date))}</span></button>`))
    + sec('Fleet', trucks.map((t) => `<button class="btn btn-block" style="justify-content:flex-start" data-act="go" data-href="#/vehicle/${t.id}">
      ${icon('truck')}<span>${esc(t.make)} ${esc(t.model)}</span><span class="xs t3 mono">${esc(t.id)}</span></button>`));
}

/* ---------------- 31. Event registration flow (spec §6) ---------------- */
/* ============================================================
   THE LIVE CONVOY PANEL
   ------------------------------------------------------------
   What a convoy looks like while it is happening. Everything on
   it is pushed rather than polled, and everything on it is real:
   a driver who is not reporting telemetry is shown as not
   reporting, not given a plausible position.
   ============================================================ */
function convoyLiveHTML(e) {
  const st = Convoy.stateOf(e);
  if (st !== 'live' && st !== 'starting') return '';
  const s = Convoy.stats(e);

  return `
  <section class="card reveal convoy-live" id="convoyLive" data-convoy="${esc(e.id)}">
    <div class="card-head">
      <div class="card-title">${icon('activity')}Live convoy</div>
      <div class="row gap-8">
        ${hqLiveDot()}
        ${Convoy.badge(e)}
      </div>
    </div>

    <div class="card-body">
      <div class="convoy-tiles" id="convoyTiles">${convoyTilesInner(e, s)}</div>

      <!-- the map is mounted after render; Leaflet needs a node in the page -->
      <div class="convoy-map-wrap mt-16">
        <div id="convoyMap" class="hq-map convoy-map"></div>
        <div class="convoy-map-legend">
          <span><i class="lg-dot lead"></i>Leader</span>
          <span><i class="lg-dot hauling"></i>On a job</span>
          <span><i class="lg-dot moving"></i>Rolling</span>
          <span><i class="lg-dot idle"></i>Stopped</span>
        </div>
      </div>

      <div class="mt-16" id="convoyBoard">${convoyBoardInner(e)}</div>
    </div>
  </section>`;
}

function convoyTilesInner(e, s) {
  s = s || Convoy.stats(e);
  return `
    ${opsTile('Registered', s.joined, 'users', '', 'of ' + s.slots + ' slots')}
    ${opsTile('Connected', s.connected, 'play', s.connected ? 'ok' : 'warn',
      s.turnout + '% of those registered')}
    ${opsTile('Completed', s.completed, 'checkCircle', s.completed ? 'ok' : '',
      s.joined ? s.attendance + '% attendance' : 'nobody yet')}
    ${opsTile('Running for', s.durationMin || 0, 'clock', 'info',
      s.startedAt ? 'since ' + fmt.time(s.startedAt) : 'not started')}`;
}

/* One row per registered driver, live. A driver reporting from the game shows
   what they are doing; one who is not shows that plainly rather than a stale
   position dressed up as a current one. */
function convoyBoardInner(e) {
  const parts = Convoy.participants(e);
  if (!parts.length) {
    return emptyState('users', 'Nobody has registered yet',
      'Drivers appear here as they join, and light up as their clients report in.');
  }
  const leadPos = Convoy.leaderPosition(e);

  return `<div class="fleetlist">${parts.map((p) => {
    const d = p.driver;
    const gap = Convoy.distanceFromLeader(e, p);
    const cls = !p.connected ? 'idle'
      : p.job ? 'rolling'
      : (p.speed >= 5) ? 'moving' : 'held';

    return `<div class="fleetrow convoy-row ${cls}${p.leader ? ' leader' : ''}">
      ${d ? avatar(d, 32) : `<span class="avatar a-32">${esc(initials(p.name))}</span>`}

      <div class="fr-who">
        <div class="fr-name">${esc(p.name)}
          ${p.leader ? '<span class="badge brand">Leader</span>' : ''}</div>
        <div class="fr-truck"><span class="mono">${esc(p.id)}</span>${
          p.truck ? ' · ' + esc(p.truck) : ''}${
          p.game ? ' · ' + esc(mapShort(p.game)) : ''}</div>
      </div>

      <div class="fr-run">
        ${p.connected ? `
          <div class="fr-route">
            ${p.job
              ? `<span>${esc(cityLabel(p.job.from || '?'))}</span>
                 <span class="fr-arrow">${icon('arrowRight')}</span>
                 <span class="to">${esc(cityLabel(p.job.to || '?'))}</span>
                 ${p.job.cargo ? `<span class="fr-cargo">${esc(p.job.cargo)}</span>` : ''}`
              : `<span class="t3">No load aboard</span>`}
          </div>
          <div class="fr-sub">
            <span>${esc(convoyWhere(p) || 'position not placed')}</span>
            ${gap != null && !p.leader
              ? `<b title="Straight-line distance between the two trucks, not road distance">${
                  fmt.km(gap)} from leader <em class="direct">direct</em></b>` : ''}
            ${gap == null && !p.leader && leadPos
              ? '<span>gap unknown — not reporting</span>' : ''}
            ${gap == null && !p.leader && !leadPos
              ? '<span>gap unknown — the leader is not reporting</span>' : ''}
          </div>`
        : `<div class="fr-noload">${icon('alert')}Telemetry unavailable — not reporting from the game</div>
           <div class="fr-sub"><span>${esc(convoyRegState(p))}</span></div>`}
      </div>

      <div class="fr-state">
        <span class="fr-word"><i class="beat"></i>${
          p.connected ? (p.speed >= 5 ? 'Rolling' : 'Stopped') : 'Offline'}</span>
        ${p.connected
          ? `<span class="fr-speed">${p.speed}<em>km/h</em></span>`
          : `<span class="fr-speed t3" style="font-size:11px">—</span>`}
      </div>

      ${can('events.manage') && !p.leader && e.status !== 'completed' ? `
        <button class="icon-btn convoy-kick" title="Remove ${esc(p.name)} from the convoy"
          data-act="convoy-remove" data-id="${esc(e.id)}" data-driver="${esc(p.id)}"
          aria-label="Remove ${esc(p.name)}">${icon('x')}</button>` : ''}
    </div>`;
  }).join('')}</div>`;
}

/* where a participant is, in words */
function convoyWhere(p) {
  if (!p.live || typeof p.live.lat !== 'number') return null;
  return nearestCityLabel(p.live.game || 'ets2', p.live.lat, p.live.lon);
}

function convoyRegState(p) {
  return {
    registered: 'Registered — not confirmed',
    confirmed: 'Confirmed — waiting to connect',
    completed: 'Completed the convoy',
  }[p.state] || 'Registered';
}

/* repaint the live parts without rebuilding the page around them */
function paintConvoyLive() {
  const host = $('#convoyLive');
  if (!host) return;
  const e = Store.event(host.dataset.convoy);
  if (!e) return;
  const tiles = $('#convoyTiles');
  if (tiles) tiles.innerHTML = convoyTilesInner(e);
  const board = $('#convoyBoard');
  if (board) board.innerHTML = convoyBoardInner(e);
  ConvoyMap.paint(e);
}


/* ============================================================
   THE CONVOY MAP
   ------------------------------------------------------------
   The same road network, the same projection and the same truck
   markers the fleet map already uses — scoped to this convoy's
   participants, with the route drawn over it and the leader
   marked out.

   Built on the existing map rather than beside it on purpose: a
   truck should look the same and be in the same place wherever
   Heavyline draws it.
   ============================================================ */
const ConvoyMap = {
  map: null, base: null, routeLayer: null, fleetLayer: null,
  convoyId: null, game: 'ets2',

  mount(el, e) {
    if (!el || typeof L === 'undefined' || !e) return;
    this.destroy();
    this.convoyId = e.id;
    el.classList.add('game-map');

    this.map = L.map(el, {
      crs: L.CRS.Simple, minZoom: -1, maxZoom: 5, zoomSnap: 0.25,
      zoomControl: true, attributionControl: false,
    });
    this.base = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);
    this.fleetLayer = L.layerGroup().addTo(this.map);

    drawGameBase(this.base, this.game);
    this.drawRoute(e);
    this.paint(e);

    /* frame the route, which is what this map is about — not the whole map */
    const pts = (e.path || []).map((c) => gameLatLng(cityXY(c))).filter(Boolean);
    if (pts.length > 1) this.map.fitBounds(L.latLngBounds(pts), { padding: [40, 40] });
    else {
      const b = mapFor(this.game).bounds;
      this.map.fitBounds([gameLatLng([b.x0, b.y0]), gameLatLng([b.x1, b.y1])], { padding: [20, 20] });
    }
  },

  destroy() {
    if (!this.map) return;
    [this.base, this.routeLayer, this.fleetLayer].forEach((l) => {
      if (l) { try { this.map.removeLayer(l); } catch (err) {} }
    });
    this.map.off();
    try { this.map.remove(); } catch (err) {}
    this.map = this.base = this.routeLayer = this.fleetLayer = null;
    this.convoyId = null;
  },

  drawRoute(e) {
    if (!this.routeLayer) return;
    this.routeLayer.clearLayers();
    const pts = (e.path || []).map((c) => gameLatLng(cityXY(c)));
    if (pts.length < 2) return;
    L.polyline(pts, { color: '#0b0d10', weight: 9, opacity: .9, interactive: false })
      .addTo(this.routeLayer);
    L.polyline(pts, { color: '#4f7fff', weight: 3.4, opacity: .95, interactive: false })
      .addTo(this.routeLayer);
    (e.path || []).forEach((c, i) => {
      const last = i === (e.path.length - 1);
      L.circleMarker(gameLatLng(cityXY(c)), {
        radius: (i === 0 || last) ? 5.5 : 4,
        color: '#0b0d10', weight: 2,
        fillColor: (i === 0) ? '#3ecf8e' : last ? '#ef5f5f' : '#4f7fff',
        fillOpacity: 1,
      }).bindTooltip((i === 0 ? 'Departure — ' : last ? 'Destination — ' : 'Checkpoint — ')
        + cityLabel(c), { direction: 'top', offset: [0, -8] }).addTo(this.routeLayer);
    });
  },

  /* the participants, live. Only those actually reporting are drawn — a
     driver with no telemetry has no position, and inventing one would be
     the single most dishonest thing this map could do. */
  paint(e) {
    if (!this.fleetLayer) return;
    this.fleetLayer.clearLayers();
    Convoy.participants(e).forEach((p) => {
      const live = p.live;
      if (!live || typeof live.lat !== 'number') return;
      const ll = geoToGameLatLng(live.game || this.game, live.lat, live.lon);
      if (!ll) return;

      const moving = (live.speed || 0) >= 5;
      const colour = p.leader ? '#ffd166' : live.job ? '#4f7fff' : moving ? '#4aa3f0' : '#69727f';
      const deg = (1 - (Number(live.heading) || 0)) * 360;
      const gap = Convoy.distanceFromLeader(e, p);

      L.marker(ll, {
        icon: L.divIcon({
          className: 'fleet-truck convoy-truck' + (p.leader ? ' leader' : '')
            + (live.job ? ' hauling' : ''),
          iconSize: [26, 26], iconAnchor: [13, 13],
          html: `<span class="ft-arrow" style="transform:rotate(${deg.toFixed(0)}deg);color:${colour}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 19-7-4.5L5 21z" fill="currentColor"/></svg>
            </span>
            <span class="ft-name">${esc(p.name.split(' ')[0])}${p.leader ? ' ★' : ''}</span>`,
        }),
        title: p.name,
      }).bindTooltip('<b>' + esc(p.name) + (p.leader ? ' — leader' : '') + '</b>'
        + '<br>' + esc(p.truck || 'truck unknown')
        + '<br>' + Math.round(live.speed || 0) + ' km/h'
        + (gap != null && !p.leader ? '<br>' + fmt.km(gap) + ' from leader (direct)' : '')
        + (live.job ? '<br>' + esc(cityLabel(live.job.from || '?')) + ' → '
            + esc(cityLabel(live.job.to || '?')) : ''),
        { direction: 'top', offset: [0, -14] })
        .addTo(this.fleetLayer);
    });
  },
};

/* The road network, cities and region seams — the backdrop both maps share.
   Lifted out of LiveMap so the convoy map draws exactly the same world
   rather than a second, slightly different one. */
function drawGameBase(layer, game) {
  const M = mapFor(game);
  const roads = ROADS[game] || ROADS.ets2;
  const pts = ([a, b]) => {
    const pa = M.cities[a], pb = M.cities[b];
    return (pa && pb) ? [gameLatLng(pa), gameLatLng(pb)] : null;
  };
  [['#161a1f', 15, .5], ['#31373f', 3.2, .9], ['#9aa4b0', 1.15, .95]].forEach((spec, i) => {
    roads.forEach((r) => {
      const p = pts(r); if (!p) return;
      L.polyline(p, { color: spec[0], weight: spec[1], opacity: spec[2],
        lineCap: 'round', lineJoin: 'round', interactive: false }).addTo(layer);
    });
  });
  Object.keys(M.cities).forEach((name) => {
    const major = cityTier(game, name) === 1;
    if (!major) return;                 /* the convoy map wants a quieter base */
    const ll = gameLatLng(M.cities[name]);
    L.circleMarker(ll, {
      radius: 2.6, color: '#0b0d10', weight: 1.2,
      fillColor: '#c2cad3', fillOpacity: 1, interactive: false,
    }).addTo(layer);
    L.marker(ll, { interactive: false,
      icon: L.divIcon({ className: 'city-label major', iconSize: [0, 0],
        html: '<span>' + esc(cityLabel(name)) + '</span>' }) }).addTo(layer);
  });
}


/* ============================================================
   CONVOY CHAT
   ============================================================ */
function convoyChatHTML(e) {
  const st = Convoy.stateOf(e);
  if (st === 'cancelled') return '';
  return `
  <section class="card reveal" id="convoyChatCard">
    <div class="card-head">
      <div class="card-title">${icon('mail')}Convoy chat</div>
      <div class="row gap-8">
        ${can('events.manage') ? `<button class="btn btn-sm" data-act="convoy-announce" data-id="${esc(e.id)}">
          ${icon('megaphone')}Announce</button>` : ''}
        ${hqLiveDot()}
      </div>
    </div>
    <div class="card-body">
      <div class="convoy-chat" id="convoyChat">${convoyChatInner()}</div>
      <form class="composer mt-12" id="convoyChatForm" data-id="${esc(e.id)}">
        <input class="input" id="convoyMsg" autocomplete="off" maxlength="400"
          placeholder="Message the convoy…" aria-label="Message the convoy">
        <button class="btn btn-primary" type="submit">${icon('send')}Send</button>
      </form>
    </div>
  </section>`;
}

function convoyChatInner() {
  /* Every reason chat cannot work is said plainly. An empty box with no
     explanation is the worst of the options, and the one this used to give. */
  if (ConvoyChat.error === 'no-service') {
    return `<div class="convoy-chat-note">${icon('alert')}Convoy chat needs the company service.
      Connect one and everybody on the convoy can talk here.</div>`;
  }
  if (ConvoyChat.error === 'no-identity') {
    return `<div class="convoy-chat-note">${icon('lock')}${esc(ServiceAuth.reason()
      || 'Sign in again to use convoy chat.')}</div>`;
  }
  if (ConvoyChat.error === 'not-yours') {
    return `<div class="convoy-chat-note">${icon('lock')}This convoy's chat is for the
      drivers on it and convoy control.</div>`;
  }
  if (ConvoyChat.error) {
    return `<div class="convoy-chat-note">${icon('alert')}Chat is not reachable —
      ${esc(ConvoyChat.error)}. It will reconnect on its own.</div>`;
  }
  if (ConvoyChat.loading && !ConvoyChat.messages.length) {
    return `<div class="convoy-chat-note">${icon('clock')}Loading the conversation…</div>`;
  }
  if (!ConvoyChat.messages.length) {
    return `<div class="convoy-chat-note">${icon('mail')}Nothing said yet.
      Messages reach everyone on the convoy straight away, and are kept.</div>`;
  }

  const me = state.user && state.user.id;
  const canModerate = can('admin.view');

  const older = ConvoyChat.olderCursor
    ? `<button class="btn btn-sm btn-ghost convoy-older" data-act="convoy-older"
        ${ConvoyChat.loadingOlder ? 'disabled' : ''}>${
        ConvoyChat.loadingOlder ? 'Loading…' : 'Load earlier messages'}</button>`
    : (ConvoyChat.total > ConvoyChat.messages.length
        ? '' : `<div class="convoy-chat-start">Start of the conversation</div>`);

  return older + ConvoyChat.messages.map((m) => {
    if (m.deleted) {
      return `<div class="cmsg removed"><div class="cmsg-body">${icon('trash')}Message removed</div></div>`;
    }
    const mine = m.driverId === me;
    return `<div class="cmsg ${mine ? 'mine' : ''} ${esc(m.role || 'driver')}">
      <div class="cmsg-who">${esc(m.driver)}${
        m.role === 'staff' ? '<span class="badge info">Control</span>'
        : m.role === 'leader' ? '<span class="badge brand">Leader</span>' : ''}
        <span class="cmsg-time">${esc(fmt.time(m.at))}</span>
        ${(mine || canModerate) ? `<button class="cmsg-del" title="Remove this message"
          data-act="convoy-msg-delete" data-id="${esc(m.id)}"
          aria-label="Remove message">${icon('trash')}</button>` : ''}
      </div>
      <div class="cmsg-body">${esc(m.text)}</div>
    </div>`;
  }).join('');
}

function paintConvoyChat() {
  const box = $('#convoyChat');
  if (!box) return;
  const atBottom = box.scrollHeight - box.scrollTop - box.clientHeight < 40;
  box.innerHTML = convoyChatInner();
  /* only follow the conversation if they were already at the bottom of it —
     yanking the view while somebody is reading back is maddening */
  if (atBottom) box.scrollTop = box.scrollHeight;
}


/* ============================================================
   CONVOY ACTIVITY + STATISTICS
   ============================================================ */
function convoyActivityHTML(e) {
  const acts = (e.activity || []).slice(-20).reverse();
  return `
  <div class="card reveal"><div class="card-head">
    <div class="card-title">${icon('activity')}Convoy activity</div>
    <span class="badge">${(e.activity || []).length}</span></div>
    <div class="card-body">
      ${acts.length ? `<div class="hqfeed">${acts.map((a) => `
        <div class="hqfeed-row ${a.kind === 'removed' || a.kind === 'left' ? 'warn'
          : a.kind === 'started' || a.kind === 'ended' ? 'ok' : 'info'}">
          <span class="hqfeed-time">${esc(fmt.time(a.at))}</span>
          <span class="hqfeed-text">${esc(a.text)}</span>
        </div>`).join('')}</div>`
      : emptyState('activity', 'Nothing has happened yet',
          'Joins, departures and the convoy starting are all recorded here.')}
    </div>
  </div>`;
}

function convoyStatsHTML(e) {
  /* a finished convoy shows the figures frozen when it ended; a running one
     shows them as they stand */
  const s = (e.status === 'completed' && e.stats) ? e.stats : Convoy.stats(e);
  const jobs = Convoy.jobsDuring(e);
  const earned = jobs.reduce((sum, j) => sum + (j.income || 0), 0);

  return `
  <div class="card reveal"><div class="card-head">
    <div class="card-title">${icon('chart')}Convoy statistics</div>
    ${e.status === 'completed' ? '<span class="badge">Final</span>'
      : '<span class="badge ok"><span class="live-dot"></span>Live</span>'}</div>
    <div class="card-body">
      ${kv('Registered', fmt.n(s.joined) + ' of ' + fmt.n(s.slots) + ' slots')}
      ${kv('Actually connected', fmt.n(s.connected) + ' · ' + s.turnout + '%')}
      ${kv('Completed', fmt.n(s.completed))}
      ${kv('Attendance', s.joined ? s.attendance + '%' : '—')}
      ${kv('Started', s.startedAt ? esc(fmt.dt(s.startedAt)) : '<span class="t3">not started</span>')}
      ${kv('Ended', s.endedAt ? esc(fmt.dt(s.endedAt)) : '<span class="t3">—</span>')}
      ${kv('Duration', s.durationMin != null ? esc(fmt.dur(s.durationMin)) : '<span class="t3">—</span>')}
      ${kv('Route distance', fmt.km(s.distance))}
      ${kv('Runs delivered', fmt.n(jobs.length) + (earned ? ' · ' + fmt.eur(earned) : ''))}
    </div>
  </div>`;
}


/* ============================================================
   RUNNING A CONVOY
   ------------------------------------------------------------
   The controls a convoy controller actually uses. Every one of
   them does the same three things in the same order: change the
   record, write it to the convoy's own history, and tell everyone
   holding the live stream. Doing them together is what stops the
   board, the log and the notifications ever disagreeing.
   ============================================================ */

/* Only somebody who runs convoys may run a convoy. Checked here rather than
   only where the button is drawn, because a button not being drawn has never
   stopped anybody. */
function convoyControlAllowed() {
  if (can('events.manage')) return true;
  toast('Convoy control is for managers', 'danger');
  return false;
}

function convoyStart(id) {
  if (!convoyControlAllowed()) return;
  const e = Store.event(id); if (!e) return;
  if (e.status === 'live') return toast('That convoy is already rolling', 'warn');
  if (e.status === 'completed' || e.status === 'cancelled') {
    return toast('That convoy is over', 'warn');
  }

  const parts = Convoy.participants(e);
  const connected = parts.filter((p) => p.connected).length;

  confirmDialog('Start ' + e.name + '?',
    parts.length
      ? connected + ' of ' + parts.length + ' registered driver'
        + (parts.length === 1 ? ' is' : 's are') + ' reporting from the game right now. '
        + 'Starting puts the convoy live for everyone.'
      : 'Nobody has registered yet. You can still start it — drivers can join a convoy that is already rolling.',
    () => {
      e.status = 'live';
      e.startedAt = new Date().toISOString();
      Convoy.ensureLeader(e);
      /* anyone still merely registered is now under way */
      (e.registered || []).forEach((r) => { if (r.state === 'registered') r.state = 'confirmed'; });

      Convoy.note(e, 'started', e.name + ' is rolling', state.user.id);
      Convoy.emit(e, 'convoy.started', e.name + ' is rolling — '
        + esc(e.start) + ' to ' + esc(e.dest), 'ok', { from: e.start, to: e.dest, km: e.distance });
      Convoy.notifyParticipants(e, {
        type: 'ok', icon: 'route', title: 'Convoy started',
        body: e.name + ' is rolling. Get to the departure point.',
        href: '#/convoy/' + e.id,
      });
      Store.logActivity(state.user.id, 'convoy', 'route', e.name + ' started');
      Store.save();
      toast('Convoy is live', 'ok', e.name);
      render();
    }, { yes: 'Start convoy' });
}

function convoyEnd(id) {
  if (!convoyControlAllowed()) return;
  const e = Store.event(id); if (!e) return;
  if (e.status !== 'live') return toast('That convoy is not running', 'warn');

  const s = Convoy.stats(e);
  confirmDialog('End ' + e.name + '?',
    'It has been running for ' + fmt.dur(s.durationMin || 0) + '. '
    + s.completed + ' of ' + s.joined + ' driver' + (s.joined === 1 ? '' : 's')
    + ' marked themselves complete. Ending it closes the convoy and files its record.',
    () => {
      e.status = 'completed';
      e.endedAt = new Date().toISOString();
      /* the figures are frozen at the moment it ends, because the live ones
         are read from a stream that will not remember this convoy tomorrow */
      e.stats = Convoy.stats(e);

      Convoy.note(e, 'ended', e.name + ' completed', state.user.id);
      Convoy.emit(e, 'convoy.ended',
        e.name + ' has finished — ' + e.stats.completed + ' of ' + e.stats.joined + ' completed',
        'ok', { km: e.distance });
      Convoy.notifyParticipants(e, {
        type: 'ok', icon: 'checkCircle', title: 'Convoy completed',
        body: e.name + ' has finished. Thanks for driving.',
        href: '#/convoy/' + e.id,
      });
      Store.logActivity(state.user.id, 'convoy', 'checkCircle', e.name + ' completed');
      Store.save();
      toast('Convoy completed', 'ok', e.name);
      render();
    }, { yes: 'End convoy' });
}

/* A driver taken off the convoy by a controller. Different from withdrawing:
   they did not choose it, so they are told. */
function convoyRemove(id, driverId) {
  if (!convoyControlAllowed()) return;
  const e = Store.event(id); if (!e) return;
  const d = Store.driver(driverId);
  const who = d ? d.name : driverId;
  if (driverId === e.leaderId) {
    return toast('Change the leader before removing them', 'warn',
      'A convoy cannot run without one.');
  }

  confirmDialog('Remove ' + who + '?',
    'They will be taken off ' + e.name + ' and told why. They can register again if there is a slot.',
    () => {
      e.registered = (e.registered || []).filter((r) => r.driverId !== driverId);
      Convoy.note(e, 'removed', who + ' was removed from the convoy', driverId);
      Convoy.emit(e, 'convoy.removed', who + ' was removed from ' + e.name, 'warn');
      Store.notify(driverId, {
        type: 'warn', icon: 'alert', title: 'Removed from a convoy',
        body: 'You have been taken off ' + e.name + ' by convoy control.',
        href: '#/convoy/' + e.id,
      });
      Store.save();
      toast(who + ' removed', 'warn', e.name);
      render();
    }, { danger: true, yes: 'Remove driver' });
}

/* ---------------- convoy chat ----------------
   Sent through the service so it arrives at everybody else instantly, and
   held there rather than on the company record — see the note on the
   service's convoy endpoints for why. */
const ConvoyChat = {
  messages: [],       /* for the convoy currently on screen, oldest first */
  convoyId: null,
  loading: false,
  error: null,
  olderCursor: null,  /* the id to ask for to go further back, or null */
  total: 0,
  loadingOlder: false,

  async open(convoyId) {
    if (this.convoyId === convoyId) return;
    this.convoyId = convoyId;
    this.messages = [];
    this.olderCursor = null;
    this.total = 0;
    this.error = null;
    await this.refresh();
  },

  /* the most recent page. A convoy with thousands of messages hands over
     fifty and a cursor, rather than everything ever said on it. */
  async refresh() {
    const base = Sync.url();
    if (!base) { this.error = 'no-service'; paintConvoyChat(); return; }
    if (!ServiceAuth.on()) { this.error = 'no-identity'; paintConvoyChat(); return; }
    if (!this.convoyId) return;

    this.loading = true;
    try {
      const res = await fetch(
        base + '/api/convoy/' + encodeURIComponent(this.convoyId) + '/chat',
        { cache: 'no-store', headers: ServiceAuth.headers() });
      if (res.status === 401) { this.error = 'no-identity'; ServiceAuth.status = 'rejected'; }
      else if (res.status === 403) { this.error = 'not-yours'; }
      else if (!res.ok) { throw new Error('HTTP ' + res.status); }
      else {
        const data = await res.json();
        this.messages = data.messages || [];
        this.olderCursor = data.olderCursor || null;
        this.total = data.total || this.messages.length;
        this.error = null;
      }
    } catch (err) {
      this.error = err.message;
    }
    this.loading = false;
    paintConvoyChat();
  },

  /* one page further back, keeping what is already on screen */
  async older() {
    const base = Sync.url();
    if (!base || !this.olderCursor || this.loadingOlder || !ServiceAuth.on()) return;
    this.loadingOlder = true;
    paintConvoyChat();
    try {
      const res = await fetch(
        base + '/api/convoy/' + encodeURIComponent(this.convoyId)
        + '/chat?before=' + encodeURIComponent(this.olderCursor),
        { cache: 'no-store', headers: ServiceAuth.headers() });
      if (res.ok) {
        const data = await res.json();
        this.messages = (data.messages || []).concat(this.messages);
        this.olderCursor = data.olderCursor || null;
      }
    } catch (err) { /* the button stays; they can try again */ }
    this.loadingOlder = false;
    paintConvoyChat();
  },

  /* a message that arrived down the live stream */
  receive(convoyId, msg) {
    if (convoyId !== this.convoyId) return;
    if (this.messages.some((m) => m.id === msg.id)) return;
    this.messages.push(msg);
    this.total++;
    paintConvoyChat();
  },

  /* one that was moderated away */
  removed(convoyId, msg) {
    if (convoyId !== this.convoyId) return;
    const i = this.messages.findIndex((m) => m.id === msg.id);
    if (i > -1) this.messages[i] = msg;
    paintConvoyChat();
  },

  /* The body no longer says who is speaking — the service works that out
     from the token, which is the whole point. */
  async send(convoyId, text) {
    const base = Sync.url();
    if (!base) { toast('Convoy chat needs the company service', 'warn'); return false; }
    if (!ServiceAuth.on()) {
      toast('Sign in again to use convoy chat', 'warn', ServiceAuth.reason() || '');
      return false;
    }
    try {
      const res = await fetch(base + '/api/convoy/message', {
        method: 'POST',
        headers: ServiceAuth.headers(),
        body: JSON.stringify({ convoyId, text }),
      });
      if (res.status === 401) {
        ServiceAuth.status = 'rejected';
        toast('Your session has expired', 'warn', 'Sign in again to keep talking.');
        paintConvoyChat();
        return false;
      }
      if (res.status === 403) {
        toast('You are not on this convoy', 'warn');
        return false;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return true;
    } catch (err) {
      toast('Message not sent', 'danger', err.message);
      return false;
    }
  },

  async remove(id) {
    const base = Sync.url();
    if (!base || !ServiceAuth.on()) return false;
    try {
      const res = await fetch(base + '/api/convoy/message/delete', {
        method: 'POST',
        headers: ServiceAuth.headers(),
        body: JSON.stringify({ id }),
      });
      if (res.status === 403) { toast('You cannot remove that message', 'warn'); return false; }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return true;
    } catch (err) {
      toast('Could not remove the message', 'danger', err.message);
      return false;
    }
  },
};

function convoySend(id) {
  const box = $('#convoyMsg');
  const text = box ? box.value.trim() : '';
  if (!text) return;
  box.value = '';
  ConvoyChat.send(id, text);
}

/* An announcement is a message that also reaches drivers who are not looking
   at the chat — which is the whole difference between the two. */
function convoyAnnounce(id) {
  if (!convoyControlAllowed()) return;
  const e = Store.event(id); if (!e) return;
  openModal({
    title: 'Announce to ' + e.name, size: 'narrow',
    body: `<p class="t2">This goes into the convoy chat and to every registered
        driver as a notification, so it reaches people who do not have the chat open.</p>
      <div class="field mt-12"><label for="cv-announce">Announcement</label>
        <textarea class="input" id="cv-announce" rows="3"
          placeholder="Departure delayed by 10 minutes — hold at the meeting point."></textarea></div>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="convoy-announce-send" data-id="${esc(e.id)}">
        ${icon('megaphone')}Send</button>`,
  });
}

async function convoyAnnounceSend(id) {
  const e = Store.event(id); if (!e) return;
  const el = $('#cv-announce');
  const text = el ? el.value.trim() : '';
  if (!text) return toast('Write the announcement first', 'warn');

  await ConvoyChat.send(id, text);
  Convoy.note(e, 'announcement', 'Control: ' + text, state.user.id);
  Convoy.notifyParticipants(e, {
    type: 'info', icon: 'megaphone', title: 'Convoy announcement',
    body: text, href: '#/convoy/' + e.id,
  });
  Store.save();
  closeModal();
  toast('Announcement sent', 'ok', e.registered.length + ' driver(s) notified');
  render();
}


function evRegister(id) {
  const e = Store.event(id); if (!e) return;
  if (e.status === 'cancelled') return toast('That convoy has been cancelled', 'warn');
  if (e.status === 'completed') return toast('That convoy is over', 'warn');
  if (e.registered.length >= e.maxSlots) return toast('Convoy is full', 'warn');
  if (Store.registrationOf(e, state.user.id)) return;
  /* joining a convoy already rolling puts the driver straight in as confirmed —
     there is nothing left to confirm once it has left */
  const rolling = e.status === 'live';
  e.registered.push({ driverId: state.user.id, state: rolling ? 'confirmed' : 'registered' });
  Convoy.note(e, 'joined', state.user.name + ' joined the convoy', state.user.id);
  Store.notify(state.user.id, { type: 'ok', icon: 'route', title: 'Registered for ' + e.name, body: fmt.dt(e.date) });
  Store.logActivity(state.user.id, 'convoy', 'route', `${state.user.name} registered for ${e.name}`);

  /* the controller sees them appear without refreshing */
  Convoy.emit(e, 'convoy.joined',
    state.user.name + ' joined ' + e.name, 'ok', { to: e.name });
  Convoy.notifyParticipants(e, {
    type: 'info', icon: 'userPlus', title: 'Driver joined the convoy',
    body: state.user.name + ' joined ' + e.name + '.', href: '#/convoy/' + e.id,
  }, state.user.id);

  Store.save();
  toast('Registered', 'ok', `${e.name} · ${fmt.dt(e.date)}`);
  render();
}
function evConfirm(id) {
  const e = Store.event(id); if (!e) return;
  const r = Store.registrationOf(e, state.user.id); if (!r) return;
  r.state = 'confirmed';
  Convoy.touch(e);
  Store.notify(state.user.id, { type: 'ok', icon: 'checkCircle', title: 'Attendance confirmed', body: e.name });
  Store.save();
  toast('Attendance confirmed', 'ok', 'See you at the meeting point.');
  render();
}
function evWithdraw(id) {
  const e = Store.event(id); if (!e) return;
  confirmDialog('Withdraw from convoy?',
    `You will lose your slot on ${e.name}. Withdrawing repeatedly affects your attendance record.`,
    () => {
      e.registered = e.registered.filter((r) => r.driverId !== state.user.id);
      Convoy.note(e, 'left', state.user.name + ' left the convoy', state.user.id);
      Convoy.emit(e, 'convoy.left', state.user.name + ' left ' + e.name, 'warn', { to: e.name });
      Convoy.notifyParticipants(e, {
        type: 'info', icon: 'x', title: 'Driver left the convoy',
        body: state.user.name + ' left ' + e.name + '.', href: '#/convoy/' + e.id,
      }, state.user.id);
      Store.save(); toast('Withdrawn from convoy', 'warn', e.name); render();
    }, { danger: true, yes: 'Withdraw' });
}
function evComplete(id) {
  const e = Store.event(id); if (!e) return;
  const r = Store.registrationOf(e, state.user.id); if (!r) return;
  r.state = 'completed';
  Convoy.touch(e);
  const u = state.user;
  u.convoys += 1;
  u.km += e.distance;
  u.deliveries += 1;
  u.weekKm += e.distance;
  u.attendance = Math.round(clamp(u.attendance + 1, 0, 100));

  const before = u.rankIdx;
  const nowRank = earnedRank(u);
  let promoted = false;
  if (nowRank.i > before) { u.rankIdx = nowRank.i; promoted = true; }

  const newAch = ACHIEVEMENTS.filter((a) => achEarned(a, u) && !u.achievements.includes(a.id));
  newAch.forEach((a) => {
    u.achievements.push(a.id);
    Store.notify(u.id, { type: 'ok', icon: 'trophy', title: 'Achievement unlocked', body: a.name });
  });

  Store.logActivity(u.id, 'convoy', 'truck', `${u.name} completed ${e.name}`, fmt.km(e.distance));
  if (promoted) Store.notify(u.id, { type: 'ok', icon: 'medal', title: 'Promotion', body: 'You have been promoted to ' + nowRank.name });
  Store.save();

  toast('Convoy completed', 'ok', `${fmt.km(e.distance)} added to your record`);
  if (promoted) setTimeout(() => toast('Promoted to ' + nowRank.name, 'ok', 'Congratulations, driver.'), 700);
  newAch.forEach((a, i) => setTimeout(() => toast('Achievement unlocked', 'ok', a.name), 1300 + i * 500));
  render();
}

/* ---------------- 32. Global interaction handler ---------------- */
function handleAction(act, t, ev) {
  const id = t.dataset.id, v = t.dataset.v;
  const u = state.user;

  switch (act) {
    /* navigation */
    case 'go': go(t.dataset.href); closeAllLayers(); return;
    case 'open-sidebar': $('#sidebar').classList.add('open'); return;
    case 'close-sidebar': $('#sidebar').classList.remove('open'); return;
    case 'user-menu': userMenu(t); return;
    case 'noop': return;

    /* messages */
    case 'dm-open':
      Messages.open(id).then(() => paintMessages());
      return;
    case 'dm-attach': {
      const picker = document.getElementById('dmFile');
      if (picker) picker.click();
      return;
    }
    case 'dm-delete':
      Messages.remove(id);
      return;
    case 'dm-call':
      Calls.start(id, dmNameFor(id), false);
      return;
    case 'dm-video':
      Calls.start(id, dmNameFor(id), true);
      return;

    /* calls */
    case 'call-accept': Calls.accept(); return;
    case 'call-decline': Calls.decline(); return;
    case 'call-hangup': Calls.hangUp(); return;
    case 'call-mute': Calls.toggleMute(); return;

    /* auth */
    case 'auth-mode':
      state.ui.authMode = t.dataset.v;
      $('#app').innerHTML = viewAuth();
      bindAuth();
      return;
    case 'forgot':
      openForgotPasswordModal();
      return;
    case 'logout':
      signOutEverywhere(); closeAllLayers();
      $('#app').innerHTML = viewAuth(); bindAuth(); return;
    case 'switch-account':
      signOutEverywhere(); closeAllLayers();
      $('#app').innerHTML = viewAuth(); bindAuth(); return;

    /* drivers */
    case 'dv-view': state.ui.driverView = v; render(); return;
    case 'profile-tab': state.ui.profileTab = t.dataset.tab; render(); return;

    /* fleet */
    case 'fleet-tab': state.ui.fleetTab = t.dataset.tab; render(); return;
    case 'fleet-status': state.ui.fleetStatus = v; render(); return;
    case 'fleet-add': openFleetEditor(null); return;
    case 'fleet-edit': openFleetEditor(id); return;
    case 'fleet-assign': openAssignDriver(id); return;
    case 'fleet-save': saveFleet(id); return;
    case 'assign-save': saveAssignment(id); return;

    /* convoys / events */
    case 'convoy-tab': state.ui.convoyTab = t.dataset.tab; render(); return;
    case 'ev-register': evRegister(id); return;
    case 'ev-confirm': evConfirm(id); return;
    case 'ev-withdraw': evWithdraw(id); return;
    case 'ev-complete': evComplete(id); return;
    case 'convoy-start': convoyStart(id); return;
    case 'convoy-end': convoyEnd(id); return;
    case 'convoy-remove': convoyRemove(id, t.dataset.driver); return;
    case 'convoy-announce': convoyAnnounce(id); return;
    case 'convoy-older': ConvoyChat.older(); return;
    case 'convoy-msg-delete':
      confirmDialog('Remove this message?',
        'It stays in the conversation as a removed message rather than vanishing.',
        () => { ConvoyChat.remove(t.dataset.id); },
        { danger: true, yes: 'Remove' });
      return;
    case 'convoy-announce-send': convoyAnnounceSend(id); return;
    case 'event-create': openEventEditor(null); return;
    case 'event-edit': openEventEditor(id); return;
    case 'event-save': saveEvent(id); return;
    case 'event-cancel':
      confirmDialog('Cancel this event?', 'Registered drivers will be notified that the event is cancelled.', () => {
        const e = Store.event(id); if (!e) return;
        e.status = 'cancelled'; Convoy.touch(e);
        Convoy.note(e, 'cancelled', e.name + ' was cancelled', state.user.id);
        Convoy.emit(e, 'convoy.updated', e.name + ' was cancelled', 'warn');
        Convoy.notifyParticipants(e, { type: 'warn', icon: 'x', title: 'Convoy cancelled',
          body: e.name + ' has been called off.', href: '#/convoy/' + e.id });
        Store.save(); toast('Event cancelled', 'warn', e.name); render();
      }, { danger: true, yes: 'Cancel event' });
      return;

    /* calendar */
    case 'cal-prev': {
      let m = state.ui.calMonth - 1, y = state.ui.calYear;
      if (m < 0) { m = 11; y--; } state.ui.calMonth = m; state.ui.calYear = y; render(); return;
    }
    case 'cal-next': {
      let m = state.ui.calMonth + 1, y = state.ui.calYear;
      if (m > 11) { m = 0; y++; } state.ui.calMonth = m; state.ui.calYear = y; render(); return;
    }
    case 'cal-today': {
      const n = new Date(); state.ui.calMonth = n.getMonth(); state.ui.calYear = n.getFullYear(); render(); return;
    }
    case 'cal-day': {
      const day = +t.dataset.day;
      const evs = Store.db.events.filter((e) => {
        const d = new Date(e.date);
        return d.getDate() === day && d.getMonth() === state.ui.calMonth && d.getFullYear() === state.ui.calYear;
      });
      openModal({
        title: fmt.date(new Date(state.ui.calYear, state.ui.calMonth, day).toISOString()),
        sub: `${evs.length} event${evs.length === 1 ? '' : 's'} scheduled`,
        body: `<div class="col gap-12">${evs.map((e) => `
          <div class="row-b gap-12" data-act="go" data-href="#/convoy/${e.id}" style="cursor:pointer;padding:10px;border-radius:12px;border:1px solid var(--line)">
            <div style="min-width:0"><div class="row gap-8 mb-4"><span class="badge ${e.tone}">${esc(e.typeLabel)}</span>
              <span class="badge">${esc(fmt.time(e.date))}</span></div>
              <div class="b6">${esc(e.name)}</div>
              <div class="xs t3">${esc(e.start)} → ${esc(e.dest)}</div></div>
            ${icon('chevron', 'chev')}</div>`).join('')}</div>`,
      });
      return;
    }

    /* rankings & achievements */
    case 'lb-period': state.ui.lbPeriod = v; render(); return;
    case 'lb-metric': state.ui.lbMetric = v; render(); return;
    case 'ach-filter': state.ui.achFilter = v; render(); return;

    /* recruitment */
    case 'app-open': openApplication(id); return;
    case 'site-admin': goSite('admin'); return;
    case 'site-drivers': goSite('drivers'); return;
    case 'service-retry':
      toast('Checking the company service…', 'info');
      Sync.pull().then(() => {
        toast(Sync.status === 'ok' ? 'Company service is answering' : 'Still not answering',
          Sync.status === 'ok' ? 'ok' : 'danger', Sync.status === 'ok' ? '' : (Sync.lastError || ''));
        render();
      });
      return;
    case 'service-notice-hide':
      state.ui.serviceNoticeHidden = true; render(); return;
    case 'app-reply': replyToApplicant(id); return;
    case 'app-note-save': saveRecruiterNote(id); return;
    case 'app-edit': openApplicationEditor(id); return;
    case 'app-update': saveApplicationDetails(id); return;
    case 'app-message': openApplicationMessage(id); return;
    case 'app-message-send': sendApplicationMessage(id); return;
    case 'app-approve': approveApplication(id); return;
    case 'app-reject': setAppStage(id, 'rejected'); return;
    case 'app-stage': setAppStage(id, t.dataset.stage); return;

    /* community / content */
    case 'discord-connect': openDiscordHandle('discord'); return;
    case 'conn-edit': openDiscordHandle(id); return;
    case 'conn-clear': setConnection(id, ''); return;
    case 'discord-save': saveDiscordHandle(); return;

    case 'request-deletion':
      confirmDialog('Request account deletion?',
        'This raises a request with management. Your record stays until somebody acts on it, '
        + 'and they will be in touch through your support ticket.',
        () => {
          const now = new Date().toISOString();
          const t = {
            id: 'TCK-' + randI(5100, 5999), subject: 'Account deletion requested',
            category: 'Account', priority: 'high', status: 'open', driverId: state.user.id,
            created: now, updated: now,
            messages: [{ from: state.user.id, at: now,
              body: state.user.name + ' has asked for their Heavyline account to be deleted.' }],
          };
          Store.db.tickets.unshift(t);
          notifyStaff('admin.view', {
            type: 'warn', icon: 'alert', title: 'Account deletion requested',
            body: state.user.name + ' has asked to be removed from Heavyline.',
            href: '#/ticket/' + t.id,
          }, state.user.id);
          Store.save();
          toast('Request raised', 'ok', 'Management will be in touch');
          go('#/ticket/' + t.id); render();
        }, { danger: true, yes: 'Raise the request' });
      return;
    case 'ann-create': openAnnouncementEditor(null); return;
    case 'ann-edit': openAnnouncementEditor(id); return;
    case 'ann-save': saveAnnouncement(id); return;
    case 'ann-pin': {
      const a = byId(Store.db.announcements, id); if (!a) return;
      a.pinned = !a.pinned; Store.save(); toast(a.pinned ? 'Pinned' : 'Unpinned', 'ok', a.title); render(); return;
    }
    case 'ann-delete':
      confirmDialog('Delete announcement?', 'This removes it from the community page for everyone.', () => {
        Store.db.announcements = Store.db.announcements.filter((a) => a.id !== id);
        Store.save(); toast('Announcement deleted', 'warn'); render();
      }, { danger: true, yes: 'Delete' });
      return;

    /* support */
    case 'support-filter': state.ui.supportFilter = v; render(); return;
    case 'ticket-new': openTicketModal(); return;
    case 'ticket-save': saveTicket(); return;
    case 'ticket-resolve': case 'ticket-progress': {
      const tk = Store.ticket(id); if (!tk) return;
      tk.status = act === 'ticket-resolve' ? 'resolved' : 'in_progress';
      tk.updated = new Date().toISOString();
      /* the driver who raised it is the one waiting to hear */
      if (tk.driverId !== state.user.id) {
        Store.notify(tk.driverId, {
          type: act === 'ticket-resolve' ? 'ok' : 'info', icon: 'lifeBuoy',
          title: act === 'ticket-resolve' ? 'Support request resolved' : 'Support request picked up',
          body: tk.id + ' · ' + tk.subject,
          href: '#/ticket/' + tk.id,
        });
      }
      Store.save();
      toast('Ticket updated', 'ok', statusLabel(tk.status) || tk.status); render(); return;
    }

    /* notifications */
    case 'notif-drawer': notifDrawer(); return;
    case 'notif-open': {
      const n = Store.db.notifications.find((x) => x.id === id);
      if (n) { n.read = true; Store.save(); }
      closeAllLayers(); render(); return;
    }
    case 'notif-read-all':
      Store.db.notifications.forEach((n) => { n.read = true; });
      Store.save(); closeAllLayers(); toast('All notifications marked read', 'ok'); render(); return;

    /* settings */
    case 'pref-toggle': {
      const k = t.dataset.k;
      u.prefs = u.prefs || {};
      u.prefs[k] = !u.prefs[k];
      t.classList.toggle('on', !!u.prefs[k]);
      t.setAttribute('aria-checked', String(!!u.prefs[k]));
      Store.save(); return;
    }
    case 'password-change': changePassword(); return;
    case 'export-data': exportData(); return;
    case 'copy-error': {
      const text = t.dataset.detail || '';
      if (navigator.clipboard) navigator.clipboard.writeText(text).catch(() => {});
      toast('Copied', 'ok', 'Paste it to whoever maintains Heavyline');
      return;
    }
    case 'map-game':
      LiveMap.game = t.dataset.v === 'ats' ? 'ats' : 'ets2';
      LiveMap.destroy(); render();
      return;
    case 'map-service': openFleetService(); return;
    case 'verify-job': openJobVerification(t.dataset.id); return;
    case 'driver-live': openDriverLive(t.dataset.id); return;
    case 'ops-view':
      state.ui.opsView = t.dataset.v; render(); return;
    case 'fleet-service-save': saveFleetService(); return;
    case 'reset-demo':
      if (!can('roles.manage')) { toast('Only the company owner can do that', 'danger'); return; }
      confirmDialog('Erase the whole company?',
        'Every driver, vehicle, convoy, application and registered login stored in this browser '
        + 'is removed. The owner account is put back so you can still get in. This cannot be undone.',
        () => {
          Store.reset();
          /* an erase that left no administrator would lock the company out */
          provisionOwner();
          state.user = null;
          state.ui.authMode = 'signin';
          closeAllLayers();
          toast('Heavyline data erased', 'ok', 'Sign back in as the owner');
          go('#/auth'); render();
        },
        { danger: true, yes: 'Erase everything' });
      return;

    /* admin */
    case 'admin-tab': state.ui.adminTab = t.dataset.tab; render(); return;
    case 'dispatch-new': openDispatch(t.dataset.id || ''); return;
    case 'dispatch-save': saveDispatch(); return;
    case 'assignment-state': setAssignmentState(t.dataset.id, t.dataset.v); return;
    case 'admin-add-driver': openAddDriver(); return;
    case 'add-driver-save': saveNewDriver(); return;
    case 'admin-edit-driver': openDriverEditor(id); return;
    case 'driver-save': saveDriverAdmin(id); return;
    case 'admin-suspend': {
      const d = Store.driver(id); if (!d) return;
      const susp = d.accountStatus !== 'suspended';
      confirmDialog(susp ? 'Suspend driver?' : 'Reinstate driver?',
        susp ? `${d.name} will lose access to the HLL platform until reinstated.` : `${d.name} regains full access.`,
        () => { d.accountStatus = susp ? 'suspended' : 'active'; Store.save();
                toast(susp ? 'Driver suspended' : 'Driver reinstated', susp ? 'warn' : 'ok', d.name); render(); },
        { danger: susp, yes: susp ? 'Suspend' : 'Reinstate' });
      return;
    }

    /* dashboard */
    case 'dash-fleet-toggle': {
      const host = $('#mileageChart'); if (!host) return;
      const showFleet = !host.dataset.showing || host.dataset.showing === 'mine';
      const vals = JSON.parse(showFleet ? host.dataset.fleet : host.dataset.mine);
      host.dataset.showing = showFleet ? 'fleet' : 'mine';
      $$('.seg button', host.closest('.card')).forEach((b, i) =>
        b.classList.toggle('on', showFleet ? i === 1 : i === 0));
      const labels = Array.from({ length: 12 }, (_, i) => 'W' + (i + 1));
      host.querySelector('svg').outerHTML = areaChart(
        [{ name: showFleet ? 'Fleet distance' : 'Your distance', values: vals, color: showFleet ? '#4aa3f0' : '#4f7fff' }],
        labels, { fmtY: (x) => Math.round(x / 100) / 10 + 'k', fmtT: fmt.km });
      return;
    }

    /* modal */
    case 'modal-close': closeModal(); return;
  }
}

function closeAllLayers() {
  $$('.menu').forEach((m) => m.remove());
  $$('.drawer,.scrim').forEach((m) => m.remove());
  while (modalStack.length) closeModal();
  document.body.style.overflow = '';
  const sb = $('#sidebar'); if (sb) sb.classList.remove('open');
}

/* ---------------- 33. Persistence actions ---------------- */
function saveEvent(id) {
  const g = (s) => $('#' + s)?.value.trim() || '';
  const name = g('ev-name'); if (!name) return toast('Name is required', 'warn');
  const via = g('ev-via').split(',').map((s) => s.trim()).filter((s) => CITIES[s]);
  const start = g('ev-start'), dest = g('ev-dest');
  const type = g('ev-type');
  const isDrive = type === 'convoy' || type === 'community';
  const path = isDrive ? [start, ...via, dest] : [];
  const dist = isDrive ? routeDistance(path) : 0;
  const labels = { convoy: 'Official Convoy', community: 'Community Convoy', meeting: 'Driver Meeting', training: 'Training Session', recruitment: 'Recruitment Event' };
  const tones = { convoy: '', community: 'info', meeting: 'violet', training: 'ok', recruitment: 'info' };
  const when = new Date(g('ev-date') || Date.now() + 7 * DAY);

  let e = id ? Store.event(id) : null;
  if (!e) {
    e = { id: 'EV-' + randI(4000, 8999), registered: [], status: 'scheduled', instructions: [
      'Arrive at the meeting point at least 30 minutes before departure.',
      'Full HLL livery is required. Trailer must be attached before the briefing.',
      'Hold a minimum 60 m gap. No overtaking inside the convoy.',
      'Follow convoy control on Discord voice at all times.'] };
    Store.db.events.push(e);
  }
  Object.assign(e, {
    name, type, typeLabel: labels[type], tone: tones[type],
    start: isDrive ? start : 'HLL HQ — Rotterdam', dest: isDrive ? dest : 'HLL HQ — Rotterdam',
    path, distance: dist, duration: isDrive ? Math.round(dist / 65 * 60) : 60,
    date: when.toISOString(), meetTime: new Date(when.getTime() - 30 * 60000).toISOString(),
    maxSlots: +($('#ev-slots')?.value || 30), leaderId: g('ev-leader'),
    server: g('ev-server'), dlc: e.dlc || 'Base map',
    meetPoint: isDrive ? `${start} — Company HQ car park` : 'Discord · Briefing Room',
    departPoint: isDrive ? `${start} — City exit, north gate` : '—',
    description: g('ev-desc') || `A Heavyline event from ${start} to ${dest}.`,
  });
  Convoy.ensureLeader(e);
  Convoy.touch(e);
  Convoy.emit(e, id ? 'convoy.updated' : 'convoy.created',
    (id ? 'Convoy updated: ' : 'New convoy: ') + name, 'info');
  if (id) Convoy.notifyParticipants(e, { type: 'info', icon: 'route',
    title: 'Convoy updated', body: name + ' has been changed.', href: '#/convoy/' + e.id });
  Store.save(); closeModal();
  toast(id ? 'Event updated' : 'Event created', 'ok', name);
  go('#/convoy/' + e.id); render();
}

function saveFleet(id) {
  const g = (s) => $('#' + s)?.value.trim() || '';
  const model = g('fl-model'); if (!model) return toast('Model is required', 'warn');
  let t = id ? Store.truck(id) : null;
  if (!t) {
    t = { id: 'HLT-' + randI(300, 899), mileage: 0, assignedTo: null,
          lastService: new Date().toISOString(), nextService: new Date(Date.now() + 90 * DAY).toISOString(),
          cab: 'Standard', gearbox: '12-speed automated', notes: '' };
    Store.db.trucks.push(t);
  }
  Object.assign(t, {
    make: g('fl-make'), model, hp: +($('#fl-hp')?.value || 500), chassis: g('fl-chassis'),
    plate: g('fl-plate') || 'HLL ' + randI(100, 999) + 'X', year: +($('#fl-year')?.value || 2026),
    livery: g('fl-livery'), status: g('fl-status'),
    mileage: Math.max(0, +($('#fl-mileage')?.value || 0)),
  });
  const svc = $('#fl-servicekm')?.value;
  t.serviceKm = svc === '' || svc == null ? null : Math.max(0, +svc);
  t.unit = 'Unit ' + t.id.split('-')[1];
  Store.save(); closeModal();
  toast(id ? 'Vehicle updated' : 'Vehicle added', 'ok', `${t.make} ${t.model}`);
  render();
}

function saveAssignment(truckId) {
  const t = Store.truck(truckId); if (!t) return;
  const newDriverId = $('#as-driver')?.value || '';
  if (t.assignedTo) { const old = Store.driver(t.assignedTo); if (old) old.truckId = null; }
  if (newDriverId) {
    const d = Store.driver(newDriverId);
    if (d) {
      if (d.truckId) { const prev = Store.truck(d.truckId); if (prev) prev.assignedTo = null; }
      d.truckId = t.id; t.assignedTo = d.id;
      if (t.status === 'available') t.status = 'active';
      Store.notify(d.id, { type: 'ok', icon: 'truck', title: 'Vehicle assigned', body: `${t.make} ${t.model} (${t.id})` });
    }
  } else { t.assignedTo = null; }
  Store.save(); closeModal(); toast('Assignment updated', 'ok'); render();
}

function saveDriverAdmin(id) {
  const d = Store.driver(id); if (!d) return;
  const newRank = +($('#dm-rank')?.value ?? d.rankIdx);
  const promoted = newRank > d.rankIdx;
  d.rankIdx = newRank;
  if (can('roles.manage')) d.role = $('#dm-role')?.value || d.role;
  d.accountStatus = $('#dm-status')?.value || d.accountStatus;

  const truckId = $('#dm-truck')?.value || '';
  if (d.truckId !== truckId) {
    if (d.truckId) { const prev = Store.truck(d.truckId); if (prev) prev.assignedTo = null; }
    if (truckId) { const nt = Store.truck(truckId);
      if (nt) { if (nt.assignedTo) { const other = Store.driver(nt.assignedTo); if (other) other.truckId = null; }
        nt.assignedTo = d.id; } }
    d.truckId = truckId || null;
  }
  const hadClient = !!d.clientAccess;
  d.clientAccess = ($('#dm-client')?.value || (hadClient ? 'yes' : 'no')) === 'yes';
  if (!hadClient && d.clientAccess) {
    Store.notify(d.id, {
      type: 'ok', icon: 'download', title: 'Heavyline Trucker released',
      body: 'The client is ready for you to download.', href: '#/downloads',
    });
  }

  if (promoted) Store.notify(d.id, { type: 'ok', icon: 'medal', title: 'Promotion', body: 'You have been promoted to ' + RANKS[newRank].name });
  Store.save(); closeModal(); toast('Driver updated', 'ok', d.name); render();
}

/* a readable one-off password for an account somebody else will use first */
function tempPassword() {
  const words = ['convoy', 'haulage', 'freight', 'cargo', 'motorway', 'trailer', 'depot', 'diesel'];
  return pick(words) + '-' + pick(words) + '-' + randI(100, 999);
}

async function saveNewDriver() {
  const name = $('#nd-name')?.value.trim();
  const email = $('#nd-email')?.value.trim() || '';
  const pw = $('#nd-pw')?.value || '';
  if (!name) return toast('Driver name is required', 'warn');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return toast('A valid email address is required', 'warn');
  if (pw.length < 8) return toast('The temporary password needs 8 characters or more', 'warn');

  const role = $('#nd-role')?.value || 'driver';
  const d = {
    id: Accounts.nextDriverId(), name, initials: initials(name),
    country: $('#nd-country')?.value || 'Not set', joined: new Date().toISOString(),
    status: 'offline', km: 0, deliveries: 0, convoys: 0, attendance: 100,
    role: can('roles.manage') ? role : 'driver',
    accountStatus: 'active', discord: $('#nd-discord')?.value || '',
    truckersmp: '', truckId: null, trailerId: null,
    bio: '', achievements: [], rankIdx: +($('#nd-rank')?.value || 0),
    weekKm: 0, monthKm: 0, seasonPoints: 0, lastSeen: new Date().toISOString(),
    email,
  };

  /* the login is created first — a driver record nobody can sign in to is
     worse than no record at all */
  const res = await Accounts.createForDriver(d, email, pw);
  if (res.error) return toast(res.error, 'danger');

  Store.db.drivers.push(d);
  Store.logActivity(d.id, 'join', 'userPlus', `${d.name} joined Heavyline Logistics`);
  Store.save(); closeModal();
  toast('Driver created', 'ok', `${d.name} · ${d.id}`);
  /* the password is hashed on the way in, so this is the only time it can be shown */
  openModal({
    title: 'Login created for ' + d.name, size: 'narrow',
    body: `<p class="t2">Pass these details on now — the password is stored hashed
        and cannot be read back.</p>
      <div class="card mt-16"><div class="card-body col gap-10">
        ${kv('Signs in with', esc(email))}
        ${kv('or Driver ID', esc(d.id))}
        ${kv('Temporary password', '<span class="mono">' + esc(pw) + '</span>')}
      </div></div>
      <p class="xs t3 mt-12">Ask them to change it from Settings once they are in.</p>`,
    foot: `<button class="btn btn-primary" data-act="modal-close">${icon('check')}Done</button>`,
  });
  go('#/driver/' + d.id); render();
}

function saveAnnouncement(id) {
  const title = $('#an-title')?.value.trim(), body = $('#an-body')?.value.trim();
  if (!title || !body) return toast('Title and message are required', 'warn');
  let a = id ? byId(Store.db.announcements, id) : null;
  if (!a) { a = { id: 'ANN-' + randI(7100, 7999), date: new Date().toISOString(), author: state.user.id };
    Store.db.announcements.unshift(a); }
  Object.assign(a, { title, body, tag: $('#an-tag')?.value || 'Company', pinned: !!$('#an-pin')?.checked });
  if (a.pinned) Store.db.announcements.forEach((x) => { if (x.id !== a.id) x.pinned = false; });
  /* broadcast: driverId null is delivered to everyone by notificationsFor(),
     instead of writing one row per driver on every publish */
  Store.notify(null, { type: 'info', icon: 'megaphone', title: 'New announcement', body: title });
  Store.save(); closeModal(); toast(id ? 'Announcement updated' : 'Announcement published', 'ok', title); render();
}

function saveTicket() {
  const subject = $('#tk-sub')?.value.trim(), body = $('#tk-body')?.value.trim();
  if (!subject || !body) return toast('Subject and details are required', 'warn');
  const now = new Date().toISOString();
  const t = {
    id: 'TCK-' + randI(5100, 5999), subject, category: $('#tk-cat')?.value || 'Technical issue',
    priority: $('#tk-pri')?.value || 'normal', status: 'open', driverId: state.user.id,
    created: now, updated: now, messages: [{ from: state.user.id, at: now, body }],
  };
  Store.db.tickets.unshift(t);
  Store.notify(state.user.id, { type: 'info', icon: 'ticket', title: 'Support request raised', body: t.id + ' · ' + subject });
  /* and the people who have to answer it */
  notifyStaff('admin.view', {
    type: 'warn', icon: 'lifeBuoy',
    title: 'New support request',
    body: state.user.name + ' — ' + subject,
    href: '#/ticket/' + t.id,
  }, state.user.id);
  Store.logActivity(state.user.id, 'support', 'lifeBuoy',
    state.user.name + ' raised ' + t.id, subject, true);
  Store.save(); closeModal(); toast('Request submitted', 'ok', t.id);
  go('#/ticket/' + t.id); render();
}

const STAGE_NEWS = {
  review: ['info', 'Your application is being reviewed', 'A recruiter has picked it up and is looking at it now.'],
  interview: ['ok', 'You have reached the interview stage', 'Recruitment will be in touch to arrange a voice chat and an assessment drive.'],
  rejected: ['warn', 'Your application was not successful', 'You are welcome to apply again after 30 days.'],
};

function setAppStage(id, stage) {
  const a = Store.application(id); if (!a) return;
  a.status = stage;
  a.updated = new Date().toISOString();
  saveRecruiterNote(a, { silent: true });

  /* the shared table hears about it now, not on the next company push */
  Applications.setStatus(a, stage);

  /* the applicant is the one waiting to hear — tell them */
  const news = STAGE_NEWS[stage];
  if (news && a.submittedBy && a.submittedBy !== state.user.id) {
    Store.notify(a.submittedBy, {
      type: news[0], icon: 'userPlus', title: news[1], body: news[2], href: '#/recruitment',
    });
  }
  Store.save(); closeModal();
  toast('Application updated', stage === 'rejected' ? 'warn' : 'ok', `${a.name} · ${statusLabel(stage)}`);
  render();
}

/* The internal note box used to be read by nothing at all. It is saved with
   whatever action the recruiter takes, and on its own from the Add note button. */
function saveRecruiterNote(app, opts = {}) {
  const a = typeof app === 'string' ? Store.application(app) : app;
  if (!a || !can('recruitment.manage')) return false;
  const el = $('#app-note');
  const text = el ? el.value.trim() : '';
  if (!text) {
    if (!opts.silent) toast('Write the note first', 'warn');
    return false;
  }
  a.notes = a.notes || [];
  a.notes.push({ text, by: state.user.id, at: new Date().toISOString() });
  if (el) el.value = '';
  if (!opts.silent) {
    Store.save();
    toast('Note added', 'ok', a.id);
    openApplication(a.id);
  }
  return true;
}

/* A reply the applicant actually receives, on the application itself. */
function replyToApplicant(id) {
  const a = Store.application(id); if (!a) return;
  if (!can('recruitment.manage')) { toast('Recruiters only', 'danger'); return; }
  const el = $('#app-reply');
  const text = el ? el.value.trim() : '';
  if (!text) { toast('Write the reply first', 'warn'); return; }
  a.messages = a.messages || [];
  a.messages.push({ from: 'staff', text, by: state.user.id, at: new Date().toISOString() });
  a.updated = new Date().toISOString();
  if (a.submittedBy) {
    Store.notify(a.submittedBy, {
      type: 'info', icon: 'mail',
      title: 'Recruitment replied to your application',
      body: text.length > 90 ? text.slice(0, 90) + '…' : text,
      href: '#/recruitment',
    });
  }
  Store.save();
  toast('Reply sent', 'ok', a.name);
  openApplication(a.id);
  render();
}

function approveApplication(id) {
  const a = Store.application(id); if (!a) return;
  /* Somebody who registered themselves already has a driver record — the
     application names it. Making a second one here would leave them with two
     rows on the roster and a login pointing at only one of them. */
  const existing = a.submittedBy ? Store.driver(a.submittedBy) : null;

  confirmDialog('Approve application?',
    existing
      ? `${a.name} joins the roster as ${existing.id}, and the Heavyline Trucker download is released to them.`
      : `${a.name} will be added to the roster with a new HLL Driver ID, and the Heavyline Trucker download released to them.`,
    () => {
      a.status = 'approved';
      a.decidedAt = new Date().toISOString();
      Applications.setStatus(a, 'approved');

      let d = existing;
      if (!d) {
        d = {
          id: Accounts.nextDriverId(), name: a.name, initials: initials(a.name),
          country: a.country, joined: new Date().toISOString(), status: 'offline',
          km: 0, deliveries: 0, convoys: 0, attendance: 100, role: 'driver', accountStatus: 'active',
          discord: a.discord, truckersmp: a.truckersmp, truckId: null, trailerId: null,
          bio: '', achievements: [], rankIdx: 0, weekKm: 0, monthKm: 0, seasonPoints: 0,
          lastSeen: new Date().toISOString(),
        };
        Store.db.drivers.push(d);
      }
      Store.logActivity(d.id, 'join', 'userPlus', `${d.name} joined Heavyline Logistics`);

      d.clientAccess = true;
      Store.notify(d.id, {
        type: 'ok', icon: 'download',
        title: 'Welcome to Heavyline',
        body: 'Your application is approved. The Heavyline Trucker client is ready to download.',
        href: '#/downloads',
      });

      Store.save(); closeModal();
      toast('Application approved', 'ok', `${d.name} is ${d.id} — download released`);
      render();
    }, { yes: 'Approve' });
}




/* ---------------- medals ----------------
   First, second and third get a medal; everyone below carries on as a plain
   number, so the order reads as one chain rather than two lists. */
const MEDALS = [
  { key: 'gold',   name: 'Gold',   face: '#f6cf5c', edge: '#c9962a', ribbon: '#c0392b', text: '#5a4108' },
  { key: 'silver', name: 'Silver', face: '#dfe6ef', edge: '#9aa8ba', ribbon: '#41597a', text: '#414c5c' },
  { key: 'bronze', name: 'Bronze', face: '#e3a56b', edge: '#a86a33', ribbon: '#2f6f4f', text: '#4d2c0c' },
];

function medal(place, size = 34) {
  const m = MEDALS[place - 1];
  if (!m) return `<span class="rank-num">${place}</span>`;
  const id = 'm' + place + Math.random().toString(36).slice(2, 6);
  return `<span class="medal ${m.key}" title="${esc(m.name)} — ${place}${ordinal(place)} place" aria-label="${place}${ordinal(place)} place">
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
    </svg>
  </span>`;
}

const ordinal = (n) => (n % 100 >= 11 && n % 100 <= 13) ? 'th'
  : ['th', 'st', 'nd', 'rd'][n % 10] || 'th';


/* ============================================================
   ONE COMPANY, NOT ONE PER BROWSER
   ------------------------------------------------------------
   Without this, everything lives in the browser it was typed into:
   somebody signs up on their laptop and the administrator on theirs
   never sees them, because there is nothing joining the two.

   Point both at the Heavyline service and this keeps them in step.
   It pulls on load, pushes a moment after any change, and polls for
   what other people have done. Collections are merged by id rather
   than overwritten, so two people adding different things at the
   same time both survive; the newer copy of the same record wins.
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
/* A failure from Supabase is a plain {message, code, details, hint} object,
   not an Error — it has no stack and stringifies to "[object Object]", which
   is what the console was reporting for every failed sync. Pull the parts
   that say something out of it. */
function supabaseError(e) {
  if (!e) return 'unknown error';
  if (typeof e === 'string') return e;

  const parts = [e.message, e.details, e.hint].filter(Boolean);
  const text = parts.length ? parts.join(' — ') : String(e);

  return e.code ? text + ' [' + e.code + ']' : text;
}

function defaultServiceUrl() {
  /* The service says who it is; the page never guesses.

     This used to answer with the page's own origin, on the reasoning that a
     page served over http was served BY the Heavyline service. That stopped
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

/* Ask the machine this page is on whether the service is running, and use
   it if it is.

   Only for a local page — the desktop client, a file, a dev server. On the
   published site every visitor would otherwise be pointed at their OWN
   localhost, which is not the company's service and is usually nothing at
   all; a https page cannot reach http://localhost in most browsers anyway.

   One request, with a short deadline. If it does not answer, the platform
   carries on exactly as it did before and says nothing, because there is
   nothing to say: not running the service is the normal case. */
async function discoverLocalService() {
  try {
    if (typeof window === 'undefined') return false;
    if (window.HLL_SERVICE) return false;      /* already told where it is */
    if (!isLocalPage()) return false;
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

/* Where the service listens when it is running beside you. */
const LOCAL_SERVICE = 'http://localhost:7040';

function isLocalPage() {
  if (typeof location === 'undefined') return false;
  if (location.protocol === 'file:') return true;
  const h = location.hostname;
  return h === 'localhost' || h === '127.0.0.1' || h === '::1' || h === '';
}

const Sync = {
  timer: null,
  pushTimer: null,
  version: 0,
  status: 'off',        /* off | syncing | ok | error */
  lastError: null,
  lastAt: 0,
  applying: false,
  driverKey: null,      /* whose driver row is already loaded */
  starting: false,

  url() {
    const u = (Store.db.meta.serviceUrl || Store.db.meta.fleetUrl || '').trim();
    return u ? u.replace(/\/$/, '') : defaultServiceUrl();
  },
  /* true when an address was typed in, rather than assumed from the origin */
  configured() {
    return !!(Store.db.meta.serviceUrl || Store.db.meta.fleetUrl || '').trim();
  },
  /* The company is in Supabase, not behind a fleet-service URL. Gating this
     on url() meant turning the legacy service off also turned the company
     sync off — pull() and sendNow() talk to Supabase and need nothing else. */
  on() { return !!window.hllSupabase; },

  /* Having the library is not the same as being signed in.

     The company record belongs to the people in the company, and every
     policy on it is written for an authenticated reader. A visitor to the
     public website has the client but no session, so every push they
     triggered was refused — "new row violates row-level security policy
     for table company" — and every pull came back empty, warning that no
     company record existed when in truth they were simply not allowed to
     see it.

     getSession() reads what is already in local storage. It costs nothing
     and makes no request. */
  async signedIn() {
    if (!window.hllSupabase) return false;
    try {
      const { data } = await window.hllSupabase.auth.getSession();
      return !!(data && data.session);
    } catch (e) {
      return false;
    }
  },

  /* ---- collections are keyed by id and merged, not replaced ---- */
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
      /* same record on both sides: keep whichever was touched last */
      const a = stamp ? new Date(x[stamp] || 0).getTime() : 0;
      const b = stamp ? new Date(other[stamp] || 0).getTime() : 0;
      by.set(x.id, a >= b ? x : other);
    });
    return Array.from(by.values());
  },

  merge(remote) {
    const db = Store.db;
    if (!remote || typeof remote !== 'object' || Array.isArray(remote)) return;
    try { this.mergeInner(db, remote); }
    catch (e) { console.warn('[HLL] the service sent something unusable', e); }
  },

mergeInner(db, remote) {

  db.drivers = this.mergeList(db.drivers, remote.drivers, 'lastSeen');

  /* Applications travel with the company after all.

     They were taken out of this merge so that Supabase could be the one
     source of truth and old company-blob rows could not come back. The
     first half of that is right and Applications.pull() still does it —
     it runs straight after this and every row Supabase answers with wins.

     But the company service is the only way an application reaches a
     second machine when Supabase does not have it: filed while the table
     was unreachable, or filed before the account could be created at all.
     Dropped here and wiped there, such an application existed on exactly
     one computer and the recruiter never saw it.

     Bringing it back is safe now because pull() no longer replaces the
     whole list — a row Supabase owns still overwrites whatever arrives
     here, so a cleared application does not reappear. */
  db.applications = this.mergeList(db.applications, remote.applications, 'submitted');

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

  /*
   * Merged on 'updated', not on 'date'.
   * A convoy's date is when it departs and never changes, so
   * merging on it meant whichever copy you already had always won.
   */
  db.events = this.mergeList(
    db.events,
    remote.events,
    'updated'
  );

  db.jobs = this.mergeList(
    db.jobs,
    remote.jobs,
    'finished'
  ).slice(0, 500);

  /*
   * A session is stamped when it ends, so an open session
   * merges on its start.
   */
  db.sessions = this.mergeList(
    db.sessions,
    remote.sessions,
    'ended'
  )
    .sort((a, b) => new Date(b.started) - new Date(a.started))
    .slice(0, 400);

  db.trucks = this.mergeList(
    db.trucks,
    remote.trucks
  );

  db.trailers = this.mergeList(
    db.trailers,
    remote.trailers
  );

  db.announcements = this.mergeList(
    db.announcements,
    remote.announcements,
    'date'
  );

  db.notifications = this.mergeList(
    db.notifications,
    remote.notifications,
    'at'
  ).slice(0, 300);

  db.activity = this.mergeList(
    db.activity,
    remote.activity,
    'at'
  )
    .sort((a, b) => new Date(b.at) - new Date(a.at))
    .slice(0, 200);

  if (
    remote.meta &&
    remote.meta.founded &&
    !db.meta.founded
  ) {
    db.meta.founded = remote.meta.founded;
  }

  /*
   * Logins travel with the company, so accounts can work
   * across machines.
   */
  if (Array.isArray(remote.accounts)) {

    const mine = Accounts.all();
    const by = new Map();

    remote.accounts.forEach((a) => {
      if (a && a.driverId) {
        by.set(a.driverId, a);
      }
    });

    mine.forEach((a) => {

      if (!a || !a.driverId) return;

      const other = by.get(a.driverId);

      if (!other) {
        by.set(a.driverId, a);
        return;
      }

      const x = new Date(
        a.passwordChanged || a.created || 0
      ).getTime();

      const y = new Date(
        other.passwordChanged || other.created || 0
      ).getTime();

      by.set(
        a.driverId,
        x >= y ? a : other
      );
    });

    Accounts.save(Array.from(by.values()));
  }

  normaliseCompany();

  Store.save();
},

  payload() {
    const db = Store.db;
    return {
      drivers: db.drivers, applications: db.applications, tickets: db.tickets,
      assignments: db.assignments,
      events: db.events, trucks: db.trucks, trailers: db.trailers,
      announcements: db.announcements, notifications: db.notifications,
      activity: db.activity, meta: db.meta, accounts: Accounts.all(),
      /* The service replaces data wholesale on a PUT, so anything left out of
         here is deleted for everybody. Runs and game sessions were missing:
         the platform read them, held them, and then pushed a payload without
         them, wiping every recorded run and session on the next save. */
      jobs: db.jobs, sessions: db.sessions,
    };
  },

  async pull() {
    if (!this.on() || this.applying) {
      return false;
    }

    /* nobody signed in: there is no company to read from Supabase, and
       saying so is not an error worth putting in the console. A configured
       service still has one, and its own way of proving who you are. */
    if (!(await this.signedIn())) {
      this.status = 'off';
      return this.absorbService();
    }

    try {
      const {
        data,
        error
      } = await window.hllSupabase
        .from('company')
        .select('id, version, data, updated_at')
        .eq('id', 1)
        .maybeSingle();

      if (error) {
        throw error;
      }

      if (!data) {
        console.warn('[HLL] No company record found in Supabase.');
        return false;
      }

      this.applying = true;

      /* A poll that finds the same version has nothing to report. Logging it
         every ten seconds buried the pulls that did carry a change. */
      const moved = (data.version || 0) !== this.version || !this.lastAt;

      this.version = data.version || 0;

if (data.data) {
  Store.db = {
    ...Store.db,
    ...data.data
  };
}

this.status = 'ok';
this.lastError = null;
this.lastAt = Date.now();

/*
 * The service/company blob may contain old local applications.
 * Supabase is the authoritative source for applications.
 *
 * Therefore:
 * 1. Absorb the service/company data.
 * 2. Immediately reload applications from Supabase.
 * 3. Applications.pull() replaces Store.db.applications completely.
 */
await this.absorbService();
await Applications.pull();

      if (moved) {
        console.log('[HLL] Company pulled from Supabase:', {
          version: this.version,
          updated_at: data.updated_at,
          applications: Array.isArray(Store.db.applications)
            ? Store.db.applications.length
            : 0
        });
      }

      this.applying = false;

      /* The signed-in driver's own record still comes from Supabase, so the
         dashboard has a name and a driver code to render after a pull.

         Once per signed-in driver, not once per poll. This used to run on
         every tick of the ten-second timer: two more round trips to Supabase
         and a full render() each time, which is where the repeating
         "Dashboard driver loaded" came from. driverKey is cleared on sign-out,
         so the next person to sign in is fetched fresh. */
      if (state.user && window.hllSupabase && this.driverKey !== state.user.id) {
        try {
          const { data: { user } = {}, error: authError } =
            await window.hllSupabase.auth.getUser();

          if (authError || !user) {
            console.error('[HLL] Could not get Supabase user:', authError);
            return true;
          }

          const { data: driver, error: driverError } =
            await window.hllSupabase
              .from('drivers')
              .select('*')
              .eq('auth_user_id', user.id)
              .maybeSingle();

          if (driverError || !driver) {
            console.error('[HLL] Could not load Supabase driver:', driverError);
            return true;
          }

          /* fromRow, not a raw spread of the row. driver.id is a Supabase uuid
             and the platform is keyed on driver_code, so spreading the row
             straight in sets state.user.id to the uuid and leaves name
             undefined — which takes the next render down. */
          state.user = Accounts.fromRow(driver, user);
          this.driverKey = state.user.id;

          /* the driver pages read the raw row off this */
          window.currentDriver = driver;
          render();

        } catch (err) {
          console.error('[HLL] Dashboard driver loading failed:', err);
        }
      }

      return true;

    } catch (error) {
      this.applying = false;

      this.status = 'error';

      this.lastError = supabaseError(error);

      console.error('[HLL] Company pull failed:', this.lastError, error);

      return false;
    }
  },

  /* called after any change; batched so a burst of edits is one request */
  push() {
    if (!this.on()) return;
    clearTimeout(this.pushTimer);
    this.pushTimer = setTimeout(() => this.sendNow(), 700);
  },

  async sendNow() {
    if (!this.on() || this.applying) return;

    const payload = this.payload();

    /* The company service first. It holds its own identity and needs the
       roster to put a name to a token, so it is written to whether or not
       anybody is signed in to Supabase — otherwise a company running only
       the service could never be used. Not awaited into the status below:
       a service that is down must not make a good save look like a failed
       one. */
    this.mirror(payload);

    /* A visitor's browser has nothing of the company to give back, and the
       Supabase write would be refused anyway. */
    if (!(await this.signedIn())) {
      this.status = 'off';
      return;
    }

    try {
        // Supabase is now the source of truth.
        // The old /api/company endpoint is no longer required.

        if (!window.hllSupabase) {
            throw new Error('Supabase client is not available.');
        }

        const { error } = await window.hllSupabase
            .from('company')
            .upsert({
                id: 1,
                data: payload
            });

        if (error) {
            throw error;
        }

        this.status = 'ok';
        this.lastError = null;
        this.lastAt = Date.now();

    } catch (e) {
        this.status = 'error';
        this.lastError = supabaseError(e);

        /* the object as well as the reading of it, so the console has both */
        console.error('[HLL] Company sync failed:', this.lastError, e);
    }
  },

  /* What the service has that this browser has not. Merged rather than
     assigned: the service holds the live half of the company — convoys,
     rosters, who is signed in — and Supabase holds the record. Whichever
     copy of a given row was touched last wins, which is what mergeList
     already decides. */
  async absorbService() {
    const base = this.url();
    if (!base) return false;

    /* Held while merging. Store.save() pushes a moment after any write, and
       what has just been read is exactly what must not be sent straight
       back — the round trip would overwrite whatever another machine had
       changed in the meantime with the copy this browser arrived with. */
    const wasApplying = this.applying;
    this.applying = true;

    try {
      const res = await fetch(base + '/api/company', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const body = await res.json();
      if (body && body.data) this.merge(body.data);
      if (body && typeof body.version === 'number') this.version = body.version;
      return true;

    } catch (e) {
      console.warn('[HLL] the company service did not answer:', e.message);
      return false;

    } finally {
      this.applying = wasApplying;
    }
  },

  /* The company as the service needs to see it. Only when an address is
     set — which, since defaultServiceUrl() stopped guessing, means only
     when a service really is there. */
  async mirror(payload) {
    const base = this.url();
    if (!base) return false;

    try {
      const res = await fetch(base + '/api/company', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: this.version, data: payload }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const out = await res.json().catch(() => null);
      if (out && typeof out.version === 'number') this.version = out.version;
      return true;

    } catch (e) {
      /* Not an error the person needs to see: the company itself saved. */
      console.warn('[HLL] the company service did not take the update:', e.message);
      return false;
    }
  },

  async start() {
    /* boot() calls this, and so does saveFleetService(). Two overlapping
       starts each fired an immediate pull before either set the timer. */
    if (this.starting) return false;
    this.starting = true;

    console.log('[HLL] Company sync started.');

    if (!window.hllSupabase) {
      this.status = 'off';
      this.lastError = 'Supabase client is not available.';
      this.starting = false;
      return false;
    }

    try {
      await this.pull();
      clearInterval(this.timer);
      this.timer = setInterval(() => this.pull(), 10000);
      this.status = 'ok';
      this.lastError = null;
      return true;
    } catch (error) {
      this.status = 'error';
      this.lastError = error.message || String(error);
      console.error('[HLL] Company sync start failed:', error);
      return false;
    } finally {
      this.starting = false;
    }
  },

  stop() {
    clearTimeout(this.pushTimer);
    clearInterval(this.timer);
    this.timer = null;
    this.pushTimer = null;
    this.status = 'off';
    console.log('[HLL] Company sync stopped.');
  }
};



/* ============================================================
   APPLICATIONS
   ------------------------------------------------------------
   public.applications is the shared record of who has asked to
   drive. It is a thin table — the columns it actually has are

     id  full_name  email  country  status  created_at
     reviewed_by -> drivers.id      reviewed_at

   and nothing else. Everything the recruitment screen shows that
   is not in that list (the note history, the messages, hours,
   experience, why they applied) has no column, so it stays on the
   local record and is matched back on by the Supabase id.

   That is the whole job here: carry the columns that exist both
   ways, and leave the rest alone rather than dropping it.
   ============================================================ */
const Applications = {
  status: 'off',        /* off | ok | error */
  lastError: null,
  lastAt: 0,

  /* named rather than select('*') so a column added later cannot quietly
     change the shape the merge below is written against */
  COLUMNS: 'id, driver_id, full_name, email, country, status, created_at, '
    + 'reviewed_by, reviewed_at',

  on() { return !!window.hllSupabase; },

  /* A row is not the shape the recruitment screen draws with. Identity comes
     from Supabase; everything with no column keeps coming from the local
     record, exactly as Accounts.fromRow does for a driver. */
  fromRow(row, local) {
    return {
      ...(local || {}),

      /* a stable local id, so notes written against it survive the next pull */
      id: (local && local.id) || 'APP-' + row.id,
      supabaseId: row.id,

      name: row.full_name || (local && local.name) || 'Applicant',
      email: row.email || (local && local.email) || '',
      country: row.country || (local && local.country) || 'Not set',
      status: row.status || (local && local.status) || 'pending',
      submitted: row.created_at || (local && local.submitted) || new Date().toISOString(),
      reviewedBy: row.reviewed_by || null,
      reviewedAt: row.reviewed_at || null,

      /* no column: the local record, then something the screen can render */
      age: (local && local.age) ?? null,
      discord: (local && local.discord) || '',
      truckersmp: (local && local.truckersmp) || '',
      experience: (local && local.experience) || 'Not stated',
      hours: (local && local.hours) ?? 0,
      previousVtc: (local && local.previousVtc) || 'None',
      why: (local && local.why) || 'Registered through the Heavyline platform.',
      notes: (local && local.notes) || [],
      messages: (local && local.messages) || [],

      /* The drivers row this was filed by. Kept apart from submittedBy on
         purpose: driver_id is the Supabase primary key, submittedBy is the
         HLL driver code, and approveApplication() looks the driver up by
         code. Feeding one into the other finds nobody and quietly builds a
         second roster row for somebody already on it. */
      driverSupabaseId: row.driver_id != null
        ? String(row.driver_id)
        : (local && local.driverSupabaseId) || null,

      submittedBy: (local && local.submittedBy) || null,
    };
  },

  /* The row this local application came from. Registrations made here carry
     the uuid; anything else is matched on the email it was filed with, which
     is the only other thing both sides hold. */
  localFor(list, row) {
    const byId = list.find((a) => a.supabaseId === row.id);
    if (byId) return byId;

    /* The driver link is exact where the email is only a good guess: two
       people can share an address, and one person can apply twice. Compared
       as text because the column is text — the value goes in as a number
       and comes back as a string. */
    if (row.driver_id != null) {
      const key = String(row.driver_id);
      const byDriver = list.find((a) => String(a.driverSupabaseId) === key);
      if (byDriver) return byDriver;
    }

    const email = String(row.email || '').toLowerCase();
    if (!email) return null;
    return list.find((a) => !a.supabaseId
      && String(a.email || '').toLowerCase() === email) || null;
  },

async pull() {
  if (!this.on()) return false;
  if (!(await Sync.signedIn())) return false;

  try {
    const { data, error } = await window.hllSupabase
      .from('applications')
      .select(this.COLUMNS)
      .order('created_at', { ascending: false });

    if (error) throw error;

    /* Supabase owns every row it answers with, and those replace whatever
       was held here — that is what stops a cleared application coming back
       as stale local data.

       What Supabase does not own is an application that never reached it:
       filed while the table was unreachable, or filed on another machine
       and carried across by the company service. Replacing the whole list
       threw those away, so an application filed on one machine vanished
       from the console on the next pull and the recruiter never saw a real
       person's application.

       "Never reached Supabase" means no supabaseId. A row that HAS one and
       is absent from the answer was deleted there, and stays deleted. */
    const remoteRows = data || [];
    const previous = Store.db.applications || [];

    const matched = new Set();
    const next = remoteRows.map((row) => {
      const local = this.localFor(previous, row);
      if (local) matched.add(local);
      return this.fromRow(row, local);
    });

    const unsent = previous.filter((a) => a && !matched.has(a) && !a.supabaseId);
    const merged = next.concat(unsent);

    /* Compared by identity and by the fields Supabase owns, not by
       position: the old check read previous[index] against next[index],
       so one insertion at the top made every later row look changed and
       a reorder looked like a change when nothing had moved. */
    const shape = (list) => JSON.stringify(list.map((a) => [
      a.id, a.supabaseId || null, a.status, a.reviewedAt || null, a.submitted || null]));
    const changed = shape(previous) !== shape(merged);

    Store.db.applications = merged;

    this.status = 'ok';
    this.lastError = null;
    this.lastAt = Date.now();

    if (changed) {
      Store.save();

      console.log('[HLL] Applications pulled from Supabase:', {
        rows: remoteRows.length,
        previous: previous.length,
        current: merged.length,
        notYetInSupabase: unsent.length
      });

      /*
       * Repaint only recruitment-related screens.
       */
      const showing =
        state.route &&
        ['recruitment', 'admin', 'dashboard'].includes(state.route.name);

      if (showing) render();
    }

    return true;

  } catch (error) {
    this.status = 'error';
    this.lastError = supabaseError(error);

    console.error(
      '[HLL] Applications pull failed:',
      this.lastError,
      error
    );

    return false;
  }
},

  /* A recruiter moving somebody through the stages. Written straight to the
     shared table so the next person to look sees the same thing, rather than
     only reaching them on the next company blob. */
  async setStatus(app, status) {
    if (!this.on() || !app) return false;

    if (!app.supabaseId) {
      /* filed before this table was connected, or filed offline */
      console.warn('[HLL] Application has no Supabase row, status kept local:', app.id);
      return false;
    }

    try {
      const patch = {
        status,
        reviewed_at: new Date().toISOString()
      };

      /* reviewed_by is a foreign key onto drivers.id, so it takes the
         Supabase uuid — not the HLL driver code the app is keyed on. */
      if (state.user && state.user.supabaseId) {
        patch.reviewed_by = state.user.supabaseId;
      }

      /* No .single(). It sends Accept: application/vnd.pgrst.object+json,
         which asks PostgREST to return one object rather than an array — and
         when the update matches no row there is no object to return, so the
         answer is 406 Not Acceptable rather than an empty list. An update
         that changed nothing is a normal outcome here; it should not come
         back as a transport error. */
      const { data, error } = await window.hllSupabase
        .from('applications')
        .update(patch)
        .eq('id', app.supabaseId)
        .select('*');

      if (error) throw error;

      /* An empty array is the 406 in its honest form: the row was not
         updated. Either the id is not there, or — far more likely — row
         level security silently filtered it out, because an UPDATE a policy
         forbids matches nothing rather than failing.

         Reporting this as success is how a recruiter ends up believing the
         company was told when nothing left the browser. */
      if (!data || !data.length) {
        console.warn('[HLL] The application status was not written:', {
          id: app.supabaseId,
          status,
          reason: 'the update matched no row — check the id, and check that '
            + 'this account is allowed to update applications'
        });

        toast('Saved here, but not shared', 'warn',
          'The applications table did not accept the change.');

        return false;
      }

      const row = data[0];

      app.reviewedAt = patch.reviewed_at;
      app.reviewedBy = patch.reviewed_by || null;

      console.log('[HLL] Application status written to Supabase:', data);

      /* Read the table back, so the screen shows what was actually stored
         rather than what this browser hoped was stored. */
      await this.pull();

      return true;

    } catch (error) {
      this.status = 'error';
      this.lastError = supabaseError(error);

      console.error('[HLL] Could not write the application status:',
        this.lastError, error);

      /* The local record has already moved. Say so rather than letting the
         recruiter believe the company has been told. */
      toast('Saved here, but not shared', 'warn',
        error.message || 'The applications table refused the change.');

      return false;
    }
  },
};


/* ============================================================
   DISPATCH
   ------------------------------------------------------------
   Giving a driver a load to run. A dispatcher creates it, the
   driver sees it on their dashboard and in the client, and it is
   closed off when the run is done — so the company can direct work
   rather than only record it after the fact.
   ============================================================ */
const ASSIGNMENT_STATES = {
  assigned: 'Assigned',
  accepted: 'Accepted',
  done: 'Completed',
  cancelled: 'Cancelled',
};

function assignmentsFor(driverId) {
  return (Store.db.assignments || [])
    .filter((a) => a.driverId === driverId)
    .sort((a, b) => new Date(b.at) - new Date(a.at));
}
/* A load is open while it is still the driver's to run — dispatched but not
   yet completed or called off. Every count of "what is outstanding" reads
   this, so the definition lives in one place. */
function isOpenLoad(a) { return a.status === 'assigned' || a.status === 'accepted'; }
function openLoads() { return (Store.db.assignments || []).filter(isOpenLoad); }

function openDispatch(driverId) {
  if (!can('events.manage') && !can('drivers.manage')) {
    toast('You do not have the rank for that', 'danger'); return;
  }
  const drivers = Store.db.drivers.slice().sort((a, b) => a.name.localeCompare(b.name));
  if (!drivers.length) { toast('No drivers to dispatch', 'warn'); return; }
  const cities = Object.keys(CITIES).sort();

  openModal({
    title: 'Dispatch a load', sub: 'The driver is told straight away',
    body: `<form id="dispatchForm">
      <div class="field"><label for="dp-driver">Driver *</label>
        <select class="select" id="dp-driver">
          ${drivers.map((d) => `<option value="${esc(d.id)}"${d.id === driverId ? ' selected' : ''}>
            ${esc(d.name)} · ${esc(d.id)}</option>`).join('')}
        </select></div>
      <div class="grid g-2" style="gap:0 14px">
        <div class="field"><label for="dp-from">From *</label>
          <select class="select" id="dp-from">${cities.map((c) => `<option>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="dp-to">To *</label>
          <select class="select" id="dp-to">${cities.map((c, i) => `<option${i === 1 ? ' selected' : ''}>${esc(c)}</option>`).join('')}</select></div>
        <div class="field"><label for="dp-cargo">Cargo *</label>
          <input class="input" id="dp-cargo" placeholder="Steel coils"></div>
        <div class="field"><label for="dp-payout">Payout (€)</label>
          <input class="input" id="dp-payout" type="number" min="0" step="50" value="0"></div>
      </div>
      <div class="field"><label for="dp-due">Run it by</label>
        <input class="input" id="dp-due" type="date"></div>
      <div class="field"><label for="dp-note">Anything the driver should know</label>
        <textarea class="textarea" id="dp-note" rows="2"
          placeholder="Optional — convoy, trailer, delivery window…"></textarea></div>
    </form>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="dispatch-save">${icon('send')}Dispatch</button>`,
  });
}

function saveDispatch() {
  if (!can('events.manage') && !can('drivers.manage')) {
    toast('You do not have the rank for that', 'danger'); return;
  }
  const g = (id) => ($('#' + id) ? $('#' + id).value.trim() : '');
  const driverId = g('dp-driver'), from = g('dp-from'), to = g('dp-to'), cargo = g('dp-cargo');
  const driver = Store.driver(driverId);
  if (!driver) return toast('Pick a driver', 'warn');
  if (!cargo) return toast('Say what the load is', 'warn');
  if (from === to) return toast('The two cities are the same', 'warn');

  const km = routeDistance([from, to]);
  const a = {
    id: 'ASG-' + randI(1000, 9999),
    driverId, from, to, cargo,
    km, payout: +(g('dp-payout') || 0),
    due: g('dp-due') || null,
    note: g('dp-note'),
    status: 'assigned',
    assignedBy: state.user.id,
    at: new Date().toISOString(),
  };
  Store.db.assignments = Store.db.assignments || [];
  Store.db.assignments.unshift(a);

  Store.notify(driverId, {
    type: 'info', icon: 'route', title: 'A load has been dispatched to you',
    body: from + ' → ' + to + ' · ' + cargo + (a.payout ? ' · ' + fmt.eur(a.payout) : ''),
    href: '#/dashboard',
  });
  Store.logActivity(driverId, 'convoy', 'route',
    driver.name + ' was dispatched ' + from + ' → ' + to, cargo, true);
  Store.save();
  closeModal();
  toast('Load dispatched', 'ok', driver.name + ' · ' + from + ' → ' + to);
  render();
}

function setAssignmentState(id, next) {
  const a = (Store.db.assignments || []).find((x) => x.id === id);
  if (!a) return;
  const mine = a.driverId === state.user.id;
  if (!mine && !can('drivers.manage')) { toast('That is not your load', 'danger'); return; }
  a.status = next;
  a.updated = new Date().toISOString();
  if (next === 'done' || next === 'cancelled') {
    notifyStaff('drivers.manage', {
      type: next === 'done' ? 'ok' : 'warn', icon: 'route',
      title: next === 'done' ? 'Dispatched load completed' : 'Dispatched load declined',
      body: (Store.driver(a.driverId) || {}).name + ' · ' + a.from + ' → ' + a.to,
      href: '#/admin',
    }, state.user.id);
  }
  Store.save();
  toast(ASSIGNMENT_STATES[next] || next, 'ok', a.from + ' → ' + a.to);
  render();
}

/* ---------------- Live map ----------------
   The same road network the client draws, from the same map-data.js, with
   whoever is reporting to the fleet service on top of it. The platform has
   no telemetry of its own — it asks the fleet service where everyone is. */
const LiveMap = {
  map: null, roadLayer: null, routeLayer: null, cityLayer: null, fleetLayer: null,
  _graph: null, _graphGame: null, _roadSig: null,
  timer: null, drivers: [], online: false, lastError: null,
  game: 'ets2',

  service() {
    const url = (Store.db.meta.fleetUrl || Store.db.meta.serviceUrl || '').trim();
    /* same rule as the company record: a page served by the service uses it */
    return url ? url.replace(/\/$/, '') : defaultServiceUrl();
  },

  mount(el) {
    if (!el || typeof L === 'undefined') return;
    this.destroy();
    el.classList.add('game-map');

    this.map = L.map(el, {
      crs: L.CRS.Simple, minZoom: -1, maxZoom: 5, zoomSnap: 0.25,
      zoomControl: true, attributionControl: false, preferCanvas: false,
    });
    this.roadLayer = L.layerGroup().addTo(this.map);
    this.routeLayer = L.layerGroup().addTo(this.map);   /* runs in progress */
    this.cityLayer = L.layerGroup().addTo(this.map);
    this.fleetLayer = L.layerGroup().addTo(this.map);

    this.draw();
    const b = mapFor(this.game).bounds;
    this.map.fitBounds([gameLatLng([b.x0, b.y0]), gameLatLng([b.x1, b.y1])], { padding: [20, 20] });
    this.map.on('zoomend', () => this.syncLabels());
    this.syncLabels();
    this.start();
  },

  destroy() {
    this.stop();
    if (!this.map) return;
    [this.roadLayer, this.routeLayer, this.cityLayer, this.fleetLayer].forEach((l) => {
      if (l) { try { this.map.removeLayer(l); } catch (e) {} }
    });
    this.map.off();
    try { this.map.remove(); } catch (e) {}
    this.map = this.roadLayer = this.routeLayer = this.cityLayer = this.fleetLayer = null;
  },

  draw() {
    const M = mapFor(this.game);
    const roads = ROADS[this.game] || ROADS.ets2;
    const pts = ([a, b]) => {
      const pa = M.cities[a], pb = M.cities[b];
      return (pa && pb) ? [gameLatLng(pa), gameLatLng(pb)] : null;
    };
    /* Four passes, and the order is the whole effect: a wash that gives the
       land its body, a dark casing so a road reads as a road rather than a
       scratch, the grey carriageway, and then — over the top — the roads
       this company actually runs, in amber.

       The two-tone network is the point. On the in-game atlas a road you
       have driven is gold and one you have not is grey, and anybody reading
       this map has that distinction in their head already. Here it means
       something a dispatcher can use: gold is where Heavyline goes. */
    const driven = this.drivenRoads();
    const isDriven = (r) => driven.has(r[0] < r[1] ? r[0] + '|' + r[1] : r[1] + '|' + r[0]);

    const passes = [
      { colour: () => '#10151d', weight: 16, opacity: .55 },          /* land */
      { colour: () => '#151b25', weight: 4.2, opacity: .95 },         /* casing */
      { colour: () => '#78838f', weight: 1.15, opacity: .9,           /* untravelled */
        only: (r) => !isDriven(r), tip: true },
      { colour: () => '#e8a838', weight: 1.9, opacity: 1,             /* ours */
        only: isDriven, tip: true, className: 'road-run' },
    ];

    passes.forEach((pass) => {
      roads.forEach((r) => {
        if (pass.only && !pass.only(r)) return;
        const p = pts(r); if (!p) return;
        const line = L.polyline(p, {
          color: pass.colour(r), weight: pass.weight, opacity: pass.opacity,
          lineCap: 'round', lineJoin: 'round', interactive: !!pass.tip,
          className: pass.className || '',
        });
        if (pass.tip) {
          line.bindTooltip(cityLabel(r[0]) + ' — ' + cityLabel(r[1])
            + (isDriven(r) ? ' · run by Heavyline' : ''), { sticky: true });
        }
        line.addTo(this.roadLayer);
      });
    });

    regionsFor(this.game).forEach((reg) => {
      const line = reg.line.map((p) => geoToGameLatLng(this.game, p[0], p[1]));
      L.polyline(line, { color: '#0b0d10', weight: 6, opacity: .8, interactive: false }).addTo(this.roadLayer);
      L.polyline(line, { color: reg.color, weight: 2.6, opacity: .95 })
        .bindTooltip(reg.name.replace('!', ''), { sticky: true }).addTo(this.roadLayer);
      L.marker(geoToGameLatLng(this.game, reg.label[0], reg.label[1]), {
        interactive: false,
        icon: L.divIcon({ className: 'region-label', iconSize: [0, 0],
          html: '<span style="color:' + reg.color + '">' + esc(reg.name) + '</span>' }),
      }).addTo(this.roadLayer);
    });

    Object.keys(M.cities).forEach((name) => {
      const ll = gameLatLng(M.cities[name]);
      const major = cityTier(this.game, name) === 1;
      L.circleMarker(ll, {
        radius: major ? 3.6 : 2.3, color: '#120b02', weight: major ? 1.6 : 1.2,
        fillColor: major ? '#ffa42b' : '#d98526', fillOpacity: 1,
        className: 'city-dot' + (major ? ' major' : ''),
      }).bindTooltip(cityLabel(name), { direction: 'top', offset: [0, -8] }).addTo(this.cityLayer);
      L.marker(ll, { interactive: false,
        icon: L.divIcon({ className: 'city-label' + (major ? ' major' : ''), iconSize: [0, 0],
          html: '<span>' + esc(cityLabel(name)) + '</span>' }) }).addTo(this.cityLayer);
    });
  },

  /* The shortest run of roads between two towns, or nothing if the network
     does not join them. Breadth-first, so the first path found is the one
     with the fewest legs — which is what a route highlight should follow.

     The road list is small enough that this is not worth caching per call,
     but the adjacency is rebuilt on every lookup, so it is cached per game. */
  roadGraph() {
    if (this._graph && this._graphGame === this.game) return this._graph;
    const g = {};
    (ROADS[this.game] || ROADS.ets2).forEach(([a, b]) => {
      (g[a] || (g[a] = [])).push(b);
      (g[b] || (g[b] = [])).push(a);
    });
    this._graph = g;
    this._graphGame = this.game;
    return g;
  },

  routeBetween(rawFrom, rawTo) {
    /* through cityKey, because a job names its cities the way the game
       displays them and the network is keyed on the plain form */
    const from = cityKey(rawFrom);
    const to = cityKey(rawTo);
    if (!from || !to || from === to) return null;
    const g = this.roadGraph();
    if (!g[from] || !g[to]) return null;

    const seen = { [from]: null };
    const queue = [from];

    while (queue.length) {
      const at = queue.shift();
      if (at === to) {
        const path = [];
        for (let c = to; c != null; c = seen[c]) path.unshift(c);
        return path;
      }
      (g[at] || []).forEach((next) => {
        if (!(next in seen)) { seen[next] = at; queue.push(next); }
      });
    }
    return null;
  },

  /* Every stretch of road the company has actually put a truck down.

     Taken from the runs on the record and from whatever is moving right
     now, each resolved to a path through the network and broken into its
     legs. Segments are keyed with their two ends sorted, because a road is
     the same road whichever way it was driven.

     Capped at the most recent few hundred runs: past that the picture stops
     changing and the work does not. */
  drivenRoads() {
    const out = new Set();
    const asked = new Set();

    const consider = (from, to) => {
      if (!from || !to) return;
      const key = from + '>' + to;
      if (asked.has(key)) return;
      asked.add(key);

      const path = this.routeBetween(from, to);
      if (!path) return;
      for (let i = 0; i < path.length - 1; i++) {
        const a = path[i], b = path[i + 1];
        out.add(a < b ? a + '|' + b : b + '|' + a);
      }
    };

    (Store.db.jobs || []).slice(0, 400).forEach((j) => j && consider(j.from, j.to));
    (this.drivers || []).forEach((d) => d.job && consider(d.job.from, d.job.to));

    return out;
  },

  /* Every load currently being run, drawn over the network in the accent.
     One line per driver, so two trucks on the same road both show. */
  drawRoutes() {
    if (!this.routeLayer) return;
    this.routeLayer.clearLayers();

    this.drivers.forEach((d) => {
      if (!d.job || !d.job.from || !d.job.to) return;
      if (d.game && d.game !== this.game) return;

      const M = mapFor(this.game);
      const path = this.routeBetween(d.job.from, d.job.to);
      const pts = (path || [cityKey(d.job.from), cityKey(d.job.to)])
        .map((c) => M.cities[c] && gameLatLng(M.cities[c]))
        .filter(Boolean);
      if (pts.length < 2) return;

      /* casing first, so the highlight reads over the amber underneath */
      L.polyline(pts, { color: '#04070f', weight: 7, opacity: .85, interactive: false })
        .addTo(this.routeLayer);
      L.polyline(pts, {
        color: '#4f7fff', weight: 3, opacity: .95, interactive: false,
        /* dashed when we had to guess a straight line, solid when it really
           does follow the roads — so the map never overstates what it knows */
        dashArray: path ? null : '6 5',
      }).addTo(this.routeLayer);
    });
  },

  syncLabels() {
    if (!this.map) return;
    const el = this.map.getContainer();
    const z = this.map.getZoom();
    /* Labels stay on at the zoom the map opens at — a network of roads with
       no names on it is a diagram, not a map. Only the majors, until there is
       room for the rest. */
    el.classList.toggle('hide-city-labels', z < -1.2);
    el.classList.toggle('major-labels-only', z < 1.7);
    el.style.setProperty('--region-fs', clamp(14 + (z + 1) * 7, 12, 40).toFixed(1) + 'px');
  },

  /* ---- who is out there ----
     The service pushes, so this no longer asks. HQLive holds a stream open
     and hands positions straight to absorb(); the poll below stays only as
     the fallback for when that stream cannot be held. */
  /* The map's own polling loop only. The live stream is deliberately NOT
     tied to this: the console wants driver positions, run progress and
     notifications on every page, not only the one with a map on it, and
     leaving the map is not a reason to go deaf. HQLive is started once at
     boot and runs for as long as the page is open. */
  start() {
    this.stop();
    /* The stream is the real source; the poll below is the safety net for
       when it cannot be held open. poll() stands down while it is live. */
    HQLive.start();
    this.timer = setInterval(() => this.poll(), 8000);
    this.poll();
  },
  stop() {
    if (this.timer) { clearInterval(this.timer); this.timer = null; }
  },

  /* merge, don't replace: a stream frame carries only who moved */
  absorb(list, replace) {
    const by = new Map();
    if (!replace) this.drivers.forEach((d) => by.set(d.id, d));
    (list || []).forEach((d) => { if (d && d.id) by.set(d.id, d); });
    const cutoff = Date.now() - 95000;
    this.drivers = Array.from(by.values()).filter((d) => !d.at || d.at > cutoff);
    this.online = true;

    /* the game already said what is being driven; the register listens */
    adoptReportedUnits(this.drivers);

    this.paint();
  },

  async poll() {
    const base = this.service();
    if (!base) { this.drivers = []; this.online = false; this.paint(); return; }
    /* the stream is already keeping this current */
    if (HQLive.status === 'live') return;
    try {
      const res = await fetch(base + '/api/fleet', { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      this.drivers = data.drivers || [];
      this.online = true; this.lastError = null;
    } catch (e) {
      this.drivers = []; this.online = false; this.lastError = e.message;
    }
    this.paint();
  },

  paint() {
    this.drawFleet();
    const badge = $('#mapFleetCount');
    if (badge) badge.textContent = this.drivers.length;
    const list = $('#hqFleetList');
    if (list) list.innerHTML = hqFleetListInner();
    const dot = $('#hqLiveDot');
    if (dot) dot.outerHTML = hqLiveDot();
    /* the operations board is the same picture, drawn differently */
    paintOps();
    /* and so is a convoy, scoped to its own drivers */
    paintConvoyLive();
  },

  /* Every truck reporting, drawn as an arrow pointing where it is going —
     a dot cannot show heading, and heading is half of what a map is for.
     Hauling is orange, running empty is blue, stopped is grey, so the state
     of the fleet reads at a glance without hovering anything. */
  drawFleet() {
    if (!this.fleetLayer) return;
    this.fleetLayer.clearLayers();

    /* the load a truck is running is part of drawing the truck */
    this.drawRoutes();

    /* A truck that has just taken a load turns its corridor gold, so the
       network is redrawn when the set of runs changes — and only then,
       because redrawing several hundred polylines on every position update
       would cost far more than it shows. */
    const signature = (this.drivers || [])
      .map((d) => (d.job ? d.job.from + '>' + d.job.to : '')).sort().join(',')
      + '#' + ((Store.db.jobs || []).length);
    if (signature !== this._roadSig) {
      this._roadSig = signature;
      /* draw() fills the towns as well as the roads, so both layers are
         cleared. Clearing only the roads left every town drawn a second
         time on each redraw, piling up markers and labels for as long as
         the page stayed open. */
      if (this.roadLayer) this.roadLayer.clearLayers();
      if (this.cityLayer) this.cityLayer.clearLayers();
      if (this.roadLayer) { this.draw(); this.syncLabels(); }
    }

    this.drivers.forEach((d) => {
      if (d.game && d.game !== this.game) return;
      if (typeof d.lat !== 'number' || typeof d.lon !== 'number') return;
      const ll = geoToGameLatLng(this.game, d.lat, d.lon);
      if (!ll) return;

      const moving = (d.speed || 0) >= 5;
      const colour = d.job ? '#4f7fff' : moving ? '#4aa3f0' : '#69727f';
      /* the game reports heading as 0..1, 0 = north and increasing westward */
      const deg = (1 - (Number(d.heading) || 0)) * 360;

      /* What a dispatcher glancing at the map wants without clicking: who
         it is, what they are running, what is on the trailer and what is
         pulling it. The arrow alone answers none of that, and a tooltip
         answers it only for the one truck under the pointer. */
      const j = d.job;
      const run = j ? cityLabel(j.from || '?') + ' → ' + cityLabel(j.to || '?') : '';
      const load = [j && j.cargo, d.truck].filter(Boolean).join(' · ');
      const pct = j && Number.isFinite(+j.progress) ? Math.round(+j.progress) : null;

      const marker = L.marker(ll, {
        icon: L.divIcon({
          className: 'fleet-truck' + (d.job ? ' hauling' : ''),
          iconSize: [26, 26], iconAnchor: [13, 13],
          html: `<span class="ft-arrow" style="transform:rotate(${deg.toFixed(0)}deg);color:${colour}">
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l7 19-7-4.5L5 21z" fill="currentColor"/></svg>
            </span>
            <span class="ft-card">
              <span class="ft-who">
                <img class="ft-mark" src="hll.jpg" alt="" width="14" height="14">
                <b>${esc(d.name || d.id)}</b>
                <em>${Math.round(d.speed || 0)}<i>km/h</i></em>
              </span>
              ${run ? `<span class="ft-run">${esc(run)}${
                  pct != null ? `<i class="ft-pct">${pct}%</i>` : ''}</span>` : ''}
              ${load ? `<span class="ft-load">${esc(load)}</span>`
                     : '<span class="ft-load empty">running empty</span>'}
            </span>`,
        }),
        keyboard: true,
        title: (d.name || d.id) + ' — click for the full picture',
      });

      /* The card already says all this on the map; the tooltip repeats it for
         a pointer, and adds nothing the card leaves out. */
      marker.bindTooltip('<b>' + esc(d.name || d.id) + '</b><br>'
        + esc(run || 'no load aboard')
        + '<br>' + Math.round(d.speed || 0) + ' km/h'
        + (d.job && Number.isFinite(+d.job.progress) ? ' · ' + Math.round(d.job.progress) + '%' : '')
        + (d.truck ? '<br>' + esc(d.truck) : ''), { direction: 'top', offset: [0, -14] });

      marker.on('click', () => openDriverLive(d.id));
      marker.addTo(this.fleetLayer);
    });
  },
};


/* ============================================================
   THE FLEET REGISTER, KEPT BY THE GAME
   ------------------------------------------------------------
   Every telemetry frame carries the tractor a driver is sitting
   in and the trailer behind it. The register was typed in by
   hand anyway — somebody added "Scania S 730", somebody else
   coupled a trailer to it, and the moment a driver switched
   truck in game the two stopped agreeing with no way to tell.

   So nothing is assigned here any more. A unit appears the
   first time it is reported, it is coupled to whoever is
   driving it, and it is marked as coming from the game so a
   manager can see which rows they own and which the fleet
   filled in for them.

   What is deliberately NOT done: nothing is ever deleted. A
   truck that stops being reported has been parked, not scrapped,
   and a register that forgets its own history is no register.
   ============================================================ */

/* Matched on the name the game reports, folded and squeezed, because the
   same tractor comes back as "Scania S 730" and "Scania  S730" depending on
   which mod wrote it. */
const unitKey = (name) => String(name || '').toLowerCase().replace(/[^a-z0-9]/g, '');

function adoptReportedUnits(list) {
  if (!Store.db) return;
  const trucks = Store.db.trucks || (Store.db.trucks = []);
  const trailers = Store.db.trailers || (Store.db.trailers = []);
  const now = new Date().toISOString();
  let changed = false;

  (list || []).forEach((d) => {
    if (!d || !d.id) return;

    /* ---- the tractor ---- */
    if (d.truck) {
      const key = unitKey(d.truck);
      let t = trucks.find((x) => x && (unitKey(x.gameName) === key
        || unitKey((x.make || '') + ' ' + (x.model || '')) === key));

      if (!t) {
        /* The game gives a make and a model run together. Split on the first
           word, which is the make for every tractor in either title. */
        const parts = String(d.truck).trim().split(/\s+/);
        t = {
          id: 'HLT-' + randI(300, 899),
          make: parts[0] || 'Unknown',
          model: parts.slice(1).join(' ') || String(d.truck),
          gameName: d.truck,
          hp: null, chassis: '', plate: '', year: null, livery: 'none',
          mileage: 0, serviceKm: null, cab: '', gearbox: '', notes: '',
          lastService: null, nextService: null,
          status: 'active', assignedTo: null,
          fromGame: true, firstSeen: now,
        };
        t.unit = 'Unit ' + t.id.split('-')[1];
        trucks.push(t);
        changed = true;
        Store.logActivity(d.id, 'fleet', 'truck',
          (d.name || d.id) + ' brought ' + d.truck + ' onto the fleet', '', true);
      }

      if (t.assignedTo !== d.id) { t.assignedTo = d.id; changed = true; }
      if (t.status !== 'active') { t.status = 'active'; changed = true; }
      t.lastSeen = now;
    }

    /* ---- and what is behind it ---- */
    if (d.trailer) {
      const key = unitKey(d.trailer);
      let tr = trailers.find((x) => x && (unitKey(x.gameName) === key
        || unitKey(x.type) === key));

      if (!tr) {
        tr = {
          id: 'HLR-' + randI(300, 899),
          type: d.trailer,
          gameName: d.trailer,
          cargo: (d.job && d.job.cargo) || '—',
          axles: null, weight: '—',
          status: 'active', assignedTruck: null,
          fromGame: true, firstSeen: now,
        };
        trailers.push(tr);
        changed = true;
      }

      if (d.job && d.job.cargo && tr.cargo !== d.job.cargo) { tr.cargo = d.job.cargo; changed = true; }
      if (tr.status !== 'active') { tr.status = 'active'; changed = true; }

      /* coupled to the tractor this driver is reporting, by its id */
      const pulling = trucks.find((x) => x && x.assignedTo === d.id);
      if (pulling && tr.assignedTruck !== pulling.id) { tr.assignedTruck = pulling.id; changed = true; }
      tr.lastSeen = now;
    }
  });

  /* Only when something actually moved: this runs on every position frame,
     and Store.save() pushes to Supabase a moment later. */
  if (changed) Store.save();
}

/* ============================================================
   ONE TRUCK, IN FULL
   ------------------------------------------------------------
   What a dispatcher wants after clicking a truck on the map:
   who is driving it, what it is pulling, where it is, how fast,
   how far is left, when it will land, what it is worth — and
   whether any of that can still be trusted, because a position
   that stopped updating four minutes ago is worse than no
   position at all if nothing says so.
   ============================================================ */
function openDriverLive(driverId) {
  const live = Ops.liveFor(driverId);
  const d = Store.driver(driverId);
  const stale = !live && (LiveMap.drivers || []).some((x) => x.id === driverId);

  if (!live && !d) { toast('That driver is not on the roster', 'warn'); return; }

  const job = live && live.job ? live.job : null;
  const age = live && live.at ? Math.round((Date.now() - live.at) / 1000) : null;
  const progress = job && Number.isFinite(+job.progress) ? clamp(+job.progress, 0, 100) : null;
  const leftKm = job && job.km != null && job.drivenKm != null
    ? Math.max(0, job.km - job.drivenKm) : null;
  const where = live && typeof live.lat === 'number'
    ? nearestCityLabel(live.game || 'ets2', live.lat, live.lon) : null;

  const conn = !live
    ? `<span class="badge ${stale ? 'warn' : ''}">${icon('alert')}${
        stale ? 'Position went stale' : 'Not reporting'}</span>`
    : `<span class="badge ok">${icon('checkCircle')}Live${age != null ? ' · ' + age + 's ago' : ''}</span>`;

  openModal({
    title: d ? d.name : driverId,
    size: 'wide',
    body: `
      <div class="row-b wrap gap-12 mb-16">
        <div class="row gap-12">
          ${d ? avatar(d, 52) : `<span class="avatar a-52">${esc(initials(driverId))}</span>`}
          <div>
            <div class="b7 lg">${esc(d ? d.name : driverId)}</div>
            <div class="xs t3 mt-4 mono">${esc(driverId)}${
              d && d.role && ROLES[d.role] ? ' · ' + esc(ROLES[d.role].name) : ''}</div>
          </div>
        </div>
        ${conn}
      </div>

      ${job ? `
        <div class="mb-16">
          <div class="row-b sm mb-8">
            <span class="b6">${esc(cityLabel(job.from || '?'))} → ${esc(cityLabel(job.to || '?'))}</span>
            <span class="mono" style="color:var(--accent)">${progress != null ? Math.round(progress) + '%' : ''}</span>
          </div>
          ${progress != null ? `<div class="fr-bar"><i style="width:${progress.toFixed(1)}%"></i></div>` : ''}
        </div>` : ''}

      <div class="grid g-2">
        <div class="card"><div class="card-head"><div class="card-title">${icon('truck')}The truck</div></div>
          <div class="card-body">
            ${kv('Truck', esc((live && live.truck) || (d && d.truck) || 'unknown'))}
            ${kv('Game', esc(live ? mapLabel(live.game) : '—'))}
            ${kv('Speed', live ? `<span class="mono">${Math.round(live.speed || 0)} km/h</span>` : '—')}
            ${kv('Location', where ? esc(where) : '<span class="t3">not placed yet</span>')}
            ${kv('Position', live && typeof live.lat === 'number'
              ? `<span class="mono">${live.lat.toFixed(3)}, ${live.lon.toFixed(3)}</span>`
              : '<span class="t3">—</span>')}
            ${kv('Fuel', live && live.fuel != null
              ? `<span class="mono">${Math.round(live.fuel)}%</span>` : '—')}
            ${kv('Damage', live && live.damage != null
              ? `<span class="mono" style="color:${live.damage > 15 ? 'var(--danger)'
                  : live.damage > 5 ? 'var(--warn)' : 'var(--ok)'}">${live.damage.toFixed(1)}%</span>` : '—')}
          </div>
        </div>

        <div class="card"><div class="card-head"><div class="card-title">${icon('route')}The run</div></div>
          <div class="card-body">
            ${job ? `
              ${kv('Cargo', esc(job.cargo || '—'))}
              ${kv('From', esc(cityLabel(job.from || '?')))}
              ${kv('Destination', esc(cityLabel(job.to || '?')))}
              ${kv('Distance', job.km ? fmt.km(job.km) : '—')}
              ${kv('Driven', job.drivenKm != null ? fmt.km(Math.round(job.drivenKm)) : '—')}
              ${kv('Remaining', leftKm != null ? fmt.km(Math.round(leftKm)) : '—')}
              ${kv('ETA', Number.isFinite(+job.etaMin)
                ? `<span class="mono">${esc(fmt.dur(+job.etaMin))}</span>` : '<span class="t3">—</span>')}
              ${kv('Pays', job.income ? `<span class="mono" style="color:var(--ok)">${fmt.eur(job.income)}</span>` : '—')}`
            : `<div class="t3 sm">${live ? 'No load aboard right now.' : 'Nothing reporting for this driver.'}</div>
              ${d ? `<div class="mt-12">
                ${kv('Runs delivered', fmt.n(d.deliveries || 0))}
                ${kv('Distance', fmt.kmS(d.km || 0))}
                ${kv('Earned', `<span class="mono" style="color:var(--ok)">${fmt.eur(d.earned || 0)}</span>`)}
                ${kv('Last seen', esc(fmt.rel(d.lastSeen)))}
              </div>` : ''}`}
          </div>
        </div>
      </div>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Close</button>
      ${d ? `<button class="btn btn-primary" data-act="go" data-href="#/driver/${esc(d.id)}">${icon('user')}Driver profile</button>` : ''}`,
  });
}

/* the nearest place we have a name for, so a position reads as somewhere */
function nearestCityLabel(game, lat, lon) {
  const ll = geoToGameLatLng(game, lat, lon);
  if (!ll) return null;
  const near = nearestCity(game, ll.lng, -ll.lat);
  return near ? cityLabel(near.city) : null;
}

function viewLivemap() {
  const g = LiveMap.game;
  const M = mapFor(g);
  const configured = !!LiveMap.service();

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">${esc(M.label)}</div>
        <h1 class="page-title">Live map</h1>
        <p class="page-sub">The whole road network, and every driver reporting a position</p></div>
      <div class="row gap-8 wrap">
        <button class="btn ${g === 'ets2' ? 'btn-primary' : ''}" data-act="map-game" data-v="ets2">Europe</button>
        <button class="btn ${g === 'ats' ? 'btn-primary' : ''}" data-act="map-game" data-v="ats">America</button>
        ${can('admin.view') ? `<button class="btn" data-act="map-service">${icon('link')}Company service</button>` : ''}
      </div>
    </div>

    ${configured ? '' : `<div class="card mb-16"><div class="card-body row gap-12">
      <span style="color:var(--warn);width:18px;height:18px;flex:none">${icon('alert')}</span>
      <div class="grow"><div class="b7">No fleet service connected</div>
        <div class="xs t3 mt-4">The map is drawn, but nobody can appear on it until the Heavyline
          fleet service is running and this platform knows where it is.
          ${can('admin.view') ? 'Use <b>Company service</b> above.' : 'An administrator sets this up.'}</div></div>
    </div></div>`}

    <div class="card"><div class="card-body" style="padding:0">
      <div id="hqMap" class="hq-map"></div>
    </div></div>

    <div class="card mt-16">
      <div class="card-head"><div class="card-title">${icon('users')}On the road</div>
        <div class="row gap-8">
          <span class="badge"><span id="mapFleetCount">${LiveMap.drivers.length}</span> reporting</span>
          ${hqLiveDot()}
        </div></div>
      <div class="card-body" id="hqFleetList">${hqFleetListInner()}</div>
    </div>
  </div>`;
}

/* ============================================================
   THE LIVE CHANNEL
   ------------------------------------------------------------
   The same stream the driver client holds open, from the same
   service. The platform has no telemetry of its own — it only
   ever knew where anybody was because it asked every eight
   seconds. Now it is told, and the fleet board moves with the
   trucks instead of catching up with them.

   Server-sent events: one GET, no dependency, and the browser
   reconnects by itself. If it cannot be held open, LiveMap.poll
   above carries on exactly as before.
   ============================================================ */
const HQLive = {
  es: null,
  status: 'off',        /* off | connecting | live | retry */
  events: [],
  lastError: null,
  attempts: 0,
  retryTimer: null,

  start() {
    this.stop();
    const base = LiveMap.service();
    if (!base || typeof EventSource === 'undefined') { this.status = 'off'; return; }

    this.status = 'connecting';

    /* This was stubbed out with a bare return, so the console never opened
       the stream at all: no live fleet, no run announcements, and the board
       fell back to an eight-second poll for ever. */
    let es;
    try {
      es = new EventSource(base + '/api/stream'
        + (ServiceAuth.token ? '?token=' + encodeURIComponent(ServiceAuth.token) : ''));
    } catch (e) {
      this.status = 'retry';
      this.lastError = e.message;
      this.retry();
      return;
    }
    this.es = es;

    es.onerror = () => {
      /* The browser reconnects a dropped stream by itself. A closed one means
         the service is gone, and that wants backing off rather than a tight
         reconnect loop. */
      if (es.readyState === 2) {
        this.status = 'retry';
        this.lastError = 'the live channel closed';
        this.retry();
      }
    };

    es.addEventListener('hello', (m) => {
      const d = jsonOrNull(m.data);
      if (!d) return;
      this.attempts = 0;
      this.status = 'live';
      this.lastError = null;
      this.events = (d.events || []).slice(-30);
      LiveMap.absorb(d.drivers, true);
    });

    es.addEventListener('fleet', (m) => {
      const d = jsonOrNull(m.data);
      if (d) LiveMap.absorb(d.drivers);
    });

    es.addEventListener('event', (m) => {
      const d = jsonOrNull(m.data);
      if (!d) return;
      this.events.push(d);
      if (this.events.length > 30) this.events = this.events.slice(-30);
      const feed = $('#hqLiveFeed');
      if (feed) feed.innerHTML = hqLiveFeedInner();
      paintOps();
      this.announce(d);
    });

    /* convoy traffic — chat, and anything else that is about one convoy
       rather than about the fleet as a whole */
    es.addEventListener('convoy', (m) => {
      const d = jsonOrNull(m.data);
      if (!d) return;
      if (d.kind === 'convoy.message' && d.message) {
        ConvoyChat.receive(d.convoyId, d.message);
      } else if (d.kind === 'convoy.message.deleted' && d.message) {
        ConvoyChat.removed(d.convoyId, d.message);
      }
    });

    es.addEventListener('dm', (m) => {
      const d = jsonOrNull(m.data);
      if (!d) return;
      if (d.kind === 'dm.message' && d.message) Messages.receive(d.message);
      else if (d.kind === 'dm.message.deleted' && d.message) Messages.removed(d.message);
      else if (d.kind === 'dm.read') Messages.markedRead(d.by);
    });

    es.addEventListener('call', (m) => {
      const d = jsonOrNull(m.data);
      if (d) Calls.signal(d);
    });

    es.addEventListener('presence', (m) => {
      const d = jsonOrNull(m.data);
      if (!d) return;
      Messages.presence(d.driverId, d.online);
    });

    es.addEventListener('company', (m) => {
      const d = jsonOrNull(m.data);
      /* a sign-up, a ticket or a dispatched load written anywhere in the
         company reaches this console now, not on the next poll */
      if (d && Sync.on() && d.version !== Sync.version) {
        this.pendingRecord = true;
        Sync.pull().then(() => this.onRecordChanged());
      }
    });

  },

  retry() {
    clearTimeout(this.retryTimer);
    const wait = Math.min(30000, 2000 * Math.pow(1.7, Math.min(this.attempts++, 6)));
    this.retryTimer = setTimeout(() => this.start(), wait);
  },

  stop() {
    clearTimeout(this.retryTimer); this.retryTimer = null;
    if (this.es) {
      try { this.es.close(); } catch (e) { /* already gone */ }
      this.es = null;
    }
    this.status = 'off';
  },

  /* ---- turning a stream event into something a manager sees ----
     Only what a manager would want interrupting them. A truck moving is not
     news; a run landing, a driver sitting down to play, or somebody going
     over the limit is. Drivers see none of this — it is console traffic. */
  /* Each kind knows how to word itself from the facts on the event, rather
     than repeating the sentence the client happened to send. The client's
     wording suits a driver's own console; the management console wants the
     job number and the money. */
  ANNOUNCE: {
    'session.start': {
      icon: 'play', type: 'info', title: 'Driver Online', notify: true,
      body: (e) => e.driver + ' launched ' + (e.game === 'ats' ? 'ATS' : 'ETS2') + '.',
    },
    'session.end': {
      icon: 'clock', type: 'info', title: 'Driver Offline',
      body: (e) => e.driver + ' has stopped playing.',
    },
    /* A link that has gone quiet is not a driver who has left. The connector
       reports them separately because they need different answers: one is
       somebody finishing for the night, the other is somebody who may be
       mid-run and about to lose it. */
    'connection.lost': {
      icon: 'alert', type: 'warn', title: 'Connection Lost', notify: true, toast: 'warn',
      body: (e) => e.driver + ' has disconnected from the game.',
    },
    'connection.restored': {
      icon: 'refresh', type: 'ok', title: 'Connection Restored',
      body: (e) => e.driver + ' is back on the link.',
    },
    /* convoys. Joining and leaving are frequent and go to the feed only;
       a convoy actually starting or ending is worth a notification. */
    'convoy.joined':  { icon: 'userPlus', type: 'info', title: 'Driver joined a convoy',
                        body: (e) => e.text },
    'convoy.left':    { icon: 'x', type: 'info', title: 'Driver left a convoy',
                        body: (e) => e.text },
    'convoy.removed': { icon: 'alert', type: 'warn', title: 'Driver removed from a convoy',
                        body: (e) => e.text },
    'convoy.started': { icon: 'route', type: 'ok', title: 'Convoy Started', notify: true,
                        toast: 'ok', body: (e) => e.text },
    'convoy.ended':   { icon: 'checkCircle', type: 'ok', title: 'Convoy Completed', notify: true,
                        body: (e) => e.text },
    'job.start': {
      icon: 'route', type: 'info', title: 'Job Started', notify: true,
      body: (e) => e.driver + ' started Job ' + (e.jobId || '')
        + (e.from && e.to ? ' — ' + cityLabel(e.from) + ' → ' + cityLabel(e.to) : '') + '.',
    },
    'job.delivered': {
      icon: 'package', type: 'ok', title: 'Job Completed', notify: true, toast: 'ok',
      body: (e) => e.driver + ' completed Job ' + (e.jobId || '')
        + (e.income ? ' and earned ' + fmt.eur(e.income) : '') + '.',
    },
    'job.cancelled': {
      icon: 'x', type: 'warn', title: 'Job Cancelled', notify: true, toast: 'warn',
      body: (e) => e.driver + ' called off Job ' + (e.jobId || '')
        + (e.to ? ' to ' + cityLabel(e.to) : '') + '.',
    },
    'job.damage': {
      icon: 'alert', type: 'warn', title: 'Damage on a job', notify: true,
      body: (e) => e.text,
    },
  },

  announce(ev) {
    if (!can('admin.view')) return;
    const spec = this.ANNOUNCE[ev.kind];
    if (!spec) return;
    const body = (spec.body ? spec.body(ev) : ev.text) || ev.text;
    if (!body) return;

    /* on the operations board or the map they are already watching it
       happen, and a toast on top of that is noise */
    const watching = state.route.name === 'ops' || state.route.name === 'livemap';
    if (spec.toast && !watching) toast(body, spec.toast);

    if (spec.notify && state.user) {
      Store.notify(state.user.id, {
        type: spec.type, icon: spec.icon, title: spec.title,
        body, href: '#/ops',
      });
      paintNotifBadge();
    }
  },

  /* The shared record changed under us. Work out whether anything arrived
     that somebody should be told about, rather than announcing the write
     itself — a record version going up says nothing on its own. */
  pendingRecord: false,
  knownApps: null,
  knownTickets: null,
  knownReplies: null,

  onRecordChanged() {
    this.pendingRecord = false;
    const db = Store.db;
    const apps = new Set((db.applications || []).map((a) => a.id));
    const tickets = new Set((db.tickets || [])
      .filter((t) => t.status !== 'resolved').map((t) => t.id));
    /* how much has been said on each thread, so a reply is spotted as
       readily as a new request */
    const replies = new Map((db.tickets || []).map((t) => [t.id, (t.messages || []).length]));

    /* first pass only learns what is already there — everything would
       otherwise look new the moment the console opened */
    if (this.knownApps === null) {
      this.knownApps = apps;
      this.knownTickets = tickets;
      this.knownReplies = replies;
      render();
      return;
    }

    if (can('recruitment.manage')) {
      (db.applications || []).forEach((a) => {
        if (this.knownApps.has(a.id)) return;
        Store.notify(state.user.id, {
          type: 'info', icon: 'userPlus', title: 'A driver has applied',
          body: a.name + ' has applied to drive for Heavyline.',
          href: '#/recruitment',
        });
        toast(a.name + ' has applied to drive', 'ok');
      });
    }

    if (can('admin.view')) {
      (db.tickets || []).forEach((x) => {
        const d = Store.driver(x.driverId);
        const who = d ? d.name : x.driverId;

        if (x.status !== 'resolved' && !this.knownTickets.has(x.id)) {
          Store.notify(state.user.id, {
            type: 'warn', icon: 'lifeBuoy', title: 'New support request',
            body: who + ': ' + (x.subject || 'needs help'),
            href: '#/ticket/' + x.id,
          });
          toast('Support request from ' + who, 'warn');
          return;                       /* the request itself is the news */
        }

        /* somebody has written on a thread we already knew about */
        const before = this.knownReplies.get(x.id);
        const after = (x.messages || []).length;
        if (before == null || after <= before) return;
        const last = (x.messages || [])[after - 1];
        if (!last || last.from === 'staff') return;   /* our own side of it */
        toast(who + ' replied on ' + (x.subject || 'a support request'), 'info');
      });
    }

    this.knownApps = apps;
    this.knownTickets = tickets;
    this.knownReplies = replies;
    render();
  },
};

/* the bell in the top bar, without redrawing the page for it */
function paintNotifBadge() {
  if (!state.user) return;
  const btn = document.querySelector('[data-act="notif-drawer"]');
  if (!btn) return;
  const has = Store.unreadCount(state.user.id) > 0;
  const dot = btn.querySelector('.dot');
  if (has && !dot) btn.insertAdjacentHTML('beforeend', '<span class="dot"></span>');
  else if (!has && dot) dot.remove();
}

function jsonOrNull(raw) {
  try { return JSON.parse(raw); } catch (e) { return null; }
}


/* ============================================================
   LIVE OPERATIONS
   ------------------------------------------------------------
   One picture of a driver, assembled from the three places that
   each know part of it:

     the roster      who they are, what they have done, what they
                     have earned — the company record
     the stream      where they are this second, how fast, and the
                     run they are on — pushed from their client
     the sessions    whether the game is up and how long it has
                     been — written by their client when it opens

   None of them is enough on its own. The stream is the freshest
   but only exists while a client is reporting; the record is
   durable but a minute behind; a session says the game is running
   even when the truck is parked. Read together they answer the
   question the console actually asks: what is this driver doing
   right now?

   Order matters. A driver reporting live is described from the
   stream, because that is the truth of the moment. Only when
   nobody is reporting do we fall back to what was last written.
   ============================================================ */

/* how stale a stream position may be before it stops meaning "now" */
const LIVE_WINDOW = 95000;

const OPS_STATES = {
  driving:   { label: 'On a job',   tone: 'ok',    order: 0 },
  rolling:   { label: 'Driving',    tone: 'info',  order: 1 },
  stopped:   { label: 'Stopped',    tone: 'warn',  order: 2 },
  ingame:    { label: 'In game',    tone: 'info',  order: 3 },
  online:    { label: 'Online',     tone: 'ok',    order: 4 },
  offline:   { label: 'Offline',    tone: '',      order: 5 },
};

const Ops = {
  /* the live frame for one driver, or null if nobody is reporting them */
  liveFor(driverId) {
    const d = (LiveMap.drivers || []).find((x) => x.id === driverId);
    if (!d) return null;
    if (d.at && Date.now() - d.at > LIVE_WINDOW) return null;
    return d;
  },

  /* one row per driver on the books, richest first */
  rows() {
    const now = Date.now();
    return (Store.db.drivers || []).map((d) => {
      const live = this.liveFor(d.id);
      const session = openSessionFor(d.id);
      const seen = d.lastSeen ? new Date(d.lastSeen).getTime() : 0;
      const recentlySeen = now - seen < PRESENCE_WINDOW;

      /* the stream wins when it has something to say */
      let state;
      if (live && live.job && (live.speed || 0) >= 5) state = 'driving';
      else if (live && live.job) state = 'stopped';
      else if (live && (live.speed || 0) >= 5) state = 'rolling';
      else if (live || session) state = 'ingame';
      else if (recentlySeen) state = 'online';
      else state = 'offline';

      const job = live && live.job ? live.job : null;

      return {
        driver: d,
        live,
        session,
        state,
        job,
        progress: job && Number.isFinite(+job.progress) ? clamp(+job.progress, 0, 100) : null,
        etaMin: job && Number.isFinite(+job.etaMin) ? +job.etaMin : null,
        speed: live ? Math.round(live.speed || 0) : null,
        truck: (live && live.truck) || d.truck || '',
        sessionMin: session
          ? Math.max(0, Math.round((now - new Date(session.started).getTime()) / 60000))
          : null,
        openTickets: (Store.db.tickets || [])
          .filter((t) => t.driverId === d.id && t.status !== 'resolved').length,
      };
    }).sort((a, b) =>
      OPS_STATES[a.state].order - OPS_STATES[b.state].order
      || (b.speed || 0) - (a.speed || 0)
      || a.driver.name.localeCompare(b.driver.name));
  },

  /* the headline counts along the top of the console */
  tally(rows) {
    const t = { onJob: 0, playing: 0, online: 0, offline: 0, total: rows.length };
    rows.forEach((r) => {
      if (r.state === 'driving' || r.state === 'stopped') t.onJob++;
      if (r.state !== 'offline' && r.state !== 'online') t.playing++;
      if (r.state !== 'offline') t.online++;
      else t.offline++;
    });
    return t;
  },
};

function hqLiveDot() {
  if (!LiveMap.service()) return `<span class="livedot off" id="hqLiveDot">Offline</span>`;
  if (HQLive.status === 'live') return `<span class="livedot on" id="hqLiveDot" title="Pushed live from the company service">Live</span>`;
  if (HQLive.status === 'connecting') return `<span class="livedot wait" id="hqLiveDot">Linking</span>`;
  return `<span class="livedot wait" id="hqLiveDot" title="${esc(HQLive.lastError || 'polling')}">Polling</span>`;
}

/* what the fleet has just done, newest first */
function hqLiveFeedInner() {
  if (!HQLive.events.length) {
    return `<div class="hqfeed-empty">Runs appear here the moment a driver picks one up.</div>`;
  }
  return HQLive.events.slice(-8).reverse().map((e) => `
    <div class="hqfeed-row ${esc(e.level || 'info')}">
      <span class="hqfeed-time">${esc(fmt.time(e.at))}</span>
      <span class="hqfeed-text">${esc(e.text || e.kind)}</span>
    </div>`).join('');
}

/* ============================================================
   PROVING WHO WE ARE TO THE SERVICE
   ------------------------------------------------------------
   Signing in has always been a local matter: the browser checked
   the password against the account it holds and set state.user.
   That is fine for deciding what to draw, and worthless for
   deciding what the service should believe — a page can set
   state.user to anything.

   So a sign-in now also asks the service for a token, using the
   same credentials it just checked. The token is what every
   request carrying an identity is sent with, and the service
   derives the driver from it rather than from anything we say.

   It is deliberately not required for the app to work. A company
   with no service, or one that is down, still signs people in and
   still runs — they simply cannot use the parts that need a
   proven identity, and those parts say so rather than pretending.
   ============================================================ */
const AUTH_TOKEN_KEY = 'hll.token.v1';

const ServiceAuth = {
  token: null,
  driver: null,          /* what the SERVICE says we are, not what we say */
  status: 'off',         /* off | signed-in | rejected | unreachable */
  lastError: null,

  load() {
    try {
      const raw = JSON.parse(localStorage.getItem(AUTH_TOKEN_KEY) || 'null');
      if (raw && raw.token) { this.token = raw.token; this.driver = raw.driver || null; }
    } catch (e) { /* nothing kept */ }
  },

  keep() {
    try {
      if (this.token) {
        localStorage.setItem(AUTH_TOKEN_KEY,
          JSON.stringify({ token: this.token, driver: this.driver }));
      } else {
        localStorage.removeItem(AUTH_TOKEN_KEY);
      }
    } catch (e) { /* private mode; the token simply will not persist */ }
  },

  /* The live channel is opened at boot, before anybody has signed in, so
     it is anonymous — and the service cannot deliver a private message or
     a ringing call to a stream it cannot put a name to. Signing in has to
     open it again, now that there is a token to open it with. */
  reopenStream() {
    try {
      if (typeof HQLive === 'undefined' || !Sync.url()) return;
      HQLive.stop();
      HQLive.start();
      Messages.pullThreads().then(paintUnreadBadge);
    } catch (e) {
      console.warn('[HLL] could not reopen the live channel:', e.message);
    }
  },

  /* headers for a request that carries an identity */
  headers(extra) {
    const h = Object.assign({ 'Content-Type': 'application/json' }, extra || {});
    if (this.token) h.Authorization = 'Bearer ' + this.token;
    return h;
  },

  on() { return !!this.token; },

  /* Exchange the credentials the browser just accepted for a token. Called
     from the sign-in path, so a driver never types their password twice. */
  async login(email, password) {
    const base = Sync.url();
    if (!base) { this.status = 'off'; return false; }
    try {
      const res = await fetch(base + '/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      if (res.status === 401 || res.status === 403) {
        const body = await res.json().catch(() => ({}));
        this.token = null; this.driver = null;
        this.status = 'rejected';
        this.lastError = body.error || 'the service did not accept those details';
        this.keep();
        return false;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const body = await res.json();
      this.token = body.token;
      this.driver = body.driver || null;
      this.status = 'signed-in';
      this.lastError = null;
      this.keep();
      this.reopenStream();
      return true;
    } catch (err) {
      this.status = 'unreachable';
      this.lastError = err.message;
      return false;
    }
  },

  /* is the token we are holding still good? */
  async check() {
    const base = Sync.url();
    if (!base || !this.token) { this.status = this.token ? 'off' : 'off'; return false; }
    try {
      const res = await fetch(base + '/api/auth/me', { headers: this.headers() });
      if (res.status === 401) {
        this.token = null; this.driver = null;
        this.status = 'rejected';
        this.keep();
        return false;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);
      this.driver = await res.json();
      this.status = 'signed-in';
      this.keep();
      return true;
    } catch (err) {
      this.status = 'unreachable';
      this.lastError = err.message;
      return false;
    }
  },

  async logout() {
    const base = Sync.url();
    if (base && this.token) {
      try {
        await fetch(base + '/api/auth/logout', { method: 'POST', headers: this.headers() });
      } catch (e) { /* the token expires on its own anyway */ }
    }
    this.token = null; this.driver = null; this.status = 'off';
    this.keep();
  },

  /* Why a driver cannot use convoy chat, said plainly. Used by the UI rather
     than showing an empty box with no explanation. */
  reason() {
    if (!Sync.url()) return 'Convoy chat needs the company service. Connect one in Settings.';
    if (this.status === 'rejected') {
      return 'The service did not recognise this account' +
        (this.lastError ? ' — ' + this.lastError : '') + '. Sign in again.';
    }
    if (this.status === 'unreachable') return 'The company service is not answering. Chat will reconnect on its own.';
    if (!this.token) return 'Sign in again to use convoy chat — this browser has no proof of who you are.';
    return null;
  },
};


/* ============================================================
   LIVE CONVOY MODE
   ------------------------------------------------------------
   A convoy already existed here as a scheduled event with a
   route, a leader, a slot count and a registration list. None of
   that is replaced. What this adds is the live half: what is
   happening while the convoy is actually rolling.

   The join is deliberate. A convoy's *roster* lives on the
   company record, because it has to survive and be the same on
   every machine. A convoy's *position picture* comes from the
   same telemetry stream the fleet board already uses, because a
   driver on a convoy is just a driver reporting, and giving
   convoys their own position feed would mean two answers to the
   same question.

   So: roster from the record, presence from the stream, and this
   module is where the two are read together.
   ============================================================ */

/* The five states a convoy can be in. 'starting' is derived rather than
   stored — a stored one goes stale the moment nobody is looking at it, and
   "is it nearly time" is a question about the clock, not about the record. */
const CONVOY_STATES = {
  scheduled: { label: 'Scheduled',     tone: '',       order: 1 },
  starting:  { label: 'Starting soon', tone: 'warn',   order: 0 },
  live:      { label: 'Live',          tone: 'ok',     order: 0 },
  completed: { label: 'Completed',     tone: '',       order: 2 },
  cancelled: { label: 'Cancelled',     tone: 'danger', order: 3 },
};

/* how long before departure a convoy counts as starting soon */
const CONVOY_SOON_MS = 30 * 60 * 1000;

const Convoy = {
  /* the state to show, which is not always the state that is stored */
  stateOf(e) {
    if (!e) return 'scheduled';
    if (e.status === 'live' || e.status === 'completed' || e.status === 'cancelled') return e.status;
    const when = new Date(e.date).getTime();
    if (Number.isFinite(when) && when - Date.now() <= CONVOY_SOON_MS && when > Date.now() - 6 * 3.6e6) {
      return 'starting';
    }
    return 'scheduled';
  },

  isLive(e) { return e && e.status === 'live'; },

  badge(e) {
    const st = this.stateOf(e);
    const spec = CONVOY_STATES[st];
    return `<span class="badge ${spec.tone}">${
      st === 'live' ? '<span class="live-dot"></span>' : ''}${esc(spec.label)}</span>`;
  },

  /* ---- the roster, read together with who is actually reporting ----
     One row per registered driver: what the record knows about them, plus
     what the stream knows right now. A driver with no live frame is not
     guessed at — they are reported as not connected, which is the honest
     answer and the one a convoy controller needs. */
  participants(e) {
    if (!e) return [];
    const leaderId = e.leaderId;
    return (e.registered || []).map((r) => {
      const d = Store.driver(r.driverId);
      const live = Ops.liveFor(r.driverId);
      return {
        reg: r,
        driver: d,
        id: r.driverId,
        name: d ? d.name : r.driverId,
        leader: r.driverId === leaderId,
        live,
        connected: !!live,
        speed: live ? Math.round(live.speed || 0) : null,
        truck: (live && live.truck) || (d && d.truck) || '',
        game: live ? live.game : null,
        job: live && live.job ? live.job : null,
        state: r.state || 'registered',
      };
    }).sort((a, b) =>
      (b.leader ? 1 : 0) - (a.leader ? 1 : 0)
      || (b.connected ? 1 : 0) - (a.connected ? 1 : 0)
      || a.name.localeCompare(b.name));
  },

  leaderPosition(e) {
    if (!e || !e.leaderId) return null;
    const live = Ops.liveFor(e.leaderId);
    if (!live || typeof live.lat !== 'number') return null;
    return [live.lat, live.lon];
  },

  /* How far a driver is from the convoy leader — as the crow flies, not by
     road. Only answered when both are actually reporting: an estimate from a
     stale position is worse than saying nothing, because it looks like a
     fact. Everywhere this is shown it is labelled "direct", because a convoy
     controller reading 14 km and finding 30 km of motorway between them is
     worse served by a confident wrong number than by an honest rough one.

     Road distance would need a routing service. The game's own road network
     is in map-data.js and could support one later; until then this does not
     pretend, and nothing here waits on a network call that might not
     answer. */
  distanceFromLeader(e, p) {
    const lead = this.leaderPosition(e);
    if (!lead || !p.live || typeof p.live.lat !== 'number') return null;
    if (p.leader) return 0;
    return Math.round(haversineKm(lead, [p.live.lat, p.live.lon]));
  },

  /* ---- how it is going ---- */
  stats(e) {
    const parts = this.participants(e);
    const joined = parts.length;
    const connected = parts.filter((p) => p.connected).length;
    const completed = (e.registered || []).filter((r) => r.state === 'completed').length;
    const started = e.startedAt ? new Date(e.startedAt).getTime() : null;
    const ended = e.endedAt ? new Date(e.endedAt).getTime() : null;
    const durationMin = started
      ? Math.max(0, Math.round(((ended || Date.now()) - started) / 60000))
      : null;
    return {
      joined, connected, completed,
      slots: e.maxSlots || 0,
      startedAt: e.startedAt || null,
      endedAt: e.endedAt || null,
      durationMin,
      distance: e.distance || 0,
      /* attendance is of those who signed up, not of the whole fleet */
      attendance: joined ? Math.round((completed / joined) * 100) : 0,
      turnout: joined ? Math.round((connected / joined) * 100) : 0,
      jobs: this.jobsDuring(e).length,
    };
  },

  /* Runs delivered by participants while the convoy was actually running.
     Read off the existing job records rather than recorded separately, so a
     convoy cannot disagree with the logbook. */
  jobsDuring(e) {
    if (!e || !e.startedAt) return [];
    const from = new Date(e.startedAt).getTime();
    const to = e.endedAt ? new Date(e.endedAt).getTime() : Date.now();
    const ids = new Set((e.registered || []).map((r) => r.driverId));
    return (Store.db.jobs || []).filter((j) => {
      if (!ids.has(j.driverId) || !j.finished) return false;
      const t = new Date(j.finished).getTime();
      return t >= from && t <= to;
    });
  },

  /* every convoy a driver has taken part in, for their profile */
  historyFor(driverId) {
    return (Store.db.events || [])
      .filter((e) => (e.registered || []).some((r) => r.driverId === driverId))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  driverStats(driverId) {
    const all = this.historyFor(driverId);
    const done = all.filter((e) => {
      const r = (e.registered || []).find((x) => x.driverId === driverId);
      return e.status === 'completed' && r && r.state === 'completed';
    });
    const led = all.filter((e) => e.leaderId === driverId);
    const missed = all.filter((e) => {
      const r = (e.registered || []).find((x) => x.driverId === driverId);
      return e.status === 'completed' && r && r.state !== 'completed';
    });
    return {
      registered: all.length,
      completed: done.length,
      led: led.length,
      missed: missed.length,
      km: done.reduce((sum, e) => sum + (e.distance || 0), 0),
      attendance: (done.length + missed.length)
        ? Math.round((done.length / (done.length + missed.length)) * 100) : null,
    };
  },

  /* ---- writing to the record ----
     Everything that changes a convoy goes through here, so the activity log,
     the notifications and the live broadcast cannot get out of step with the
     change itself. */
  /* The leader drives the convoy, so they are on it. Without this they have
     no row on the board, no truck on the map, and — worst — no position for
     everyone else's "distance from leader" to be measured against. */
  ensureLeader(e) {
    if (!e || !e.leaderId) return false;
    e.registered = e.registered || [];
    if (e.registered.some((r) => r.driverId === e.leaderId)) return false;
    if (!Store.driver(e.leaderId)) return false;      /* not on the roster at all */
    e.registered.unshift({ driverId: e.leaderId, state: 'confirmed', leader: true });
    return true;
  },

  /* Stamp the convoy as changed. Everything that touches one must call this,
     or the change will not survive a merge with another machine. */
  touch(e) { if (e) e.updated = new Date().toISOString(); },

  note(e, kind, text, driverId) {
    this.touch(e);
    e.activity = e.activity || [];
    e.activity.push({
      id: uid('cv'), kind, text,
      driverId: driverId || null,
      at: new Date().toISOString(),
    });
    if (e.activity.length > 200) e.activity = e.activity.slice(-200);
  },

  /* announce it to everyone holding the live stream */
  emit(e, kind, text, level, extra) {
    const base = Sync.url();
    if (!base) return;
    fetch(base + '/api/fleet/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(Object.assign({
        kind,
        convoyId: e.id,
        driverId: (state.user && state.user.id) || '',
        driver: (state.user && state.user.name) || '',
        text: text || '',
        level: level || 'info',
      }, extra || {})),
      keepalive: true,
    }).catch(() => { /* the record is the truth; the stream is only speed */ });
  },

  /* tell the drivers who are on this convoy */
  notifyParticipants(e, payload, exceptId) {
    (e.registered || []).forEach((r) => {
      if (r.driverId === exceptId) return;
      Store.notify(r.driverId, payload);
    });
  },
};


/* ============================================================
   VERIFYING A RUN
   ------------------------------------------------------------
   Once runs are recorded automatically they are worth money, and
   anything worth money will eventually be worth faking. So a
   delivery is not taken on trust: it arrives with what the
   telemetry saw, and this decides whether that story holds
   together.

   The judging is deliberately here and not in the client. A client
   can be patched; if it awarded its own verification the check
   would be worth nothing. What a patched client can still do is
   lie about the numbers — so every test below is a test of the
   numbers against each other, and a lie has to be consistent with
   distance, duration, speed, the odometer and the clock all at
   once to survive.

   Nothing here accuses anybody. It produces a level:

     verified   the evidence is present and consistent
     review     something is missing or unusual — a human should look
     flagged    the numbers contradict each other

   A run from before this existed has no evidence to check and
   comes out as 'legacy' rather than being retrospectively
   accused of anything.
   ============================================================ */

/* Sane bounds for a lorry in ETS2/ATS. Deliberately generous: the job is to
   catch a fabricated run, not to police fast driving. */
const VERIFY = {
  MAX_AVG_KMH: 130,        /* a whole run averaging more than this is not driving */
  MAX_TOP_KMH: 200,        /* the games cap well below this even unlimited */
  MIN_PAY_PER_KM: 0.5,     /* generous either side — cargo rates vary hugely */
  MAX_PAY_PER_KM: 250,
  MAX_KM: 6000,            /* longer than any single route in either game */
  ODO_TOLERANCE: 0.45,     /* the odometer may differ from the routed distance */
  CLOCK_SKEW_MS: 10 * 60 * 1000,
};

/* One check: { ok, level, label, detail } — level only matters when !ok */
function verifyJob(job) {
  if (!job) return null;
  const e = job.evidence;
  const checks = [];
  const add = (ok, level, label, detail) => checks.push({ ok, level, label, detail });

  const km = Number(job.km) || 0;
  const income = Number(job.income) || 0;
  const started = job.started ? new Date(job.started).getTime() : null;
  const finished = job.finished ? new Date(job.finished).getTime() : null;
  const elapsedMin = (started && finished) ? (finished - started) / 60000 : null;

  /* ---- 1. is there any evidence at all? ---- */
  if (!e || typeof e !== 'object') {
    return {
      level: 'legacy', score: null, checks: [{
        ok: false, level: 'review', label: 'No telemetry record',
        detail: 'This run was recorded before deliveries carried their evidence, '
          + 'so there is nothing to check it against.',
      }],
    };
  }

  add(!!e.telemetry && e.frames > 0, 'flagged', 'Seen by telemetry',
    e.frames ? e.frames + ' frames read from the game while this run was open'
             : 'The client never read a single frame from the game for this run');

  /* ---- 2. did the game end the run, or did something else? ---- */
  add(e.closedBy === 'telemetry', 'review', 'Delivered in game',
    e.closedBy === 'telemetry'
      ? 'The job disappeared from the game, which is what delivering it does'
      : 'The run was closed by ' + (e.closedBy || 'something other than the game'));

  /* ---- 3. was the truck ever actually moving? ---- */
  const movedShare = e.frames ? (e.movingFrames || 0) / e.frames : 0;
  add(km === 0 || movedShare > 0.05, 'flagged', 'The truck moved',
    Math.round(movedShare * 100) + '% of frames had the truck above 5 km/h');

  /* ---- 4. does the odometer agree with the distance claimed? ---- */
  if (e.odoKm != null && km > 0) {
    const drift = Math.abs(e.odoKm - km) / km;
    add(drift <= VERIFY.ODO_TOLERANCE, 'flagged', 'Odometer agrees',
      'The odometer turned ' + fmt.km(e.odoKm) + ' against ' + fmt.km(km) + ' claimed'
      + ' (' + Math.round(drift * 100) + '% apart)');
  }

  /* ---- 5. is the time it took possible for the distance? ---- */
  if (elapsedMin != null && km > 0) {
    const impliedKmh = km / (elapsedMin / 60);
    add(elapsedMin > 0 && impliedKmh <= VERIFY.MAX_AVG_KMH, 'flagged', 'Time taken is possible',
      fmt.km(km) + ' in ' + fmt.dur(elapsedMin) + ' is an average of '
      + Math.round(impliedKmh) + ' km/h');
  } else if (km > 0) {
    add(false, 'review', 'Time taken is possible',
      'The run has no start or finish time to check against');
  }

  /* ---- 6. top speed within what the game can do ---- */
  if (e.topSpeed) {
    add(e.topSpeed <= VERIFY.MAX_TOP_KMH, 'flagged', 'Top speed is possible',
      'Fastest seen was ' + e.topSpeed + ' km/h');
  }

  /* ---- 7. is the distance itself possible? ---- */
  add(km > 0 && km <= VERIFY.MAX_KM, km > VERIFY.MAX_KM ? 'flagged' : 'review',
    'Distance is possible',
    fmt.km(km) + (km > VERIFY.MAX_KM ? ' is longer than any route in either game' : ''));

  /* ---- 8. does the money make sense for the distance? ---- */
  if (km > 0 && income > 0) {
    const perKm = income / km;
    add(perKm >= VERIFY.MIN_PAY_PER_KM && perKm <= VERIFY.MAX_PAY_PER_KM,
      'flagged', 'Payment is in range',
      fmt.eur(Math.round(perKm)) + ' per km across ' + fmt.km(km));
  }

  /* ---- 9. does the clock behave? ---- */
  if (started && finished) {
    add(finished > started, 'flagged', 'Finished after it started',
      finished > started ? 'in order' : 'This run finished before it began');
    add(finished <= Date.now() + VERIFY.CLOCK_SKEW_MS, 'flagged', 'Not in the future',
      finished > Date.now() + VERIFY.CLOCK_SKEW_MS
        ? 'Delivered ' + fmt.rel(job.finished) : 'in the past');
  }

  /* ---- 10. does it overlap another run by the same driver? ---- */
  if (started && finished && job.driverId) {
    const clash = (Store.db.jobs || []).find((o) => {
      if (o === job || o.id === job.id || o.driverId !== job.driverId) return false;
      const os = o.started ? new Date(o.started).getTime() : null;
      const of = o.finished ? new Date(o.finished).getTime() : null;
      if (!os || !of) return false;
      return os < finished && of > started;        /* the intervals cross */
    });
    add(!clash, 'flagged', 'One run at a time',
      clash ? 'Overlaps ' + clash.id + ', which the same driver was also running'
            : 'No overlap with another run');
  }

  /* ---- the verdict ----
     Any failed check that is itself a contradiction flags the run; anything
     merely missing asks for a human. */
  const failed = checks.filter((c) => !c.ok);
  const level = failed.some((c) => c.level === 'flagged') ? 'flagged'
    : failed.length ? 'review'
    : 'verified';

  return {
    level,
    score: Math.round((checks.length - failed.length) / Math.max(1, checks.length) * 100),
    checks,
    failed: failed.length,
  };
}

/* Cached, because the console draws it for every row on every stream frame
   and the answer only changes when the run does. */
const _verifyCache = new Map();
function verificationOf(job) {
  if (!job || !job.id) return null;
  const stamp = (job.finished || '') + '|' + (job.income || 0) + '|' + (job.km || 0);
  const hit = _verifyCache.get(job.id);
  if (hit && hit.stamp === stamp) return hit.result;
  const result = verifyJob(job);
  _verifyCache.set(job.id, { stamp, result });
  return result;
}

/* every run that wants a human to look at it */
function flaggedJobs() {
  return (Store.db.jobs || [])
    .map((j) => ({ job: j, v: verificationOf(j) }))
    .filter((x) => x.v && (x.v.level === 'flagged' || x.v.level === 'review'))
    .sort((a, b) => new Date(b.job.finished) - new Date(a.job.finished));
}

const VERIFY_BADGE = {
  verified: ['ok', 'checkCircle', 'Verified'],
  review:   ['warn', 'eye', 'Needs a look'],
  flagged:  ['danger', 'alert', 'Flagged'],
  legacy:   ['', 'info', 'Unchecked'],
};

function verifyBadge(v) {
  if (!v) return '';
  const [tone, ic, label] = VERIFY_BADGE[v.level] || VERIFY_BADGE.legacy;
  return `<span class="badge ${tone}" title="${esc(
    v.level === 'verified' ? 'Every check on this run passed'
    : v.failed + ' of ' + v.checks.length + ' checks did not pass'
  )}">${icon(ic)}${esc(label)}</span>`;
}

/* the full working, for somebody deciding what to do about a run */
function openJobVerification(jobId) {
  const job = (Store.db.jobs || []).find((j) => j.id === jobId);
  if (!job) { toast('That run is not on the record', 'warn'); return; }
  const v = verificationOf(job);
  const d = Store.driver(job.driverId);
  const e = job.evidence || {};

  openModal({
    title: 'Run ' + job.id, size: 'wide',
    body: `
      <div class="row-b wrap gap-12 mb-16">
        <div class="row gap-12">
          ${d ? avatar(d, 40) : ''}
          <div>
            <div class="b7">${esc(d ? d.name : job.driverId || 'Unknown driver')}</div>
            <div class="xs t3 mt-4">${esc(cityLabel(job.from || '?'))} → ${esc(cityLabel(job.to || '?'))}
              · ${esc(job.cargo || 'cargo')} · ${fmt.km(job.km || 0)} · ${fmt.eur(job.income || 0)}</div>
          </div>
        </div>
        ${verifyBadge(v)}
      </div>

      <div class="verify-list">
        ${(v.checks || []).map((c) => `
          <div class="verify-row ${c.ok ? 'ok' : c.level}">
            <span class="verify-ico">${icon(c.ok ? 'check' : c.level === 'flagged' ? 'alert' : 'eye')}</span>
            <div style="min-width:0">
              <div class="b6">${esc(c.label)}</div>
              <div class="xs t3 mt-4">${esc(c.detail)}</div>
            </div>
          </div>`).join('')}
      </div>

      <div class="card mt-16"><div class="card-head"><div class="card-title">${icon('info')}What the client recorded</div></div>
        <div class="card-body">
          ${kv('Telemetry frames', fmt.n(e.frames || 0))}
          ${kv('Frames with the truck moving', fmt.n(e.movingFrames || 0))}
          ${kv('Odometer turned', e.odoKm != null ? fmt.km(e.odoKm) : '—')}
          ${kv('Average speed', e.avgSpeed ? e.avgSpeed + ' km/h' : '—')}
          ${kv('Top speed', e.topSpeed ? e.topSpeed + ' km/h' : '—')}
          ${kv('Closed by', esc(e.closedBy || 'unknown'))}
          ${kv('Started', job.started ? esc(fmt.dt(job.started)) : '—')}
          ${kv('Finished', job.finished ? esc(fmt.dt(job.finished)) : '—')}
          ${kv('Time on the run', job.duration ? esc(fmt.dur(job.duration)) : '—')}
          ${kv('Client build', esc(e.client || 'unknown'))}
        </div>
      </div>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Close</button>
      ${d ? `<button class="btn" data-act="go" data-href="#/driver/${esc(d.id)}">${icon('user')}Open driver</button>` : ''}`,
  });
}


/* A driver's convoy record, read off the convoys themselves rather than from
   a counter — so it cannot drift from what actually happened, and it can show
   the individual convoys behind the number. */
function driverConvoyStatsHTML(d) {
  const cs = Convoy.driverStats(d.id);
  const recent = Convoy.historyFor(d.id).slice(0, 6);

  return `
  <div class="card">
    <div class="card-head"><div class="card-title">${icon('route')}Convoys</div>
      <span class="badge">${fmt.n(cs.registered)}</span></div>
    <div class="card-body">
      ${kv('Registered for', fmt.n(cs.registered))}
      ${kv('Completed', fmt.n(cs.completed))}
      ${kv('Led', fmt.n(cs.led))}
      ${kv('Attendance', cs.attendance == null
        ? '<span class="t3">no completed convoys yet</span>'
        : `<span class="mono">${cs.attendance}%</span>`)}
      ${kv('Convoy distance', fmt.km(cs.km))}

      ${recent.length ? `<div class="divider"></div>
        <div class="col gap-8">${recent.map((e) => {
          const r = (e.registered || []).find((x) => x.driverId === d.id);
          return `<div class="ops-ticket" data-act="go" data-href="#/convoy/${esc(e.id)}">
            <div style="min-width:0">
              <div class="b6" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(e.name)}</div>
              <div class="xs t3 mt-4">${esc(fmt.date(e.date))} · ${fmt.km(e.distance || 0)}${
                e.leaderId === d.id ? ' · led' : ''}</div>
            </div>
            ${r && r.state === 'completed'
              ? '<span class="badge ok">Completed</span>'
              : Convoy.badge(e)}
          </div>`;
        }).join('')}</div>` : ''}
    </div>
  </div>`;
}


/* ============================================================
   A DRIVER'S HISTORY
   ------------------------------------------------------------
   Everything the company has recorded about one driver, in the
   order it happened: the sittings they played, the runs they
   delivered, what those paid, and anything they asked for help
   with.

   All of it is read back out of the shared company record, so it
   is the same history whichever machine is looking — and the runs
   carry the money, so the earnings here and the earnings on the
   console are the same figures counted the same way.
   ============================================================ */
function driverHistoryHTML(d) {
  const sessions = sessionsFor(d.id);
  const runs = (Store.db.jobs || [])
    .filter((j) => j.driverId === d.id)
    .sort((a, b) => new Date(b.finished) - new Date(a.finished));
  const tickets = (Store.db.tickets || [])
    .filter((t) => t.driverId === d.id)
    .sort((a, b) => new Date(b.updated || b.created) - new Date(a.updated || a.created));

  const week = Date.now() - 7 * DAY;
  const monthFrom = new Date(new Date().getFullYear(), new Date().getMonth(), 1).getTime();
  const hoursAll = sessionMinutes(d.id) / 60;
  const hoursMonth = sessionMinutes(d.id, monthFrom) / 60;
  const open = openSessionFor(d.id);

  const perHour = hoursAll > 0.5 ? (d.earned || 0) / hoursAll : null;

  return `
  <div class="grid g-main">
    <div class="col gap-20">

      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('package')}Runs delivered</div>
          <span class="badge">${fmt.n(runs.length)}</span>
        </div>
        <div class="card-body">
          ${runs.length ? `<div class="table-wrap"><table class="tbl">
            <thead><tr><th>Run</th><th>Route</th><th>Cargo</th>
              <th class="right">Distance</th><th class="right">Paid</th>
              <th class="right">Time</th><th>Delivered</th><th>Checked</th></tr></thead>
            <tbody>${runs.slice(0, 40).map((j) => `<tr data-act="verify-job" data-id="${esc(j.id)}">
              <td class="mono t3">${esc(j.id)}</td>
              <td>${esc(cityLabel(j.from || '?'))} <span class="t3">→</span> ${esc(cityLabel(j.to || '?'))}</td>
              <td class="t2">${esc(j.cargo || '—')}</td>
              <td class="right mono">${fmt.km(j.km || 0)}</td>
              <td class="right mono" style="color:var(--ok)">${fmt.eur(j.income || 0)}</td>
              <td class="right mono t2">${j.duration ? esc(fmt.dur(j.duration)) : '—'}</td>
              <td class="t2">${esc(fmt.rel(j.finished))}</td>
              <td>${verifyBadge(verificationOf(j))}</td>
            </tr>`).join('')}</tbody></table></div>
            ${runs.length > 40 ? `<div class="xs t3 mt-8">Showing the most recent 40 of ${fmt.n(runs.length)}.</div>` : ''}`
          : emptyState('package', 'No runs recorded yet',
              'Runs appear here as they are delivered in game and submitted by the client.')}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('play')}Game sessions</div>
          <span class="badge ${open ? 'ok' : ''}">${open ? 'Playing now' : fmt.n(sessions.length)}</span>
        </div>
        <div class="card-body">
          ${sessions.length ? `<div class="table-wrap"><table class="tbl">
            <thead><tr><th>Started</th><th>Game</th><th class="right">Length</th>
              <th class="right">Runs</th><th class="right">Distance</th><th class="right">Earned</th></tr></thead>
            <tbody>${sessions.slice(0, 25).map((x) => {
              const live = !x.ended;
              const mins = live
                ? Math.round((Date.now() - new Date(x.started).getTime()) / 60000)
                : (x.minutes || 0);
              return `<tr${live ? ' class="me-row"' : ''}>
                <td class="t2">${esc(fmt.dt(x.started))}</td>
                <td>${esc(mapLabel(x.game))}</td>
                <td class="right mono">${esc(fmt.dur(mins))}${
                  live ? ' <span class="badge ok">live</span>'
                       : (x.abandoned ? ' <span class="badge" title="The client stopped reporting; the session was closed automatically">est.</span>' : '')}</td>
                <td class="right mono">${fmt.n(x.jobs || 0)}</td>
                <td class="right mono">${fmt.km(x.km || 0)}</td>
                <td class="right mono" style="color:var(--ok)">${fmt.eur(x.earned || 0)}</td>
              </tr>`;
            }).join('')}</tbody></table></div>`
          : emptyState('play', 'No sessions recorded yet',
              'A session opens by itself when their client sees the game start.')}
        </div>
      </div>

      <div class="card">
        <div class="card-head">
          <div class="card-title">${icon('lifeBuoy')}Support requests</div>
          <span class="badge ${tickets.some((t) => t.status !== 'resolved') ? 'warn' : ''}">${fmt.n(tickets.length)}</span>
        </div>
        <div class="card-body">
          ${tickets.length ? `<div class="col gap-8">${tickets.slice(0, 10).map((t) => `
            <div class="ops-ticket" data-act="go" data-href="#/ticket/${esc(t.id)}">
              <div style="min-width:0">
                <div class="b6" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(t.subject || 'Support request')}</div>
                <div class="xs t3 mt-4">${esc(t.id)} · ${esc(fmt.rel(t.updated || t.created))}${
                  (t.messages || []).length ? ' · ' + (t.messages || []).length + ' message(s)' : ''}</div>
              </div>
              <span class="badge ${t.status === 'resolved' ? 'ok' : t.status === 'in_progress' ? 'info' : 'warn'}">${
                esc(t.status === 'in_progress' ? 'In progress' : t.status === 'resolved' ? 'Resolved' : 'Open')}</span>
            </div>`).join('')}</div>`
          : emptyState('lifeBuoy', 'Nothing raised',
              'This driver has not asked for help through the platform.')}
        </div>
      </div>
    </div>

    <div class="col gap-20">
      ${driverConvoyStatsHTML(d)}

      <div class="card">
        <div class="card-head"><div class="card-title">${icon('star')}Earnings</div></div>
        <div class="card-body">
          ${kv('All time', `<span class="mono" style="color:var(--ok)">${fmt.eur(d.earned || 0)}</span>`)}
          ${kv('This month', `<span class="mono">${fmt.eur(d.monthEarned || 0)}</span>`)}
          ${kv('This week', `<span class="mono">${fmt.eur(d.weekEarned || 0)}</span>`)}
          ${kv('Per run', `<span class="mono">${fmt.eur(Math.round((d.earned || 0) / Math.max(1, d.deliveries || 0)))}</span>`)}
          ${perHour != null
            ? kv('Per hour driven', `<span class="mono">${fmt.eur(Math.round(perHour))}</span>`)
            : kv('Per hour driven', '<span class="t3">not enough time logged</span>')}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">${icon('clock')}Time at the wheel</div></div>
        <div class="card-body">
          ${kv('All time', `<span class="mono">${esc(fmt.dur(hoursAll * 60))}</span>`)}
          ${kv('This month', `<span class="mono">${esc(fmt.dur(hoursMonth * 60))}</span>`)}
          ${kv('Sessions', `<span class="mono">${fmt.n(sessions.length)}</span>`)}
          ${kv('Average session', sessions.length
            ? `<span class="mono">${esc(fmt.dur(hoursAll * 60 / sessions.length))}</span>`
            : '<span class="t3">—</span>')}
          ${open ? `<div class="mt-12"><span class="livedot on">At the wheel now</span></div>` : ''}
        </div>
      </div>

      <div class="card">
        <div class="card-head"><div class="card-title">${icon('route')}Distance</div></div>
        <div class="card-body">
          ${kv('All time', `<span class="mono">${fmt.km(d.km || 0)}</span>`)}
          ${kv('This month', `<span class="mono">${fmt.km(d.monthKm || 0)}</span>`)}
          ${kv('This week', `<span class="mono">${fmt.km(d.weekKm || 0)}</span>`)}
          ${kv('Per run', `<span class="mono">${fmt.km(Math.round((d.km || 0) / Math.max(1, d.deliveries || 0)))}</span>`)}
        </div>
      </div>
    </div>
  </div>`;
}

/* the game a session was played on, said the way the rest of the app says it */
function mapLabel(game) {
  const m = mapFor(game === 'ats' ? 'ats' : 'ets2');
  return m && m.label ? m.label : 'Euro Truck Simulator 2';
}


/* ============================================================
   LIVE OPERATIONS
   ------------------------------------------------------------
   The console's one screen for "what is happening right now".
   Everything on it is pushed rather than polled, so it is a view
   of the company as it stands rather than as it was when the page
   was opened.

   It answers, in the order a duty manager asks them: who is on,
   what are they playing, what are they hauling, how far along are
   they, what has it earned, and who is waiting on us.
   ============================================================ */
function viewOps() {
  if (!can('admin.view')) {
    return notFound('Access denied',
      'Live Operations is for administrators.', '#/dashboard');
  }

  const rows = Ops.rows();
  const t = Ops.tally(rows);
  const now = Date.now();
  const today = new Date(); today.setHours(0, 0, 0, 0);

  const openTickets = (Store.db.tickets || []).filter((x) => x.status !== 'resolved');
  const pendingApps = (Store.db.applications || [])
    .filter((a) => a.status === 'pending' || a.status === 'review');

  const runsToday = (Store.db.jobs || []).filter((j) => inWindow(j.finished, today.getTime(), now + 1));
  const earnedToday = companyRevenue(today.getTime(), now + 1);
  const earnedWeek = companyRevenue(now - 7 * DAY, now + 1);
  const earnedMonth = companyRevenue(
    new Date(today.getFullYear(), today.getMonth(), 1).getTime(), now + 1);
  const earnedAll = companyRevenue(null, null);

  return `
  <div class="page">
    <div class="page-head">
      <div class="row gap-14">
        ${hllEmblem('md', 'framed')}
        <div><div class="eyebrow">Heavyline Command Center</div>
          <h1 class="page-title">Live Operations</h1>
          <p class="page-sub">Every driver, every run, as it happens</p></div>
      </div>
      <div class="row gap-8">
        ${hqLiveDot()}
        <button class="btn" data-act="go" data-href="#/livemap">${icon('map')}Live map</button>
        <button class="btn" data-act="map-service">${icon('link')}Service</button>
      </div>
    </div>

    ${serviceWarningHTML()}

    <!-- the shape of the shift, at a glance -->
    <div class="ops-tiles">
      ${opsTile('On a job',   t.onJob,   'truck',    'ok',   'drivers hauling right now')}
      ${opsTile('In game',    t.playing, 'play',     'info', 'clients reporting the game up')}
      ${opsTile('Online',     t.online,  'users',    '',     'of ' + t.total + ' on the books')}
      ${opsTile('Runs today', runsToday.length, 'flag', '',   fmt.eur(earnedToday) + ' earned')}
      ${opsTile('Open requests', openTickets.length, 'lifeBuoy',
        openTickets.length ? 'warn' : '', 'drivers waiting on an answer')}
      ${opsTile('Applications', pendingApps.length, 'userPlus',
        pendingApps.length ? 'brand' : '', 'waiting to be reviewed')}
    </div>

    <div class="ops-grid">
      <section class="card">
        <div class="card-head">
          <div class="card-title">${icon('users')}Drivers</div>
          <div class="row gap-8">
            <span class="badge">${t.online} of ${t.total} on</span>
            <div class="tabs sm">
              ${[['board', 'Board'], ['table', 'Table']].map(([k, l]) =>
                `<button class="${(state.ui.opsView || 'board') === k ? 'on' : ''}"
                  data-act="ops-view" data-v="${k}">${l}</button>`).join('')}
            </div>
          </div>
        </div>
        <div class="card-body" id="opsBoard">${opsBoardInner()}</div>
      </section>

      <div class="col gap-16">
        <section class="card">
          <div class="card-head">
            <div class="card-title">${icon('activity')}As it happens</div>
            ${hqLiveDot()}
          </div>
          <div class="card-body"><div class="hqfeed" id="opsFeed">${hqLiveFeedInner()}</div></div>
        </section>

        ${opsFlaggedHTML()}

        <!-- what the fleet has actually taken. Summed straight off the runs,
             so it is the same money the drivers see on their own records. -->
        <section class="card">
          <div class="card-head"><div class="card-title">${icon('star')}Company revenue</div></div>
          <div class="card-body">
            ${kv('Today', `<span class="mono" style="color:var(--ok)">${fmt.eur(earnedToday)}</span>`)}
            ${kv('This week', `<span class="mono">${fmt.eur(earnedWeek)}</span>`)}
            ${kv('This month', `<span class="mono">${fmt.eur(earnedMonth)}</span>`)}
            ${kv('All recorded', `<span class="mono">${fmt.eur(earnedAll)}</span>`)}
            ${kv('Per run', `<span class="mono">${fmt.eur(Math.round(earnedAll
              / Math.max(1, (Store.db.jobs || []).length)))}</span>`)}
          </div>
        </section>

        <section class="card">
          <div class="card-head">
            <div class="card-title">${icon('lifeBuoy')}Waiting on you</div>
            <span class="badge ${openTickets.length ? 'warn' : ''}">${openTickets.length}</span>
          </div>
          <div class="card-body">
            ${openTickets.length ? `<div class="col gap-8">${openTickets.slice(0, 6).map((x) => {
              const d = Store.driver(x.driverId);
              return `<div class="ops-ticket" data-act="go" data-href="#/ticket/${esc(x.id)}">
                <div class="row gap-10" style="min-width:0">
                  ${d ? avatar(d, 32) : `<span class="avatar a-32">?</span>`}
                  <div style="min-width:0">
                    <div class="b6" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(x.subject || 'Support request')}</div>
                    <div class="xs t3 mt-4">${esc(d ? d.name : x.driverId)} · ${esc(fmt.rel(x.updated || x.created))}</div>
                  </div>
                </div>
                <span class="badge ${x.status === 'in_progress' ? 'info' : 'warn'}">${
                  esc(x.status === 'in_progress' ? 'In progress' : 'Open')}</span>
              </div>`;
            }).join('')}</div>
            ${openTickets.length > 6 ? `<button class="btn btn-block mt-12" data-act="go" data-href="#/support">
              View all ${openTickets.length}</button>` : ''}`
            : emptyState('checkCircle', 'Nothing outstanding',
                'Support requests appear here the moment a driver raises one.')}
          </div>
        </section>
      </div>
    </div>
  </div>`;
}

/* Runs whose evidence does not hold together. Deliberately quiet when there
   is nothing wrong — a panel that is always shouting stops being read. */
function opsFlaggedHTML() {
  const flagged = flaggedJobs();
  if (!flagged.length) return '';
  const bad = flagged.filter((x) => x.v.level === 'flagged');

  return `
  <section class="card" style="border-color:${bad.length ? 'rgba(239,95,95,.34)' : 'var(--line)'}">
    <div class="card-head">
      <div class="card-title">${icon('shield')}Runs to check</div>
      <span class="badge ${bad.length ? 'danger' : 'warn'}">${flagged.length}</span>
    </div>
    <div class="card-body">
      <div class="xs t3 mb-12">Recorded automatically, so they are checked automatically.
        ${bad.length ? bad.length + ' contradict themselves; the rest are missing something.'
                     : 'Nothing contradicts itself — these are only missing evidence.'}</div>
      <div class="col gap-8">
        ${flagged.slice(0, 6).map(({ job, v }) => {
          const d = Store.driver(job.driverId);
          return `<div class="ops-ticket" data-act="verify-job" data-id="${esc(job.id)}">
            <div style="min-width:0">
              <div class="b6" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
                ${esc(d ? d.name : job.driverId || 'Unknown')} ·
                ${esc(cityLabel(job.from || '?'))} → ${esc(cityLabel(job.to || '?'))}</div>
              <div class="xs t3 mt-4">${esc(job.id)} · ${fmt.km(job.km || 0)} ·
                ${fmt.eur(job.income || 0)} · ${v.failed} check${v.failed === 1 ? '' : 's'} not passed</div>
            </div>
            ${verifyBadge(v)}
          </div>`;
        }).join('')}
      </div>
      ${flagged.length > 6 ? `<div class="xs t3 mt-12">And ${flagged.length - 6} more.</div>` : ''}
    </div>
  </section>`;
}

function opsTile(label, value, ic, tone, sub) {
  return `<div class="ops-tile ${tone || ''}">
    <span class="ops-ico">${icon(ic)}</span>
    <div class="ops-val">${fmt.n(value)}</div>
    <div class="ops-lab">${esc(label)}</div>
    <div class="ops-sub">${esc(sub)}</div>
  </div>`;
}

/* The board itself. Redrawn on every stream frame, so it is written to be
   cheap and to say only what is true — a driver with no client reporting
   shows what the record last knew, and says so, rather than showing a stale
   speed as though it were current. */
function opsBoardInner() {
  const rows = Ops.rows();
  if (!rows.length) {
    return emptyState('users', 'No drivers on the books',
      'Approved drivers appear here, and light up as their clients report in.');
  }
  if ((state.ui.opsView || 'board') === 'table') return opsTableInner(rows);

  return `<div class="fleetlist">${rows.map((r) => {
    const d = r.driver;
    const st = OPS_STATES[r.state];
    const job = r.job;
    const cls = r.state === 'driving' ? 'rolling'
      : r.state === 'rolling' ? 'moving'
      : r.state === 'stopped' ? 'held'
      : r.state === 'ingame' ? 'moving' : 'idle';

    return `<div class="fleetrow ops-row ${cls}" data-act="go" data-href="#/driver/${esc(d.id)}">
      ${avatar(d, 32)}

      <div class="fr-who">
        <div class="fr-name">${esc(d.name)}</div>
        <div class="fr-truck">${
          r.state === 'offline'
            ? 'last seen ' + esc(fmt.rel(d.lastSeen))
            : (r.truck ? esc(r.truck) : esc(ROLES[d.role] ? ROLES[d.role].name : 'Driver'))
        }</div>
      </div>

      <div class="fr-run">
        ${job ? `
          <div class="fr-route">
            <span>${esc(cityLabel(job.from || '?'))}</span>
            <span class="fr-arrow">${icon('arrowRight')}</span>
            <span class="to">${esc(cityLabel(job.to || '?'))}</span>
            ${job.cargo ? `<span class="fr-cargo">${esc(job.cargo)}</span>` : ''}
          </div>
          ${r.progress != null ? `<div class="fr-bar"><i style="width:${r.progress.toFixed(1)}%"></i></div>` : ''}
          <div class="fr-sub">
            ${r.progress != null ? `<b>${Math.round(r.progress)}%</b>` : ''}
            ${job.km ? `<span>${fmt.km(Math.round(job.drivenKm || 0))} of ${fmt.km(job.km)}</span>` : ''}
            ${r.etaMin != null && r.progress != null && r.progress < 100
              ? `<span>${fmt.dur(r.etaMin)} to run</span>` : ''}
            ${job.income ? `<span>${fmt.eur(job.income)}</span>` : ''}
          </div>`
        : `<div class="fr-noload">${
            r.sessionMin != null
              ? 'In game ' + fmt.dur(r.sessionMin) + ' · no load aboard'
              : r.state === 'offline' ? 'Not reporting' : 'No load aboard'
          }</div>
          <div class="fr-sub">
            <span>${fmt.n(d.deliveries || 0)} runs</span>
            <span>${fmt.kmS(d.km || 0)}</span>
            <span>${fmt.eur(d.earned || 0)} earned</span>
          </div>`}
      </div>

      <div class="fr-state">
        <span class="fr-word"><i class="beat"></i>${esc(st.label)}</span>
        ${r.speed != null
          ? `<span class="fr-speed">${r.speed}<em>km/h</em></span>`
          : `<span class="fr-speed t3" style="font-size:11px">${
              r.openTickets ? r.openTickets + ' open' : '—'}</span>`}
      </div>
    </div>`;
  }).join('')}</div>`;
}

/* The same drivers as a plain list: driver, status, game, job, earnings.
   The board shows a run drawn out; this shows the fleet as a column you can
   read straight down, which is what you want when there are thirty of them. */
function opsTableInner(rows) {
  const dot = (state) => ({
    driving: 'job', stopped: 'job', rolling: 'play', ingame: 'play',
    online: 'on', offline: '',
  }[state] || '');

  return `<div class="table-wrap"><table class="tbl dtable">
    <thead><tr>
      <th>Driver</th><th>Status</th><th>Game</th><th>Job</th><th class="right">Earnings</th>
    </tr></thead>
    <tbody>${rows.map((r) => {
      const d = r.driver;
      const st = OPS_STATES[r.state];
      const job = r.job;
      return `<tr data-act="driver-live" data-id="${esc(d.id)}">
        <td><div class="row gap-10">${avatar(d, 32)}
          <div style="min-width:0">
            <div class="b6" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(d.name)}</div>
            <div class="xs t3 mono">${esc(d.id)}</div>
          </div></div></td>
        <td><span class="dstatus"><span class="ddot ${dot(r.state)}"></span>${esc(st.label)}</span></td>
        <td class="t2">${r.live || r.session
          ? esc(mapShort((r.live && r.live.game) || (r.session && r.session.game)))
          : '<span class="t3">—</span>'}</td>
        <td class="djob">${job
          ? esc(cityLabel(job.from || '?')) + ' <span class="t3">→</span> ' + esc(cityLabel(job.to || '?'))
            + (r.progress != null ? ' <span class="t3">· ' + Math.round(r.progress) + '%</span>' : '')
          : '<span class="t3">None</span>'}</td>
        <td class="right dpay">${fmt.eur(d.earned || 0)}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

/* the game in the short form the table has room for */
function mapShort(game) {
  const m = mapFor(game === 'ats' ? 'ats' : 'ets2');
  return m && m.short ? m.short : 'ETS2';
}

/* repaint the board in place, without rebuilding the page around it */
function paintOps() {
  if (state.route.name !== 'ops') return;
  const board = $('#opsBoard');
  if (board) board.innerHTML = opsBoardInner();
  const feed = $('#opsFeed');
  if (feed) feed.innerHTML = hqLiveFeedInner();
}


/* Who is out there and how far along they are. A run has a shape a table
   cell cannot show, so this draws the route and its progress instead. */
function hqFleetListInner() {
  const rows = LiveMap.drivers.slice().sort((a, b) =>
    ((a.job ? 0 : 1) - (b.job ? 0 : 1)) || (b.speed || 0) - (a.speed || 0));

  if (!rows.length) {
    return emptyState('users', 'Nobody is reporting a position',
      LiveMap.service() ? 'Drivers appear here the moment their client sends a position.'
                        : 'Connect the company service and the crew shows up here, live.');
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

    return `<div class="fleetrow ${cls}">
      <span class="avatar a-32">${esc(initials(d.name || d.id))}</span>

      <div class="fr-who">
        <div class="fr-name">${esc(d.name || d.id)}</div>
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
            ${eta != null && pct != null && pct < 100 ? `<span>${fmt.dur(eta)} to run</span>` : ''}
          </div>`
        : `<div class="fr-noload">No load aboard</div>`}
      </div>

      <div class="fr-state">
        <span class="fr-word"><i class="beat"></i>${word}</span>
        <span class="fr-speed">${Math.round(d.speed || 0)}<em>km/h</em></span>
      </div>
    </div>`;
  }).join('')}</div>

  <div class="hqfeed" id="hqLiveFeed">${hqLiveFeedInner()}</div>`;
}

/* where the fleet service lives, for an administrator to set */
function openFleetService() {
  if (!can('admin.view')) { toast('Administrators only', 'danger'); return; }
  openModal({
    title: 'Company service', size: 'narrow',
    body: `<p class="t2">One address ties every install together: live positions, the roster,
        logins, applications, support requests, dispatched loads and finished runs all travel
        through it. Run it with <span class="mono">npm run fleet</span> and point the platform
        and every client at the same address.</p>
      <div class="field mt-12"><label for="fsUrl">Service address</label>
        <input class="input" id="fsUrl" value="${esc(Store.db.meta.fleetUrl || '')}"
          placeholder="http://your-server:7040"></div>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="fleet-service-save">${icon('check')}Save</button>`,
  });
}

function saveFleetService() {
  const el = $('#fsUrl');
  const url = el ? el.value.trim() : '';
  Store.db.meta.fleetUrl = url;
  Store.db.meta.serviceUrl = url;   /* the same service carries the company */
  Store.save();
  closeModal();
  toast(url ? 'Heavyline service set' : 'Heavyline service cleared', 'ok',
    url ? 'Drivers, applications and support now travel between machines' : '');
  LiveMap.start();
  Sync.start();
  render();
}

/* ---------------- Get the client ----------------
   The tracking client is released to a driver once a recruiter has approved
   them, so the page has two faces: the downloads, or an explanation of what
   is still outstanding. */
/* The version here is the last build that was actually cut and put in
   release/, which is not necessarily the version in package.json — source can
   be ahead of the last installer. Filenames are spelled out rather than built
   from the version because tools/build-www.js reads them straight out of this
   file to decide which builds travel with the site, so after cutting a new
   release change the version and all three filenames together. */
/* Where the installers are served from.

   Not from the website. Cloudflare Pages refuses any single asset over
   25 MiB and the Windows builds are eighty megabytes each, so they can
   never sit beside the site however the build is run — that is a hosting
   limit, not something a flag can fix. release/ is also gitignored, which
   is why the page found nothing next to it.

   GitHub Releases has no such limit, and the tag matches the version below
   so a new release is reachable the moment it is published. Empty falls
   back to the release/ folder next to the site, which is what a local
   checkout has and what npm run dist writes. */
const CLIENT_DOWNLOAD_BASE =
  'https://github.com/JeffBoss315/heavyline/releases/download/v';

/* the file, wherever it is: a full URL when one is configured, otherwise
   the relative path this page has always used */
function clientDownloadUrl(build) {
  if (!CLIENT_DOWNLOAD_BASE) return build.file;
  const name = String(build.file).split('/').pop();
  return CLIENT_DOWNLOAD_BASE + CLIENT_RELEASE.version + '/' + name;
}

const CLIENT_RELEASE = {
  version: '1.0.0',
  builds: [
    { key: 'win-setup', label: 'Windows installer', icon: 'download',
      file: 'release/Heavyline-Trucker-1.0.0-windows-setup.exe',
      size: '80.7 MB', note: 'Installs to your machine and adds a Start menu entry.' },
    { key: 'win-portable', label: 'Windows portable', icon: 'bolt',
      file: 'release/Heavyline-Trucker-1.0.0-windows-portable.exe',
      size: '80.3 MB', note: 'No installation — just run it. Good for a USB stick.' },
    { key: 'android', label: 'Android app', icon: 'phone',
      file: 'release/Heavyline-Trucker-1.0.0-android.apk',
      size: '6.6 MB', note: 'Android 7 or newer. Copy it to the phone and tap it.' },
  ],
};

/* Are the builds actually reachable from where this page is being viewed?

   Two ways they are not, and both used to show a link that simply did
   nothing when pressed:
     - the page was opened straight off the disk, and a browser will not
       save a file:// link from a file:// page;
     - the files are not beside the page, because they were moved or the
       site was deployed without them.

   Checked once per page, and the answer decides what the page offers. */
const Downloads = {
  state: 'unknown',      /* unknown | local | ready | missing */
  missing: [],

  async check() {
    if (location.protocol === 'file:') { this.state = 'local'; return; }
    const missing = [];
    await Promise.all(CLIENT_RELEASE.builds.map(async (b) => {
      try {
        const res = await fetch(b.file, { method: 'HEAD', cache: 'no-store' });
        if (!res.ok) missing.push(b.file);
      } catch (e) { missing.push(b.file); }
    }));
    this.missing = missing;
    this.state = missing.length ? 'missing' : 'ready';
  },
};

function viewDownloads() {
  const u = state.user;
  const allowed = !!u.clientAccess || can('admin.view');
  const app = Store.db.applications.find((a) => a.submittedBy === u.id);

  return `
  <div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Client software</div>
        <h1 class="page-title">Heavyline Trucker</h1>
        <p class="page-sub">The client that tracks your runs and puts you on the live map</p></div>
    </div>

    ${allowed && !CLIENT_DOWNLOAD_BASE && Downloads.state === 'local' ? `
      <div class="card mb-16" style="border-color:var(--warn-line,rgba(217,155,43,.35))">
        <div class="card-body row gap-14 wrap" style="align-items:flex-start">
          <span class="stat-ico" style="flex:none;color:var(--warn)">${icon('alert')}</span>
          <div class="grow" style="min-width:240px">
            <div class="b8">This page was opened straight from the disk</div>
            <p class="t2 sm mt-8">A browser will not save a file from a page opened this way, so the
              buttons below cannot work. Serve the folder and open it over http instead:</p>
            <div class="mono sm mt-10" style="padding:9px 12px;border-radius:8px;background:var(--panel-2)">
              npm run serve</div>
            <p class="t2 sm mt-10">Then open <span class="mono">http://localhost:7000/hq.html</span>
              — or take the files out of the <span class="mono">release</span> folder by hand.</p>
          </div>
        </div>
      </div>` : ''}

    ${allowed && !CLIENT_DOWNLOAD_BASE && Downloads.state === 'missing' ? `
      <div class="card mb-16" style="border-color:rgba(239,95,95,.35)">
        <div class="card-body row gap-14 wrap" style="align-items:flex-start">
          <span class="stat-ico" style="flex:none;color:var(--danger)">${icon('alert')}</span>
          <div class="grow" style="min-width:240px">
            <div class="b8">The builds are not where this page expects them</div>
            <p class="t2 sm mt-8">These are missing next to the site:</p>
            <ul class="mono sm mt-8" style="padding-left:18px">
              ${Downloads.missing.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>
            <p class="t2 sm mt-10">Put the <span class="mono">release</span> folder beside the site,
              or run <span class="mono">npm run dist</span> and
              <span class="mono">npm run android</span> to build them.</p>
          </div>
        </div>
      </div>` : ''}

    ${allowed ? `
      <div class="grid g-3">
        ${CLIENT_RELEASE.builds.map((b, i) => `
          <div class="card reveal d${i + 1}"><div class="card-body">
            <span class="stat-ico">${icon(b.icon)}</span>
            <div class="b8 lg mt-12">${esc(b.label)}</div>
            <p class="sm t2 mt-8">${esc(b.note)}</p>
            <div class="row gap-8 mt-12 xs t3">
              <span class="badge">v${esc(CLIENT_RELEASE.version)}</span>
              <span class="badge">${esc(b.size)}</span>
            </div>
            ${CLIENT_DOWNLOAD_BASE || Downloads.state === 'ready' || Downloads.state === 'unknown'
              ? `<a class="btn btn-primary btn-block mt-16" href="${esc(clientDownloadUrl(b))}"${
                   CLIENT_DOWNLOAD_BASE ? ' rel="noopener"' : ' download'}>
                   ${icon('download')}Download</a>`
              : `<button class="btn btn-block mt-16" disabled>${icon('download')}Not available here</button>`}
          </div></div>`).join('')}
      </div>

      <div class="card mt-20"><div class="card-body">
        <div class="b8">Signing in on the client</div>
        <p class="t2 sm mt-8">Use the same email and password you use here. The client asks for
          them before it tracks anything, then follows your runs, keeps your logbook and reports
          your position to the fleet map.</p>
        <p class="t2 sm mt-8">Windows builds are unsigned, so SmartScreen warns once —
          <b>More info</b> then <b>Run anyway</b>. On Android you will be asked to allow
          installing from this source.</p>
      </div></div>`
    : `
      <div class="card"><div class="card-body center" style="padding:38px 22px">
        <span class="stat-ico" style="margin:0 auto;width:52px;height:52px">${icon('clock')}</span>
        <div class="b8 lg mt-12">Waiting on your application</div>
        <p class="t2 mt-8" style="max-width:520px;margin-inline:auto">
          A recruiter releases the Heavyline Trucker client once they have looked at your
          application. ${app ? 'Yours was filed ' + esc(fmt.rel(app.submitted)) + ' and is '
            + esc(app.status === 'rejected' ? 'closed' : 'with them now') + '.'
            : 'Nothing has been filed under your account yet.'}</p>
        <p class="xs t3 mt-16">You will get a notification here the moment it is released.</p>
      </div></div>`}
  </div>`;
}


/* These are handles on the driver record, not OAuth links — the buttons edit
   them rather than pretending to connect to anything. */
const CONNECTIONS = [
  { key: 'discord', name: 'Discord', icon: 'discord', at: '@', hint: 'yourname',
    note: 'Recruitment and convoy control reach drivers on Discord. This is the name they will look for.' },
  { key: 'truckersmp', name: 'TruckersMP', icon: 'truck', at: '', hint: '1234567',
    note: 'Your TruckersMP account ID, so convoy sign-ups can be matched to you in-game.' },
];

function connection(key) { return CONNECTIONS.find((c) => c.key === key); }

function openDiscordHandle(key) {
  const c = connection(key) || CONNECTIONS[0];
  openModal({
    title: c.name, size: 'narrow',
    body: `<p class="t2">${c.note} It is stored on your Heavyline record.</p>
      <div class="field mt-12"><label for="dc-name">Your ${esc(c.name)} ${c.key === 'discord' ? 'username' : 'ID'}</label>
        <input class="input" id="dc-name" data-key="${esc(c.key)}"
          value="${esc(state.user[c.key] || '')}" placeholder="${esc(c.hint)}"></div>`,
    foot: `<button class="btn btn-ghost" data-act="modal-close">Cancel</button>
      <button class="btn btn-primary" data-act="discord-save">${icon('check')}Save</button>`,
  });
}

function saveDiscordHandle() {
  const el = $('#dc-name');
  if (!el) return;
  const key = el.dataset.key || 'discord';
  setConnection(key, el.value.trim().replace(/^@/, ''));
  closeModal();
}

function setConnection(key, value) {
  const c = connection(key); if (!c) return;
  state.user[key] = value;
  Store.save();
  toast(value ? c.name + ' saved' : c.name + ' removed', 'ok');
  render();
}

function exportData() {
  const payload = {
    exported: new Date().toISOString(),
    driver: state.user,
    company: { drivers: Store.db.drivers.length, fleet: Store.db.trucks.length, events: Store.db.events.length },
    events: Store.db.events.filter((e) => Store.registrationOf(e, state.user.id)),
    achievements: ACHIEVEMENTS.filter((a) => achEarned(a, state.user)).map((a) => a.name),
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url; link.download = `hll-${state.user.id}-export.json`;
  document.body.appendChild(link); link.click(); link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Export ready', 'ok', 'Your driver data has been downloaded.');
}

/* ---------------- 34. Form binding ---------------- */
function bindAuth() {
  const showErr = (form, key, msg) => {
    const el = form.querySelector(`[data-err="${key}"]`);
    const input = form.querySelector(`[name="${key}"]`);
    if (el) { el.textContent = msg || ''; el.classList.toggle('hide', !msg); }
    if (input) input.classList.toggle('err', !!msg);
    return !msg;
  };

  /* ---- first run: create the owner ---- */
  const sf = $('#setupForm');
  if (sf) {
    sf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#su-name').value.trim();
      const email = $('#su-email').value.trim();
      const country = $('#su-country').value;
      const pw = $('#su-pw').value;
      const pw2 = $('#su-pw2').value;
      state.ui.regDraft = { name, email, country };

      let ok = true;
      ok = showErr(sf, 'name', name.length >= 3 ? '' : 'Enter your full name.') && ok;
      ok = showErr(sf, 'email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address.') && ok;
      ok = showErr(sf, 'country', country ? '' : 'Select your country.') && ok;
      ok = showErr(sf, 'pw', pw.length >= 8 ? '' : 'Use at least 8 characters.') && ok;
      ok = showErr(sf, 'pw2', pw && pw === pw2 ? '' : 'The two passwords do not match.') && ok;
      showErr(sf, 'form', '');
      if (!ok) return;

      const btn = sf.querySelector('button[type="submit"]');
      btn.disabled = true;
      /* register() reports a failure by throwing now — Supabase Auth, the
         drivers row and the application all report that way — so the message
         is caught here. Without this the button stays disabled and a taken
         email or a rejected password says nothing. */
      let res;
      try {
        res = await Accounts.register(
          { name, email, discord: '', created: new Date().toISOString(), owner: true },
          pw, country);
      } catch (err) {
        btn.disabled = false;
        showErr(sf, 'form', err.message || 'Could not create the owner account.');
        return;
      }
      btn.disabled = false;

      state.ui.regDraft = {};
      /* the platform is keyed on driver_code, and Supabase issued it */
      const driver = Store.driver(res.driver.driver_code);
      toast('Owner account created', 'ok', 'Heavyline Logistics is yours to run');
      Store.notify(driver.id, {
        type: 'ok', icon: 'shield', title: 'You own this company',
        body: 'Add drivers, vehicles and convoys from the admin console.',
      });
      doLogin(driver, 'Welcome, ' + name.split(' ')[0]);
    });
  }

  /* ---- sign in ---- */
  const f = $('#loginForm');
  if (f) {
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const handle = $('#li-id').value.trim();
      const pw = $('#li-pw').value;
      let ok = true;
      ok = showErr(f, 'id', handle ? '' : 'Enter your email or driver ID.') && ok;
      ok = showErr(f, 'pw', pw ? '' : 'Enter your password.') && ok;
      showErr(f, 'form', '');
      if (!ok) return;

      const btn = f.querySelector('button[type="submit"]');
      btn.disabled = true;
      const res = await Accounts.verify(handle, pw);
      btn.disabled = false;
      if (res.error) { showErr(f, 'form', res.error); return; }

      /* The browser has accepted the password; now prove it to the service
         too, with the same credentials, so the identity on anything we send
         is one the service derived rather than one we asserted. Not fatal if
         it fails — the app runs, and the parts that need proof say why. */
      await ServiceAuth.login(res.account ? res.account.email : handle, pw);

      if (!$('#li-remember').checked) sessionOnly = true;
      doLogin(res.driver);
    });
  }

  /* ---- register ---- */
  const rf = $('#registerForm');
  if (rf) {
    const pwField = $('#rg-pw');
    const meter = $('#pwMeter');
    const hint = $('#pwHint');
    if (pwField) {
      pwField.addEventListener('input', () => {
        const v = pwField.value;
        let score = 0;
        if (v.length >= 8) score++;
        if (v.length >= 12) score++;
        if (/[A-Z]/.test(v) && /[a-z]/.test(v)) score++;
        if (/\d/.test(v)) score++;
        if (/[^A-Za-z0-9]/.test(v)) score++;
        const pct = Math.min(100, score * 20);
        if (meter) meter.style.width = pct + '%';
        if (hint) {
          hint.textContent = v.length < 8 ? 'Use 8 characters or more.'
            : score <= 2 ? 'Weak — add numbers or capitals.'
            : score === 3 ? 'Reasonable.'
            : score === 4 ? 'Strong.' : 'Very strong.';
        }
      });
    }
    const agree = $('#rg-agree');
    if (agree) agree.onchange = () => $('#rg-agree-wrap').classList.toggle('on', agree.checked);

    rf.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = $('#rg-name').value.trim();
      const email = $('#rg-email').value.trim();
      const country = $('#rg-country').value;
      const discord = $('#rg-discord').value.trim();
      const pw = $('#rg-pw').value;
      const pw2 = $('#rg-pw2').value;
      const agreed = $('#rg-agree').checked;
      state.ui.regDraft = { name, email, country, discord, agree: agreed };

      let ok = true;
      ok = showErr(rf, 'name', name.length >= 3 ? '' : 'Enter your full name.') && ok;
      ok = showErr(rf, 'email', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? '' : 'Enter a valid email address.') && ok;
      ok = showErr(rf, 'country', country ? '' : 'Select your country.') && ok;
      ok = showErr(rf, 'pw', pw.length >= 8 ? '' : 'Use at least 8 characters.') && ok;
      ok = showErr(rf, 'pw2', pw && pw === pw2 ? '' : 'The two passwords do not match.') && ok;
      ok = showErr(rf, 'agree', agreed ? '' : 'You must accept the HLL standards.') && ok;
      showErr(rf, 'form', '');
      if (!ok) return;

      const btn = rf.querySelector('button[type="submit"]');
      btn.disabled = true;
      let res;
      try {
        res = await Accounts.register(
          { name, email, discord, created: new Date().toISOString() },
          pw, country);
      } catch (err) {
        btn.disabled = false;
        showErr(rf, 'form', err.message || 'Could not create your account.');
        return;
      }
      btn.disabled = false;

      state.ui.regDraft = {};
      const driver = Store.driver(res.driver.driver_code);
      toast('Account created', 'ok', 'Welcome to Heavyline, ' + name.split(' ')[0]);
      Store.notify(driver.id, {
        type: 'info', icon: 'userPlus', title: 'Application received',
        body: 'A recruiter will review your application shortly.',
      });
      doLogin(driver, 'Welcome to Heavyline');
    });
  }
}

function bindViewForms() {

    /* ---- messages ---- */
    const dmForm = $('#dmForm');

    if (dmForm) {
        dmForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const box = $('#dmInput');
            const text = box ? box.value.trim() : '';
            if (!text) return;

            /* Cleared first. Waiting for the service to answer before
               emptying the box means a driver on a slow link types the
               next sentence into the last one. */
            box.value = '';
            const ok = await Messages.send(text, null);
            if (!ok && box) box.value = text;
        });
    }

    const dmFile = $('#dmFile');

    if (dmFile) {
        dmFile.addEventListener('change', async () => {
            const file = dmFile.files && dmFile.files[0];
            /* Reset immediately: without this, choosing the same photo twice
               in a row fires no change event and looks broken. */
            dmFile.value = '';
            if (!file) return;

            toast('Sending ' + file.name, 'info',
                (file.size / 1e6).toFixed(1) + ' MB');

            const meta = await Messages.upload(file);
            if (!meta) return;

            const box = $('#dmInput');
            const caption = box ? box.value.trim() : '';
            if (box) box.value = '';
            await Messages.send(caption, { id: meta.id });
        });
    }

    /* starting a conversation with somebody not yet in the list */
    const dmNew = $('#dmNew');

    if (dmNew) {
        dmNew.addEventListener('change', () => {
            if (dmNew.value) Messages.open(dmNew.value).then(() => paintMessages());
        });
    }

    /* driver filters */
    const ds = $('#driverSearch');

    if (ds) {
        ds.addEventListener('input', debounce(() => {
            state.ui.driverQuery = ds.value;
            render();

            const again = $('#driverSearch');

            if (again) {
                again.focus();
                again.setSelectionRange(
                    again.value.length,
                    again.value.length
                );
            }
        }, 260));
    }

    const dr = $('#driverRank');

    if (dr) {
        dr.onchange = () => {
            state.ui.driverRank = dr.value;
            render();
        };
    }

    const dso = $('#driverSort');

    if (dso) {
        dso.onchange = () => {
            state.ui.driverSort = dso.value;
            render();
        };
    }


    /* recruitment application */
    const af = $('#applyForm');

    if (af) {

      const agree = $('#ap-agree');

      if (agree) {
        agree.onchange = () => {
          const wrap = $('#ap-agree-wrap');

          if (wrap) {
            wrap.classList.toggle('on', agree.checked);
          }
        };
      }

        af.addEventListener('submit', (e) => {

            e.preventDefault();

            const d = state.ui.applyDraft;

            const val = (n) =>
                (af.querySelector(`[name="${n}"]`)?.value || '').trim();

            const setErr = (k, msg) => {

                const el = af.querySelector(`[data-err="${k}"]`);
                const input = af.querySelector(`[name="${k}"]`);

                if (!el) return !msg;

                el.textContent = msg;
                el.classList.toggle('hide', !msg);

                if (input) {
                    input.classList.toggle('err', !!msg);
                }

                return !msg;
            };

            ['name', 'email', 'country', 'discord', 'why'].forEach((k) => {
                d[k] = val(k);
            });

            d.agree = af.querySelector('#ap-agree')?.checked;

            let ok = true;

            ok &= setErr(
                'name',
                d.name.length >= 3 ? '' : 'Enter your name.'
            );

            ok &= setErr(
                'email',
                /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(d.email)
                    ? ''
                    : 'Enter a valid email address.'
            );

            ok &= setErr(
                'country',
                d.country ? '' : 'Select your country.'
            );

            ok &= setErr(
                'agree',
                d.agree
                    ? ''
                    : 'You must accept the HLL standards to apply.'
            );

            if (!ok) return;


            /* one open application per person is enough */
            const already = Store.db.applications.find(
                (a) =>
                    a.submittedBy === state.user.id &&
                    (
                        a.status === 'pending' ||
                        a.status === 'review' ||
                        a.status === 'interview'
                    )
            );

            if (already) {
                toast(
                    'You already have an application in',
                    'warn',
                    already.id
                );

                closeAllLayers();
                render();
                return;
            }


            const app = {
                id: 'APP-' + randI(9100, 9999),
                name: d.name,
                age: null,
                email: d.email,
                discord: d.discord || '',
                truckersmp: '',
                country: d.country,
                experience: 'Not stated',
                hours: 0,
                previousVtc: 'None',
                why: d.why || 'No note left.',
                status: 'pending',
                submitted: new Date().toISOString(),
                notes: [],
                submittedBy: state.user.id
            };


  
        // Keep local store synchronized
// Keep local store synchronized

// Notify HLL management
notifyStaff('recruitment.manage', {
    type: 'info',
    icon: 'userPlus',
    title: 'New driver application',
    body:
        app.name +
        ' has applied to drive. Approve them to release the client.',
    href: '#/admin'
}, state.user.id);

// Show success modal
openModal({
    title: 'Application sent',
    size: 'narrow',
    body: `
        <div class="center col gap-12" style="padding:8px 0">

            <div style="
                width:52px;
                height:52px;
                border-radius:50%;
                display:grid;
                place-items:center;
                margin:auto;
                background:rgba(34,197,94,.12);
                color:#22c55e;
                font-size:26px;
            ">✓</div>

            <div class="b8">
                Your application has been sent.
            </div>

            <p class="t2 sm" style="text-align:center">
                HLL management will review your application.
                You will be notified when a decision is made.
            </p>

        </div>
    `,
    foot: `
        <button
            class="btn btn-primary"
            data-act="modal-close">
            Done
        </button>
    `
});

return true;

openModal({
    title: 'Application sent',
    size: 'narrow',

    body: `
        <div class="center col gap-12" style="padding:8px 0">

            <span
                class="stat-ico"
                style="
                    margin:0 auto;
                    width:52px;
                    height:52px;
                    color:var(--ok);
                    border-color:rgba(62,207,142,.30)
                "
            >
                ${icon('checkCircle')}
            </span>

            <div class="b7 lg">
                Thank you, ${esc(app.name.split(' ')[0])}
            </div>

            <p class="t2 sm">
                Your application
                <span class="mono">${esc(app.id)}</span>
                has gone straight to recruitment.
                You will get a notification here as soon as
                they have looked at it, and the Heavyline Trucker
                download is released with it.
            </p>

        </div>
    `,

    foot: `
        <button
            class="btn btn-primary"
            data-act="modal-close"
        >
            Close
        </button>
    `
});

render();
    });
  }


    /* settings profile */
    const pf = $('#profileForm');

    if (pf) {
        pf.addEventListener('submit', (e) => {

            e.preventDefault();

            const u = state.user;

            u.name = $('#st-name').value.trim() || u.name;
            u.initials = initials(u.name);
            u.country = $('#st-country').value;
            u.discord = $('#st-discord').value.trim();
            u.truckersmp = $('#st-tmp').value.trim();
            u.bio = $('#st-bio').value.trim();

            Store.save();

            toast(
                'Profile saved',
                'ok',
                'Your driver profile has been updated.'
            );

            renderAll();
        });
    }


    /* convoy chat */
    const cf = $('#convoyChatForm');

    if (cf) {
        cf.addEventListener('submit', (e) => {
            e.preventDefault();
            convoySend(cf.dataset.id);
        });
    }


    /* ticket reply */
    const tr = $('#ticketReply');

    if (tr) {
        tr.addEventListener('submit', (e) => {

            e.preventDefault();

            const box = $('#tk-msg');
            const body = box.value.trim();

            if (!body) {
                return toast('Write a message first', 'warn');
            }

            const t = Store.ticket(state.route.params[0]);

            if (!t) return;

            const fromStaff = can('admin.view');

            t.messages.push({
                from: fromStaff ? 'staff' : state.user.id,
                at: new Date().toISOString(),
                body
            });

            t.updated = new Date().toISOString();

            if (t.status === 'open' && fromStaff) {
                t.status = 'in_progress';
            }


            /* Notify the other side about the reply */

            if (fromStaff) {

                if (t.driverId && t.driverId !== state.user.id) {

                    Store.notify(t.driverId, {
                        type: 'info',
                        icon: 'lifeBuoy',
                        title: 'Heavyline replied',
                        body:
                            (t.subject || 'Your support request') +
                            ' — ' +
                            body.slice(0, 120),
                        href: '#/ticket/' + t.id
                    });
                }

            } else {

                notifyStaff('admin.view', {
                    type: 'warn',
                    icon: 'lifeBuoy',
                    title: 'Reply on a support request',
                    body:
                        state.user.name +
                        ': ' +
                        body.slice(0, 120),
                    href: '#/ticket/' + t.id
                }, state.user.id);
            }

            Store.save();

            toast('Reply sent', 'ok');

            render();
        });
    }


    /* global search box */
    const gs = $('#globalSearch');

    if (gs && !gs.dataset.bound) {

        gs.dataset.bound = '1';

        gs.addEventListener('focus', () => {
            gs.blur();
            openSearch();
        });
    }
}


/* Accessibility helpers */

const NATIVELY_FOCUSABLE = new Set([
    'BUTTON',
    'A',
    'INPUT',
    'SELECT',
    'TEXTAREA'
]);

function enhanceA11y(root) {

    $$('[data-act]', root).forEach((el) => {

        if (NATIVELY_FOCUSABLE.has(el.tagName)) {
            return;
        }

        if (
            el.dataset.act === 'noop' ||
            el.hasAttribute('tabindex')
        ) {
            return;
        }

        el.setAttribute('tabindex', '0');

        if (!el.hasAttribute('role')) {
            el.setAttribute(
                'role',
                el.tagName === 'TR' ? 'link' : 'button'
            );
        }
    });
}


/* Full rebuild including the shell */

function renderAll() {

    const app = $('#app');

    if (app) {
        app.innerHTML = '';
    }

    render();
}


/* Debounce */

function debounce(fn, ms) {

    let t;

    return (...a) => {
        clearTimeout(t);
        t = setTimeout(() => fn(...a), ms);
    };
}


/* ---------------- 35. Countdown ticker ---------------- */

function tickCountdowns() {

    $$('[data-countdown]').forEach((el) => {

        const target =
            new Date(el.dataset.countdown).getTime();

        let diff = target - Date.now();

        if (diff <= 0) {
            el.textContent = 'Now';
            return;
        }

        const d = Math.floor(diff / DAY);
        diff -= d * DAY;

        const h = Math.floor(diff / 3.6e6);
        diff -= h * 3.6e6;

        const m = Math.floor(diff / 60000);

        const s =
            Math.floor(
                (diff - m * 60000) / 1000
            );

        el.textContent = d
            ? `${d}d ${h}h ${m}m`
            : h
                ? `${h}h ${m}m ${s}s`
                : `${m}m ${s}s`;
    });
}

/* ============================================================
   Driver to driver

   The crew chat that shipped before this read from a local array that
   nothing ever wrote to, so every driver saw an empty room and no
   message ever left the machine it was typed on.

   This is the real thing: the conversation lives on the company
   service, both ends are told the moment something is said, and who
   said it is decided from the token rather than believed from the
   body. Attachments go to the service as bytes and come back by id.
   ============================================================ */
const Messages = {
  threads: [],
  withId: null,        /* the conversation on screen */
  messages: [],
  olderCursor: null,
  loading: false,
  sending: false,
  error: null,         /* no-service | no-identity | null */
  online: {},          /* driverId -> boolean, from presence frames */

  on() { return !!Sync.url() && ServiceAuth.on(); },

  /* Why the screen is empty, in terms somebody can act on. */
  reason() {
    if (!Sync.url()) {
      return 'Messages need the company service. Start it with npm run service, '
        + 'or set its address in Settings.';
    }
    if (!ServiceAuth.on()) {
      return ServiceAuth.reason && ServiceAuth.reason()
        ? ServiceAuth.reason()
        : 'Sign in again to send messages.';
    }
    return '';
  },

  async pullThreads() {
    const base = Sync.url();
    if (!base) { this.error = 'no-service'; return false; }
    if (!ServiceAuth.on()) { this.error = 'no-identity'; return false; }

    try {
      const res = await fetch(base + '/api/dm/threads',
        { cache: 'no-store', headers: ServiceAuth.headers() });
      if (res.status === 401) { this.error = 'no-identity'; ServiceAuth.status = 'rejected'; return false; }
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const body = await res.json();
      this.threads = body.threads || [];
      this.error = null;

      this.threads.forEach((t) => { this.online[t.withId] = !!t.online; });
      return true;

    } catch (err) {
      this.error = null;
      console.warn('[HLL] could not list conversations:', err.message);
      return false;
    }
  },

  /* The unread total, for the badge in the sidebar. */
  unread() {
    return this.threads.reduce((n, t) => n + (t.unread || 0), 0);
  },

  async open(withId) {
    this.withId = String(withId);
    this.messages = [];
    this.olderCursor = null;
    this.loading = true;
    await this.refresh();
    await this.markRead();
  },

  async refresh() {
    const base = Sync.url();
    if (!base) { this.error = 'no-service'; this.loading = false; return; }
    if (!ServiceAuth.on()) { this.error = 'no-identity'; this.loading = false; return; }
    if (!this.withId) { this.loading = false; return; }

    try {
      const res = await fetch(base + '/api/dm/' + encodeURIComponent(this.withId),
        { cache: 'no-store', headers: ServiceAuth.headers() });
      if (res.status === 401) { this.error = 'no-identity'; ServiceAuth.status = 'rejected'; }
      else if (!res.ok) throw new Error('HTTP ' + res.status);
      else {
        const body = await res.json();
        this.messages = body.messages || [];
        this.olderCursor = body.olderCursor || null;
        this.online[this.withId] = !!body.online;
        this.error = null;
      }
    } catch (err) {
      console.warn('[HLL] could not read the conversation:', err.message);
    }
    this.loading = false;
    paintMessages();
  },

  /* The id the SERVICE knows this browser by. Every id on a message is
     stamped by the service from the token, so this is what they have to be
     compared against — the local driver record can carry a different code
     and then nothing a driver sends is recognised as their own. */
  me() {
    if (ServiceAuth.driver && ServiceAuth.driver.id) return String(ServiceAuth.driver.id);
    return state.user ? String(state.user.id) : '';
  },

  /* Arriving live. Only repaints when it belongs to what is on screen —
     a message in another conversation moves a count, not the view. */
  receive(msg) {
    const me = this.me();
    const mine = !!me && String(msg.driverId) === me;
    const other = mine ? String(msg.to) : String(msg.driverId);

    if (this.withId && other === this.withId) {
      if (!this.messages.some((m) => m.id === msg.id)) this.messages.push(msg);
      paintMessages();
      /* reading it as it arrives, because it is on screen */
      if (!mine) this.markRead();
    } else if (!mine) {
      toast(msg.driver || 'New message', 'info',
        msg.text ? String(msg.text).slice(0, 90) : 'Sent an attachment');
    }

    this.pullThreads().then(() => {
      if (state.route && state.route.name === 'messages') paintMessages();
      paintUnreadBadge();
    });
  },

  removed(msg) {
    const i = this.messages.findIndex((m) => m.id === msg.id);
    if (i > -1) { this.messages[i] = msg; paintMessages(); }
  },

  markedRead(by) {
    if (String(by) !== String(this.withId)) return;
    const me = this.me();
    const now = new Date().toISOString();
    this.messages.forEach((m) => {
      if (me && String(m.driverId) === me && !m.readAt) m.readAt = now;
    });
    paintMessages();
  },

  presence(driverId, online) {
    this.online[String(driverId)] = !!online;
    if (state.route && state.route.name === 'messages') paintMessages();
  },

  async markRead() {
    const base = Sync.url();
    if (!base || !ServiceAuth.on() || !this.withId) return;
    try {
      await fetch(base + '/api/dm/read', {
        method: 'POST',
        headers: ServiceAuth.headers(),
        body: JSON.stringify({ withId: this.withId }),
      });
      const t = this.threads.find((x) => String(x.withId) === this.withId);
      if (t) t.unread = 0;
      paintUnreadBadge();
    } catch (e) { /* it will be marked on the next look */ }
  },

  async send(text, attachment) {
    const base = Sync.url();
    if (!base) { toast('Messages need the company service', 'warn', this.reason()); return false; }
    if (!ServiceAuth.on()) { toast('Sign in again to send messages', 'warn'); return false; }
    if (!this.withId) return false;
    if (!text && !attachment) return false;

    this.sending = true;
    try {
      const res = await fetch(base + '/api/dm/send', {
        method: 'POST',
        headers: ServiceAuth.headers(),
        body: JSON.stringify({ to: this.withId, text, attachment }),
      });
      if (res.status === 401) {
        ServiceAuth.status = 'rejected';
        toast('Your session has expired', 'warn', 'Sign in again to keep talking.');
        return false;
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'HTTP ' + res.status);
      }
      return true;

    } catch (err) {
      toast('Message not sent', 'danger', err.message);
      return false;
    } finally {
      this.sending = false;
    }
  },

  /* The bytes go up on their own and come back as an id. The message that
     carries it is sent separately, so a slow photo does not hold the
     conversation up and a failed one does not lose what was typed. */
  async upload(file) {
    const base = Sync.url();
    if (!base || !ServiceAuth.on()) { toast('Sign in again to send files', 'warn'); return null; }

    try {
      const res = await fetch(base + '/api/files', {
        method: 'POST',
        headers: {
          'Content-Type': file.type || 'application/octet-stream',
          'X-HLL-Filename': file.name.replace(/[^\\x20-\\x7e]/g, '_'),
          Authorization: 'Bearer ' + ServiceAuth.token,
        },
        body: file,
      });

      if (res.status === 415) {
        toast('That kind of file cannot be sent', 'warn',
          'Images, PDFs, text, zip, mp4 and audio.');
        return null;
      }
      if (res.status === 413) {
        toast('That file is too large', 'warn', 'The limit is 25 MB.');
        return null;
      }
      if (!res.ok) throw new Error('HTTP ' + res.status);

      const body = await res.json();
      return body.file;

    } catch (err) {
      toast('Upload failed', 'danger', err.message);
      return null;
    }
  },

  async remove(id) {
    const base = Sync.url();
    if (!base || !ServiceAuth.on()) return false;
    try {
      const res = await fetch(base + '/api/dm/message/delete', {
        method: 'POST',
        headers: ServiceAuth.headers(),
        body: JSON.stringify({ id }),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return true;
    } catch (err) {
      toast('Could not remove the message', 'danger', err.message);
      return false;
    }
  },

  /* An attachment's address is relative to the service, not to this page —
     the site is on Cloudflare and the file is on the company's machine. */
  fileUrl(att) {
    if (!att || !att.url) return '';
    return Sync.url() + att.url;
  },
};

/* ============================================================
   Calling

   The audio and video never touch the company service. Two browsers
   negotiate a direct connection and the media goes between them; the
   service only carries the handshake, because before that connection
   exists the two ends have no other way to reach each other.

   So a call costs the company nothing to carry, and there is nothing
   at the service to record.
   ============================================================ */
const Calls = {
  pc: null,
  callId: null,
  withId: null,
  withName: '',
  video: false,
  state: 'idle',       /* idle | ringing | incoming | connecting | live */
  local: null,
  remote: null,
  incoming: null,
  muted: false,
  startedAt: 0,
  timer: null,

  /* Public STUN only. A relay would need a server the company does not
     have; without one a call still connects on any normal network and
     fails on a strict corporate one, which is the honest trade here. */
  config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] },

  can() {
    return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia
      && typeof RTCPeerConnection !== 'undefined');
  },

  async media(video) {
    return navigator.mediaDevices.getUserMedia({
      audio: true,
      video: video ? { width: 640, height: 480 } : false,
    });
  },

  async signalOut(kind, payload) {
    const base = Sync.url();
    if (!base || !ServiceAuth.on() || !this.withId) return null;
    try {
      const res = await fetch(base + '/api/call/signal', {
        method: 'POST',
        headers: ServiceAuth.headers(),
        body: JSON.stringify({
          to: this.withId, kind, callId: this.callId, video: this.video, payload,
        }),
      });
      return res;
    } catch (e) {
      return null;
    }
  },

  peer() {
    const pc = new RTCPeerConnection(this.config);

    pc.onicecandidate = (e) => {
      if (e.candidate) this.signalOut('ice', { candidate: e.candidate });
    };

    pc.ontrack = (e) => {
      this.remote = e.streams[0];
      const el = document.getElementById('callRemote');
      if (el) { el.srcObject = this.remote; el.play().catch(() => {}); }
      if (this.state !== 'live') {
        this.state = 'live';
        this.startedAt = Date.now();
        this.tick();
      }
      paintCall();
    };

    pc.onconnectionstatechange = () => {
      if (['failed', 'closed', 'disconnected'].includes(pc.connectionState)) {
        if (this.state !== 'idle') {
          toast('The call ended', 'info',
            pc.connectionState === 'failed'
              ? 'The two ends could not reach each other.' : '');
          this.teardown();
        }
      }
    };

    this.local.getTracks().forEach((t) => pc.addTrack(t, this.local));
    return pc;
  },

  async start(driverId, name, video) {
    if (!this.can()) {
      toast('This browser cannot make calls', 'warn',
        'It needs a microphone and a secure connection.');
      return;
    }
    if (this.state !== 'idle') { toast('You are already on a call', 'warn'); return; }

    this.withId = String(driverId);
    this.withName = name || driverId;
    this.video = !!video;
    this.callId = 'CALL-' + Math.random().toString(16).slice(2, 10);
    this.state = 'ringing';
    paintCall();

    try {
      this.local = await this.media(this.video);
    } catch (e) {
      toast('No microphone', 'danger',
        'Heavyline needs permission to use it before it can call.');
      this.teardown();
      return;
    }

    const res = await this.signalOut('ring');
    if (res && res.status === 409) {
      toast(this.withName + ' is not connected', 'warn',
        'They will see the message when they next open Heavyline.');
      this.teardown();
      return;
    }
    if (!res || !res.ok) {
      toast('Could not place the call', 'danger');
      this.teardown();
      return;
    }
    paintCall();
  },

  /* Answering. The callee makes no offer — it says yes, and the caller
     starts the negotiation, so only one side is ever the offerer. */
  async accept() {
    const inc = this.incoming;
    if (!inc) return;

    this.incoming = null;
    this.withId = String(inc.from);
    this.withName = inc.fromName || inc.from;
    this.callId = inc.callId;
    this.video = !!inc.video;
    this.state = 'connecting';
    paintCall();

    try {
      this.local = await this.media(this.video);
    } catch (e) {
      toast('No microphone', 'danger', 'The call could not be answered.');
      this.signalOut('decline');
      this.teardown();
      return;
    }

    this.pc = this.peer();
    this.showLocal();
    await this.signalOut('accept');
  },

  decline() {
    if (!this.incoming) return;

    /* Tell them first — teardown() clears the address the signal needs. */
    this.withId = String(this.incoming.from);
    this.callId = this.incoming.callId;
    this.signalOut('decline');

    /* Then put everything back to idle. Clearing the incoming call alone
       left state on 'incoming': the overlay stayed up, and the next caller
       was told this browser was busy when it was not on a call at all. */
    this.teardown();
  },

  hangUp() {
    if (this.state !== 'idle') this.signalOut('hangup');
    this.teardown();
  },

  toggleMute() {
    if (!this.local) return;
    this.muted = !this.muted;
    this.local.getAudioTracks().forEach((t) => { t.enabled = !this.muted; });
    paintCall();
  },

  showLocal() {
    const el = document.getElementById('callLocal');
    if (el && this.local) { el.srcObject = this.local; el.play().catch(() => {}); }
  },

  tick() {
    clearInterval(this.timer);
    this.timer = setInterval(() => {
      if (this.state !== 'live') return;
      const el = document.getElementById('callTimer');
      if (el) el.textContent = this.elapsed();
    }, 1000);
  },

  elapsed() {
    if (!this.startedAt) return '';
    const s = Math.floor((Date.now() - this.startedAt) / 1000);
    return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  },

  /* Everything arriving from the other end. */
  async signal(d) {
    if (!d) return;

    if (d.kind === 'ring') {
      /* Already busy: tell them so rather than letting it ring unanswered
         behind whatever is already on screen. */
      if (this.state !== 'idle' || this.incoming) {
        const was = { withId: this.withId, callId: this.callId };
        this.withId = String(d.from);
        this.callId = d.callId;
        await this.signalOut('busy');
        this.withId = was.withId;
        this.callId = was.callId;
        return;
      }
      this.incoming = d;
      this.state = 'incoming';
      paintCall();
      return;
    }

    /* Anything else about a call this browser is not on is not ours. */
    if (!this.callId || d.callId !== this.callId) return;

    if (d.kind === 'accept') {
      this.state = 'connecting';
      this.pc = this.peer();
      this.showLocal();
      const offer = await this.pc.createOffer();
      await this.pc.setLocalDescription(offer);
      await this.signalOut('offer', { sdp: this.pc.localDescription });
      paintCall();
      return;
    }

    if (d.kind === 'offer' && this.pc) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      const answer = await this.pc.createAnswer();
      await this.pc.setLocalDescription(answer);
      await this.signalOut('answer', { sdp: this.pc.localDescription });
      return;
    }

    if (d.kind === 'answer' && this.pc) {
      await this.pc.setRemoteDescription(new RTCSessionDescription(d.payload.sdp));
      return;
    }

    if (d.kind === 'ice' && this.pc && d.payload && d.payload.candidate) {
      try { await this.pc.addIceCandidate(new RTCIceCandidate(d.payload.candidate)); }
      catch (e) { /* a candidate that arrives too early is not fatal */ }
      return;
    }

    if (d.kind === 'decline') {
      toast(this.withName + ' declined', 'info');
      this.teardown();
      return;
    }

    if (d.kind === 'busy') {
      toast(this.withName + ' is on another call', 'info');
      this.teardown();
      return;
    }

    if (d.kind === 'hangup') {
      toast('The call ended', 'info', this.elapsed());
      this.teardown();
    }
  },

  teardown() {
    clearInterval(this.timer);
    this.timer = null;
    try { if (this.pc) this.pc.close(); } catch (e) {}
    if (this.local) this.local.getTracks().forEach((t) => t.stop());
    this.pc = null;
    this.local = null;
    this.remote = null;
    this.incoming = null;
    this.callId = null;
    this.withId = null;
    this.withName = '';
    this.state = 'idle';
    this.muted = false;
    this.startedAt = 0;
    paintCall();
  },
};

/* ---------------- the messages screen ---------------- */

/* Repaints the conversation without re-rendering the page, so the caret
   stays where the driver left it mid-sentence. */
function paintMessages() {
  if (!state.route || state.route.name !== 'messages') return;
  const host = document.getElementById('dmPanes');
  if (!host) return;

  const box = document.getElementById('dmScroll');
  const wasAtEnd = !box || (box.scrollHeight - box.scrollTop - box.clientHeight < 60);
  const draft = (document.getElementById('dmInput') || {}).value || '';

  host.innerHTML = messagesPanes();

  const input = document.getElementById('dmInput');
  if (input) input.value = draft;

  const scroll = document.getElementById('dmScroll');
  if (scroll && wasAtEnd) scroll.scrollTop = scroll.scrollHeight;
}

function paintUnreadBadge() {
  const el = document.getElementById('dmBadge');
  if (!el) return;
  const n = Messages.unread();
  el.textContent = n ? String(n) : '';
  el.style.display = n ? '' : 'none';
}

function dmAvatar(name) {
  return '<span class="dm-avatar">' + esc(initials(name || '?')) + '</span>';
}

function dmAttachment(att) {
  if (!att) return '';
  const url = Messages.fileUrl(att);
  if (att.image) {
    return '<a class="dm-image" href="' + esc(url) + '" target="_blank" rel="noopener">'
      + '<img src="' + esc(url) + '" alt="' + esc(att.name) + '" loading="lazy"></a>';
  }
  const kb = att.size > 1e6
    ? (att.size / 1e6).toFixed(1) + ' MB'
    : Math.max(1, Math.round(att.size / 1024)) + ' KB';
  return '<a class="dm-file" href="' + esc(url) + '" target="_blank" rel="noopener" download>'
    + icon('download') + '<span class="dm-file-name">' + esc(att.name) + '</span>'
    + '<span class="dm-file-size">' + kb + '</span></a>';
}

/* The name to put on a call. The roster first, because it is the fuller
   record; the thread list second, for somebody who has since left it. */
function dmNameFor(id) {
  const d = (Store.db.drivers || []).find((x) => x && String(x.id) === String(id));
  if (d && d.name) return d.name;
  const t = Messages.threads.find((x) => String(x.withId) === String(id));
  return (t && t.withName) || String(id);
}

/* Everyone this driver could talk to: the roster, minus themselves. */
function dmRoster() {
  const me = state.user ? String(state.user.id) : '';
  return (Store.db.drivers || [])
    .filter((d) => d && String(d.id) !== me && d.accountStatus !== 'suspended')
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));
}

function messagesPanes() {
  const threads = Messages.threads;
  const withId = Messages.withId;
  const roster = dmRoster();
  const other = roster.find((d) => String(d.id) === String(withId));
  const otherName = other ? other.name
    : (threads.find((t) => String(t.withId) === String(withId)) || {}).withName || withId;

  const list = `
    <div class="dm-list">
      <div class="dm-list-head">
        <select class="select sm" id="dmNew" data-act="noop">
          <option value="">Start a conversation…</option>
          ${roster.map((d) => `<option value="${esc(String(d.id))}"${
            String(d.id) === String(withId) ? ' selected' : ''}>${esc(d.name)}</option>`).join('')}
        </select>
      </div>
      ${threads.length ? threads.map((t) => `
        <button class="dm-thread ${String(t.withId) === String(withId) ? 'on' : ''}"
          data-act="dm-open" data-id="${esc(String(t.withId))}">
          ${dmAvatar(t.withName)}
          <span class="dm-thread-body">
            <span class="dm-thread-top">
              <span class="dm-thread-name">${esc(t.withName)}</span>
              <span class="dm-thread-when">${esc(fmt.rel(t.last.at))}</span>
            </span>
            <span class="dm-thread-last">${
              t.last.deleted ? '<em>message removed</em>'
                : t.last.text ? esc(String(t.last.text).slice(0, 60))
                : 'Attachment'}</span>
          </span>
          ${Messages.online[t.withId] ? '<span class="dm-dot on" title="Online"></span>' : ''}
          ${t.unread ? `<span class="dm-unread">${t.unread}</span>` : ''}
        </button>`).join('')
      : `<div class="dm-empty t3">No conversations yet.<br>Pick a driver above to start one.</div>`}
    </div>`;

  if (!withId) {
    return list + `
      <div class="dm-pane">
        <div class="empty">${icon('chat')}
          <div>Choose a driver</div>
          <div class="t3 xs">Messages, photos and files go straight to them.</div>
        </div>
      </div>`;
  }

  const me = Messages.me();
  const online = Messages.online[withId];

  return list + `
    <div class="dm-pane">
      <div class="dm-head">
        ${dmAvatar(otherName)}
        <div class="grow" style="min-width:0">
          <div class="b6 trunc">${esc(otherName)}</div>
          <div class="t3 xs">${online ? 'Online now' : 'Offline'}</div>
        </div>
        <button class="icon-btn" data-act="dm-call" data-id="${esc(String(withId))}"
          title="Voice call" aria-label="Voice call">${icon('phone')}</button>
        <button class="icon-btn" data-act="dm-video" data-id="${esc(String(withId))}"
          title="Video call" aria-label="Video call">${icon('video')}</button>
      </div>

      <div class="dm-scroll" id="dmScroll">
        ${Messages.loading ? `<div class="t3 xs" style="padding:12px">Loading…</div>` : ''}
        ${Messages.messages.length ? Messages.messages.map((m) => {
          const mine = String(m.driverId) === me;
          return `<div class="dm-msg ${mine ? 'mine' : ''}">
            <div class="dm-bubble">
              ${mine ? '' : `<div class="dm-who">${esc(m.driver)}${
                m.role === 'staff' ? ' <span class="dm-staff">staff</span>' : ''}</div>`}
              ${m.deleted ? `<em class="t3">message removed</em>` : `
                ${m.attachment ? dmAttachment(m.attachment) : ''}
                ${m.text ? `<div class="dm-text">${esc(m.text)}</div>` : ''}`}
              <div class="dm-meta">${esc(fmt.time(m.at))}${
                mine && m.readAt ? ' · read' : ''}${
                mine && !m.deleted ? ` <button class="dm-del" data-act="dm-delete"
                  data-id="${esc(m.id)}" title="Remove">${icon('trash')}</button>` : ''}</div>
            </div>
          </div>`;
        }).join('')
        : `<div class="dm-empty t3">Nothing said yet. Say hello.</div>`}
      </div>

      <form class="dm-composer" id="dmForm">
        <input type="file" id="dmFile" hidden
          accept="image/*,application/pdf,text/plain,text/csv,application/zip,video/mp4,audio/*">
        <button type="button" class="icon-btn" data-act="dm-attach"
          title="Send a photo or a file" aria-label="Attach">${icon('paperclip')}</button>
        <input class="input" id="dmInput" autocomplete="off"
          placeholder="Message ${esc(otherName)}">
        <button class="btn btn-primary" type="submit">${icon('send')}Send</button>
      </form>
    </div>`;
}

function viewMessages() {
  if (!Messages.on()) {
    return `<div class="page">
      <div class="page-head">
        <div><div class="eyebrow">Driver to driver</div>
          <h1 class="page-title">Messages</h1>
          <p class="page-sub">Talk to any driver in the company</p></div>
      </div>
      <div class="card"><div class="card-body">
        <div class="empty">${icon('chat')}
          <div>Messages are not connected</div>
          <div class="t3 xs" style="max-width:38rem">${esc(Messages.reason())}</div>
        </div>
      </div></div>
    </div>`;
  }

  return `<div class="page">
    <div class="page-head">
      <div><div class="eyebrow">Driver to driver</div>
        <h1 class="page-title">Messages</h1>
        <p class="page-sub">Photos, files and calls — straight to another driver</p></div>
    </div>
    <div class="card"><div class="card-body" style="padding:0">
      <div class="dm" id="dmPanes">${messagesPanes()}</div>
    </div></div>
  </div>`;
}

/* The call overlay sits above whatever is on screen — a call that only
   existed on the messages page would be lost the moment somebody looked
   at the map. */
function paintCall() {
  const host = document.getElementById('callLayer');
  if (!host) return;   /* the sign-in screen has no shell yet */

  if (Calls.state === 'idle' && !Calls.incoming) { host.innerHTML = ''; return; }

  if (Calls.state === 'incoming' && Calls.incoming) {
    host.innerHTML = `<div class="call-card ring">
      ${dmAvatar(Calls.incoming.fromName)}
      <div class="call-who">${esc(Calls.incoming.fromName)}</div>
      <div class="call-state">Incoming ${Calls.incoming.video ? 'video ' : ''}call</div>
      <div class="call-actions">
        <button class="btn btn-danger" data-act="call-decline">${icon('phoneOff')}Decline</button>
        <button class="btn btn-primary" data-act="call-accept">${icon('phone')}Answer</button>
      </div>
    </div>`;
    return;
  }

  const label = Calls.state === 'ringing' ? 'Ringing…'
    : Calls.state === 'connecting' ? 'Connecting…'
    : Calls.elapsed();

  host.innerHTML = `<div class="call-card ${Calls.video ? 'video' : ''}">
    ${Calls.video ? `
      <div class="call-video">
        <video id="callRemote" autoplay playsinline></video>
        <video id="callLocal" autoplay playsinline muted class="call-self"></video>
      </div>`
    : `${dmAvatar(Calls.withName)}
       <audio id="callRemote" autoplay></audio>`}
    <div class="call-who">${esc(Calls.withName)}</div>
    <div class="call-state" id="callTimer">${esc(label)}</div>
    <div class="call-actions">
      <button class="btn ${Calls.muted ? 'btn-primary' : ''}" data-act="call-mute">
        ${icon(Calls.muted ? 'micOff' : 'mic')}${Calls.muted ? 'Unmute' : 'Mute'}</button>
      <button class="btn btn-danger" data-act="call-hangup">${icon('phoneOff')}End</button>
    </div>
  </div>`;

  /* the elements are new, so the streams have to be reattached */
  if (Calls.remote) {
    const r = document.getElementById('callRemote');
    if (r) { r.srcObject = Calls.remote; r.play().catch(() => {}); }
  }
  Calls.showLocal();
}

/* ---------------- 36. Render ---------------- */
function routeView() {
  const { name, params } = state.route;
  switch (name) {
    case 'dashboard':     return viewDashboard();
    case 'drivers':       return viewDrivers();
    case 'driver':        return viewDriver(params[0]);
    case 'fleet':         return viewFleet();
    case 'vehicle':       return viewVehicle(params[0]);
    case 'convoys':       return viewConvoys();
    case 'convoy':        return viewConvoy(params[0]);
    case 'events':        return viewEvents();
    case 'rankings':      return viewRankings();
    case 'achievements':  return viewAchievements();
    case 'recruitment':   return viewRecruitment();
    case 'community':     return viewCommunity();
    case 'support':       return viewSupport();
    case 'ticket':        return viewTicket(params[0]);
    case 'notifications': return viewNotifications();
    case 'messages':
      /* the list is fetched once the screen is up, so the page paints now
         and fills in rather than waiting on the service */
      if (!Messages.threads.length && Messages.on()) {
        Messages.pullThreads().then(() => { paintMessages(); paintUnreadBadge(); });
      }
      return viewMessages();
    case 'livemap':       return viewLivemap();
    case 'ops':           return viewOps();
    case 'downloads':
      if (Downloads.state === 'unknown') Downloads.check().then(() => render());
      return viewDownloads();
    case 'settings':      return viewSettings();
    case 'admin':
      /* the console has its own site; the drivers' site points at it */
      if (!isAdminSite()) return viewAdminElsewhere();
      return viewAdmin();
    default:              return viewDashboard();
  }
}


/* Shown in place of a page that threw, instead of an empty screen. */
function pageErrorHTML(route, err) {
  const detail = String((err && err.stack) || (err && err.message) || err || 'unknown');
  return `<div class="page">
    <div class="card" style="border-color:rgba(239,95,95,.35)">
      <div class="card-body">
        <div class="row gap-12" style="align-items:flex-start">
          <span class="stat-ico" style="flex:none;color:var(--danger)">${icon('alert')}</span>
          <div class="grow" style="min-width:0">
            <div class="b8 lg">This page could not be drawn</div>
            <p class="t2 sm mt-8">Something in <b>${esc(ROUTES[route] ? ROUTES[route].title : route)}</b>
              is not what the app expected. The rest of Heavyline still works — use the menu to
              carry on, and send this to whoever maintains it.</p>
            <pre class="mono xs mt-12" style="white-space:pre-wrap;word-break:break-word;
              max-height:220px;overflow:auto;padding:10px 12px;border-radius:8px;
              background:var(--panel-2);color:var(--text-2)">${esc(detail.slice(0, 900))}</pre>
            <div class="row gap-8 mt-12 wrap">
              <button class="btn btn-sm" data-act="go" data-href="#/dashboard">
                ${icon('home')}Back to the dashboard</button>
              <button class="btn btn-sm" data-act="copy-error"
                data-detail="${esc(route + ' — ' + detail.slice(0, 600))}">
                ${icon('download')}Copy the details</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>`;
}

function render() {
  const app = $('#app');
  if (!state.user) {
    /* Where they were trying to go, kept for after they sign in.

       The whole hash used to be discarded here: someone following a link to
       #/downloads got the sign-in screen — correctly, the client is only for
       drivers who have been released it — and then landed on the dashboard,
       with no sign that the page they asked for existed. They would try the
       link again, get the dashboard again, and conclude the download was
       broken. Nothing said "sign in and you will be taken there". */
    const asked = (location.hash || '').replace(/^#\/?/, '').split('?')[0];
    if (asked && ROUTES[asked] && asked !== 'dashboard') wantedRoute = '#/' + asked;

    app.innerHTML = viewAuth();
    bindAuth();
    bindMagnetic(app);
    return;
  }

  if (!$('#shell')) app.innerHTML = shellHTML();
  else {
    $('#nav').innerHTML = navHTML();
    const bell = $('[data-act="notif-drawer"]');
    if (bell) bell.innerHTML = icon('bell') + (Store.unreadCount(state.user.id) ? '<span class="dot"></span>' : '');
    /* The topbar used to be built once and never touched again, so the count
       on the console button — and the button itself, after a change of
       account — went stale until the page was reloaded. */
    const sw = $('.site-switch');
    const wanted = siteSwitchHTML();
    if (sw && !wanted) sw.remove();
    else if (sw) sw.outerHTML = wanted;
    else if (wanted) {
      const bar = $('.topbar .grow');
      if (bar) bar.insertAdjacentHTML('afterend', wanted);
    }
  }

  const view = $('#view');
  /* The console is not simply a hidden page on the drivers' site — opening it
     without management rights gets an explanation, not a blank screen. */
  if (isAdminSite() && !can('admin.view')) {
    view.innerHTML = viewWrongSite();
    return;
  }
  /* One page failing used to leave the whole area blank with nothing to go on
     but a generic toast — no way to tell which page, or why. Now the page says
     what broke, the rest of the app stays usable, and there is something to
     report. */
  try {
    view.innerHTML = routeView();
  } catch (err) {
    console.error('[HLL] the ' + state.route.name + ' page failed to draw', err);
    view.innerHTML = pageErrorHTML(state.route.name, err);
  }

  document.title = `${ROUTES[state.route.name]?.title || 'HLL'} · Heavyline Logistics`;
  try {
    enhanceA11y(view);
    animateCounts(view);
    bindViewForms();
    bindMagnetic(view);
    tickCountdowns();
  } catch (err) {
    console.error('[HLL] finishing the page failed', err);
  }

  /* Leaflet needs a container that is already in the document, and it has to
     be released when the page changes or it keeps drawing into a node nobody
     can see any more */
  const mapHost = $('#hqMap');
  if (mapHost) LiveMap.mount(mapHost); else LiveMap.destroy();

  /* the convoy map is the same deal: Leaflet needs a node that is already in
     the document, and it has to be released when the page changes */
  const convoyHost = $('#convoyMap');
  if (convoyHost) {
    const e = Store.event(state.route.params[0]);
    if (e) { ConvoyMap.mount(convoyHost, e); ConvoyChat.open(e.id); }
  } else {
    ConvoyMap.destroy();
    ConvoyChat.convoyId = null;
  }

  /* The call overlay is drawn outside the page, so it survives moving
     between screens mid-call. */
  paintCall();

  /* a convoy page with no live panel still has chat */
  const chatCard = $('#convoyChatCard');
  if (chatCard && state.route.name === 'convoy') {
    const e = Store.event(state.route.params[0]);
    if (e) ConvoyChat.open(e.id);
  }
}

/* ---------------- 37. Boot ---------------- */

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

const PRESENCE_WINDOW = 6 * 60 * 1000;

/* Stamps the signed-in driver as here, then rewrites everyone's presence from
   how recently their record was last touched. 'driving' is only ever set by a
   client reporting a live run, so it is left alone while it is still fresh. */
function refreshPresence() {
  rollDistanceWindows();
  const now = Date.now();
  const u = state.user;
  if (u) {
    u.lastSeen = new Date(now).toISOString();
    if (u.status === 'offline') u.status = 'online';
  }
  let changed = false;
  (Store.db.drivers || []).forEach((d) => {
    const seen = d.lastSeen ? new Date(d.lastSeen).getTime() : 0;
    const here = now - seen < PRESENCE_WINDOW;

    /* A client reporting on the live stream is the best evidence there is:
       it means the game is up on their machine this second. It outranks
       lastSeen, which only says the record was touched recently — so the
       roster, the dashboard and the operations board all agree rather than
       one of them showing a driver as offline while another has them
       halfway to Hamburg. */
    const live = Ops.liveFor(d.id);
    const playing = !!live || !!openSessionFor(d.id);

    /* 'driving' used to be left alone once set, because only a client could
       set it and nothing could tell when it stopped being true. The stream
       can, so it is no longer sticky: no live run means not driving. */
    const next = live && live.job ? 'driving'
      : (playing || here) ? 'online'
      : 'offline';

    if (d.status !== next) { d.status = next; changed = true; }
  });
  if (u || changed) Store.save();
  if (changed && (state.route.name === 'community' || state.route.name === 'drivers'
    || state.route.name === 'dashboard')) render();
}


function boot() {
  Store.load();
  normaliseCompany();
  provisionOwner();
  resetToOwner();        /* once per install: clear the company back to its owner */
  ensureOwnerDrives();
  purgeOrphanDrivers();
  /* Before anything is started: if the service is running on this machine
     it is the company's service, and everything below should use it. */
  discoverLocalService().then((found) => {
    if (!found) return;
    Sync.start();
    LiveMap.start();
    if (ServiceAuth.on()) Messages.pullThreads().then(paintUnreadBadge);
  });

  Sync.start();          /* one company across every machine, when a service is set */

  /* The fleet board and the live channel, when a company service is there
     to provide them. This was only reached by saving the service address,
     so on an ordinary load the board never started and every position came
     from the eight-second poll — or from nothing at all. */
  if (Sync.url()) LiveMap.start();

  ServiceAuth.load();    /* and whatever proof of identity this browser kept */
  if (ServiceAuth.on()) ServiceAuth.check();

  /* Restore the session. The local record paints immediately so the app does
     not flash the login screen, then Supabase is asked and has the final say —
     it is the only thing that actually knows whether the session is still
     good. */
  const s = Store.readSession();
  if (s) state.user = Store.driver(s.id) || null;
  restoreSupabaseSession();

  state.route = parseHash();

  /* seed a couple of notifications for the signed-in driver on first run */
  if (state.user && !Store.db.notifications.length) {
    const next = Store.upcomingEvents()[0];
    if (next) Store.notify(state.user.id, { type: 'info', icon: 'route', title: 'Convoy coming up', body: `${next.name} — ${fmt.dt(next.date)}` });
    Store.notify(state.user.id, { type: 'ok', icon: 'megaphone', title: 'Welcome to the HLL command centre', body: 'Your driver record, convoys and fleet in one place.' });
  }

  /* global delegated interactions */
  document.addEventListener('click', (e) => {
    const t = e.target.closest('[data-act]');
    if (!t) return;
    const act = t.dataset.act;
    if (act === 'go' && t.tagName === 'A') return;   /* let anchors do their own thing */
    e.preventDefault();
    e.stopPropagation();
    try { handleAction(act, t, e); }
    catch (err) { console.error('[HLL] action failed', act, err); toast('Something went wrong', 'danger', String(err.message || err)); }
  });

  /* nav anchors close the mobile drawer */
  document.addEventListener('click', (e) => {
    const a = e.target.closest('.nav-item');
    if (a) { const sb = $('#sidebar'); if (sb) sb.classList.remove('open'); }
  });

  window.addEventListener('hashchange', onHashChange);

  /* Enter / Space activate the non-native controls promoted by enhanceA11y */
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const t = e.target.closest('[data-act]');
    if (!t || NATIVELY_FOCUSABLE.has(t.tagName) || t.dataset.act === 'noop') return;
    e.preventDefault();
    t.click();
  });

  /* keyboard */
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
      e.preventDefault(); if (state.user) openSearch(); return;
    }
    if (e.key === 'Escape') {
      if (modalStack.length) { closeModal(); return; }
      const dr = $('.drawer'); if (dr) { closeAllLayers(); return; }
      const mn = $('.menu'); if (mn) mn.remove();
    }
  });

  /* live clock for countdowns */
  setInterval(tickCountdowns, 1000);

  /* Presence is a fact, not decoration: a driver counts as online while their
     record has been touched recently — by this page, or by their client
     syncing in. Anything older than the window reads offline. */
  refreshPresence();
  setInterval(refreshPresence, 30000);

  render();
  if (!state.user) bindAuth();
  dismissSplash();
}

document.addEventListener('DOMContentLoaded', boot);
if (document.readyState !== 'loading') { /* script is at end of body — boot immediately if ready */ }
