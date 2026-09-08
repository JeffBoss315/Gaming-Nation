/* GMN telemetry adapter.

   The game does not talk to Gaming Nation. An SCS telemetry plugin, loaded
   inside Euro Truck Simulator 2 or American Truck Simulator, writes the
   state of the truck into a Windows shared-memory block many times a
   second. This program reads that block and serves it as JSON on
   127.0.0.1, which is the only thing the client knows how to ask.

   ------------------------------------------------------------------
   WHAT THE LAYOUT BELOW IS

   RenCloud/scs-sdk-plugin's scsTelemetryMap_t, the de-facto standard for
   ETS2 and ATS. It creates Local\SCSTelemetry (32 KB). Every field read
   here is byte-identical across revisions 10, 11 and 12, so the numbers
   pin the layout family but carry no revision information — this adapter
   must not claim to know which revision it is talking to, because it
   cannot.

   ------------------------------------------------------------------
   FIVE THINGS THAT WERE WRONG, AND THREE THAT MAKE THEM UNLIKELY AGAIN

   1. The map name. The first version opened one map written into the
      source as a constant, "Local\HLLTelemetry". Nothing creates that. The
      version after it probed two names — GMNTelemetry and HLLTelemetry —
      both invented by this project, so it fixed nothing while claiming in
      its own header to have fixed it. Local\SCSTelemetry, the name that
      actually exists, was in neither list.

   2. The string block was shifted by one field. Every name in this struct
      is preceded by its internal id twin, and the old offsets skipped that
      pairing from 2428 onward. So it read truckId as the truck model,
      truckName as the CARGO, cargoId as the destination, and so on. Only
      truckBrand at 2364 was ever right.

   3. Which made hasJob permanently true. It tested cargo, which was really
      truckName — and the plugin's set_job_values_zero() clears cargo,
      cityDst, citySrc and their ids when a job ends but never touches
      truckName. So the truck's model name sat there for ever, and this
      adapter reported a delivery in progress for anybody sitting in a
      truck, with a fabricated cargo and destination. In an app that pays
      drivers for deliveries, that is the worst way to be wrong.

   4. Everything it could not be bothered to read, it made up or dropped.
      heading was the literal 0, so every truck on every map pointed due
      north for ever. income was the literal 0, so no run had a payout.
      trailer.attached was "there is a job", which is not what that field
      means. And the fields that answer the question this whole program
      exists to answer — special_b.onJob, special_b.jobDelivered,
      config_ui.plannedDistanceKm — were never read at all, so the client
      was left inferring a job from whether some string was non-empty and
      guessing a route's length by watching the sat-nav. All of them were
      sitting at known offsets in a struct this file already had open.

   5. The one that only a running game could show. navigation distance is
      reported by the SDK in METRES, and this multiplied it by 1000 on the
      way out. A 208 km run left the adapter as 208,243 km remaining, and
      since the client works out progress by taking what is left away from
      the planned length, every delivery sat at 0% for its entire length -
      the exact symptom this whole file was being changed to fix. The
      offset was right; the unit was not. The synthetic test had the same
      wrong assumption written into it and passed happily.

   And the three things that make it unlikely again:

   EVERY map is gated before it is parsed. revision, game and sdkActive are
   checked against the values this layout must have, so "is this the struct
   I think it is" is answered at runtime instead of assumed. A map that
   opens but fails the gate is reported and not read.

   EVERY offset is checked by a test. tools/smoke-telemetry-offsets.py walks
   scs-telemetry-common.hpp field by field, summing sizes, and compares what
   it arrives at against the constants below — which were derived a
   completely different way, so agreement is evidence. It then writes a
   synthetic truck into a real shared-memory block and reads it back out
   through this program's own HTTP endpoint.

   AND IT HAS NOW BEEN READ AGAINST A LIVE GAME. Euro Truck Simulator 2,
   64-bit, telemetry_tb_64.dll writing Local\TelemetryTB. Every field below
   was checked against what the game's own HUD was showing at that moment:
   the cargo, both cities, the destination company, the truck, the fuel, the
   wear, the planned length, and the distance remaining - which is what
   caught number 5. Reading a live game is the only thing that finds a unit
   error, because a wrong unit is a perfectly plausible number.

   What is still NOT verified: the trailer zone at 6000, which nothing here
   parses, and every code path for American Truck Simulator, which has been
   read from the same struct but never against a running copy. The gate and
   the test remain what stand between "these offsets are probably right"
   and a fabricated delivery in somebody's logbook.
*/
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Net;
using System.Text;
using System.Text.Json;

