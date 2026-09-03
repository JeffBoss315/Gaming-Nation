/* ============================================================
   Assembles the two web payloads. They are different things and
   are no longer built into the same folder:

     www/       the public website. index.html is the drivers'
                site, admin.html is the management console. The
                tracking client is NOT here — it is a download,
                not a page somebody can wander onto.

     app-www/   what gets bundled inside the Android app. The
                native shell always boots index.html, so the
                client takes that name here, and the drivers'
                site rides along as hq.html for the "open on the
                platform" links to reach.

     node tools/build-www.js                  both payloads
     node tools/build-www.js --with-release   website carries the installers

   Source files in the project root are left untouched.
   ============================================================ */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
/* Both destinations can be redirected, so a test can build somewhere
   disposable instead of overwriting the folder that is ready to deploy. */
const SITE = path.resolve(process.env.HLL_SITE_OUT || path.join(ROOT, 'www'));
const APP = path.resolve(process.env.HLL_APP_OUT || path.join(ROOT, 'app-www'));

const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');

/* Each payload gets its own writer so a file can differ between them. */
function payload(dir) {
  fs.rmSync(dir, { recursive: true, force: true });   /* deleted files must not linger */
  fs.mkdirSync(dir, { recursive: true });
  const log = [];
  let total = 0;

  const write = (f, s) => {
    const dest = path.join(dir, f);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, s);
    total += Buffer.byteLength(s);
  };
  const copy = (from, to) => {
    const buf = fs.readFileSync(from);
    const dest = path.join(dir, to);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.writeFileSync(dest, buf);
    total += buf.length;
    return buf.length;
  };
  const copyTree = (name) => {
    const abs = path.join(ROOT, name);
    if (!fs.existsSync(abs)) return 0;
    let n = 0;
    const walk = (rel) => {
      for (const f of fs.readdirSync(path.join(abs, rel))) {
        const r = path.join(rel, f);
        if (fs.statSync(path.join(abs, r)).isDirectory()) { walk(r); continue; }
        copy(path.join(abs, r), path.join(name, r));
        n++;
      }
    };
    walk('');
    return n;
  };

  return { dir, log, write, copy, copyTree, size: () => total };
}

/* Both web pages name each other, so moving one moves the declaration. */
const linkDriversTo = (html, page) =>
  html.replace(/drivers:\s*'index\.html'/g, "drivers: '" + page + "'");

/* ============================================================
   1. www/ — the public website
   ============================================================ */
const site = payload(SITE);

site.write('index.html', read('index.html'));
site.log.push("index.html        (drivers' website)");

site.write('admin.html', read('admin.html'));
site.log.push('admin.html        (management console)');

for (const f of ['style.css', 'script.js', 'supabase-client.js', 'map-data.js']) {
  site.write(f, read(f));
  site.log.push(f);
}

if (fs.existsSync(path.join(ROOT, 'hll.jpg'))) {
  site.copy(path.join(ROOT, 'hll.jpg'), 'hll.jpg');
  site.log.push('hll.jpg           (brand mark)');
}

/* ---------------- being found ----------------
   Everything that names a host is written here, from site.config.json, so
   the canonical, the social cards, robots.txt and the sitemap cannot drift
   apart from one another — and so none of them is written at all until
   somebody says where the site actually lives.

   That last part matters more than it sounds. A canonical URL pointing at a
   host you do not own tells a crawler the real page is over there. Guessing
   costs you the ranking you were trying to earn. */
const CFG = (() => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8')); }
  catch (e) { return {}; }
})();

const SITE_URL = String(CFG.siteUrl || '').trim().replace(/\/+$/, '');

