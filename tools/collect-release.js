/* Gather the built installers into release/ under the names the site uses.

     node tools/collect-release.js            copy what is there
     node tools/collect-release.js --dry-run  say what would happen

   There are two naming schemes in this project and they are not the same:

     electron-builder writes   Gaming Nation Trucker 1.0.0 x64.exe     (spaces)
     the site asks for         Gaming-Nation-Trucker-1.0.0-windows-setup.exe

   Nothing joined them up, so release/ was filled in by hand after every
   build — which is why it still held 4.7.0 files long after 1.0.0 shipped,
   and why the names in script.js, functions/_lib.js and tools/push-release.js
   had to be trusted rather than checked.

   This is that missing step. It reads the wanted names out of script.js —
   the downloads page is the thing that has to be right — finds whatever
   the builders actually produced, and copies it across.

   It also reports the real sizes, because tools/scan.js fails the build
   when the size on the downloads page disagrees with the file.
*/
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const RELEASE = path.join(ROOT, 'release');

/* Where electron-builder put things.

   Overridable because this project lives inside a OneDrive folder, and
   OneDrive holds files open while it syncs them: a rebuild fails with

     remove dist/win-unpacked/resources/app.asar:
     the process cannot access the file because it is being used by
     another process

   and no process owns it, because the holder is the sync client rather
   than anything with the file loaded. Building to somewhere outside the
   synced tree sidesteps it entirely:

     npx electron-builder --win --config.directories.output=<somewhere outside OneDrive>
     HLL_DIST_DIR=<that same path> node tools/collect-release.js */
const DIST = path.resolve(process.env.HLL_DIST_DIR || path.join(ROOT, 'dist'));
const DIST_APK = path.resolve(process.env.HLL_DIST_APK_DIR || path.join(ROOT, 'dist-apk'));
const DRY = process.argv.includes('--dry-run');
/* A build that produced only the Windows installers is a normal state —
   the APK needs an Android SDK, and most machines building the desktop app
   do not have one. So a missing build is a warning here, and an error only
   when somebody is preparing an actual release and says so. */
const STRICT = process.argv.includes('--strict');

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const VERSION = String(pkg.version || '').trim();

/* What the downloads page asks for, in the order it lists them. */
const script = fs.readFileSync(path.join(ROOT, 'script.js'), 'utf8');
const block = script.slice(script.indexOf('const CLIENT_RELEASE'));
const wanted = [...block.slice(0, block.indexOf('};')).matchAll(
  /key:\s*'([^']+)'[\s\S]*?file:\s*'release\/([^']+)'/g)]
  .map((m) => ({ key: m[1], name: m[2] }));

if (!wanted.length) {
  console.log('Could not read the build list out of script.js.');
  process.exit(1);
}

/* Where each one comes from. A build is found by pattern rather than by an
   exact name: electron-builder's artifactName is configurable and has been
   changed before, and a collector that breaks silently when it is changed
   again is worse than one that says it cannot find anything. */
const SOURCES = {
  'win-setup': {
    dir: DIST,
    /* the NSIS installer — "Gaming Nation Trucker 1.0.0 x64.exe" */
    match: (f) => /\.exe$/i.test(f) && !/portable/i.test(f) && f.includes(VERSION),
  },
  'win-portable': {
    dir: DIST,
    match: (f) => /\.exe$/i.test(f) && /portable/i.test(f) && f.includes(VERSION),
  },
  android: {
    dir: DIST_APK,
    match: (f) => /\.apk$/i.test(f) && f.includes(VERSION),
  },
};

/* Copying an 80 MB file into a OneDrive folder loses a race with the sync
   client often enough to matter: it opens the destination to upload it and
   the copy comes back EBUSY, or occasionally EPERM. Nothing is wrong with
   either file — the lock is held for a moment and then released.

   So: write beside the target and rename over it, which is atomic and
   touches the destination for the shortest possible time, and retry a few
   times if even that loses. Failing a release build over a sync client
   holding a handle for half a second is not a real failure. */
