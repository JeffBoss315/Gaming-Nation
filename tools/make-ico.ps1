# Build a real multi-resolution Windows .ico from hll.jpg.
# electron-builder can convert a PNG, but a hand-built .ico carries every size
# Windows actually asks for - 16px in the taskbar through 256px in Explorer.
param(
  [string]$Source = "$PSScriptRoot\..\hll.jpg",
  [string]$Out    = "$PSScriptRoot\..\icons\icon.ico"
)
Add-Type -AssemblyName System.Drawing

$sizes = @(16, 24, 32, 48, 64, 128, 256)
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))

$pngs = @()
foreach ($s in $sizes) {
  $bmp = New-Object System.Drawing.Bitmap $s, $s
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode  = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $g.SmoothingMode    = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  $g.DrawImage($src, (New-Object System.Drawing.Rectangle 0, 0, $s, $s))
  $g.Dispose()
  $ms = New-Object System.IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  $pngs += ,@($s, $ms.ToArray())
  $bmp.Dispose()
  $ms.Dispose()
}
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
