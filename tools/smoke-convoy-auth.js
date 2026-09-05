/* ============================================================
   Smoke test — convoy identity, permissions and persistent chat.

     node tools/smoke-convoy-auth.js

   The two things that were wrong: chat did not survive a restart,
   and the identity on a message was whatever the client claimed.

   So this signs two real accounts in against the service, checks
   the service decides who they are rather than believing them,
   checks who is allowed to read and write which convoy, then
   kills the service and starts it again to prove the conversation
   is still there.

   The service runs as a child process precisely so it can be
   killed — an in-process server could not prove persistence.
   ============================================================ */
const http = require('http');
const os = require('os');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const { spawn } = require('child_process');

const PORT = Number((process.env.GMN_SMOKE_PORT || process.env.HLL_SMOKE_PORT) || 7092);
const COMPANY_FILE = path.join(os.tmpdir(), 'gmn-auth-company.json');
const SESSION_FILE = path.join(os.tmpdir(), 'gmn-auth-sessions.json');
const CHAT_FILE = path.join(os.tmpdir(), 'hll-auth-chat.jsonl');
const ROOT = path.join(__dirname, '..');

[COMPANY_FILE, SESSION_FILE, CHAT_FILE].forEach((f) => {
  try { fs.unlinkSync(f); } catch (e) {}
});

let failures = 0;
const say = console.log;
const check = (name, ok, detail) => {
  say((ok ? '  ✓  ' : '  ✗  ') + name + (detail ? ': ' + detail : ''));
  if (!ok) failures++;
};
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* the same digest the browser and the service both use */
const sha = (pw, salt) => crypto.createHash('sha256').update(salt + '::' + pw, 'utf8').digest('hex');

const req = (method, p, body, token) => new Promise((done) => {
  const payload = body ? JSON.stringify(body) : null;
  const headers = {};
  if (payload) {
    headers['Content-Type'] = 'application/json';
    headers['Content-Length'] = Buffer.byteLength(payload);
  }
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = http.request({ port: PORT, path: p, method, headers }, (res) => {
    let raw = ''; res.setEncoding('utf8');
    res.on('data', (c) => { raw += c; });
    res.on('end', () => {
      let parsed = null;
      try { parsed = JSON.parse(raw); } catch (e) {}
      done({ status: res.statusCode, body: parsed });
    });
  });
  r.on('error', () => done({ status: 0, body: null }));
  r.end(payload);
});

function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, 'fleet-server.js'), '--port', String(PORT)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1',
      GMN_COMPANY_FILE: COMPANY_FILE,
      GMN_SESSION_FILE: SESSION_FILE,
      GMN_CHAT_FILE: CHAT_FILE,
    }),
    stdio: 'ignore',
  });
  return child;
}

/* two accounts and a convoy, written the way the platform writes them */
const SALT_A = 'a1b2c3d4e5f60718293a4b5c6d7e8f90';
const SALT_B = '0f9e8d7c6b5a49382716f5e4d3c2b1a0';
const PW_A = 'LeaderPass#1';
const PW_B = 'DriverPass#2';

const COMPANY = {
  drivers: [
    { id: 'HLL-1001', name: 'Convoy Leader', role: 'event_manager', accountStatus: 'active',
      km: 0, deliveries: 0, earned: 0 },
    { id: 'HLL-2002', name: 'Ordinary Driver', role: 'driver', accountStatus: 'active',
      km: 0, deliveries: 0, earned: 0 },
    { id: 'HLL-3003', name: 'Outside Driver', role: 'driver', accountStatus: 'active',
      km: 0, deliveries: 0, earned: 0 },
  ],
  accounts: [
    { driverId: 'HLL-1001', email: 'leader@example.com', salt: SALT_A, hash: sha(PW_A, SALT_A) },
    { driverId: 'HLL-2002', email: 'driver@example.com', salt: SALT_B, hash: sha(PW_B, SALT_B) },
    { driverId: 'HLL-3003', email: 'outside@example.com', salt: SALT_B, hash: sha(PW_B, SALT_B) },
  ],
  events: [
    { id: 'EV-7001', name: 'Auth Convoy', status: 'live', leaderId: 'HLL-1001',
      date: new Date().toISOString(), distance: 300, maxSlots: 10,
      path: ['Rotterdam', 'Hamburg'], registered: [
        { driverId: 'HLL-1001', state: 'confirmed', leader: true },
        { driverId: 'HLL-2002', state: 'confirmed' },
      ], activity: [] },
  ],
  jobs: [],
};

