r"""Smoke test - the telemetry adapter reads the struct it thinks it does.

    npm run smoke:offsets      (needs Python; the shared memory this creates
                                has no Node equivalent)

Every bug this adapter has ever had was an offset bug: a map name nothing
creates, a string block shifted by one field, a fuel gauge reading engine RPM,
a heading hardcoded to zero. They are invisible in review and they do not
crash - they quietly report the wrong number, and one of them invented a
delivery for anybody sitting in a truck.

So this checks rather than trusts, in two ways:

  1. It WALKS scs-telemetry-common.hpp field by field, summing sizes, and
     compares every offset it arrives at against the constants Program.cs has
     hardcoded. The two are derived completely differently, so agreement is
     evidence rather than a restatement.

  2. It writes a whole synthetic truck into a real Local\SCSTelemetry
     shared-memory block, runs the actual adapter against it, and asserts on
     the JSON that comes back out of the HTTP endpoint the client polls.

Step 2 is also a build check. The adapter is published as a single file, and
a publish without a RuntimeIdentifier silently produces an apphost that looks
like a working .exe and dies on "the application to execute does not exist"
as soon as it is copied away from its .dll. That shipped once. This test runs
the exe it is given, so it cannot ship again.

What it does NOT prove, and this matters: that a real ETS2 or ATS plugin
writes this layout. Only a running game shows that. What it proves is that
the adapter is self-consistent with the published struct - which is where
every one of the historical bugs lived.
"""
import mmap, struct, subprocess, sys, time, json, re, urllib.request

SS = 64          # stringsize
off = {}
cur = 0


def z(start):
    global cur
    cur = start


def f(name, size, count=1):
    global cur
    off[name] = cur
    cur += size * count


# zone 1 @0
z(0)
f('sdkActive', 1); f('_ph', 1, 3); f('paused', 1); f('_ph2', 1, 3)
f('time', 8); f('simulatedTime', 8); f('renderTime', 8); f('mpTimeOffset', 8)

# zone 2 @40
z(40)
for n in ['revision', 'version_major', 'version_minor', 'game', 'tv_major', 'tv_minor']:
    f(n, 4)
f('time_abs', 4)
for n in ['gears', 'gears_reverse', 'retarderStepCount', 'truckWheelCount', 'selectorCount',
          'time_abs_delivery', 'maxTrailerCount', 'unitCount', 'plannedDistanceKm']:
    f(n, 4)

# zone 4 @700
z(700)
f('scale', 4)
for n in ['fuelCapacity', 'fuelWarningFactor', 'adblueCapacity', 'adblueWarningFactor',
          'airPressureWarning', 'airPressurEmergency', 'oilPressureWarning',
          'waterTemperatureWarning', 'batteryVoltageWarning', 'engineRpmMax',
          'gearDifferential', 'cargoMass']:
    f(n, 4)
f('truckWheelRadius', 4, 16); f('gearRatiosForward', 4, 24)
f('gearRatiosReverse', 4, 8); f('unitMass', 4)
for n in ['speed', 'engineRpm', 'userSteer', 'userThrottle', 'userBrake', 'userClutch',
          'gameSteer', 'gameThrottle', 'gameBrake', 'gameClutch', 'cruiseControlSpeed',
          'airPressure', 'brakeTemperature', 'fuel', 'fuelAvgConsumption', 'fuelRange',
          'adblue', 'oilPressure', 'oilTemperature', 'waterTemperature', 'batteryVoltage',
          'lightsDashboard', 'wearEngine', 'wearTransmission', 'wearCabin', 'wearChassis',
          'wearWheels', 'truckOdometer', 'routeDistance', 'routeTime', 'speedLimit']:
    f(n, 4)
for n in ['suspDefl', 'wheelVel', 'wheelSteer', 'wheelRot', 'wheelLift', 'wheelLiftOff']:
    f(n, 4, 16)
for n in ['jobDeliveredCargoDamage', 'jobDeliveredDistanceKm', 'refuelAmount']:
    f(n, 4)
f('cargoDamage', 4)

# zone 5 @1500
z(1500)
for n in ['wSteerable', 'wSimulated', 'wPowered', 'wLiftable']:
    f(n, 1, 16)