if (!SITE_URL) {
  console.log('');
  console.log('  No siteUrl in site.config.json, so no canonical, no sitemap and');
  console.log('  no robots.txt were written. The site works; it just does not');
  console.log('  claim an address. Set siteUrl once you have one.');
  console.log('');
} else {
  const ld = JSON.stringify({
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': SITE_URL + '/#organisation',
        name: CFG.name || 'Heavyline Logistics',
        alternateName: CFG.shortName || 'HLL',
        url: SITE_URL + '/',
        logo: SITE_URL + '/icons/icon-512.png',
        image: SITE_URL + '/hll.jpg',
        description: CFG.tagline || '',
      },
      {
        '@type': 'WebSite',
        '@id': SITE_URL + '/#website',
        url: SITE_URL + '/',
        name: CFG.name || 'Heavyline Logistics',
        publisher: { '@id': SITE_URL + '/#organisation' },
        inLanguage: (CFG.locale || 'en_GB').replace('_', '-'),
      },
    ],
  }, null, 2).split('\n').join('\n    ');

  const seo = [
    '<script>window.HLL_SITE_URL = ' + JSON.stringify(SITE_URL) + ';</script>',
    '',
    '    <link rel="canonical" href="' + SITE_URL + '/">',
    '',
    '    <meta property="og:url" content="' + SITE_URL + '/">',
    '    <meta property="og:image" content="' + SITE_URL + '/hll.jpg">',
    '    <meta name="twitter:image" content="' + SITE_URL + '/hll.jpg">',
    '',
    '    <script type="application/ld+json">',
    '    ' + ld,
    '    </script>',
  ].join('\n');

  const marker = '<!-- HLL_SEO';
  let html = read('index.html');
  const at = html.indexOf(marker);
  if (at === -1) {
    console.log('  WARNING: the HLL_SEO marker is gone from index.html — no tags injected');
  } else {
    const end = html.indexOf('-->', at);
    html = html.slice(0, at) + seo + html.slice(end + 3);
    site.write('index.html', html);
    site.log.push('index.html        (+ canonical, cards, structured data)');
  }

  /* the private pages, and the source a crawler has no use for */
  const denied = ['/admin.html', '/reset-password.html', '/tracker.html',
    '/supabase-test.html', '/release/', '/tools/', '/vendor/', '/supabase/',
    '/script.js', '/tracker.js', '/map-data.js', '/supabase-client.js'];

  const allowRoot = 'Allow: /' + '$';   /* kept apart: $ is special in replacements */

  site.write('robots.txt', [
    '# ' + (CFG.name || 'Heavyline Logistics') + ' — ' + SITE_URL,
    '#',
    '# Generated by tools/build-www.js. Edit site.config.json, not this file.',
    '#',
    '# The public website is meant to be found. The management console, the',
    '# driver client and the account pages are not: they sit behind a sign-in,',
    '# and an indexed login page is a dead end for whoever clicks it.',
    '',
    'User-agent: *',
    allowRoot,
    'Allow: /index.html',
    '',
  ].concat(denied.map((d) => 'Disallow: ' + d)).concat([
    '',
    'Sitemap: ' + SITE_URL + '/sitemap.xml',
    '',
  ]).join('\n'));
  site.log.push('robots.txt        (search engines)');

  /* A robots.txt is only read at the root of a host. On a GitHub Pages
     PROJECT site the pages live under /<repo>/, so this file sits at
     /<repo>/robots.txt and no crawler will ever look at it — the one that
     counts belongs to whoever owns <user>.github.io.

     It is still written, because it costs nothing and becomes live the day
     the site moves to its own domain. What actually keeps the console and
     the client out of the index meanwhile is the noindex meta tag on each
     of those pages, which works wherever they are served from. */
  if (new URL(SITE_URL).pathname.replace(/[/]+$/, '') !== '') {
    console.log('');
    console.log('  Note: this address has a path, so it is a project site.');
    console.log('  robots.txt is only honoured at a host root, so the copy');
    console.log('  written here will be ignored. The noindex meta tags on the');
    console.log('  private pages still apply, and the sitemap can be submitted');
    console.log('  to Search Console by hand.');
    console.log('');
  }

  site.write('sitemap.xml', [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<!-- Generated by tools/build-www.js from site.config.json.',
    '',
    '     One entry, deliberately. The site is a single document and every',
    '     other screen is a hash route behind it, so a crawler asking for',
    '     #/convoys gets this same page back. Listing them would claim pages',
    '     that do not exist as separate URLs. -->',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    '  <url>',
    '    <loc>' + SITE_URL + '/</loc>',
    '    <lastmod>' + new Date().toISOString().slice(0, 10) + '</lastmod>',
    '    <changefreq>weekly</changefreq>',
    '    <priority>1.0</priority>',
    '  </url>',
    '</urlset>',
    '',
  ].join('\n'));
  site.log.push('sitemap.xml       (search engines)');

  /* GitHub Pages has no rewrite rule: it serves 404.html for anything that
     is not a file on disk. The app routes on the hash, so a deep link is
     normally a real file anyway — but a stray path should land on the
     platform rather than on GitHub's own error page. Same document, so it
     boots and the hash takes over. */
  site.write('404.html', read('index.html'));
  /* Cloudflare Pages reads _headers from the site root. Written by the
     builder so it ships with the payload rather than being remembered. */
  if (fs.existsSync(path.join(ROOT, 'www_headers_src'))) {
    site.write('_headers', read('www_headers_src'));
    site.log.push('_headers          (security headers)');
  }
  site.log.push('404.html          (so a stray path still opens the app)');

  /* GitHub Pages reads its custom domain from a CNAME file. Only for a real
     domain — a *.pages.dev or *.netlify.app host needs none. */
  /* the hostname, not the whole URL: a project site carries a path, and a
     CNAME file containing one would break the deployment outright */
  const host = new URL(SITE_URL).hostname;
  if (!/\.(pages\.dev|netlify\.app|vercel\.app|github\.io)$/i.test(host)) {
    site.write('CNAME', host + '\n');
    site.log.push('CNAME             (custom domain, for GitHub Pages)');
  }
}
site.log.push('vendor/           (' + site.copyTree('vendor') + ' files)');
site.log.push('icons/            (' + site.copyTree('icons') + ' files)');

