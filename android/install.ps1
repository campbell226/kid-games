# Builds Kid Games and puts it on a phone over wireless debugging.
#
#   ./install.ps1              the one phone that is connected
#   ./install.ps1 -Device X    a particular one, named as `adb devices` names it
#
# The phone has to have been paired with this PC once first - see README.md.

param([string]$Device)

$ErrorActionPreference = 'Stop'
$sdk = if ($env:ANDROID_HOME) { $env:ANDROID_HOME } else { Join-Path $env:LOCALAPPDATA 'Android\Sdk' }
$adb = Join-Path $sdk 'platform-tools\adb.exe'
if (-not $env:JAVA_HOME) { $env:JAVA_HOME = Join-Path $env:ProgramFiles 'Android\Android Studio\jbr' }

# Gradle finds the SDK through local.properties, which stays on this machine.
$props = Join-Path $PSScriptRoot 'local.properties'
if (-not (Test-Path $props)) {
    'sdk.dir=' + $sdk.Replace('\', '/').Replace(':', '\:') | Set-Content -Encoding ascii $props
}

function Get-Devices {
    & $adb devices | Select-String '^(\S+)\s+device$' | ForEach-Object { $_.Matches[0].Groups[1].Value }
}

& $adb start-server | Out-Null
if (-not (Get-Devices)) {
    # Wireless debugging picks a new port each time it is switched on, so
    # rather than remember one, ask the network where the phone is now.
    & $adb mdns services | Select-String '_adb-tls-connect\._tcp\.?\s+(\S+:\d+)' | ForEach-Object {
        & $adb connect $_.Matches[0].Groups[1].Value | Out-Host
    }
}

$found = @(Get-Devices)
if ($Device) {
    $target = $Device
} elseif ($found.Count -eq 1) {
    $target = $found[0]
} elseif ($found.Count -eq 0) {
    throw 'No phone found. Is Wireless debugging switched on, with the phone on the same Wi-Fi as this PC?'
} else {
    throw "More than one device connected. Choose one with -Device: $($found -join ', ')"
}

& (Join-Path $PSScriptRoot 'gradlew.bat') -p $PSScriptRoot ':app:assembleDebug'
if ($LASTEXITCODE) { throw 'The build failed.' }

$apk = Join-Path $PSScriptRoot 'app\build\outputs\apk\debug\app-debug.apk'
& $adb -s $target install -r $apk
if ($LASTEXITCODE) { throw 'The install failed.' }
& $adb -s $target shell am start -n com.jamescampbelliscool.kidgames/.MainActivity | Out-Null
Write-Host "Kid Games is on $target."
