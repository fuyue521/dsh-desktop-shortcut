// DeepSeek Harness plugin: dsh-desktop-shortcut
//
// This bundle adds a loader row to the profile. On boot, the plugin creates
// (or refreshes) a Windows desktop shortcut that runs `dsh web`.
//
// It is intentionally small and dependency-free: it only uses Node built-ins
// and spawns PowerShell with an encoded command, so no quoting can break.

import { execFile } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { isAbsolute, join, dirname } from "node:path";
import { homedir } from "node:os";
import { fileURLToPath } from "node:url";

export const name = "desktop-shortcut";

const pkgRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const DEFAULT_ICON = join(pkgRoot, "assets", "DeepSeek Harness.ico");

export function psQuote(value) {
  return "'" + String(value).replace(/'/g, "''") + "'";
}

function resolveIcon(config) {
  if (config.icon) {
    return isAbsolute(config.icon) ? config.icon : join(pkgRoot, config.icon);
  }
  return DEFAULT_ICON;
}

function installIcon(iconSrc) {
  if (!existsSync(iconSrc)) {
    throw new Error(`icon not found: ${iconSrc}`);
  }
  const localAppData =
    process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  const destDir = join(localAppData, "DeepSeekHarness");
  const destIcon = join(destDir, "DeepSeek Harness.ico");
  mkdirSync(destDir, { recursive: true });
  copyFileSync(iconSrc, destIcon);
  return destIcon;
}

export function buildPowerShell({
  shortcutName,
  dshArgs,
  iconPath,
  workingDirectory,
  launcherPath,
  webUrl,
  closeBrowserStopsService,
  browser,
  uiReadyTimeout,
  pluginReadyTimeout,
  logPath,
  probeTimeoutMs,
  probeIntervalMs,
  pluginCheckEnabled,
  pluginCheckIntervalMs,
  hiddenConsole,
  pluginCheckPath,
}) {
  const closeFlag = closeBrowserStopsService ? "$true" : "$false";
  const pluginCheckFlag = pluginCheckEnabled ? "$true" : "$false";
  const hiddenConsoleFlag = hiddenConsole ? "$true" : "$false";

  return `
$ErrorActionPreference = 'Stop'
$shortcutName = ${psQuote(shortcutName)}
$dshArgs = ${psQuote(dshArgs)}
$iconPath = ${psQuote(iconPath)}
$workingDirectory = ${psQuote(workingDirectory)}
$launcherPath = ${psQuote(launcherPath)}
$webUrl = ${psQuote(webUrl)}
$browser = ${psQuote(browser)}
$logPath = ${psQuote(logPath)}
$pluginCheckPath = ${psQuote(pluginCheckPath)}

$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop ($shortcutName + '.lnk')

# Locate the dsh CLI. Prefer the npm shim, fall back to any dsh on PATH.
$cmd = (Get-Command dsh.cmd -ErrorAction SilentlyContinue).Source
if (-not $cmd) { $cmd = (Get-Command dsh -ErrorAction SilentlyContinue).Source }
if (-not $cmd) {
  $candidate = Join-Path $env:APPDATA 'npm\\dsh.cmd'
  if (Test-Path -LiteralPath $candidate) { $cmd = $candidate }
}
if (-not $cmd) { throw 'dsh command not found on PATH' }

# Write a launcher that starts dsh web and auto-opens the browser once ready.
$launcherDir = Split-Path -Parent $launcherPath
if (-not (Test-Path -LiteralPath $launcherDir)) {
  New-Item -ItemType Directory -Force -Path $launcherDir | Out-Null
}

function ConvertTo-LauncherValue {
  param([string]$Value)
  return $Value.Replace("'", "''")
}

$template = @'
$ErrorActionPreference = 'Stop'
$dshCmd = '__DSH_CMD__'
$dshArgs = '__DSH_ARGS__'
$webUrl = '__WEB_URL__'
$closeOnBrowserExit = __CLOSE_ON_BROWSER_EXIT__
$browserPreference = '__BROWSER__'
$uiReadyTimeout = __UI_READY_TIMEOUT__
$pluginReadyTimeout = __PLUGIN_READY_TIMEOUT__
$logPath = '__LOG_PATH__'
$probeTimeoutMs = __PROBE_TIMEOUT_MS__
$probeIntervalMs = __PROBE_INTERVAL_MS__
$pluginCheckEnabled = __PLUGIN_CHECK_ENABLED__
$pluginCheckIntervalMs = __PLUGIN_CHECK_INTERVAL_MS__
$pluginCheckPath = '__PLUGIN_CHECK_PATH__'
$hiddenConsole = __HIDDEN_CONSOLE__

$scriptStart = Get-Date

function Write-Timing {
  param([string]$Stage)
  $elapsed = [Math]::Round(((Get-Date) - $scriptStart).TotalMilliseconds)
  $stamp = Get-Date -Format 'yyyy-MM-dd HH:mm:ss.fff'
  $line = "$stamp\`t$Stage\`t\${elapsed}ms"
  try {
    $dir = Split-Path -Parent $logPath
    if (-not (Test-Path -LiteralPath $dir)) {
      New-Item -ItemType Directory -Force -Path $dir | Out-Null
    }
    Add-Content -LiteralPath $logPath -Value $line -Encoding UTF8
  } catch {
    try { [Console]::Error.WriteLine("WARN: Write-Timing failed: $($_.Exception.Message)") } catch {}
  }
}

function Test-WebReady {
  param([string]$Url, [int]$TimeoutMs = $probeTimeoutMs)
  try {
    $req = [System.Net.HttpWebRequest]::Create($Url)
    $req.Method = 'GET'
    $req.Timeout = $TimeoutMs
    $req.ReadWriteTimeout = $TimeoutMs
    $req.AllowAutoRedirect = $false
    $resp = $req.GetResponse()
    $code = [int]$resp.StatusCode
    $resp.Close()
    return ($code -ge 200 -and $code -lt 500)
  } catch {
    return $false
  }
}

# Add a cache-busting query so the browser always fetches a fresh index page.
$openUrl = $webUrl + '?v=' + [DateTime]::Now.Ticks

# Use a fresh browser profile for every launch so stale browser state from a
# previous run can never be reused, even if old browser processes linger.
$browserProfileRoot = Join-Path $env:LOCALAPPDATA 'DeepSeekHarness\\browser-profiles'
New-Item -ItemType Directory -Force -Path $browserProfileRoot | Out-Null
$browserProfile = Join-Path $browserProfileRoot ('profile-' + [DateTime]::Now.Ticks)

# Kill stale Harness app-mode browser processes from previous runs.
function Stop-HarnessBrowser {
  param([string]$BaseUrl)
  Get-CimInstance Win32_Process -ErrorAction SilentlyContinue |
    Where-Object { $_.CommandLine -like "*--app=$BaseUrl*" } |
    ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
}

# Kill old browser processes first, then remove old profiles so locked files
# do not prevent cleanup.
Stop-HarnessBrowser $webUrl
Get-ChildItem $browserProfileRoot -Directory -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'profile-*' } |
  Remove-Item -Recurse -Force -ErrorAction SilentlyContinue

Write-Timing "launcher_start"

# If a Harness server is already running on this URL, reuse it; otherwise start a new one.
$dshProc = $null
$browserProc = $null
$reachedStableState = $false
try {
  $alreadyRunning = $false
  if (Test-WebReady -Url $webUrl -TimeoutMs $probeTimeoutMs) {
    $alreadyRunning = $true
  }
  Write-Timing "probe_result: $(if ($alreadyRunning) { 'already_running' } else { 'not_running' })"

  if (-not $alreadyRunning) {
    # Start dsh web. Hidden mode uses cmd /c so no console window appears;
    # visible mode uses cmd /k so the user can close the console to stop the service.
    Write-Timing "dsh_spawn"
    if ($hiddenConsole) {
      $dshProc = Start-Process -FilePath $env:ComSpec -ArgumentList ('/c "' + $dshCmd + '" ' + $dshArgs) -WindowStyle Hidden -PassThru
    } else {
      $dshProc = Start-Process -FilePath $env:ComSpec -ArgumentList ('/k "' + $dshCmd + '" ' + $dshArgs) -PassThru
    }

    # Wait until the web UI is ready.
    $uiReady = $false
    $deadline = (Get-Date).AddSeconds($uiReadyTimeout)
    do {
      Start-Sleep -Milliseconds $probeIntervalMs
      if (Test-WebReady -Url $webUrl -TimeoutMs $probeTimeoutMs) { $uiReady = $true; break }
    } while ((Get-Date) -lt $deadline)
    if (-not $uiReady) { throw "dsh web did not become ready within $uiReadyTimeout seconds" }
    Write-Timing "ui_ready"

    # Wait until this plugin's own client bundle route is ready too, but keep
    # it short and non-blocking: proceed after the timeout either way.
    if ($pluginCheckEnabled) {
      $pluginCheckUrl = $webUrl + $pluginCheckPath
      $pluginDeadline = (Get-Date).AddSeconds($pluginReadyTimeout)
      do {
        Start-Sleep -Milliseconds $pluginCheckIntervalMs
        if (Test-WebReady -Url $pluginCheckUrl -TimeoutMs $probeTimeoutMs) { break }
      } while ((Get-Date) -lt $pluginDeadline)
      Write-Timing "plugin_ready"
    }
  }

  if ($closeOnBrowserExit) {
    # Launch a dedicated app-mode browser window. Closing that window stops the service.
    $browser = $null
    $pfX86 = [Environment]::GetFolderPath('ProgramFilesX86')
    $edgeCandidates = @(
      (Join-Path $pfX86 'Microsoft\\Edge\\Application\\msedge.exe'),
      (Join-Path $env:ProgramFiles 'Microsoft\\Edge\\Application\\msedge.exe'),
      (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\Application\\msedge.exe')
    )
    $chromeCandidates = @(
      (Join-Path $env:ProgramFiles 'Google\\Chrome\\Application\\chrome.exe'),
      (Join-Path $pfX86 'Google\\Chrome\\Application\\chrome.exe'),
      (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\Application\\chrome.exe')
    )
    if ($browserPreference -eq 'edge') { $candidates = $edgeCandidates }
    elseif ($browserPreference -eq 'chrome') { $candidates = $chromeCandidates }
    else { $candidates = $chromeCandidates + $edgeCandidates }
    foreach ($c in $candidates) {
      if (Test-Path -LiteralPath $c) { $browser = $c; break }
    }

    if ($browser -and $dshProc) {
      # We started this server: close the app window to stop it.
      $browserProc = Start-Process -FilePath $browser -ArgumentList @('--app=' + $openUrl, '--user-data-dir=' + $browserProfile, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-background-mode') -PassThru
      Write-Timing "browser_launch"
      $browserProc.WaitForExit()
      Write-Timing "browser_exit"
      Stop-HarnessBrowser $webUrl
      Remove-Item -LiteralPath $browserProfile -Recurse -Force -ErrorAction SilentlyContinue
      & taskkill.exe /PID $dshProc.Id /T /F 2>$null | Out-Null
      Write-Timing "dsh_stopped"
    } elseif ($browser) {
      # A server was already running; just open the app window and leave it running.
      $browserProc = Start-Process -FilePath $browser -ArgumentList @('--app=' + $openUrl, '--user-data-dir=' + $browserProfile, '--no-first-run', '--no-default-browser-check', '--disable-extensions', '--disable-background-networking', '--disable-sync', '--disable-background-mode') -PassThru
      Write-Timing "browser_launch"
    } else {
      Start-Process $openUrl
      Write-Timing "browser_launch(default)"
      Remove-Item -LiteralPath $browserProfile -Recurse -Force -ErrorAction SilentlyContinue
      if ($dshProc) {
        # No app-mode browser found; keep the service until the dsh console is closed.
        Wait-Process -Id $dshProc.Id
        Write-Timing "dsh_console_closed"
      }
    }
  } else {
    Start-Process $openUrl
    Write-Timing "browser_launch(default, no lifecycle)"
    Remove-Item -LiteralPath $browserProfile -Recurse -Force -ErrorAction SilentlyContinue
  }
  $reachedStableState = $true
} catch {
  Write-Timing "launcher_error: $($_.Exception.Message)"
  $errText = "DSH launcher error: $($_.Exception.Message)"
  Add-Type -AssemblyName System.Windows.Forms
  [System.Windows.Forms.MessageBox]::Show($errText, 'DeepSeek Harness') | Out-Null
  throw
} finally {
  if (-not $reachedStableState) {
    Stop-HarnessBrowser $webUrl
    if ($browserProfile) {
      Remove-Item -LiteralPath $browserProfile -Recurse -Force -ErrorAction SilentlyContinue
    }
    if ($browserProc -and -not $browserProc.HasExited) {
      Stop-Process -Id $browserProc.Id -Force -ErrorAction SilentlyContinue
    }
    if ($dshProc) {
      & taskkill.exe /PID $dshProc.Id /T /F 2>$null | Out-Null
    }
  }
  Write-Timing "launcher_exit"
}
'@
$launcher = $template.Replace('__DSH_CMD__', (ConvertTo-LauncherValue $cmd)).Replace('__DSH_ARGS__', (ConvertTo-LauncherValue $dshArgs)).Replace('__WEB_URL__', (ConvertTo-LauncherValue $webUrl)).Replace('__CLOSE_ON_BROWSER_EXIT__', '${closeFlag}').Replace('__BROWSER__', (ConvertTo-LauncherValue $browser)).Replace('__UI_READY_TIMEOUT__', '${uiReadyTimeout}').Replace('__PLUGIN_READY_TIMEOUT__', '${pluginReadyTimeout}').Replace('__LOG_PATH__', (ConvertTo-LauncherValue $logPath)).Replace('__PROBE_TIMEOUT_MS__', '${probeTimeoutMs}').Replace('__PROBE_INTERVAL_MS__', '${probeIntervalMs}').Replace('__PLUGIN_CHECK_ENABLED__', '${pluginCheckFlag}').Replace('__PLUGIN_CHECK_INTERVAL_MS__', '${pluginCheckIntervalMs}').Replace('__PLUGIN_CHECK_PATH__', (ConvertTo-LauncherValue $pluginCheckPath)).Replace('__HIDDEN_CONSOLE__', '${hiddenConsoleFlag}')
$launcherTmp = $launcherPath + '.tmp'
$utf8Bom = New-Object System.Text.UTF8Encoding($true)
[System.IO.File]::WriteAllText($launcherTmp, $launcher, $utf8Bom)
Move-Item -LiteralPath $launcherTmp -Destination $launcherPath -Force

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = 'powershell.exe'
$sc.Arguments = '-NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File "' + $launcherPath + '"'
$sc.WorkingDirectory = $workingDirectory
$sc.IconLocation = $iconPath + ',0'
$sc.Description = 'Launch DeepSeek Harness web UI (dsh ' + $dshArgs + ')'
$sc.WindowStyle = 7
$sc.Save()
Write-Output ('shortcut created: ' + $lnk)
`;
}

export function apply(ctx, config = {}) {
  if (process.platform !== "win32") {
    ctx.logger?.info?.("[desktop-shortcut] skipped: Windows only");
    return;
  }

  const shortcutName = config.shortcutName || "DeepSeek Harness";
  const dshArgs = config.dshArgs || "web";
  const workingDirectory = config.workingDirectory || homedir();
  const port = config.port || 3080;
  const webUrl = config.url || `http://127.0.0.1:${port}`;
  const closeBrowserStopsService =
    config.closeBrowserStopsService !== false &&
    config.closeBrowserStopsService !== "false";
  const browser = ["edge", "chrome"].includes(config.browser) ? config.browser : "auto";
  const timeout = Number(config.timeout) > 0 ? Number(config.timeout) : 30000;
  const uiReadyTimeout =
    Number(config.uiReadyTimeout) > 0 ? Number(config.uiReadyTimeout) : 15000;
  const pluginReadyTimeout =
    Number(config.pluginReadyTimeout) > 0 ? Number(config.pluginReadyTimeout) : 1000;
  const probeTimeoutMs =
    Number(config.probeTimeoutMs) > 0 ? Number(config.probeTimeoutMs) : 300;
  const probeIntervalMs =
    Number(config.probeIntervalMs) > 0 ? Number(config.probeIntervalMs) : 100;
  const pluginCheckEnabled =
    config.pluginCheckEnabled !== false &&
    config.pluginCheckEnabled !== "false";
  const pluginCheckIntervalMs =
    Number(config.pluginCheckIntervalMs) > 0 ? Number(config.pluginCheckIntervalMs) : 100;
  const pluginCheckPath =
    config.pluginCheckPath || "/plugins/dsh-desktop-shortcut/client.js";
  const hiddenConsole =
    config.hiddenConsole !== undefined
      ? config.hiddenConsole !== false && config.hiddenConsole !== "false"
      : closeBrowserStopsService;

  let iconPath;
  try {
    iconPath = installIcon(resolveIcon(config));
  } catch (error) {
    ctx.logger?.warn?.(
      `[desktop-shortcut] icon install failed, falling back to shell32: ${error.message}`,
    );
    iconPath = join(
      process.env.SystemRoot || "C:\\Windows",
      "System32",
      "shell32.dll",
    );
  }

  const localAppData =
    process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  const launcherPath = join(
    localAppData,
    "DeepSeekHarness",
    "start-dsh-web.ps1",
  );
  const logPath = join(
    localAppData,
    "DeepSeekHarness",
    "logs",
    "startup-timing.log",
  );

  const script = buildPowerShell({
    shortcutName,
    dshArgs,
    iconPath,
    workingDirectory,
    launcherPath,
    webUrl,
    closeBrowserStopsService,
    browser,
    uiReadyTimeout,
    pluginReadyTimeout,
    logPath,
    probeTimeoutMs,
    probeIntervalMs,
    pluginCheckEnabled,
    pluginCheckIntervalMs,
    hiddenConsole,
    pluginCheckPath,
  });
  const encoded = Buffer.from(script, "utf16le").toString("base64");

  execFile(
    "powershell.exe",
    [
      "-NoProfile",
      "-NonInteractive",
      "-ExecutionPolicy",
      "Bypass",
      "-EncodedCommand",
      encoded,
    ],
    { windowsHide: true, timeout },
    (error, stdout, stderr) => {
      if (error) {
        ctx.logger?.warn?.(
          `[desktop-shortcut] failed: ${error.message}${stderr ? `\n${stderr}` : ""}`,
        );
        return;
      }
      ctx.logger?.info?.(`[desktop-shortcut] ${String(stdout).trim()}`);
    },
  );
}
