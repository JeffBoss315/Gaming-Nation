/* ============================================================
   Smoke test — connecting a device to the company service.

     npm run smoke:svcauth

   A driver signs in to the app against Supabase. The service keeps
   its own session, and used to get one only through
   /api/auth/login, which compares a password against a hash in the
   company record it holds.

   That hash stopped being the driver's password when accounts moved
   to Supabase. So "Connect this device" asked for a password and
   then refused the only one the driver had — and no amount of
   typing could get past it, because the thing being compared
   against was not their password any more.

   /api/auth/supabase takes the session the client is already
   holding, asks Supabase whose it is, and issues a service session
   for that person. What has to be true:

     1. A forged or absent token gets nothing. The verification is
        upstream, at Supabase, and this service trusts nothing in
        the body.

     2. The driver code comes from the DATABASE, not from the
        caller. A client that could name its own driver code could
        name somebody else's and read their messages.

     3. It works when the service's own copy of the company is out
        of date — which is the ordinary case, and was the reported
        one: the blob knew HLL-1002 and the driver signing in was
        GMN002.

     4. The old password path still answers, because a client older
        than this build still uses it.

   Supabase is stood in for by a local server, so a run needs no
   project and touches nothing real.
   ============================================================ */
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');

const ROOT = path.join(__dirname, '..');
const PORT = Number(process.env.GMN_SMOKE_PORT || 7093);
const SUPA_PORT = PORT + 1;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'gmn-svcauth-'));

const UID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';
const GOOD = 'a-real-looking-access-token';

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

let failures = 0;
const say = (s) => process.stdout.write(s + '\n');
function check(what, ok, detail) {
  if (!ok) failures++;
  say('  ' + (ok ? '✓' : '✗') + '  ' + what + (detail ? ('   ' + detail) : ''));
}

/* ---- the stand-in for the Supabase project ---- */
const supa = http.createServer((req, res) => {
  const token = String(req.headers.authorization || '').replace(/^Bearer /, '');
  const url = new URL(req.url, 'http://x');

  /* Exactly what Supabase does with a token it did not issue. This is
     what makes the forged-token check meaningful rather than decorative. */
  if (token !== GOOD) {
    res.writeHead(401, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ msg: 'invalid claim' }));
  }

  if (url.pathname === '/auth/v1/user') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ id: UID, email: 'driver@example.com' }));
  }

  if (url.pathname === '/rest/v1/drivers') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify([{
      driver_code: 'GMN002', full_name: 'Boss Jeff',
      email: 'driver@example.com', role: 'driver', status: 'active',
    }]));
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end('{}');
});

function call(method, p, body, headers) {
  return new Promise((resolve) => {
    const data = body == null ? null : JSON.stringify(body);
    const h = Object.assign({}, headers || {});
    if (data) {
      h['Content-Type'] = 'application/json';
      h['Content-Length'] = Buffer.byteLength(data);
    }
    const req = http.request({ port: PORT, path: p, method, headers: h }, (r) => {
      let raw = '';
      r.on('data', (d) => { raw += d; });
      r.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(raw); } catch (e) { /* not json */ }
        resolve({ status: r.statusCode, body: parsed, raw });
      });
    });
    req.on('error', (e) => resolve({ status: 0, raw: e.message }));
    if (data) req.write(data);
    req.end();
  });
}

(async () => {
  supa.listen(SUPA_PORT);

  /* A company record that has NOT caught up: it knows an older code for
     this person and nothing about GMN002. This is the reported case. */
  fs.writeFileSync(path.join(TMP, 'company.json'), JSON.stringify({
    version: 1, at: Date.now(),
    data: {
      drivers: [{ id: 'HLL-1002', name: 'Boss Jeff', role: 'driver' }],
      accounts: [],
    },
  }));

  const server = spawn(process.execPath,
    [path.join(ROOT, 'fleet-server.js'), '--port', String(PORT)], {
      env: Object.assign({}, process.env, {
        GMN_COMPANY_FILE: path.join(TMP, 'company.json'),
        GMN_SESSION_FILE: path.join(TMP, 'sessions.json'),
        GMN_CHAT_FILE: path.join(TMP, 'chat.json'),
        GMN_DM_FILE: path.join(TMP, 'dms.json'),
        GMN_FILES_FILE: path.join(TMP, 'files.json'),
        GMN_FILES_DIR: path.join(TMP, 'files'),
        GMN_SUPABASE_URL: 'http://127.0.0.1:' + SUPA_PORT,
        GMN_SUPABASE_KEY: 'test-key',
      }),
      stdio: 'ignore',
    });

  await wait(1500);

  say('\nconnecting a device with the session it already has\n');

  const forged = await call('POST', '/api/auth/supabase', { access_token: 'forged' });
  check('a forged session is refused', forged.status === 401, 'HTTP ' + forged.status);

  const empty = await call('POST', '/api/auth/supabase', {});
  check('no session at all is refused', empty.status === 400, 'HTTP ' + empty.status);

  const ok = await call('POST', '/api/auth/supabase', { access_token: GOOD });
  check('a real session is accepted', ok.status === 200, 'HTTP ' + ok.status);
  check('and a service token comes back', !!(ok.body && ok.body.token));

  /* The one that matters. A client that named its own driver code could
     name anybody's, and read their conversations. */
  check('the driver code comes from the database, not the caller',
    !!(ok.body && ok.body.driver && ok.body.driver.id === 'GMN002'),
    (ok.body && ok.body.driver && ok.body.driver.id) || '(none)');

  const token = (ok.body || {}).token;

  const me = await call('GET', '/api/auth/me', null, { Authorization: 'Bearer ' + token });
  check('the token is a real identity', me.status === 200, 'HTTP ' + me.status);
  check('and it names the same driver', !!(me.body && me.body.id === 'GMN002'),
    (me.body && me.body.id) || '(none)');

  const threads = await call('GET', '/api/dm/threads', null,
    { Authorization: 'Bearer ' + token });
  check('messages are reachable with it', threads.status === 200, 'HTTP ' + threads.status);

  /* It worked against a company record that has never heard of GMN002 —
     which is the whole point, and the state the report came from. */
  const held = JSON.parse(fs.readFileSync(path.join(TMP, 'company.json'), 'utf8'));
  check('none of that needed the company record to be up to date',
    !(held.data.drivers || []).some((d) => d.id === 'GMN002'));

  /* A client older than this build still signs in by password. */
  const pw = await call('POST', '/api/auth/login',
    { email: 'nobody@example.com', password: 'x' });
  check('the password path still answers', pw.status === 401, 'HTTP ' + pw.status);

  server.kill();
  supa.close();

  say(failures ? '\n' + failures + ' failure(s)\n' : '\nall passed\n');
  process.exit(failures ? 1 : 0);
})();
