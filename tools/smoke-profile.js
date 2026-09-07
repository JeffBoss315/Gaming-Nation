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

    /* ---- 4. the apply form actually files something -------------

       It did not. The handler built the application object, told the
       driver it had been sent, and stored it nowhere — a `return true`
       left over from an edit sat in the middle of the function, so the
       second success modal was unreachable and render() never ran. A
       driver who reached this form was told they had applied and no
       recruiter ever saw them. */
    const filed = await js(`
      (async function () {
        var S = window.gmnSupabase;

        /* a signed-in driver with no application, which is the only state
           in which this form is shown at all */
        state.user = Store.db.drivers[0];
        state.user.role = 'driver';
        Store.db.applications = [];
        S.__db.applications = [];
        state.ui.applyDraft = {};
        state.route = { name: 'recruitment', params: [] };

        render();

        var af = document.getElementById('applyForm');
        if (!af) return JSON.stringify({ noForm: true });

        af.querySelector('[name="name"]').value = 'Ada Lovelace';
        af.querySelector('[name="email"]').value = 'ada@example.test';
        af.querySelector('[name="discord"]').value = 'ada';
        af.querySelector('[name="why"]').value = 'I have driven for years.';

        var country = af.querySelector('[name="country"]');
        country.selectedIndex = 1;               /* the first real country */

        document.getElementById('ap-agree').checked = true;

        af.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        await new Promise(function (r) { setTimeout(r, 500); });

        var local = (Store.db.applications || [])[0];
        var remote = (S.__db.applications || [])[0];

        return JSON.stringify({
          noForm: false,
          localCount: (Store.db.applications || []).length,
          remoteCount: (S.__db.applications || []).length,
          name: local ? local.name : null,
          mine: local ? local.submittedBy === state.user.id : false,
          keyed: remote ? remote.driver_id === state.user.id : false,
          linked: local ? local.supabaseId != null : false,
          thanked: document.body.innerText.indexOf('Thank you, Ada') !== -1,
        });
      })()
    `);

    const f = JSON.parse(filed);

    if (f.noForm) {
      fails.push('the apply form was not shown, so nothing could be tested');
    } else {
      check('applying files the application here', String(f.localCount), '1');
      check('under the name they gave', f.name, 'Ada Lovelace');
      check('and against the driver who filed it', String(f.mine), 'true');
      check('it reaches the shared table too', String(f.remoteCount), '1');
      check('keyed on the driver code', String(f.keyed), 'true');
      check('and the local copy knows its row', String(f.linked), 'true');
      check('the applicant is thanked by name', String(f.thanked), 'true');
    }

    /* ---- 5. approving does not mint a second driver ------------

       approveApplication() resolved the applicant from a.submittedBy alone.
       An application whose driver_id never made it has none — so approving
       it minted a BRAND NEW driver code for somebody already on the roster,
       named that record after the application, and released the client to
       it. Nobody can sign in as that record. The real driver went on being
       told they were waiting on an application that had been approved.

       This is where "GMN DRIVER APPLICATION" came from as a driver name. */
    const approve = await js(`
      (async function () {
        var S = window.gmnSupabase;

        /* A driver on the roster, and an application for them that was
           never linked to their code.

           The stray row is cleared too: a run against the broken code
           creates one and localStorage keeps it, so the next run would
           start already holding the thing it is checking for and fail
           whatever the code does. */
        Store.db.drivers = (Store.db.drivers || []).filter(function (d) {
          return d.id !== 'GMN7001' && d.name !== 'GMN DRIVER APPLICATION';
        });

        Store.db.drivers.push({
          id: 'GMN7001', name: 'Real Driver', initials: 'RD',
          email: 'real@example.test', country: 'Kenya', role: 'driver',
          status: 'offline', accountStatus: 'active', clientAccess: false,
          km: 0, deliveries: 0, convoys: 0, attendance: 100,
          achievements: [], rankIdx: 0, supabaseId: 7001,
          joined: new Date().toISOString(), lastSeen: new Date().toISOString()
        });

        S.__db.applications = [{
          id: 9001, driver_id: null, full_name: 'GMN DRIVER APPLICATION',
          email: 'real@example.test', country: 'Kenya', status: 'pending'
        }];

        Store.db.applications = [{
          id: 'APP-9001', supabaseId: 9001, name: 'GMN DRIVER APPLICATION',
          email: 'real@example.test', country: 'Kenya', status: 'pending',
          submitted: new Date().toISOString(), submittedBy: null,
          notes: [], messages: []
        }];

        var before = Store.db.drivers.length;

        /* confirmDialog puts a button in front of a recruiter; what this
           tests is what happens when they press it */
        var realConfirm = window.confirmDialog;
        window.confirmDialog = function (t, b, yes) { yes(); };
        try { approveApplication('APP-9001'); }
        finally { window.confirmDialog = realConfirm; }

        await new Promise(function (r) { setTimeout(r, 600); });

        var mine = Store.db.drivers.find(function (d) { return d.id === 'GMN7001'; });

        return JSON.stringify({
          added: Store.db.drivers.length - before,
          released: !!(mine && mine.clientAccess),
          linkedHere: Store.db.applications[0].submittedBy,
          linkedThere: S.__db.applications[0].driver_id,
          noStrayRoster: !Store.db.drivers.some(function (d) {
            return d.name === 'GMN DRIVER APPLICATION';
          })
        });
      })()
    `);

    const ap = JSON.parse(approve);

    check('approving mints no second driver', String(ap.added), '0');
    check('and no roster row named after the form', String(ap.noStrayRoster), 'true');
    check('the client goes to the real driver', String(ap.released), 'true');
    check('the application is linked here', ap.linkedHere, 'GMN7001');
    check('and in the shared table', ap.linkedThere, 'GMN7001');

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
