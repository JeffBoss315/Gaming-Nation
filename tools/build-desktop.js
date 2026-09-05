/* Run electron-builder, somewhere the sync client will leave alone.

     node tools/build-desktop.js              Windows, the default targets
     node tools/build-desktop.js --linux AppImage
     node tools/build-desktop.js --mac

   Everything after the script name is passed through to electron-builder,
   so this is a thin wrapper and not a second build system. What it adds is
   one flag:

     --config.directories.output=<tools/dist-out.js>

   which keeps the build out of the project folder. tools/dist-out.js says
   why at length; the short version is that OneDrive holds the output files
   open, the next build cannot replace them, and the stale tree left behind
   is indistinguishable from the current app until somebody launches it and
   reports bugs that were fixed days ago.

   The finished artefacts do not stay in the temp directory: the dist
   scripts run tools/collect-release.js straight afterwards, which copies
   them into release/ under the names the downloads page asks for, and
   checks the sizes match what that page claims.
*/
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* Read it from the one place that decides, rather than working it out
   again here and having the two disagree. */
const OUT = spawnSync(process.execPath, [path.join(__dirname, 'dist-out.js')], {
  encoding: 'utf8',
  env: process.env,
}).stdout.trim();

if (!OUT) {
  console.error('\n  tools/dist-out.js printed nothing — cannot pick an output directory.\n');
  process.exit(1);
}

/* A previous build's tree, if it can be removed. It usually can here,
   because this path is outside the synced folder — and if it cannot, say
   so rather than letting electron-builder fail three minutes later with a
   stack trace about app-builder.exe. */
let out = OUT;

if (fs.existsSync(out)) {
  try {
    fs.rmSync(out, { recursive: true, force: true });
  } catch (e) {
    /* Something has a handle in there and will not let go — an installed
       copy of the app running, an indexer, a scanner mid-pass. This build
       stopped dead on exactly that:

         Could not clear ...\hll-dist
         EPERM, Permission denied

       with four copies of the installed Gaming Nation Trucker running out of
       Program Files. Neither killing somebody's running application nor
       refusing to build is the right answer. The directory is disposable
       by design, so a locked one is stepped over and the build carries on
       in a fresh sibling. collect-release.js copies the artefacts into
       release/ straight afterwards, so nothing downstream cares which
       directory was used. */
    out = OUT + '-' + Date.now().toString(36);
    console.log('\n  ' + OUT + ' is locked (' + e.code + ').');
    console.log('  Building into ' + out + ' instead.');
    console.log('  Nothing is wrong; the old one can be deleted once it is free.\n');
  }
}

/* Default to Windows so `npm run dist` means what it always did. */
const passed = process.argv.slice(2);
const targets = passed.length ? passed : ['--win'];

const args = ['--yes', 'electron-builder']
  .concat(targets)
  .concat(['--publish', 'never', '--config.directories.output=' + out]);

console.log('\nbuilding into ' + out);
console.log('(outside the project, so the sync client cannot lock it)\n');

const r = spawnSync('npx', args, {
  cwd: ROOT,
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: process.env,
});

if (r.error) {
  console.error('\n  Could not run electron-builder: ' + r.error.message + '\n');
  process.exit(1);
}

if (r.status !== 0) process.exit(r.status);

/* collect-release.js is next in the npm script, and it needs to be told
   where to look. Passing it through the environment keeps the npm script
   readable and means nobody has to repeat the path. */
console.log('\nbuilt. Collecting from ' + out);
process.env.GMN_DIST_DIR = out;

const collected = spawnSync(process.execPath,
  [path.join(__dirname, 'collect-release.js')],
  { cwd: ROOT, stdio: 'inherit', env: Object.assign({}, process.env, { GMN_DIST_DIR: out }) });

process.exit(collected.status || 0);
