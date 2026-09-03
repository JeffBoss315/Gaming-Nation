/* ============================================================
   Smoke test — a message crossing between two browsers.

     electron tools/smoke-dm-web.js .

   tools/smoke-messaging.js proves the service carries a message.
   This proves the PLATFORM does: that a driver typing into the
   composer on one machine puts words on another driver's screen.

   That is a different question, and the interesting failures live
   between the two — a stream opened without an identity, an
   attachment addressed relative to the website rather than to the
   service, a screen that has the message and never repaints.

   Two windows, two storage partitions, one service. Everything
   crosses through the service, because there is no other route.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, spawnSync } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const PORT = 7099;
const TMP = path.join(os.tmpdir(), 'hll-dmweb-smoke');
const SITE_OUT = path.join(ROOT, '.smoke-dm-site');
const APP_OUT = path.join(ROOT, '.smoke-dm-app');

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch (e) {}
fs.mkdirSync(TMP, { recursive: true });

app.setPath('userData', path.join(app.getPath('temp'), 'hll-smoke-dm-web'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const steps = [];
const say = (k, v) => steps.push(k + ': ' + v);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

async function open(url, partition) {
  const win = new BrowserWindow({
    width: 1300, height: 900, show: false,
    webPreferences: { partition, session: undefined },
  });
  await win.loadURL(url);
  /* Registration goes through Supabase Auth; this test is about the
     service, and must not leave real accounts in the live project. */
  await win.webContents.executeJavaScript(FAKE_SUPABASE);
  await wait(1600);
  return win;
}

