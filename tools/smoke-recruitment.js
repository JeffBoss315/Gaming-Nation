/* The recruitment round trip: what a self-registered driver can do with their
   application, and what the recruiter sees and can send back. */
const { app, BrowserWindow } = require('electron');
const path = require('path');
/* resolved, not taken as given: 'npm run smoke:*' passes '.', and a relative
   root turns require(ROOT + '/desktop-capture') into a bare module name */
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

app.setPath('userData', path.join(app.getPath('temp'), 'hll-probe-driver'));
app.disableHardwareAcceleration();
app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1400, height: 950, show: false });
  await win.loadFile(path.join(ROOT, 'index.html'));
  await new Promise((r) => setTimeout(r, 1600));

  const out = await win.webContents.executeJavaScript(`(async () => {
    const R = { steps: [] };
    const say = (k, v) => R.steps.push(k + ': ' + v);
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    const txt = () => document.querySelector('.page').textContent.replace(/\\s+/g,' ');
    try {
      const email = 'newdriver' + Date.now() + '@example.com';
      const res = await Accounts.register({ name: 'New Driver', email,
        password: 'NewDriver123', country: 'Netherlands', discord: '' });
      say('register', res.error || 'ok');
      const acc = Accounts.all().find(a => a.email === email);
      state.user = Store.driver(acc.driverId);

      /* --- the driver's side --- */
      go('#/recruitment'); render(); await wait(350);
      const btns = () => [...document.querySelectorAll('.page button')].map(b => b.textContent.trim().replace(/\\s+/g,' ')).filter(Boolean);
      say('recruitment buttons', btns().join(' | ') || 'NONE');

      const appn = Store.db.applications.find(a => a.submittedBy === acc.driverId);
      openApplicationEditor(appn.id); await wait(250);
      say('editor opened', document.querySelector('#ae-discord') ? 'yes' : 'NO');
      document.querySelector('#ae-discord').value = 'newdriver#1';
      document.querySelector('#ae-tmp').value = '9988776';
      document.querySelector('#ae-hours').value = '640';
      document.querySelector('#ae-why').value = 'Ten years on the northern runs.';
      saveApplicationDetails(appn.id); await wait(250);
      const a2 = Store.application(appn.id);
      say('application filled in', [a2.detailed, a2.discord, a2.truckersmp, a2.hours].join(' | '));
      say('driver record picked up the handles', state.user.discord + ' / ' + state.user.truckersmp);

      openApplicationMessage(appn.id); await wait(200);
      document.querySelector('#am-text').value = 'When are the assessment drives?';
      sendApplicationMessage(appn.id); await wait(250);
      say('applicant message stored', (Store.application(appn.id).messages || []).length);
      go('#/recruitment'); render(); await wait(300);
      say('message shown to the driver', /assessment drives/.test(txt()) ? 'yes' : 'NO');
      say('recruitment buttons now', btns().join(' | ') || 'NONE');

      /* --- the recruiter's side --- */
      const owner = Accounts.all().find(a => a.email === 'jeffboss730@gmail.com');
      state.user = Store.driver(owner.driverId);
      go('#/dashboard'); render(); await wait(400);
      say('dashboard shows who is waiting', /Waiting on you/.test(txt()) ? 'yes' : 'NO');
      say('applicant named on the dashboard', /New Driver/.test(txt()) ? 'yes' : 'NO');
      say('company-service warning', /not joined up across machines/.test(txt()) ? 'shown' : 'NOT SHOWN');
      const navRec = [...document.querySelectorAll('.nav-item')]
        .find(n => /Recruitment/.test(n.textContent));
      say('recruitment nav badge', navRec ? navRec.textContent.trim().replace(/\\s+/g,' ') : 'NO NAV');

      openApplication(appn.id); await wait(300);
      const modal = document.querySelector('.modal, .sheet, [class*=modal]');
      const mt = (modal ? modal.textContent : '').replace(/\\s+/g,' ');
      say('recruiter sees the message', /assessment drives/.test(mt) ? 'yes' : 'NO');
      say('no null age', /Age null/.test(mt) ? 'STILL THERE' : 'yes');
      say('hours visible', /640/.test(mt) ? 'yes' : 'NO');

      document.querySelector('#app-reply').value = 'Sunday 19:00, details on Discord.';
      replyToApplicant(appn.id); await wait(300);
      const a3 = Store.application(appn.id);
      say('reply stored', (a3.messages || []).filter(m => m.from === 'staff').length);
      say('applicant notified of the reply', Store.db.notifications.some(n =>
        n.driverId === acc.driverId && /replied/i.test(n.title || '')) ? 'yes' : 'NO');

      document.querySelector('#app-note').value = 'Solid history, worth an interview.';
      saveRecruiterNote(appn.id); await wait(300);
      say('internal note kept', (Store.application(appn.id).notes || []).length);

      setAppStage(appn.id, 'interview'); await wait(250);
      say('stage', Store.application(appn.id).status);
      say('applicant notified of the stage', Store.db.notifications.some(n =>
        n.driverId === acc.driverId && /interview/i.test(n.title || '')) ? 'yes' : 'NO');
    } catch (e) { R.crash = e && (e.stack || e.message); }
    return R;
  })()`);
  console.log(JSON.stringify(out, null, 2));
  app.exit(0);
});
