# Build a real multi-resolution Windows .ico from the Heavyline artwork.
# electron-builder can convert a PNG, but a hand-built .ico carries every size
# Windows actually asks for - 16px in the taskbar through 256px in Explorer.
#
# TWO SOURCES, ON PURPOSE.
#
# The full logo carries the wordmark under the truck. At 128 and 256 that
# reads; at 16 and 24 - the taskbar, the window corner, the Alt-Tab strip -
# it collapses into a grey smudge and the icon becomes an unidentifiable
# dark square. Below 64px this draws the mark instead: the same artwork,
# cropped to the truck, which is still a truck at 16px.
#
# Both come from hll.jpg. icons/mark.png is generated from it by
# make-brand-icons.ps1, which is why that runs first.
param(
  [string]$Source = "$PSScriptRoot\..\hll.jpg",
  [string]$Small  = "$PSScriptRoot\..\icons\mark.png",
  [string]$Out    = "$PSScriptRoot\..\icons\icon.ico"
)
Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

# Fall back to the full logo if the mark has not been generated yet, so this
# still produces a valid icon on its own.
$smallSrc = $src
if (Test-Path $Small) { $smallSrc = [System.Drawing.Image]::FromFile((Resolve-Path $Small)) }

$pngs = @()
foreach ($s in $sizes) {
  $art = $(if ($s -lt 64) { $smallSrc } else { $src })
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode  = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($art, (New-Object System.Drawing.Rectangle 0, 0, $s, $s))
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += ,@($s, $ms.ToArray())
  $bmp.Dispose()
  $ms.Dispose()
}
if ($smallSrc -ne $src) { $smallSrc.Dispose() }
$src.Dispose()

# ICONDIR + one ICONDIRENTRY per image, then the PNG payloads
$fs = [System.IO.File]::Create((New-Item -ItemType File -Path $Out -Force).FullName)
$bw = New-Object System.IO.BinaryWriter $fs
$bw.Write([UInt16]0)                 # reserved
$bw.Write([UInt16]1)                 # type: icon
$bw.Write([UInt16]$pngs.Count)

$offset = 6 + (16 * $pngs.Count)
foreach ($p in $pngs) {
  $size = $p[0]; $bytes = $p[1]
  $bw.Write([Byte]($(if ($size -ge 256) { 0 } else { $size })))   # 0 means 256
  $bw.Write([Byte]($(if ($size -ge 256) { 0 } else { $size })))
  $bw.Write([Byte]0)                 # palette
  $bw.Write([Byte]0)                 # reserved
  $bw.Write([UInt16]1)               # colour planes
  $bw.Write([UInt16]32)              # bits per pixel
  $bw.Write([UInt32]$bytes.Length)
  $bw.Write([UInt32]$offset)
  $offset += $bytes.Length
}
foreach ($p in $pngs) { $bw.Write($p[1]) }
$bw.Flush(); $bw.Close(); $fs.Close()

Write-Host ("icon.ico written - {0} sizes, {1:N0} bytes" -f $pngs.Count, (Get-Item $Out).Length)