app.whenReady().then(async () => {
  const built = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'build-www.js')], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1', HLL_SITE_OUT: SITE_OUT, HLL_APP_OUT: APP_OUT,
    }),
    encoding: 'utf8',
  });
  if (built.status !== 0) {
    console.log('could not build www/: ' + (built.stderr || built.error));
    app.exit(1);
    return;
  }

  const server = spawn(process.execPath, [path.join(ROOT, 'fleet-server.js'), '--port', String(PORT)], {
    cwd: ROOT,
    env: Object.assign({}, process.env, {
      ELECTRON_RUN_AS_NODE: '1',
      HLL_COMPANY_FILE: path.join(TMP, 'company.json'),
      HLL_SESSION_FILE: path.join(TMP, 'sessions.json'),
      HLL_DM_FILE: path.join(TMP, 'dms.json'),
      HLL_FILES_FILE: path.join(TMP, 'files.json'),
      HLL_FILES_DIR: path.join(TMP, 'files'),
      HLL_SITE_DIR: SITE_OUT,
    }),
    stdio: 'ignore',
  });
  await wait(1600);

  const base = 'http://localhost:' + PORT;
  let problems = 0;
  const fail = (why) => { problems++; say('PROBLEM', why); };

  try {
    /* ---------- two drivers, on two machines ---------- */
    const one = await open(base + '/', 'persist:dm-one');
    const two = await open(base + '/', 'persist:dm-two');

    say('the page found the service by itself', await one.webContents.executeJavaScript('Sync.url()') || 'NONE');

    const signUp = (win, name, email) => win.webContents.executeJavaScript(`(async () => {
      const out = {};
      const res = await Accounts.register(
        { name: ${JSON.stringify(name)}, email: ${JSON.stringify(email)}, discord: '',
          created: new Date().toISOString() },
        'DriverPass123', 'Netherlands').catch((e) => ({ error: e.message }));
      out.registered = res.error || 'ok';

      /* The service authenticates against the company's account list, and
         that list only reaches it when the company is pushed. Registering
         and immediately signing in beats the push there, so the service
         has never heard of the account — which looked like a broken login
         and was really a race. */
      Sync.push();
      await new Promise(r => setTimeout(r, 2200));

      out.auth = await ServiceAuth.login(${JSON.stringify(email)}, 'DriverPass123');
      out.token = !!ServiceAuth.token;
      out.me = ServiceAuth.driver ? ServiceAuth.driver.id : null;
      out.why = ServiceAuth.lastError || '';
      out.authStatus = ServiceAuth.status;

      /* Registering does not sign anybody in — it files an application.
         Without this the app sits on the sign-in screen, the shell is
         never rendered, and every element the messages screen lives in
         is simply absent. Approve the new driver and sign them in, which
         is what a recruiter accepting them would produce. */
      const rec = Store.driver(out.me);
      if (rec) {
        rec.accountStatus = 'active';
        rec.status = rec.status || 'offline';
        Store.save();
        doLogin(rec);
        render();
        await new Promise(r => setTimeout(r, 500));
      }
      out.signedIn = !!state.user;
      return out;
    })()`);

    /* A fresh address every run. The storage partitions persist between
       runs while the company file does not, so a fixed address left the
       browser holding a driver record from a previous run and the service
       matching the account from a different one — the two identities then
       disagreed about who "me" was, and nothing lined up. */
    const stamp = Date.now();
    const a = await signUp(one, 'Anna Bergen', 'anna.dm' + stamp + '@example.com');
    const b = await signUp(two, 'Marek Kowal', 'marek.dm' + stamp + '@example.com');

    say('driver one registered, signed in and holds a token',
      a.registered + ' / ' + (a.signedIn ? 'signed in' : 'NOT SIGNED IN')
      + ' / ' + (a.token ? a.me : 'NO TOKEN — ' + a.authStatus + ' ' + a.why));
    say('driver two registered, signed in and holds a token',
      b.registered + ' / ' + (b.signedIn ? 'signed in' : 'NOT SIGNED IN')
      + ' / ' + (b.token ? b.me : 'NO TOKEN — ' + b.authStatus + ' ' + b.why));
    if (!a.token || !b.token) fail('a driver could not get a service token');
    if (!a.signedIn || !b.signedIn) fail('a driver could not sign in to the platform');

    /* Each machine registered against its own in-memory Supabase, so
       neither roster knows the other yet. The company blob is what
       carries them across — pull it in on both. */
    await one.webContents.executeJavaScript('Sync.pull().catch(() => null)');
    await two.webContents.executeJavaScript('Sync.pull().catch(() => null)');
    await wait(1800);

    /* ---------- the live channel, opened as somebody ---------- */
    const streamOne = await one.webContents.executeJavaScript(`(async () => {
      /* HQLive owns the stream; LiveMap.start() starts it and the poll. */
      LiveMap.start();
      await new Promise(r => setTimeout(r, 1400));
      return { status: HQLive.status, url: HQLive.es ? HQLive.es.url : '' };
    })()`);
    say('the stream carries the identity that opened it',
      /token=/.test(streamOne.url) ? 'yes' : 'NO — ' + streamOne.url);
    if (!/token=/.test(streamOne.url)) fail('the stream was opened anonymously');

    await two.webContents.executeJavaScript('LiveMap.start()');
    await wait(1400);

    /* ---------- one driver writes to the other ---------- */
    const sent = await one.webContents.executeJavaScript(`(async () => {
      go('#/messages'); render();
      await new Promise(r => setTimeout(r, 600));

      await Messages.pullThreads();
      await Messages.open(${JSON.stringify(b.me)});
      render();
      await new Promise(r => setTimeout(r, 400));

      /* count what the live channel actually delivers back to the sender */
      window.__dmFrames = 0;
      window.__dmSeen = null;
      const origReceive = Messages.receive.bind(Messages);
      Messages.receive = (m) => {
        window.__dmFrames++;
        window.__dmSeen = {
          from: m.driverId, to: m.to,
          me: state.user ? state.user.id : null,
          withId: Messages.withId,
        };
        return origReceive(m);
      };

      const ok = await Messages.send('Are you running the Rotterdam load?', null);
      await new Promise(r => setTimeout(r, 1200));

      return {
        ok,
        frames: window.__dmFrames,
        held: Messages.messages.length,
        bubbles: document.querySelectorAll('.dm-msg').length,
        seen: window.__dmSeen,
        onScreen: document.body.textContent.includes('Rotterdam'),
        composer: !!document.getElementById('dmInput'),
        callButton: !!document.querySelector('[data-act="dm-call"]'),
        videoButton: !!document.querySelector('[data-act="dm-video"]'),
        attachButton: !!document.querySelector('[data-act="dm-attach"]'),
        /* if the controls are missing, these say why */
        route: state.route ? state.route.name : 'NONE',
        signedIn: !!state.user,
        panes: !!document.getElementById('dmPanes'),
        withId: Messages.withId,
        connected: Messages.on(),
      };
    })()`);

    say('the composer, attach and call controls are drawn',
      [sent.composer && 'composer', sent.attachButton && 'attach',
        sent.callButton && 'call', sent.videoButton && 'video'].filter(Boolean).join(' + ')
      || ('NONE — route ' + sent.route + ', signed in ' + sent.signedIn
          + ', panes ' + sent.panes + ', with ' + sent.withId
          + ', connected ' + sent.connected));
    if (!sent.composer) fail('the composer is not on the messages screen');
    say('the message was accepted', sent.ok ? 'yes' : 'NO');
    /* Not "is the word anywhere on the page" — the thread list shows a
       preview of the last message, so that passes even when the
       conversation itself never painted. Count the bubbles. */
    say('the live channel echoed it back to the sender',
      sent.frames + ' frame(s), ' + sent.held + ' held, ' + sent.bubbles + ' bubble(s) drawn'
      + (sent.bubbles ? '' : '  [' + JSON.stringify(sent.seen) + ']'));
    if (!sent.ok) fail('the message was not accepted');
    if (!sent.bubbles) fail('the sender cannot see what they just sent');

    /* ---------- the other machine, without being asked ---------- */
    await wait(1200);
    const got = await two.webContents.executeJavaScript(`(async () => {
      const out = {
        threads: Messages.threads.length,
        unread: Messages.unread(),
        badge: (document.getElementById('dmBadge') || {}).textContent || '',
      };
      go('#/messages'); render();
      await new Promise(r => setTimeout(r, 700));
      await Messages.pullThreads();
      const t = Messages.threads[0];
      if (t) { await Messages.open(t.withId); }
      render();
      await new Promise(r => setTimeout(r, 500));
      out.withName = t ? t.withName : 'NONE';
      out.onScreen = document.body.textContent.includes('Rotterdam');
      return out;
    })()`);

    say('it arrived on the other machine unprompted',
      got.threads ? got.threads + ' conversation(s), ' + got.unread + ' unread' : 'NOTHING ARRIVED');
    say('the sidebar badge lit', got.badge || 'empty');
    say('the conversation names who it is with', got.withName);
    say('and the words are on their screen', got.onScreen ? 'yes' : 'NO');

    if (!got.threads) fail('the message never reached the second machine');
    if (!got.onScreen) fail('the second machine has the message but does not show it');
    if (got.withName !== 'Anna Bergen') fail('the conversation is attributed to ' + got.withName);

    /* ---------- an attachment ---------- */
    const att = await one.webContents.executeJavaScript(`(async () => {
      /* a real PNG, one red pixel — built in the page, as a file picker would */
      const b64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
      const bin = atob(b64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
      const file = new File([bytes], 'delivery-note.png', { type: 'image/png' });

      const meta = await Messages.upload(file);
      if (!meta) return { uploaded: false };
      const ok = await Messages.send('', { id: meta.id });
      await new Promise(r => setTimeout(r, 900));

      return {
        uploaded: true, ok,
        /* the address has to point at the SERVICE, not at the website */
        url: Messages.fileUrl(meta),
        rendered: !!document.querySelector('.dm-image img'),
        held: Messages.messages.length,
        lastHasAttachment: !!(Messages.messages[Messages.messages.length - 1] || {}).attachment,
        bubbles: document.querySelectorAll('.dm-msg').length,
        panes: !!document.getElementById('dmPanes'),
      };
    })()`);

    say('an image uploads and is sent', att.uploaded && att.ok ? 'yes' : 'NO');
    say('addressed to the service, not to the site',
      String(att.url || '').startsWith(base + '/files/') ? 'yes' : 'NO — ' + att.url);
    say('and is drawn as a picture', att.rendered ? 'yes'
      : 'NO — ' + att.held + ' held, last has attachment ' + att.lastHasAttachment
        + ', ' + att.bubbles + ' bubbles drawn, panes ' + att.panes);
    if (!att.uploaded || !att.ok) fail('the attachment was not sent');
    if (!String(att.url || '').startsWith(base + '/files/')) fail('the attachment address is wrong');
    if (!att.rendered) fail('the image was not rendered');

    await wait(1200);
    const gotAtt = await two.webContents.executeJavaScript(`(async () => {
      await Messages.refresh();
      await new Promise(r => setTimeout(r, 400));
      const img = document.querySelector('.dm-image img');
      if (!img) return { shown: false };
      /* fetched over the wire, so a broken address would show here */
      const res = await fetch(img.src).catch(() => null);
      return { shown: true, loads: !!(res && res.ok), type: res ? res.headers.get('content-type') : '' };
    })()`);

    say('the other driver sees the picture', gotAtt.shown ? 'yes' : 'NO');
    say('and it actually loads', gotAtt.loads ? gotAtt.type : 'NO');
    if (!gotAtt.shown || !gotAtt.loads) fail('the attachment did not reach the other machine');

    /* ---------- calling ---------- */
    const call = await one.webContents.executeJavaScript(`(async () => {
      /* getUserMedia needs a device this test does not have, so the media
         step is stubbed. Everything AFTER it — the signalling, the overlay,
         the teardown — is the real code. */
      Calls.media = async () => new MediaStream();
      await Calls.start(${JSON.stringify(b.me)}, 'Marek Kowal', false);
      await new Promise(r => setTimeout(r, 600));
      return {
        state: Calls.state,
        overlay: !!document.querySelector('.call-card'),
        who: (document.querySelector('.call-who') || {}).textContent || '',
      };
    })()`);

    say('placing a call puts the overlay up', call.overlay ? call.state + ' — ' + call.who : 'NO OVERLAY');
    if (!call.overlay) fail('the call overlay never appeared');

    await wait(900);
    const ring = await two.webContents.executeJavaScript(`(async () => ({
      state: Calls.state,
      ringing: !!document.querySelector('.call-card.ring'),
      who: (document.querySelector('.call-who') || {}).textContent || '',
      answer: !!document.querySelector('[data-act="call-accept"]'),
      decline: !!document.querySelector('[data-act="call-decline"]'),
    }))()`);

    say('the other driver is rung',
      ring.ringing ? ring.who + ' — answer/decline ' + (ring.answer && ring.decline ? 'offered' : 'MISSING')
        : 'NOT RINGING (' + ring.state + ')');
    if (!ring.ringing) fail('the call did not ring the other machine');
    if (!ring.answer || !ring.decline) fail('the incoming call offers no way to answer it');

    const done = await two.webContents.executeJavaScript(`(async () => {
      Calls.decline();
      await new Promise(r => setTimeout(r, 700));
      return { state: Calls.state, overlay: !!document.querySelector('.call-card') };
    })()`);
    say('declining clears it', done.state === 'idle' && !done.overlay ? 'yes' : 'NO — ' + done.state);
    if (done.state !== 'idle') fail('declining did not end the call');

    const after = await one.webContents.executeJavaScript(`(async () => {
      await new Promise(r => setTimeout(r, 600));
      return { state: Calls.state, overlay: !!document.querySelector('.call-card') };
    })()`);
    say('and the caller is told', after.state === 'idle' && !after.overlay ? 'yes' : 'NO — ' + after.state);
    if (after.state !== 'idle') fail('the caller was left ringing');

  } catch (err) {
    problems++;
    say('CRASH', err.message);
  }

  console.log('\nA message between two browsers\n');
  steps.forEach((s) => console.log('  ' + s));
  console.log(problems ? '\n' + problems + ' problem(s)\n' : '\nall passed\n');

  try { server.kill(); } catch (e) {}
  [SITE_OUT, APP_OUT].forEach((d) => {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch (e) {}
  });
  app.exit(problems ? 1 : 0);
});