var port = ReadPort(args);
var pinned = ReadMapName(args);

/* Names the app worked out by READING the plugin DLL installed in the game,
   passed in as --also-map. A name read out of the binary that writes it beats
   anything on a hardcoded list, so these are tried first. The list below is
   still there for anyone starting this by hand. */
var sources = Sources.Resolve(pinned, ReadExtraMaps(args));

using var listener = new HttpListener();
listener.Prefixes.Add($"http://127.0.0.1:{port}/");
listener.Start();

Console.WriteLine($"GMN telemetry adapter listening on http://127.0.0.1:{port}/");
Console.WriteLine("  probing: " + string.Join(", ", sources.ConvertAll(s => s.Map)));

while (true)
{
    var context = await listener.GetContextAsync();
    var path = context.Request.Url?.AbsolutePath ?? "";

    if (context.Request.HttpMethod == "GET" &&
        (path == "/api/ets2/telemetry" || path == "/api/ats/telemetry"))
    {
        Respond(context, ReadFrame(sources));
    }
    else if (context.Request.HttpMethod == "GET" && path == "/api/diagnostics")
    {
        Respond(context, Diagnose(sources));
    }
    else
    {
        context.Response.StatusCode = 404;
    }

    context.Response.Close();
}

static void Respond(HttpListenerContext context, object payload)
{
    var bytes = Encoding.UTF8.GetBytes(JsonSerializer.Serialize(payload));
    context.Response.ContentType = "application/json";
    context.Response.Headers["Access-Control-Allow-Origin"] = "*";
    context.Response.Headers["Cache-Control"] = "no-store";
    context.Response.ContentLength64 = bytes.Length;
    context.Response.OutputStream.Write(bytes, 0, bytes.Length);
}

static int ReadPort(string[] args)
{
    var value = Environment.GetEnvironmentVariable("GMN_TELEMETRY_PORT")
        ?? Environment.GetEnvironmentVariable("HLL_TELEMETRY_PORT")
        ?? "25555";

    var index = Array.IndexOf(args, "--port");
    if (index >= 0 && index + 1 < args.Length) value = args[index + 1];

    return int.TryParse(value, out var port) && port is > 0 and <= 65535 ? port : 25555;
}

static string? ReadMapName(string[] args)
{
    var index = Array.IndexOf(args, "--map");
    if (index >= 0 && index + 1 < args.Length) return args[index + 1];

    var env = Environment.GetEnvironmentVariable("GMN_TELEMETRY_MAP")
        ?? Environment.GetEnvironmentVariable("HLL_TELEMETRY_MAP");

    return string.IsNullOrWhiteSpace(env) ? null : env;
}

/* --also-map Local\Foo,Local\Bar - extra names to try before the built-in
   list. The app fills this in from the plugin it found in the game folder. */
static List<string> ReadExtraMaps(string[] args)
{
    var found = new List<string>();
    for (var i = 0; i < args.Length - 1; i++)
    {
        if (args[i] != "--also-map") continue;
        foreach (var name in args[i + 1].Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            var clean = name.Trim();
            if (clean.Length > 0 && !found.Contains(clean)) found.Add(clean);
        }
    }
    return found;
}

static MemoryMappedFile? TryOpen(string name)
{
    try { return MemoryMappedFile.OpenExisting(name, MemoryMappedFileRights.Read); }
    catch (FileNotFoundException) { return null; }
    catch (Exception error) when (error is IOException or ArgumentException or UnauthorizedAccessException) { return null; }
}

static object ReadFrame(List<Source> sources)
{
    foreach (var source in sources)
    {
        using var file = TryOpen(source.Map);
        if (file is null) continue;

        try
        {
            using var view = file.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);

            /* The gate. A map that is open but is not this struct is worth
               nothing, and reading it anyway is how a delivery gets
               invented. */
            if (!Sources.LooksRight(view)) continue;

            return Sources.Read(view, source);
        }
        catch (Exception error) when (error is IOException or ArgumentException or UnauthorizedAccessException)
        {
            /* present but unreadable - keep looking rather than claim it */
        }
    }

    return OfflineFrame("ETS2");
}

