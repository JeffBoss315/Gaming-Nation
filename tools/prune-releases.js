/* ============================================================
   Old GitHub Releases go when a new one arrives.

     node tools/prune-releases.js            (after publishing a release)
     node tools/prune-releases.js --dry-run  (say what would go, delete nothing)
     node tools/prune-releases.js --keep=3   (override how many survive)

   tools/prune-builds.js already does this for release/ on disk. This is
   the same tidy-up on the other side of the wire, because the installers
   that matter to a driver are the ones on GitHub: that is where the
   download page sends them, and nine releases of a fleet client is nine
   answers to "which one am I supposed to have".

   KEEP is two - the current version and the one before it. Not one,
   which is what prune-builds.js keeps on disk, and the difference is
   deliberate: the local copy is a build artefact that can be rebuilt from
   the tag in a couple of minutes, while a published release is the only
   thing a driver can actually reach. The client now tells every driver to
   upgrade the moment version.json moves, so a release that turns out
   broken needs somewhere to fall back to that is still downloadable.

   THE TAGS ARE LEFT ALONE. Deleting the release removes the installers
   and the page; the tag stays pointing at the commit, so what any past
   version was built from is still checkable. Tags cost nothing and are
   the only record of that.

   Deliberately conservative, the same way prune-builds.js is:

     - only releases whose tag parses as vX.Y.Z are considered at all;
       anything else is left alone rather than guessed at
     - it refuses to delete anything unless the CURRENT version from
       package.json is actually published, because "prune everything
       older than a release that does not exist" is how you end up with
       no downloads at all
     - drafts are never touched
   ============================================================ */
'use strict';

const fs = require('fs');
const path = require('path');
const https = require('https');
const { execFileSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const DRY = process.argv.includes('--dry-run');
const KEEP = (() => {
  const a = process.argv.find((x) => x.startsWith('--keep='));
  const n = a ? parseInt(a.split('=')[1], 10) : 2;
  return Number.isFinite(n) && n >= 1 ? n : 2;
})();

const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const CURRENT = String(pkg.version || '').trim();
if (!/^\d+\.\d+\.\d+$/.test(CURRENT)) {
  console.error('package.json has no usable version — nothing pruned');
  process.exit(1);
}

/* owner/repo out of the origin remote, rather than written down twice */
function repoSlug() {
  const url = execFileSync('git', ['remote', 'get-url', 'origin'],
    { cwd: ROOT, encoding: 'utf8' }).trim();
  const m = url.match(/github\.com[:/]([^/]+)\/(.+?)(?:\.git)?$/i);
  if (!m) throw new Error('origin is not a GitHub remote: ' + url);
  return { owner: m[1], repo: m[2] };
}

/* A token, without ever printing one. Environment first, for CI; then the
   credential the machine already uses to push, which is the same identity
   and means there is no second secret to keep anywhere. */
function token() {
  const fromEnv = process.env.GITHUB_TOKEN || process.env.GH_TOKEN;
  if (fromEnv) return fromEnv.trim();
  const out = execFileSync('git', ['credential', 'fill'],
    { cwd: ROOT, encoding: 'utf8', input: 'protocol=https\nhost=github.com\n\n' });
  const m = out.match(/^password=(.+)$/m);
  if (!m) throw new Error('no GitHub credential — set GITHUB_TOKEN or run a git push first');
  return m[1].trim();
}

function api(method, apiPath, tok) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com', path: apiPath, method,
      headers: {
        authorization: 'Bearer ' + tok,
        accept: 'application/vnd.github+json',
        'user-agent': 'gmn-prune-releases',
      },
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { body += c; });
      res.on('end', () => {
        if (res.statusCode === 204) return resolve(null);
        if (res.statusCode < 200 || res.statusCode >= 300) {
          return reject(new Error(method + ' ' + apiPath + ' → HTTP ' + res.statusCode
            + ' ' + body.slice(0, 200)));
        }
        try { resolve(JSON.parse(body)); } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.end();
  });
}

const parts = (v) => String(v).replace(/^v/i, '').split('.').map((n) => parseInt(n, 10) || 0);
const cmp = (a, b) => {
  const x = parts(a), y = parts(b);
  for (let i = 0; i < Math.max(x.length, y.length); i++) {
    const d = (x[i] || 0) - (y[i] || 0);
    if (d) return d < 0 ? -1 : 1;
  }
  return 0;
};

(async () => {
  const { owner, repo } = repoSlug();
  const tok = token();

  console.log('\nprune releases  (' + owner + '/' + repo + ', current ' + CURRENT + ')');

  const all = await api('GET', `/repos/${owner}/${repo}/releases?per_page=100`, tok);
  const versioned = all
    .filter((r) => !r.draft && /^v?\d+\.\d+\.\d+$/.test(r.tag_name || ''))
    .sort((a, b) => cmp(b.tag_name, a.tag_name));

  const skipped = all.length - versioned.length;
  if (skipped) console.log('  ' + skipped + ' release(s) left alone (draft, or no readable version)');

  if (!versioned.some((r) => cmp(r.tag_name, CURRENT) === 0)) {
    console.error('\n  ' + CURRENT + ' is not published yet — nothing pruned.');
    console.error('  Publish the release first; this only ever clears what is BEHIND it.');
    process.exit(1);
  }

  const keep = versioned.slice(0, KEEP);
  const drop = versioned.slice(KEEP);

  console.log('  keeping ' + (keep.map((r) => r.tag_name).join(', ') || 'nothing'));
  if (!drop.length) {
    console.log('  nothing older to remove\n');
    return;
  }

  for (const r of drop) {
    const assets = r.assets.length;
    if (DRY) {
      console.log('  would delete ' + r.tag_name + '  (' + assets + ' asset(s), tag kept)');
      continue;
    }
    await api('DELETE', `/repos/${owner}/${repo}/releases/${r.id}`, tok);
    console.log('  deleted ' + r.tag_name + '  (' + assets + ' asset(s), tag kept)');
  }

  console.log('\n' + (DRY ? 'dry run — nothing was deleted' : drop.length + ' release(s) removed')
    + ', ' + keep.length + ' kept\n');
})().catch((e) => {
  console.error('\n  ' + e.message + '\n');
  process.exit(1);
});
