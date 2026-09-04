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

  const secret = env.HLL_DOWNLOAD_SECRET;

  if (!secret) {
    /* Without it every link would be forgeable, so refuse rather than
       fall back to something weaker. */
    return json({ error: 'The download service is not configured.' }, 500);
  }

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

/* A GET here is somebody following a stale link or poking about. Say what
   the endpoint is for rather than returning the framework's 405. */
export const onRequestGet = () =>
  json({ error: 'POST here with a build and your session to get a download link.' }, 405);