/* ---- the client installers ----
   Off by default so a plain build stays small. Pass --with-release for a web
   deploy and the builds the downloads page links to travel with the site. */
if (process.argv.includes('--with-release')) {
  const relDir = path.join(ROOT, 'release');
  if (fs.existsSync(relDir)) {
    /* only the builds this site links to — the archive is not for shipping */
    const wanted = new Set(
      (read('script.js').match(/release\/[A-Za-z0-9._-]+/g) || [])
        .map((r) => r.replace('release/', '')));
    let n = 0, bytes = 0;
    for (const f of fs.readdirSync(relDir)) {
      if (!wanted.has(f)) continue;
      const src = path.join(relDir, f);
      if (!fs.statSync(src).isFile()) continue;
      bytes += site.copy(src, path.join('release', f));
      n++;
    }
    /* the release notes go with them */
    const notes = path.join(relDir, 'README.txt');
    if (fs.existsSync(notes)) site.copy(notes, path.join('release', 'README.txt'));
    site.log.push('release/          (' + n + ' builds, ' + Math.round(bytes / 1048576) + ' MB)');
  } else {
    site.log.push('release/          (nothing to copy)');
  }
} else {
  site.log.push('release/          (skipped — pass --with-release for a web deploy)');
}

/* ============================================================
   2. app-www/ — what ships inside the Android app
   ============================================================ */
const app = payload(APP);

/* the native shell boots index.html, so the client takes that name */
app.write('index.html', read('tracker.html').replace(/index\.html#\//g, 'hq.html#/'));
app.log.push('index.html        (the client, links -> hq.html)');

/* the drivers' site rides along so "open on the platform" has somewhere to go */
app.write('hq.html', linkDriversTo(read('index.html'), 'hq.html'));
app.log.push("hq.html           (drivers' website)");
app.write('admin.html', linkDriversTo(read('admin.html'), 'hq.html'));
app.log.push('admin.html        (management console)');

for (const f of ['tracker.css', 'tracker.js', 'map-data.js', 'style.css', 'script.js',
                 'supabase-client.js', 'manifest.webmanifest', 'sw.js']) {
  let body = read(f);
  if (f === 'tracker.js') body = body.replace(/index\.html#\//g, 'hq.html#/');
  if (f === 'manifest.webmanifest' || f === 'sw.js') {
    body = body.replace(/\.\/tracker\.html/g, './index.html');
  }
  app.write(f, body);
  app.log.push(f);
}

if (fs.existsSync(path.join(ROOT, 'hll.jpg'))) {
  app.copy(path.join(ROOT, 'hll.jpg'), 'hll.jpg');
  app.log.push('hll.jpg           (brand mark)');
}
app.log.push('vendor/           (' + app.copyTree('vendor') + ' files)');
app.log.push('icons/            (' + app.copyTree('icons') + ' files)');
/* no release/ — putting 160 MB of installers inside a 6 MB phone app would be
   daft, and the downloads page there says so rather than offering a dead link */

for (const p of [site, app]) {
  console.log('\n' + path.basename(p.dir) + '/ built:');
  p.log.forEach((l) => console.log('  ' + l));
  console.log('  ---');
  console.log('  ' + (p.size() / 1024).toFixed(0) + ' KB total');
}
