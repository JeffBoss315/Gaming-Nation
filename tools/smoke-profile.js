/* The driver's own record: their photo, their application, and the
   heartbeat that kept rewriting the company.

     npm run smoke:profile

   Three things that were wrong, and all three are the same mistake seen
   from different sides — state.user is a COPY built by Accounts.fromRow,
   not a handle on the roster row, so writing to it changes nothing that
   outlives the session.

     1. THE PHOTO VANISHED ON SIGN-OUT

        `const me = Store.driver(state.user.id) || state.user` put the
        photo on the copy whenever the roster row was not there, and
        Store.save() then wrote a company record that never contained it.
        It now goes to drivers.avatar, which is the driver's own row and
        comes back with them on any machine.

     2. THE COMPANY VERSION CLIMBED FOR EVER

        refreshPresence() ended in `if (u || changed) Store.save()`, and u
        is truthy for anybody signed in — so every open tab pushed the
        whole company blob every thirty seconds. Every other tab's poll
        then saw a version it had not seen and replaced its copy, which is
        where the endless "Company pulled from Supabase" came from.
        Nothing had happened.

     3. THE APPLICANT COULD NOT TELL WHERE THEY STOOD

        The tracker drew five timeline rows of equal weight and left the
        driver to find the one marked "Current". It now says "In progress"
        or welcomes them by name.
*/
const { app, BrowserWindow } = require('electron');
const path = require('path');
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-profile'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const steps = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(46) + v);

function check(what, got, want) {
  if (String(got) === String(want)) say(what, String(got));
  else fails.push(what + ': expected ' + want + ', got ' + got);
}

