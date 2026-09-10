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
