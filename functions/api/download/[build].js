/* GET /api/download/<build>?t=<signed token>

   The installer, served BY THIS SITE.

   A driver updating their client should never be handed off to
   github.com: they came to the website, and the file arrives from the
   website. Cloudflare will not host a 96 MB asset beside the pages, so
   the bytes come from one of two places, and neither is the driver's
   problem:

     R2       the private bucket, once it is bound as RELEASES. This is
              where builds belong - no public address at all.
     the
     release  until that binding exists, the newest published GitHub
              release is read HERE, server side, and streamed back out of
              this origin. Same file, same URL bar.

   The gate, when there is one: /api/download-link asks the database
   whether this driver is approved and signs a short-lived token, and the
   signature is the proof - no Supabase call here, because re-checking
   would cost a round trip on every range request a resuming download
   makes. A deployment with no GMN_DOWNLOAD_SECRET cannot sign anything,
   and refusing everybody would be worse than the ungated state it was
   meant to improve on, so it serves. That is the same exposure the public
   release links already had, and the downloads page tells staff, in as
   many words, that the gate is off.
*/
import { BUILDS, directAssetUrl, publishedAsset, verify } from '../../_lib.js';

const fail = (status, why) =>
  new Response(why + '\n', {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function onRequestGet({ request, params, env }) {

  const build = params.build;
  const spec = BUILDS[build];

  if (!spec) return fail(404, 'There is no such build.');

  const secret = env.GMN_DOWNLOAD_SECRET;

  /* Only a deployment that can sign is allowed to demand a signature. */
  if (secret) {
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
  }

  /* Range is forwarded either way so a dropped 96 MB download resumes
     instead of starting again - the browser gets the 206 it expects. */
  const range = request.headers.get('Range');

  const bucket = env.RELEASES;
  if (bucket) {
    const object = await bucket.get(spec.object,
      range ? { range: request.headers } : undefined);

    /* No object is not an error yet: a version bumped ahead of its upload
       still has a published release behind it. */
    if (object) {
      const headers = new Headers();
      object.writeHttpMetadata(headers);
      headers.set('Content-Type', spec.type);
      headers.set('etag', object.httpEtag);
      headers.set('Content-Disposition', `attachment; filename="${spec.object}"`);
      /* Private, and not for any shared cache: the URL is a capability. */
      headers.set('Cache-Control', 'private, no-store');
      headers.set('Accept-Ranges', 'bytes');

      if (object.range && object.size != null) {
        const start = object.range.offset || 0;
        const end = start + (object.range.length || 0) - 1;
        headers.set('Content-Range', `bytes ${start}-${end}/${object.size}`);
      }

      return new Response(object.body, { status: object.range ? 206 : 200, headers });
    }
  }

  /* This version by its own address first, and only then by asking which
     releases exist: the API allows 60 questions an hour from one place,
     and a download that depends on one is a download that fails on the
     day it is busiest. The feed is for the window where this site has
     moved on to a version nobody has published yet. */
  const reach = async (candidate) => {
    if (!candidate) return null;
    const res = await fetch(candidate.url, {
      headers: range ? { Range: range } : {},
      redirect: 'follow',
    });
    if (res.ok || res.status === 206) return { res, name: candidate.name };
    return null;
  };

  const got = await reach({ url: directAssetUrl(spec.object), name: spec.object })
    || await reach(await publishedAsset(spec.object));

  if (!got) {
    return fail(404, bucket
      ? 'That build is not in the release store, and no release has it either.'
      : 'That build has not been published yet.');
  }

  const upstream = got.res;

  const headers = new Headers();
  for (const h of ['Content-Length', 'Content-Range', 'etag', 'Last-Modified']) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  headers.set('Content-Type', spec.type);
  headers.set('Content-Disposition', `attachment; filename="${got.name}"`);
  headers.set('Cache-Control', 'private, no-store');
  headers.set('Accept-Ranges', 'bytes');

  return new Response(upstream.body, { status: upstream.status, headers });
}
