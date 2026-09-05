/* The two web front-ends: the drivers' website and the management console.
   Checks each one shows what it should, refuses what it should not, and that
   an application filed on the drivers' side is announced on the console. */
const { app, BrowserWindow } = require('electron');
const path = require('path');

/* This probe registers a driver, and registration goes through Supabase
   Auth. Without a stand-in it signed up against the LIVE project on every
   run — leaving a real Auth user and a real drivers row in the company
   people are actually using — and then sat waiting on the network until
   the run was killed, which is why it never finished.

   Every other harness that registers somebody already does this; this one
   was simply missed. The two windows below get one stand-in each and share
   nothing through it, which is right: they share a profile, and the company
   they both read travels through localStorage, not through Supabase. */
const { SOURCE: FAKE_SUPABASE } = require('./fake-supabase');
/* resolved, not taken as given: 'npm run smoke:*' passes '.', and a relative
   root turns require(ROOT + '/desktop-capture') into a bare module name */
const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));

app.setPath('userData', path.join(app.getPath('temp'), 'hll-smoke-sites'));
app.disableHardwareAcceleration();
/* closing the first window would otherwise quit before the second loads */
app.on('window-all-closed', () => {});

const open = async (page) => {
  const win = new BrowserWindow({ width: 1400, height: 950, show: false });
  await win.loadFile(path.join(ROOT, page));
  /* before anything registers anybody */
  await win.webContents.executeJavaScript(FAKE_SUPABASE);
  await new Promise((r) => setTimeout(r, 1500));
  return win;
};

