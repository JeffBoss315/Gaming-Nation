/* ============================================================
   Smoke test — the driver's profile photo.

     npm run smoke:avatar

   Reported twice, in the same words both times: "the profile pic
   disappears". It had two causes and they are different problems.

     1. There was nowhere durable to put it. drivers.avatar is added
        by supabase/migrations/20260907_driver_avatar.sql, and on a
        project that has not run it the write is refused, caught and
        logged — so the photo lived only on the machine that took it
        and vanished the moment the record was rebuilt from the
        database, which happens on every sign-in.

     2. It could only be set from Settings, after the fact. A driver
        filling in who they are at registration was never offered
        one, so most never had one at all.

   What has to be true:

     - a photo chosen on the registration form is held against the
       address until there is a driver record to hang it on, because
       with email confirmation on there is no record for some minutes
     - it reaches the roster row, this browser's own copy, and the
       driver's row in the database
     - it survives the record being rebuilt from a database row,
       which is what a sign-in and a company pull both do
     - on a project with NO avatar column it still shows, from this
       machine's copy, and the missing column is noticed rather than
       failing silently
     - clearing it clears every copy, or it comes back on the next
       render
   ============================================================ */
const { app, BrowserWindow } = require('electron');
const path = require('path');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const { SOURCE: FAKE_SUPABASE } = require(path.join(ROOT, 'tools', 'fake-supabase'));

app.setPath('userData', path.join(app.getPath('temp'), 'gmn-avatar-smoke'));
app.disableHardwareAcceleration();

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* A real 2x2 PNG. readAvatarFile() decodes and re-encodes what it is
   given, so a made-up blob would fail for the wrong reason. */
const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFElEQVR4nGP8z8DwnwEJMKFyBycHAO7bAv/rZ0OUAAAAAElFTkSuQmCC';

const RUN = `(async () => {
  const R = { steps: [] };
  const say = (k, got, want) => R.steps.push({ k, got: String(got), want: String(want) });

  try {
    const email = 'photo' + Date.now() + '@example.com';

    const bytes = Uint8Array.from(atob('${PNG}'), (c) => c.charCodeAt(0));
    const file = new File([bytes], 'me.png', { type: 'image/png' });

    const data = await readAvatarFile(file);
    say('the image is accepted and re-encoded', data.startsWith('data:image/'), true);

    /* ---- what the registration form does ---- */
    state.ui.regDraft = { name: 'Photo Tester', email, country: 'Kenya',
      discord: '', agree: true, avatar: data };
    keepRegisterDraft();

    say('it is held against the address', pendingAvatarFor(email) === data, true);
    say('and not against any other', pendingAvatarFor('someone@else.com'), '');

    const html = registerFormHTML();
    say('the form draws what was picked', /<img class="avatar-img"/.test(html), true);
    say('and offers to remove it', /reg-photo-clear/.test(html), true);

    /* ---- registering carries it through ---- */
    const res = await Accounts.register(
      { name: 'Photo Tester', email, discord: '',
        created: new Date().toISOString(), avatar: data },
      'PhotoTest123', 'Kenya');

    const code = res && res.driver && res.driver.driver_code;
    say('an account was created', !!code, true);

    say('the roster row carries the photo', (Store.driver(code) || {}).avatar === data, true);
    say('this browser keeps its own copy', rememberedAvatar(code) === data, true);

    const row = (window.gmnSupabase.__db.drivers || []).find((d) => d.driver_code === code);
    say('the driver row in the database carries it', !!row && row.avatar === data, true);
    say('the pending copy is spent', pendingAvatarFor(email), '');

    /* ---- and survives the record being rebuilt ---- */
    const rebuilt = Accounts.fromRow(row, { id: row.auth_user_id, email });
    say('a record rebuilt from the database still has it', rebuilt.avatar === data, true);
    say('and it draws as an image', /<img class="avatar-img"/.test(avatar(rebuilt, 96)), true);

    /* ---- a project that has not run the migration ---- */
    const stripped = Object.assign({}, row);
    delete stripped.avatar;
    avatarColumnMissing = false;
    const noColumn = Accounts.fromRow(stripped, { id: row.auth_user_id, email });
    say('with no avatar column it falls back to this machine',
      noColumn.avatar === data, true);
    say('and the missing column is noticed', avatarColumnMissing, true);

    /* ---- what may be used as a photo ----

       The gate used to be data: URLs and nothing else, so a drivers.avatar
       holding an ordinary address was thrown away and the driver silently
       fell back to initials. It has to accept a real URL and still refuse
       anything that is not an image reference, because the value comes out
       of a row a driver can write and goes into an src attribute. */
    say('a data URL is a photo', avatarSrc(data) === data, true);
    say('an https URL is a photo',
      avatarSrc('https://gaming-nation.pages.dev/icons/mark.png')
        === 'https://gaming-nation.pages.dev/icons/mark.png', true);
    say('a shipped path is a photo', avatarSrc('icons/mark.png'), 'icons/mark.png');
    say('javascript: is refused', avatarSrc('javascript:alert(1)'), '');
    say('a data URL that is not an image is refused',
      avatarSrc('data:text/html,<script>x</script>'), '');
    say('nothing is refused', avatarSrc(null), '');

    /* a photo that will not load falls back rather than showing a broken
       image, and the handler clears itself so a missing fallback cannot
       loop for as long as the element exists */
    const withUrl = Object.assign({}, rebuilt, { avatar: 'https://example.invalid/x.png' });
    const drawn = avatar(withUrl, 96);
    say('a URL photo is drawn', /src="https:\\/\\/example\\.invalid\\/x\\.png"/.test(drawn), true);
    say('and carries a fallback', /onerror=/.test(drawn) && /icons\\/mark\\.png/.test(drawn), true);
    say('which cannot loop', /this\\.onerror=null/.test(drawn), true);
    say('and it is labelled with the name', /alt="Photo Tester"/.test(drawn), true);

    /* ---- clearing means clearing ---- */
    await saveAvatarFor(code, '');
    say('clearing empties the roster row', (Store.driver(code) || {}).avatar || '', '');
    say('and this machine\\'s copy', rememberedAvatar(code), '');

  } catch (e) {
    R.crash = e && (e.stack || e.message);
  }
  return R;
})()`;

app.whenReady().then(async () => {
  const win = new BrowserWindow({ width: 1300, height: 950, show: false });

  await win.loadFile(path.join(ROOT, 'login.html'));
  await win.webContents.executeJavaScript(FAKE_SUPABASE);
  await wait(1800);

  const out = await win.webContents.executeJavaScript(RUN);

  console.log('\nthe driver\'s profile photo\n');

  let failures = 0;
  for (const s of out.steps) {
    const ok = s.got === s.want;
    if (!ok) failures++;
    console.log('  ' + (ok ? '✓' : '✗') + '  ' + s.k.padEnd(48)
      + (s.got === '' ? '(empty)' : s.got)
      + (ok ? '' : '   (expected ' + (s.want === '' ? '(empty)' : s.want) + ')'));
  }

  if (out.crash) { failures++; console.log('\n  crashed: ' + out.crash); }

  console.log(failures ? '\n' + failures + ' failure(s)\n' : '\nall passed\n');
  app.exit(failures ? 1 : 0);
});
