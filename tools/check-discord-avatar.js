/* ============================================================
   Post one verification card to the crew channel.

     node tools/check-discord-avatar.js          what it would send
     node tools/check-discord-avatar.js --send   actually send it

   WHY THIS EXISTS. The driver photo on a delivery card cannot be
   proved from here: it needs a real driver, a real photo and the
   real channel, and the only cards in the channel are whatever
   has been driven. "It will work on your next delivery" is not an
   answer somebody can check.

   So this sends ONE card, and it is plainly a check rather than a
   delivery - no route, no distance, no income. Nobody reading the
   channel should mistake it for a run somebody drove. That is the
   whole reason it is not simply a job.delivered event with made-up
   numbers, which is what filled this channel with fake Hamburg
   runs in the first place.

   The photo is read from the client's own store on this machine -
   the same value cardAvatar() sends - and uploaded with the card
   as multipart, exactly as fleet-server does it. If it appears in
   Discord, the path works end to end.
   ============================================================ */
'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const https = require('https');
const http = require('http');
const crypto = require('crypto');

const ROOT = path.resolve(__dirname, '..');
const SEND = process.argv.indexOf('--send') > -1;

/* ---- the webhook, from the company's own file ---- */
const readJSON = (p, alt) => {
  try { return JSON.parse(fs.readFileSync(p, 'utf8').replace(/^﻿/, '')); }
  catch (e) { return alt; }
};
const WEBHOOK = String(process.env.GMN_DISCORD_WEBHOOK
  || (readJSON(path.join(ROOT, 'gmn-discord.json'), {}) || {}).webhook || '').trim();

/* ---- the driver and the photo, out of the installed client's store ----

   Chromium keeps localStorage in a LevelDB, and the values are plain text
   inside it. Read rather than parsed: this only has to find one key. */
function fromClientStore() {
  const dir = path.join(process.env.APPDATA
    || path.join(os.homedir(), 'AppData', 'Roaming'),
    'Gaming Nation Trucker', 'Local Storage', 'leveldb');

  let blob = '';
  try {
    blob = Buffer.concat(fs.readdirSync(dir)
      .filter((f) => /\.(ldb|log)$/.test(f))
      .map((f) => fs.readFileSync(path.join(dir, f))))
      .toString('latin1').replace(/\u0000/g, '');
  } catch (e) {
    return { error: 'no client store at ' + dir };
  }

  /* The whole store, and the LAST of each - not a window anchored on the
     storage key. LevelDB appends: the key can appear in an older, smaller
     record while the value that matters was written after it, so slicing
     forward from the key finds an out-of-date record or nothing at all.
     That is what this did, and it reported "no photo" on a machine that
     has one. */
  const last = (re) => {
    let m, out = '';
    const g = new RegExp(re.source, 'g');
    while ((m = g.exec(blob))) out = m[1];
    return out;
  };

  return {
    name: last(/"name":"([^"]{1,60})"/),
    code: last(/"gmnId":"([^"]{1,40})"/),
    photo: last(/"avatar":"(data:image\/(?:png|jpe?g|gif|webp);base64,[A-Za-z0-9+/=]{200,})"/),
  };
}

const who = fromClientStore();
if (who.error) { console.log('\n' + who.error); process.exit(1); }

const author = [who.name, who.code].filter(Boolean).join(' · ') || 'Gaming Nation';
const m = /^data:image\/(png|jpe?g|gif|webp);base64,(.+)$/.exec(who.photo || '');
const pic = m ? { ext: m[1].toLowerCase() === 'jpg' ? 'jpeg' : m[1].toLowerCase(),
                  buf: Buffer.from(m[2], 'base64') } : null;

console.log('\nverification card');
console.log('  driver  : ' + (author || '(none found)'));
console.log('  photo   : ' + (pic ? Math.round(pic.buf.length / 1024) + ' KB ' + pic.ext
  : 'NONE — the card would carry initials'));
console.log('  channel : ' + (WEBHOOK ? 'configured' : 'NOT CONFIGURED'));

if (!WEBHOOK) { console.log('\nNo webhook, so nothing to send.'); process.exit(1); }
if (!SEND) { console.log('\nNothing was sent. Run again with --send.'); process.exit(0); }

const card = JSON.stringify({
  username: 'Gaming Nation',
  embeds: [{
    author: { name: author, icon_url: pic ? 'attachment://avatar.' + pic.ext : undefined },
    title: 'Profile photo check',
    description: pic
      ? 'If the picture beside the name above is yours, driver photos are working on delivery cards.'
      : 'No photo is set on this driver, so cards will carry initials.',
    color: 0x8bd62b,
    footer: { text: 'A check, not a delivery — nothing was driven' },
    timestamp: new Date().toISOString(),
  }],
});

let payload, type;
if (pic) {
  const CRLF = '\r\n';
  const b = '----gmn' + crypto.randomBytes(12).toString('hex');
  const name = 'avatar.' + pic.ext;
  const head = Buffer.from(
    '--' + b + CRLF
    + 'Content-Disposition: form-data; name="payload_json"' + CRLF
    + 'Content-Type: application/json' + CRLF + CRLF
    + card + CRLF
    + '--' + b + CRLF
    + 'Content-Disposition: form-data; name="files[0]"; filename="' + name + '"' + CRLF
    + 'Content-Type: image/' + pic.ext + CRLF + CRLF, 'utf8');
  payload = Buffer.concat([head, pic.buf, Buffer.from(CRLF + '--' + b + '--' + CRLF, 'utf8')]);
  type = 'multipart/form-data; boundary=' + b;
} else {
  payload = Buffer.from(card, 'utf8');
  type = 'application/json';
}

const url = new URL(WEBHOOK);
const send = url.protocol === 'http:' ? http : https;
const req = send.request({
  hostname: url.hostname,
  port: url.port || (url.protocol === 'http:' ? 80 : 443),
  path: url.pathname + url.search,
  method: 'POST',
  headers: { 'content-type': type, 'content-length': payload.length },
}, (res) => {
  res.resume();
  console.log('\nDiscord answered HTTP ' + res.statusCode
    + (res.statusCode === 204 || res.statusCode === 200 ? ' — sent' : ' — refused'));
});
req.setTimeout(8000, () => { req.destroy(); console.log('\nDiscord did not answer'); });
req.on('error', (e) => console.log('\ncould not reach Discord: ' + e.message));
req.end(payload);
