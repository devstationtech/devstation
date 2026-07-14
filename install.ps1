# DevStation installer for Windows x86_64.
#
#   irm https://raw.githubusercontent.com/devstationtech/devstation/main/install.ps1 | iex
#
# Fully GitHub-native: the release manifest and the archive are pulled
# straight from the repo's GitHub Releases — no custom domain, no CDN.
# `releases/latest` resolves to the newest published release.
#
# The binary ships everything (engine, OpenTofu, provisioning templates,
# blueprint catalog) embedded inside the wrapper. The install is a
# single file: the binary. First run extracts the assets to
# %APPDATA%\devstation\runtime\<VERSION>\ automatically.
#
# Overrides:
#   $env:DEVSTATION_INSTALL_DIR  install dir (default %LOCALAPPDATA%\Programs\DevStation)
#   $env:DEVSTATION_BASE_URL     manifest source
#                                (default https://github.com/devstationtech/devstation/releases/latest/download)
$ErrorActionPreference = 'Stop'

$BaseUrl    = if ($env:DEVSTATION_BASE_URL)    { $env:DEVSTATION_BASE_URL }    else { 'https://github.com/devstationtech/devstation/releases/latest/download' }
$InstallDir = if ($env:DEVSTATION_INSTALL_DIR) { $env:DEVSTATION_INSTALL_DIR } else { Join-Path $env:LOCALAPPDATA 'Programs\DevStation' }
$LatestUrl  = "$($BaseUrl.TrimEnd('/'))/latest.json"

function Fail($msg) {
    Write-Error "devstation install: $msg"
    exit 1
}

if ($env:OS -ne 'Windows_NT') { Fail 'this installer is Windows-only; on Linux/macOS use install.sh' }

$arch = $env:PROCESSOR_ARCHITECTURE
if ($arch -ne 'AMD64' -and $arch -ne 'x86_64') { Fail "only windows-x64 is supported right now (got $arch)" }

$tmp = Join-Path $env:TEMP "devstation-install-$(Get-Random)"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

try {
    # 1) Manifest with the published asset URL + SHA.
    $manifestPath = Join-Path $tmp 'latest.json'
    Invoke-WebRequest -Uri $LatestUrl -OutFile $manifestPath -UseBasicParsing | Out-Null
    $manifest = Get-Content $manifestPath -Raw | ConvertFrom-Json
    $asset = $manifest.assets.'windows-x64'
    if (-not $asset) { Fail 'latest.json does not include a windows-x64 asset' }
    if (-not $asset.url) { Fail 'latest.json windows-x64 entry has no URL' }
    if (-not $asset.sha256) { Fail 'latest.json windows-x64 entry has no sha256' }

    # 2) Download + checksum.
    $zipPath = Join-Path $tmp 'devstation-windows-x64.zip'
    Write-Host "devstation install: downloading $($asset.url)"
    Invoke-WebRequest -Uri $asset.url -OutFile $zipPath -UseBasicParsing | Out-Null
    $actualSha = (Get-FileHash -Algorithm SHA256 $zipPath).Hash.ToLower()
    $expectedSha = $asset.sha256.ToLower()
    if ($actualSha -ne $expectedSha) {
        Fail "sha256 mismatch: expected $expectedSha, got $actualSha"
    }

    # 3) Extract — the archive holds just the binary and the notices.
    $extracted = Join-Path $tmp 'extracted'
    Expand-Archive -Path $zipPath -DestinationPath $extracted -Force
    if (-not (Test-Path (Join-Path $extracted 'devstation.exe'))) { Fail 'archive missing devstation.exe' }

    # 4) Install. Just the binary (and optional notices) — everything
    # else (tofu, templates, blueprints) lives inside the binary and is
    # extracted on first run by the wrapper.
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Copy-Item -Path (Join-Path $extracted 'devstation.exe') -Destination (Join-Path $InstallDir 'devstation.exe') -Force
    # Clear Mark-of-the-Web so SmartScreen doesn't block the first launch.
    Unblock-File -Path (Join-Path $InstallDir 'devstation.exe') -ErrorAction SilentlyContinue
    if (Test-Path (Join-Path $extracted 'THIRD-PARTY-NOTICES.md')) {
        Copy-Item -Path (Join-Path $extracted 'THIRD-PARTY-NOTICES.md') -Destination (Join-Path $InstallDir 'THIRD-PARTY-NOTICES.md') -Force
    }

    # 5) PATH: append to the USER-scoped PATH via the registry API.
    # Never `setx` here — it truncates at 1024 chars and `$env:PATH` is the
    # MERGED machine+user value, so `setx PATH "$env:PATH;..."` would copy
    # the machine PATH into the user PATH (duplication + breakage when the
    # machine PATH later changes).
    $userPath = [Environment]::GetEnvironmentVariable('PATH', 'User')
    Write-Host ""
    Write-Host "devstation install: installed at $InstallDir\devstation.exe"
    if (($userPath -split ';') -notcontains $InstallDir) {
        $newPath = if ([string]::IsNullOrEmpty($userPath)) { $InstallDir } else { "$userPath;$InstallDir" }
        [Environment]::SetEnvironmentVariable('PATH', $newPath, 'User')
        Write-Host ""
        Write-Host "devstation install: added $InstallDir to your user PATH."
        Write-Host "Open a new terminal so the change takes effect."
    }
    Write-Host ""
    Write-Host "Next: run 'devstation' — first launch extracts tofu + templates + blueprints to %APPDATA%\devstation\runtime\<version>\ automatically."
} finally {
    Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
}
