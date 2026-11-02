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
function Observe-WindowScreenshot {
  param([int]$ProcessId, [DateTime]$ProcessStart, [string]$WindowHex, [string]$PngPath)
  $capture = [ordered]@{
    scope = 'One screen-pixel copy of the owned window rectangle; occluding windows may appear. No focus, activation or input.'
    status = 'not_captured'
    expected_pid = $ProcessId
    expected_start_utc_ticks = $ProcessStart.Ticks
    window_handle = $WindowHex
    started_utc = [DateTime]::UtcNow.ToString('O')
  }
  $bitmap = $null
  $graphics = $null
  $previousDpi = [IntPtr]::Zero
  try {
    $current = [Diagnostics.Process]::GetProcessById($ProcessId)
    try {
      if ($current.HasExited -or $current.StartTime.ToUniversalTime().Ticks -ne $ProcessStart.Ticks) { throw 'Owned main identity is no longer live.' }
    } finally { $current.Dispose() }
    Add-Type -AssemblyName System.Drawing
    Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
public static class HorizonWindowCaptureNative {
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left, Top, Right, Bottom; }
  [DllImport("user32.dll", SetLastError=true)] public static extern uint GetWindowThreadProcessId(IntPtr window, out uint processId);
  [DllImport("user32.dll", SetLastError=true)] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool GetWindowRect(IntPtr window, out RECT rectangle);
  [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsWindowVisible(IntPtr window);
  [DllImport("user32.dll")] [return: MarshalAs(UnmanagedType.Bool)] public static extern bool IsIconic(IntPtr window);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern int GetSystemMetrics(int index);
  [DllImport("user32.dll", SetLastError=true)] public static extern IntPtr SetThreadDpiAwarenessContext(IntPtr context);
}
'@
    $previousDpi = [HorizonWindowCaptureNative]::SetThreadDpiAwarenessContext([IntPtr]::new(-4))
    if ($previousDpi -eq [IntPtr]::Zero) { throw 'Observer physical-pixel DPI context is unavailable.' }
    $window = [IntPtr]::new([Convert]::ToInt64($WindowHex, 16))
    [uint32]$owner = 0
    $ownerThread = [HorizonWindowCaptureNative]::GetWindowThreadProcessId($window, [ref]$owner)
    if ($ownerThread -eq 0 -or $owner -ne $ProcessId) { throw 'Window handle is not owned by the expected main process.' }
    $capture.is_visible = [HorizonWindowCaptureNative]::IsWindowVisible($window)
    $capture.is_minimized = [HorizonWindowCaptureNative]::IsIconic($window)
    if (-not $capture.is_visible -or $capture.is_minimized) { throw 'Owned window is hidden or minimized; no screen copy taken.' }
    $rectangle = [HorizonWindowCaptureNative+RECT]::new()
    if (-not [HorizonWindowCaptureNative]::GetWindowRect($window, [ref]$rectangle)) { throw [ComponentModel.Win32Exception]::new([Runtime.InteropServices.Marshal]::GetLastWin32Error()) }
    $bounds = [Drawing.Rectangle]::FromLTRB($rectangle.Left, $rectangle.Top, $rectangle.Right, $rectangle.Bottom)
    $desktop = [Drawing.Rectangle]::new([HorizonWindowCaptureNative]::GetSystemMetrics(76), [HorizonWindowCaptureNative]::GetSystemMetrics(77), [HorizonWindowCaptureNative]::GetSystemMetrics(78), [HorizonWindowCaptureNative]::GetSystemMetrics(79))
    $visible = [Drawing.Rectangle]::Intersect($bounds, $desktop)
    if ($visible.Width -le 0 -or $visible.Height -le 0) { throw 'No visible window rectangle on the current desktop surface.' }
    $capture.coordinate_space = 'Physical screen pixels; GetWindowRect includes outer frame/resize borders.'
    $capture.window_rectangle = @{ x = $bounds.X; y = $bounds.Y; width = $bounds.Width; height = $bounds.Height }
    $capture.copied_rectangle = @{ x = $visible.X; y = $visible.Y; width = $visible.Width; height = $visible.Height }
    $capture.clipped_to_virtual_screen = -not $bounds.Equals($visible)
    $foreground = [HorizonWindowCaptureNative]::GetForegroundWindow()
    $capture.foreground_window_handle = $foreground.ToInt64().ToString('X')
    $capture.target_is_foreground = $foreground -eq $window
    $bitmap = [Drawing.Bitmap]::new($visible.Width, $visible.Height)
    $graphics = [Drawing.Graphics]::FromImage($bitmap)
    $graphics.CopyFromScreen($visible.X, $visible.Y, 0, 0, $visible.Size, [Drawing.CopyPixelOperation]::SourceCopy)
    $capture.copied_utc = [DateTime]::UtcNow.ToString('O')
    $bitmap.Save($PngPath, [Drawing.Imaging.ImageFormat]::Png)
    $capture.status = 'captured'
    $capture.artifact = [IO.Path]::GetFileName($PngPath)
    $capture.bytes = (Get-Item -LiteralPath $PngPath).Length
    $capture.sha256 = (Get-FileHash -LiteralPath $PngPath -Algorithm SHA256).Hash.ToLowerInvariant()
  } catch {
    $capture.status = 'capture_unavailable'
    $capture.error = $_.Exception.Message
  } finally {
    if ($null -ne $graphics) { $graphics.Dispose() }
    if ($null -ne $bitmap) { $bitmap.Dispose() }
    if ($previousDpi -ne [IntPtr]::Zero) { $null = [HorizonWindowCaptureNative]::SetThreadDpiAwarenessContext($previousDpi) }
    $capture.observed_utc = [DateTime]::UtcNow.ToString('O')
  }
  return $capture
}
function Observe-HostReady {
  param([int]$ProcessId, [DateTime]$ProcessStart, [string]$RoamingPath)
  $registryPath = Join-Path $RoamingPath 'registry.json'
  $extensionsPath = Join-Path $RoamingPath 'extensions/registry.json'
  $observation = [ordered]@{
    scope = 'Read-only observation of the two files written by fresh production setup; not an interaction or performance check.'
    status = 'not_observed_by_30s'
    roaming_path = $RoamingPath
    required_files = @($registryPath, $extensionsPath)
    deadline_process_age_seconds = 30
    poll_interval_ms = 250
    started_utc = [DateTime]::UtcNow.ToString('O')
  }
  $remaining = [Math]::Max(0, 30000 - ([DateTime]::UtcNow - $ProcessStart).TotalMilliseconds)
  $timer = [Diagnostics.Stopwatch]::StartNew()
  try {
    while ($timer.Elapsed.TotalMilliseconds -le $remaining) {
      $current = [Diagnostics.Process]::GetProcessById($ProcessId)
      try {
        if ($current.HasExited -or $current.StartTime.ToUniversalTime().Ticks -ne $ProcessStart.Ticks) {
          $observation.status = 'owned_process_not_live'
          break
        }
      } finally { $current.Dispose() }
      $observation.host_file_exists = Test-Path -LiteralPath $registryPath -PathType Leaf
      $observation.extensions_file_exists = Test-Path -LiteralPath $extensionsPath -PathType Leaf
      if ($observation.host_file_exists -and $observation.extensions_file_exists) {
        $observation.first_files_observed_utc = [DateTime]::UtcNow.ToString('O')
        $observation.first_files_observed_process_age_ms = ([DateTime]::UtcNow - $ProcessStart).TotalMilliseconds
        $registry = Get-Content -LiteralPath $registryPath -Raw -Encoding utf8 | ConvertFrom-Json
        $extensions = Get-Content -LiteralPath $extensionsPath -Raw -Encoding utf8 | ConvertFrom-Json
        $observation.host_schema_version = $registry.schemaVersion
        $observation.extensions_schema_version = $extensions.schemaVersion
        $observation.host_registry_valid = $registry.schemaVersion -eq 1 -and $registry.defaultWorkspaceId -is [string] -and @($registry.workspaces | Where-Object { $_.id -eq $registry.defaultWorkspaceId }).Count -gt 0
        $observation.extensions_registry_valid = $extensions.schemaVersion -eq 1 -and $extensions.records -is [pscustomobject]
        $observation.status = if ($observation.host_registry_valid -and $observation.extensions_registry_valid) { 'required_setup_files_observed' } else { 'files_observed_schema_unexpected' }
        break
      }
      $waitMs = [Math]::Min(250, $remaining - $timer.Elapsed.TotalMilliseconds)
      if ($waitMs -le 0) { break }
      Start-Sleep -Milliseconds ([int][Math]::Ceiling($waitMs))
    }
  } catch {
    $observation.status = 'observation_error'
    $observation.error = $_.Exception.Message
  }
  $observation.observed_utc = [DateTime]::UtcNow.ToString('O')
  return $observation
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
  try {
    $roamingPath = Join-Path ([Environment]::GetFolderPath([Environment+SpecialFolder]::ApplicationData)) $identifier
    $report.host_readiness = Observe-HostReady -ProcessId $launchPid -ProcessStart $launchStart -RoamingPath $roamingPath
  } catch { $report.host_readiness = @{ status = 'observation_error'; error = $_.Exception.Message } }
  $uiaProbe = $null
  $uiaTimer = [Diagnostics.Stopwatch]::StartNew()
  try {
    $launched.Refresh()
    if ($launched.HasExited -or $launched.MainWindowHandle -eq [IntPtr]::Zero) {
      $report.frontend_readiness = @{ status = 'owned_window_not_observed'; observed_utc = [DateTime]::UtcNow.ToString('O') }
    } else {
      $uiaOutput = Join-Path $output 'frontend-readiness.json'
      $helper = Join-Path $PSScriptRoot 'windows-uia-ready.ps1'
      $arguments = '-NoProfile -NonInteractive -Mta -File "{0}" -WindowHandle {1} -ExpectedPid {2} -ExpectedStartUtcTicks {3} -ButtonName "打开本地项目" -OutputPath "{4}"' -f $helper, $launched.MainWindowHandle.ToInt64(), $launchPid, $launchStart.Ticks, $uiaOutput
      $uiaProbe = Start-Process -FilePath (Join-Path $env:SystemRoot 'System32/WindowsPowerShell/v1.0/powershell.exe') -ArgumentList $arguments -WindowStyle Hidden -PassThru `
        -RedirectStandardOutput (Join-Path $output 'uia-stdout.log') -RedirectStandardError (Join-Path $output 'uia-stderr.log')
      $uiaStart = $uiaProbe.StartTime.ToUniversalTime()
      if (-not $uiaProbe.WaitForExit([Math]::Max(0, 3000 - [int]$uiaTimer.ElapsedMilliseconds))) {
        $report.frontend_readiness = @{ status = 'helper_timeout'; timeout_ms = 3000 }
      } elseif (Test-Path -LiteralPath $uiaOutput -PathType Leaf) {
        $report.frontend_readiness = Get-Content -LiteralPath $uiaOutput -Raw -Encoding utf8 | ConvertFrom-Json -AsHashtable
        $report.frontend_readiness.helper_exit_code = $uiaProbe.ExitCode
      } else {
        $report.frontend_readiness = @{ status = 'helper_report_not_observed'; helper_exit_code = $uiaProbe.ExitCode }
      }
    }
  } catch {
    $report.frontend_readiness = @{ status = 'observation_error'; error = $_.Exception.Message }
  } finally {
    if ($null -ne $uiaProbe -and -not $uiaProbe.HasExited) {
      try {
        $ownedProbe = [Diagnostics.Process]::GetProcessById($uiaProbe.Id)
        if ($ownedProbe.StartTime.ToUniversalTime().Ticks -ne $uiaStart.Ticks) { throw 'UIA helper identity changed; refusing cleanup.' }
        $ownedProbe.Kill()
        if (-not $ownedProbe.WaitForExit(1000)) { throw 'Owned UIA helper cleanup unconfirmed.' }
      } catch { $report.frontend_readiness.helper_cleanup_error = $_.Exception.Message }
    }
    $report.frontend_readiness.observer_elapsed_ms = $uiaTimer.ElapsedMilliseconds
  }
  try {
    $report.window_screenshot = Observe-WindowScreenshot -ProcessId $launchPid -ProcessStart $launchStart -WindowHex $report.window_handle -PngPath (Join-Path $output 'main-window.png')
  } catch { $report.window_screenshot = @{ status = 'capture_unavailable'; error = $_.Exception.Message } }
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
