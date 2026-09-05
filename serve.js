/* ============================================================
   Zero-dependency static server.

     node serve.js              -> http://localhost:5173  (installable)
     node serve.js --lan        -> also listens on your LAN IP, for phone testing
     node serve.js --port 8080
     node serve.js --no-watch   -> without live reload

   Saving a file reloads the page that is open on it. This server hands
   out the project directory as it stands, so an edit is already the
   thing being served — the only missing part was the browser finding
   out, and that is all the watcher below does.

   A stylesheet is swapped in place rather than reloaded, so the screen
   you were looking at, the form you had half filled in and the route
   you were on all survive a CSS change.

   Why this exists: service workers and "Install app" need a *secure
   context*. http://localhost counts as secure, so installing on this
   machine works. A phone hitting http://192.168.x.x does NOT count as
   secure — see the note printed on start.
   ============================================================ */
const http = require('http');
const fs = require('fs');
const path = require('path');
const os = require('os');

const args = process.argv.slice(2);
const portArg = args.indexOf('--port');
const PORT = portArg > -1 ? Number(args[portArg + 1]) : 5173;
const LAN = args.includes('--lan');
const WATCH = !args.includes('--no-watch');
const ROOT = __dirname;

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.csv': 'text/csv; charset=utf-8',
  '.map': 'application/json; charset=utf-8',
};

/* ============================================================
   Live reload
   ============================================================ */

const RELOAD_PATH = '/__hll_reload';

/* Open EventSource responses. Held so a save can be announced, dropped
   on close — a browser tab that goes away must not keep a socket here
   for the life of the server. */
const listeners = new Set();

/* Injected before </head>. Deliberately tiny and dependency-free.

   EventSource reconnects by itself, so a server restart brings the page
   back without anybody touching it. The only thing worth handling is the
   message itself: a stylesheet is re-fetched in place, anything else is
   a reload. */
const CLIENT = [
  '<script>',
  '(function () {',
  '  if (window.__gmnReload) return;',
  '  window.__gmnReload = true;',
  '  var es = new EventSource(' + JSON.stringify(RELOAD_PATH) + ');',
  '  es.onmessage = function (e) {',
  '    if (e.data === "css") {',
  '      /* swap every stylesheet, keeping the page exactly as it is */',
  '      var links = document.querySelectorAll(\'link[rel="stylesheet"]\');',
  '      for (var i = 0; i < links.length; i++) {',
  '        var l = links[i];',
  '        var href = l.href.split("?")[0];',
  '        l.href = href + "?v=" + Date.now();',
  '      }',
  '      return;',
  '    }',
  '    location.reload();',
  '  };',
  '})();',
  '</script>',
].join('\n');

function announce(kind) {
  for (const res of listeners) {
    try { res.write('data: ' + kind + '\n\n'); } catch (e) { listeners.delete(res); }
  }
}

/* What the browser actually loads. Watching the whole tree would fire on
   node_modules, on .git, and — worse — on www/ and app-www/, which the
   build writes into: a build would then trigger a reload that triggered
   a build. */
const WATCHED_DIRS = ['', 'vendor', 'icons'];
const WATCHED_EXT = ['.html', '.css', '.js', '.webmanifest', '.jpg', '.png', '.svg'];

