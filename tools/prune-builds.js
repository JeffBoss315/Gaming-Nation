/* ============================================================
   Old builds go when a new one arrives.

     node tools/prune-builds.js            (run by npm run dist / android)
     node tools/prune-builds.js --dry-run  (say what would go, remove nothing)

   Every release left its installers behind, so release/ accumulated
   a version per build — 160 MB of Windows binaries apiece. Worse
   than the disk: the downloads page names one version, and the
   directory holds several, so the first question about any file is
   "is this the one?"

   The current version is the one in package.json. Anything in a
   build directory carrying a DIFFERENT version is a previous
   release and goes.

   Deliberately conservative. It only removes files whose names
   carry a version number it can read, and only inside the build
   directories listed below. A file it cannot parse a version out
   of is left alone — this is a tidy-up, and a tidy-up that deletes
   something it did not understand is not a tidy-up.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const CURRENT = String(pkg.version || '').trim();

if (!/^\d+\.\d+\.\d+/.test(CURRENT)) {
  console.error('package.json has no usable version — nothing pruned');
  process.exit(1);
}

/* Where builds land. dist/ and the unpacked tree are intermediates and are
   cleared wholesale; release/ and dist-apk/ hold artefacts people keep. */
const DIRS = ['release', 'dist-apk'];

/* x.y.z anywhere in the name, which covers every shape this project
   produces: Heavyline-Trucker-4.8.0-windows-setup.exe, and the
   "Heavyline Trucker 4.8.0 portable.exe" electron-builder writes. */
const VERSION = /(\d+\.\d+\.\d+)/;

let removed = 0;
let bytes = 0;
let kept = 0;

console.log('\nprune  (current version ' + CURRENT + (DRY ? ', dry run' : '') + ')');

for (const dir of DIRS) {
  const abs = path.join(ROOT, dir);
  if (!fs.existsSync(abs)) continue;

  const entries = fs.readdirSync(abs, { withFileTypes: true });
  const stale = [];

  for (const e of entries) {
    if (!e.isFile()) continue;
    const m = e.name.match(VERSION);
    if (!m) { kept++; continue; }          /* no version in the name: not ours to judge */
    if (m[1] === CURRENT) { kept++; continue; }
    stale.push(e.name);
  }

  if (!stale.length) {
    console.log('  ' + dir + '/  nothing to remove');
    continue;
  }

  console.log('  ' + dir + '/');
  for (const name of stale) {
    const file = path.join(abs, name);
    let size = 0;
    try { size = fs.statSync(file).size; } catch (e) { /* gone already */ }

    if (DRY) {
      console.log('    would remove  ' + name + '  (' + (size / 1e6).toFixed(1) + ' MB)');
    } else {
      try {
        fs.unlinkSync(file);
        console.log('    removed  ' + name + '  (' + (size / 1e6).toFixed(1) + ' MB)');
        removed++;
        bytes += size;
      } catch (err) {
        /* A build still running, or a file open in Explorer. Worth saying,
           not worth failing the build over — the new artefact is already
           written and correct. */
        console.warn('    could not remove ' + name + ': ' + err.message);
      }
    }
  }
}

if (!DRY) {
  console.log('  ' + removed + ' old file(s) removed, '
    + (bytes / 1e6).toFixed(1) + ' MB reclaimed, ' + kept + ' kept\n');
} else {
  console.log('');
}