/* Everything the adapter can see, said plainly. This is what turns "no
   telemetry" from a dead end into something a person can act on. */
static object Diagnose(List<Source> sources)
{
    var seen = new List<object>();
    string? reading = null;

    foreach (var source in sources)
    {
        using var file = TryOpen(source.Map);

        if (file is null)
        {
            seen.Add(new { map = source.Map, source.Plugin, present = false, recognised = false });
            continue;
        }

        /* present is not the same as readable, and readable is not the same
           as understood. The first version of this reported readable:true as
           a literal for every map including the absent ones, in a file whose
           whole point is not doing that. */
        bool recognised;
        try
        {
            using var view = file.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            recognised = Sources.LooksRight(view);
        }
        catch (Exception error) when (error is IOException or ArgumentException or UnauthorizedAccessException)
        {
            seen.Add(new { map = source.Map, source.Plugin, present = true, recognised = false,
                note = "the map is there but could not be read" });
            continue;
        }

        if (recognised && reading is null) reading = source.Map;

        seen.Add(new
        {
            map = source.Map,
            source.Plugin,
            present = true,
            recognised,
            note = recognised
                ? "being read"
                : "found, but it does not look like the layout this adapter knows, "
                + "so it is deliberately not read - the numbers would be meaningless."
        });
    }

    return new
    {
        listening = true,
        reading,
        maps = seen,
        advice = reading is not null
            ? "Telemetry is being read. If the game is running and a job is loaded it will appear."
            : "Nothing is writing telemetry that this adapter recognises. The plugin is a DLL "
            + "that goes in the game's own plugins folder - for a 64-bit game that is "
            + "bin\\win_x64\\plugins, and a copy in win_x86 is never loaded. Gaming Nation "
            + "installs it there itself; if it could not, the game folder is write-protected "
            + "and running Gaming Nation as administrator once will do it. Restart the game "
            + "afterwards - plugins load only at startup."
    };
}

static object OfflineFrame(string game) => new
{
    game = new { connected = false, paused = false, gameName = game },
    truck = new { make = "", model = "", speed = 0, odometer = 0, fuel = 0,
        fuelCapacity = 0, wearEngine = 0, wearTransmission = 0, wearCabin = 0,
        wearChassis = 0, wearWheels = 0, engineOn = false,
        placement = new { x = 0, y = 0, z = 0, heading = 0 } },
    trailer = new { attached = false }, job = (object?)null,
    navigation = new { estimatedDistance = 0, speedLimit = 0 }
};

record Source(string Map, string Plugin);

static class Sources
{
    /* Ordered by how likely a driver is to have it. Every one of these is a
       name read out of a plugin's own header or extracted from a shipped
       DLL — none is invented here, which is the mistake the last two
       versions of this file made. */
    public static readonly List<Source> Probe = new()
    {
        new("Local\\SCSTelemetry",   "scs-sdk-plugin — the standard one"),
        new("Local\\TSGPSTelemetry", "TruckSim-GPS (same layout)"),

        /* Shipped as telemetry_tb_64.dll (and telemetry_tb_32.dll beside it),
           and now read rather than guessed at. The binary settles it:

             its debug path names scs-sdk-plugin/scs-telemetry, ending in
               scs-telemetry.pdb
             it exports scs_telemetry_init and scs_telemetry_shutdown
             its own module name is scs-telemetry.dll
             it carries the revision-12 channel set - planned_distance.km,
               cargo.mass, job.market, is.special.job, .wear.body,
               multiplayer.time.offset, truck.trailer.lift_axle

           So it is scs-sdk-plugin built from source with only the mapping
           name changed, and it writes the struct this file parses. Still
           probed rather than trusted: the gate decides at runtime, because
           a build can always be older than its channel list suggests.

           Still not attributed to a vendor. Neither DLL carries a version
           resource or a company string, and the only project name in it
           belongs to the upstream plugin, not to whoever renamed it. */
        new("Local\\TelemetryTB",    "scs-sdk-plugin, renamed (telemetry_tb_64.dll)"),

        /* Kept last and only for continuity: a name this project invented
           for a build it has never shipped, and the name it used before the
           rename. Nothing creates either. */
        new("Local\\GMNTelemetry",   "a Gaming Nation build, if one is ever made"),
        new("Local\\HLLTelemetry",   "the name this project used before the rename"),
    };

