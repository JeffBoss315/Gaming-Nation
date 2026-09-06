$ErrorActionPreference = 'Stop'

$candidates = @(
  (Get-Command dotnet -ErrorAction SilentlyContinue).Source,
  'C:\Program Files\dotnet\dotnet.exe',
  'C:\Program Files (x86)\dotnet\dotnet.exe',
  "$env:LOCALAPPDATA\Microsoft\dotnet\dotnet.exe"
) | Where-Object { $_ -and (Test-Path $_) } | Select-Object -Unique

if (-not $candidates) {
  throw 'The .NET 8 SDK is not installed. Install Microsoft.DotNet.SDK.8, restart VS Code, and run npm run telemetry:build again.'
}

$dotnet = $candidates | Select-Object -First 1
$publishDir = Join-Path $PSScriptRoot '..\telemetry-adapter\publish'
& $dotnet restore 'telemetry-adapter\HllTelemetryAdapter.csproj' --ignore-failed-sources
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }
& $dotnet publish 'telemetry-adapter\HllTelemetryAdapter.csproj' -c Release -o $publishDir --ignore-failed-sources -p:PublishSingleFile=true
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Copy-Item (Join-Path $publishDir 'hll-telemetry-adapter.exe') 'hll-telemetry-adapter.exe' -Force
if (-not (Test-Path 'hll-telemetry-adapter.exe')) {
  throw 'The .NET publish completed without producing hll-telemetry-adapter.exe.'
}
Write-Output 'Built hll-telemetry-adapter.exe'