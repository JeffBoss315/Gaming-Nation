/* ============================================================
   Smoke test — runs and deliveries reach the crew's Discord.

     npm run smoke:discord

   The service posts fleet events to a Discord webhook. Three things
   about that are worth pinning down, and only one of them is "does
   it post":

     It posts the events worth a person's attention, and NOT the
     ones that would make people mute the channel. session.start and
     session.end fire every time anybody opens or closes the game.

     A webhook URL is a credential. It must never reach a log, a
     client, or the source. Whoever holds it can post into that
     channel as this app for as long as it exists.

     Discord being slow or down must not become a failed delivery
     report. The driver's client is waiting on that request.

   The webhook here points at a local stub, so this never posts to
   the real channel however often it runs.
   ============================================================ */
const http = require('http');
const path = require('path');
const { spawn } = require('child_process');

const ROOT = path.resolve(process.argv[2] || path.join(__dirname, '..'));
const HOOK_PORT = 7186;
const FLEET_PORT = 7187;

const steps = [];
let problems = 0;
const check = (name, ok, detail) => {
  steps.push((ok ? '  ' : '! ') + name.padEnd(52) + (detail === undefined ? '' : detail));
  if (!ok) problems++;
};

const posted = [];
let stubMode = 204;

const stub = http.createServer((req, res) => {
  /* Buffers, not a string: a multipart post carries PNG bytes and
     concatenating those onto a string mangles them, which would make this
     stub disagree with what Discord actually receives. */
  const chunks = [];
  req.on('data', (c) => chunks.push(c));
  req.on('end', () => {
    const raw = Buffer.concat(chunks);
    const body = raw.toString('utf8');
    posted.push({ path: req.url, body, raw, type: req.headers['content-type'] || '' });
    if (stubMode === 'hang') return;                 /* never answers */
    res.writeHead(stubMode); res.end();
  });
});

const post = (kind, extra) => new Promise((resolve) => {
  const payload = JSON.stringify(Object.assign({ kind, driver: 'Ana Vos',
    driverId: 'GMN-1001', text: kind + ' happened', from: 'Hannover', to: 'Bremen',
    cargo: 'Cut Flowers', km: 214, income: 4200, top: 124, game: 'ets2',
    fromCountry: 'DE', toCountry: 'FR',
    avatar: 'https://cdn.gaming-nation.test/a/ana.png' }, extra || {}));
  const r = http.request({ host: '127.0.0.1', port: FLEET_PORT, method: 'POST',
    path: '/api/fleet/event',
    headers: { 'content-type': 'application/json',
               'content-length': Buffer.byteLength(payload) } },
    (res) => { res.resume(); res.on('end', () => resolve(res.statusCode)); });
  r.on('error', () => resolve(0));
  r.end(payload);
});

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/* The card, however it arrived: plain JSON, or the payload_json part of a
   multipart post carrying the driver's picture. */
const CRLF = String.fromCharCode(13) + String.fromCharCode(10);
const cardOf = (p) => {
  if (p.type.indexOf('multipart/form-data') === -1) return JSON.parse(p.body);
  const at = p.body.indexOf('name="payload_json"');
  const start = p.body.indexOf('{', at);
  const end = p.body.indexOf(CRLF + '--', start);
  return JSON.parse(p.body.slice(start, end));
};

