[CmdletBinding()]
param(
  [switch]$Latest,
  [switch]$ValidateOnly
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

$NodeVersion = '22.23.2'
$RepoOwner = 'MariosGiannakaras'
$RepoName = 'RheomIQ'
$Root = (Resolve-Path (Join-Path $PSScriptRoot '..')).Path
$EnvFile = Join-Path $Root '.env'
$ProvisionDir = Join-Path $env:APPDATA 'RheomIQ'
$PendingProvision = Join-Path $ProvisionDir 'pending-provision.json'
$BuildCache = Join-Path $env:LOCALAPPDATA 'RheomIQ-build'
$TempDir = Join-Path $env:TEMP 'RheomIQ-Desktop-Install'

function Write-Step([string]$Message) {
  Write-Host "`n==> $Message" -ForegroundColor Cyan
}

function Read-DotEnv([string]$Path) {
  $values = @{}
  if (-not (Test-Path $Path)) { return $values }
  foreach ($rawLine in Get-Content -LiteralPath $Path -Encoding UTF8) {
    $line = $rawLine.Trim()
    if (-not $line -or $line.StartsWith('#')) { continue }
    $index = $line.IndexOf('=')
    if ($index -lt 1) { continue }
    $name = $line.Substring(0, $index).Trim()
    $value = $line.Substring($index + 1).Trim()
    if (($value.StartsWith('"') -and $value.EndsWith('"')) -or ($value.StartsWith("'") -and $value.EndsWith("'"))) {
      $value = $value.Substring(1, $value.Length - 2)
    }
    if ($name) { $values[$name] = $value }
  }
  return $values
}

function Get-ConfiguredValue([hashtable]$DotEnv, [string]$Name) {
  $processValue = [Environment]::GetEnvironmentVariable($Name, 'Process')
  if ($processValue) { return $processValue.Trim() }
  if ($DotEnv.ContainsKey($Name) -and $DotEnv[$Name]) { return ([string]$DotEnv[$Name]).Trim() }
  return ''
}

function Assert-PublicConfig([string]$SupabaseUrl, [string]$PublishableKey) {
  $uri = $null
  if (-not [Uri]::TryCreate($SupabaseUrl, [UriKind]::Absolute, [ref]$uri) -or $uri.Scheme -ne 'https' -or -not $uri.Host) {
    throw 'SUPABASE_URL must be a valid HTTPS URL.'
  }
  if (-not $PublishableKey -or $PublishableKey.Length -gt 4096 -or $PublishableKey -match '\s') {
    throw 'SUPABASE_PUBLISHABLE_KEY is invalid.'
  }
}

function Assert-CardVaultKey([string]$Key) {
  if (-not $Key) { return }
  if ($Key -match '^[0-9a-fA-F]{64}$') { return }
  try { $bytes = [Convert]::FromBase64String($Key) } catch { throw 'CARD_VAULT_KEY must be 64 hex characters or Base64 for exactly 32 bytes.' }
  if ($bytes.Length -ne 32) { throw 'CARD_VAULT_KEY must decode to exactly 32 bytes.' }
}

function ConvertFrom-SecureStringPlain([Security.SecureString]$Secure) {
  if (-not $Secure -or $Secure.Length -eq 0) { return '' }
  $ptr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($Secure)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($ptr) }
  finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($ptr) }
}

function Protect-FileForCurrentUser([string]$Path) {
  $sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
  & icacls.exe $Path '/inheritance:r' '/grant:r' "*${sid}:F" | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Could not restrict the provisioning file ACL.' }
}

function Write-ProvisionPayload([string]$SupabaseUrl, [string]$PublishableKey, [string]$CardVaultKey, [int]$CardVaultKeyVersion) {
  New-Item -ItemType Directory -Force -Path $ProvisionDir | Out-Null
  $payload = [ordered]@{
    supabaseUrl = $SupabaseUrl.TrimEnd('/')
    supabasePublishableKey = $PublishableKey
    cardVaultKeyVersion = $CardVaultKeyVersion
  }
  if ($CardVaultKey) { $payload.cardVaultKey = $CardVaultKey }
  $json = $payload | ConvertTo-Json -Depth 3
  $utf8NoBom = New-Object System.Text.UTF8Encoding($false)
  [IO.File]::WriteAllText($PendingProvision, $json, $utf8NoBom)
  Protect-FileForCurrentUser $PendingProvision
}

function Remove-PendingProvision {
  if (-not (Test-Path $PendingProvision)) { return }
  try {
    $length = (Get-Item -LiteralPath $PendingProvision).Length
    if ($length -gt 0 -and $length -le 1MB) {
      [IO.File]::WriteAllBytes($PendingProvision, (New-Object byte[] ([int]$length)))
    }
  } catch { }
  Remove-Item -LiteralPath $PendingProvision -Force -ErrorAction SilentlyContinue
}

