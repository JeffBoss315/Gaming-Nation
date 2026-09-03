/* ============================================================
   Stamp the Heavyline icon and version onto the packaged exe.

   electron-builder would normally do this itself, but its
   signAndEditExecutable step first unpacks a signing bundle that
   contains macOS symlinks, and creating those on Windows needs a
   privilege a normal account does not have — so the whole build
   fails. Turning that step off gets the build through and leaves
   the exe wearing Electron's default icon.

   rcedit is the same tool electron-builder would have used, so
   running it here gets the icon on without the signing bundle.
   ============================================================ */
const path = require('path');
const fs = require('fs');
const { execFileSync } = require('child_process');



/* Every file the pages ask for must be listed in build.files.

   map-data.js was referenced by both pages for several releases but never
   listed, so the packaged app shipped without it and the live map died with
   "mapFor is not defined". Nothing caught it, because the app builds and runs
   fine right up until you open that one screen.

   Checked against the source, before packing, so the build stops rather than
   shipping a hole. */
function verifyPackagedAssets(root) {
  const listed = (require(path.join(root, 'package.json')).build.files || [])
    .filter((f) => !f.startsWith('!'));

  const covered = (ref) => listed.some((entry) => {
    if (entry === ref) return true;
    const star = entry.indexOf('*');
    if (star === -1) return false;
    return ref.startsWith(entry.slice(0, star));
  });

  const pages = fs.readdirSync(root).filter((f) => f.endsWith('.html'));
  const missing = [];
  for (const page of pages) {
    if (!covered(page)) continue;                 /* a page that is not shipped */
    const html = fs.readFileSync(path.join(root, page), 'utf8');
    for (const raw of html.match(/(?:src|href)="([^"]+)"/g) || []) {
      const ref = raw.replace(/^(?:src|href)="/, '').replace(/"$/, '');
      if (/^(https?:)?\/\//.test(ref) || ref.startsWith('data:') || ref.startsWith('#')) continue;
      const clean = ref.split('#')[0].split('?')[0];
      if (!clean) continue;
      if (!fs.existsSync(path.join(root, clean))) missing.push(page + ' -> ' + clean + '  (no such file)');
      else if (!covered(clean)) missing.push(page + ' -> ' + clean + '  (not in build.files)');
    }
  }
  if (missing.length) {
    throw new Error('the app references files that will not be packaged:\n  '
      + missing.join('\n  ') + '\nAdd them to build.files in package.json.');
  }
  console.log('[hll] afterPack: every referenced file is packaged ('
    + pages.length + ' page(s) checked)');
}

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;

  /* the app is assembled by now, so this is the moment to check it is whole */
  verifyPackagedAssets(path.join(__dirname, '..'));

  const root = path.join(__dirname, '..');
  const rcedit = path.join(root, 'tools', 'bin', 'rcedit-x64.exe');
  const icon = path.join(root, 'icons', 'icon.ico');
  const exe = path.join(context.appOutDir, context.packager.appInfo.productFilename + '.exe');

  for (const [what, p] of [['rcedit', rcedit], ['icon', icon], ['exe', exe]]) {
    if (!fs.existsSync(p)) {
      console.warn('[hll] afterPack: no ' + what + ' at ' + p + ' — icon not applied');
      return;
    }
  }

  const v = context.packager.appInfo.version;
  execFileSync(rcedit, [exe,
    '--set-icon', icon,
    '--set-version-string', 'CompanyName', 'Heavyline Logistics',
    '--set-version-string', 'ProductName', 'Heavyline Trucker',
    '--set-version-string', 'FileDescription', 'Heavyline Trucker',
    '--set-version-string', 'LegalCopyright', 'Heavyline Logistics',
    '--set-file-version', v,
    '--set-product-version', v,
  ], { stdio: 'inherit', windowsHide: true });

  console.log('[hll] afterPack: Heavyline icon stamped onto ' + path.basename(exe));
};