app.whenReady().then(async () => {
  const R = { steps: [] };
  const say = (k, v) => R.steps.push(k + ': ' + v);

  /* ---- the drivers' website ---- */
  const drivers = await open('login.html');
  const a = await drivers.webContents.executeJavaScript(`(async () => {
    const out = {};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    out.site = SITE;
    out.strayText = [...document.body.childNodes]
      .filter(n => n.nodeType === 3 && n.textContent.trim())
      .map(n => n.textContent.trim()).join(' ');

    const email = 'sitedriver' + Date.now() + '@example.com';
    /* register(account, password, country) — three arguments. Passing one
       object left password undefined, so the sign-up was refused with
       "Signup requires a valid password" and the rejection, unhandled,
       hung the run instead of failing it. */
    await Accounts.register(
      { name: 'Site Driver', email, discord: '' },
      'SiteDriver123',
      'Netherlands'
    );
    const acc = Accounts.all().find(x => x.email === email);
    out.applicantId = acc.driverId;

    /* signed in as the plain driver */
    state.user = Store.driver(acc.driverId);
    go('#/dashboard'); render(); await wait(350);
    out.driverNav = [...document.querySelectorAll('.nav-item')].map(n => n.textContent.trim().replace(/\\s+/g,' ')).join(' | ');
    out.driverSeesConsoleLink = !!document.querySelector('[data-act="site-admin"]');
    go('#/admin'); render(); await wait(300);
    out.driverOnAdminRoute = document.querySelector('.page').textContent.replace(/\\s+/g,' ').slice(0, 90);

    /* signed in as the owner */
    const owner = Accounts.all().find(x => x.email === 'jeffboss730@gmail.com');
    state.user = Store.driver(owner.driverId);
    go('#/dashboard'); render(); await wait(350);
    out.ownerNav = [...document.querySelectorAll('.nav-item')].map(n => n.textContent.trim().replace(/\\s+/g,' ')).join(' | ');
    out.ownerSeesConsoleLink = !!document.querySelector('[data-act="site-admin"]');
    out.consoleLinkCount = (document.querySelector('[data-act="site-admin"]') || {}).textContent || '';
    return out;
  })()`);

  say('drivers page reports', a.site);
  say('stray text at top of page', a.strayText ? 'STILL THERE: ' + a.strayText : 'none');
  say('driver nav (no console)', a.driverNav);
  say('driver offered the console', a.driverSeesConsoleLink ? 'YES — WRONG' : 'no');
  say('driver opening #/admin', a.driverOnAdminRoute);
  say('owner nav', a.ownerNav);
  say('owner offered the console', a.ownerSeesConsoleLink ? 'yes' : 'NO');
  say('console link shows what is waiting', a.consoleLinkCount.replace(/\s+/g, ' ').trim());

  /* ---- the management console (same profile, so the same company) ---- */
  const admin = await open('admin.html');
  const b = await admin.webContents.executeJavaScript(`(async () => {
    const out = {};
    const wait = (ms) => new Promise((r) => setTimeout(r, ms));
    out.site = SITE;
    out.palette = getComputedStyle(document.body).getPropertyValue('--accent').trim();

    /* a plain driver who opens the console */
    const applicant = Store.driver('${a.applicantId}');
    state.user = applicant;
    render(); await wait(350);
    out.driverOnConsole = document.querySelector('#view').textContent.replace(/\\s+/g,' ').slice(0, 80);

    /* the owner */
    const owner = Accounts.all().find(x => x.email === 'jeffboss730@gmail.com');
    state.user = Store.driver(owner.driverId);
    location.hash = ''; state.route = parseHash(); render(); await wait(400);
    out.landsOn = state.route.name;
    out.adminNav = [...document.querySelectorAll('.nav-item')].map(n => n.textContent.trim().replace(/\\s+/g,' ')).join(' | ');
    const page = document.querySelector('#view').textContent.replace(/\\s+/g,' ');
    out.announcesApplication = /drivers? (has|have) applied/i.test(page);
    out.inboxText = (page.match(/Waiting on you.{0,120}/i) || [''])[0];
    out.backToDrivers = !!document.querySelector('[data-act="site-drivers"]');

    /* the recruitment tab lists it, with no null age */
    state.ui.adminTab = 'recruitment'; render(); await wait(300);
    const rec = document.querySelector('#view').textContent.replace(/\\s+/g,' ');
    out.recruitmentListsIt = /Site Driver/.test(rec);
    out.nullAge = /age null/i.test(rec);

    /* every console tab draws */
    out.tabs = {};
    const tabs = [...document.querySelectorAll('[data-act="admin-tab"]')].map(b => b.dataset.tab);
    for (const t of tabs) {
      state.ui.adminTab = t; render(); await wait(150);
      const body = document.querySelector('#view').textContent;
      out.tabs[t] = body.includes('Something went wrong') ? 'ERROR SCREEN'
        : (document.querySelector('.page') ? 'ok' : 'EMPTY');
    }

    /* and every page the console links to */
    out.routes = {};
    for (const r of ['drivers','fleet','convoys','events','community','livemap','rankings',
                     'support','notifications','settings','dashboard','recruitment']) {
      go('#/' + r); render(); await wait(170);
      const body = document.querySelector('#view').textContent;
      out.routes[r] = body.includes('Something went wrong') ? 'ERROR SCREEN'
        : (document.querySelector('.page') ? 'ok' : 'EMPTY');
    }
    return out;
  })()`);

  say('console page reports', b.site);
  say('console accent', b.palette);
  say('driver opening the console', b.driverOnConsole);
  say('owner lands on', b.landsOn);
  say('console nav', b.adminNav);
  say('console announces the application', b.announcesApplication ? 'yes' : 'NO');
  say('inbox text', b.inboxText.trim());
  say('way back to the drivers site', b.backToDrivers ? 'yes' : 'NO');
  say('recruitment tab lists the applicant', b.recruitmentListsIt ? 'yes' : 'NO');
  say('age null', b.nullAge ? 'STILL THERE' : 'gone');
  Object.entries(b.tabs).forEach(([k, v]) => say('console tab/' + k, v));
  Object.entries(b.routes).forEach(([k, v]) => say('console route/' + k, v));

  drivers.destroy();
  console.log(JSON.stringify(R, null, 2));
  app.exit(0);
});
