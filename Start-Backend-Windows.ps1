$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
$env:YTDLP_PATH = Join-Path $PSScriptRoot 'backend\tools\yt-dlp.exe'
$env:DATA_DIR = Join-Path $PSScriptRoot 'backend\data'
$env:HOST = '127.0.0.1'
$env:SOFTLOAD_LOCAL = '0'
if (-not (Test-Path -LiteralPath $env:YTDLP_PATH)) { throw 'yt-dlp.exe belum tersedia. Jalankan Setup-Windows.ps1 terlebih dahulu.' }
if (-not (Get-Command ffmpeg -ErrorAction SilentlyContinue)) { throw 'ffmpeg belum tersedia di PATH. Jalankan Setup-Windows.ps1 atau buka PowerShell baru.' }
if (-not (Get-Command ffprobe -ErrorAction SilentlyContinue)) { throw 'ffprobe belum tersedia di PATH. Jalankan Setup-Windows.ps1 atau buka PowerShell baru.' }
& node --env-file=backend/.env backend/server.mjs
if ($LASTEXITCODE -ne 0) { throw 'Backend berhenti. Periksa dependensi dan konfigurasi HTTPS di backend\.env.' }

 
    
                         