# Turns one tall capture of the settings page into the screenshot sizes the
# Chrome Web Store accepts. Each tile covers a band of the page, is scaled
# uniformly so nothing is stretched, and is centred on a 1280x800 canvas filled
# with the page's own background, so the extra margin reads as a wider window.
#
#   powershell -File store-assets/make-store-shots.ps1 -Source capture.png -OutDir store-assets
#
# Variable names here avoid single letters: PowerShell is case-insensitive, and a
# loop counter like $h silently overwrites the page height kept in $H.
param(
  [Parameter(Mandatory = $true)][string]$Source,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [int]$Tiles = 5
)

Add-Type -AssemblyName System.Drawing

$src = [System.Drawing.Image]::FromFile((Resolve-Path $Source).Path)
$SrcWidth = [int]$src.Width
$SrcHeight = [int]$src.Height
Write-Output "source: $SrcWidth x $SrcHeight"

# The top-left pixel is the page's own body fill, so the padding matches it.
$probe = [System.Drawing.Bitmap]::new(1, 1)
$probeGraphics = [System.Drawing.Graphics]::FromImage($probe)
$probeGraphics.DrawImage($src, [System.Drawing.Rectangle]::new(0, 0, 1, 1), [System.Drawing.Rectangle]::new(0, 0, 1, 1), [System.Drawing.GraphicsUnit]::Pixel)
$probeGraphics.Dispose()
$bg = $probe.GetPixel(0, 0)
$probe.Dispose()
Write-Output ("background: #{0:X2}{1:X2}{2:X2}" -f $bg.R, $bg.G, $bg.B)

$BandHeight = [int][Math]::Ceiling($SrcHeight / [double]$Tiles)
Write-Output "band: $BandHeight rows, $Tiles tiles"

if (-not (Test-Path $OutDir)) { New-Item -ItemType Directory -Path $OutDir | Out-Null }
Get-ChildItem $OutDir -Filter '*-settings-*.png' -ErrorAction SilentlyContinue | Remove-Item -Force

for ($index = 0; $index -lt $Tiles; $index++) {
  $Start = [int][Math]::Min($index * $BandHeight, [Math]::Max(0, $SrcHeight - $BandHeight))
  $Rows = [int][Math]::Min($BandHeight, $SrcHeight - $Start)

  # A band canvas of exactly BandHeight rows, padded below if the page ends early.
  $bandBmp = [System.Drawing.Bitmap]::new($SrcWidth, $BandHeight)
  $bandGraphics = [System.Drawing.Graphics]::FromImage($bandBmp)
  $bandGraphics.Clear($bg)
  $bandGraphics.DrawImage($src, [System.Drawing.Rectangle]::new(0, 0, $SrcWidth, $Rows), [System.Drawing.Rectangle]::new(0, $Start, $SrcWidth, $Rows), [System.Drawing.GraphicsUnit]::Pixel)
  $bandGraphics.Dispose()

  # Uniform scale to 800 rows: width and height use the same factor, so nothing
  # is stretched. The store's exact canvas is filled with the page colour.
  $ScaledWidth = [int][Math]::Round($SrcWidth * 800.0 / $BandHeight)
  $scaled = [System.Drawing.Bitmap]::new($ScaledWidth, 800)
  $scaleGraphics = [System.Drawing.Graphics]::FromImage($scaled)
  $scaleGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $scaleGraphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
  $scaleGraphics.DrawImage($bandBmp, [System.Drawing.Rectangle]::new(0, 0, $ScaledWidth, 800))
  $scaleGraphics.Dispose()
  $bandBmp.Dispose()

  $out = [System.Drawing.Bitmap]::new(1280, 800)
  $outGraphics = [System.Drawing.Graphics]::FromImage($out)
  $outGraphics.Clear($bg)
  $outGraphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::NearestNeighbor
  # The band is narrower than the store's canvas after the uniform scale. Instead
  # of a flat strip at each side, continue the outermost column of the real
  # capture: on the page's gradient header that keeps the gradient going, and on
  # the flat body it is the same colour the padding would have been.
  $margin = [int][Math]::Round((1280 - $ScaledWidth) / 2.0)
  # Drawing one source column stretched into the margin is what continues the
  # page's gradient header past the capture's edge. GDI+ stretches the left one
  # correctly but drops the right one when the destination touches the canvas
  # edge, so both margins are painted column by column from the outermost pixel.
  for ($col = 0; $col -lt $margin; $col++) {
    $outGraphics.DrawImage($scaled,
      [System.Drawing.Rectangle]::new($col, 0, 1, 800),
      [System.Drawing.Rectangle]::new(0, 0, 1, 800), [System.Drawing.GraphicsUnit]::Pixel)
  }
  $rightStart = $margin + $ScaledWidth
  for ($col = 0; $col -lt (1280 - $rightStart); $col++) {
    $outGraphics.DrawImage($scaled,
      [System.Drawing.Rectangle]::new($rightStart + $col, 0, 1, 800),
      [System.Drawing.Rectangle]::new($ScaledWidth - 1, 0, 1, 800), [System.Drawing.GraphicsUnit]::Pixel)
  }
  $outGraphics.DrawImage($scaled, $margin, 0)
  $outGraphics.Dispose()
  $scaled.Dispose()

  $name = '{0:D2}-settings-{1:D2}-of-{2:D2}.png' -f ($index + 1), ($index + 1), $Tiles
  $out.Save((Join-Path $OutDir $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $out.Dispose()
  Write-Output ("  {0}  page rows {1}-{2}  -> 1280x800" -f $name, $Start, ($Start + $Rows))
}

$src.Dispose()
Write-Output "done"
