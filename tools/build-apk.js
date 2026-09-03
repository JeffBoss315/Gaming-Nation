/* ============================================================
   One-command Android build.

     npm run android          -> debug APK in dist-apk/

   Finds a usable JDK, the Android SDK and Gradle, rebuilds www/,
   syncs it into the native project, then assembles the APK and
   copies it out with a versioned filename.

   Why it does not just call gradlew: the Gradle wrapper downloads
   its distribution with a 10s read timeout, which fails on slower
   links. If a Gradle install is found next to the SDK tools it is
   used directly; otherwise it falls back to gradlew.
   ============================================================ */
const fs = require('fs');
const path = require('path');
const os = require('os');
const { spawnSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const ANDROID = path.join(ROOT, 'android');
const TOOLS = path.join(process.env.LOCALAPPDATA || os.homedir(), 'hll-android-tools');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const isWin = process.platform === 'win32';
const exists = (p) => p && fs.existsSync(p);
const die = (msg, hint) => {
  console.error('\n  ' + msg);
  if (hint) console.error('  ' + hint);
  process.exit(1);
};

if (!exists(ANDROID)) die('No android/ project.', 'Run: npx cap add android');

/* ---------- JDK: Gradle 8.14 supports up to JDK 24 ---------- */
function javaMajor(home) {
  const bin = path.join(home, 'bin', isWin ? 'java.exe' : 'java');
  if (!exists(bin)) return null;
  const r = spawnSync(bin, ['-version'], { encoding: 'utf8' });
  const m = (r.stderr + r.stdout).match(/version "(\d+)/);
  return m ? Number(m[1]) : null;
}
let jdk = null;
const jdkCandidates = [];
const localJdkDir = path.join(TOOLS, 'jdk');
if (exists(localJdkDir)) {
  for (const d of fs.readdirSync(localJdkDir)) jdkCandidates.push(path.join(localJdkDir, d));
}
if (process.env.JAVA_HOME) jdkCandidates.push(process.env.JAVA_HOME);
for (const c of jdkCandidates) {
  const major = javaMajor(c);
  if (major && major >= 17 && major <= 24) { jdk = c; break; }
}
if (!jdk) {
  const found = jdkCandidates.map((c) => `${c} (Java ${javaMajor(c) || '?'})`).join('\n    ');
  die('No JDK between 17 and 24 found — Gradle 8.14 cannot run on newer ones.',
      'Checked:\n    ' + (found || 'nothing') +
      '\n  Install one, e.g. https://aka.ms/download-jdk/microsoft-jdk-21-windows-x64.zip');
}

/* ---------- Android SDK ---------- */
const sdkCandidates = [
  process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT,
  path.join(process.env.LOCALAPPDATA || os.homedir(), 'Android', 'Sdk'),
  path.join(os.homedir(), 'Android', 'Sdk'),
  path.join(os.homedir(), 'Library', 'Android', 'sdk'),
];
const sdk = sdkCandidates.find((p) => exists(p) && exists(path.join(p, 'platform-tools')));
if (!sdk) die('Android SDK not found.', 'Set ANDROID_HOME, or install the command-line tools.');

/* ---------- Gradle ---------- */
let gradleCmd = null;
const localGradle = path.join(TOOLS, 'gradle');
if (exists(localGradle)) {
  for (const d of fs.readdirSync(localGradle)) {
    const bin = path.join(localGradle, d, 'bin', isWin ? 'gradle.bat' : 'gradle');
    if (exists(bin)) { gradleCmd = bin; break; }
  }
}
if (!gradleCmd) gradleCmd = path.join(ANDROID, isWin ? 'gradlew.bat' : 'gradlew');

console.log('  JDK    ' + jdk + '  (Java ' + javaMajor(jdk) + ')');
console.log('  SDK    ' + sdk);
console.log('  Gradle ' + gradleCmd);

/* ---------- refresh the payload ---------- */
const node = process.execPath;
const run = (cmd, args, cwd, env) => {
  /* Only .bat/.cmd need a shell on Windows. Using one for everything would
     re-join argv into a string and break paths containing spaces, e.g.
     "C:\Program Files\nodejs\node.exe". */
  const needsShell = isWin && /\.(bat|cmd)$/i.test(cmd);
  const r = spawnSync(cmd, args, {
    cwd: cwd || ROOT,
    stdio: 'inherit',
    shell: needsShell,
    env: Object.assign({}, process.env, env || {}, { ELECTRON_RUN_AS_NODE: undefined }),
  });
  if (r.error) die('Could not run ' + cmd, r.error.message);
  if (r.status !== 0) die('Step failed: ' + cmd + ' ' + args.join(' '));
};

console.log('\n> building www/');
run(node, [path.join('tools', 'build-www.js')]);
/* Launcher icons are generated from hll.jpg by tools/make-brand-icons.ps1
   (npm run icons) and committed. Regenerating them here would overwrite the
   brand artwork with a placeholder. */
const launcher = path.join(ANDROID, 'app', 'src', 'main', 'res', 'mipmap-xxxhdpi', 'ic_launcher.png');
if (!exists(launcher)) {
  console.warn('\n  ! launcher icons missing — run: npm run icons');
}

console.log('\n> network config (LAN telemetry access)');
run(node, [path.join('tools', 'android-network.js')]);

/* copy web assets into the native project (cap sync also updates plugins) */
console.log('\n> syncing into the native project');
const capCli = path.join(ROOT, 'node_modules', '@capacitor', 'cli', 'bin', 'capacitor');
if (exists(capCli)) run(node, [capCli, 'sync', 'android']);
else console.log('  (capacitor cli missing, skipping sync)');

/* gradle needs to know where the SDK is */
fs.writeFileSync(path.join(ANDROID, 'local.properties'), 'sdk.dir=' + sdk.replace(/\\/g, '\\\\') + '\n');

console.log('\n> assembling APK');
run(gradleCmd, ['assembleDebug', '--no-daemon', '--console=plain'], ANDROID, {
  JAVA_HOME: jdk, ANDROID_HOME: sdk, ANDROID_SDK_ROOT: sdk,
});

/* ---------- collect the artifact ---------- */
const built = path.join(ANDROID, 'app', 'build', 'outputs', 'apk', 'debug', 'app-debug.apk');
if (!exists(built)) die('Build reported success but no APK was produced.');
const outDir = path.join(ROOT, 'dist-apk');
fs.mkdirSync(outDir, { recursive: true });
const outName = 'Heavyline-Trucker-' + pkg.version + '.apk';
const outPath = path.join(outDir, outName);
fs.copyFileSync(built, outPath);

const mb = (fs.statSync(outPath).size / 1024 / 1024).toFixed(1);
console.log('\n  APK ready: dist-apk/' + outName + '  (' + mb + ' MB)');
console.log('  Install: copy it to the phone and open it, or  adb install -r "' + outPath + '"');
