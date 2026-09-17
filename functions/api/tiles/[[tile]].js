/* GET /api/tiles/<game>/<z>/<x>/<y>.png

   The game's own map, served from this site.

   The schematic the client draws from map-data.js is a diagram: cities in
   roughly the right places with straight lines between them. The real ETS2
   and ATS map is a picture rendered from the games' own files, which is
   what every map site worth looking at is showing. Those renders are not
   ours to borrow from whoever hosts them - so they are generated from a
   game install with ts-map (MIT), put in this company's own R2 bucket
   under a tiles/ prefix, and handed out from here.

   No approval gate on these: a map picture is not the client, every driver
   needs them, and a browser asking for two hundred of them a minute cannot
   carry a signed link for each one. They are cached hard instead - a tile
   only changes when the map is rendered again, and a re-render goes to a
   new prefix rather than over the top of the old one.
*/

/* <game>/<z>/<x>/<y>.<ext> and nothing else. This is a key going into a
   bucket, so it is matched rather than trusted: no dots to climb with, no
   slashes beyond the four, and a length a tile path cannot exceed. */
const TILE = /^([a-z0-9_-]{1,24})\/(\d{1,2})\/(-?\d{1,7})\/(-?\d{1,7})\.(png|jpg|jpeg|webp)$/;

const TYPES = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

const plain = (status, why) =>
  new Response(why + '\n', {
    status,
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store' },
  });

export async function onRequestGet({ params, env }) {
  const path = Array.isArray(params.tile) ? params.tile.join('/') : String(params.tile || '');

  const m = TILE.exec(path);
  if (!m) return plain(404, 'Not a tile.');

  const bucket = env.TILES || env.RELEASES;
  if (!bucket) return plain(503, 'No tile store is bound to this site yet.');

  const object = await bucket.get('tiles/' + path);

  /* A missing tile is ordinary: a pyramid is square and the map is not, so
     the corners of every zoom level are empty. Leaflet draws nothing and
     carries on, which is why this says so quietly and is not cached. */
  if (!object) return plain(404, 'No tile there.');

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('Content-Type', TYPES[m[5]] || 'application/octet-stream');
  headers.set('etag', object.httpEtag);
  /* Immutable: this exact tile at this exact zoom will not change under
     this key. A new render is a new prefix. */
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');

  return new Response(object.body, { status: 200, headers });
}
