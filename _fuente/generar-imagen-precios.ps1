# Genera assets/exp-formato-precio/lista-precios.png desde _fuente/datos/precios.json.
# Rasteriza el texto: los precios quedan sólo como píxeles, sin metadatos de texto en el PNG.
# Uso (Windows PowerShell): powershell -ExecutionPolicy Bypass -File _fuente/generar-imagen-precios.ps1

Add-Type -AssemblyName System.Drawing

$fuente = Split-Path -Parent $MyInvocation.MyCommand.Path
$raiz = Split-Path -Parent $fuente
$datos = Get-Content -Raw -Encoding UTF8 (Join-Path $fuente 'datos/precios.json') | ConvertFrom-Json
$destino = Join-Path $raiz 'assets/exp-formato-precio/lista-precios.png'
New-Item -ItemType Directory -Force (Split-Path -Parent $destino) | Out-Null

$ar = [System.Globalization.CultureInfo]::GetCultureInfo('es-AR')
$ancho = 900; $alto = 460
$bmp = New-Object System.Drawing.Bitmap $ancho, $alto
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = 'AntiAlias'
$g.TextRenderingHint = 'AntiAliasGridFit'

$fondo = [System.Drawing.Color]::FromArgb(255, 251, 248, 240)
$verde = [System.Drawing.Color]::FromArgb(255, 31, 92, 58)
$tinta = [System.Drawing.Color]::FromArgb(255, 34, 34, 34)
$linea = [System.Drawing.Color]::FromArgb(255, 214, 205, 186)

$g.Clear($fondo)
$g.FillRectangle((New-Object System.Drawing.SolidBrush $verde), 0, 0, $ancho, 84)
$fTitulo = New-Object System.Drawing.Font 'Segoe UI Semibold', 24
$fFila = New-Object System.Drawing.Font 'Segoe UI', 19
$fPrecio = New-Object System.Drawing.Font 'Segoe UI Semibold', 20
$blanco = [System.Drawing.Brushes]::White
$pincelTinta = New-Object System.Drawing.SolidBrush $tinta
$lapiz = New-Object System.Drawing.Pen $linea, 1

$g.DrawString($datos.titulo, $fTitulo, $blanco, 36, 22)

$derecha = New-Object System.Drawing.StringFormat
$derecha.Alignment = 'Far'
$y = 112; $paso = 64
foreach ($p in $datos.productos) {
  $precio = '$' + ([double]$p.precio).ToString('N0', $ar)
  $g.DrawString($p.nombre, $fFila, $pincelTinta, 36, $y)
  $g.DrawString($precio, $fPrecio, $pincelTinta, (New-Object System.Drawing.RectangleF 0, ($y - 1), ($ancho - 36), 40), $derecha)
  $g.DrawLine($lapiz, 36, ($y + $paso - 12), ($ancho - 36), ($y + $paso - 12))
  $y += $paso
}

$bmp.Save($destino, [System.Drawing.Imaging.ImageFormat]::Png)
$g.Dispose(); $bmp.Dispose()
Write-Output "Imagen generada: $destino"
