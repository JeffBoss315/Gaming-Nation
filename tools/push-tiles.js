/* Put a rendered game map into the company's bucket.

     node tools/push-tiles.js <folder> --game ets2 [--dry] [--jobs 16]

   The real ETS2 / ATS map is a picture rendered from the games' own files.
   Render it from an installation with ts-map (MIT,
   github.com/dariowouters/ts-map), which writes a plain tile pyramid:

     <folder>/<z>/<x>/<y>.png

   This walks that folder and puts every tile in R2 under

     tiles/<game>/<z>/<x>/<y>.png

   which is exactly what functions/api/tiles/[[tile]].js hands back out, so
   the map every driver sees comes from this company's own address and not
   from somebody else's tile server.

   WHY NOT WRANGLER: `wrangler r2 object put` is one process per object,
   and a pyramid is tens of thousands of them - hours, for a job that takes
   minutes over the S3 API. That API wants a key pair rather than the
   wrangler login, so it needs three things in the environment:

     CLOUDFLARE_ACCOUNT_ID    R2 -> Overview, top right
     R2_ACCESS_KEY_ID         R2 -> Manage API tokens -> Create, Object R/W
     R2_SECRET_ACCESS_KEY     shown once, when the token is created

   Interrupted runs resume: every finished key is written to a manifest
   beside the folder, and a second run skips what is already up there.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');

const flag = (name, fallback) => {
  const i = args.indexOf('--' + name);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};

const FOLDER = path.resolve(args.find((a) => !a.startsWith('--')) || '.');
const GAME = String(flag('game', '')).toLowerCase();
const JOBS = Math.max(1, Math.min(64, Number(flag('jobs', 16)) || 16));
const PREFIX = flag('prefix', 'tiles');

const TYPES = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp' };

function die(...lines) {
  console.log('');
  lines.forEach((l) => console.log('  ' + l));
  console.log('');
  process.exit(1);
}

if (!/^[a-z0-9_-]{1,24}$/.test(GAME)) {
  die('Which game is this render of?', '', '  node tools/push-tiles.js <folder> --game ets2',
    '  node tools/push-tiles.js <folder> --game ats');
}
if (!fs.existsSync(FOLDER) || !fs.statSync(FOLDER).isDirectory()) {
  die('No such folder: ' + FOLDER);
}

/* The bucket is the one the site already reads from - named once, in
   wrangler.toml, rather than repeated here. */
function bucketName() {
  const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
  const m = toml.match(/bucket_name\s*=\s*"([^"]+)"/);
  if (!m) die('No bucket_name in wrangler.toml — is the R2 binding still there?');
  return m[1];
}

const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;
const KEY_ID = process.env.R2_ACCESS_KEY_ID;
const SECRET = process.env.R2_SECRET_ACCESS_KEY;
const BUCKET = bucketName();

if (!DRY && (!ACCOUNT || !KEY_ID || !SECRET)) {
  die('The S3 API needs a key pair, which the wrangler login is not.',
    '',
    'Set these, then run again:',
    '  CLOUDFLARE_ACCOUNT_ID    R2 -> Overview, top right',
    '  R2_ACCESS_KEY_ID         R2 -> Manage API tokens -> Create (Object Read & Write)',
    '  R2_SECRET_ACCESS_KEY     shown once, when the token is made',
    '',
    '--dry works without them and says what would go up.');
}

const HOST = ACCOUNT ? `${ACCOUNT}.r2.cloudflarestorage.com` : 'account.r2.cloudflarestorage.com';

/* ---------- walking the render ---------- */

/* <z>/<x>/<y>.<ext> and nothing else: the renderer writes other things
   beside the tiles - an html page, a stylesheet - and they are not part of
   the map. */
const TILE = /^(\d{1,2})[\\/](-?\d{1,7})[\\/](-?\d{1,7})\.(png|jpg|jpeg|webp)$/;

function walk(dir, base = '') {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = base ? base + '/' + entry.name : entry.name;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full, rel));
    else if (TILE.test(rel)) out.push({ rel: rel.replace(/\\/g, '/'), full, size: fs.statSync(full).size });
  }
  return out;
}

/* ---------- signing ---------- */

const sha256 = (b) => crypto.createHash('sha256').update(b).digest('hex');
const hmac = (key, data) => crypto.createHmac('sha256', key).update(data).digest();

