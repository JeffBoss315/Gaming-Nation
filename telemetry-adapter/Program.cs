using System;
using System.IO;
using System.IO.MemoryMappedFiles;
using System.Net;
using System.Text;
using System.Text.Json;

var port = ReadPort(args);
using var listener = new HttpListener();
listener.Prefixes.Add($"http://127.0.0.1:{port}/");
listener.Start();
Console.WriteLine($"HLL telemetry adapter listening on http://127.0.0.1:{port}/");

while (true)
{
    var context = await listener.GetContextAsync();
    if (context.Request.HttpMethod == "GET" &&
        context.Request.Url?.AbsolutePath == "/api/ets2/telemetry")
    {
        var json = JsonSerializer.Serialize(ReadFrame());
        var bytes = Encoding.UTF8.GetBytes(json);
        context.Response.ContentType = "application/json";
        context.Response.Headers["Access-Control-Allow-Origin"] = "*";
        context.Response.Headers["Cache-Control"] = "no-store";
        context.Response.ContentLength64 = bytes.Length;
        await context.Response.OutputStream.WriteAsync(bytes);
    }
    else
    {
        context.Response.StatusCode = 404;
    }
    context.Response.Close();
}

static int ReadPort(string[] args)
{
    var value = Environment.GetEnvironmentVariable("HLL_TELEMETRY_PORT") ?? "25555";
    var index = Array.IndexOf(args, "--port");
    if (index >= 0 && index + 1 < args.Length) value = args[index + 1];
    return int.TryParse(value, out var port) && port is > 0 and <= 65535 ? port : 25555;
}

static object ReadFrame()
{
    const string mapName = "Local\\HLLTelemetry";
    try
    {
        using var file = MemoryMappedFile.OpenExisting(mapName, MemoryMappedFileRights.Read);
        using var view = file.CreateViewAccessor(0, 0, MemoryMappedFileAccess.Read);
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
        var source = ReadString(view, 2620);
        var sourceCompany = ReadString(view, 2684);
        var destinationCompany = ReadString(view, 2748);
        var hasJob = cargo.Length > 0 || destination.Length > 0;

        return new
        {
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
                cargo, sourceCity = source, destinationCity = destination,
                sourceCompany, destinationCompany, income = 0
            } : null,
            navigation = new { estimatedDistance = routeDistance * 1000, speedLimit }
        };
    }
    catch (FileNotFoundException)
    {
        return OfflineFrame("ETS2");
    }
    catch (Exception error) when (error is IOException or ArgumentException)
    {
        return OfflineFrame("ETS2");
    }
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

static string ReadString(MemoryMappedViewAccessor view, long offset)
{
    var bytes = new byte[64];
    view.ReadArray(offset, bytes, 0, bytes.Length);
    var length = Array.IndexOf(bytes, (byte)0);
    if (length < 0) length = bytes.Length;
    return Encoding.UTF8.GetString(bytes, 0, length).Trim();
}