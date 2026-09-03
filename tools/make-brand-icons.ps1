<#
    Regenerates every app icon from the Heavyline logo.

        npm run icons          (or: powershell -File tools/make-brand-icons.ps1)

    Source of truth is hll.jpg in the project root. Writes:
      icons/                            web + PWA + the source art electron-builder
                                        turns into the Windows .ico
      android/app/src/main/res/mipmap-* Android launcher icons

    Uses System.Drawing, which ships with Windows PowerShell, so there is
    nothing to install.
#>

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root   = Split-Path -Parent $PSScriptRoot
$source = Join-Path $root 'hll.jpg'
if (-not (Test-Path $source)) { throw "hll.jpg not found at $source" }

$iconsDir = Join-Path $root 'icons'
New-Item -ItemType Directory -Force -Path $iconsDir | Out-Null

# The logo already sits on its own dark plate; match it so padding is invisible.
$plate = [System.Drawing.ColorTranslator]::FromHtml('#2B2B2B')
$logo  = [System.Drawing.Image]::FromFile($source)

function Write-Icon {
    param(
        [string] $Path,
        [int]    $Size,
        [double] $Inset = 1.0,      # 1.0 = full bleed, 0.66 = inside the maskable safe zone
        [switch] $Transparent       # for the Android adaptive foreground layer
    )
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size,
        ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.PixelOffsetMode   = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

    if ($Transparent) { $g.Clear([System.Drawing.Color]::Transparent) }
    else              { $g.Clear($plate) }

    $draw = [int][Math]::Round($Size * $Inset)
    $off  = [int][Math]::Round(($Size - $draw) / 2)
    $g.DrawImage($logo, $off, $off, $draw, $draw)

    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $kb = [math]::Round((Get-Item $Path).Length / 1KB, 1)
    Write-Host ("  {0,-46} {1}px  {2} KB" -f (Split-Path $Path -Leaf), $Size, $kb)
}

Write-Host 'web / PWA icons'
Write-Icon (Join-Path $iconsDir 'icon-192.png')          192
Write-Icon (Join-Path $iconsDir 'icon-512.png')          512
Write-Icon (Join-Path $iconsDir 'icon-1024.png')         1024
Write-Icon (Join-Path $iconsDir 'apple-touch-icon.png')  180
# Android crops maskable icons to a circle, so keep the wordmark inside the safe zone
Write-Icon (Join-Path $iconsDir 'icon-512-maskable.png') 512 0.66

$res = Join-Path $root 'android\app\src\main\res'
if (Test-Path $res) {
    Write-Host 'android launcher icons'
    $mipmaps = @{ 'mipmap-mdpi' = 48; 'mipmap-hdpi' = 72; 'mipmap-xhdpi' = 96
                  'mipmap-xxhdpi' = 144; 'mipmap-xxxhdpi' = 192 }
    foreach ($name in $mipmaps.Keys) {
        $dir = Join-Path $res $name
        New-Item -ItemType Directory -Force -Path $dir | Out-Null
        Write-Icon (Join-Path $dir 'ic_launcher.png')       $mipmaps[$name]
        Write-Icon (Join-Path $dir 'ic_launcher_round.png') $mipmaps[$name]
    }
    # adaptive foreground: 108dp canvas, only the middle 72dp is guaranteed visible
    $fg = @{ 'mipmap-mdpi' = 108; 'mipmap-hdpi' = 162; 'mipmap-xhdpi' = 216
             'mipmap-xxhdpi' = 324; 'mipmap-xxxhdpi' = 432 }
    foreach ($name in $fg.Keys) {
        $dir = Join-Path $res $name
        Write-Icon (Join-Path $dir 'ic_launcher_foreground.png') $fg[$name] 0.60 -Transparent
    }

    # adaptive icon descriptors + the plate colour behind the foreground layer
    $vals = Join-Path $res 'values'
    New-Item -ItemType Directory -Force -Path $vals | Out-Null
    $colors = @'
<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="colorPrimary">#111419</color>
    <color name="colorPrimaryDark">#0a0c0f</color>
    <color name="colorAccent">#f26a1b</color>
    <color name="ic_launcher_background">#2B2B2B</color>
</resources>
'@
    Set-Content -Path (Join-Path $vals 'colors.xml') -Value $colors -Encoding UTF8
    $adaptive = @'
<?xml version="1.0" encoding="utf-8"?>
<adaptive-icon xmlns:android="http://schemas.android.com/apk/res/android">
    <background android:drawable="@color/ic_launcher_background"/>
    <foreground android:drawable="@mipmap/ic_launcher_foreground"/>
</adaptive-icon>
'@
    $any = Join-Path $res 'mipmap-anydpi-v26'
    New-Item -ItemType Directory -Force -Path $any | Out-Null
    Set-Content -Path (Join-Path $any 'ic_launcher.xml')       -Value $adaptive -Encoding UTF8
    Set-Content -Path (Join-Path $any 'ic_launcher_round.xml') -Value $adaptive -Encoding UTF8
    Write-Host '  adaptive icon descriptors + colors.xml'
} else {
    Write-Host '  (no android project - skipped launcher icons)'
}

# A small square mark: the logo's wordmark is unreadable at 30px, so crop to
# just the truck for in-app use where the name is already written beside it.
function Write-Mark {
    param([string] $Path, [int] $Size)
    # the truck occupies roughly the top half of the artwork
    $srcX = [int]($logo.Width  * 0.09)
    $srcY = [int]($logo.Height * 0.10)
    $srcW = [int]($logo.Width  * 0.82)
    $srcH = [int]($logo.Height * 0.40)
    $bmp = New-Object System.Drawing.Bitmap $Size, $Size, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.SmoothingMode     = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.Clear($plate)
    # letterbox the wide crop into a square
    $scale  = [Math]::Min($Size / $srcW, $Size / $srcH)
    $drawW  = [int]($srcW * $scale)
    $drawH  = [int]($srcH * $scale)
    $destRect = New-Object System.Drawing.Rectangle ([int](($Size-$drawW)/2)), ([int](($Size-$drawH)/2)), $drawW, $drawH
    $srcRect  = New-Object System.Drawing.Rectangle $srcX, $srcY, $srcW, $srcH
    $g.DrawImage($logo, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)
    $g.Dispose()
    $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Host ("  {0,-46} {1}px" -f (Split-Path $Path -Leaf), $Size)
}

Write-Host 'in-app mark'
Write-Mark (Join-Path $iconsDir 'mark.png') 256

# Favicons come from the mark, not the full logo. A browser tab is 16px and
# the app switcher is not much more; at that size the wordmark under the
# truck is a grey smudge and the whole icon reads as a dark blob. The truck
# alone is still a truck at 16px.
Write-Host 'favicons (the mark - the wordmark is a smudge at tab size)'
Write-Mark (Join-Path $iconsDir 'favicon-32.png') 32
Write-Mark (Join-Path $iconsDir 'favicon-64.png') 64
Write-Mark (Join-Path $iconsDir 'favicon-180.png') 180

$logo.Dispose()
Write-Host 'done'