    /* The maps to try, in order. Anything the app read out of an installed
       plugin comes first - it knows what that DLL writes, where this list is
       only ever a guess. A name pinned on the command line means exactly that
       one and nothing else. */
    public static List<Source> Resolve(string? pinned, List<string> extra)
    {
        if (pinned is not null)
        {
            var known = Probe.Find(s => s.Map == pinned);
            return new List<Source> { known ?? new Source(pinned, "pinned on the command line") };
        }

        var list = new List<Source>();
        foreach (var name in extra)
        {
            if (!list.Exists(s => s.Map == name))
                list.Add(new Source(name, "named by the plugin installed in the game"));
        }
        foreach (var source in Probe)
        {
            if (!list.Exists(s => s.Map == source.Map)) list.Add(source);
        }
        return list;
    }

    /* Is this actually the struct we think it is?

       Three fields in the scs_values zone that must hold particular values
       in any revision of this layout. Cheap, and it is the difference
       between reading telemetry and reading whatever else happened to be
       mapped under that name. */
    public static bool LooksRight(MemoryMappedViewAccessor view)
    {
        try
        {
            /* Raised from 4096: the job flags live in special_b at 4300, so a
               map too small to hold that zone cannot be read as this layout. */
            if (view.Capacity < 4400) return false;

            var revision = view.ReadUInt32(40);
            var game = view.ReadUInt32(52);
            var active = view.ReadByte(0);

            /* Revision 10 is where this layout settled; anything below it is
               a different, smaller struct. No upper bound — a later
               revision that has not moved these fields still reads fine,
               and refusing it would age this adapter badly. */
            if (revision < 10 || revision > 1000) return false;
            if (game != 1 && game != 2) return false;
            if (active > 1) return false;

            return true;
        }
        catch { return false; }
    }

    /* RenCloud scsTelemetryMap_t, revisions 10-12.

       Every readable name in config_s is preceded by its internal id twin,
       which is the pairing the old offsets lost. Listed here in memory
       order so the mistake is visible rather than implicit — note that the
       DESTINATION comes before the source. */
    /* Everything outside config_s that this adapter reads, with the zone it
       comes from. Derived the same way as the string block above — by walking
       scs-telemetry-common.hpp field by field — because the three bugs in the
       header all came from offsets nobody had counted out.

         100   config_ui.plannedDistanceKm   the run's real length, in km
         748   config_f.cargoMass            kg
        1468   job_f.cargoDamage             0..1
        1564   config_b.isCargoLoaded
        2224   truck_dp.rotationX            heading, 0..1, 0 = north
        4000   config_ull.jobIncome
        4300   special_b.onJob               the game's own "there is a job"
        4301   special_b.jobFinished
        4302   special_b.jobCancelled
        4303   special_b.jobDelivered        the game's own "it was delivered" */
    const long PlannedDistanceKm = 100, CargoMass = 748, CargoDamage = 1468;
    const long IsCargoLoaded = 1564, Heading = 2224, JobIncome = 4000;
    const long OnJob = 4300, JobFinished = 4301, JobCancelled = 4302, JobDelivered = 4303;

    const long TruckBrandId = 2300, TruckBrand = 2364;
    const long TruckId      = 2428, TruckName  = 2492;
    const long CargoId      = 2556, Cargo      = 2620;
    const long CityDstId    = 2684, CityDst    = 2748;
    const long CompDstId    = 2812, CompDst    = 2876;
    const long CitySrcId    = 2940, CitySrc    = 3004;
    const long CompSrcId    = 3068, CompSrc    = 3132;

    public static object Read(MemoryMappedViewAccessor view, Source source)
    {
        var active = view.ReadByte(0) != 0;
        var paused = view.ReadByte(4) != 0;
        var game = view.ReadUInt32(52) == 2 ? "ATS" : "ETS2";

        var speed = Math.Max(0, view.ReadSingle(948) * 3.6);
        var fuel = view.ReadSingle(1000);

        /* config_f.fuelCapacity. 952 — which is what this used to read — is
           truck_f.engineRpm, so the fuel gauge was reporting about 1400. */
        var fuelCapacity = view.ReadSingle(704);

