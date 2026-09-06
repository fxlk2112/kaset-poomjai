$ErrorActionPreference = 'Stop'
$taskName = 'SUCHA-AgTech-OwnerWeb-WeatherPublisher'
if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) {
    Disable-ScheduledTask -TaskName $taskName | Out-Null
    Stop-ScheduledTask -TaskName $taskName
}
Write-Output 'OWNER_WEATHER_TASK_DISABLED; files, logs and existing collector retained'
