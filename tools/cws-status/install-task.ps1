# Registers the Task Scheduler task \ScryfallToolkit\CwsStatus that runs cws_status.py
# every few hours, hidden (pythonw.exe), in the user's session, without admin rights.
# The task is created DISABLED unless -Enable is given. Re-running it replaces the task.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\cws-status\install-task.ps1            # create, disabled
#   powershell -NoProfile -ExecutionPolicy Bypass -File tools\cws-status\install-task.ps1 -Enable    # create and turn on
#   Enable-ScheduledTask  -TaskPath '\ScryfallToolkit\' -TaskName CwsStatus
#   Disable-ScheduledTask -TaskPath '\ScryfallToolkit\' -TaskName CwsStatus
#   Unregister-ScheduledTask -TaskPath '\ScryfallToolkit\' -TaskName CwsStatus -Confirm:$false
param(
  [int]$Hours = 2,
  [string]$Python = '',
  [switch]$Enable
)
$ErrorActionPreference = 'Stop'
$script = Join-Path $PSScriptRoot 'cws_status.py'
$repo = (Resolve-Path (Join-Path $PSScriptRoot '..\..')).Path
if (-not $Python) {
  $py = (Get-Command python.exe -ErrorAction Stop).Source
  $Python = Join-Path (Split-Path $py) 'pythonw.exe'
}
if (-not (Test-Path $Python)) { throw "Not found: $Python (pass -Python <path to pythonw.exe>)" }

$action = New-ScheduledTaskAction -Execute $Python -Argument "-I -X utf8 `"$script`"" -WorkingDirectory $repo
$trigger = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(2) -RepetitionInterval (New-TimeSpan -Hours $Hours)
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable `
  -ExecutionTimeLimit (New-TimeSpan -Minutes 5) -MultipleInstances IgnoreNew
$task = Register-ScheduledTask -TaskPath '\ScryfallToolkit\' -TaskName 'CwsStatus' -Action $action -Trigger $trigger `
  -Settings $settings -Description "Scryfall Toolkit: Chrome Web Store status -> Telegram ($script)" -Force
if ($Enable) {
  Write-Host "Task \ScryfallToolkit\CwsStatus created and ENABLED, every $Hours h."
} else {
  Disable-ScheduledTask -TaskPath '\ScryfallToolkit\' -TaskName 'CwsStatus' | Out-Null
  Write-Host "Task \ScryfallToolkit\CwsStatus created, DISABLED. Turn on: Enable-ScheduledTask -TaskPath '\ScryfallToolkit\' -TaskName CwsStatus"
}
