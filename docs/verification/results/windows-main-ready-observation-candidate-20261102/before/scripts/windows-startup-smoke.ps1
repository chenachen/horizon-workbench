$ErrorActionPreference = 'Stop'
if ($env:GITHUB_ACTIONS -ne 'true' -or $env:RUNNER_OS -ne 'Windows') {
  throw 'Run this one-launch smoke only on the owned Windows GitHub Actions runner.'
}
$repoRoot = Split-Path -Parent $PSScriptRoot
$output = Join-Path $repoRoot 'artifacts/windows'
New-Item -ItemType Directory -Force $output | Out-Null
$config = Get-Content (Join-Path $repoRoot 'apps/desktop/src-tauri/tauri.conf.json') -Raw | ConvertFrom-Json
$identifier = $config.identifier
$dataPaths = @(
  (Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)) $identifier),
  (Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::LocalApplicationData)) $identifier)
) | Select-Object -Unique
$runtimeKeys = @(
  'HKLM:\SOFTWARE\WOW6432Node\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}',
  'HKCU:\Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
)
$runtime = @(foreach ($key in $runtimeKeys) {
  $item = Get-ItemProperty -LiteralPath $key -Name pv -ErrorAction SilentlyContinue
  $version = $null
  if ($null -ne $item -and [version]::TryParse($item.pv, [ref]$version) -and $version -gt [version]'0.0.0.0') {
    @{ key = $key; version = $item.pv }
  }
})
$report = [ordered]@{
  scope = 'One compiled main EXE launch on an owned fresh Windows runner; no GUI interaction or performance acceptance.'
  commit = $env:GITHUB_SHA
  executable = Join-Path $repoRoot 'apps/desktop/src-tauri/target/release/horizon-desktop.exe'
  executable_sha256 = $null
  session_id = [Diagnostics.Process]::GetCurrentProcess().SessionId
  webview2 = $runtime
  data_paths = @($dataPaths)
  data_paths_existed_before = @($dataPaths | Where-Object { Test-Path -LiteralPath $_ })
  data_retention = 'Only directories absent before this launch are owned; leave them to ephemeral runner disposal. No directory/registry deletion.'
  status = 'not_run'
}
function Write-Report {
  $report | ConvertTo-Json -Depth 8 | Set-Content -Encoding utf8 (Join-Path $output 'startup-smoke.json')
}
if ($report.data_paths_existed_before.Count -gt 0) {
  $report.reason = 'Horizon identifier directory already exists; ownership not established.'
  Write-Report
  return
}
if ($runtime.Count -eq 0 -or $report.session_id -eq 0) {
  $report.reason = 'No detected Evergreen WebView2 runtime or no interactive runner session; main-window check remains unverified.'
  Write-Report
  return
}
$report.executable_sha256 = (Get-FileHash -LiteralPath $report.executable -Algorithm SHA256).Hash.ToLowerInvariant()
$launched = $null
$failed = $false
try {
  $launched = Start-Process -FilePath $report.executable -WorkingDirectory (Split-Path -Parent $report.executable) -PassThru `
    -RedirectStandardOutput (Join-Path $output 'app-stdout.log') -RedirectStandardError (Join-Path $output 'app-stderr.log')
  $launchPid = $launched.Id
  $report.pid = $launchPid
  $launchStart = $launched.StartTime.ToUniversalTime()
  $report.start_time_utc = $launchStart.ToString('O')
  Start-Sleep -Seconds 5
  $launched.Refresh()
  $report.observed_utc = [DateTime]::UtcNow.ToString('O')
  $report.alive_after_5s = -not $launched.HasExited
  if ($launched.HasExited) {
    $report.exit_code = $launched.ExitCode
    throw 'Horizon exited before the 5-second observation.'
  }
  $report.window_handle = $launched.MainWindowHandle.ToInt64().ToString('X')
  $report.window_title = $launched.MainWindowTitle
  $report.os_window_exists = $launched.MainWindowHandle -ne [IntPtr]::Zero
  $report.frontend_interactive = 'not_evaluated'
  $report.window_responding = if ($launched.MainWindowHandle -ne [IntPtr]::Zero) { $launched.Responding } else { $null }
  $report.status = 'process_alive_after_5s'
} catch {
  $failed = $true
  $report.status = 'failed'
  $report.error = $_.Exception.Message
} finally {
  if ($null -ne $launched -and -not $launched.HasExited) {
    try {
      $current = [Diagnostics.Process]::GetProcessById($launchPid)
      if ($current.StartTime.ToUniversalTime().Ticks -ne $launchStart.Ticks) {
        throw 'PID start identity changed; refusing to stop a different process.'
      }
      $current.Kill($true)
      if (-not $current.WaitForExit(5000)) { throw 'Owned main process did not exit after subtree cleanup.' }
      $report.cleanup = 'Stopped only the exact spawned PID/start identity and its descendants via Process.Kill(true).'
    } catch {
      $failed = $true
      $report.cleanup_error = $_.Exception.Message
    }
  }
  $report.data_paths_created = @($dataPaths | Where-Object { Test-Path -LiteralPath $_ })
  Write-Report
}
if ($failed) { throw 'Windows startup smoke failed; see startup-smoke.json and raw app logs.' }
