# The game telemetry plugin

`telemetry_tb_64.dll` is the SCS telemetry plugin. Gaming Nation installs it
into the game's own `bin\win_x64\plugins` folder, because Euro Truck
Simulator 2 and American Truck Simulator report nothing to anybody until it
is there — no shared memory, so no position, no fuel, no damage and no
delivery, however far the driver drives.

## What this file is

It is [scs-sdk-plugin](https://github.com/RenCloud/scs-sdk-plugin) by
RenCloud, built from source with the shared-memory name changed. That is not
a guess — it was read out of the binary:

| | |
|---|---|
| Debug path | `…\scs-sdk-plugin\scs-telemetry\vs2012\Release\scs-telemetry.pdb` |
| Exports | `scs_telemetry_init`, `scs_telemetry_shutdown` |
| Module name | `scs-telemetry.dll` |
| PE machine | `0x8664` — 64-bit |
| Shared memory | `Local\TelemetryTB` |
| Channels | includes `planned_distance.km`, `cargo.mass`, `job.market`, `is.special.job`, `.wear.body`, `multiplayer.time.offset`, `truck.trailer.lift_axle` — the revision-12 set |

`telemetry-plugin.js` re-checks every one of those properties at runtime
before it will install or believe any DLL, this one included. It is never
trusted for being the file we shipped.

## Licence

scs-sdk-plugin is MIT licensed. The upstream licence is in `LICENSE-scs-sdk-plugin.txt`
beside this file and must travel with the binary.

## Replacing it

Drop a different build in here under the name `scs-telemetry.dll` or
`telemetry_tb_64.dll` and it will be picked up instead. It must be 64-bit, it
must export the SCS entry points, and it must name the shared memory it
writes — the app reads that name out of the DLL and tells the adapter what to
look for, so a build with a different name needs no code change.

A 32-bit build is not a substitute. A 64-bit game loads `bin\win_x64\plugins`
and never looks at `win_x86`, which is the single commonest way to have
"installed the plugin" and have nothing happen.
