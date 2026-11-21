# PNG app icons from a source image (iOS apple-touch-icon does not support SVG).
# Usage: powershell -ExecutionPolicy Bypass -File scripts/make-icons.ps1 <source.png>
param([string]$Source = "$PSScriptRoot\..\assets\icon-source.png")
Add-Type -AssemblyName System.Drawing

function New-Icon([System.Drawing.Image]$src, [int]$size, [string]$path, [double]$scale) {
  $bmp = New-Object System.Drawing.Bitmap $size, $size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = 'HighQualityBicubic'
  $g.SmoothingMode = 'AntiAlias'
  $g.PixelOffsetMode = 'HighQuality'
  $g.Clear([System.Drawing.Color]::FromArgb(255, 11, 11, 15))
  $d = [int]($size * $scale)
  $o = [int](($size - $d) / 2)
  $g.DrawImage($src, $o, $o, $d, $d)
  $bmp.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
  $g.Dispose(); $bmp.Dispose()
}

$pub = Join-Path (Split-Path -Parent $PSScriptRoot) 'public'
$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source))
New-Icon $src 180 (Join-Path $pub 'apple-touch-icon.png') 1.0
New-Icon $src 192 (Join-Path $pub 'icon-192.png') 1.0
New-Icon $src 512 (Join-Path $pub 'icon-512.png') 1.0
# Maskable: keep content inside the 80% safe zone
New-Icon $src 512 (Join-Path $pub 'icon-maskable-512.png') 0.8
New-Icon $src 64 (Join-Path $pub 'favicon-64.png') 1.0
$src.Dispose()
Write-Output 'Icons generated.'
