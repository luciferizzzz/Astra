# Generates resources/icon.ico from the application logo.
#
#   .\scripts\make-icon.ps1
#
# electron-builder resolves the Windows icon from `buildResources` (resources/)
# and uses a valid .ico as-is — no icon-conversion tool download, so packaging
# stays offline. The logo is RGBA on transparency; every size is a straight
# downscale written as a PNG-compressed ICO entry, which Windows 10/11 reads
# for all sizes (the supported target, PRD §10.6).
#
# Re-run after the logo changes, then `npm run make` to repackage.
param(
  [string]$Source = (Join-Path $PSScriptRoot '..\src\renderer\src\assets\Astra-logo-png.png'),
  [string]$Output = (Join-Path $PSScriptRoot '..\resources\icon.ico'),
  [int[]]$Sizes = @(256, 128, 64, 48, 32, 16)
)

Add-Type -AssemblyName System.Drawing

$sourceBitmap = [System.Drawing.Bitmap]::new((Resolve-Path $Source).Path)
try {
  $blobs = @()
  foreach ($size in $Sizes) {
    $bmp = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)
    $gfx.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
    $gfx.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gfx.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gfx.DrawImage($sourceBitmap, 0, 0, $size, $size)
    $gfx.Dispose()

    $ms = [System.IO.MemoryStream]::new()
    $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    $blobs += , @($size, $ms.ToArray())
    $ms.Dispose()
  }

  # ICONDIR (6 bytes) + ICONDIRENTRY (16 bytes each) + PNG payloads.
  $out = [System.IO.MemoryStream]::new()
  $bw = [System.IO.BinaryWriter]::new($out)
  $bw.Write([uint16]0)             # reserved, always 0
  $bw.Write([uint16]1)             # type 1 = icon
  $bw.Write([uint16]$blobs.Count)

  $offset = 6 + 16 * $blobs.Count
  foreach ($entry in $blobs) {
    $dimension = if ($entry[0] -ge 256) { [byte]0 } else { [byte]$entry[0] } # 0 encodes 256
    $bw.Write($dimension)          # width
    $bw.Write($dimension)          # height
    $bw.Write([byte]0)             # palette size (32bpp: none)
    $bw.Write([byte]0)             # reserved
    $bw.Write([uint16]1)           # colour planes
    $bw.Write([uint16]32)          # bits per pixel
    $bw.Write([uint32]$entry[1].Length)
    $bw.Write([uint32]$offset)
    $offset += $entry[1].Length
  }
  foreach ($entry in $blobs) { $bw.Write($entry[1]) }
  $bw.Flush()

  $outDir = Split-Path $Output -Parent
  if (-not (Test-Path $outDir)) { New-Item -ItemType Directory -Path $outDir | Out-Null }
  [System.IO.File]::WriteAllBytes($Output, $out.ToArray())
  $bw.Dispose()
  $out.Dispose()
  Write-Host "wrote $Output ($([Math]::Round((Get-Item $Output).Length / 1kb, 1)) KB, $($blobs.Count) sizes: $($Sizes -join ', '))"
}
finally {
  $sourceBitmap.Dispose()
}
