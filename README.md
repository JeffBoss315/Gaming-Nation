# Gaming Nation Trucker

The Gaming Nation driver client. It watches Euro Truck Simulator 2 over the
telemetry link, records each run you finish, and syncs the result to your HLL driver
record. Ships in four forms from the same source:

| Form | What you get | Command |
|---|---|---|
| **Web** | Open it in any browser | open `tracker.html` |
| **Android app** | Real installable `.apk` | `npm run android` |
| **Installable web app** | Home-screen icon, offline, iOS + desktop | `npm run serve`, then Install |
| **Windows executable** | Packaged `.exe`, no browser involved | `npm run dist` |

The companion web platform is `index.html` for the drivers' site and `admin.html` for the
management console. Together with the client they make one **real-time VTC management
platform**: a driver launches the game and the console shows them online, on a job, and
how far along — with the run, the time at the wheel and the money it earned all recorded
against their name. See [Running the company](#2-running-the-company).

---

## 1. Live position from the game

The client reads the real truck through the SCS telemetry SDK and plots it on a map of the
ETS2 / ATS world, so it can tell on its own when a driver is **on the road delivering**.

### Set it up (once)

This project also supports the HLL Telemetry Bridge plugin. The plugin writes
SCS Protocol 6 frames to `Local\\HLLTelemetry`; the project-owned launcher
starts a compatible adapter and exposes the same HTTP API used by the client.
The adapter executable is intentionally separate because it owns the binary
Protocol 6 reader.

Place the adapter executable at `hll-telemetry-adapter.exe` in the project
folder, then run:

```bash
npm run telemetry
```

For an adapter installed elsewhere, set `HLL_TELEMETRY_ADAPTER` to its real
path or pass `--adapter "C:\\real\\path\\hll-telemetry-adapter.exe"`.
The launcher verifies `hll-scs-telemetry.dll`, passes it the map name, and
waits for `http://localhost:25555/api/ets2/telemetry` before reporting ready.

1. Install a telemetry server — the community **ETS2/ATS Telemetry Server**. It ships a
   plugin DLL plus a small server app.
2. Copy the plugin into the game:
   `<game>/bin/win_x64/plugins/scs-telemetry.dll`
   (create the `plugins` folder if it is not there). ATS uses the same path.
3. Start the server. It listens on **port 25555** and serves
   `http://localhost:25555/api/ets2/telemetry`.
4. Start the game and load a profile.

The client polls that endpoint once a second. **Live map** shows the source in its header:
*Live telemetry* when the game is answering, *Simulated* when it is not — it falls back to
the built-in simulator rather than showing nothing, so the app is always usable.

### What it detects

| Shown | Condition |
|---|---|
| On the road delivering | a job is loaded **and** speed ≥ 5 km/h |
| Stopped with a load | job loaded, standing still |
| Driving, no job | moving with an empty trailer |
| Game paused | the game reports paused |
| Parked | everything else |

Taking a job in game creates the run automatically, delivering it in game queues the run
for submission, and everything in between is read off the truck. No buttons.

### What it works out about the run

The raw frame says what the truck is doing this instant. The client turns that into what
the *run* is doing, which is the part a driver and a dispatcher actually want:

| | |
|---|---|
| **Distance driven** | integrated from the odometer, so it is still right when the sat-nav is off and does not jump when a route is recalculated. The game's "distance remaining" sets how long the run is |
| **Arrival time** | from a rolling average of the last five minutes of *movement*. Using current speed made the estimate read "never" at a red light |
| **Average and top speed** | kept for the run and filed with it |
| **A timeline** | picked up, quarter/half/three-quarters done, over the limit, took a knock, low on fuel, delivered — each stamped with the distance it happened at, shown live on the run card and filed with the finished run |

### Seeing the whole fleet, as it happens

Run the bundled service on any machine the drivers can reach:

```bash
npm run fleet            # listens on :7040, prints the address to hand out
```

Then in each client: **Live map → Fleet → Connect a service**, and paste that address.
The management console picks the same address up on its own when it is served from it.

**Nothing polls for the fleet any more.** Every client — the driver apps and both
websites — holds one stream open to the service (`GET /api/stream`, server-sent events),
and the service pushes down it the moment anything changes:

| Message | Sent when |
|---|---|
| `fleet` | a driver moved, or their run advanced |
| `event` | a run started, passed a milestone, hit trouble, landed or was called off |
| `company` | the shared record was written — a sign-up, a ticket, a dispatched load |

A driver taking a job in game shows up on everybody else's board in well under a second,
and their progress bar moves as they drive. A run landing announces itself. A sign-up on
one machine reaches the recruiter's console without either of them waiting for a poll.

The stream is one ordinary `GET`, so it goes through anything that passes HTTP, needs no
dependency, and the browser reconnects on its own. If it cannot be held open at all the
clients fall back to polling exactly as they did before — the "Fleet" indicator in the
status bar says **Live** or **Polling** so you can always tell which you are getting.

Positions are held in memory and expire after 90 seconds of silence, so a driver who
closes the game simply drops off the map. No database, no dependencies.

Check it end to end at any time:

```bash
npm run smoke:realtime   # the channel itself: open a stream, push, check it arrives
npm run smoke:liverun    # the whole chain, in one go
```

`smoke:liverun` is the one that proves the claim. It stands up a fake game, the real
service, a driver client in one window and the management console in another with its own
storage — two machines — then hands the driver a job and checks the run appears, that the
client works out the distance and arrival time, that it reaches the console without either
side polling, that the progress bar moves as the truck drives, and that delivering it
announces itself.

Leave the address empty and the map shows **simulated** drivers instead, clearly labelled —
useful for seeing how it looks before standing a server up.

Other drivers appear as named arrows, blue while they are hauling, with their run and speed
in the tooltip and on the board underneath. The **Fleet** button toggles them off.

### The map itself

ETS2's map is a compressed Europe and ATS is the western United States, so ordinary road
tiles make an accurate backdrop — real roads, real city names — with game positions
converted onto them. That is the default (**Road map**), and it needs lining up once:

**Live map → Calibrate** → park in a city, pick it from the list, save. Repeat in a second,
distant city. Two points solve the fit; it is stored per game. Pick cities far apart —
neighbouring towns cannot pin down the scale, and the client will say so.

Tiles come from OpenStreetMap by default, with the required attribution shown on the map.
That is fine for a VTC's traffic but it is a volunteer-run service — read the
[tile usage policy](https://operations.osmfoundation.org/policies/tiles/), and for anything
heavy point `worldTileUrl` at your own tile server or a commercial provider.

**Live map → Map** also offers two alternatives: your own rendered tile pyramid of the game
world (`{z}/{x}/{y}` template, calibrated by clicking where your truck is), or the built-in
schematic, which needs no tiles at all and works with no connection.

#### Using your own tile pyramid

If you have rendered tiles of the game world, point the client at them instead:

```
https://your-host/tiles/{z}/{x}/{y}.png      hosted
tiles/{z}/{x}/{y}.png                        a folder next to the app (works offline)
```

Tiles are rendered from the game's own map files. Generate your own from your installation,
or use a community tile server **you have permission to use** — please respect whoever
hosts them. No tile URL is shipped, so out of the box you get the schematic and nothing
external is contacted.

Once tiles are set the map becomes a proper slippy map: pan, zoom, a **Follow** toggle that
keeps the truck centred, an orange breadcrumb trail and a heading arrow. Leaflet is
vendored in `vendor/leaflet/` rather than loaded from a CDN, so the app still starts with no
connection.

Because the geometry of an arbitrary tile set is unknown, the client *learns* the transform
instead of assuming one: press **Calibrate**, click exactly where your truck is, drive a
good distance and click once more. Two points solve scale and offset exactly, stored per
game.

### Calibrating the schematic map

World coordinates depend on your game version and which map DLC you own, so the marker
starts from approximate constants. To make it exact: park in a city, open **Live map →
Calibrate**, choose that city, save the point — then do it once more in a **different**
city. Two points solve the scale and offset, and it is stored per game.

### On the phone

The phone is not the machine running the game, so `localhost` is wrong there. In
**Settings → Telemetry host**, put the PC's LAN address (e.g. `192.168.1.42`) and keep port
`25555`. Both devices must be on the same network, and the telemetry server has to be
reachable through the PC's firewall.

> The Android build allows cleartext HTTP and mixed content, because the telemetry server is
> a plain-HTTP service at an address only you know. `tools/android-network.js` applies that
> and is re-run by every build. Only truck position and speed cross your LAN.

## 2. Running the company

Gaming Nation is a VTC management platform, not a website with a map on it. Every action a
driver takes is captured by their client, written to the shared company record, and pushed
to the management console as it happens.

Stand the service up once and everything below follows:

```bash
npm run fleet            # the company: the shared record and the live channel
```

### Live Operations

**Console → Management → Live Operations** is the duty screen. It answers, in the order a
manager asks: who is on, what are they playing, what are they hauling, how far along, what
has it earned, and who is waiting on us.

Each driver's row is assembled from the three places that each know part of the answer:

| Source | What it knows | How fresh |
|---|---|---|
| the roster | who they are, what they have done, what they have earned | durable, syncs between machines |
| the live stream | where they are, how fast, the run they are on | this second, pushed |
| their sessions | whether the game is up, and for how long | opened and closed by their client |

None is enough alone — the stream only exists while a client is reporting, the record is a
minute behind, and a session says the game is up even when the truck is parked. Read
together they give a state that is actually true:

| Shown | Means |
|---|---|
| **On a job** | a run is loaded and the truck is moving |
| **Stopped** | a run is loaded, standing still |
| **Driving** | moving with nothing aboard |
| **In game** | the game is up, no client position yet |
| **Online** | the platform saw them recently, game not running |
| **Offline** | nobody has heard from them |

The roster, the dashboard and the operations board all read presence the same way, so they
cannot disagree with each other.

### Game sessions

A session is one sitting at the game. The driver's client opens one when it sees the game
come up and closes it when the game goes away — no button, and nothing for the driver to
remember. Each session accumulates what was done during it, because three hours logged in
with nothing delivered and three hours with six runs are different sittings and only the
record can tell them apart.

Sessions are held on the company record, so they are the company's history rather than
something one browser remembers. A client killed mid-session leaves one open; the platform
closes anything older than twelve hours rather than trusting an end that may never come.

### What is recorded for a run

Every delivery is written to the shared record with the job ID, origin, destination, cargo,
distance, payment, start and finish times, how long it took, the average speed held, and
its status. The run also carries its own timeline — picked up, milestones passed, anything
that went wrong, delivered.

### Money

The runs carry the money, so every earnings figure on the platform is summed back out of
them and they all agree:

* a driver's own record — all time, this month, this week, per run, per hour driven
* their session totals — what each sitting was worth
* company revenue — today, this week, this month, all recorded

Window figures are recomputed from the runs rather than counted up as they land, so a run
credited twice, a record merged from another machine or a clock that moved all come out
right on the next pass. A driver from an older install who has no earnings field recovers
their total from their finished runs rather than starting at zero.

### Who gets told, and when

The console is told rather than having to look:

| Event | Who hears | How |
|---|---|---|
| a driver registers | recruiters | notification + the recruitment queue |
| an application is filled in or replied to | recruiters | notification |
| a support request is raised | administrators | notification + toast |
| a reply on a support request | the other side of that thread | notification |
| a run starts, lands, or is called off | administrators | live feed, notification for the notable ones |
| a driver sits down to play or finishes | administrators | live feed |

Everything routine goes to the live feed; only what a manager would want interrupting them
becomes a stored notification, so the notification centre stays worth reading.

### Live Convoy Mode

A convoy was already a scheduled event here with a route, a leader, slots and a
registration list. None of that was replaced — what is new is the live half: what
happens while the convoy is actually rolling.

The split is deliberate. A convoy's **roster** lives on the company record, because it
has to survive and be identical on every machine. A convoy's **position picture** comes
from the same telemetry stream the fleet board already uses, because a driver on a convoy
is just a driver reporting, and giving convoys their own position feed would mean two
answers to the same question.

#### Statuses

| Shown | Means |
|---|---|
| **Scheduled** | on the calendar |
| **Starting soon** | within 30 minutes of departure — *derived from the clock*, never stored, so it cannot go stale |
| **Live** | rolling; started by a manager |
| **Completed** | ended by a manager; its statistics are frozen at that moment |
| **Cancelled** | called off; everyone registered is told |

#### Running one

Managers get **Start convoy**, **End convoy**, **Edit**, **Cancel**, **Announce**, and a
remove button on each participant row. Every one of them does the same three things in the
same order — change the record, write the convoy's own activity log, tell everyone holding
the live stream — which is what stops the board, the log and the notifications ever
disagreeing.

Drivers get the convoy list, the detail page, join and leave, the live board, the map and
the chat. `convoyControlAllowed()` is checked when an action *runs*, not only when its
button is drawn, so a driver calling it directly gets nowhere.

#### The live board and map

Every registered driver appears with their name, Gaming Nation ID, truck, game, online status,
speed, current job, nearest city and **distance from the convoy leader**. The leader is
marked on the board and drawn in gold on the map.

The map is the same Leaflet map, road network and truck markers the fleet map uses —
scoped to this convoy, with the route drawn over it. A driver who is not reporting
telemetry is shown as **Telemetry unavailable**, and is not drawn on the map at all.
Distance from the leader is only answered when both are actually reporting; an estimate
from a stale position looks like a fact and would be worse than saying nothing.

#### Chat

Convoy chat goes through the service and arrives on everyone's screen at once. It is held
in memory there with a ring buffer per convoy rather than on the company record: chat is
high volume and low value once the convoy is over, and putting it through the record's
merge cycle would make every message a full company write. What *is* kept for good is the
convoy's activity — who joined, who was removed, when it started and ended.

An **announcement** is a message that also reaches drivers who do not have the chat open,
as a notification. That is the whole difference between the two.

#### Identity, and why the service now decides it

Signing in was always a local matter: the browser checked the password against the account
it holds and set `state.user`. That is fine for deciding what to draw and worthless for
deciding what the service should believe — a page can set `state.user` to anything.

The service already held everything needed to do this properly. It has been storing the
accounts, their salts and their password hashes all along, and the roster with everyone's
role. It simply never looked. Now it does:

```
POST /api/auth/login    email + password, checked against the same salt and
                        hash the browser uses  ->  a bearer token

Authorization: Bearer   every write carrying an identity derives that identity
                        from the token, and ignores what the body claims
```

The digest is deliberately identical to the browser's, weak fallback included, so an account
made in either place verifies in the other. Signing in on the website now also gets a token,
with the same credentials, so a driver never types their password twice.

A driver can no longer post as somebody else however the client is edited, and cannot label
their own message as coming from control — the role on a message is decided server-side from
the roster too.

| Who | May |
|---|---|
| a driver on the convoy | read it, speak on it, delete their own messages |
| the convoy leader | the above, marked as leader |
| a manager (`events.manage`) | read and speak on any convoy, marked as control |
| a moderator (`convoy.moderate`) | delete anybody's message |
| anybody else | `403` — a convoy's chat is not a public channel |

This is backward compatible: with no token the older endpoints behave exactly as before, so
the connector and existing clients are untouched. Only the endpoints that carry an identity
require one. Signing in is the one write that cannot itself require the shared `HLL_API_KEY`
— a driver's browser has nowhere safe to keep one.

#### Chat is kept

Chat is a durable append-only log (`hll-convoy-chat.jsonl`), one JSON record per line,
appended and flushed **before** the request is answered — a `200` on a message is a promise
that it survives a restart. It is not a debounced rewrite of a whole file: a debounce loses
everything inside its window if the process dies, which is exactly the bug this replaced.
Appending is also O(1) rather than O(everything ever said).

Two record types: a message, and a tombstone marking one deleted, so a moderation is as
durable as the message it removed. A half-written line from a kill mid-append is skipped on
load rather than being fatal. The log is compacted at startup when it has drifted far from
what is live.

It is deliberately **not** in the company record. That record is a single document every
client reads whole, merges and writes back; chat in it would make every message a
full-company write and every company write drag the whole conversation along with it.

Reading is paged — fifty and a cursor, never everything — with **Load earlier messages** in
the UI. Sessions are written straight through for the same reason as messages, so a restart
does not sign everybody out.

#### Distance from the leader

Straight-line, and now labelled `direct` everywhere it appears. A convoy controller reading
14 km and finding 30 km of motorway between them is worse served by a confident wrong number
than by an honest rough one. Road distance would need a routing service; the game's own road
network is in `map-data.js` and could support one later. Until then nothing pretends, and
nothing waits on a network call that might not answer. Where either truck is not reporting,
the gap is stated as unknown rather than estimated from a stale position.

#### Statistics

Recorded per convoy: registered, actually connected, completed, attendance, turnout, start
and end times, duration, route distance, and the runs delivered by participants while it
was running. Runs are read off the existing job records rather than counted separately, so
a convoy can never disagree with the logbook. A finished convoy shows the figures frozen
when it ended; a running one shows them as they stand.

Each driver's profile gains a convoy record — registered, completed, led, attendance,
convoy distance — read off the convoys themselves rather than from a counter, so it cannot
drift from what actually happened.

```bash
npm run smoke:convoy    # two machines and a fake game, end to end
```

### A driver's history

**Driver profile → History** holds everything the company has recorded about one driver:
every run with what it paid, every game session with what was done in it, their earnings
broken down, their time at the wheel, and every support request they have raised. All of
it is read back out of the shared record, so it is the same history whichever machine is
looking at it.

### One API, four applications

The website, the management console, the Windows application, the Android app and the Game
Connector all speak to the same service. Something that happens in one is visible in the
others, because none of them keeps its own truth:

```
   Website        Console        Windows app      Android app      Game Connector
       \              \               |                /                /
        `--------------`------- Gaming Nation API --------'----------------'
                       fleet-server.js  ·  :7040
```

| Endpoint | Method | What it is for |
|---|---|---|
| `/api/stream` | GET | the live channel — everything below, pushed as it happens |
| `/api/company` | GET / PUT | the shared record: drivers, logins, applications, tickets, runs |
| `/api/fleet` | GET | every driver reporting a position right now |
| `/api/fleet/position` | POST | "here I am, and here is the run I am on" |
| `/api/fleet/event` | POST | a run started, landed, was called off; a driver came on or went off |
| `/api/jobs` | POST | file a finished run and credit the driver |
| `/api/jobs/id` | POST | allocate the next job number in the company sequence |
| `/api/drivers/:id` | GET | identify a driver, for a connector starting up |
| `/api/auth/login` | POST | exchange credentials for a bearer token |
| `/api/auth/me` | GET | who the service thinks you are |
| `/api/auth/logout` | POST | drop a token |
| `/api/convoy/message` | POST | say something to a convoy (token required) |
| `/api/convoy/message/delete` | POST | moderate a message |
| `/api/convoy/:id/chat` | GET | read a convoy, a page at a time |
| `/api/events` | GET | recent run events, for a client that cannot hold a stream open |
| `/status` | GET | the fleet in plain text, for a glance from a terminal |

**On WebSockets.** The live channel is server-sent events rather than WebSockets. It is a
persistent push connection with the same effect — nothing polls, the server pushes, and
changes arrive in well under a second — but it is one ordinary `GET`, it survives proxies
that WebSockets do not, the browser reconnects by itself, and it needs no dependency on
either end. Traffic here only ever flows outward to viewers, which is exactly what SSE is
for. If a client cannot hold the stream open at all, it falls back to polling and says so.

`POST /api/jobs` is idempotent on the job id: a connector that loses the answer will send
the run again, and it must not be paid twice for it.

---

## 3. The Game Connector

A small program on the driver's Windows PC that watches the game and reports it to
Gaming Nation. No window, no records of its own — it starts with Windows and is never thought
about again. The driver never tells anybody they are playing; the system knows.

```
GAME LAUNCHED  ->  driver identified  ->  Gaming Nation = ONLINE  ->  telemetry
                                                                     |
                        JOB STARTED  ->  tracked live  ->  DELIVERY COMPLETED
                                                                     |
                                                            driver history
```

```bash
npm run connector -- --service http://hll-host:7040 --driver HLL-1001
```

Or put the settings in `hll-connector.json` beside it and just run `npm run connector`:

```json
{ "service": "http://hll-host:7040", "driverId": "HLL-1001" }
```

`--help` lists the rest: the API key, which game, where the telemetry server is, how often
to read it, where the outbox lives.

### It identifies the driver before it reports anything

On startup it looks the driver up on the roster and greets them by name and record. A typo
in a config file is a message on startup, not a fortnight of runs filed against a driver
who does not exist:

```
  driver identified — Jeff Boss  (127 runs, 84291 km)
```

A driver who is not on the roster stops the connector with an explanation. A service that
is not answering yet does not — it starts anyway and keeps trying, because the game does
not wait for the network.

### Nothing is ever lost

A delivery is worth money, so nothing that matters is sent directly. It is written to an
outbox on disk first, sent, and removed only once Gaming Nation has confirmed it has it.

That means a driver finishing an €8,450 run while the service happens to be restarting
loses nothing. Neither does one whose network drops, or whose PC is switched off mid-queue
— the connector picks the queue back up the next time it starts. Sends back off and retry;
a request the service actively *refuses* is dropped once, loudly, rather than retried
forever.

Positions are deliberately **not** queued. A position is only worth anything while it is
current, and a stale one replayed ten minutes later would put a truck somewhere it no
longer is.

```
npm run smoke:outbox    # drives a whole run with the service down, then starts it
```

### Silence is not the same as leaving

Two different things, reported differently, because they mean different things to whoever
is watching the board:

| What happened | What Gaming Nation is told |
|---|---|
| the telemetry server stops answering | ⚠️ **CONNECTION LOST** — they may still be driving; we just cannot see them |
| it answers, and says the game is gone | **GAME CLOSED** — the session ends |
| it starts answering again | ✅ **CONNECTION RESTORED** |

A lost link that stays lost for 90 seconds is finally treated as a session ending, so
nobody sits on the board forever. One dropped read is never reported at all — it takes
three consecutive misses before the link is believed to be down.

### Job numbers come from Gaming Nation

The number is allocated by the API at the start of a run, so numbers run in one sequence
across the whole company and two drivers starting at the same moment cannot collide:

```
JOB STARTED  HLL-000284
```

If the service cannot be reached at that moment the run still starts, under a local number
marked `HLL-L…` that says so, and still lands when the queue drains.

### What it reads

| | |
|---|---|
| **Game** | launched, closed, paused, which title |
| **Driver** | online, offline, connection lost and restored |
| **Truck** | make and model, speed, heading, position, odometer |
| **Fuel** | percentage, litres, capacity |
| **Damage** | the worst of engine, transmission, cabin, chassis and wheels |
| **Trailer** | attached, name, mass, damage |
| **Job** | number, cargo, mass, origin, destination, both companies, distance, expected pay |
| **Progress** | distance driven, distance left, live ETA, percentage |
| **Driving time** | time actually moving, separate from time logged in |

A delivered run is filed with all of it plus its evidence, and is checked exactly as
strictly as one reported by the desktop client — see [Trusting the numbers](#4-trusting-the-numbers).

### Securing it

The service was built for a LAN, where everyone who can reach it is a driver. Now that a
connector can file a run worth money, that stops being good enough the moment it is
reachable from anywhere else.

```bash
HLL_API_KEY=some-long-random-string npm run fleet
```

With a key set, every write must carry it (`X-HLL-Key`); reads stay open, because the pages
that use them have nowhere to keep a secret. Give the connector the same key with `--key`.
With no key set the service behaves exactly as before, so a LAN setup keeps working with
nothing to configure — the startup banner says which mode it is in.

Writes are also rate limited per address (`HLL_RATE_CAP`, `HLL_RATE_PER_SEC`), so a client
stuck in a loop is answered with `429` instead of taking the service down.

This is a shared secret, not per-driver identity. It stops the service being written to by
something that is not yours. It is **not** a substitute for real accounts — see the note on
where this stack should go next.

---

## 4. Trusting the numbers

Once runs are recorded automatically they are worth money, and anything worth money is
eventually worth faking. So a delivery is not taken on trust. Every run arrives with what
the telemetry actually saw — how many frames were read, how many had the truck moving, how
far the odometer turned, the top and average speed, and what closed the job — and the
platform decides whether that story holds together.

The judging is on the platform, never in the client. A client can be patched; if it awarded
its own verification the check would be worth nothing. What a patched client can still do is
lie about the numbers, so every test is a test of the numbers against each other:

| Check | Fails when |
|---|---|
| Seen by telemetry | no frame was ever read for this run |
| Delivered in game | the job did not disappear from the game — something else closed it |
| The truck moved | almost no frame had it above 5 km/h |
| Odometer agrees | the distance driven and the distance claimed are far apart |
| Time taken is possible | the distance over the elapsed time implies an impossible average |
| Top speed is possible | faster than either game can go |
| Distance is possible | longer than any route in either game |
| Payment is in range | the rate per km is outside any plausible band |
| The clock behaves | finished before it started, or in the future |
| One run at a time | it overlaps another run by the same driver |

A run comes out **Verified** (everything passed), **Needs a look** (something is missing) or
**Flagged** (the numbers contradict each other). Runs recorded before this existed have
nothing to check and show as **Unchecked** rather than being accused of anything.

Flagged and unchecked runs collect on **Live Operations → Runs to check**, and clicking any
run anywhere shows the full working — every check, why it passed or did not, and exactly
what the client recorded. Nothing is auto-rejected: the platform surfaces the contradiction
and a human decides.

---

## 5. Just run it

Open `tracker.html`. Everything works from the filesystem — the offline worker and the
"Install" option are the only things that need a server (browsers only allow those on a
secure origin).

## 6. Install it as an app

```bash
npm run serve          # http://localhost:5173
```

`localhost` counts as a secure origin, so this is enough to install on this machine:

- **Chrome / Edge** — address-bar install icon, or menu → *Install Gaming Nation Trucker*.
- The app then opens in its own window with no browser chrome.

### On a phone

```bash
npm run serve:lan      # prints your LAN address
```

A plain `http://192.168.x.x` address is **not** a secure origin, so the phone will render
the app but will not offer *Install* and will not cache it for offline use. To install on a
phone, serve it over https — any of these work:

- publish the folder to any static host (GitHub Pages, Netlify, Cloudflare Pages);
- run a tunnel: `cloudflared tunnel --url http://localhost:5173`.

Then:

- **Android (Chrome)** — menu → *Install app*.
- **iOS (Safari)** — Share → *Add to Home Screen*.

Once installed it launches full-screen from the home screen, keeps its data locally, and
opens with no connection.

## 7. Build the Android app (.apk)

```bash
npm run android
```

Writes `dist-apk/Gaming-Nation-Trucker-<version>.apk`. The whole client is bundled inside the
package, so it runs with no server and no connection. Rebuild any time you change the web
files — the script refreshes `www/`, regenerates the launcher icons, syncs the native
project and assembles the APK (~30 s once warm).

The app is a [Capacitor](https://capacitorjs.com) shell around `www/`, configured in
`capacitor.config.json`. `www/` is generated — edit the files in the project root, not there.

### Getting it onto the phone

- **OneDrive / Drive** — this project already syncs, so open `dist-apk/` in the phone's
  OneDrive app, download the APK and tap it.
- **USB** — `adb install -r dist-apk/Gaming-Nation-Trucker-3.0.1.apk`
- **Anything else** — email it to yourself, or a USB cable and File Explorer.

Android will warn about installing outside the Play Store; allow it for the app you are
installing from. That is expected for a debug build.

### Toolchain

`npm run android` needs a JDK between 17 and 24 (Gradle 8.14 rejects newer ones) and the
Android SDK with `platforms;android-36` and `build-tools;36.0.0`. The script prints what it
picked and tells you what is missing. It looks in `%LOCALAPPDATA%\hll-android-tools` and
`%LOCALAPPDATA%\Android\Sdk` first, then `JAVA_HOME` / `ANDROID_HOME`.

> The Gradle **wrapper** (`gradlew`) downloads its distribution with a 10-second read
> timeout and fails on slower connections. The build script uses a local Gradle install when
> it finds one, which is why it works here.

### Release build

The APK above is signed with the debug key — fine for your own phone and the fleet, not for
the Play Store. For a release build, generate a keystore and run
`gradle assembleRelease` with the signing config in `android/app/build.gradle`.

### iPhone

Capacitor also targets iOS (`npx cap add ios`), but building an `.ipa` needs a Mac with
Xcode. On iOS use the installable web app instead — Share → *Add to Home Screen* gives a
home-screen icon and a full-screen app with no store involved.

## 8. Build the Windows executable

```bash
npm install            # once
npm run dist           # installer + portable exe -> dist/
```

Other targets: `npm run dist:portable`, `npm run dist:linux`, `npm run dist:mac`.

Produces two files:

| File | What it is |
|---|---|
| `Gaming Nation Trucker 1.0.0 x64.exe` | installer — Start menu, shortcut, uninstall entry |
| `Gaming Nation Trucker 1.0.0 portable.exe` | single file, no install; unpacks on launch (~10 s first start) |

Both are unsigned, so SmartScreen warns on first run — *More info → Run anyway*. To sign
them, set `CSC_LINK`/`CSC_KEY_PASSWORD` and remove `win.signAndEditExecutable: false` from
`package.json`.

> **Why that flag is there:** electron-builder otherwise downloads a code-signing toolchain
> containing macOS symlinks, which Windows refuses to unpack without Developer Mode or an
> elevated shell — the build fails with *"Cannot create symbolic link"*. Since nothing is
> being signed, skipping that step avoids the problem entirely.

> **OneDrive note** — this project sits in a OneDrive folder. OneDrive locks files while it
> syncs, which can make a rebuild fail with *"app.asar is being used by another process"*.
> Building to a path outside OneDrive avoids it:
> `npx electron-builder --win -c.directories.output=%LOCALAPPDATA%\hll-build`

## 9. Development

```bash
npm start              # run the desktop shell without packaging
npm run icons          # regenerate every icon from hll.jpg
npm run fleet          # the company service
npm run www            # rebuild the www/ payload
```

### Where builds go

`electron-builder` writes to `dist/` and the APK build to `dist-apk/`; both are working
directories and are not kept. **`release/` is the one that matters** — the three artifacts
the downloads page links to, named for their version, and the only place a build should be
picked up from. If you build to somewhere else to dodge a OneDrive lock (see the note
above), copy the result into `release/` and delete the scratch folder rather than leaving
it beside the project.

After cutting a release, bump `CLIENT_RELEASE` in `script.js` — the version and all three
filenames — so the downloads page points at what you actually built.

### Checking it still works

Six probes drive the real app in a real window and report what happened. None of them
touch your own profile or the deployable `www/`.

```bash
npm run smoke:realtime    # the live channel, in plain node — fastest check
npm run smoke:connector   # the Game Connector: fake game -> connector -> API -> record
npm run smoke:outbox      # a delivery survives Gaming Nation being down
npm run smoke:convoy      # Live Convoy Mode: manager, driver, connector, chat
npm run smoke:convoyauth  # identity, permissions and chat surviving a restart
npm run smoke:liverun     # a whole run: fake game -> client -> service -> console
npm run smoke:app         # the client: sign in, walk every screen, credit a delivery
npm run smoke:web         # the platform: every route, sign-up, approval, tickets
npm run smoke:company     # two machines sharing one company record
npm run smoke:errors      # clicks every control on all three pages, reports JS errors
npm run smoke:sites       # the drivers site and the console are separate sites
npm run smoke:recruit     # an application end to end
```

### Branding

`hll.jpg` in the project root is the single source of every icon. `npm run icons` derives
from it: the PWA icons, the maskable variant, the Apple touch icon, the Android launcher and
adaptive icons, the source art electron-builder turns into the Windows `.ico`, and
`icons/mark.png` — a crop of just the truck, used wherever the mark appears small enough
that the wordmark would be unreadable. Replace `hll.jpg` and re-run it to rebrand everything.

It uses `System.Drawing` via Windows PowerShell, so there is nothing to install.

### Files

| File | Purpose |
|---|---|
| `tracker.html` / `.css` / `.js` | the client itself |
| `manifest.webmanifest` | install metadata (name, icons, standalone window) |
| `sw.js` | offline app-shell cache — bump `CACHE` when shipping a change |
| `serve.js` | dependency-free static server for local install/testing |
| `fleet-server.js` | the company service: the shared record, live positions and the push stream (`npm run fleet`) |
| `electron-main.js` / `preload.js` | desktop shell + window controls |
| `hll.jpg` | brand artwork — the source for every icon |
| `tools/make-brand-icons.ps1` | derives all icons from `hll.jpg` |
| `tools/build-www.js` | assembles `www/` (the APK payload / deploy folder) |
| `tools/build-apk.js` | one-command Android build |
| `game-connector.js` | the Game Connector (`npm run connector`) |
| `tools/smoke-*.js` | the probes listed under *Checking it still works* |
| `tools/android-network.js` | lets the app reach the LAN telemetry server |
| `capacitor.config.json` | native shell config (app id, name, colours) |
| `index.html` / `style.css` / `script.js` | the Gaming Nation web platform |

### Where the telemetry comes from

`Telemetry` in `tracker.js` polls the real telemetry server and is authoritative when it
answers; `GameLink` is the simulator and stands down whenever live data is present, so the
two never fight over a run. `submitDelivery()` and `syncUploads()` are where the HLL API
calls belong.
