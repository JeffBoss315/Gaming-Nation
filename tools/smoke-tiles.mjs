/* The map tile route, against a bucket that is not there and one that is.

     npm run smoke:tiles

   The tiles are the game's own map, rendered from the game files and kept
   in this company's bucket. They are handed out ungated - a browser asks
   for hundreds a minute and cannot carry a signed link for each one - so
   what matters here is that the path cannot be used to reach anything but
   a tile, and that a tile is cached hard once it has been.
*/
import * as tiles from '../functions/api/tiles/[[tile]].js';

const steps = [];
const fails = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(52) + v);
const check = (what, got, want) => {
  if (String(got) === String(want)) say(what, String(got));
  else fails.push(what + ': expected ' + want + ', got ' + got);
};

/* R2, reduced to the one call the route makes. */
const bucket = (has = true) => ({
  get: async (key) => (has && key.startsWith('tiles/') ? {
    body: 'PRETEND-PNG:' + key,
    httpEtag: '"tile-etag"',
    writeHttpMetadata: () => {},
  } : null),
});

const get = (path, env) => tiles.onRequestGet({
  env,
  params: { tile: path.split('/') },
  request: new Request('https://gaming-nation.pages.dev/api/tiles/' + path),
});

const ENV = (over = {}) => ({ RELEASES: bucket(), ...over });

/* ---- an ordinary tile ---- */
let res = await get('ets2/5/16/11.png', ENV());
check('a tile is served', res.status, 200);
check('as a png', res.headers.get('Content-Type'), 'image/png');
check('cached hard, because it will not change', res.headers.get('Cache-Control'),
  'public, max-age=31536000, immutable');
check('and readable from the client, which is a file:// page',
  res.headers.get('Access-Control-Allow-Origin'), '*');

res = await get('ats/0/0/0.webp', ENV());
check('the other game, and other formats', res.headers.get('Content-Type'), 'image/webp');

/* ---- the corners of a pyramid are empty, and that is not an error ---- */
res = await get('ets2/5/16/11.png', ENV({ RELEASES: bucket(false) }));
check('a missing tile is a plain 404', res.status, 404);
check('and is not cached as one', res.headers.get('Cache-Control'), 'no-store');

/* ---- the path is a key going into a bucket ---- */
for (const bad of [
  '../releases/Gaming-Nation-Tracker-1.2.1-windows-setup.exe',
  'ets2/5/16/11.png/../../../secret',
  'ets2/5/16/11.exe',
  'ets2/5/16.png',
  'ETS2/5/16/11.png',
  'ets2/999999/1/1.png',
]) {
  const r = await get(bad, ENV());
  if (r.status !== 404) fails.push('a path that is not a tile was served: ' + bad + ' → ' + r.status);
}
say('nothing but <game>/<z>/<x>/<y>.<img> is served', 'refused 6 of 6');

/* ---- before the bucket is bound ---- */
res = await get('ets2/5/16/11.png', ENV({ RELEASES: null }));
check('no bucket yet — says so, rather than 404', res.status, 503);

console.log('\nmap tiles\n' + steps.join('\n'));

if (fails.length) {
  console.log('\n' + fails.length + ' problem(s)');
  fails.forEach((f) => console.log('  ' + f));
  process.exit(1);
}
console.log('\nclean\n');
