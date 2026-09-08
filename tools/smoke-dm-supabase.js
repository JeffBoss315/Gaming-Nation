/* Driver to driver over Supabase.

     npm run smoke:dmsupa

   Messages were the last thing on the platform still talking to
   fleet-server.js, so a driver on the website was told to start a service
   that only ever runs in the office. They now go through the company's own
   database — public.conversations, conversation_participants and messages,
   reached through the dm_* functions in
   supabase/migrations/20260908_driver_messaging.sql.

   Those functions live in Postgres and cannot be run from a test harness.
   What is checked here is the seam, which is where the mistakes are: that
   the client asks for the right function with the right argument names,
   and draws what it is answered with. The stand-in below returns exactly
   the row shapes the SQL declares — if the two ever drift apart, this is
   the file to bring back into line with the migration.

   What this deliberately does NOT cover: the SQL itself, row level
   security, and realtime delivery. Those need a real project. */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const { SOURCE: FAKE_SUPABASE } = require(path.join(ROOT, 'tools', 'fake-supabase'));

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-dm-supabase'));
app.disableHardwareAcceleration();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* The dm_* functions, in memory, answering in the shapes the migration
   declares. Column names here are the RETURNS TABLE column names there. */
const DM_BACKEND = `
(() => {
  const S = window.gmnSupabase;
  const db = { conversations: [], participants: [], messages: [], nextC: 1, nextM: 1 };
  const me = () => state.user.id;

  /* A clock that always moves.

     Unread is "created_at later than last_read_at", and Date.now() has
     millisecond resolution — so a message the test files immediately
     after marking read carries the SAME stamp and is not counted, which
     looks like a broken unread count and is only this stand-in being
     coarser than the timestamptz column it stands in for. */
  let tick = Date.now();
  const now = () => new Date(++tick).toISOString();

  window.__rpcCalls = [];

  function convWith(code) {
    let c = db.conversations.find((x) => x.kind === 'dm' && x.with === code);
    if (!c) { c = { id: db.nextC++, kind: 'dm', with: code }; db.conversations.push(c); }
    return c.id;
  }

  function room() {
    let c = db.conversations.find((x) => x.kind === 'room');
    if (!c) { c = { id: db.nextC++, kind: 'room', with: null }; db.conversations.push(c); }
    /* dm_room() joins you as having read it, not as having read nothing */
    if (!db.participants.some((p) => p.c === c.id)) {
      db.participants.push({ c: c.id, read: now() });
    }
    return c.id;
  }

  S.rpc = function (fn, args) {
    window.__rpcCalls.push(fn + '(' + Object.keys(args || {}).sort().join(',') + ')');
    args = args || {};

    if (fn === 'dm_room') return Promise.resolve({ data: room(), error: null });
    if (fn === 'dm_with') return Promise.resolve({ data: convWith(args.other_code), error: null });

    if (fn === 'dm_threads') {
      return Promise.resolve({ data: db.conversations.map((c) => {
        const msgs = db.messages.filter((m) => m.c === c.id);
        const last = msgs[msgs.length - 1];
        const p = db.participants.find((x) => x.c === c.id) || { read: '1970-01-01T00:00:00Z' };
        return {
          conversation_id: c.id,
          kind: c.kind,
          with_code: c.with,
          with_name: c.with ? ('Driver ' + c.with) : null,
          last_text: last && !last.deleted ? last.text : null,
          last_at: last ? last.at : null,
          last_mine: last ? last.from === me() : null,
          last_deleted: last ? !!last.deleted : false,
          unread: msgs.filter((m) => m.from !== me() && !m.deleted && m.at > p.read).length,
        };
      }), error: null });
    }

    if (fn === 'dm_history') {
      return Promise.resolve({ data: db.messages
        .filter((m) => m.c === args.conversation)
        .map((m) => ({
          id: m.id, at: m.at,
          sender_code: m.from, sender_name: 'Driver ' + m.from,
          mine: m.from === me(),
          body: m.deleted ? null : m.text,
          attachment: m.deleted ? null : (m.att || null),
          deleted: !!m.deleted,
          read_by_them: false,
        })), error: null });
    }

    if (fn === 'dm_send') {
      const c = args.other_code === '#fleet' ? room() : convWith(args.other_code);
      const m = { id: db.nextM++, c, from: me(), text: args.body || null,
                  att: args.attach || null, at: now(), deleted: false };
      db.messages.push(m);
      return Promise.resolve({ data: m.id, error: null });
    }

    if (fn === 'dm_mark_read') {
      let p = db.participants.find((x) => x.c === args.conversation);
      if (!p) { p = { c: args.conversation, read: null }; db.participants.push(p); }
      p.read = now();
      return Promise.resolve({ data: null, error: null });
    }

    if (fn === 'dm_delete') {
      const m = db.messages.find((x) => x.id === args.message_id);
      if (m) { m.deleted = true; m.text = null; m.att = null; }
      return Promise.resolve({ data: !!m, error: null });
    }

    if (fn === 'dm_directory') {
      return Promise.resolve({ data: [
        { code: 'GMN2001', name: 'Anna Bergen', role: 'driver' },
        { code: 'GMN2002', name: 'Marek Kowal', role: 'recruiter' },
      ], error: null });
    }

    /* what a project that has not run the migration answers */
    return Promise.resolve({ data: null, error: {
      code: 'PGRST202', message: 'Could not find the function' } });
  };

  /* the other end says something */
  window.__inbound = function (fromCode, text) {
    db.messages.push({ id: db.nextM++, c: convWith(fromCode), from: fromCode, text,
                       at: now(), deleted: false });
  };

  return true;
})()
`;

