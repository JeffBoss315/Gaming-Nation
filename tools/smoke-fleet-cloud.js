/* ============================================================
   The crew map with no company service behind it.

     npm run smoke:fleetcloud

   A driver who has not set up fleet-server.js used to see "No fleet
   service connected" and an empty map — the client's whole crew half
   switched off by default. FleetCloud puts it on Supabase instead:
   this client writes its own position into driver_locations, and
   reads everybody's back out of the fleet_positions view.

   That is code talking to a live database about where people are, so
   it is worth a test that does not need one. Supabase is stubbed here.
   What is checked is the part that would be embarrassing to get wrong:
   that a position is written with the columns that table actually has
   and keyed the way the console reads it, that the view's rows become
   crew the map can draw, that this driver is marked as themselves, that
   positions are not written on every tick, and that a database without
   the view says so rather than pretending the road is empty.
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-fleet-cloud'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

const steps = [];
const fails = [];
const check = (what, got, want) => {
  if (String(got) === String(want)) steps.push('  ' + String(what).padEnd(52) + got);
  else fails.push(what + ': expected ' + want + ', got ' + got);
};

/* Supabase, reduced to the two calls FleetCloud makes. `__mode` switches
   the view between answering and not existing. */
const STUB = `(() => {
  const acc = Auth.accounts()[0];
  Auth.signIn(acc, Auth.driverRecord(acc.driverId), false);
  const s = document.getElementById('splash'); if (s) s.remove();

  window.__inserts = [];
  window.__mode = 'ok';
  window.gmnSupabase = {
    auth: { getSession: async () => ({ data: { session: { access_token: 't' } } }) },
    from(table) {
      return {
        insert: async (row) => { window.__inserts.push({ table, row }); return { error: null }; },
        select() { return this; },
        order() { return this; },
        limit: async () => {
          if (window.__mode === 'missing') {
            return { data: null,
              error: { message: 'relation "public.fleet_positions" does not exist' } };
          }
          const now = new Date().toISOString();
          return { data: [
            { driver_id: 7, driver_code: Store.db.driver.gmnId, full_name: 'Jeff Boss',
              latitude: 52.1, longitude: 5.1, speed: 84, heading: 0.25, updated_at: now },
            { driver_id: 9, driver_code: 'GMN-014', full_name: 'Sam Driver',
              latitude: 51.2, longitude: 4.4, speed: 61, heading: 0.5, updated_at: now },
          ], error: null };
        },
      };
    },
  };
  return true;
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1200, height: 800, show: false,
    webPreferences: { partition: 'smoke-fleet-cloud-' + Date.now() } });

  try {
    await win.loadFile(path.join(ROOT, 'tracker.html'));
    await wait(3500);
    const js = (code) => win.webContents.executeJavaScript(code);

    await js(STUB);

    check('with no driver id, the crew path stays off', await js('FleetCloud.available()'), 'false');

    await js(`(() => {
      Store.db.driver.supabaseId = 7;
      Store.db.settings.fleetUrl = '';
      Store.db.settings.shareLocation = true;
      Store.db.live = { game: 'ets2', world: { x: 100, z: 200 }, geo: [52.1, 5.1],
        heading: 0.25, speed: 84, at: new Date().toISOString() };
      Store.db.activityState = 'driving';
      return true;
    })()`);

    check('with one, it is on', await js('FleetCloud.available()'), 'true');
    check('and the fleet reads as enabled without a service', await js('Fleet.enabled()'), 'true');

    await js('FleetCloud.step()');
    await wait(400);

    const ins = JSON.parse(await js('JSON.stringify(window.__inserts)'));
    check('one position is written', ins.length, 1);
    check('into driver_locations', ins[0] && ins[0].table, 'driver_locations');
    check('keyed by the numeric id the console reads', ins[0] && ins[0].row.driver_id, 7);
    check('with the columns that table has',
      ins[0] && Object.keys(ins[0].row).sort().join(','),
      'driver_id,heading,latitude,longitude,speed');

    const crew = JSON.parse(await js(`JSON.stringify(Fleet.drivers.map(d => ({
      id: d.id, name: d.name, lat: d.lat, self: !!d.self })))`));
    check('the crew comes back', crew.length, 2);
    check('this driver is marked as themselves', crew.filter((d) => d.self).length, 1);
    check('the others have names', crew.some((d) => d.name === 'Sam Driver'), 'true');
    check('and positions the map can draw', typeof (crew[0] || {}).lat, 'number');
    check('the fleet is online', await js('Fleet.online'), 'true');

    /* A position every tick would be tens of thousands of rows a day. */
    await js('FleetCloud.step()');
    await wait(300);
    check('a second pass writes nothing', JSON.parse(await js('window.__inserts.length')), 1);

    await js(`(() => { window.__mode = 'missing'; Fleet.online = false; return true; })()`);
    await js('FleetCloud.step()');
    await wait(300);
    check('a database without the view says so',
      await js('Fleet.lastError'), 'the crew map is not set up in the database yet');
    check('and shows nobody rather than a false empty road',
      await js('Fleet.drivers.length'), 0);

    /* Location sharing is the driver's decision and outranks all of it. */
    await js(`(() => {
      window.__mode = 'ok';
      window.__inserts = [];
      FleetCloud.lastPush = 0;
      Store.db.settings.shareLocation = false;
      return true;
    })()`);
    await js('FleetCloud.step()');
    await wait(300);
    check('sharing off means no position leaves the machine',
      JSON.parse(await js('window.__inserts.length')), 0);

  } catch (err) {
    fails.push('the walk stopped: ' + (err && err.message ? err.message : err));
  }

  console.log('\ncrew map without a service\n' + steps.join('\n'));
  if (fails.length) {
    console.log('\n' + fails.length + ' problem(s)');
    fails.forEach((f) => console.log('  ' + f));
    app.exit(1);
    return;
  }
  console.log('\nclean\n');
  app.exit(0);
});
