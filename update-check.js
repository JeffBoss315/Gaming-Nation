/* ============================================================
   IS THIS COPY THE CURRENT ONE?
   ------------------------------------------------------------
   The website publishes the build it is offering at
   /version.json. This fetches it for the renderer.

   IT LIVES IN THE MAIN PROCESS for one reason: the client's
   pages are file://, so every cross-origin fetch they make is
   subject to CORS, and one missing header would turn this into
   a check that silently never answers - which on screen reads
   exactly like "you are up to date". The main process has no
   such rule. The site sends the header anyway, for the browser
   build, but nothing here depends on it.

   IT IS ITS OWN FILE so a test can require it. Registered
   inside electron-main it could only be exercised by starting
   the whole shell, and a check that reports "up to date" when
   it failed is precisely the bug worth a test.

   Never cached. A cached answer is a client that goes on
   insisting it is current for hours after a release.
   ============================================================ */
'use strict';

const http = require('http');
const https = require('https');

const TIMEOUT_MS = 6000;
/* A misconfigured host can answer 200 with a whole HTML page. Stop reading
   long before that is worth parsing. */
const MAX_BYTES = 64 * 1024;

function fetchFeed(feed) {
  return new Promise((resolve) => {
    let url;
    try { url = new URL(String(feed || '')); }
    catch (e) { return resolve({ error: 'that is not a URL' }); }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      return resolve({ error: 'only http and https' });
    }

    const send = url.protocol === 'http:' ? http : https;
    let done = false;
    const finish = (out) => { if (!done) { done = true; resolve(out); } };

    const req = send.request({
      hostname: url.hostname,
      /* explicitly, not by protocol default - the same trap the Discord
         post fell into, invisible against a real host on 443 */
      port: url.port || (url.protocol === 'http:' ? 80 : 443),
      path: url.pathname + url.search,
      method: 'GET',
      headers: { 'cache-control': 'no-cache', accept: 'application/json' },
    }, (res) => {
      if (res.statusCode !== 200) {
        res.resume();
        return finish({ error: 'the site answered HTTP ' + res.statusCode });
      }
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (c) => {
        body += c;
        if (body.length > MAX_BYTES) {
          req.destroy();
          finish({ error: 'that was not version.json' });
        }
      });
      res.on('end', () => {
        let feedJson;
        try { feedJson = JSON.parse(body); }
        catch (e) { return finish({ error: 'the answer was not JSON' }); }
        if (!feedJson || !feedJson.version) {
          return finish({ error: 'the answer named no version' });
        }
        finish({ ok: true, feed: feedJson });
      });
    });

    req.setTimeout(TIMEOUT_MS, () => {
      req.destroy();
      finish({ error: 'the site did not answer' });
    });
    req.on('error', (e) => finish({ error: e.message }));
    req.end();
  });
}

function register(ipcMain) {
  ipcMain.handle('app:latest', (_e, feed) => fetchFeed(feed));
}

module.exports = { fetchFeed, register };