function copyInto(from, to) {
  const tmp = to + '.part';
  const waits = [0, 400, 1200, 3000, 6000];

  for (let i = 0; i < waits.length; i++) {
    if (waits[i]) {
      const until = Date.now() + waits[i];
      while (Date.now() < until) { /* deliberately synchronous */ }
    }

    try {
      fs.copyFileSync(from, tmp);
      fs.renameSync(tmp, to);
      return i;                      /* how many attempts it took */
    } catch (e) {
      try { fs.unlinkSync(tmp); } catch (x) { /* may not exist */ }

      const transient = e.code === 'EBUSY' || e.code === 'EPERM' || e.code === 'EACCES';
      if (!transient || i === waits.length - 1) throw e;
    }
  }

  return -1;
}

const found = [];
const missing = [];

for (const item of wanted) {
  const src = SOURCES[item.key];

  if (!src) { missing.push({ ...item, why: 'no source rule for "' + item.key + '"' }); continue; }
  if (!fs.existsSync(src.dir)) { missing.push({ ...item, why: path.basename(src.dir) + '/ is not there' }); continue; }

  const hit = fs.readdirSync(src.dir).filter(src.match)
    /* newest first, so a rebuilt file wins over one left from earlier */
    .sort((a, b) => fs.statSync(path.join(src.dir, b)).mtimeMs
                  - fs.statSync(path.join(src.dir, a)).mtimeMs)[0];

  if (!hit) { missing.push({ ...item, why: 'nothing matching in ' + path.basename(src.dir) + '/' }); continue; }

  found.push({ ...item, from: path.join(src.dir, hit), fromName: hit });
}

console.log('\ncollect  (version ' + VERSION + (DRY ? ', dry run' : '') + ')');

if (!DRY) fs.mkdirSync(RELEASE, { recursive: true });

for (const f of found) {
  const to = path.join(RELEASE, f.name);
  const mb = (fs.statSync(f.from).size / 1e6).toFixed(1);

  console.log('  ' + f.fromName);

  if (DRY) {
    console.log('    -> release/' + f.name + '   ' + mb + ' MB');
    continue;
  }

  const tries = copyInto(f.from, to);
  console.log('    -> release/' + f.name + '   ' + mb + ' MB'
    + (tries > 0 ? '   (took ' + (tries + 1) + ' attempts — the folder is synced)' : ''));
}

for (const m of missing) {
  console.log('  ✗ ' + m.name);
  console.log('    ' + m.why);
}

/* The sizes the downloads page claims, against the files now in place.
   scan.js fails the build on a mismatch, so say it here where the fix is
   obvious rather than three steps later where it is not. */
if (!DRY && found.length) {
  console.log('\nsizes on the downloads page');

  let wrong = 0;

  for (const f of found) {
    const claimed = (block.match(
      new RegExp("file:\\s*'release/" + f.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        + "'[\\s\\S]*?size:\\s*'([\\d.]+) MB'")) || [])[1];

    const actual = (fs.statSync(path.join(RELEASE, f.name)).size / 1e6).toFixed(1);

    if (claimed === actual) {
      console.log('  ' + f.name.padEnd(46) + actual + ' MB  ok');
    } else {
      wrong += 1;
      console.log('  ' + f.name.padEnd(46) + actual + ' MB  (page says ' + claimed + ')');
    }
  }

  if (wrong) {
    console.log('\n' + wrong + ' size(s) disagree with script.js. Update CLIENT_RELEASE');
    console.log('or npm run scan will fail the next build.');
  }
}

if (missing.length) {
  console.log('\n' + missing.length + ' build(s) missing. Run npm run dist and npm run android.');
  if (STRICT) process.exit(1);
  console.log('(not fatal — pass --strict when preparing a release)');
}

console.log('\nrelease/ holds the ' + found.length + ' build(s) the downloads page names.\n');
