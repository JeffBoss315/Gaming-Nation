/* ============================================================
   Publish www/ to Cloudflare Pages, and make the project if it is
   not there.

     npm run deploy:cf

   TWO WAYS TO BE ALLOWED, AND THE FIRST ONE NEEDS NO SECRET

   1. npx wrangler login

      Opens a browser, you approve it, and wrangler keeps the
      credential itself. Nothing is printed, nothing is pasted, and
      there is no token lying around to leak. This is the one to use
      on your own machine, and it is the default here.

   2. CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID

      For CI, where no browser exists. If they are set this script
      uses them and checks the token can actually WRITE before it
      uploads anything — see below.

   A token is a bearer credential: whoever holds it is you. It should
   exist in exactly two places, a password manager and the CI secret
   store, and nowhere a person can read it — not a file, not a
   commit, not a chat window. Anything shown elsewhere is spent and
   wants deleting at My Profile → API Tokens.

   WHY THE WRITE CHECK IS WORTH A REQUEST

   A token with Pages set to READ authenticates perfectly, lists the
   project, and prints the account name — then fails on the one
   endpoint that matters with

     Authentication error [code: 10000]

   which reads like a bad token and is really a permission that says
   Read where it needs to say Edit.
   ============================================================ */
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DIR = path.join(ROOT, 'www');
const PROJECT = (process.env.GMN_CF_PROJECT || process.env.HLL_CF_PROJECT) || 'gaming-nation';

const TOKEN = process.env.CLOUDFLARE_API_TOKEN;
const ACCOUNT = process.env.CLOUDFLARE_ACCOUNT_ID;

const NPX = process.platform === 'win32' ? 'npx.cmd' : 'npx';

function die(msg) {
  console.error('\n' + msg + '\n');
  process.exit(1);
}

/* wrangler, with whatever credential is going. Output captured so the
   caller can read it; pass loud:true to let the user watch instead. */
/* npm's own npx script, which node can launch directly. */
const NPX_CLI = path.join(path.dirname(process.execPath),
  'node_modules', 'npm', 'bin', 'npx-cli.js');

function wrangler(args, loud) {
  const argv = ['--yes', 'wrangler@4'].concat(args);

  /* Go through node rather than the npx.cmd shim.

     Node refuses to spawn .cmd and .bat files unless shell:true is set -
     the fix for CVE-2024-27980, in Node 18.20.2, 20.12.2 and 21.7.3. So
     spawnSync('npx.cmd', ...) returns EINVAL and a null status on every
     up-to-date Windows machine, and this script read that null as "not
     authenticated" and told the operator to run `wrangler login`. They had
     already run it. They were logged in. The deploy could not have worked
     from Windows at all, and the message sent them to fix the one thing
     that was not broken.

     Spawning node with the npx script keeps the argument array intact, so
     a project path with spaces in it - this one has two - still works,
     which is exactly what shell:true would put at risk. */
  const viaNode = fs.existsSync(NPX_CLI);

  return spawnSync(
    viaNode ? process.execPath : NPX,
    viaNode ? [NPX_CLI].concat(argv) : argv,
    {
      cwd: ROOT,
      encoding: 'utf8',
      stdio: loud ? 'inherit' : 'pipe',
      env: process.env,
      /* only as a fallback, and only where it is the sole option */
      shell: !viaNode && process.platform === 'win32',
    });
}

/* Nothing to publish is worth catching here: a deploy of an empty
   directory takes the live site down. */
if (!fs.existsSync(DIR) || !fs.readdirSync(DIR).length) {
  die('www/ is empty or missing. Run "npm run www" first — deploying an\n'
    + 'empty directory would take the live site down.');
}

(async () => {

  /* ---- 1. are we allowed to do anything at all? ---- */

  if (TOKEN && ACCOUNT) {
    const api = 'https://api.cloudflare.com/client/v4/accounts/' + ACCOUNT
      + '/pages/projects/' + PROJECT;
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

    /* A project that is not there is no longer fatal — it is the thing
       this script now fixes. Anything else wrong with the credential
       still is. */
    const missing = !read.success
      && (read.errors || []).some((e) => e.code === 8000007 || /not found/i.test(e.message || ''));

    if (!read.success && !missing) {
      die('Cloudflare will not read the "' + PROJECT + '" project:\n\n  '
        + (read.errors || []).map((e) => e.code + ': ' + e.message).join('\n  ')
        + '\n\nCheck the token and the account id.');
    }

    if (!missing) {
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
      console.log('token can write to Pages.');
    }

  } else {
    const who = wrangler(['whoami']);
    const text = (who.stdout || '') + (who.stderr || '');

    if (who.status !== 0 || /not authenticated|you are not logged in/i.test(text)) {
      die('Not signed in to Cloudflare, and no CLOUDFLARE_API_TOKEN set.\n\n'
        + 'The easy way, which creates no secret to look after:\n\n'
        + '    npx wrangler login\n\n'
        + 'That opens a browser, you approve it once, and wrangler keeps the\n'
        + 'credential itself. Then run this again.\n\n'
        + 'For CI, set CLOUDFLARE_API_TOKEN and CLOUDFLARE_ACCOUNT_ID instead.');
    }

    console.log('signed in to Cloudflare through wrangler login.');
  }

  /* ---- 2. does the project exist? ---- */

  const list = wrangler(['pages', 'project', 'list']);
  const listing = (list.stdout || '') + (list.stderr || '');

  /* A word-boundary match, so "gaming-nation" does not match
     "gaming-nation-staging" and quietly deploy to the wrong place. */
  const exists = new RegExp('(^|\\s)' + PROJECT.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\s|$)', 'm')
    .test(listing);

  if (!exists) {
    console.log('\nThere is no Pages project called "' + PROJECT + '" on this account.');
    console.log('Creating it, with main as the production branch.\n');

    const made = wrangler(
      ['pages', 'project', 'create', PROJECT, '--production-branch=main'], true);

    if (made.status !== 0) {
      die('Could not create the "' + PROJECT + '" project.\n\n'
        + 'If Cloudflare says the name is taken, it has been claimed by\n'
        + 'another account — a released pages.dev name goes to whoever asks\n'
        + 'for it next. In that case pick a new name, set siteUrl in\n'
        + 'site.config.json to match, and run this again with\n\n'
        + '    GMN_CF_PROJECT=<the-new-name> npm run deploy:cf');
    }

    console.log('\nCreated. The address is https://' + PROJECT + '.pages.dev');
    console.log('DNS for a brand new pages.dev name can take a minute to answer.\n');
  }

  /* ---- 3. publish ---- */

  console.log('deploying ' + fs.readdirSync(DIR).length + ' entries from www/\n');

  /* From the repository root, not from www/, because that is where
     wrangler looks for functions/ — the download gate is a Pages
     Function and deploying the folder alone would leave it behind. */
  const r = wrangler(
    ['pages', 'deploy', 'www',
      '--project-name=' + PROJECT, '--branch=main', '--commit-dirty=true'], true);

  process.exit(r.status === null ? 1 : r.status);
})();
