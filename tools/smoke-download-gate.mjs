/* The download gate, tested as the permission boundary it is.

     npm run smoke:downloads

   Everything here is the Cloudflare Function code itself, imported and
   run in node — no browser, no network, no Cloudflare. Supabase is a
   stubbed fetch and R2 is a stubbed bucket, so what is under test is the
   part that decides, not the parts that store and transport.

   The interesting cases are the refusals. A gate that lets the right
   people through is easy; this is mostly about the ways somebody could
   try to get a build they have not been approved for:

     - forging a link
     - editing the expiry on one they were given
     - using a link for the 6 MB APK to fetch the 80 MB installer
     - replaying one after it has expired
     - asking while their application is still pending
*/
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const ROOT = path.resolve(process.argv[2] || path.join(import.meta.dirname, '..'));
const load = (p) => import(pathToFileURL(path.join(ROOT, p)).href);

const lib = await load('functions/_lib.js');
const linkFn = await load('functions/api/download-link.js');
const fileFn = await load('functions/api/download/[build].js');

const SECRET = 'a-test-signing-secret';
const fails = [];
const steps = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(44) + v);

function check(what, got, want) {
  if (String(got) === String(want)) say(what, String(got));
  else fails.push(what + ': expected ' + want + ', got ' + got);
}

/* ---------- stubs ---------------------------------------------- */

/* Supabase, as row level security would answer it: the driver sees their
   own row and their own application, and nothing else exists to them. */
function supabase({ role = 'driver', code = 'HLL0041', application = 'pending', token = 'good' }) {
  return async (url, init) => {
    const auth = (init && init.headers && init.headers.Authorization) || '';

    if (auth !== 'Bearer ' + token) {
      return new Response('{}', { status: 401 });
    }

    if (url.includes('/drivers?')) {
      return Response.json([{ driver_code: code, role, status: 'pending' }]);
    }

    if (url.includes('/applications?')) {
      return Response.json(application ? [{ status: application }] : []);
    }

    return new Response('[]', { status: 200 });
  };
}

/* A fully configured deployment: a signing secret AND a bucket.

   Both are needed now. The Function checks it can actually serve a build
   before it agrees to gate one, because a gate that cannot serve anything
   has to stand aside rather than refuse everybody. The tests that want
   the half-built state ask for it explicitly. */
const ENV = (over = {}) => ({
  HLL_DOWNLOAD_SECRET: SECRET,
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  RELEASES: bucket(),
  ...over,
});

/* R2, reduced to the two things the Function uses. */
const bucket = (has = true) => ({
  get: async (name) => (has ? {
    body: 'PRETEND-BINARY:' + name,
    httpEtag: '"etag"',
    size: 1234,
    range: null,
    writeHttpMetadata: () => {},
  } : null),
});

const postLink = (build, authorization, env = ENV()) =>
  linkFn.onRequestPost({
    env,
    request: new Request('https://heavyline.pages.dev/api/download-link', {
      method: 'POST',
      headers: authorization ? { Authorization: authorization } : {},
      body: JSON.stringify({ build }),
    }),
  });

const getFile = (build, token, env = ENV({ RELEASES: bucket() })) =>
  fileFn.onRequestGet({
    env,
    params: { build },
    request: new Request('https://heavyline.pages.dev/api/download/' + build
      + (token == null ? '' : '?t=' + encodeURIComponent(token))),
  });

/* ---------- 1. the token itself -------------------------------- */

const soon = Math.floor(Date.now() / 1000) + 300;
const good = await lib.sign(SECRET, 'win-setup', 'HLL0041', soon);

check('a freshly signed token verifies',
  (await lib.verify(SECRET, good, 'win-setup')).ok, 'true');

check('a token signed with another secret fails',
  (await lib.verify('a-different-secret', good, 'win-setup')).why, 'bad signature');

/* Editing the expiry is the obvious attack: the field is in plain sight
   in the URL. It is inside the signature, so it cannot be moved. */
const stretched = good.replace(String(soon), String(soon + 86400));
check('an extended expiry fails',
  (await lib.verify(SECRET, stretched, 'win-setup')).why, 'bad signature');

