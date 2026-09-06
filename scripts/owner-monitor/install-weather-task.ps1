[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$ProjectRoot)
$ErrorActionPreference = 'Stop'
$taskName = 'SUCHA-AgTech-OwnerWeb-WeatherPublisher'
$script = Join-Path $PSScriptRoot 'publish-weather.ps1'
$arguments = '-NoProfile -NonInteractive -WindowStyle Hidden -ExecutionPolicy Bypass -File "' + $script + '" -ProjectRoot "' + (Resolve-Path -LiteralPath $ProjectRoot).Path + '"'
$action = New-ScheduledTaskAction -Execute 'powershell.exe' -Argument $arguments
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 15)
$settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Minutes 2) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
$principal = New-ScheduledTaskPrincipal -UserId ([Security.Principal.WindowsIdentity]::GetCurrent().Name) -LogonType Interactive -RunLevel Limited
Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Settings $settings -Principal $principal -Description 'Forward existing sanitized forecast export to the owner website through the Pi publisher. DATA_ONLY SAFE_OFF.' -Force | Out-Null
Start-ScheduledTask -TaskName $taskName
Write-Output 'OWNER_WEATHER_TASK_INSTALLED'