        var engineWear = view.ReadSingle(1036);
        var transmissionWear = view.ReadSingle(1040);
        var cabinWear = view.ReadSingle(1044);
        var chassisWear = view.ReadSingle(1048);
        var wheelsWear = view.ReadSingle(1052);
        var odometer = view.ReadSingle(1056);
        /* truck.navigation.distance is METRES, not kilometres. This used to
           be multiplied by 1000 on the way out, which turned a 208 km run
           into 208,243 km of remaining distance. The client works out how
           far along a run is by subtracting what is left from the planned
           length, so a figure a thousand times too big pinned every
           delivery at 0% for its whole length. Caught against a running
           game; no amount of synthetic data would have found it, because
           the test had the same wrong assumption written into it. */
        var routeDistanceM = view.ReadSingle(1060);
        var speedLimit = view.ReadSingle(1068) * 3.6;

        var x = view.ReadDouble(2200);
        var y = view.ReadDouble(2208);
        var z = view.ReadDouble(2216);

        /* Was hardcoded to 0, which pointed every truck on every map due
           north for ever. truck_dp.rotationX is the heading the SDK
           documents as "unit range where 1 equals 360 degrees", which is
           the 0..1 the client already expects. */
        var heading = view.ReadDouble(Heading);
        heading -= Math.Floor(heading);

        var plannedKm = view.ReadUInt32(PlannedDistanceKm);
        var cargoMass = view.ReadSingle(CargoMass);
        var cargoDamage = view.ReadSingle(CargoDamage);
        var cargoLoaded = view.ReadByte(IsCargoLoaded) != 0;
        var income = view.ReadUInt64(JobIncome);

        /* The game's own job flags. Everything before this inferred a job
           from whether some string happened to be non-empty; special_b is
           the plugin saying so itself, and jobDelivered is the only
           trustworthy answer to "was this run actually completed". */
        var onJob = view.ReadByte(OnJob) != 0;
        var jobFinished = view.ReadByte(JobFinished) != 0;
        var jobCancelled = view.ReadByte(JobCancelled) != 0;
        var jobDelivered = view.ReadByte(JobDelivered) != 0;

        var truckBrand = ReadString(view, TruckBrand);
        var truckName = ReadString(view, TruckName);
        var cargo = ReadString(view, Cargo);
        var cityDst = ReadString(view, CityDst);
        var citySrc = ReadString(view, CitySrc);
        var compDst = ReadString(view, CompDst);
        var compSrc = ReadString(view, CompSrc);

        /* special_b.onJob is the game's own answer and is the one that
           counts. The string test is kept beside it because it is now
           reading the fields the plugin really does clear on job end
           (set_job_values_zero() blanks cargo, cityDst, citySrc and their
           ids), so it costs nothing and covers a plugin build that leaves
           special_b alone. Neither term survives the end of a job, which is
           what stopped this being permanently true. */
        var hasJob = onJob || cargo.Length > 0 || cityDst.Length > 0;

        return new
        {
            source = new { map = source.Map, plugin = source.Plugin },
            game = new { connected = active, paused, gameName = game },
            truck = new
            {
                make = truckBrand, model = truckName, speed, odometer,
                fuel, fuelCapacity, wearEngine = engineWear,
                wearTransmission = transmissionWear, wearCabin = cabinWear,
                wearChassis = chassisWear, wearWheels = wheelsWear,
                engineOn = view.ReadByte(1576) != 0,
                placement = new { x, y, z, heading }
            },
            /* config_b.isCargoLoaded, not "there is a job". The trailer zone
               at 6000 has the real coupling flag, but this adapter has never
               counted that struct out and will not report a field it has not
               derived. */
            trailer = new { attached = cargoLoaded },
            job = hasJob ? new
            {
                cargo,
                sourceCity = citySrc, destinationCity = cityDst,
                sourceCompany = compSrc, destinationCompany = compDst,
                income,
                plannedDistanceKm = plannedKm,
                cargoMass,
                cargoDamage,
                onJob, finished = jobFinished, cancelled = jobCancelled,
                delivered = jobDelivered
            } : null,
            navigation = new { estimatedDistance = routeDistanceM, speedLimit }
        };
    }

    static string ReadString(MemoryMappedViewAccessor view, long offset)
    {
        var bytes = new byte[64];
        view.ReadArray(offset, bytes, 0, bytes.Length);
        var end = Array.IndexOf(bytes, (byte)0);
        return Encoding.UTF8.GetString(bytes, 0, end < 0 ? bytes.Length : end).Trim();
    }
}
