param(
  [Parameter(Mandatory = $true)][long]$WindowHandle,
  [Parameter(Mandatory = $true)][int]$ExpectedPid,
  [Parameter(Mandatory = $true)][long]$ExpectedStartUtcTicks,
  [Parameter(Mandatory = $true)][string]$ButtonName,
  [Parameter(Mandatory = $true)][string]$OutputPath
)
$ErrorActionPreference = 'Stop'
$observation = [ordered]@{
  scope = 'One read-only UIA query in the owned main window; no Invoke, focus, input or interaction.'
  started_utc = [DateTime]::UtcNow.ToString('O')
  status = 'not_observed'
  expected_pid = $ExpectedPid
  expected_start_utc_ticks = $ExpectedStartUtcTicks
  window_handle = $WindowHandle.ToString('X')
  target_name = $ButtonName
}
try {
  $target = [Diagnostics.Process]::GetProcessById($ExpectedPid)
  try {
    if ($target.HasExited -or $target.StartTime.ToUniversalTime().Ticks -ne $ExpectedStartUtcTicks) {
      throw 'Owned main process identity is no longer live.'
    }
  } finally { $target.Dispose() }
  Add-Type -AssemblyName UIAutomationClient, UIAutomationTypes
  $root = [System.Windows.Automation.AutomationElement]::FromHandle([IntPtr]$WindowHandle)
  if ($root.Current.ProcessId -ne $ExpectedPid) { throw 'Window handle is not owned by the expected main process.' }
  $condition = [System.Windows.Automation.AndCondition]::new(
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::NameProperty, $ButtonName),
    [System.Windows.Automation.PropertyCondition]::new([System.Windows.Automation.AutomationElement]::ControlTypeProperty, [System.Windows.Automation.ControlType]::Button)
  )
  $button = $root.FindFirst([System.Windows.Automation.TreeScope]::Descendants, $condition)
  if ($null -eq $button) {
    $observation.status = 'button_not_observed'
  } else {
    $info = $button.Current
    $observation.status = 'button_observed'
    $observation.name = $info.Name
    $observation.control_type = $info.ControlType.ProgrammaticName
    $observation.is_enabled = $info.IsEnabled
    $observation.is_offscreen = $info.IsOffscreen
    $observation.element_process_id = $info.ProcessId
    $observation.bounds = @{ x = $info.BoundingRectangle.X; y = $info.BoundingRectangle.Y; width = $info.BoundingRectangle.Width; height = $info.BoundingRectangle.Height }
    $observation.enabled_visible_button_observed = $info.IsEnabled -and -not $info.IsOffscreen
  }
} catch {
  $observation.status = 'observation_error'
  $observation.error = $_.Exception.Message
} finally {
  $observation.observed_utc = [DateTime]::UtcNow.ToString('O')
  $observation | ConvertTo-Json -Depth 6 | Set-Content -LiteralPath $OutputPath -Encoding utf8
}
