$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
function Refresh-Path {
  $env:Path = [Environment]::GetEnvironmentVariable('Path','Machine') + ';' + [Environment]::GetEnvironmentVariable('Path','User')
}
foreach ($dep in @(@{Command='node';Package='OpenJS.NodeJS.LTS'}, @{Command='ffmpeg';Package='Gyan.FFmpeg'})) {
  if (-not (Get-Command $dep.Command -ErrorAction SilentlyContinue)) {
    if (-not (Get-Command winget -ErrorAction SilentlyContinue)) { throw 'Pasang App Installer (winget) dari Microsoft Store, lalu coba kembali.' }
    & winget install --id $dep.Package --exact --accept-package-agreements --accept-source-agreements
    if ($LASTEXITCODE -ne 0) { throw "Pemasangan $($dep.Package) gagal." }
    Refresh-Path
  }
}
& node -e "if(Number(process.versions.node.split('.')[0])<22)process.exit(1)"
if ($LASTEXITCODE -ne 0) { throw 'Node.js 22 atau lebih baru diperlukan. Perbarui Node.js lalu jalankan ulang.' }
& ffmpeg -version | Select-Object -First 1
& ffprobe -version | Select-Object -First 1
$toolsDir = Join-Path $PSScriptRoot 'backend\tools'
New-Item -ItemType Directory -Path $toolsDir -Force | Out-Null
$downloadPath = Join-Path $toolsDir 'yt-dlp.exe'
$hashPath = Join-Path $toolsDir 'SHA2-256SUMS'
function Download-File($Uri, $OutFile) {
  if (Get-Command curl.exe -ErrorAction SilentlyContinue) {
    & curl.exe --fail --location --retry 3 --retry-delay 2 --connect-timeout 20 --output $OutFile $Uri
    if ($LASTEXITCODE -eq 0) { return }
  }
  for ($attempt = 1; $attempt -le 3; $attempt++) {
    try { Invoke-WebRequest -UseBasicParsing -Uri $Uri -OutFile $OutFile; return }
    catch { if ($attempt -eq 3) { throw }; Start-Sleep -Seconds 2 }
  }
}
Download-File 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe' $downloadPath
Download-File 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/SHA2-256SUMS' $hashPath
$entry = Get-Content -LiteralPath $hashPath | Where-Object { $_ -match '\s+\*?yt-dlp\.exe$' } | Select-Object -First 1
if (-not $entry) { throw 'Checksum yt-dlp tidak ditemukan.' }
$expectedHash = ($entry -split '\s+')[0]
if ((Get-FileHash -LiteralPath $downloadPath -Algorithm SHA256).Hash -ne $expectedHash) { throw 'Checksum yt-dlp tidak cocok. Jalankan setup kembali.' }
$envFile = Join-Path $PSScriptRoot 'backend\.env'
if (-not (Test-Path -LiteralPath $envFile)) {
  $secret = & node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  @("BACKEND_SECRET=$secret", 'PUBLIC_BASE_URL=http://127.0.0.1:8080') | Set-Content -LiteralPath $envFile -Encoding ascii
}
Write-Host 'Siap. Jalankan Start-Windows.ps1 untuk membuka Softload.'


  
                                                                                                                                                            