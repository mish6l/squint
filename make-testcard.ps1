# Generates a 3840x2160 LED legibility test card for SQUINT.
# Pure ASCII, no external tools - System.Drawing only.
Add-Type -AssemblyName System.Drawing

$W = 3840; $H = 2160
$bmp = New-Object System.Drawing.Bitmap($W, $H)
$g   = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode     = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'
$g.Clear([System.Drawing.Color]::FromArgb(8,10,14))

$white = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::White)
$amber = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255,159,28))
$grey  = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(150,158,170))

# --- title ---
$f = New-Object System.Drawing.Font("Segoe UI", 96, [System.Drawing.FontStyle]::Bold, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString("SQUINT TEST CARD", $f, $amber, 80, 70)
$f2 = New-Object System.Drawing.Font("Segoe UI", 34, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString("3840 x 2160 source - measure any row to check legibility", $f2, $grey, 84, 190)

# --- text ladder: each row labelled with its true pixel height ---
$sizes = @(140, 96, 64, 44, 30, 22, 16, 12)
$y = 300
foreach ($s in $sizes) {
    $ff = New-Object System.Drawing.Font("Segoe UI", $s, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString("$s px  Handgloves 0123 REGISTER NOW", $ff, $white, 80, $y)
    $lab = New-Object System.Drawing.Font("Consolas", 20, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString("$s", $lab, $amber, 30, ($y + $s * 0.25))
    $y += [int]($s * 1.45) + 26
    $ff.Dispose()
}

# --- hairline wedge: 1..6 px rules ---
$x = 2500; $y2 = 300
foreach ($w in 1,2,3,4,6,8) {
    $pen = New-Object System.Drawing.Pen([System.Drawing.Color]::White, $w)
    $g.DrawLine($pen, $x, $y2, ($x + 900), $y2)
    $lab = New-Object System.Drawing.Font("Consolas", 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString("$w px rule", $lab, $grey, ($x + 920), ($y2 - 14))
    $y2 += 90
    $pen.Dispose()
}

# --- frequency burst patches: 1,2,4,8 px stripe pairs ---
$x = 2500; $y3 = 900
foreach ($p in 1,2,4,8) {
    for ($i = 0; $i -lt 400; $i += ($p * 2)) {
        $g.FillRectangle($white, ($x + $i), $y3, $p, 120)
    }
    $lab = New-Object System.Drawing.Font("Consolas", 22, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
    $g.DrawString("$p px stripes", $lab, $grey, ($x + 420), ($y3 + 46))
    $y3 += 150
}

# --- colour bars ---
$cols = @(
    [System.Drawing.Color]::FromArgb(255,0,0),   [System.Drawing.Color]::FromArgb(0,255,0),
    [System.Drawing.Color]::FromArgb(0,0,255),   [System.Drawing.Color]::FromArgb(255,255,0),
    [System.Drawing.Color]::FromArgb(0,255,255), [System.Drawing.Color]::FromArgb(255,0,255),
    [System.Drawing.Color]::FromArgb(255,255,255)
)
$bw = [int]($W / $cols.Count)
for ($i = 0; $i -lt $cols.Count; $i++) {
    $b = New-Object System.Drawing.SolidBrush($cols[$i])
    $g.FillRectangle($b, ($i * $bw), ($H - 220), $bw, 220)
    $b.Dispose()
}

# --- corner registration marks ---
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,159,28), 4)
foreach ($c in @(@(0,0),@(($W-300),0),@(0,($H-520)),@(($W-300),($H-520)))) {
    $g.DrawRectangle($pen, ($c[0] + 20), ($c[1] + 20), 260, 260)
}

$out = Join-Path $PSScriptRoot "testcard.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "WROTE $out"
