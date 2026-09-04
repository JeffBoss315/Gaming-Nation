/* Shared by the two download Functions.

   The leading underscore keeps this file out of the routing table —
   Cloudflare Pages turns every other file under functions/ into a URL, and
   this one is a module, not an endpoint.

   Why any of this exists: the client installers used to sit on public
   GitHub Releases, so the approval gate on the downloads page decided what
   the site OFFERED and nothing more. Anyone with the link had the file.
   Now the builds live in a private R2 bucket that has no public URL at
   all, and the only way to one is through here.
*/

/* The builds, by the key the page uses. Kept here rather than read from
   script.js because a Function cannot import the site's bundle, and
   because this list is a permission boundary: a key that is not in it
   cannot be downloaded, whatever the request says. */
export const BUILDS = {
  'win-setup': {
    object: 'Gaming-Nation-Trucker-1.0.0-windows-setup.exe',
    type: 'application/octet-stream',
  },
  'win-portable': {
    object: 'Gaming-Nation-Trucker-1.0.0-windows-portable.exe',
    type: 'application/octet-stream',
  },
  android: {
    object: 'Gaming-Nation-Trucker-1.0.0-android.apk',
    type: 'application/vnd.android.package-archive',
  },
};

/* How long a minted link lives. Long enough to start a download on a slow
   phone, short enough that a link pasted into Discord is dead before
   anybody clicks it. */
export const LINK_TTL_SECONDS = 300;

export const json = (body, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });

/* base64url — the token travels in a query string, so + / = are out. */
const b64url = (bytes) => {
  let s = '';
  for (const b of new Uint8Array(bytes)) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

const key = (secret) =>
  crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );

/* The grant, as a string the browser can carry in a URL:

     <build>.<expiry>.<driver>.<signature>

   Signed rather than encrypted — there is nothing secret in it. What
   matters is that none of the three fields can be changed without the
   signature failing, so a driver cannot extend their own expiry or swap
   the build for one they were not granted. */
export async function sign(secret, build, driver, expiresAt) {
  const payload = `${build}.${expiresAt}.${driver}`;
  const mac = await crypto.subtle.sign('HMAC', await key(secret),
    new TextEncoder().encode(payload));
  return `${payload}.${b64url(mac)}`;
}

export async function verify(secret, token, build) {
  if (typeof token !== 'string') return { ok: false, why: 'no token' };

  const parts = token.split('.');
  if (parts.length !== 4) return { ok: false, why: 'malformed token' };

  const [tokenBuild, expiresAt, driver] = parts;

  /* Checked before the signature so a token minted for the small APK
     cannot be replayed against an 80 MB installer. */
  if (tokenBuild !== build) return { ok: false, why: 'token is for another build' };

  const expected = await sign(secret, tokenBuild, driver, expiresAt);

  /* Constant time. A byte-at-a-time comparison that returns early leaks
     how much of a guess was right, which is enough to forge a signature
     one byte per request. */
  if (expected.length !== token.length) return { ok: false, why: 'bad signature' };

  let diff = 0;
  for (let i = 0; i < expected.length; i++) {
    diff |= expected.charCodeAt(i) ^ token.charCodeAt(i);
  }
  if (diff !== 0) return { ok: false, why: 'bad signature' };

  if (Number(expiresAt) * 1000 < Date.now()) return { ok: false, why: 'link expired' };

  return { ok: true, driver };
}

/* Is the caller an approved driver?

   Deliberately does NOT use a service key. It forwards the driver's own
   Supabase access token, so every query runs as them under row level
   security — the database decides what they may see, and this Function
   holds no credential that could read anybody else's record. A stolen or
   expired token simply reads nothing.
*/
export async function approvedDriver(env, authorization) {

  if (!authorization || !/^Bearer\s+.+/i.test(authorization)) {
    return { ok: false, status: 401, why: 'Sign in first.' };
  }

  const url = env.SUPABASE_URL;
  const anon = env.SUPABASE_ANON_KEY;

  if (!url || !anon) {
    return { ok: false, status: 500, why: 'The download service is not configured.' };
  }

  const headers = { apikey: anon, Authorization: authorization };

  /* No filter needed: RLS returns this driver's own row and nothing else,
     so "the first row I can see" IS me. */
  const meRes = await fetch(
    `${url}/rest/v1/drivers?select=driver_code,role,status&limit=1`, { headers });

  if (meRes.status === 401) {
    return { ok: false, status: 401, why: 'Your session has expired. Sign in again.' };
  }

  if (!meRes.ok) {
    return { ok: false, status: 502, why: 'Could not reach the driver records.' };
  }

  const me = (await meRes.json())[0];

  if (!me) {
    return { ok: false, status: 403, why: 'No driver record is linked to this account.' };
  }

  /* Staff have the client from the start — they are the people who hand
     it out. */
  if (['admin', 'super_admin', 'management'].includes(me.role)) {
    return { ok: true, driver: me.driver_code || 'staff' };
  }

  const appRes = await fetch(
    `${url}/rest/v1/applications?select=status&driver_id=eq.${encodeURIComponent(me.driver_code)}&limit=1`,
    { headers });

  if (!appRes.ok) {
    return { ok: false, status: 502, why: 'Could not read your application.' };
  }

  const application = (await appRes.json())[0];

  if (!application || application.status !== 'approved') {
    return {
      ok: false,
      status: 403,
      why: 'Your application has not been approved yet. '
        + 'A recruiter releases the client once it is.',
    };
  }

  return { ok: true, driver: me.driver_code };
}
