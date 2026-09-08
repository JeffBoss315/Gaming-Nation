/* GMN telemetry adapter.

   The game does not talk to Gaming Nation. An SCS telemetry plugin, loaded
   inside Euro Truck Simulator 2 or American Truck Simulator, writes the
   state of the truck into a Windows shared-memory block many times a
   second. This program reads that block and serves it as JSON on
   127.0.0.1, which is the only thing the client knows how to ask.

   WHAT WAS WRONG WITH THE OLD ONE

   It opened exactly one map, "Local\HLLTelemetry", written into the source
   as a constant. No shipping plugin creates a map by that name. So the
   adapter started, answered every request, reported "not connected" for
   ever, and there was nothing anywhere to say that the name it was waiting
   on could never arrive. telemetry-bridge.js even accepts a --map argument
   and passes it in; the old code ignored it.

   WHY IT DOES NOT SIMPLY READ WHATEVER MAP IT FINDS

   Every plugin lays its block out differently. Reading one plugin's memory
   at another plugin's offsets does not fail — it returns numbers, and the
   numbers are rubbish. A driver would be shown a cargo, a destination and a
   speed that were never real, and a logbook would fill up with them. That
   is worse than an empty screen, so a map whose layout this adapter does
   not know is REPORTED and not parsed.

   /api/diagnostics says which maps exist on this machine, which one is
   being read, and which were found but not understood — so an install that
   is nearly right can be seen to be nearly right.
*/
using System;
using System.Collections.Generic;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Net;
using System.Text;
using System.Text.Json;

var port = ReadPort(args);
var wanted = ReadMapName(args);

using var listener = new HttpListener();
listener.Prefixes.Add($"http://127.0.0.1:{port}/");
listener.Start();

Console.WriteLine($"GMN telemetry adapter listening on http://127.0.0.1:{port}/");
Console.WriteLine(wanted is null
    ? "  looking for: " + string.Join(", ", Sources.Known.ConvertAll(s => s.Map))
    : "  looking for: " + wanted + " (given on the command line)");

while (true)
{
    var context = await listener.GetContextAsync();
    var path = context.Request.Url?.AbsolutePath ?? "";

    if (context.Request.HttpMethod == "GET" &&
        (path == "/api/ets2/telemetry" || path == "/api/ats/telemetry"))
    {
        Respond(context, ReadFrame(wanted));
    }
    else if (context.Request.HttpMethod == "GET" && path == "/api/diagnostics")
    {
        Respond(context, Diagnose(wanted));
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

/* A name given explicitly wins and is used alone — if somebody has told the
   adapter where to look, second-guessing them helps nobody. Given nothing,
   it probes the names it knows. */
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

static object ReadFrame(string? wanted)
{
    foreach (var source in Sources.For(wanted))
    {
        using var file = TryOpen(source.Map);
        if (file is null) continue;

        try
        {
            using var view = file.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
            return Sources.Read(view, source);
        }
        catch (Exception error) when (error is IOException or ArgumentException or UnauthorizedAccessException)
        {
            /* present but unreadable — keep looking rather than claim it */
        }
    }

    return OfflineFrame("ETS2");
}

/* Everything the adapter can see, said plainly. This is what turns "no
   telemetry" from a dead end into something a person can act on. */
static object Diagnose(string? wanted)
{
    var known = new List<object>();
    var reading = (string?)null;

    foreach (var source in Sources.For(wanted))
    {
        using var file = TryOpen(source.Map);
        var present = file is not null;
        if (present && reading is null) reading = source.Map;

        known.Add(new { map = source.Map, plugin = source.Plugin, present, readable = true });
    }

    var strangers = new List<object>();
    foreach (var other in Sources.Foreign)
    {
        using var file = TryOpen(other.Map);
        if (file is null) continue;

        strangers.Add(new
        {
            map = other.Map,
            plugin = other.Plugin,
            note = "found, but this adapter does not know how this plugin lays out its memory, "
                 + "so it is deliberately not read — the numbers would be meaningless."
        });
    }

    return new
    {
        listening = true,
        reading,
        pinned = wanted,
        known,
        foreign = strangers,
        advice = reading is not null
            ? "Telemetry is being read. If the game is running and a job is loaded it will appear."
            : "No telemetry plugin is writing anything. The plugin is a DLL that goes in the game's own "
            + "plugins folder — for a 64-bit game that is bin\\win_x64\\plugins, and a copy in win_x86 is "
            + "never loaded. Restart the game after adding it."
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

/* ------------------------------------------------------------------
   The maps this adapter knows about.

   Known: the layout below has been read against these. Foreign: the map
   exists in the wild and a driver may well have it, but its block is laid
   out differently and guessing at it would invent a delivery.
   ------------------------------------------------------------------ */
record Source(string Map, string Plugin);

static class Sources
{
    public static readonly List<Source> Known = new()
    {
        new("Local\\GMNTelemetry",  "Gaming Nation build of the SCS SDK plugin"),
        new("Local\\HLLTelemetry",  "the name this project used before the rename"),
    };

    /* Present on real machines, laid out differently, deliberately not read.
       telemetry_tb_64.dll ships with TruckBook and creates Local\TelemetryTB
       — confirmed by reading the UTF-16 strings out of the DLL itself. */
    public static readonly List<Source> Foreign = new()
    {
        new("Local\\TelemetryTB", "TruckBook (telemetry_tb_64.dll)"),
    };

    public static List<Source> For(string? wanted) =>
        wanted is null ? Known : new List<Source> { new(wanted, "given on the command line") };

    public static object Read(MemoryMappedViewAccessor view, Source source)
    {
        var active = view.ReadByte(0) != 0;
        var paused = view.ReadByte(4) != 0;
        var game = view.ReadInt32(52) == 2 ? "ATS" : "ETS2";
        var speed = Math.Max(0, view.ReadSingle(948) * 3.6);
        var fuel = view.ReadSingle(1000);
        var fuelCapacity = view.ReadSingle(952);
        var odometer = view.ReadSingle(1056);
        var x = view.ReadDouble(2200);
        var y = view.ReadDouble(2208);
        var z = view.ReadDouble(2216);
        var routeDistance = view.ReadSingle(1060);
        var speedLimit = view.ReadSingle(1068) * 3.6;
        var engineWear = view.ReadSingle(1036);
        var transmissionWear = view.ReadSingle(1040);
        var cabinWear = view.ReadSingle(1044);
        var chassisWear = view.ReadSingle(1048);
        var wheelsWear = view.ReadSingle(1052);
        var truckBrand = ReadString(view, 2364);
        var truckName = ReadString(view, 2428);
        var cargo = ReadString(view, 2492);
        var destination = ReadString(view, 2556);
        var sourceCity = ReadString(view, 2620);
        var sourceCompany = ReadString(view, 2684);
        var destinationCompany = ReadString(view, 2748);
        var hasJob = cargo.Length > 0 || destination.Length > 0;

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
                cargo, sourceCity, destinationCity = destination,
                sourceCompany, destinationCompany, income = 0
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
