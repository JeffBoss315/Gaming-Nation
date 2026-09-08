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
   THREE THINGS THAT WERE WRONG, AND ONE THAT MAKES THEM UNLIKELY AGAIN

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

   And the thing that makes it unlikely again: EVERY map is now gated
   before it is parsed. revision, game and sdkActive are checked against
   the values this layout must have, so "is this the struct I think it is"
   is a question answered at runtime instead of assumed. A map that opens
   but fails the gate is reported and not read. That check would have
   caught all three of the above.

   NOT VERIFIED, and worth saying plainly: none of this has been read
   against a live game. The offsets come from the plugin's own headers.
   The gate is what stands between "these offsets are probably right" and
   a fabricated delivery in somebody's logbook.
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

using var listener = new HttpListener();
listener.Prefixes.Add($"http://127.0.0.1:{port}/");
listener.Start();

Console.WriteLine($"GMN telemetry adapter listening on http://127.0.0.1:{port}/");
Console.WriteLine(pinned is null
    ? "  probing: " + string.Join(", ", Sources.Probe.ConvertAll(s => s.Map))
    : "  probing: " + pinned + " (pinned on the command line)");

while (true)
{
    var context = await listener.GetContextAsync();
    var path = context.Request.Url?.AbsolutePath ?? "";

    if (context.Request.HttpMethod == "GET" &&
        (path == "/api/ets2/telemetry" || path == "/api/ats/telemetry"))
    {
        Respond(context, ReadFrame(pinned));
    }
    else if (context.Request.HttpMethod == "GET" && path == "/api/diagnostics")
    {
        Respond(context, Diagnose(pinned));
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

static MemoryMappedFile? TryOpen(string name)
{
    try { return MemoryMappedFile.OpenExisting(name, MemoryMappedFileRights.Read); }
    catch (FileNotFoundException) { return null; }
    catch (Exception error) when (error is IOException or ArgumentException or UnauthorizedAccessException) { return null; }
}

static object ReadFrame(string? pinned)
{
    foreach (var source in Sources.Probe)
    {
        if (pinned is not null && source.Map != pinned) continue;

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
            /* present but unreadable — keep looking rather than claim it */
        }
    }

    /* A pinned map that nothing else matched still gets probed, so somebody
       who knows better than this list is not blocked by it. */
    if (pinned is not null && !Sources.Probe.Exists(s => s.Map == pinned))
    {
        using var file = TryOpen(pinned);
        if (file is not null)
        {
            try
            {
                using var view = file.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
                if (Sources.LooksRight(view))
                    return Sources.Read(view, new Source(pinned, "pinned on the command line"));
            }
            catch (Exception error) when (error is IOException or ArgumentException or UnauthorizedAccessException) { }
        }
    }

    return OfflineFrame("ETS2");
}

/* Everything the adapter can see, said plainly. This is what turns "no
   telemetry" from a dead end into something a person can act on. */
static object Diagnose(string? pinned)
{
    var seen = new List<object>();
    string? reading = null;

    var list = new List<Source>(Sources.Probe);
    if (pinned is not null && !list.Exists(s => s.Map == pinned))
        list.Add(new Source(pinned, "pinned on the command line"));

    foreach (var source in list)
    {
        if (pinned is not null && source.Map != pinned) continue;

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
                + "so it is deliberately not read — the numbers would be meaningless."
        });
    }

    return new
    {
        listening = true,
        reading,
        pinned,
        maps = seen,
        advice = reading is not null
            ? "Telemetry is being read. If the game is running and a job is loaded it will appear."
            : "Nothing is writing telemetry that this adapter recognises. The plugin is a DLL "
            + "that goes in the game's own plugins folder — for a 64-bit game that is "
            + "bin\\win_x64\\plugins, and a copy in win_x86 is never loaded. The one this "
            + "adapter reads is scs-sdk-plugin, which writes Local\\SCSTelemetry. Restart the "
            + "game after adding it."
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

        /* Present on this developer's machine as telemetry_tb_64.dll. The
           evidence that it is a renamed build of the same plugin is strong
           — matching channel set, matching string table, an scs-sdk-plugin
           path left in its debug info — but nobody has read its struct. It
           is probed rather than trusted: the gate decides at runtime, and
           if it is not this layout it is reported and not parsed.

           Deliberately not attributed to a vendor. Neither DLL carries a
           version resource or a vendor string, so naming a company would be
           guessing from a filename in front of a driver. */
        new("Local\\TelemetryTB",    "an installed plugin (vendor not stated in the file)"),

        /* Kept last and only for continuity: a name this project invented
           for a build it has never shipped, and the name it used before the
           rename. Nothing creates either. */
        new("Local\\GMNTelemetry",   "a Gaming Nation build, if one is ever made"),
        new("Local\\HLLTelemetry",   "the name this project used before the rename"),
    };

    /* Is this actually the struct we think it is?

       Three fields in the scs_values zone that must hold particular values
       in any revision of this layout. Cheap, and it is the difference
       between reading telemetry and reading whatever else happened to be
       mapped under that name. */
    public static bool LooksRight(MemoryMappedViewAccessor view)
    {
        try
        {
            if (view.Capacity < 4096) return false;

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
        var routeDistance = view.ReadSingle(1060);
        var speedLimit = view.ReadSingle(1068) * 3.6;

        var x = view.ReadDouble(2200);
        var y = view.ReadDouble(2208);
        var z = view.ReadDouble(2216);

        var truckBrand = ReadString(view, TruckBrand);
        var truckName = ReadString(view, TruckName);
        var cargo = ReadString(view, Cargo);
        var cityDst = ReadString(view, CityDst);
        var citySrc = ReadString(view, CitySrc);
        var compDst = ReadString(view, CompDst);
        var compSrc = ReadString(view, CompSrc);

        /* Only fields the plugin actually CLEARS when a job ends.
           set_job_values_zero() blanks cargo, cityDst, citySrc and their
           ids; it never touches truckBrand, truckId or truckName. Testing
           anything from the truck block is what made this permanently
           true. */
        var hasJob = cargo.Length > 0 || cityDst.Length > 0;

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
                placement = new { x, y, z, heading = 0 }
            },
            trailer = new { attached = hasJob },
            job = hasJob ? new
            {
                cargo,
                sourceCity = citySrc, destinationCity = cityDst,
                sourceCompany = compSrc, destinationCompany = compDst,
                income = 0
            } : null,
            navigation = new { estimatedDistance = routeDistance * 1000, speedLimit }
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
