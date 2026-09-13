/* ============================================================
   Launch Electron properly, whatever the shell has done to the
   environment.

     node tools/run-electron.js tools/smoke-errors.js .

   TWO THINGS THIS FIXES, both of which made "npm test" impossible
   on this machine.

   1. The scripts used to name the binary directly:

        node_modules/electron/dist/electron.exe tools/smoke-errors.js .

      npm runs scripts through cmd.exe on Windows, and cmd cannot run
      a forward-slash relative path. Every one of them failed with
      "'node_modules' is not recognized" — nine scripts, including
      every browser smoke test.

   2. ELECTRON_RUN_AS_NODE is set in this environment. When it is,
      the Electron binary starts as plain Node: no app, no
      BrowserWindow, and every harness dies on

        TypeError: Cannot read properties of undefined (reading 'setPath')

      which reads like a broken test and is really a stray variable.
      A process cannot unset it for itself once it has started as
      node, so the only cure is to launch a child without it.

   Hence this launcher: plain Node, no dependencies, resolves the
   binary through require('electron') — which returns its path — and
   spawns it with a clean environment.
   ============================================================ */
const { spawn } = require('child_process');

/* Required from Node (not from inside Electron), the electron package
   exports the path to its executable. That resolves correctly on every
   platform and through any directory with spaces in it, which this one
   has: "VS CODE". */
let binary;
try {
  binary = require('electron');
} catch (e) {
  console.error('Electron is not installed. Run: npm install');
  process.exit(1);
}

if (typeof binary !== 'string') {
  console.error('Could not resolve the Electron binary — got ' + typeof binary + '.');
  console.error('This usually means tools/run-electron.js was itself run BY Electron.');
  process.exit(1);
}

const env = Object.assign({}, process.env);

/* The whole point. Left set, the binary below is just Node. */
delete env.ELECTRON_RUN_AS_NODE;

const args = process.argv.slice(2);
if (!args.length) {
  console.error('usage: node tools/run-electron.js <script> [args...]');
  process.exit(1);
}

const child = spawn(binary, args, { stdio: 'inherit', env });

child.on('error', (err) => {
  console.error('Could not start Electron: ' + err.message);
  process.exit(1);
});

/* Pass the child's fate through, so npm and CI see a real result.
   A signal is not an exit code; report it as one rather than as 0,
   which would turn a killed test run into a passing one. */
child.on('exit', (code, signal) => {
  if (signal) process.exit(1);
  process.exit(code === null ? 1 : code);
});
