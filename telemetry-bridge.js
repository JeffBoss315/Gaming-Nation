/*
   HLL Telemetry Bridge launcher.

   The game plugin writes Protocol 6 frames to a named Windows mapping. The
   adapter owns that binary format; this launcher only manages its lifecycle
   and verifies the HTTP contract consumed by the app.

   Adapter contract:
     HLL_TELEMETRY_MAP       Local\\HLLTelemetry
     HLL_TELEMETRY_PORT      25555
     HLL_TELEMETRY_GAME      ets2
     HLL_TELEMETRY_PLUGIN    installed DLL path

   The adapter must serve GET /api/ets2/telemetry as the JSON shape documented
   by the existing connector and tracker.
*/
const http = require('http');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const args = process.argv.slice(2);
const flag = (name, fallback) => {
  const index = args.indexOf('--' + name);
  return index > -1 && args[index + 1] && !args[index + 1].startsWith('--')
    ? args[index + 1] : fallback;
};

const game = flag('game', 'ets2') === 'ats' ? 'ats' : 'ets2';
const port = Number(flag('port', process.env.HLL_TELEMETRY_PORT || 25555));
const map = flag('map', process.env.HLL_TELEMETRY_MAP || 'Local\\HLLTelemetry');
const adapter = flag('adapter', process.env.HLL_TELEMETRY_ADAPTER ||
  path.join(__dirname, 'hll-telemetry-adapter.exe'));
const plugin = flag('plugin', process.env.HLL_TELEMETRY_PLUGIN ||
  path.join(process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
    'Steam', 'steamapps', 'common', 'Euro Truck Simulator 2',
    'bin', 'win_x64', 'plugins', 'hll-scs-telemetry.dll'));
const metadata = flag('metadata', process.env.HLL_TELEMETRY_METADATA ||
  path.join(path.dirname(plugin), 'hll-telemetry.json'));
const timeoutMs = Number(flag('timeout', 15000));
const endpoint = 'http://127.0.0.1:' + port + '/api/' + game + '/telemetry';

function fail(message) {
  console.error('HLL telemetry bridge: ' + message);
  process.exitCode = 1;
}

function endpointReady() {
  return new Promise((resolve) => {
    const req = http.get(endpoint, { timeout: 1000 }, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.on('timeout', () => { req.destroy(); resolve(false); });
  });
}

if (process.platform !== 'win32') {
  fail('the shared-memory adapter is supported on Windows only');
} else if (!fs.existsSync(adapter)) {
  fail('adapter executable not found: ' + adapter +
    '\nSet HLL_TELEMETRY_ADAPTER or pass --adapter <path>.');
} else if (!fs.existsSync(plugin)) {
  fail('telemetry plugin not found: ' + plugin +
    '\nPass --plugin <path> if ETS2 is installed elsewhere.');
} else if (!fs.existsSync(metadata)) {
  fail('telemetry metadata not found: ' + metadata +
    '\nPass --metadata <path> if it is stored elsewhere.');
} else if (!Number.isInteger(port) || port < 1 || port > 65535) {
  fail('invalid HTTP port: ' + port);
} else {
  let contract;
  try { contract = JSON.parse(fs.readFileSync(metadata, 'utf8')); } catch (error) {
    fail('telemetry metadata is not valid JSON: ' + error.message);
  }
  if (!contract || contract.dll !== path.basename(plugin) || contract.protocol !== 6 ||
      contract.map !== map) {
    fail('telemetry metadata does not match the HLL Protocol 6 bridge contract' +
      '\nExpected DLL: ' + path.basename(plugin) + ', protocol: 6, map: ' + map);
  } else {
  endpointReady().then((alreadyReady) => {
    if (alreadyReady) {
      console.log('HLL telemetry bridge already ready: ' + endpoint);
      return;
    }
  const child = spawn(adapter, [], {
    cwd: path.dirname(adapter),
    windowsHide: true,
    stdio: 'inherit',
    env: Object.assign({}, process.env, {
      HLL_TELEMETRY_MAP: map,
      HLL_TELEMETRY_PORT: String(port),
      HLL_TELEMETRY_GAME: game,
      HLL_TELEMETRY_PLUGIN: plugin,
    }),
  });
  let ready = false;
  const started = Date.now();
  const check = () => {
    const req = http.get(endpoint, { timeout: 1000 }, (res) => {
      res.resume();
      if (res.statusCode === 200 && !ready) {
        ready = true;
        console.log('HLL telemetry bridge ready: ' + endpoint);
      }
    });
    req.on('error', () => {});
    req.on('timeout', () => req.destroy());
  };
  const timer = setInterval(() => {
    if (Date.now() - started >= timeoutMs && !ready) {
      clearInterval(timer);
      child.kill();
      fail('adapter did not serve ' + endpoint + ' within ' + timeoutMs + 'ms');
    } else if (!ready) check();
  }, 250);
  child.on('exit', (code, signal) => {
    clearInterval(timer);
    if (!ready && process.exitCode !== 1) fail('adapter exited before becoming ready (' +
      (signal || 'code ' + code) + ')');
  });
  const shutdown = () => { clearInterval(timer); child.kill(); };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  });
  }
}