function Get-Node22 {
  $node = Get-Command node.exe -ErrorAction SilentlyContinue
  $npm = Get-Command npm.cmd -ErrorAction SilentlyContinue
  if ($node -and $npm) {
    $major = (& $node.Source -p "process.versions.node.split('.')[0]").Trim()
    if ($major -eq '22') {
      return @{ Node = $node.Source; Npm = $npm.Source }
    }
  }

  Write-Step "Downloading verified Node.js v$NodeVersion for the desktop build"
  New-Item -ItemType Directory -Force -Path $BuildCache | Out-Null
  $archiveName = "node-v$NodeVersion-win-x64.zip"
  $archive = Join-Path $BuildCache $archiveName
  $checksums = Join-Path $BuildCache "SHASUMS256-v$NodeVersion.txt"
  $base = "https://nodejs.org/dist/v$NodeVersion"
  Invoke-WebRequest -UseBasicParsing -Uri "$base/$archiveName" -OutFile $archive
  Invoke-WebRequest -UseBasicParsing -Uri "$base/SHASUMS256.txt" -OutFile $checksums
  $expectedLine = Get-Content -LiteralPath $checksums | Where-Object { $_ -match "\s+$([Regex]::Escape($archiveName))$" } | Select-Object -First 1
  if (-not $expectedLine) { throw 'Could not verify the downloaded Node.js archive.' }
  $expected = ($expectedLine -split '\s+')[0].ToUpperInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $archive).Hash.ToUpperInvariant()
  if ($expected -ne $actual) { throw 'Node.js archive checksum verification failed.' }

  $extractRoot = Join-Path $BuildCache "node-v$NodeVersion-win-x64"
  if (Test-Path $extractRoot) { Remove-Item -Recurse -Force $extractRoot }
  Expand-Archive -LiteralPath $archive -DestinationPath $BuildCache -Force
  $nodeExe = Join-Path $extractRoot 'node.exe'
  $npmCmd = Join-Path $extractRoot 'npm.cmd'
  if (-not (Test-Path $nodeExe) -or -not (Test-Path $npmCmd)) { throw 'Downloaded Node.js runtime is incomplete.' }
  return @{ Node = $nodeExe; Npm = $npmCmd }
}

function Install-FromSource {
  $toolchain = Get-Node22
  $oldPath = $env:PATH
  try {
    $env:PATH = "$(Split-Path $toolchain.Node -Parent);$oldPath"
    Write-Step 'Installing deterministic application dependencies'
    & $toolchain.Npm ci --prefix $Root
    if ($LASTEXITCODE -ne 0) { throw 'Root npm ci failed.' }
    & $toolchain.Npm ci --prefix (Join-Path $Root 'desktop')
    if ($LASTEXITCODE -ne 0) { throw 'Desktop npm ci failed.' }

    Write-Step 'Running security/tests and building RheomIQ'
    & $toolchain.Npm run check --prefix $Root
    if ($LASTEXITCODE -ne 0) { throw 'RheomIQ validation failed.' }
    & $toolchain.Npm run check --prefix (Join-Path $Root 'desktop')
    if ($LASTEXITCODE -ne 0) { throw 'Desktop validation failed.' }

    Write-Step 'Creating the Windows installer'
    & $toolchain.Npm run build --prefix $Root
    if ($LASTEXITCODE -ne 0) { throw 'Frontend build failed.' }
    & $toolchain.Npm run dist --prefix (Join-Path $Root 'desktop')
    if ($LASTEXITCODE -ne 0) { throw 'Windows installer build failed.' }

    $installer = Get-ChildItem -LiteralPath (Join-Path $Root 'release\desktop') -Filter 'RheomIQ-Setup-*-x64.exe' |
      Sort-Object LastWriteTimeUtc -Descending | Select-Object -First 1
    if (-not $installer) { throw 'RheomIQ installer was not produced.' }
    return $installer.FullName
  } finally {
    $env:PATH = $oldPath
  }
}

function Install-LatestRelease {
  Write-Step 'Downloading the latest published RheomIQ desktop release'
  New-Item -ItemType Directory -Force -Path $TempDir | Out-Null
  $headers = @{ 'Accept' = 'application/vnd.github+json'; 'X-GitHub-Api-Version' = '2022-11-28'; 'User-Agent' = 'RheomIQ-Windows-Installer' }
  $releases = Invoke-RestMethod -Headers $headers -Uri "https://api.github.com/repos/$RepoOwner/$RepoName/releases?per_page=30"
  $release = $releases | Where-Object { -not $_.draft -and -not $_.prerelease -and $_.tag_name -like 'desktop-v*' } | Select-Object -First 1
  if (-not $release) { throw 'No published RheomIQ desktop release is available yet.' }
  $asset = $release.assets | Where-Object { $_.name -like 'RheomIQ-Setup-*-x64.exe' } | Select-Object -First 1
  if (-not $asset) { throw 'The latest desktop release does not contain a RheomIQ x64 Windows installer.' }
  $checksumAsset = $release.assets | Where-Object { $_.name -eq "$($asset.name).sha256" } | Select-Object -First 1
  if (-not $checksumAsset) { throw 'The desktop release is missing its SHA-256 checksum asset.' }

  $installer = Join-Path $TempDir $asset.name
  $checksum = "$installer.sha256"
  Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $asset.browser_download_url -OutFile $installer
  Invoke-WebRequest -UseBasicParsing -Headers $headers -Uri $checksumAsset.browser_download_url -OutFile $checksum
  $expected = ((Get-Content -LiteralPath $checksum -Raw).Trim() -split '\s+')[0].ToUpperInvariant()
  $actual = (Get-FileHash -Algorithm SHA256 -LiteralPath $installer).Hash.ToUpperInvariant()
  if ($expected -ne $actual) { throw 'RheomIQ installer checksum verification failed.' }
  return $installer
}

