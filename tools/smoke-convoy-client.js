/* ============================================================
   Smoke test — signing on to a convoy from the client.

     npm run smoke:convoysheet

   The client's convoy screen used to be a list of names and a
   button that opened the website. It now shows the route, the
   meeting point, the leader and the crew, and it signs the
   driver on.

   THAT SIGN-ON IS THE PART THAT MATTERS. It writes the company
   record - the same `registered` list the website reads - so
   there is one sheet, not a copy of one. Two things follow, and
   both are checked here:

     the state written is 'registered', which is what the
     platform writes for a sign-up. 'completed' is what it writes
     AFTERWARDS, and that is what attendance counts, so writing
     it here would credit a convoy nobody drove.

     a full convoy refuses, rather than writing a name into a
     slot that does not exist and letting somebody find out at
     the meeting point.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

const steps = [];
let problems = 0;
const check = (name, ok, detail) => {
  steps.push((ok ? '  ' : '! ') + String(name).padEnd(52)
    + (detail === undefined ? '' : detail));
  if (!ok) problems++;
};

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-convoysheet'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({
    width: 1200, height: 900, show: false,
    webPreferences: { preload: path.join(ROOT, 'preload.js') },
  });
  const errors = [];
  win.webContents.on('console-message', (_e, level, msg) => {
    if (level >= 2 && !/Electron Security Warning/.test(msg)) errors.push(msg);
  });

  await win.loadFile(path.join(ROOT, 'tracker.html'));
  await new Promise((r) => setTimeout(r, 1600));
  const run = (js) => win.webContents.executeJavaScript(js);

  try {
    await run(`(() => {
      const now = Date.now();
      Store.db.driver = Object.assign(Store.db.driver || {},
        { gmnId: 'GMN-ME', name: 'Me' });

      localStorage.setItem('gmn.db.v1', JSON.stringify({
        drivers: [
          { id: 'GMN-ME', name: 'Me', status: 'offline', accountStatus: 'active' },
          { id: 'GMN-LEAD', name: 'Lead Driver', status: 'online', accountStatus: 'active' },
          { id: 'GMN-PAL', name: 'Pal Driver', status: 'offline', accountStatus: 'active' },
        ],
        sessions: [], tickets: [], announcements: [], notifications: [], assignments: [],
        events: [
          { id: 'EV-BIG', name: 'Friday Night Haul', typeLabel: 'Official Convoy',
            status: 'scheduled', date: new Date(now + 6 * 3600000).toISOString(),
            meetTime: new Date(now + 5.5 * 3600000).toISOString(),
            start: 'Calais', dest: 'Berlin', path: ['Calais', 'Brussels', 'Cologne', 'Berlin'],
            distance: 940, duration: 520, server: 'Simulation 1', dlc: 'Base map',
            leaderId: 'GMN-LEAD', maxSlots: 30,
            meetPoint: 'Calais — Company HQ car park',
            instructions: ['Hold a 60 m gap.', 'Full livery required.'],
            registered: [{ driverId: 'GMN-LEAD', state: 'registered' },
                         { driverId: 'GMN-PAL', state: 'registered' }] },
          { id: 'EV-FULL', name: 'Sold Out Run', status: 'scheduled',
            date: new Date(now + 48 * 3600000).toISOString(), maxSlots: 2,
            start: 'Paris', dest: 'Lyon',
            registered: [{ driverId: 'GMN-LEAD' }, { driverId: 'GMN-PAL' }] },
          { id: 'EV-DONE', name: 'Last week', status: 'completed',
            date: new Date(now - 7 * 86400000).toISOString(), registered: [] },
        ],
      }));
      Fleet.drivers = [{ id: 'GMN-PAL' }];       /* Pal is out on the road */
      state.convoySel = 'EV-BIG';
      return true;
    })()`);

    /* ---- what is listed ---- */
    const ids = await run(`Convoys.all().map((e) => e.id)`);
    check('a finished convoy is not on the sheet', ids.indexOf('EV-DONE') === -1,
      ids.join(', '));

    /* ---- the detail a driver actually wants ---- */
    const html = await run(`convoyDetailHTML(Convoys.find('EV-BIG'))`);
    for (const [what, txt] of [
      ['every stop on the route', 'Brussels'],
      ['the distance', '940 km'],
      ['the meeting point', 'Company HQ car park'],
      ['the server', 'Simulation 1'],
      ['the leader', 'Lead Driver'],
      ['the rules for the day', 'Hold a 60 m gap'],
    ]) check('it shows ' + what, html.indexOf(txt) > -1, txt);

    const members = await run(`Convoys.members(Convoys.find('EV-BIG'))
      .map((m) => m.name + (m.leader ? '*' : '') + (m.driving ? '~' : ''))`);
    check('the leader is first in the crew list', members[0] === 'Lead Driver*',
      members.join(', '));
    check('and somebody on the road is marked as driving',
      members.some((m) => m.indexOf('~') > -1), 'Pal Driver is out');

    /* ---- signing on writes the company record ---- */
    check('not signed on to begin with',
      (await run(`Convoys.signedOn(Convoys.find('EV-BIG'))`)) === false, 'off the list');

    await run(`Convoys.toggle('EV-BIG')`);
    const row = await run(`(() => {
      const e = (Auth.hqDb().events || []).find((x) => x.id === 'EV-BIG');
      return (e.registered || []).find((r) => r.driverId === 'GMN-ME') || null;
    })()`);
    check('signing on writes the company record', !!row,
      row ? 'registered on EV-BIG' : 'NOTHING WAS WRITTEN');
    check('as a sign-up, never as an attendance',
      !!row && row.state === 'registered',
      row ? row.state + (row.state === 'completed' ? ' — WOULD CREDIT A CONVOY NOBODY DROVE' : '') : '-');
    check('and the screen agrees',
      (await run(`Convoys.signedOn(Convoys.find('EV-BIG'))`)) === true, 'on the list');

    /* ---- and signing off takes it away again ---- */
    await run(`Convoys.toggle('EV-BIG')`);
    check('signing off removes it from the record',
      (await run(`((Auth.hqDb().events || []).find((x) => x.id === 'EV-BIG').registered || [])
        .some((r) => r.driverId === 'GMN-ME')`)) === false, 'off the list again');
    check('without disturbing anybody else',
      (await run(`((Auth.hqDb().events || []).find((x) => x.id === 'EV-BIG').registered || []).length`)) === 2,
      'the other two are still on');

    /* ---- a full convoy ---- */
    check('a full convoy reads as full',
      (await run(`Convoys.full(Convoys.find('EV-FULL'))`)) === true, '2 of 2');
    await run(`Convoys.toggle('EV-FULL')`);
    check('and refuses rather than overfilling',
      (await run(`((Auth.hqDb().events || []).find((x) => x.id === 'EV-FULL').registered || []).length`)) === 2,
      'still 2 — nobody was squeezed in');

    /* ---- putting one on the schedule ----
       The app could show convoys and sign a driver on; publishing one
       meant opening the website. It writes the SAME record the platform
       writes, into the same company record, because there is one schedule
       and both ends read it. A shape of its own would be a second kind of
       convoy that only one screen understood. */
    const made = await run(`(async () => {
      /* an event manager, not an ordinary driver */
      const hq = Auth.hqDb();
      hq.drivers[0].role = 'event_manager';
      Auth.saveHqDb(hq);
      Store.db.driver.role = 'event_manager';

      NewConvoy.open();
      document.querySelector('#cvName').value = 'Midweek Run';
      document.querySelector('#cvFrom').value = 'Calais';
      document.querySelector('#cvTo').value = 'Berlin';
      document.querySelector('#cvVia').value = 'Brussels, Cologne';
      document.querySelector('#cvServer').value = 'Simulation 1';
      document.querySelector('#cvSlots').value = '24';
      document.querySelector('#cvLeader').value = 'GMN-ME';
      NewConvoy.create();

      const e = (Auth.hqDb().events || []).find((x) => x.name === 'Midweek Run');
      return e ? {
        status: e.status, path: e.path, km: e.distance, slots: e.maxSlots,
        leader: e.leaderId, typeLabel: e.typeLabel, server: e.server,
        signed: (e.registered || []).map((r) => r.driverId + ':' + r.state),
        meetsBefore: new Date(e.date) - new Date(e.meetTime),
        rules: (e.instructions || []).length,
      } : null;
    })()`);
    check('an event manager can publish a convoy', !!made,
      made ? 'Midweek Run is on the schedule' : 'NOTHING WAS WRITTEN');
    if (made) {
      check('with every stop in order',
        made.path.join(' > ') === 'Calais > Brussels > Cologne > Berlin',
        made.path.join(' > '));
      check('and a distance measured along them',
        made.km > 700 && made.km < 1200, made.km + ' km');
      check('scheduled, not live', made.status === 'scheduled', made.status);
      check('the leader is on the sheet from the start',
        made.signed.join() === 'GMN-ME:registered', made.signed.join() || 'nobody');
      check('the crew gathers half an hour before',
        made.meetsBefore === 30 * 60000, (made.meetsBefore / 60000) + ' min');
      check('and it carries the rules for the day', made.rules === 4, made.rules + ' rules');
    }

    /* A typo in a city puts the convoy nowhere on the map, so it is caught
       and named rather than written. */
    const typo = await run(`(() => {
      const before = (Auth.hqDb().events || []).length;
      NewConvoy.open();
      document.querySelector('#cvName').value = 'Nowhere Run';
      document.querySelector('#cvFrom').value = 'Calais';
      document.querySelector('#cvTo').value = 'Berlinn';
      NewConvoy.create();
      const after = (Auth.hqDb().events || []).length;
      closeModals();
      return { before, after };
    })()`);
    check('a city the game does not have is refused', typo.after === typo.before,
      typo.before + ' before, ' + typo.after + ' after');

    /* and an ordinary driver cannot publish at all */
    const denied = await run(`(() => {
      const hq = Auth.hqDb(); hq.drivers[0].role = 'driver'; Auth.saveHqDb(hq);
      Store.db.driver.role = 'driver';
      const before = (Auth.hqDb().events || []).length;
      NewConvoy.create();
      return { before, after: (Auth.hqDb().events || []).length,
        opened: !!document.querySelector('#cvName') };
    })()`);
    check('an ordinary driver cannot publish one',
      denied.after === denied.before, denied.before + ' before, ' + denied.after + ' after');

    /* ---- the crew room opens itself ----
       The Chats screen draws the crew room as selected the moment it is
       shown. Looking selected is not the same as being open: send()
       refuses while Messages.open is null, and the history only loads for
       the thread that is open. A driver saw the room highlighted and
       empty, typed, pressed Send, and nothing happened - no message, no
       error, nothing. */
    const chat = await run(`(() => {
      const opened = [];
      Messages.on = () => true;                       /* pretend a service */
      Messages.openThread = (id) => { opened.push(String(id)); Messages.open = String(id); };
      Messages.open = null; Messages.roomTried = false; Messages.threads = [];

      viewChats();                                    /* first paint */
      const first = opened.slice();
      viewChats(); viewChats();                       /* and two more */
      return { first, total: opened.length, open: Messages.open };
    })()`);
    check('showing the chats screen opens the crew room',
      chat.first[0] === '#fleet', chat.first[0] || 'NOTHING WAS OPENED');
    check('so the composer has a thread to send to', chat.open === '#fleet', chat.open || 'null');
    check('and it is asked for once, not on every repaint',
      chat.total === 1, chat.total + ' open(s) across three paints');

    const down = await run(`(() => {
      Messages.on = () => false;                      /* the service is down */
      Messages.open = null; Messages.roomTried = false;
      let asked = 0;
      Messages.openThread = () => { asked++; };
      viewChats(); viewChats();
      return asked;
    })()`);
    check('a service that is down is not re-asked every paint', down === 0,
      down + ' attempt(s)');

    check('the renderer logged no errors', errors.length === 0,
      errors.length ? errors.slice(0, 2).join(' | ') : 'none');
  } catch (e) {
    check('the test itself ran', false, (e && e.message) || String(e));
  }

  console.log('\nsigning on to a convoy from the client');
  console.log(steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
  app.exit(problems ? 1 : 0);
});
