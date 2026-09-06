[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ProjectRoot)
$ErrorActionPreference = 'Stop'
try {
    $root = (Resolve-Path -LiteralPath $ProjectRoot).Path
    $setup = Get-Content -Raw -LiteralPath (Join-Path $root 'tools/pi5/SETUP-PI5-SSH-KEY.ps1')
    $monitorPiHost = [regex]::Match($setup, "\u0024piHost\s*=\s*'([^']+)'").Groups[1].Value
    $monitorPiUser = [regex]::Match($setup, "\u0024defaultPiUser\s*=\s*'([^']+)'").Groups[1].Value
    if (-not $monitorPiHost -or $monitorPiUser -notmatch '^[a-z_][a-z0-9_-]*$') { throw 'SSH target missing' }
    $monitorKey = Join-Path $env:USERPROFILE '.ssh/sucha_to_feng_ed25519'
    $snapshotPath = Join-Path $root 'integrations/farmultimate-sensor-phase1/data/weather-models.json'
    $snapshot = Get-Content -Raw -LiteralPath $snapshotPath
    $parsed = $snapshot | ConvertFrom-Json
    if ($parsed.forecast_only -ne $true -or $parsed.output_control_allowed -ne $false -or $parsed.station_truth_available -ne $false) { throw 'Unsafe forecast' }
    $OutputEncoding = [Text.UTF8Encoding]::new($false)
    $result = $snapshot | & ssh.exe -i $monitorKey -o BatchMode=yes -o ConnectTimeout=10 -o StrictHostKeyChecking=yes "$monitorPiUser@$monitorPiHost" 'sudo -n python3 /opt/sucha-owner-monitor/publisher.py --weather-stdin' 2>$null
    if ($LASTEXITCODE -ne 0) { throw 'Publisher failed' }
    $receipt = ($result -join "`n") | ConvertFrom-Json
    if ($receipt.result -ne 'PASS') { throw 'Publisher rejected snapshot' }
    $safeReceipt = [ordered]@{checked_at=[DateTimeOffset]::Now.ToString('o');result='PASS';kind='weather';stored=[bool]$receipt.stored;observed_at=([DateTimeOffset]$receipt.observed_at).ToUniversalTime().ToString('o');output_control_allowed=$false}
    $logRoot = Join-Path $root 'artifacts/owner-monitor'
    New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
    $safeReceipt | ConvertTo-Json -Compress | Add-Content -LiteralPath (Join-Path $logRoot 'weather-publisher.jsonl') -Encoding UTF8
    $safeReceipt | ConvertTo-Json -Compress
} catch {
    if ($root) {
        try {
            $logRoot = Join-Path $root 'artifacts/owner-monitor'
            New-Item -ItemType Directory -Force -Path $logRoot | Out-Null
            [ordered]@{checked_at=[DateTimeOffset]::Now.ToString('o');result='FAILED';kind='weather';output_control_allowed=$false} | ConvertTo-Json -Compress | Add-Content -LiteralPath (Join-Path $logRoot 'weather-publisher.jsonl') -Encoding UTF8
        } catch { }
    }
    Write-Output '{"result":"FAILED","kind":"weather","output_control_allowed":false}'
    exit 1
}
