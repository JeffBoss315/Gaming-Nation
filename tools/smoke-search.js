/* The search launcher, driven the way a person drives it.

     npm run smoke:search

   THE BUG THIS EXISTS TO PREVENT

   The topbar box is a launcher, not a field: it blurs itself and hands over
   to the real search. It used to open on FOCUS, and two things focus it
   without anybody asking for it.

     - The browser's autofill. Chrome focuses a field to fill it, and it
       filled this one despite autocomplete="off" — so a driver arrived at a
       box labelled "Search drivers, convoys, fleet…" with their own email
       address typed into it and the search modal open over the page.

     - Closing the search. The browser restores focus to whatever had it
       before, which is this input, whose focus handler opened the search
       again. So picking a result navigated, closed, and reopened the modal
       on top of the page you had just asked for. That one was introduced by
       the fix that made results close the modal at all, which is exactly why
       this file exists.

   Everything here is a behaviour a person would notice, driven through the
   real DOM rather than by calling the functions directly.
*/
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const SEP = String.fromCharCode(92);

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-smoke-search'));
app.disableHardwareAcceleration();
app.on('window-all-closed', () => {});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const fails = [];
const steps = [];
const say = (k, v) => steps.push('  ' + String(k).padEnd(48) + v);

function check(what, got, want) {
  if (String(got) === String(want)) say(what, String(got));
  else fails.push(what + ': expected ' + want + ', got ' + got);
}

app.whenReady().then(async () => {

  const win = new BrowserWindow({ width: 1400, height: 900, show: false });

  const thrown = [];
  win.webContents.on('console-message', (_e, level, message) => {
    if (level !== 3) return;
    if (/Electron Security Warning|ERR_|fonts\.|jsdelivr/.test(message)) return;
    thrown.push(message);
  });

  await win.loadURL('file:///' + path.join(ROOT, 'login.html').split(SEP).join('/'));

  const js = (c) => win.webContents.executeJavaScript(c, true);

  try {
    await js("var s=document.getElementById('splash'); if(s) s.classList.add('gone');");
    await wait(900);

    const out = await js(`(async function () {
      var acc = Accounts.all()[0];
      if (acc) { state.user = Store.driver(acc.driverId); Store.writeSession({ id: acc.driverId }); }
      state.route = { name: 'dashboard', params: [] };
      render();
      await new Promise(function (r) { setTimeout(r, 300); });

      var r = {};
      var gs = document.getElementById('globalSearch');
      r.exists = !!gs;
      r.readonly = !!(gs && gs.readOnly);

      /* focus alone is what autofill does, and it must do nothing */
      if (gs) gs.focus();
      await new Promise(function (x) { setTimeout(x, 250); });
      r.openedOnFocus = !!document.getElementById('cmdInput');
      if (gs) gs.blur();

      /* pressing it is what a person does, and it must open */
      if (gs) gs.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
      await new Promise(function (x) { setTimeout(x, 350); });
      r.openedOnPress = !!document.getElementById('cmdInput');
      r.focused = !!(document.activeElement && document.activeElement.id === 'cmdInput');

      /* asking twice must not stack a second copy nothing can close */
      openSearch();
      await new Promise(function (x) { setTimeout(x, 250); });
      r.copies = document.querySelectorAll('#cmdInput').length;

      /* and typing must actually filter */
      var inp = document.getElementById('cmdInput');
      inp.value = 'zzzzznotathing';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(function (x) { setTimeout(x, 150); });
      r.saysNoMatches = /No matches/.test(document.getElementById('cmdResults').innerHTML);

      inp.value = '';
      inp.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise(function (x) { setTimeout(x, 150); });

      /* the reported flow: pick Settings out of the jump-to list */
      var pick = Array.prototype.slice
        .call(document.querySelectorAll('#cmdResults [data-act="go"]'))
        .filter(function (b) { return /Settings/.test(b.textContent); })[0];
      r.foundSettings = !!pick;
      if (pick) pick.click();

      await new Promise(function (x) { setTimeout(x, 700); });
      r.route = state.route && state.route.name;
      r.closed = !document.getElementById('cmdInput');

      /* and it must not creep back a moment later */
      await new Promise(function (x) { setTimeout(x, 900); });
      r.stayedClosed = !document.getElementById('cmdInput');

      return JSON.stringify(r);
    })()`);

    const r = JSON.parse(out);

    check('the launcher is there', String(r.exists), 'true');
    check('and cannot be typed into, so autofill leaves it alone', String(r.readonly), 'true');
    check('focus alone does not open the search', String(r.openedOnFocus), 'false');
    check('pressing it does', String(r.openedOnPress), 'true');
    check('and the cursor lands in the box', String(r.focused), 'true');
    check('asking twice opens one search, not two', String(r.copies), '1');
    check('a query with no matches says so', String(r.saysNoMatches), 'true');
    check('Settings is offered in the jump-to list', String(r.foundSettings), 'true');
    check('picking it goes to Settings', r.route, 'settings');
    check('and closes the search', String(r.closed), 'true');
    check('and it does not reopen itself', String(r.stayedClosed), 'true');

  } catch (err) {
    fails.push('the walk stopped: ' + (err && err.message ? err.message : err));
  }

  if (thrown.length) thrown.slice(0, 6).forEach((m) => fails.push('console error: ' + m));

  console.log('\nsearch\n' + steps.join('\n'));

  if (fails.length) {
    console.log('\n' + fails.length + ' problem(s)');
    fails.forEach((f) => console.log('  ' + f));
  } else {
    console.log('\nclean');
  }

  app.exit(fails.length ? 1 : 0);
});
