/* Put the built installers into the private R2 bucket.

     npm run release:push            upload the builds the site links to
     npm run release:push -- --dry   say what would go, upload nothing

   The downloads page does not link to files any more — it asks
   functions/api/download-link.js for a signed link, and that Function
   reads the object out of R2 by the name listed in functions/_lib.js.
   So the names here have to match that list exactly, and this checks
   they do rather than uploading something the site will never ask for.

   Needs wrangler to be logged in:  npx wrangler login
*/
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');
const DRY = process.argv.includes('--dry');
/* Send up what has been built, rather than refusing until every target
   has. The site falls back to the published release for anything the
   bucket has not got, so a half-filled bucket is a working download page
   and not a broken one. */
const PARTIAL = process.argv.includes('--partial');

/* Read the object names straight out of the Function, so this script and
   the thing that serves the files cannot drift apart. */
function wantedObjects() {
  const src = fs.readFileSync(path.join(ROOT, 'functions', '_lib.js'), 'utf8');

  /* The names are assembled there from a version and a suffix, so that
     cutting a release is one line. This used to match whole quoted
     strings, which is what they were before that helper arrived - and the
     day it did, this matched nothing and said so in a way that sounded
     like the file was broken. Built the same way instead. */
  const version = (src.match(/RELEASE_VERSION\s*=\s*'([^']+)'/) || [])[1];
  const template = (src.match(/const OBJECT = \(suffix\) =>\s*`([^`]+)`/) || [])[1];

  const names = template && version
    ? [...src.matchAll(/OBJECT\('([^']+)'\)/g)].map((m) => template
        .replace('${RELEASE_VERSION}', version)
        .replace('${suffix}', m[1]))
    : [];

  if (!names.length) {
    console.log('Could not read any build names out of functions/_lib.js.');
    process.exit(1);
  }
  return names;
}

/* The bucket name lives in wrangler.toml; read it rather than repeat it. */
function bucketName() {
  const toml = fs.readFileSync(path.join(ROOT, 'wrangler.toml'), 'utf8');
  const m = toml.match(/bucket_name\s*=\s*"([^"]+)"/);
  if (!m) {
    console.log('No bucket_name in wrangler.toml — is the R2 binding still there?');
    process.exit(1);
  }
  return m[1];
}

const bucket = bucketName();
const objects = wantedObjects();

console.log('\nbucket  ' + bucket);
console.log('from    release/\n');

const missing = [];
const plan = [];

for (const name of objects) {
  const file = path.join(RELEASE, name);

  if (!fs.existsSync(file)) { missing.push(name); continue; }

  const mb = (fs.statSync(file).size / 1e6).toFixed(1);
  plan.push({ name, file, mb });
}

for (const p of plan) console.log('  ' + p.name.padEnd(48) + p.mb + ' MB');
for (const m of missing) console.log('  ' + m.padEnd(48) + 'MISSING');

if (missing.length && !PARTIAL) {
  console.log('\n' + missing.length + ' build(s) are not in release/.');
  console.log('Run npm run dist (and npm run android) first, or correct the');
  console.log('names in functions/_lib.js if a version was cut.');
  console.log('Or pass --partial to send up the ones that are built.');
  process.exit(1);
}

if (missing.length) {
  console.log('\n' + missing.length + ' build(s) not built — --partial, so the rest');
  console.log('goes up. The site serves the published release for anything the');
  console.log('bucket has not got.');
}

if (!plan.length) {
  console.log('\nNothing to upload.');
  process.exit(1);
}

if (DRY) {
  console.log('\n--dry: nothing uploaded.');
  process.exit(0);
}

let failed = 0;

for (const p of plan) {
  process.stdout.write('\nuploading ' + p.name + ' … ');

  /* On Windows this runs through cmd, and cmd cuts an argument at every
     space it sees. The project lives under "VS CODE\PROJECTS\GAMING
     NATION", so the path arrived at wrangler as four separate arguments
     and every upload failed with "Unknown arguments: CODE\PROJECTS\GAMING,
     NATION\release\..." - a message that reads like a wrangler fault and
     is entirely this line's doing. Quote what the shell would take apart. */
  const shell = process.platform === 'win32';
  const arg = (s) => (shell && /\s/.test(s) ? '"' + s + '"' : s);

  const res = spawnSync('npx', [
    'wrangler', 'r2', 'object', 'put',
    arg(bucket + '/' + p.name),
    '--file', arg(p.file),
    '--remote',
  ], { cwd: ROOT, encoding: 'utf8', shell });

  if (res.status === 0) {
    console.log('ok');
  } else {
    failed += 1;
    console.log('failed');
    console.log((res.stderr || res.stdout || String(res.error) || '').trim());
  }
}

if (failed) {
  console.log('\n' + failed + ' upload(s) failed. Is wrangler logged in? npx wrangler login');
  process.exit(1);
}

console.log('\nAll builds are in the bucket. They have no public URL — the site');
console.log('hands out five-minute signed links to approved drivers only.\n');
