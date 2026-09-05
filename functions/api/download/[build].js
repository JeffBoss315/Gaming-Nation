/* GET /api/download/<build>?t=<signed token>

   Streams the installer out of the private R2 bucket, to whoever holds a
   link this site minted in the last five minutes.

   No Supabase call here. The signature IS the proof: /api/download-link
   already asked the database whether this driver is approved, and would
   not have signed anything if the answer was no. Re-checking would cost a
   round trip on every range request a resuming download makes.
*/
import { BUILDS, verify } from '../../_lib.js';

const fail = (status, why) =>
  new Response(why + '\n', {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function onRequestGet({ request, params, env }) {

  const build = params.build;
  const spec = BUILDS[build];

  if (!spec) return fail(404, 'There is no such build.');

  const secret = (env.GMN_DOWNLOAD_SECRET || env.HLL_DOWNLOAD_SECRET);
  if (!secret) return fail(500, 'The download service is not configured.');

  const bucket = env.RELEASES;
  if (!bucket) return fail(500, 'The release store is not bound to this site.');

  const token = new URL(request.url).searchParams.get('t');
  const check = await verify(secret, token, build);

  if (!check.ok) {
    /* 403 rather than 404: the file is certainly there, and telling
       somebody their link has expired is the difference between "try
       again" and "this is broken". */
    return fail(403, check.why === 'link expired'
      ? 'This download link has expired. Go back and press Download again.'
      : 'This download link is not valid.');
  }

  /* Range is forwarded so a dropped 80 MB download resumes instead of
     starting again — R2 handles the partial read, and the browser gets
     the 206 it is expecting. */
  const range = request.headers.get('Range');

  const object = await bucket.get(spec.object,
    range ? { range: request.headers } : undefined);

  if (!object) return fail(404, 'That build is not in the release store.');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', spec.type);
  headers.set('etag', object.httpEtag);
  headers.set('Content-Disposition',
    `attachment; filename="${spec.object}"`);
  /* Private, and not for any shared cache: the URL is a capability. */
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Accept-Ranges', 'bytes');

  if (object.range && object.size != null) {
    const start = object.range.offset || 0;
    const end = start + (object.range.length || 0) - 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
  }

  return new Response(object.body, {
    status: object.range ? 206 : 200,
    headers,
  });
}
