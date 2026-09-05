/* Static audit of the two front-ends.
 *
 * Both apps are plain script files with no build step, so nothing catches a
 * button wired to a handler that was never written, an icon name that does not
 * exist, or a function that was renamed on one side only. This walks the
 * sources and reports those. Run it before a release:
 *
 *     node tools/scan.js
 *
 * Exits non-zero if anything is wrong, so it can gate a build.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');

/* A source file that is not there is the most serious thing this can
   find, and it used to be the worst reported: readFileSync threw and the
   audit ended in a stack trace with the path buried in it, which reads
   like the tool is broken rather than the project.

   It happened for real — index.html and the two driver pages went missing
   from the working tree — and the first thing anybody saw was ENOENT from
   node's module loader. Say which file, and say where a copy will be. */
const read = (f) => {
  try {
    return fs.readFileSync(path.join(ROOT, f), 'utf8');
  } catch (e) {
    if (e.code !== 'ENOENT') throw e;

    console.log('\n  ✗ ' + f + ' is missing from the project.');
    console.log('');
    console.log('    Nothing can be audited without it. If it was deleted by');
    console.log('    accident, there are two places to get it back:');
    console.log('');
    console.log('      git checkout -- ' + f + '        (if it is unmodified in git)');
    console.log('      cp www/' + f + ' ' + f + '   (the last build, if it shipped)');
    console.log('');
    process.exit(1);
  }
};
const uniq = (a) => [...new Set(a)];
const all = (src, re) => [...src.matchAll(re)];

/* Targets: the entry file plus anything it shares. */
const TARGETS = [
  { name: 'platform', files: ['script.js', 'map-data.js'], pages: ['login.html', 'admin.html'] },
  { name: 'client', files: ['tracker.js', 'map-data.js'], pages: ['tracker.html'] },
];

/* A rule can also live in the page that uses it.

   login.html carries the driver terminal's stylesheet inline — scoped to
   #dt-root — because the two pages it came from, driver-login.html and
   driver-dashboard.html, were merged into it. Reading only the two
   stylesheets reported all 43 of those classes as having no rule anywhere,
   which was this check being wrong rather than the markup: "anywhere"
   includes the document doing the asking. */
const inlineStyles = uniq(TARGETS.flatMap((t) => t.pages))
  .map((p) => all(read(p), /<style>([\s\S]*?)<\/style>/g)
    .map((m) => m[1])
    .join('\n'))
  .join('\n');

/* Every class name with a rule behind it: both stylesheets, and whatever
   the pages define for themselves. */
const cssClasses = new Set(
  all(read('style.css') + '\n' + read('tracker.css') + '\n' + inlineStyles,
    /\.([a-zA-Z][a-zA-Z0-9_-]*)/g)
    .map((m) => m[1]));

/* Class names that exist so JavaScript can find the element again, and are
   never meant to carry styling. */
const QUERY_HOOKS = ['hit', 'adm-role'];

/* Every line of front-end source, for questions that cross file boundaries. */
const EVERY_SOURCE = uniq(TARGETS.flatMap((t) => t.files)).map(read).join('\n');

let problems = 0;
const fail = (app, kind, detail) => {
  problems++;
  console.log(`  ✗ [${app}] ${kind}: ${detail}`);
};

