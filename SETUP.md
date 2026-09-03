# Heavyline Logistics — getting it running

Everything needed to take this from a fresh clone to a working platform.

---

## 1. Install

```bash
npm install
```

Node 20 or newer. No build step — the pages load `script.js` directly.

## 2. Set the database up

The platform keeps its company, drivers and applications in Supabase. One
script does the whole job:

1. Open your project → **SQL Editor**
2. Paste the contents of [`supabase/setup.sql`](supabase/setup.sql)
3. Run it

It is idempotent — safe on a fresh project, safe to re-run over an existing
one, and it drops nothing. It creates the three tables, the keys and indexes,
the `company` row the app reads on boot, the trigger that moves
`company.version`, and every row-level-security policy.

**The app does not work without this.** Supabase turns RLS on by default, and
a table with RLS on and no policy behind it answers every read with nothing
and refuses every write. That looks exactly like an empty database.

### Check it took

```sql
select id, driver_code, auth_user_id, full_name, email, role, status
  from public.drivers order by id;

select public.is_staff();      -- true when signed in as staff
```

## 3. Point the app at your project

`supabase-client.js` holds the two values:

```js
const SUPABASE_URL = 'https://<your-project>.supabase.co';
const SUPABASE_KEY = '<your publishable key>';
```

Both come from **Project Settings → API**. The publishable (anon) key is meant
to be public — RLS is what protects the data, which is why step 2 matters.

## 4. Run it

```bash
npm run serve
```

| | |
|---|---|
| Website | http://localhost:5173/ |
| Admin console | http://localhost:5173/admin.html |
| Driver client | http://localhost:5173/tracker.html |

`npm run serve:lan` serves on the local network as well, for testing on a phone.

## 5. Make the first account

Register on the website. The first account to register owns the company. That
one flow creates all four records:

```
Supabase Auth user  ──┐
                      │  user.id
drivers row  ─────────┘  auth_user_id, and hands back drivers.id
applications row         driver_id, as the HLL driver code
local record             what the platform actually draws with
```

Existing Auth users need their `drivers` row linked by hand — the row must
carry the right `auth_user_id`, or sign-in reports *"Your login is valid, but
your Heavyline driver account is not linked"*:

```sql
update public.drivers
set auth_user_id = '<uuid from Authentication → Users>',
    driver_code  = 'HLL001',
    role         = 'super_admin',
    status       = 'active'
where email = 'you@example.com';
```

`role` decides what someone may do. `recruitment.manage` needs level 4, so a
recruiter needs `recruiter`, `management`, `admin` or `super_admin` — a plain
`driver` sees no recruitment screen at all.

---

## Checking it works

```bash
npm run scan            # static audit: actions, icons, ids, packaging
```

The runtime sweep loads every page, walks every screen and clicks every
control, reporting anything the console complains about:

```bash
npm run smoke:errors
```

On Git Bash, clear the inherited Electron flag first, or it runs as plain Node
and fails on `app.setPath`:

```bash
env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe tools/smoke-errors.js .
```

A healthy run ends with `no errors` on all three pages.

---

## Troubleshooting

**`new row violates row-level security policy` (42501)** — step 2 has not been
run, or not for that table.

**`No company record found in Supabase`** — the `id = 1` row is missing. Step 2
inserts it.

**Applications list is empty but rows exist in the table editor** — RLS again.
`Staff can read every application` is the policy, and it depends on your
`drivers.role`.

**404s on `/api/company`, `/api/stream`, `/api/auth/login`** — a stale copy is
being served. `www/` and `app-www/` are build outputs and can be older than the
source; regenerate with `npm run www`. The live code calls Supabase, not
`/api`.

**Registration fails at "created but could not be read back"** — the row was
written but there is no `SELECT` policy letting the new user read it. Step 2.

---

## What is where

| Path | |
|---|---|
| `index.html` / `admin.html` | the website and the admin console |
| `script.js` | the whole platform — routing, screens, sync |
| `tracker.html` / `tracker.js` | the driver client |
| `supabase-client.js` | the shared Supabase browser client |
| `map-data.js` | cities, routes and map projection |
| `serve.js` | the static dev server |
| `supabase/setup.sql` | the complete database setup |
| `tools/scan.js` | static audit |
| `tools/smoke-*.js` | runtime harnesses |

### The company service

`fleet-server.js` is the self-hosted half of Heavyline: the live fleet
channel, convoy chat, run records and the driver identity the client signs in
with. Supabase holds the company record; this holds everything that has to be
live.

```bash
npm run fleet              # http://localhost:8787
npm run fleet -- --lan     # reachable from a phone on the same network
```

It serves the website too, and a page it serves is joined up automatically —
it sets `window.HLL_SERVICE` in the HTML it hands over, so no address has to
be typed anywhere. A page served by `npm run serve` or any other static host
does not get that marker and stays quiet rather than firing `/api` calls at
a host that has none.

Three JSON files beside it hold the state: `hll-company.json`,
`hll-sessions.json` and `hll-chat.json`. Override the paths with
`HLL_COMPANY_FILE`, `HLL_SESSION_FILE` and `HLL_CHAT_FILE`;
`http://localhost:8787/status` shows what it is doing.

### Test suite

Every suite passes. Run them all:

