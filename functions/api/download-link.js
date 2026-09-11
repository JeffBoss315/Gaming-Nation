/* POST /api/download-link   { "build": "win-setup" }
   Authorization: Bearer <the driver's Supabase access token>

   Answers with a short-lived URL for the real file, or with the reason
   they cannot have one.

   Why a second step rather than gating the file itself: a download is a
   plain navigation, and a navigation cannot carry an Authorization
   header. So the browser proves who it is here, where it CAN send the
   header, and is handed a signed link it can simply follow.
*/
import { BUILDS, LINK_TTL_SECONDS, approvedDriver, json, sign } from '../_lib.js';

export async function onRequestPost({ request, env }) {

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: 'Send JSON.' }, 400);
  }

  const build = body && body.build;

  if (!BUILDS[build]) {
    return json({ error: 'There is no such build.' }, 404);
  }

  /* Can this deployment actually gate anything?

     A Function that is deployed but has no signing secret, or no bucket
     to read from, cannot release a build to anybody — and if it answers
     "refused" then NOBODY gets a download, approved or not. That is
     worse than the ungated state it was meant to improve on.

     So it says so plainly instead, and the page falls back to the public
     URL exactly as it does where no Function is deployed at all. The
     staff banner on the downloads page still reports the gate as off,
     which is the honest description of a half-finished setup. */
  const ready = !!(env.GMN_DOWNLOAD_SECRET || env.HLL_DOWNLOAD_SECRET) && !!env.RELEASES;

  if (!ready) {
    return json({
      gate: 'off',
      reason: !(env.GMN_DOWNLOAD_SECRET || env.HLL_DOWNLOAD_SECRET)
        ? 'GMN_DOWNLOAD_SECRET is not set on this project.'
        : 'No R2 bucket is bound to this project as RELEASES.',
    }, 200);
  }

  const secret = (env.GMN_DOWNLOAD_SECRET || env.HLL_DOWNLOAD_SECRET);

  const who = await approvedDriver(env, request.headers.get('Authorization'));

  if (!who.ok) {
    return json({ error: who.why }, who.status);
  }

  const expiresAt = Math.floor(Date.now() / 1000) + LINK_TTL_SECONDS;
  const token = await sign(secret, build, who.driver, expiresAt);

  return json({
    url: `/api/download/${build}?t=${encodeURIComponent(token)}`,
    expiresIn: LINK_TTL_SECONDS,
  });
}

/* A GET is how the page asks whether there is a gate here at all, before
   anybody presses anything. It answers as JSON either way — that is what
   tells the page a Function is present rather than a rewritten 404 — and
   reports whether this deployment is actually able to gate. */
export const onRequestGet = ({ env }) =>
  json({
    gate: ((env.GMN_DOWNLOAD_SECRET || env.HLL_DOWNLOAD_SECRET) && env.RELEASES) ? 'on' : 'off',
    hint: 'POST here with a build and your session to get a download link.',
  }, 200);
