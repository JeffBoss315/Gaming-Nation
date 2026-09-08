/* ============================================================
   Smoke test — an empty answer is not a deletion.

     npm run smoke:apploss

   Applications.pull() treats the rows Supabase returns as the whole
   truth and removes anything absent from them. That is right for a
   real answer and catastrophic for an empty one, because Supabase
   returns data [] with error NULL when row-level security refuses
   the read — an expired session, a role that lost its grant, a policy
   edited in the dashboard. All of those look exactly like an empty
   table from the client, and none of them raise an error.

   Read as authority to delete, that answer destroyed three real
   applications on a console that had merely stopped being allowed to
   see them, and Store.save() made it permanent:

     Applications pulled from Supabase:
     {rows: 0, previous: 3, current: 0, notYetInSupabase: 0}

   Nothing else in the platform ever removes an application, so that
   was the only way one could disappear, and it disappeared silently.

   Two checks, and the second is the one that keeps the first honest:
   an empty answer must change nothing, AND a real answer that is
   missing a row must still delete that row. Refusing every deletion
   would pass the first check and be a different bug.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-probe-apploss'));
app.disableHardwareAcceleration();

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1200, height: 900, show: false });
  await win.loadFile(path.join(ROOT, 'login.html'));
  await win.webContents.executeJavaScript(FAKE_SUPABASE);
  await new Promise((r) => setTimeout(r, 1600));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const R = { steps: [], problems: 0 };
    const check = (name, ok, detail) => {
      R.steps.push((ok ? '  ' : '! ') + name.padEnd(50)
        + (detail === undefined ? '' : detail));
      if (!ok) R.problems++;
    };

    try {
      /* Three applications that Supabase is known to have: they carry a
         supabaseId, which is exactly what marked them as safe to delete. */
      Store.db.applications = [
        { id: 'APP-1', supabaseId: 'aaa', status: 'pending', name: 'Ana' },
        { id: 'APP-2', supabaseId: 'bbb', status: 'pending', name: 'Bo' },
        { id: 'APP-3', supabaseId: 'ccc', status: 'pending', name: 'Cy' },
      ];
      Store.save();

      /* Stand in for the query itself, so the answer is exactly the shape
         a blocked read gives back: no rows, and no error at all. */
      const realFrom = window.gmnSupabase.from.bind(window.gmnSupabase);
      let answer = [];
      window.gmnSupabase.from = (table) => {
        if (table !== 'applications') return realFrom(table);
        const q = {
          select: () => q,
          order: () => Promise.resolve({ data: answer, error: null }),
        };
        return q;
      };
      Applications.on = () => true;
      const realSignedIn = Sync.signedIn;
      Sync.signedIn = async () => true;

      /* ---- 1. the empty answer ---- */
      answer = [];
      Applications.busy = false;
      await Applications.pull();
      const afterEmpty = (Store.db.applications || []).length;
      check('an empty answer leaves the applications alone',
        afterEmpty === 3, afterEmpty + ' of 3 still here');

      /* and it must not have been written away either */
      const saved = JSON.parse(localStorage.getItem(LS_DB) || '{}');
      const persisted = ((saved.applications) || []).length;
      check('and nothing was saved over them',
        persisted === 3, persisted + ' of 3 in storage');

      /* ---- 2. the control: a real answer still deletes ---- */
      answer = [
        { id: 'aaa', status: 'pending', name: 'Ana', created_at: '2026-01-01' },
        { id: 'bbb', status: 'pending', name: 'Bo', created_at: '2026-01-02' },
      ];
      Applications.busy = false;
      await Applications.pull();
      const ids = (Store.db.applications || []).map((a) => a.supabaseId).filter(Boolean);
      check('but a real answer missing a row still removes it',
        ids.length === 2 && ids.indexOf('ccc') < 0,
        ids.length + ' left: ' + (ids.join(', ') || 'none'));

      Sync.signedIn = realSignedIn;
      window.gmnSupabase.from = realFrom;
    } catch (e) {
      R.crash = e && (e.stack || e.message);
      R.problems++;
    }
    return R;
  })()`);

  console.log('\nan empty answer is not a deletion');
  console.log((out.steps || []).join('\n'));
  if (out.crash) console.log('\nCRASH: ' + out.crash);
  console.log(out.problems ? '\n' + out.problems + ' problem(s)' : '\nclean');
  app.exit(out.problems ? 1 : 0);
});