function signedHeaders(key, body, type) {
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '');
  const dateStamp = amzDate.slice(0, 8);
  const payloadHash = sha256(body);
  const canonicalUri = '/' + [BUCKET, ...key.split('/')].map(encodeURIComponent).join('/');

  const canonicalHeaders =
    `content-type:${type}\nhost:${HOST}\nx-amz-content-sha256:${payloadHash}\nx-amz-date:${amzDate}\n`;
  const signed = 'content-type;host;x-amz-content-sha256;x-amz-date';

  const canonicalRequest =
    ['PUT', canonicalUri, '', canonicalHeaders, signed, payloadHash].join('\n');

  const scope = `${dateStamp}/auto/s3/aws4_request`;
  const toSign = ['AWS4-HMAC-SHA256', amzDate, scope, sha256(canonicalRequest)].join('\n');

  const kDate = hmac('AWS4' + SECRET, dateStamp);
  const kRegion = hmac(kDate, 'auto');
  const kService = hmac(kRegion, 's3');
  const kSigning = hmac(kService, 'aws4_request');
  const signature = crypto.createHmac('sha256', kSigning).update(toSign).digest('hex');

  return {
    Authorization: `AWS4-HMAC-SHA256 Credential=${KEY_ID}/${scope}, SignedHeaders=${signed}, Signature=${signature}`,
    'Content-Type': type,
    'x-amz-content-sha256': payloadHash,
    'x-amz-date': amzDate,
  };
}

async function put(key, body, type) {
  const url = `https://${HOST}/${BUCKET}/${key}`;
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(url, { method: 'PUT', headers: signedHeaders(key, body, type), body });
      if (res.ok) return true;
      /* 5xx is weather; 4xx is a mistake and will not get better by asking again */
      if (res.status < 500) {
        console.log('\n  refused (' + res.status + ') ' + key + ' — ' + (await res.text()).slice(0, 160));
        return false;
      }
    } catch (e) {
      if (attempt === 4) { console.log('\n  failed ' + key + ' — ' + e.message); return false; }
    }
    await new Promise((r) => setTimeout(r, 400 * attempt));
  }
  return false;
}

/* ---------- the run ---------- */

const MANIFEST = path.join(FOLDER, '.gmn-uploaded-' + GAME + '.json');

function readManifest() {
  try { return new Set(JSON.parse(fs.readFileSync(MANIFEST, 'utf8'))); } catch (e) { return new Set(); }
}

(async () => {
  console.log('\nreading ' + FOLDER);
  const tiles = walk(FOLDER);

  if (!tiles.length) {
    die('No tiles in there.',
      'A ts-map export looks like <folder>/<z>/<x>/<y>.png — point this at the',
      'folder that holds the numbered zoom directories.');
  }

  const done = readManifest();
  const todo = tiles.filter((t) => !done.has(t.rel));
  const mb = (tiles.reduce((n, t) => n + t.size, 0) / 1e6).toFixed(1);
  const zooms = [...new Set(tiles.map((t) => t.rel.split('/')[0]))].sort((a, b) => a - b);

  console.log('  ' + tiles.length.toLocaleString('en-GB') + ' tile(s), ' + mb + ' MB, zoom '
    + zooms[0] + '–' + zooms[zooms.length - 1]);
  console.log('  bucket  ' + BUCKET);
  console.log('  keys    ' + PREFIX + '/' + GAME + '/<z>/<x>/<y>.png');
  if (done.size) console.log('  already up: ' + done.size.toLocaleString('en-GB'));

  if (DRY) { console.log('\n--dry: nothing uploaded.\n'); return; }
  if (!todo.length) { console.log('\nEverything is already in the bucket.\n'); return; }

  let sent = 0, failed = 0, last = Date.now();
  const queue = todo.slice();

  const worker = async () => {
    for (;;) {
      const t = queue.pop();
      if (!t) return;
      const key = `${PREFIX}/${GAME}/${t.rel}`;
      const ok = await put(key, fs.readFileSync(t.full), TYPES[path.extname(t.rel)] || 'image/png');
      if (ok) { sent++; done.add(t.rel); } else failed++;

      /* a line that moves, and a manifest that survives a Ctrl-C */
      if (Date.now() - last > 1000) {
        last = Date.now();
        process.stdout.write('\r  ' + sent.toLocaleString('en-GB') + ' / '
          + todo.length.toLocaleString('en-GB') + (failed ? '  (' + failed + ' failed)' : '') + '   ');
        fs.writeFileSync(MANIFEST, JSON.stringify([...done]));
      }
    }
  };

  await Promise.all(Array.from({ length: JOBS }, worker));
  fs.writeFileSync(MANIFEST, JSON.stringify([...done]));

  console.log('\r  ' + sent.toLocaleString('en-GB') + ' uploaded'
    + (failed ? ', ' + failed + ' failed' : '') + '                    ');
  console.log('\nThe map is in the bucket. In the client: Live map -> Map ->');
  console.log('"Gaming Nation map", then Save, then line it up once per game.\n');

  process.exit(failed ? 1 : 0);
})().catch((e) => { console.log('threw: ' + e.message); process.exit(1); });