(async () => {
  let server = startServer();
  await wait(1400);
  say('\nConvoy identity, permissions and persistent chat\n');

  await req('PUT', '/api/company', { version: 0, data: COMPANY });

  /* ---------- 1. signing in ---------- */
  const badPw = await req('POST', '/api/auth/login',
    { email: 'leader@example.com', password: 'not-the-password' });
  check('a wrong password is refused', badPw.status === 401, 'HTTP ' + badPw.status);

  const noSuch = await req('POST', '/api/auth/login',
    { email: 'nobody@example.com', password: PW_A });
  check('an unknown account is refused the same way',
    noSuch.status === 401 && noSuch.body && noSuch.body.error === badPw.body.error,
    'indistinguishable from a wrong password');

  const leader = await req('POST', '/api/auth/login',
    { email: 'leader@example.com', password: PW_A });
  check('a real account signs in', leader.status === 200 && !!leader.body.token,
    leader.body && leader.body.driver ? leader.body.driver.name : 'NO TOKEN');
  check('and the service says what role it decided',
    leader.body && leader.body.driver && leader.body.driver.role === 'event_manager',
    leader.body && leader.body.driver ? leader.body.driver.role : '-');
  const TOKEN_LEADER = leader.body.token;

  const driver = await req('POST', '/api/auth/login',
    { email: 'driver@example.com', password: PW_B });
  const TOKEN_DRIVER = driver.body.token;
  const outside = await req('POST', '/api/auth/login',
    { email: 'outside@example.com', password: PW_B });
  const TOKEN_OUTSIDE = outside.body.token;
  check('every account gets its own token',
    TOKEN_LEADER !== TOKEN_DRIVER && TOKEN_DRIVER !== TOKEN_OUTSIDE
      && TOKEN_LEADER.length === 64,
    'three distinct 32-byte tokens');

  const me = await req('GET', '/api/auth/me', null, TOKEN_DRIVER);
  check('a token identifies its holder',
    me.status === 200 && me.body.id === 'HLL-2002', me.body ? me.body.id : '-');

  /* ---------- 2. identity cannot be claimed ---------- */
  const noToken = await req('POST', '/api/convoy/message',
    { convoyId: 'EV-7001', text: 'no token here' });
  check('a message with no token is refused', noToken.status === 401, 'HTTP ' + noToken.status);

  const spoof = await req('POST', '/api/convoy/message', {
    convoyId: 'EV-7001', text: 'I am the leader',
    driverId: 'HLL-1001', driver: 'Convoy Leader', role: 'staff',
  }, TOKEN_DRIVER);
  check('a driver may speak', spoof.status === 200, 'HTTP ' + spoof.status);

  const afterSpoof = await req('GET', '/api/convoy/EV-7001/chat', null, TOKEN_DRIVER);
  const spoofed = (afterSpoof.body.messages || []).find((m) => m.text === 'I am the leader');
  check('but the identity comes from the token, not the body',
    !!spoofed && spoofed.driverId === 'HLL-2002' && spoofed.driver === 'Ordinary Driver',
    spoofed ? spoofed.driver + ' (' + spoofed.driverId + ')' : 'MISSING');
  check('and so does the role — a driver cannot label itself as control',
    !!spoofed && spoofed.role === 'driver', spoofed ? spoofed.role : '-');

  const asLeader = await req('POST', '/api/convoy/message',
    { convoyId: 'EV-7001', text: 'Control here, hold formation' }, TOKEN_LEADER);
  check('a manager speaks as control', asLeader.status === 200, 'HTTP ' + asLeader.status);
  const afterLeader = await req('GET', '/api/convoy/EV-7001/chat', null, TOKEN_LEADER);
  const ctrl = (afterLeader.body.messages || []).find((m) => /hold formation/.test(m.text));
  check('and the service marks it so', !!ctrl && ctrl.role === 'staff', ctrl ? ctrl.role : '-');

  /* ---------- 3. convoy access ---------- */
  const outsideRead = await req('GET', '/api/convoy/EV-7001/chat', null, TOKEN_OUTSIDE);
  check('a driver not on the convoy cannot read it',
    outsideRead.status === 403, 'HTTP ' + outsideRead.status);
  const outsideWrite = await req('POST', '/api/convoy/message',
    { convoyId: 'EV-7001', text: 'butting in' }, TOKEN_OUTSIDE);
  check('nor write to it', outsideWrite.status === 403, 'HTTP ' + outsideWrite.status);

  const ghost = await req('POST', '/api/convoy/message',
    { convoyId: 'EV-0000', text: 'nowhere' }, TOKEN_LEADER);
  check('a convoy that does not exist is a 404', ghost.status === 404, 'HTTP ' + ghost.status);

  const empty = await req('POST', '/api/convoy/message',
    { convoyId: 'EV-7001', text: '   ' }, TOKEN_LEADER);
  check('an empty message is rejected', empty.status === 400, 'HTTP ' + empty.status);

  /* ---------- 4. moderation ---------- */
  const mine = (afterLeader.body.messages || []).find((m) => m.driverId === 'HLL-2002');
  const otherDeletes = await req('POST', '/api/convoy/message/delete',
    { id: ctrl.id }, TOKEN_DRIVER);
  check('a driver cannot delete somebody else’s message',
    otherDeletes.status === 403, 'HTTP ' + otherDeletes.status);

  const ownDelete = await req('POST', '/api/convoy/message/delete',
    { id: mine.id }, TOKEN_DRIVER);
  check('but can delete their own', ownDelete.status === 200, 'HTTP ' + ownDelete.status);

  const modDelete = await req('POST', '/api/convoy/message/delete',
    { id: ctrl.id }, TOKEN_LEADER);
  check('and a moderator can delete anybody’s', modDelete.status === 200,
    'HTTP ' + modDelete.status);

  const afterMod = await req('GET', '/api/convoy/EV-7001/chat', null, TOKEN_LEADER);
  const gone = (afterMod.body.messages || []).find((m) => m.id === mine.id);
  check('a removed message leaves a hole rather than vanishing',
    !!gone && gone.deleted === true && gone.text === '',
    gone ? 'kept, flagged deleted' : 'DISAPPEARED');

  /* ---------- 5. pagination ---------- */
  /* paced: the service rate-limits writes per address, and this test is
     about pagination, not about proving the rate limiter works */
  let sentOk = 0;
  for (let i = 0; i < 60; i++) {
    const r = await req('POST', '/api/convoy/message',
      { convoyId: 'EV-7001', text: 'message ' + i }, TOKEN_DRIVER);
    if (r.status === 200) sentOk++;
    if (i % 10 === 9) await wait(600);
  }
  check('every paced message was accepted', sentOk === 60, sentOk + ' of 60');
  const page1 = await req('GET', '/api/convoy/EV-7001/chat?limit=25', null, TOKEN_DRIVER);
  check('a long conversation is paged, not dumped',
    (page1.body.messages || []).length === 25 && page1.body.total >= 60,
    (page1.body.messages || []).length + ' of ' + page1.body.total);
  check('and hands back a cursor for the rest', !!page1.body.olderCursor,
    page1.body.olderCursor || 'NONE');

  const page2 = await req('GET',
    '/api/convoy/EV-7001/chat?limit=25&before=' + page1.body.olderCursor, null, TOKEN_DRIVER);
  const ids1 = new Set((page1.body.messages || []).map((m) => m.id));
  const overlap = (page2.body.messages || []).filter((m) => ids1.has(m.id)).length;
  check('the next page is older and does not repeat',
    (page2.body.messages || []).length === 25 && overlap === 0,
    (page2.body.messages || []).length + ' more, ' + overlap + ' repeated');

  const newest = (page1.body.messages || [])[page1.body.messages.length - 1];
  check('the newest message is last on the first page',
    newest && newest.text === 'message 59', newest ? newest.text : '-');

  /* ---------- 6. it survives a restart ---------- */
  const beforeCount = page1.body.total;
  say('');
  say('  (stopping the service)');
  server.kill();
  await wait(1200);

  const down = await req('GET', '/api/convoy/EV-7001/chat', null, TOKEN_LEADER);
  check('the service really is down', down.status === 0, 'no answer');

  say('  (starting it again)');
  server = startServer();
  await wait(1800);

  const afterRestart = await req('GET', '/api/convoy/EV-7001/chat?limit=25', null, TOKEN_LEADER);
  check('the conversation is still there after a restart',
    afterRestart.status === 200 && afterRestart.body.total === beforeCount,
    afterRestart.body ? afterRestart.body.total + ' messages' : 'HTTP ' + afterRestart.status);
  const stillGone = (afterRestart.body.messages || []).concat(
    (await req('GET', '/api/convoy/EV-7001/chat?limit=200', null, TOKEN_LEADER)).body.messages || []);
  check('including which ones were moderated',
    stillGone.some((m) => m.id === mine.id && m.deleted === true), 'deletion survived');

  check('and the token still works, so nobody is signed out',
    afterRestart.status === 200, 'session survived the restart');

  /* a token that was never issued is refused */
  const forged = await req('GET', '/api/auth/me', null, 'f'.repeat(64));
  check('a forged token is refused', forged.status === 401, 'HTTP ' + forged.status);

  /* ---------- 7. signing out ---------- */
  await req('POST', '/api/auth/logout', {}, TOKEN_OUTSIDE);
  const afterLogout = await req('GET', '/api/auth/me', null, TOKEN_OUTSIDE);
  check('signing out invalidates the token', afterLogout.status === 401,
    'HTTP ' + afterLogout.status);

  try { server.kill(); } catch (e) {}
  [COMPANY_FILE, SESSION_FILE, CHAT_FILE].forEach((f) => {
    try { fs.unlinkSync(f); } catch (e) {}
  });
  say('\n' + (failures ? failures + ' failed\n' : 'all passed\n'));
  process.exit(failures ? 1 : 0);
})().catch((e) => { say('\n  ERROR  ' + e.stack + '\n'); process.exit(1); });