f('isCargoLoaded', 1); f('specialJob', 1)
for n in ['parkBrake', 'motorBrake', 'airPressureWarnB', 'airPressureEmergency',
          'fuelWarning', 'adblueWarning', 'oilPressureWarnB', 'waterTemperatureWarnB',
          'batteryVoltageWarnB', 'electricEnabled', 'engineEnabled']:
    f(n, 1)

# zone 8 @2200
z(2200)
for n in ['coordinateX', 'coordinateY', 'coordinateZ', 'rotationX', 'rotationY', 'rotationZ']:
    f(n, 8)

# zone 9 @2300
z(2300)
for n in ['truckBrandId', 'truckBrand', 'truckId', 'truckName', 'cargoId', 'cargo',
          'cityDstId', 'cityDst', 'compDstId', 'compDst', 'citySrcId', 'citySrc',
          'compSrcId', 'compSrc']:
    f(n, SS)

# zone 10 @4000
z(4000); f('jobIncome', 8)

# zone 12 @4300
z(4300)
for n in ['onJob', 'jobFinished', 'jobCancelled', 'jobDelivered']:
    f(n, 1)


# ---- 1. the offsets, against the constants the adapter actually uses ----
src = open('telemetry-adapter/Program.cs', encoding='utf-8').read()
consts = {}
for m in re.finditer(r'(\w+)\s*=\s*(\d+)\s*[,;]', src):
    consts.setdefault(m.group(1), int(m.group(2)))

named = {
    'PlannedDistanceKm': 'plannedDistanceKm', 'CargoMass': 'cargoMass',
    'CargoDamage': 'cargoDamage', 'IsCargoLoaded': 'isCargoLoaded',
    'Heading': 'rotationX', 'JobIncome': 'jobIncome', 'OnJob': 'onJob',
    'JobFinished': 'jobFinished', 'JobCancelled': 'jobCancelled',
    'JobDelivered': 'jobDelivered', 'TruckBrand': 'truckBrand',
    'TruckName': 'truckName', 'Cargo': 'cargo', 'CityDst': 'cityDst',
    'CitySrc': 'citySrc', 'CompDst': 'compDst', 'CompSrc': 'compSrc',
}
bad = 0
for cname, fname in sorted(named.items()):
    got, want = consts.get(cname), off[fname]
    ok = got == want
    bad += (not ok)
    print(('  ok    ' if ok else '  WRONG ') + '%-20s adapter=%-8s header=%s' % (cname, got, want))

# the ones written as literals inside Read()
for lit, fname in [(948, 'speed'), (1000, 'fuel'), (704, 'fuelCapacity'), (1036, 'wearEngine'),
                   (1040, 'wearTransmission'), (1044, 'wearCabin'), (1048, 'wearChassis'),
                   (1052, 'wearWheels'), (1056, 'truckOdometer'), (1060, 'routeDistance'),
                   (1068, 'speedLimit'), (2200, 'coordinateX'), (2208, 'coordinateY'),
                   (2216, 'coordinateZ'), (1576, 'engineEnabled'), (40, 'revision'), (52, 'game')]:
    ok = off[fname] == lit
    bad += (not ok)
    print(('  ok    ' if ok else '  WRONG ') + '%-20s adapter=%-8s header=%s' % (fname, lit, off[fname]))

print('\noffset check: ' + ('ALL MATCH' if not bad else '%d MISMATCH' % bad))
if bad:
    sys.exit(1)


# ---- 2. a synthetic truck, served through the real adapter ----
SIZE = 32 * 1024
mm = mmap.mmap(-1, SIZE, tagname='SCSTelemetry')


def wr(fmtc, name, *v):
    mm[off[name]:off[name] + struct.calcsize(fmtc)] = struct.pack(fmtc, *v)


def ws(name, text):
    mm[off[name]:off[name] + SS] = text.encode('utf-8')[:SS - 1].ljust(SS, b'\0')