function startWatching() {
  /* Editors save by writing a temporary file and renaming it, so one save
     can arrive as several events. Collapse them, and remember whether the
     burst was only CSS. */
  let timer = null;
  let cssOnly = true;

  const touched = (name) => {
    if (!name) return;
    const ext = name.slice(name.lastIndexOf('.')).toLowerCase();
    if (!WATCHED_EXT.includes(ext)) return;

    if (ext !== '.css') cssOnly = false;

    clearTimeout(timer);
    timer = setTimeout(() => {
      const kind = cssOnly ? 'css' : 'reload';
      cssOnly = true;
      if (listeners.size) {
        console.log('  ' + name + ' changed -> ' + kind
          + ' (' + listeners.size + ' tab' + (listeners.size === 1 ? '' : 's') + ')');
      }
      announce(kind);
    }, 60);
  };

  for (const rel of WATCHED_DIRS) {
    const dir = rel ? path.join(ROOT, rel) : ROOT;
    if (!fs.existsSync(dir)) continue;
    try {
      /* Not recursive at the root: that would descend into node_modules and
         www/. vendor/ and icons/ are small enough to watch whole. */
      fs.watch(dir, { recursive: !!rel }, (_event, name) => touched(name));
    } catch (e) {
      console.warn('  could not watch ' + (rel || '.') + ': ' + e.message);
    }
  }
}

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch (e) { res.writeHead(400); res.end('Bad request'); return; }

  /* Before the fs.stat below, which 404s anything that is not a file. */
  if (pathname === RELOAD_PATH) {
    if (!WATCH) { res.writeHead(404); res.end(); return; }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      /* the page is same-origin, but a proxy in between must not buffer */
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 500\n\n');
    listeners.add(res);

    /* Something has to travel periodically or an idle connection is closed
       by whatever is in the middle, and the tab stops hearing about saves
       without ever being told. A comment is not a message. */
    const beat = setInterval(() => {
      try { res.write(': ping\n\n'); } catch (e) { /* closed */ }
    }, 25000);

    const drop = () => { clearInterval(beat); listeners.delete(res); };
    req.on('close', drop);
    res.on('close', drop);
    return;
  }

  /* The root of the site is the drivers' website. The client is a download,
     not a page to wander onto — it is reachable here only because this is the
     development server, and it is not part of the published site. */
  if (pathname === '/') pathname = '/login.html';

  /* keep requests inside the project directory */
  const filePath = path.join(ROOT, path.normalize(pathname));
  if (!filePath.startsWith(ROOT)) { res.writeHead(403); res.end('Forbidden'); return; }

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('404 — ' + pathname);
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    const headers = { 'Content-Type': TYPES[ext] || 'application/octet-stream' };

    /* Code must never be served stale. This is the development server: an hour
       of browser caching on script.js means an edit does not land on reload,
       and the copy that sticks is whatever was fetched first. Only assets that
       are replaced rather than edited keep a max-age. */
    const CODE = ['.html', '.js', '.css', '.webmanifest', '.json', '.map'];
    headers['Cache-Control'] = CODE.includes(ext) ? 'no-cache' : 'public, max-age=3600';
    if (filePath.endsWith('sw.js')) headers['Service-Worker-Allowed'] = '/';

    /* An HTML page carries the reload client. It has to be read rather than
       streamed: Content-Length below is the length of what is actually sent,
       and sending stat.size after adding to the body truncates the page at
       the original byte count. */
    if (WATCH && ext === '.html') {
      fs.readFile(filePath, 'utf8', (readErr, html) => {
        if (readErr) {
          console.error('read failed:', pathname, readErr.message);
          res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('500');
          return;
        }
        const at = html.toLowerCase().lastIndexOf('</head>');
        const body = at === -1 ? html + CLIENT : html.slice(0, at) + CLIENT + '\n' + html.slice(at);
        headers['Content-Length'] = Buffer.byteLength(body);
        res.writeHead(200, headers);
        res.end(body);
      });
      return;
    }

    /* Say how long the body is. Without it the response is chunked, and a read
       that dies half way through looks to the browser like a complete file —
       which is how a half-written script.js ends up parsed, and cached. */
    headers['Content-Length'] = stat.size;

    res.writeHead(200, headers);

    const stream = fs.createReadStream(filePath);
    /* An unhandled 'error' here takes the whole server down mid-response and
       hands the browser a truncated file. Cut the connection instead, so the
       failure reads as a failure. */
    stream.on('error', (streamErr) => {
      console.error('read failed:', pathname, streamErr.message);
      res.destroy();
    });
    stream.pipe(res);
  });
});

const host = LAN ? '0.0.0.0' : '127.0.0.1';
server.listen(PORT, host, () => {
  const base = 'http://localhost:' + PORT;
  const lines = [
    '',
    '  Gaming Nation — dev server',
    '  ----------------------------------',
    '  Website:  ' + base + '/',
    '  Console:  ' + base + '/admin.html',
    '',
    '  The tracking client ships as a download, not as part of the site.',
    '  For development only it can be opened directly:',
    '            ' + base + '/tracker.html',
  ];
  if (WATCH) {
    startWatching();
    lines.push('');
    lines.push('  Saving a file reloads the page. A .css save is swapped in');
    lines.push('  place, so you keep the screen and the state you were on.');
  }
  if (LAN) {
    const nets = os.networkInterfaces();
    const ips = [];
    for (const name of Object.keys(nets)) {
      for (const n of nets[name] || []) {
        if (n.family === 'IPv4' && !n.internal) ips.push(n.address);
      }
    }
    lines.push('');
    ips.forEach((ip) => lines.push('  Phone:    http://' + ip + ':' + PORT + '/'));
    lines.push('');
    lines.push('  NOTE  A plain http:// LAN address is not a secure context, so the');
    lines.push('        phone will render the app but will NOT offer "Install" and');
    lines.push('        will not register the offline worker. To install on a phone,');
    lines.push('        serve it over https — any static host works, or run a tunnel');
    lines.push('        (e.g. cloudflared tunnel --url http://localhost:' + PORT + ').');
  }
  lines.push('');
  console.log(lines.join('\n'));
});