```bash
npm run smoke:realtime     # the live channel
npm run smoke:connector    # the game connector, end to end
npm run smoke:outbox       # a delivery surviving the service being down
npm run smoke:convoyauth   # identity, permissions, moderation, restart
npm run smoke:convoy       # a convoy across two machines
npm run smoke:company      # one company, two machines
npm run smoke:liverun      # a run from game to console
npm run smoke:errors       # every screen, every control, console errors
```

The Electron suites need the inherited flag cleared on Git Bash:

```bash
env -u ELECTRON_RUN_AS_NODE node_modules/electron/dist/electron.exe tools/smoke-convoy.js .
```

Any suite that registers somebody installs `tools/fake-supabase.js` in the
page first — an in-memory stand-in for the Supabase client. Registration goes
through Supabase Auth now, and pointing the tests at the real project would
leave a real Auth user and a real drivers row behind on every run. Each window
gets its own, so two windows share nothing through Supabase and whatever
crosses between them has to cross through the company service, which is what
those tests are actually about.

---

## Publishing it, free

### heavyline.com is not available

Checked against the registry rather than assumed:

```
heavyline.com   registered 2013-08-28, expires 2027-08-28
                registrar  TurnCommerce / NameBright
                nameservers DOMAIN-FOR-SALE.HUGEDOMAINSDNS.COM
```

It is parked with a domain broker and listed for sale, which typically means
four figures. There is no free route to that exact name, and nothing in this
repository can change that.

### What free actually gets you

**Hosting is free. A .com is not.** Any of these publish the site at no cost,
with HTTPS, and all of them are indexed by Google perfectly well:

| Host | Free address | Config in repo |
|---|---|---|
| Cloudflare Pages | `heavyline.pages.dev` | none needed — point it at `www/` |
| Netlify | `heavyline.netlify.app` | [netlify.toml](netlify.toml) |
| Vercel | `heavyline.vercel.app` | [vercel.json](vercel.json) |
| GitHub Pages | `<you>.github.io/hll` | [.github/workflows/pages.yml](.github/workflows/pages.yml) |

A `.pages.dev` address ranks on its own merits. If you want a real domain
later, all four support custom domains free — you pay only the registrar.

### If you want a domain, these were free to claim when checked

`heavyline.com` is gone, but the name is not:

```
heavyline.net   AVAILABLE
heavyline.org   AVAILABLE
heavyline.co    AVAILABLE
heavyline.gg    AVAILABLE      (fitting for a gaming VTC)
```

Around £10–35 a year depending on the ending. Availability changes daily —
check before you plan around it.

### Setting the address

One value, in [site.config.json](site.config.json):

```json
{ "siteUrl": "https://heavyline.pages.dev" }
```

Then `npm run www`. The build writes the canonical link, the Open Graph and
Twitter cards, the JSON-LD, `robots.txt` and `sitemap.xml` from it, and a
`CNAME` file when the host is a real domain.

**Leave it empty until you control the address.** With it empty the build
writes no canonical at all, which is deliberate: a canonical URL pointing at a
host you do not own tells Google the real version of your page is over there,
and it will rank that instead of yours. For a domain parked on a for-sale page
that is the worst possible outcome. No canonical is far better than a wrong one.

### If the site will not load for you

It is published at `https://jeffboss315.github.io/heavyline/` and it works —
verified by fetching it from outside this network, which returns the page,
`robots.txt` and `sitemap.xml` correctly.

If it times out for **you**, the site is not the problem: some networks cannot
route to GitHub Pages. `*.github.io` resolves to four fixed addresses
(`185.199.108–111.153`) and a number of ISPs simply do not carry them. The
symptom is a timeout — "took too long to respond" — never a 404.

Check it in one minute: open it on mobile data instead of wifi. If it loads
there, it is the network.

**The fix is to publish somewhere reachable.** Cloudflare Pages answers from
whichever of its edges is nearest, on addresses that are effectively never
blocked, and it is free:

1. [dash.cloudflare.com](https://dash.cloudflare.com) → Workers & Pages →
   Create → Pages → Connect to Git
2. Pick `JeffBoss315/heavyline`
3. Build command: `node tools/build-www.js` — **not** `npm run www`, which
   runs the release audit and fails on a clean checkout
4. Output directory: `www`

That publishes to `https://heavyline.pages.dev` — free, reachable, and it
carries the name.

Then change one line in [site.config.json](site.config.json):

```json
{ "siteUrl": "https://heavyline.pages.dev" }
```

and push. The canonical, the cards, the sitemap and `robots.txt` are all
regenerated from it — and on `pages.dev` the site sits at a host root, so
`robots.txt` is honoured there, which it is not on a GitHub project page.

Both can run at once. Two hosts serving the same site is fine as long as the
canonical names one of them, which is exactly what that one line decides.

### Then ask Google to look

1. Publish, and confirm the site loads over HTTPS.
2. Verify the address in [Google Search Console](https://search.google.com/search-console).
3. Submit `<your address>/sitemap.xml`.

That third step is what actually starts indexing. Without it you are waiting to
be found by accident. Expect days to weeks, not hours.

### A caveat worth knowing

This is a single-page app: the server returns the same HTML for every route and
JavaScript draws the rest. Google does run JavaScript, but on a second pass that
can lag, and the hash routes (`#/convoys`, `#/drivers`) are not separate URLs —
a crawler asking for one gets the landing page back. So what gets indexed is the
landing page and its `<noscript>` content.

That is enough to be found by name. Ranking for what the company *does* would
need real pages at real paths, which is a build change rather than a tag change.