/* Nor can the build be swapped — a link for the 6 MB APK must not fetch
   the 80 MB installer. */
const forApk = await lib.sign(SECRET, 'android', 'HLL0041', soon);
check('a token for another build is refused',
  (await lib.verify(SECRET, forApk, 'win-setup')).why, 'token is for another build');

const stale = await lib.sign(SECRET, 'win-setup', 'HLL0041',
  Math.floor(Date.now() / 1000) - 1);
check('an expired token is refused',
  (await lib.verify(SECRET, stale, 'win-setup')).why, 'link expired');

check('a token of the wrong shape is refused',
  (await lib.verify(SECRET, 'nonsense', 'win-setup')).why, 'malformed token');

/* ---------- 2. who may ask for a link -------------------------- */

globalThis.fetch = supabase({ application: 'pending' });

let res = await postLink('win-setup', null);
check('no session — refused', res.status, 401);

res = await postLink('win-setup', 'Bearer wrong');
check('a bad session — refused', res.status, 401);

res = await postLink('win-setup', 'Bearer good');
check('application pending — refused', res.status, 403);
check('and it says why',
  (await res.json()).error.startsWith('Your application has not been approved'), 'true');

globalThis.fetch = supabase({ application: 'approved' });

res = await postLink('win-setup', 'Bearer good');
check('application approved — allowed', res.status, 200);

const minted = (await res.json()).url;
check('the link points at the build',
  minted.startsWith('/api/download/win-setup?t='), 'true');

/* Staff are the people who hand the client out, so they never wait for
   an application of their own. */
globalThis.fetch = supabase({ role: 'admin', application: null });
res = await postLink('win-setup', 'Bearer good');
check('staff need no application', res.status, 200);

globalThis.fetch = supabase({ application: 'approved' });

res = await postLink('not-a-build', 'Bearer good');
check('an unknown build — 404', res.status, 404);

/* A half-built deploy must stand ASIDE, not refuse.

   This used to expect a 500, and that was wrong in a way that would have
   locked every driver out the moment the Function shipped without its
   bucket: a gate answering "refused" to everybody is not a gate, it is
   an outage. It now reports gate: 'off' about itself and the page falls
   back to the public URL, exactly as where no Function is deployed. */
res = await postLink('win-setup', 'Bearer good', ENV({ HLL_DOWNLOAD_SECRET: '' }));
check('no signing secret — stands aside', res.status, 200);
check('and says so plainly', (await res.json()).gate, 'off');

res = await postLink('win-setup', 'Bearer good', ENV({ RELEASES: null }));
check('no bucket bound — stands aside', res.status, 200);
check('and says so plainly too', (await res.json()).gate, 'off');

/* ---------- 3. fetching the file ------------------------------- */

const token = decodeURIComponent(minted.split('t=')[1]);

res = await getFile('win-setup', token);
check('a valid link streams the build', res.status, 200);
check('and it downloads rather than opens',
  res.headers.get('Content-Disposition').includes('attachment'), 'true');
check('and is never cached by a shared cache',
  res.headers.get('Cache-Control'), 'private, no-store');

res = await getFile('win-setup', null);
check('no token — refused', res.status, 403);

res = await getFile('win-setup', stale);
check('an expired link — refused', res.status, 403);
check('and it says so in words a driver can act on',
  (await res.text()).includes('expired'), 'true');

res = await getFile('win-setup', forApk);
check('an APK link cannot fetch the installer', res.status, 403);

res = await getFile('win-setup', token, ENV({ RELEASES: bucket(false) }));
check('a build missing from the bucket — 404', res.status, 404);

/* The file endpoint is only ever reached with a signed link, which only
   exists when the gate was on — so there it IS right to fail loudly. */
res = await getFile('win-setup', token, ENV({ RELEASES: null }));
check('serving with no bucket — refused', res.status, 500);

/* ---------- report --------------------------------------------- */

console.log('\ndownload gate\n' + steps.join('\n'));

if (fails.length) {
  console.log('\n' + fails.length + ' problem(s)');
  fails.forEach((f) => console.log('  ' + f));
  process.exit(1);
}

console.log('\nclean');
