# Build DeepSeek Harness desktop shortcut + icon
# Uses the official dsh web favicon (whale) from the installed @deepseek-ai/dsh package.

$ErrorActionPreference = 'Stop'

# --- Config -------------------------------------------------------------
$ShortcutName = 'DeepSeek Harness'
$IconDir = Join-Path $env:LOCALAPPDATA 'DeepSeekHarness'
$IconPath = Join-Path $IconDir 'DeepSeek Harness.ico'
$PngPath  = Join-Path $IconDir 'DeepSeek Harness.png'
$Desktop  = [Environment]::GetFolderPath('Desktop')
$LnkPath  = Join-Path $Desktop "$ShortcutName.lnk"

$DshCmd = Join-Path $env:APPDATA 'npm\dsh.cmd'
if (-not (Test-Path -LiteralPath $DshCmd)) {
    throw "dsh.cmd not found: $DshCmd"
}

New-Item -ItemType Directory -Force -Path $IconDir | Out-Null

# --- WPF / SVG path source ----------------------------------------------
Add-Type -AssemblyName PresentationCore
Add-Type -AssemblyName WindowsBase

$SvgPath = Join-Path $env:APPDATA 'npm\node_modules\@deepseek-ai\dsh\node_modules\@deepseek-ai\dsh-web-frontend\dist\favicon.svg'
$svg = Get-Content -Raw -LiteralPath $SvgPath
$m = [regex]::Match($svg, '\sd="([^"]+)"')
if (-not $m.Success) {
    throw "Cannot find path data in $SvgPath"
}
$PathData = $m.Groups[1].Value

# --- Render one PNG size ------------------------------------------------
function New-RenderedPngBytes {
    param([int]$Size)

    $size = [double]$Size
    $geo = [System.Windows.Media.Geometry]::Parse($PathData).Clone()
    $bounds = $geo.Bounds

    $margin = $size * 0.18
    $scale = [Math]::Min(($size - 2 * $margin) / $bounds.Width, ($size - 2 * $margin) / $bounds.Height)
    $offsetX = ($size - $bounds.Width * $scale) / 2 - $bounds.X * $scale
    $offsetY = ($size - $bounds.Height * $scale) / 2 - $bounds.Y * $scale

    $tg = [System.Windows.Media.TransformGroup]::new()
    $tg.Children.Add([System.Windows.Media.ScaleTransform]::new($scale, $scale)) | Out-Null
    $tg.Children.Add([System.Windows.Media.TranslateTransform]::new($offsetX, $offsetY)) | Out-Null
    $geo.Transform = $tg

    $dv = [System.Windows.Media.DrawingVisual]::new()
    $dc = $dv.RenderOpen()

    $rect = [System.Windows.Rect]::new(0, 0, $size, $size)
    $radius = $size * 0.19

    # Deep navy rounded-square background
    $bgBrush = [System.Windows.Media.LinearGradientBrush]::new(
        [System.Windows.Media.Color]::FromRgb(0x0B, 0x12, 0x20),
        [System.Windows.Media.Color]::FromRgb(0x1B, 0x2A, 0x4A),
        [System.Windows.Point]::new(0, 0),
        [System.Windows.Point]::new(0, 1))
    $dc.DrawRoundedRectangle($bgBrush, $null, $rect, $radius, $radius)

    # Soft DeepSeek-blue glow behind the whale
    $glow = [System.Windows.Media.RadialGradientBrush]::new()
    $center = [System.Windows.Point]::new($size * 0.5, $size * 0.42)
    $glow.Center = $center
    $glow.GradientOrigin = $center
    $glow.RadiusX = 0.55
    $glow.RadiusY = 0.55
    $glow.GradientStops.Add([System.Windows.Media.GradientStop]::new(
        [System.Windows.Media.Color]::FromArgb(120, 0x4D, 0x6B, 0xFE), 0.0)) | Out-Null
    $glow.GradientStops.Add([System.Windows.Media.GradientStop]::new(
        [System.Windows.Media.Color]::FromArgb(0, 0x4D, 0x6B, 0xFE), 1.0)) | Out-Null
    $dc.DrawEllipse($glow, $null, $center, $size * 0.5, $size * 0.5)

    # Official whale path in a white -> light-blue gradient
    $whaleBrush = [System.Windows.Media.LinearGradientBrush]::new(
        [System.Windows.Media.Color]::FromRgb(0xEA, 0xF0, 0xFF),
        [System.Windows.Media.Color]::FromRgb(0x7C, 0x9B, 0xFF),
        [System.Windows.Point]::new(0, 0),
        [System.Windows.Point]::new(0, 1))
    $dc.DrawGeometry($whaleBrush, $null, $geo)

    # Small "H" badge to hint at Harness
    $badgeCx = $size * 0.76
    $badgeCy = $size * 0.76
    $badgeR = $size * 0.14
    $badgeBrush = [System.Windows.Media.SolidColorBrush]::new([System.Windows.Media.Color]::FromRgb(0x4D, 0x6B, 0xFE))
    $badgePen = [System.Windows.Media.Pen]::new(
        [System.Windows.Media.SolidColorBrush]::new([System.Windows.Media.Color]::FromArgb(170, 0xEA, 0xF0, 0xFF)),
        [Math]::Max(1.0, $size * 0.012))
    $dc.DrawEllipse($badgeBrush, $badgePen, [System.Windows.Point]::new($badgeCx, $badgeCy), $badgeR, $badgeR)

    $whiteBrush = [System.Windows.Media.SolidColorBrush]::new([System.Windows.Media.Color]::FromRgb(0xFF, 0xFF, 0xFF))
    $t = [Math]::Max(1.0, $badgeR * 0.24)
    $h = $badgeR * 1.0
    $w = $badgeR * 0.9
    $barRadius = $t * 0.35
    $leftBar = [System.Windows.Rect]::new($badgeCx - $w / 2, $badgeCy - $h / 2, $t, $h)
    $rightBar = [System.Windows.Rect]::new($badgeCx + $w / 2 - $t, $badgeCy - $h / 2, $t, $h)
    $crossBar = [System.Windows.Rect]::new($badgeCx - $w / 2, $badgeCy - $t / 2, $w, $t)
    $dc.DrawRoundedRectangle($whiteBrush, $null, $leftBar, $barRadius, $barRadius)
    $dc.DrawRoundedRectangle($whiteBrush, $null, $rightBar, $barRadius, $barRadius)
    $dc.DrawRoundedRectangle($whiteBrush, $null, $crossBar, $barRadius, $barRadius)

    $dc.Close()

    $rtb = [System.Windows.Media.Imaging.RenderTargetBitmap]::new(
        $Size, $Size, 96, 96, [System.Windows.Media.PixelFormats]::Pbgra32)
    $rtb.Render($dv)

    $enc = [System.Windows.Media.Imaging.PngBitmapEncoder]::new()
    $enc.Frames.Add([System.Windows.Media.Imaging.BitmapFrame]::Create($rtb)) | Out-Null
    $ms = [System.IO.MemoryStream]::new()
    $enc.Save($ms)
    return ,$ms.ToArray()
}

