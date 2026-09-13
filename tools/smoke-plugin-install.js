/* ============================================================
   Smoke test — the game gets its telemetry plugin, on any machine.

     npm run smoke:plugin

   The game reports nothing to anybody until an SCS telemetry DLL is
   in its own plugins folder. For most of this app's life nothing put
   one there: it was not shipped, not installed, not even checked for,
   and the client just told the driver to go and find one. A real
   delivery ran its whole length undetected because of it.

   So this stands up fake game trees in a temp folder and checks the
   four situations a driver's machine can actually be in:

     nothing anywhere      the bundled copy has to be installed
     one game has it       the other game gets it copied across
     already installed     nothing is touched, nothing reinstalled
     32-bit in win_x86     refused, and named as the reason

   Nothing real is touched. The last one matters most: a 32-bit DLL in
   the 32-bit folder beside a 64-bit game is the commonest way to have
   "installed the plugin" and have nothing happen, and it is what was
   found on the machine this was written for.
   ============================================================ */
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const P = require(path.join(ROOT, 'telemetry-plugin.js'));

const steps = [];
let problems = 0;
const check = (name, ok, detail) => {
  steps.push((ok ? '  ' : '! ') + name.padEnd(46) + (detail === undefined ? '' : detail));
  if (!ok) problems++;
};

const BUNDLED = path.join(ROOT, 'game-plugin', 'telemetry_tb_64.dll');
const THIRTY_TWO = 'C:/Program Files (x86)/Steam/steamapps/common/'
  + 'Euro Truck Simulator 2/bin/win_x86/plugins/telemetry_tb_32.dll';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gmn-plugin-'));
const game = (name) => {
  const root = path.join(tmp, name + '-' + Math.random().toString(36).slice(2, 8));
  fs.mkdirSync(path.join(root, 'bin', 'win_x64', 'plugins'), { recursive: true });
  fs.mkdirSync(path.join(root, 'bin', 'win_x86', 'plugins'), { recursive: true });
  return root;
};
const installedIn = (root) => {
  const dll = path.join(P.pluginDir(root), 'telemetry_tb_64.dll');
  return fs.existsSync(dll) && P.inspect(dll).ok;
};

try {
  /* ---- the bundled copy is the whole basis of "any machine" ---- */
  const have = fs.existsSync(BUNDLED);
  check('a plugin is bundled with the app', have, have ? path.basename(BUNDLED) : 'MISSING');
  if (have) {
    const seen = P.inspect(BUNDLED);
    check('and it is a real 64-bit SCS plugin', seen.ok, seen.ok ? seen.mapName : seen.reason);
    check('and it names the memory it writes', !!seen.mapName, seen.mapName || 'NONE');
  }

  /* ---- a brand new machine ---- */
  const a1 = game('ets2'); const a2 = game('ats');
  let r = P.ensure([{ game: 'ets2', root: a1 }, { game: 'ats', root: a2 }], null);
  check('a bare machine gets one installed', r.installed.length === 2,
    r.installed.length + ' of 2 games');
  check('and both really work afterwards', installedIn(a1) && installedIn(a2));
  check('and the adapter is told what to look for', r.mapNames.length > 0,
    r.mapNames.join(', ') || 'NOTHING');

  /* ---- run it twice; it must not churn ---- */
  r = P.ensure([{ game: 'ets2', root: a1 }, { game: 'ats', root: a2 }], null);
  check('a second run installs nothing again', r.installed.length === 0,
    r.installed.length + ' installed');
  check('and reports both as already done', r.already.length === 2);

  /* ---- one game has it, the other does not ---- */
  const b1 = game('ets2'); const b2 = game('ats');
  fs.copyFileSync(BUNDLED, path.join(P.pluginDir(b2), 'telemetry_tb_64.dll'));
  r = P.ensure([{ game: 'ets2', root: b1 }, { game: 'ats', root: b2 }], null);
  check('a game missing it is filled from the other', installedIn(b1));

  /* ---- the mistake that started all this ---- */
  const c1 = game('ets2');
  if (fs.existsSync(THIRTY_TWO)) {
    fs.copyFileSync(THIRTY_TWO, path.join(c1, 'bin', 'win_x86', 'plugins', 'telemetry_tb_32.dll'));
    const seen = P.inspect(path.join(c1, 'bin', 'win_x86', 'plugins', 'telemetry_tb_32.dll'));
    check('a 32-bit plugin is refused', !seen.ok, seen.reason || 'ACCEPTED IT');
    check('and the refusal says why', /32-bit/.test(seen.reason || ''), seen.reason);
  } else {
    check('a 32-bit plugin is refused', true, 'skipped - no 32-bit build on this machine');
  }

  /* it is still fixed for them, because a good copy is bundled */
  r = P.ensure([{ game: 'ets2', root: c1 }], null);
  check('and the right one is installed anyway', installedIn(c1));

  /* ---- the packaged layout, resources/plugin ---- */
  const res = path.join(tmp, 'resources');
  fs.mkdirSync(path.join(res, 'plugin'), { recursive: true });
  fs.copyFileSync(BUNDLED, path.join(res, 'plugin', 'telemetry_tb_64.dll'));
  const d1 = game('ets2');
  r = P.ensure([{ game: 'ets2', root: d1 }], res);
  check('an installed build finds its own copy', installedIn(d1), 'resources/plugin');

  /* ---- a folder it cannot write to ---- */
  const e1 = game('ets2');
  fs.rmSync(P.pluginDir(e1), { recursive: true, force: true });
  fs.writeFileSync(P.pluginDir(e1), 'not a directory');   /* forces the copy to fail */
  r = P.ensure([{ game: 'ets2', root: e1 }], null);
  check('a folder it cannot write to is reported', r.problems.length === 1,
    r.problems.length ? r.problems[0].reason.slice(0, 44) : 'SILENT');
} finally {
  fs.rmSync(tmp, { recursive: true, force: true });
}

console.log('\nthe game gets its telemetry plugin\n' + steps.join('\n'));
console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
process.exit(problems ? 1 : 0);