for (const t of TARGETS) {
  const src = t.files.map(read).join('\n');
  const pages = t.pages.map(read).join('\n');
  const whole = src + '\n' + pages;
  console.log(`\n${t.name} (${t.files.join(', ')})`);

  /* 1. every data-act a screen emits must be handled */
  const emitted = uniq(all(whole, /data-act=\\?["']([a-zA-Z0-9-]+)/g).map((m) => m[1]));
  /* an action chosen at render time — data-act="${on ? 'a' : 'b'}" */
  const inline = uniq(all(whole, /data-act="\$\{[^}]*?'([a-zA-Z0-9-]+)'[^}]*?\}/g).map((m) => m[1]));
  const handled = uniq([
    ...all(src, /case\s+'([a-zA-Z0-9-]+)'\s*:/g).map((m) => m[1]),
    ...all(src, /\bact\s*===\s*'([a-zA-Z0-9-]+)'/g).map((m) => m[1]),
    /* a modal or toast can bind its own buttons directly instead */
    ...all(src, /\[data-act="([a-zA-Z0-9-]+)"\]/g).map((m) => m[1]),
  ]);
  emitted.filter((a) => !handled.includes(a))
    .forEach((a) => fail(t.name, 'button with no handler', `data-act="${a}"`));
  emitted.push(...inline);
  /* the reverse: a handler nothing can reach is dead weight. Route names share
     the same switch shape, so only look at the block that dispatches clicks. */
  const actBlock = (() => {
    const at = src.search(/function (onAction|handleAction|handle|act)\s*\(/);
    if (at < 0) return src;
    return src.slice(at, at + 40000);
  })();
  uniq(all(actBlock, /case\s+'([a-zA-Z0-9-]+)'\s*:/g).map((m) => m[1]))
    .filter((a) => !emitted.includes(a))
    .forEach((a) => fail(t.name, 'handler nothing triggers', `case '${a}'`));

  /* 2. icon names must exist, or the glyph silently falls back */
  const iconKeys = (() => {
    const at = src.search(/const (ICONS|ICON_PATHS|GLYPHS|P)\s*=\s*\{/);
    if (at < 0) return null;
    const body = src.slice(at, src.indexOf('\n};', at));
    return uniq(all(body, /^\s*([a-zA-Z0-9_]+)\s*:/gm).map((m) => m[1]));
  })();
  if (iconKeys) {
    uniq(all(whole, /\bicon\(\s*'([a-zA-Z0-9_]+)'/g).map((m) => m[1]))
      .filter((n) => !iconKeys.includes(n))
      .forEach((n) => fail(t.name, 'icon does not exist', `icon('${n}')`));
  }

  /* 3. an element the code reads by id must be rendered somewhere */
  const readIds = uniq([
    ...all(src, /getElementById\(\s*'([a-zA-Z0-9_-]+)'/g).map((m) => m[1]),
    ...all(src, /\bg\(\s*'([a-zA-Z0-9_-]+)'\s*\)/g).map((m) => m[1]),
  ]);
  readIds.filter((id) => !new RegExp('id=\\\\?["\']' + id + '\\b').test(whole))
    .forEach((id) => fail(t.name, 'reads an element nothing renders', `#${id}`));

  /* 4. a setting nothing reads is a switch wired to nothing */
  let settingKeys = [];
  const sAt = src.indexOf('settings: {');
  if (sAt > 0) {
    const decl = src.slice(sAt, src.indexOf('\n    },', sAt));
    settingKeys = [...decl.matchAll(/^\s{6}([a-zA-Z0-9_]+)\s*:/gm)].map((m) => m[1]);
    settingKeys
      .filter((k) => !new RegExp('\\.' + k + '\\b').test(src))
      .forEach((k) => fail(t.name, 'setting nothing reads', `settings.${k}`));
  }

  /* 5. a class the markup asks for with no rule behind it silently does
        nothing — a missing .pill left every status chip as bare text */
  const used = uniq(all(whole, /class="([^"$`]*)"/g)
    .flatMap((m) => m[1].split(/\s+/))
    .filter((c) => c && /^[a-zA-Z][a-zA-Z0-9_-]*$/.test(c)));
  used.filter((c) => !cssClasses.has(c) && !QUERY_HOOKS.includes(c))
    .forEach((c) => fail(t.name, 'class with no rule anywhere', '.' + c));

  /* 6. a helper called from inside a template but defined nowhere.

        Screens are built by interpolating helpers — ${myAssignmentsHTML(u)} —
        so deleting one while a screen still calls it throws at render time and
        takes the whole page down. Only `${name(` is checked, which is narrow
        enough to be certain and is exactly where this goes wrong. */
  /* Names bound by a parameter list, including destructured ones — a callback
     like .map(([k, cur, goal, f2]) => `${f2(cur)}`) is calling a local, not a
     helper that has gone missing. */
  const params = all(EVERY_SOURCE, /\(([^()]{0,240})\)\s*=>/g)
    .flatMap((m) => m[1].split(','))
    .map((x) => x.replace(/[[\]{}\s]/g, '').split(/[=:]/)[0])
    .filter((x) => /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(x));

  const declared = new Set([
    ...all(EVERY_SOURCE, /(?:^|\n)\s*(?:function|const|let|var)\s+([a-zA-Z0-9_$]+)/g).map((m) => m[1]),
    ...all(EVERY_SOURCE, /(?:^|\n)\s{2}([a-zA-Z0-9_$]+)\s*\(/g).map((m) => m[1]),
    ...params,
    'esc', 'icon', 'fmt', 'can', 'Math', 'Object', 'Array', 'String', 'Number',
    'JSON', 'Date', 'sum', 'clamp',
  ]);
  uniq(all(src, /\$\{\s*([a-zA-Z_$][a-zA-Z0-9_$]*)\s*\(/g).map((m) => m[1]))
    .filter((n) => !declared.has(n))
    .forEach((n) => fail(t.name, 'a screen calls a helper that does not exist', n + '()'));

  /* 7. a function nothing calls is either a missing wire or dead weight.
        Counted across the whole project: map-data.js is shared, so a helper
        only the client uses is not dead just because the platform ignores it. */
  uniq(all(t.files.map(read).join('\n'), /^function ([a-zA-Z0-9_$]+)\s*\(/gm).map((m) => m[1]))
    .filter((n) => all(EVERY_SOURCE, new RegExp('\\b' + n + '\\b', 'g')).length <= 1)
    .forEach((n) => fail(t.name, 'function nothing calls', n + '()'));

  console.log(`  ${emitted.length} actions · ${iconKeys ? iconKeys.length : '?'} icons · `
    + `${readIds.length} element ids · ${settingKeys.length} settings · ${used.length} classes`);
}

/* 8. every asset a page links must ship in the packaged app */
console.log('\npackaging');
const pkg = JSON.parse(read('package.json'));
const shipped = (pkg.build && pkg.build.files) || [];
/* electron-builder globs → a regex, in one pass so the output of one
   substitution is never re-substituted by the next */
const globRe = (p) => new RegExp('^' + p.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  .replace(/\*\*\/\*|\*\*|\*|\?/g, (m) => (m === '?' ? '[^/]' : m === '*' ? '[^/]*' : '.*')) + '$');
const covers = (f) => shipped.some((p) => p === f || p.replace(/^!/, '') === f
  || (p.includes('*') && globRe(p).test(f)));
for (const page of ['tracker.html']) {
  uniq(all(read(page), /(?:src|href)=["'](?!https?:|data:|#)([^"']+)["']/g).map((m) => m[1].split('?')[0]))
    .filter((f) => !covers(f))
    .forEach((f) => fail('client', 'linked but not in build.files', `${page} → ${f}`));
}
console.log(`  build.files covers ${shipped.length} pattern(s)`);

/* 9. the download page must describe builds that are actually there, at the
      size it claims — a stale link is worse than no link */
console.log('\nrelease');
const rel = read('script.js').slice(read('script.js').indexOf('const CLIENT_RELEASE'));
const listed = all(rel.slice(0, rel.indexOf('};')), /file:\s*'([^']+)'[\s\S]*?size:\s*'([\d.]+) MB'/g);
if (!listed.length) fail('platform', 'download page', 'no builds are listed');
for (const [, file, claimed] of listed) {
  let stat = null;
  try { stat = fs.statSync(path.join(ROOT, file)); } catch (e) { /* missing */ }
  if (!stat) { fail('platform', 'download page names a build that is not built', file); continue; }
  const mb = (stat.size / 1e6).toFixed(1);
  if (Math.abs(mb - claimed) > 0.15) {
    fail('platform', 'download size is wrong', `${file} says ${claimed} MB, is ${mb} MB`);
  }
}
if (listed.length) console.log(`  ${listed.length} build(s) listed and present`);

/* 10. the two payloads must stay two payloads.

      The tracking client is a download. It belongs inside the Android app and
      the Windows build, and it must not appear on the public website — where
      it would be a page anybody could wander onto instead of the drivers'
      site. These checks fail the build if that ever gets crossed again. */
console.log('\npayloads');
const builder = read('tools/build-www.js');
const cap = JSON.parse(read('capacitor.config.json'));

if (cap.webDir !== 'app-www') {
  fail('build', 'the Android app would bundle the website',
    `capacitor webDir is "${cap.webDir}", expected "app-www"`);
}
if (!/const APP\s*=[\s\S]{0,160}'app-www'/.test(builder)) {
  fail('build', 'the builder no longer writes the app payload', 'app-www is not assembled');
}
if (!/site\.write\('login\.html', read\('login\.html'\)\)/.test(builder)) {
  fail('build', "the website's login.html is not the drivers' site", 'check build-www.js');
}
if (/site\.(write|copy)\([^)]*tracker/.test(builder)) {
  fail('build', 'the website payload carries the tracking client',
    'the client is a download, not a page');
}

/* and if a build is sitting there, check what it actually contains */
const built = path.join(ROOT, 'www');
if (fs.existsSync(built)) {
  const strays = fs.readdirSync(built).filter((f) => /^tracker\./.test(f));
  strays.forEach((f) => fail('build', 'the built website contains a client file', 'www/' + f));
  const home = path.join(built, 'login.html');
  if (fs.existsSync(home) && /HLL_SITE\s*=\s*'admin'/.test(fs.readFileSync(home, 'utf8'))) {
    fail('build', 'the built website opens on the console', 'www/login.html');
  }
  if (fs.existsSync(home) && !/HLL_SITE\s*=\s*'drivers'/.test(fs.readFileSync(home, 'utf8'))) {
    fail('build', "the built website does not open on the drivers' site", 'www/login.html');
  }
  console.log('  www/ holds ' + fs.readdirSync(built).length + ' entries');
}
if (!problems) console.log('  website and app payloads are separate');


/* ============================================================
   6. Does the database agree with the app about who is staff?

   The app decides who may work the recruitment screen from
   PERMS['recruitment.manage'] and the levels in ROLES. The
   database decides who may READ an application from is_staff().
   Nothing made the two agree, and they did not: a dispatcher, an
   event manager and a moderator were shown the screen and the
   Approve button, and handed no rows.

   That failure is invisible. An RLS SELECT that matches nothing
   is a successful query returning zero rows — indistinguishable
   from nobody having applied. No error, no warning, an empty
   screen. It is precisely the kind of thing a static check is
   for, so here it is.
   ============================================================ */
(() => {
  const app = read('script.js');

  /* the roles the app knows, with their levels */
  const rolesAt = app.indexOf('const ROLES = {');
  const permsAt = app.indexOf('const PERMS = {');
  if (rolesAt < 0 || permsAt < 0) return;   /* renamed; nothing to compare */

  const rolesSrc = app.slice(rolesAt, app.indexOf('\n};', rolesAt));
  const permsSrc = app.slice(permsAt, app.indexOf('\n};', permsAt));

  const levels = {};
  all(rolesSrc, /^\s*([a-z_]+):\s*\{[^}]*level:\s*(\d+)/gm)
    .forEach((m) => { levels[m[1]] = Number(m[2]); });

  const needed = (permsSrc.match(/'recruitment\.manage':\s*(\d+)/) || [])[1];
  if (!needed || !Object.keys(levels).length) return;

  const appStaff = Object.keys(levels)
    .filter((r) => levels[r] >= Number(needed))
    .sort();

  /* the newest definition of is_staff() wins, the same way it does in a
     database that has had every migration run against it in order */
  const sqlFiles = [];
  const push = (rel) => {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) sqlFiles.push([rel, fs.readFileSync(abs, 'utf8')]);
  };
  push('supabase/setup.sql');
  const migDir = path.join(ROOT, 'supabase', 'migrations');
  if (fs.existsSync(migDir)) {
    fs.readdirSync(migDir).sort().forEach((f) => push('supabase/migrations/' + f));
  }

  let definedIn = null;
  let dbStaff = null;

  for (const [rel, sql] of sqlFiles) {
    const at = sql.indexOf('function public.is_staff()');
    if (at < 0) continue;
    const body = sql.slice(at, at + 900);
    const list = body.match(/role\s+in\s*\(([\s\S]*?)\)/);
    if (!list) continue;
    dbStaff = all(list[1], /'([a-z_]+)'/g).map((m) => m[1]).sort();
    definedIn = rel;
  }

  if (!dbStaff) return;   /* no is_staff() to check against */

  const missing = appStaff.filter((r) => r !== 'driver' && dbStaff.indexOf(r) < 0);

  if (missing.length) {
    fail('roles', 'the database does not count these as staff, but the app does',
      missing.join(', ') + ' — they see the recruitment screen and no rows'
      + ' (is_staff() in ' + definedIn + ')');
  } else {
    console.log('\nroles');
    console.log('  app and database agree on ' + dbStaff.length + ' staff role(s)');
  }
})();


/* ============================================================
   7. Does the installer contain everything the app requires?

   electron-builder ships exactly what build.files lists. A file
   that is required but not listed is not a warning and not a
   build failure — it is simply absent, and the app dies on
   launch with

     Cannot find module './service-host'

   in a Windows error box, before any of it has drawn a pixel.
   Every other check here runs against the checkout, where the
   file is obviously present, so nothing caught it: the smoke
   tests require it from the source tree and pass, and the bug
   only exists in the packaged copy somebody downloads.

   It shipped exactly that way once. This walks the requires
   instead of trusting them.
   ============================================================ */
(() => {
  let pkg;
  try { pkg = JSON.parse(read('package.json')); } catch (e) { return; }

  const patterns = ((pkg.build && pkg.build.files) || [])
    .filter((f) => typeof f === 'string' && !f.startsWith('!'));

  if (!patterns.length) return;

  /* Enough of a glob for the shapes this list actually uses: exact
     names, and a directory with ** in it. */
  const covered = (rel) => patterns.some((p) => {
    if (p === rel) return true;
    const star = p.indexOf('*');
    if (star < 0) return false;
    return rel.startsWith(p.slice(0, star));
  });

  /* Follow the requires from every packaged JavaScript file, so a file
     that is listed but pulls in one that is not is caught too. */
  const seen = new Set();
  const queue = patterns.filter((p) => p.endsWith('.js'));
  const missing = [];

  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);

    const abs = path.join(ROOT, rel);
    if (!fs.existsSync(abs)) continue;

    let src;
    try { src = fs.readFileSync(abs, 'utf8'); } catch (e) { continue; }

    all(src, /require\(\s*'\.\/([a-zA-Z0-9_.-]+)'\s*\)/g).forEach((m) => {
      const name = m[1].endsWith('.js') ? m[1] : m[1] + '.js';

      if (!fs.existsSync(path.join(ROOT, name))) return;   /* not ours to ship */

      if (!covered(name)) {
        missing.push(name + '  (required by ' + rel + ')');
      } else {
        queue.push(name);
      }
    });
  }

  console.log('\npackaged requires');

  if (missing.length) {
    uniq(missing).forEach((m) => fail('packaging',
      'required but not in build.files — the installed app dies on launch', m));
  } else {
    console.log('  every local require is in build.files (' + seen.size + ' file(s) walked)');
  }
})();

console.log(problems ? `\n${problems} problem(s)\n` : '\nclean\n');
process.exit(problems ? 1 : 0);