# --- Generate PNG preview ------------------------------------------------
$pngBytes = New-RenderedPngBytes -Size 256
[System.IO.File]::WriteAllBytes($PngPath, $pngBytes)

# --- Generate multi-size ICO --------------------------------------------
$sizes = @(256, 128, 64, 48, 32, 16)
$images = @{}
foreach ($s in $sizes) {
    $images[$s] = New-RenderedPngBytes -Size $s
}

$icoStream = [System.IO.MemoryStream]::new()
$bw = [System.IO.BinaryWriter]::new($icoStream)

# ICO header: reserved=0, type=1, count
$bw.Write([UInt16]0)
$bw.Write([UInt16]1)
$bw.Write([UInt16]$sizes.Count)

$offset = 6 + 16 * $sizes.Count
foreach ($s in $sizes) {
    $bytes = $images[$s]
    $dim = if ($s -ge 256) { 0 } else { $s }
    $bw.Write([Byte]$dim)          # width (0 means 256)
    $bw.Write([Byte]$dim)          # height
    $bw.Write([Byte]0)             # color count
    $bw.Write([Byte]0)             # reserved
    $bw.Write([UInt16]1)           # color planes
    $bw.Write([UInt16]32)          # bits per pixel
    $bw.Write([UInt32]$bytes.Length)
    $bw.Write([UInt32]$offset)
    $offset += $bytes.Length
}

foreach ($s in $sizes) {
    $bw.Write($images[$s])
}
$bw.Flush()
[System.IO.File]::WriteAllBytes($IconPath, $icoStream.ToArray())
$bw.Dispose()
$icoStream.Dispose()

# --- Create desktop shortcut --------------------------------------------
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($LnkPath)
$sc.TargetPath = "$env:ComSpec"
$sc.Arguments = "/c `"$DshCmd`" web"
$sc.WorkingDirectory = $env:USERPROFILE
$sc.IconLocation = "$IconPath,0"
$sc.Description = 'Launch DeepSeek Harness web UI (dsh web)'
$sc.WindowStyle = 1
$sc.Save()

Write-Output "Shortcut created: $LnkPath"
Write-Output "Icon: $IconPath"
Write-Output "PNG preview: $PngPath"
