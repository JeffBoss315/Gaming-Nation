/* Publish the built installers as a GitHub release.

     node tools/publish-release.js            the version in package.json
     node tools/publish-release.js 1.2.3      a particular one
     node tools/publish-release.js --dry      says what would go, sends nothing

   WHY THIS EXISTS AS A TOOL. The website does not host the installers -
   Cloudflare refuses any asset over 25 MiB and these are ninety-six
   megabytes each - so functions/api/download/[build].js streams them from
   R2, and from the published release when the bucket has not got them.
   Which means a release with no files on it is a download page that
   answers 404 at every driver who presses Download.

   AND WHY IT RETRIES. Uploading a file this size to GitHub fails often
   enough that one attempt proves nothing:

     try 1  HTTP 500 {"message":"Error saving asset"}
     try 2  ECONNRESET
     try 3  HTTP 500
     try 4  ok

   That is a real run, on 2026-09-17. Worse, a failed attempt can leave the
   asset behind in a state that is neither uploaded nor absent, and the
   naive retry is then refused as a duplicate name - so each try clears
   whatever the last one left. The release is checked at the end by asking
   GitHub what is actually on it, rather than by trusting the last status
   line.

   The token comes from the environment or from the credential this machine
   already pushes with, and is never printed.
*/
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..');
const args = process.argv.slice(2);
const DRY = args.includes('--dry');
const TRIES = 4;

const VERSION = args.find((a) => /^\d+\.\d+\.\d+$/.test(a))
  || JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8')).version;

const FILES = [
  `Gaming-Nation-Tracker-${VERSION}-windows-setup.exe`,
  `Gaming-Nation-Tracker-${VERSION}-windows-portable.exe`,
  `Gaming-Nation-Tracker-${VERSION}-android.apk`,
];

/* The repository is read from the remote rather than written down twice. */
function repoSlug() {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'],
    { cwd: ROOT, encoding: 'utf8' }).trim();
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/i);
  if (!m) throw new Error('origin is not a GitHub remote: ' + url);
  return { owner: m[1], repo: m[2] };
}

function token() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return fromEnv.trim();
  const out = execFileSync('git', ['credential', 'fill'],
    { cwd: ROOT, encoding: 'utf8', input: 'protocol=https\nhost=github.com\n\n' });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('no GitHub credential — set GITHUB_TOKEN or run a git push first');
  return m[1].trim();
}

const { owner, repo } = repoSlug();
const TOKEN = DRY ? '' : token();
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function send({ host, path: p, method, headers = {}, body }) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: host,
      path: p,
      method,
      headers: Object.assign({
        Authorization: 'Bearer ' + TOKEN,
        Accept: 'application/vnd.github+json',
        'User-Agent': 'gaming-nation-release',
        'X-GitHub-Api-Version': '2022-11-28',
      }, headers),
    }, (res) => {
      let data = '';
      res.setEncoding('utf8');
      res.on('data', (d) => { data += d; });
      res.on('end', () => {
        let parsed = null;
        try { parsed = JSON.parse(data); } catch (e) { parsed = data; }
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

const api = (method, p, json) => send({
  host: 'api.github.com', path: p, method,
  headers: json ? { 'Content-Type': 'application/json' } : {},
  body: json ? Buffer.from(JSON.stringify(json)) : null,
});

const release = (tag) => api('GET', `/repos/${owner}/${repo}/releases/tags/${tag}`);

(async () => {
  const tag = 'v' + VERSION;

  const present = FILES
    .map((name) => ({ name, file: path.join(ROOT, 'release', name) }))
    .filter((f) => fs.existsSync(f.file));

  console.log('\n' + tag + ' — ' + owner + '/' + repo);
  present.forEach((f) => console.log('  ' + f.name.padEnd(50)
    + (fs.statSync(f.file).size / 1e6).toFixed(1) + ' MB'));
  FILES.filter((n) => !present.some((p) => p.name === n))
    .forEach((n) => console.log('  ' + n.padEnd(50) + 'NOT BUILT — skipped'));

  if (!present.length) {
    console.log('\nNothing to publish. Run npm run dist first.\n');
    process.exit(1);
  }
  if (DRY) { console.log('\n--dry: nothing published.\n'); return; }

  let rel = await release(tag);

  if (rel.status === 404) {
    rel = await api('POST', `/repos/${owner}/${repo}/releases`, {
      tag_name: tag,
      target_commitish: 'main',
      name: 'Version ' + VERSION,
      body: 'The Gaming Nation client, version ' + VERSION + '.\n\n'
        + 'Downloads come from the website — it streams the file itself, '
        + 'so there is no need to be here.',
      draft: false,
      prerelease: false,
    });
    if (rel.status !== 201) {
      console.log('\ncould not create the release: HTTP ' + rel.status);
      console.log(JSON.stringify(rel.body).slice(0, 300));
      process.exit(1);
    }
    console.log('\ncreated ' + tag);
  } else if (rel.status !== 200) {
    console.log('\ncould not look up ' + tag + ': HTTP ' + rel.status);
    process.exit(1);
  } else {
    console.log('\n' + tag + ' exists — adding whatever is missing');
  }

  const id = rel.body.id;
  let failed = 0;

  for (const f of present) {
    const on = (rel.body.assets || []).find((a) => a.name === f.name);
    if (on && on.state === 'uploaded') { console.log('  ' + f.name + ' is already there'); continue; }

    const body = fs.readFileSync(f.file);

    for (let attempt = 1; attempt <= TRIES; attempt++) {
      /* clear anything a previous attempt left behind, or this one is
         refused as a duplicate name rather than given a second chance */
      const now = await release(tag);
      const stale = (now.body.assets || []).find((a) => a.name === f.name);
      if (stale) await api('DELETE', `/repos/${owner}/${repo}/releases/assets/${stale.id}`);

      process.stdout.write('  uploading ' + f.name
        + ' (' + (body.length / 1e6).toFixed(1) + ' MB, try ' + attempt + ') … ');

      const res = await send({
        host: 'uploads.github.com',
        path: `/repos/${owner}/${repo}/releases/${id}/assets?name=${encodeURIComponent(f.name)}`,
        method: 'POST',
        headers: { 'Content-Type': 'application/octet-stream', 'Content-Length': body.length },
        body,
      }).catch((e) => ({ status: 0, body: e.message }));

      if (res.status === 201) { console.log('ok'); break; }
      console.log('HTTP ' + res.status + ' ' + JSON.stringify(res.body).slice(0, 120));

      if (attempt === TRIES) { failed++; break; }
      await wait(3000 * attempt);
    }
  }

  /* what is actually on it, not what the last line said */
  const after = await release(tag);
  const up = (after.body.assets || []).filter((a) => a.state === 'uploaded').map((a) => a.name);
  console.log('\n' + tag + ' has: ' + (up.length ? up.join(', ') : 'NOTHING'));
  console.log(up.length
    ? '\nThe download page serves these until the bucket has them.\n'
    : '\nAn empty release is a 404 behind every Download button — run this again.\n');

  process.exit(failed || !up.length ? 1 : 0);
})().catch((e) => { console.log('threw: ' + e.message); process.exit(1); });