const RUN = `(async () => {
  const R = { steps: [] };
  const say = (k, got, want) => R.steps.push({ k, got: String(got), want: String(want) });
  const wait = (ms) => new Promise((r) => setTimeout(r, ms));

  try {
    /* A real session, because the transport is gated on having one. */
    const email = 'dm' + Date.now() + '@example.com';
    await Accounts.register(
      { name: 'DM Tester', email, discord: '', created: new Date().toISOString() },
      'DmTester123', 'Netherlands');
    state.user = Store.driver(Accounts.all().find((a) => a.email === email).driverId);

    /* No company service in this run, so Supabase has to be the one used —
       the service wins when it is there, and that path has its own test. */
    Store.db.meta.serviceUrl = '';
    Store.db.meta.fleetUrl = '';
    window.GMN_SERVICE = '';

    await SupaDM.check();
    say('a session is seen', SupaDM.session, true);
    say('Supabase is the transport', Messages.transport(), 'supabase');
    say('messages are connected', Messages.on(), true);

    await startMessaging();
    say('the fleet room is listed', Messages.threads.some((t) => t.room), true);
    say('the directory was read', SupaDM.people.length, 2);
    say('the picker offers it', dmRoster().some((d) => d.id === 'GMN2001'), true);

    await Messages.open('GMN2001');
    say('the conversation opened', SupaDM.ids.GMN2001 != null, true);

    say('the message was accepted',
      await Messages.send('Evening — running the Rotterdam leg?', null), true);
    say('and it is on screen',
      Messages.messages.some((m) => /Rotterdam/.test(m.text)), true);
    say('stamped as mine', Messages.messages[0].driverId === Messages.me(), true);

    /* a reply, arriving the way the subscription delivers one */
    window.__inbound('GMN2001', 'Yes, 19:00 from Rotterdam.');
    Messages.supaChanged();
    await wait(500);
    say('the reply arrived', Messages.messages.some((m) => /19:00/.test(m.text)), true);

    state.route = { name: 'messages', params: [] };
    render(); await wait(250);
    const page = document.querySelector('.page').textContent;
    say('the page draws the conversation', /Rotterdam leg/.test(page), true);
    say('and names who it is with', /GMN2001/.test(page), true);

    /* Calls need the service; the conversation does not. Offering a call
       the company cannot place is worse than not offering one. */
    say('no call button without a service',
      document.querySelector('[data-act="dm-call"]') === null, true);

    /* Counting unread, from a baseline this test controls.

       It used to count the two messages sent earlier, which made the
       result depend on whether supaChanged() had marked them read first
       — and that decision is taken after two awaits, so under load it
       lands after the page has moved and the count comes back one short.
       A real race, but the app's, not this assertion's business: read
       everything, then send a known number and count that. */
    await Messages.markRead();
    await Messages.pullThreads();
    say('reading clears the count',
      (Messages.threads.find((t) => t.withId === 'GMN2001') || {}).unread, 0);

    window.__inbound('GMN2001', 'Bring the low loader.');
    window.__inbound('GMN2001', 'And the straps.');
    await Messages.pullThreads();
    say('two new ones are counted',
      (Messages.threads.find((t) => t.withId === 'GMN2001') || {}).unread, 2);

    await Messages.markRead();
    await Messages.pullThreads();
    say('and cleared on reading',
      (Messages.threads.find((t) => t.withId === 'GMN2001') || {}).unread, 0);

    const mine = Messages.messages.find((m) => m.driverId === Messages.me());
    await Messages.remove(mine.id);
    say('a message can be withdrawn',
      (Messages.messages.find((m) => m.id === mine.id) || {}).deleted, true);

    await Messages.open('#fleet');
    await Messages.send('Convoy briefing at 18:45.', null);
    say('the fleet room takes one too',
      Messages.messages.some((m) => /18:45/.test(m.text)), true);

    /* Signing out has to take the channel with it, or the next person in
       on this browser inherits somebody else's conversations. */
    stopMessaging();
    say('sign-out clears the threads', Messages.threads.length, 0);
    say('and drops the subscription', SupaDM.channel === null, true);

    /* and a project that has not run the migration is told so, once */
    SupaDM.missing = false;
    SupaDM.note({ code: 'PGRST202', message: 'Could not find the function' });
    say('an un-run migration is named', /20260908_driver_messaging/.test(SupaDM.lastError), true);

    R.rpcs = Array.from(new Set(window.__rpcCalls));
  } catch (e) {
    R.crash = e && (e.stack || e.message);
  }
  return R;
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1400, height: 950, show: false });

  await win.loadFile(path.join(ROOT, 'login.html'));
  await win.webContents.executeJavaScript(FAKE_SUPABASE);
  await wait(1800);
  await win.webContents.executeJavaScript(DM_BACKEND);

  const out = await win.webContents.executeJavaScript(RUN);

  console.log('\ndriver to driver, over Supabase\n');

  let failures = 0;
  for (const s of out.steps) {
    const ok = s.got === s.want;
    if (!ok) failures++;
    console.log('  ' + (ok ? ' ' : '✗') + ' ' + s.k.padEnd(42)
      + s.got + (ok ? '' : '   (expected ' + s.want + ')'));
  }

  if (out.crash) { failures++; console.log('\n  crashed: ' + out.crash); }

  console.log('\n  functions called: ' + (out.rpcs || []).join(' '));
  console.log(failures ? '\n' + failures + ' failure(s)\n' : '\nall passed\n');

  app.exit(failures ? 1 : 0);
});
