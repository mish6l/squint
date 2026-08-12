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

# Geometric test patches must NOT be antialiased. With AntiAlias on, GDI+ blends
# a 1 px white line into a flat 132 grey at source, so the card would appear to
# prove a resolution loss that had already happened before SQUINT saw it.
$g.SmoothingMode = 'None'
$g.PixelOffsetMode = 'Half'

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

# --- gamma fusion patch ---
# A 50/50 duty black/white stripe field. When it is blurred away, correct
# LINEAR-LIGHT fusion lands on linear 0.5, which is sRGB ~188. Fusing in gamma
# space lands on ~128 instead. So the fused grey of this patch is a decisive,
# measurable test of whether the pipeline is linear. The reference block beside
# it is filled with the correct answer (188) to compare against by eye.
$gx = 300; $gy = 1500
for ($i = 0; $i -lt 500; $i += 2) { $g.FillRectangle($white, ($gx + $i), $gy, 1, 260) }
$ref188 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(188,188,188))
$g.FillRectangle($ref188, ($gx + 520), $gy, 260, 260)
$ref128 = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(128,128,128))
$g.FillRectangle($ref128, ($gx + 800), $gy, 260, 260)
$lab = New-Object System.Drawing.Font("Consolas", 24, [System.Drawing.FontStyle]::Regular, [System.Drawing.GraphicsUnit]::Pixel)
$g.DrawString("50/50 stripes", $lab, $grey, $gx, ($gy + 270))
$g.DrawString("188 = linear (right)", $lab, $grey, ($gx + 520), ($gy + 270))
$g.DrawString("128 = gamma (wrong)", $lab, $grey, ($gx + 800), ($gy + 270))

# --- dark ramp for banding / bit-depth checks ---
# A smooth 0..40/255 gradient. On a real panel this posterises; a tool with no
# bit-depth model renders it perfectly smooth.
$rx = 1500; $ry = 1500
for ($i = 0; $i -lt 900; $i++) {
    $v = [int]([math]::Round($i * 40.0 / 900.0))
    $b = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb($v, $v, $v))
    $g.FillRectangle($b, ($rx + $i), $ry, 1, 260)
    $b.Dispose()
}
$g.SmoothingMode = 'AntiAlias'      # text below wants antialiasing again
$g.DrawString("dark ramp 0-40/255 (banding test)", $lab, $grey, $rx, ($gy + 270))

# --- corner registration marks ---
$pen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(255,159,28), 4)
foreach ($c in @(@(0,0),@(($W-300),0),@(0,($H-520)),@(($W-300),($H-520)))) {
    $g.DrawRectangle($pen, ($c[0] + 20), ($c[1] + 20), 260, 260)
}

$out = Join-Path $PSScriptRoot "testcard.png"
$bmp.Save($out, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "WROTE $out"