app.whenReady().then(async () => {

  const win = new BrowserWindow({ width: 1280, height: 900, show: false });

  const thrown = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level !== 3) return;
    if (/Electron Security Warning|ERR_|fonts\.|jsdelivr/.test(message)) return;
    thrown.push(message);
  });

  await win.loadURL('file:///' + path.join(ROOT, 'login.html').replace(/\\/g, '/'));

  const js = (code) => win.webContents.executeJavaScript(code, true);

  try {
    await js(FAKE_SUPABASE);
    await js("var s=document.getElementById('splash'); if(s) s.classList.add('gone');");
    await wait(600);

    /* ---- 1. the photo lives on the driver's own row -------------- */

    /* A driver signed in on a browser that has NOT pulled the company, so
       there is no roster row to hang anything on. This is the case the
       old code silently dropped. */
    const photo = await js(`
      (async function () {
        var S = window.gmnSupabase;

        S.__db.drivers.push({
          id: 4101, driver_code: 'GMN4101', auth_user_id: 'auth-4101',
          full_name: 'Photo Driver', email: 'photo@example.test',
          role: 'driver', status: 'active',
        });

        var row = S.__db.drivers[S.__db.drivers.length - 1];

        state.user = Accounts.fromRow(row, { email: row.email });

        /* nothing on the local roster: the case that used to lose it */
        Store.db.drivers = (Store.db.drivers || []).filter(d => d.id !== 'GMN4101');

        var png = 'data:image/jpeg;base64,' + 'A'.repeat(64);
        var stored = await persistAvatar(png);

        /* and read back the way a fresh sign-in reads it */
        var again = Accounts.fromRow(
          S.__db.drivers.find(d => d.driver_code === 'GMN4101'),
          { email: row.email });

        return JSON.stringify({
          stored: !!stored,
          onTheRow: String(S.__db.drivers.find(d => d.driver_code === 'GMN4101').avatar || ''),
          afterSignIn: String(again.avatar || ''),
          drawn: avatar(again, 32).indexOf('avatar-img') !== -1,
        });
      })()
    `);

    const p = JSON.parse(photo);

    check('the photo is written to the driver row', String(p.stored), 'true');
    check('and it is the photo that was chosen', p.onTheRow.slice(0, 22), 'data:image/jpeg;base64');
    check('a fresh sign-in reads it back', p.afterSignIn === p.onTheRow, 'true');
    check('and the avatar draws the picture', String(p.drawn), 'true');

    /* Clearing has to reach the row too, or it comes back next sign-in. */
    const cleared = await js(`
      (async function () {
        var S = window.gmnSupabase;
        await persistAvatar('');
        var row = S.__db.drivers.find(d => d.driver_code === 'GMN4101');
        return JSON.stringify({
          onTheRow: row.avatar === null || row.avatar === undefined || row.avatar === '',
          drawn: avatar(Accounts.fromRow(row, {}), 32).indexOf('avatar-img') !== -1,
        });
      })()
    `);

    const c = JSON.parse(cleared);

    check('removing the photo clears the row', String(c.onTheRow), 'true');
    check('and the initials come back', String(c.drawn), 'false');

    /* ---- 2. a heartbeat is not a change -------------------------- */

    const beat = await js(`
      (function () {
        var saves = 0;
        var realSave = Store.save;
        Store.save = function () { saves++; return realSave.apply(this, arguments); };

        try {
          /* Somebody other than the signed-in driver, because the signed-in
             one is stamped as here on every tick by definition — they can
             never be the driver whose presence moves. */
          var mate = { id: 'GMN-MATE', name: 'Crew Mate', initials: 'CM',
                       status: 'online', lastSeen: new Date().toISOString() };

          Store.db.drivers = (Store.db.drivers || [])
            .filter(function (d) { return d.id !== 'GMN-MATE'; });
          Store.db.drivers.push(mate);

          /* everyone settled, nothing moving */
          state.user = Store.db.drivers[0];
          Store.db.drivers.forEach(function (d) {
            d.lastSeen = new Date().toISOString();
            d.status = 'online';
          });

          lastPresencePush = Date.now();

          var before = saves;
          refreshPresence();
          refreshPresence();
          refreshPresence();
          var idle = saves - before;

          /* and now one of them stops being here */
          mate.lastSeen = new Date(Date.now() - 20 * 60 * 1000).toISOString();

          var mid = saves;
          refreshPresence();
          var moved = saves - mid;

          return JSON.stringify({ idle: idle, moved: moved, mate: mate.status });

        } finally {
          Store.save = realSave;
        }
      })()
    `);

    const b = JSON.parse(beat);

    check('three quiet heartbeats write nothing', String(b.idle), '0');
    check('a driver going quiet is marked offline', b.mate, 'offline');
    check('and that is written at once', String(b.moved), '1');

    /* ---- 3. the applicant is told where they stand --------------- */

    const tracker = await js(`
      (function () {
        var base = {
          id: 'APP-1', name: 'Sam Carter', experience: 'Not stated',
          submitted: new Date().toISOString(), discord: '', messages: [],
          detailed: true,
        };

        var mk = function (status) {
          return applicationTracker(Object.assign({}, base, { status: status }));
        };

        return JSON.stringify({
          pending:   mk('pending').indexOf('In progress') !== -1,
          review:    mk('review').indexOf('In progress') !== -1,
          interview: mk('interview').indexOf('In progress') !== -1,
          approved:  mk('approved').indexOf('Welcome to Gaming Nation, Sam') !== -1,
          approvedIsNotInProgress: mk('approved').indexOf('In progress') === -1,
          rejectedHasNeither: mk('rejected').indexOf('In progress') === -1
                           && mk('rejected').indexOf('Welcome to Gaming Nation') === -1,
          getTheClient: mk('approved').indexOf('#/downloads') !== -1,
        });
      })()
    `);

    const t = JSON.parse(tracker);

    check('a queued application reads In progress', String(t.pending), 'true');
    check('so does one under review', String(t.review), 'true');
    check('and one at interview', String(t.interview), 'true');
    check('an approved one welcomes them by name', String(t.approved), 'true');
    check('and no longer says In progress', String(t.approvedIsNotInProgress), 'true');
    check('an unsuccessful one says neither', String(t.rejectedHasNeither), 'true');
    check('approval offers the client', String(t.getTheClient), 'true');

  } catch (err) {
    fails.push('the walk stopped: ' + (err && err.message ? err.message : err));
  }

  if (thrown.length) thrown.slice(0, 6).forEach((m) => fails.push('console error: ' + m));

  console.log('\nprofile, presence and application status\n' + steps.join('\n'));

  if (fails.length) {
    console.log('\n' + fails.length + ' problem(s)');
    fails.forEach((f) => console.log('  ' + f));
  } else {
    console.log('\nclean');
  }

  app.exit(fails.length ? 1 : 0);
});
