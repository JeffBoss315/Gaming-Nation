/* ============================================================
   Zero-dependency static server.

     node serve.js              -> http://localhost:5173  (installable)
     node serve.js --lan        -> also listens on your LAN IP, for phone testing
     node serve.js --port 8080

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

const server = http.createServer((req, res) => {
  let pathname;
  try { pathname = decodeURIComponent(new URL(req.url, 'http://x').pathname); }
  catch (e) { res.writeHead(400); res.end('Bad request'); return; }

  /* The root of the site is the drivers' website. The client is a download,
     not a page to wander onto — it is reachable here only because this is the
     development server, and it is not part of the published site. */
  if (pathname === '/') pathname = '/index.html';

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
    '  Heavyline Logistics — dev server',
    '  ----------------------------------',
    '  Website:  ' + base + '/',
    '  Console:  ' + base + '/admin.html',
    '',
    '  The tracking client ships as a download, not as part of the site.',
    '  For development only it can be opened directly:',
    '            ' + base + '/tracker.html',
  ];
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