if ($env:OS -ne 'Windows_NT') { throw 'This installer must run on Windows.' }
if ([Environment]::Is64BitOperatingSystem -ne $true) { throw 'RheomIQ desktop currently requires 64-bit Windows.' }

$dotEnv = Read-DotEnv $EnvFile
$supabaseUrl = Get-ConfiguredValue $dotEnv 'SUPABASE_URL'
$publishableKey = Get-ConfiguredValue $dotEnv 'SUPABASE_PUBLISHABLE_KEY'
if (-not $supabaseUrl) { $supabaseUrl = Read-Host 'SUPABASE_URL' }
if (-not $publishableKey) { $publishableKey = Read-Host 'SUPABASE_PUBLISHABLE_KEY' }
Assert-PublicConfig $supabaseUrl $publishableKey

$cardVaultKey = Get-ConfiguredValue $dotEnv 'CARD_VAULT_KEY'
if (-not $cardVaultKey) {
  Write-Host "`nOptional: enter CARD_VAULT_KEY to enable PAN/expiry reveal/save in desktop. Press Enter to skip." -ForegroundColor Yellow
  $cardVaultKey = ConvertFrom-SecureStringPlain (Read-Host 'CARD_VAULT_KEY' -AsSecureString)
}
Assert-CardVaultKey $cardVaultKey

$versionRaw = Get-ConfiguredValue $dotEnv 'CARD_VAULT_KEY_VERSION'
$cardVaultKeyVersion = 1
if ($versionRaw) {
  $parsed = 0
  if (-not [int]::TryParse($versionRaw, [ref]$parsed) -or $parsed -lt 1) { throw 'CARD_VAULT_KEY_VERSION must be an integer >= 1.' }
  $cardVaultKeyVersion = $parsed
}

if ($ValidateOnly) {
  try {
    Write-ProvisionPayload $supabaseUrl $publishableKey $cardVaultKey $cardVaultKeyVersion
    $bytes = [IO.File]::ReadAllBytes($PendingProvision)
    if ($bytes.Length -ge 3 -and $bytes[0] -eq 0xEF -and $bytes[1] -eq 0xBB -and $bytes[2] -eq 0xBF) { throw 'Provisioning JSON must not contain a UTF-8 BOM.' }
    Write-Host 'RheomIQ Windows installer validation passed.' -ForegroundColor Green
  } finally {
    $cardVaultKey = $null
    Remove-PendingProvision
  }
  return
}

$installerPath = $null
try {
  if ($Latest) { $installerPath = Install-LatestRelease }
  else { $installerPath = Install-FromSource }

  Write-Step 'Provisioning the local desktop runtime securely'
  Write-ProvisionPayload $supabaseUrl $publishableKey $cardVaultKey $cardVaultKeyVersion
  $cardVaultKey = $null

  Write-Step 'Installing RheomIQ and creating Desktop/Start Menu shortcuts'
  $process = Start-Process -FilePath $installerPath -ArgumentList '/S' -PassThru -Wait
  if ($process.ExitCode -ne 0) { throw "RheomIQ installer exited with code $($process.ExitCode)." }

  $installedExe = Join-Path $env:LOCALAPPDATA 'Programs\RheomIQ\RheomIQ.exe'
  if (-not (Test-Path $installedExe)) {
    $installedExe = Get-ChildItem -Path (Join-Path $env:LOCALAPPDATA 'Programs') -Filter 'RheomIQ.exe' -Recurse -ErrorAction SilentlyContinue |
      Select-Object -First 1 -ExpandProperty FullName
  }
  if ($installedExe -and (Test-Path $installedExe)) {
    Start-Process -FilePath $installedExe | Out-Null
  } else {
    Write-Warning 'Installation completed, but RheomIQ.exe was not found automatically. Use the RheomIQ Desktop/Start Menu shortcut.'
  }

  Write-Host "`nRheomIQ Windows installation completed." -ForegroundColor Green
  if ($Latest) { Write-Host 'Application code updated from the latest verified GitHub desktop release.' }
  else { Write-Host 'Application code installed from this checked-out source tree.' }
  Write-Host 'Finance data itself always synchronizes through the shared Supabase database; reinstalling is not needed for data changes.'
} catch {
  Remove-PendingProvision
  throw
} finally {
  $cardVaultKey = $null
}
