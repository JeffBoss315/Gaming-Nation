/* ============================================================
   Publish www/ to Cloudflare Pages.

     npm run deploy:cf

   Reads CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID from the
   environment. It checks the token can actually WRITE before it
   uploads anything, because the failure it is checking for is one
   the tools report badly.

   A token with Pages set to READ authenticates perfectly, lists the
   project, and prints the account name — then fails on the one
   endpoint that matters with

     Authentication error [code: 10000]

   which reads like a bad token and is really a permission that says
   Read where it needs to say Edit. Getting told that in one line, up
   front, is worth the extra request.
   ============================================================ */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'www');
const PROJECT = process.env.HLL_CF_PROJECT || 'heavyline';

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;

function die(msg) {
  console.error('\n' + msg + '\n');
  process.exit(1);
}

if (!TOKEN || !ACCOUNT) {
  die('Set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID first.\n\n'
    + '  PowerShell:  $env:CLOUDFLARE_API_TOKEN="..."; $env:CLOUDFLARE_ACCOUNT_ID="..."\n'
    + '  bash:        export CLOUDFLARE_API_TOKEN=...  CLOUDFLARE_ACCOUNT_ID=...');
}

/* Nothing to publish is worth catching here: a deploy of an empty
   directory takes the live site down. */
if (!fs.existsSync(DIR) || !fs.readdirSync(DIR).length) {
  die('www/ is empty or missing. Run "npm run www" first — deploying an\n'
    + 'empty directory would take the live site down.');
}

(async () => {
  const api = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT + '/pages/projects/' + PROJECT;
  const head = { Authorization: 'Bearer ' + TOKEN };

  const ask = async (url) => {
    try {
      const res = await fetch(url, { headers: head });
      return await res.json();
    } catch (e) {
      return { success: false, errors: [{ code: 0, message: e.message }] };
    }
  };

  const read = await ask(api);
  if (!read.success) {
    die('Cloudflare will not even read the "' + PROJECT + '" project:\n\n  '
      + (read.errors || []).map((e) => e.code + ': ' + e.message).join('\n  ')
      + '\n\nCheck the token and the account id.');
  }

  /* the endpoint every upload path goes through */
  const write = await ask(api + '/upload-token');
  if (!write.success) {
    die('This token can READ Pages but not WRITE to it.\n\n  '
      + (write.errors || []).map((e) => e.code + ': ' + e.message).join('\n  ')
      + '\n\nIn the Cloudflare dashboard open this token and change the\n'
      + 'Cloudflare Pages permission from Read to Edit. Editing a token\n'
      + 'does not change its value, so nothing else needs updating.\n\n'
      + 'Every deploy route — wrangler, the API and the GitHub Action —\n'
      + 'goes through this one endpoint, so none of them can work until\n'
      + 'it says Edit.');
  }

  console.log('token can write to Pages — deploying ' + fs.readdirSync(DIR).length + ' entries\n');

  const r = spawnSync(
    process.platform === 'win32' ? 'npx.cmd' : 'npx',
    ['--yes', 'wrangler@4', 'pages', 'deploy', 'www',
      '--project-name=' + PROJECT, '--branch=main', '--commit-dirty=true'],
    { cwd: ROOT, stdio: 'inherit', env: process.env });

  process.exit(r.status === null ? 1 : r.status);
})();