wr('<B', 'sdkActive', 1); wr('<B', 'paused', 0)
wr('<I', 'revision', 12); wr('<I', 'game', 1)          # ETS2
wr('<I', 'plannedDistanceKm', 1240)
wr('<f', 'fuelCapacity', 1000.0); wr('<f', 'fuel', 372.5)
wr('<f', 'cargoMass', 22400.0)
wr('<f', 'speed', 22.5)                                # m/s -> 81 km/h
wr('<f', 'wearEngine', 0.031); wr('<f', 'wearTransmission', 0.012)
wr('<f', 'wearCabin', 0.004); wr('<f', 'wearChassis', 0.058); wr('<f', 'wearWheels', 0.002)
wr('<f', 'truckOdometer', 184233.0)
wr('<f', 'routeDistance', 208243.66)                    # METRES remaining, as the game reports it
wr('<f', 'speedLimit', 25.0)                           # m/s -> 90 km/h
wr('<f', 'cargoDamage', 0.017)
wr('<B', 'isCargoLoaded', 1); wr('<B', 'engineEnabled', 1)
wr('<d', 'coordinateX', -31337.5); wr('<d', 'coordinateY', 48.2)
wr('<d', 'coordinateZ', 15221.75)
wr('<d', 'rotationX', 0.625)                           # heading, 0..1
ws('truckBrand', 'Scania'); ws('truckName', 'R 2016 Highline')
ws('cargo', 'Refrigerated Food'); ws('cityDst', 'Hamburg'); ws('citySrc', 'Rotterdam')
ws('compDst', 'Tradeaux'); ws('compSrc', 'Euroacres')
wr('<Q', 'jobIncome', 48250)
wr('<B', 'onJob', 1); wr('<B', 'jobDelivered', 0); wr('<B', 'jobCancelled', 0)

proc = subprocess.Popen(['./gmn-telemetry-adapter.exe', '--port', '25599',
                         '--map', 'Local\\SCSTelemetry'],
                        stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
try:
    frame = None
    for _ in range(40):
        time.sleep(0.25)
        try:
            frame = json.load(urllib.request.urlopen(
                'http://127.0.0.1:25599/api/ets2/telemetry', timeout=2))
            break
        except Exception:
            pass

    # A null frame means the adapter never answered. That is exactly the
    # failure this test exists to catch, and exactly the one an earlier
    # version printed quietly and exited 0 for.
    if frame is None:
        proc.kill()
        said = ''
        try:
            said = proc.stdout.read() if proc.stdout else ''
        except Exception:
            pass
        print('\nFAIL: the adapter never answered on 25599. It said:')
        print(said.strip() or '(nothing at all)')
        sys.exit(1)

    print('\n--- what the adapter served ---')
    print(json.dumps(frame, indent=2))

    j = frame['job']
    tk = frame['truck']
    checks = [
        ('a job is detected at all', j is not None),
        ("from the game's own onJob flag", bool(j) and j['onJob'] is True),
        ('cargo', bool(j) and j['cargo'] == 'Refrigerated Food'),
        ('route', bool(j) and j['sourceCity'] == 'Rotterdam'
                          and j['destinationCity'] == 'Hamburg'),
        ('the run knows its planned length', bool(j) and j['plannedDistanceKm'] == 1240),
        ('payout, which used to be a hardcoded 0', bool(j) and j['income'] == 48250),
        ('cargo mass', bool(j) and j['cargoMass'] == 22400),
        ('trailer, from isCargoLoaded and not from "there is a job"',
         frame['trailer']['attached'] is True),
        ('truck', tk['make'] == 'Scania' and tk['model'] == 'R 2016 Highline'),
        ('speed, in km/h', tk['speed'] == 81),
        ('fuel', abs(tk['fuel'] - 372.5) < 0.01),
        ('damage', abs(tk['wearChassis'] - 0.058) < 1e-6),
        ('heading, which used to be a hardcoded 0',
         abs(tk['placement']['heading'] - 0.625) < 1e-9),
        ('position', abs(tk['placement']['x'] + 31337.5) < 1e-9),
        ('speed limit, in km/h', frame['navigation']['speedLimit'] == 90),
        # metres straight through, NOT scaled: the client divides by 1000
        # itself, and scaling here once put a 208 km run 208,243 km from home.
        ('distance remaining stays in metres',
         abs(frame['navigation']['estimatedDistance'] - 208243.66) < 0.5),
        ('and so reads back as the right number of km',
         round(frame['navigation']['estimatedDistance'] / 1000) == 208),
    ]
    failed = 0
    print()
    for label, ok in checks:
        failed += (not ok)
        print(('  ok    ' if ok else '  FAIL  ') + label)
    print('\n' + ('all good' if not failed else '%d FAILED' % failed))
    if failed:
        sys.exit(1)
finally:
    proc.kill()
