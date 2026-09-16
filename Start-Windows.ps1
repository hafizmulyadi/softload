$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
if (-not (Test-Path -LiteralPath 'backend\.env') -or -not (Test-Path -LiteralPath 'backend\tools\yt-dlp.exe')) { throw 'Jalankan Setup-Windows.ps1 terlebih dahulu.' }
& node --env-file=backend/.env windows-local.mjs
if ($LASTEXITCODE -ne 0) { throw 'Softload berhenti karena kesalahan. Periksa pesan di atas.' }


  
                                                                                                                           