(async () => {
  const log = [];
  let fleet;
  try {
    await new Promise((r) => stub.listen(HOOK_PORT, '127.0.0.1', r));
    const WEBHOOK = 'http://127.0.0.1:' + HOOK_PORT + '/webhooks/test/SECRET-TOKEN-VALUE';

    fleet = spawn(process.execPath, [path.join(ROOT, 'fleet-server.js')], {
      cwd: ROOT,
      env: Object.assign({}, process.env, {
        GMN_PORT: String(FLEET_PORT),
        GMN_DISCORD_WEBHOOK: WEBHOOK,
        GMN_COMPANY_FILE: path.join(ROOT, '.smoke-discord-company.json'),
        GMN_SESSION_FILE: path.join(ROOT, '.smoke-discord-sessions.json'),
      }),
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    fleet.stdout.on('data', (d) => log.push(String(d)));
    fleet.stderr.on('data', (d) => log.push(String(d)));
    await wait(2500);

    /* ---- the events a person wants ---- */
    const code = await post('job.delivered');
    await wait(700);
    check('a delivery reaches Discord', posted.length === 1,
      posted.length + ' post(s)');
    check('and the driver is not made to wait for it', code === 200,
      'the client got HTTP ' + code);

    if (posted.length) {
      let embed = null;
      try { embed = cardOf(posted[0]).embeds[0]; } catch (e) { /* checked below */ }

      /* The route reads as the headline, the way a delivery is read: where
         it went, how far, where it ended. */
      check('the route and distance are the headline',
        !!embed && /Hannover.*214 km.*Bremen/.test(embed.title || ''),
        embed ? embed.title : 'UNPARSEABLE');

      check('the driver is named above it, with their code',
        !!embed && embed.author && embed.author.name === 'Ana Vos · GMN-1001',
        (embed && embed.author && embed.author.name) || 'NOBODY');
      check('and their face, when it is one Discord can fetch',
        !!embed && embed.author
          && embed.author.icon_url === 'https://cdn.gaming-nation.test/a/ana.png',
        (embed && embed.author && embed.author.icon_url) || 'NO ICON');

      /* exactly the three numbers worth comparing between runs */
      const names = ((embed && embed.fields) || []).map((f) => f.name);
      check('and the three numbers sit under it',
        names.length === 3 && ['Distance', 'Top speed', 'Income'].every((n) => names.includes(n)),
        names.join(', ') || 'no fields');

      const val = (n) => (((embed && embed.fields) || [])
        .find((f) => f.name === n) || {}).value;
      check('distance to one decimal, like the reference', val('Distance') === '214.0 km',
        val('Distance'));
      check('income grouped so the size reads at a glance',
        val('Income') === '€4,200', val('Income'));
      /* Flags come from the country code the client sends, because the
         service has no city table. A missing code must leave the name
         bare rather than showing something wrong. */
      check('the route carries both flags',
        !!embed && /\u{1F1E9}\u{1F1EA}/u.test(embed.title || '')
                && /\u{1F1EB}\u{1F1F7}/u.test(embed.title || ''),
        embed ? embed.title : 'UNPARSEABLE');

      check('and the load carries a mark of its own',
        !!embed && /\u{1F490}/u.test(embed.description || ''),
        (embed && embed.description) || 'no description');

      check('and it says which game it came from',
        !!embed && /Euro Truck Simulator 2/.test((embed.footer || {}).text || ''),
        (embed && embed.footer && embed.footer.text) || 'no footer');
    }

    /* An unknown country must show no flag, not a wrong one - that is the
       whole reason the client sends a code it is sure of or nothing. */
    posted.length = 0;
    await post('job.delivered', { fromCountry: null, toCountry: null, cargo: 'Steel Coils' });
    await wait(600);
    if (posted.length) {
      const e2 = cardOf(posted[0]).embeds[0];
      check('no country means no flag, not a guess',
        !/[\u{1F1E6}-\u{1F1FF}]/u.test(e2.title || ''), e2.title);
      check('and an unlisted load still gets a mark',
        /\u{1F3D7}/u.test(e2.description || ''), e2.description);
    }

    /* THE FACE, WHICH IS THE WHOLE POINT OF THIS SECTION.

       Our avatars are data: URIs in the driver's own record - bytes, not a
       location - and an embed icon_url is fetched by Discord's servers. So
       the picture is not linked, it is uploaded with the card, and the
       embed points at it with attachment://. If this regresses the card
       loses the face silently and the only symptom is a name on its own.

       A 1x1 PNG, so the bytes are real and checkable. */
    const PNG = Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
      'base64');
    posted.length = 0;
    await post('job.delivered',
      { avatar: 'data:image/png;base64,' + PNG.toString('base64') });
    await wait(600);
    if (posted.length) {
      const p0 = posted[0];
      check('a data: avatar is uploaded with the card',
        p0.type.indexOf('multipart/form-data') > -1, p0.type.split(';')[0]);
      const a3 = cardOf(p0).embeds[0].author || {};
      check('and the embed points at that upload',
        a3.icon_url === 'attachment://avatar.png', a3.icon_url || 'NO ICON');
      check('the picture arrives intact, not mangled',
        p0.raw.indexOf(PNG) > -1, p0.raw.indexOf(PNG) > -1
          ? PNG.length + ' bytes, byte for byte' : 'THE BYTES DID NOT SURVIVE');
      check('and it is sent as a file, with a name',
        p0.body.indexOf('filename="avatar.png"') > -1
          && p0.body.indexOf('name="files[0]"') > -1, 'files[0] avatar.png');
    }

    /* An avatar already on a public host needs no upload - Discord fetches
       and caches it, and the post stays plain JSON. */
    posted.length = 0;
    await post('job.delivered', { avatar: 'https://cdn.gaming-nation.test/a/ana.png' });
    await wait(500);
    if (posted.length) {
      check('a public https avatar is linked, not uploaded',
        posted[0].type.indexOf('application/json') > -1, posted[0].type);
    }

    /* And the addresses Discord cannot reach: name alone beats a broken
       image on every card the crew reads. */
    for (const [what, url] of [
      ['a LAN address', 'https://192.168.1.14:7040/files/a.png'],
      ['localhost', 'https://localhost:7040/files/a.png'],
      ['plain http', 'http://cdn.gaming-nation.test/a/ana.png'],
    ]) {
      posted.length = 0;
      await post('job.delivered', { avatar: url });
      await wait(500);
      let a2 = null;
      try { a2 = JSON.parse(posted[0].body).embeds[0].author; } catch (e) { /* below */ }
      check('  ' + what + ' is left off, not sent broken',
        !!a2 && !a2.icon_url, a2 && a2.icon_url ? 'SENT ' + a2.icon_url : 'name only');
      check('  and the name still carries the code',
        !!a2 && a2.name === 'Ana Vos · GMN-1001', (a2 && a2.name) || '-');
    }

    /* The badge, on both sides of the line and exactly on it. 100 is REAL
       and 101 is a RACE - an off-by-one here mislabels somebody's honest
       run in front of the whole crew. */
    for (const [speed, want, other] of [[99, 'REAL', 'RACE'],
                                        [100, 'REAL', 'RACE'],
                                        [101, 'RACE', 'REAL'],
                                        [140, 'RACE', 'REAL']]) {
      posted.length = 0;
      await post('job.delivered', { top: speed });
      await wait(500);
      let f = null;
      try {
        f = (cardOf(posted[0]).embeds[0].fields || [])
          .find((x) => x.name === 'Top speed');
      } catch (e) { /* reported below */ }
      const v = (f && f.value) || '';
      check('  ' + String(speed).padStart(3) + ' km/h reads ' + want,
        v.indexOf(want) > -1 && v.indexOf(other) === -1, v || 'NO FIELD');
    }

    posted.length = 0;
    await post('job.start'); await wait(500);
    check('so does a run starting', posted.length === 1, posted.length + ' post(s)');

    /* ---- and the ones that would get the channel muted ---- */
    posted.length = 0;
    await post('session.start'); await post('session.end');
    await post('job.speeding'); await post('job.damage');
    await wait(700);
    check('but opening the game does not post', posted.length === 0,
      posted.length + ' post(s) — expected 0');

    /* ---- the credential ---- */
    const out = log.join('');
    check('the webhook URL is never logged', out.indexOf('SECRET-TOKEN-VALUE') === -1,
      out.indexOf('SECRET-TOKEN-VALUE') === -1 ? 'absent from the output' : 'LEAKED TO THE LOG');
    check('and the banner says whether it is on, not what it is',
      /Discord\s+:/.test(out) && out.indexOf('SECRET-TOKEN-VALUE') === -1,
      /Discord\s+:/.test(out) ? 'banner reports the mode' : 'banner says nothing');

    /* ---- Discord having a bad day ---- */
    posted.length = 0; stubMode = 500;
    const stillOk = await post('job.delivered');
    await wait(700);
    check('Discord refusing does not fail the delivery report', stillOk === 200,
      'the client got HTTP ' + stillOk);

    posted.length = 0; stubMode = 'hang';
    const hung = await post('job.delivered');
    check('nor does Discord never answering', hung === 200,
      'the client got HTTP ' + hung);

    /* ---- and the channel belongs to the company that owns the record ----

       Thirteen tests spawned this service with a scratch company file so a
       run would not touch the real company, and every one of them then
       inherited the REAL company's webhook, because it was read from the
       folder rather than tied to the record. Each of those runs posted a
       fabricated delivery into a channel real people read.

       A service pointed at another company's record does not get this
       company's channel. It is a rule about ownership, so nobody has to
       remember a flag when they write the fourteenth test. */
    const other = await new Promise((resolve) => {
      const p2 = spawn(process.execPath, [path.join(ROOT, 'fleet-server.js')], {
        cwd: ROOT,
        env: Object.assign({}, process.env, {
          GMN_PORT: String(FLEET_PORT + 3),
          /* a scratch company, and NO webhook told to it - exactly the
             shape every other smoke test spawns */
          GMN_COMPANY_FILE: path.join(ROOT, '.smoke-discord-other.json'),
          GMN_SESSION_FILE: path.join(ROOT, '.smoke-discord-other-s.json'),
          GMN_DISCORD_WEBHOOK: '',
        }),
        stdio: ['ignore', 'pipe', 'pipe'],
      });
      let said = '';
      const done = () => resolve(said);
      p2.stdout.on('data', (d) => { said += String(d); });
      p2.stderr.on('data', (d) => { said += String(d); });
      setTimeout(() => { p2.kill(); done(); }, 2500);
    });
    check('another company’s record gets no channel of ours',
      /Discord\s+:\s+off/.test(other)
        && /another company record/.test(other.replace(/another company's record/g, 'another company record')),
      (/(Discord\s+:.*)/.exec(other) || [, 'no banner'])[1].trim());
  } catch (e) {
    check('the test itself ran', false, e && e.message);
  } finally {
    if (fleet) fleet.kill();
    stub.close();
    for (const f of ['.smoke-discord-company.json', '.smoke-discord-sessions.json',
                     '.smoke-discord-other.json', '.smoke-discord-other-s.json']) {
      try { require('fs').rmSync(path.join(ROOT, f), { force: true }); } catch (e) { /* fine */ }
    }
  }

  console.log('\nruns and deliveries reach the crew Discord');
  console.log(steps.join('\n'));
  console.log(problems ? '\n' + problems + ' problem(s)' : '\nclean');
  process.exit(problems ? 1 : 0);
})();
