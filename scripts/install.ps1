<#
  Instalador de Armonía Lab para Windows 11.
  Uso: doble clic en INSTALAR.bat (o: powershell -ExecutionPolicy Bypass -File scripts\install.ps1)

  Opciones:
    -SinPistas   no instala PyTorch/Demucs (separación de pistas), ahorra ~3 GB
    -SinIA       no descarga el modelo de Ollama
    -Modelo X    modelo de Ollama a usar (por defecto qwen2.5:7b, cabe en 8 GB de VRAM)
#>
param(
  [switch]$SinPistas,
  [switch]$SinIA,
  [string]$Modelo = "qwen2.5:7b"
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

function Paso($t) { Write-Host "`n==> $t" -ForegroundColor Yellow }
function Ok($t) { Write-Host "    $t" -ForegroundColor Green }
function Existe($cmd) { return [bool](Get-Command $cmd -ErrorAction SilentlyContinue) }
function RefrescarPath {
  # winget instala programas pero la consola actual no ve el PATH nuevo hasta recargarlo.
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" + [Environment]::GetEnvironmentVariable("Path", "User")
}

Paso "Comprobando herramientas (uv para Python, Node.js para la web)"
if (-not (Existe "uv")) {
  winget install --id astral-sh.uv -e --accept-source-agreements --accept-package-agreements
  RefrescarPath
}
if (-not (Existe "node")) {
  winget install --id OpenJS.NodeJS.LTS -e --accept-source-agreements --accept-package-agreements
  RefrescarPath
}
Ok "uv $(uv --version)  ·  node $(node --version)"

Paso "Creando entorno Python 3.12 (.venv)"
# Python 3.12 y no el más reciente: PyTorch y Demucs publican ruedas para 3.12 con seguridad.
uv python install 3.12
if (-not (Test-Path ".venv")) { uv venv --python 3.12 .venv }
$Py = Join-Path $Root ".venv\Scripts\python.exe"
uv pip install --python $Py -r backend\requirements.txt
Ok "Dependencias del backend instaladas"

if (-not $SinPistas) {
  Paso "Instalando separación de pistas (PyTorch con CUDA 12.8 para la RTX 5060 + Demucs)"
  # Las RTX serie 50 (Blackwell) necesitan PyTorch compilado con CUDA 12.8 o superior.
  uv pip install --python $Py torch torchaudio --index-url https://download.pytorch.org/whl/cu128
  uv pip install --python $Py -r backend\requirements-pistas.txt
  Ok "Whisper (letras) instalado; el modelo se descarga la primera vez que transcribas (~460 MB)"
  # Demucs y librosa usan ffmpeg para leer mp3/m4a.
  if (-not (Existe "ffmpeg")) {
    winget install --id Gyan.FFmpeg -e --accept-source-agreements --accept-package-agreements
    RefrescarPath
  }
  & $Py -c "import torch; print('    GPU disponible:', torch.cuda.is_available(), '-', torch.cuda.get_device_name(0) if torch.cuda.is_available() else 'CPU')"
}

Paso "Descargando el piano de cola (Salamander Grand Piano, CC-BY 3.0)"
$Samples = Join-Path $Root "frontend\public\samples\salamander"
New-Item -ItemType Directory -Force -Path $Samples | Out-Null
$Notas = "A0 C1 Ds1 Fs1 A1 C2 Ds2 Fs2 A2 C3 Ds3 Fs3 A3 C4 Ds4 Fs4 A4 C5 Ds5 Fs5 A5 C6 Ds6 Fs6 A6 C7 Ds7 Fs7 A7 C8".Split(" ")
foreach ($n in $Notas) {
  $dest = Join-Path $Samples "$n.mp3"
  if (-not (Test-Path $dest)) {
    try { Invoke-WebRequest "https://tonejs.github.io/audio/salamander/$n.mp3" -OutFile $dest -UseBasicParsing }
    catch { Write-Host "    No se pudo descargar $n (se usará el sintetizador)" -ForegroundColor DarkYellow }
  }
}
Ok "Samples en $Samples"

Paso "Compilando la interfaz web"
Push-Location frontend
npm ci
npm run build
Pop-Location
Ok "Web compilada en frontend\dist"

if (-not $SinIA) {
  Paso "Preparando el asistente local (Ollama + $Modelo)"
  if (Existe "ollama") {
    ollama pull $Modelo
    Ok "Modelo $Modelo listo"
  } else {
    Write-Host "    Ollama no está en el PATH. Instálalo desde ollama.com y ejecuta: ollama pull $Modelo" -ForegroundColor DarkYellow
  }
}

Paso "Creando acceso directo en el escritorio"
$Shell = New-Object -ComObject WScript.Shell
$Lnk = $Shell.CreateShortcut((Join-Path ([Environment]::GetFolderPath("Desktop")) "Armonía Lab.lnk"))
$Lnk.TargetPath = Join-Path $Root "ARRANCAR.bat"
$Lnk.WorkingDirectory = $Root
$Lnk.Save()

Write-Host "`nListo. Abre 'Armonía Lab' en el escritorio (o ARRANCAR.bat)." -ForegroundColor Green
