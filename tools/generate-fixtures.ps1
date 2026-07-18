$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent (Split-Path -Parent $MyInvocation.MyCommand.Path)
$output = Join-Path $root "assets/fixtures"
New-Item -ItemType Directory -Force -Path $output | Out-Null

function New-Canvas([string]$name, [scriptblock]$draw) {
  $bitmap = New-Object System.Drawing.Bitmap 960, 600
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
  & $draw $graphics
  $bitmap.Save((Join-Path $output $name), [System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose()
  $bitmap.Dispose()
}

New-Canvas "balanced-launch.png" {
  param($g)
  $g.Clear([System.Drawing.Color]::FromArgb(35, 38, 42))
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(41, 157, 170))), 70, 70, 430, 460)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(239, 200, 74))), 170, 145, 250, 250)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(232, 235, 229))), 610, 95, 250, 22)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(184, 243, 65))), 610, 135, 185, 12)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(94, 101, 99))), 610, 175, 215, 9)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(58, 64, 63))), 610, 201, 170, 9)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(19, 21, 20))), 585, 360, 300, 150)
}

New-Canvas "blown-highlights.png" {
  param($g)
  $g.Clear([System.Drawing.Color]::FromArgb(220, 222, 216))
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 390, 0, 570, 600)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(255, 247, 190))), 130, 85, 420, 420)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(245, 231, 169))), 70, 450, 760, 105)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)), 610, 100, 280, 180)
}

New-Canvas "flat-export.png" {
  param($g)
  $g.Clear([System.Drawing.Color]::FromArgb(128, 132, 130))
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(139, 143, 141))), 75, 70, 420, 460)
  $g.FillEllipse((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(121, 126, 123))), 170, 145, 250, 250)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(134, 138, 136))), 610, 95, 240, 18)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(123, 128, 125))), 610, 135, 190, 11)
  $g.FillRectangle((New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::FromArgb(136, 140, 138))), 585, 360, 300, 150)
}

Write-Host "FRAMEFORGE FIXTURES GENERATED"
