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

function psQuote(value) {
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

function buildPowerShell({
  shortcutName,
  dshArgs,
  iconPath,
  workingDirectory,
  launcherPath,
  webUrl,
  closeBrowserStopsService,
}) {
  const closeFlag = closeBrowserStopsService ? "$true" : "$false";

  return `
$ErrorActionPreference = 'Stop'
$shortcutName = ${psQuote(shortcutName)}
$dshArgs = ${psQuote(dshArgs)}
$iconPath = ${psQuote(iconPath)}
$workingDirectory = ${psQuote(workingDirectory)}
$launcherPath = ${psQuote(launcherPath)}
$webUrl = ${psQuote(webUrl)}

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

$template = @'
$ErrorActionPreference = 'Stop'
$dshCmd = '__DSH_CMD__'
$dshArgs = '__DSH_ARGS__'
$webUrl = '__WEB_URL__'
$closeOnBrowserExit = __CLOSE_ON_BROWSER_EXIT__

# If a Harness server is already running on this URL, reuse it; otherwise start a new one.
$alreadyRunning = $false
try {
  $probe = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 2
  if ($probe.StatusCode -ge 200 -and $probe.StatusCode -lt 500) { $alreadyRunning = $true }
} catch {}

$dshProc = $null
if (-not $alreadyRunning) {
  # Start dsh web in its own console window.
  $dshProc = Start-Process -FilePath $env:ComSpec -ArgumentList ('/k "' + $dshCmd + '" ' + $dshArgs) -WorkingDirectory $HOME -PassThru

  # Wait until the web UI is ready.
  $deadline = (Get-Date).AddSeconds(30)
  do {
    Start-Sleep -Milliseconds 500
    try {
      $r = Invoke-WebRequest -Uri $webUrl -UseBasicParsing -TimeoutSec 2
      if ($r.StatusCode -ge 200 -and $r.StatusCode -lt 500) { break }
    } catch {}
  } while ((Get-Date) -lt $deadline)

  # Wait until the client-plugin bundle route is ready too. This avoids opening
  # the browser before dsh can serve /plugins/* bundles (which caused
  # "Failed to load plugins / client-modules bundle script failed to load").
  $pluginCheckUrl = $webUrl + '/plugins/@deepseek-ai/dsh-session-log-export/client.js'
  $pluginDeadline = (Get-Date).AddSeconds(10)
  do {
    Start-Sleep -Milliseconds 300
    try {
      $pr = Invoke-WebRequest -Uri $pluginCheckUrl -UseBasicParsing -TimeoutSec 2
      if ($pr.StatusCode -ge 200 -and $pr.StatusCode -lt 500) { break }
    } catch {}
  } while ((Get-Date) -lt $pluginDeadline)
}

if ($closeOnBrowserExit) {
  # Launch a dedicated app-mode browser window. Closing that window stops the service.
  $browser = $null
  $pfX86 = [Environment]::GetFolderPath('ProgramFilesX86')
  $candidates = @(
    (Join-Path $pfX86 'Microsoft\\Edge\\Application\\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Microsoft\\Edge\\Application\\msedge.exe'),
    (Join-Path $env:LOCALAPPDATA 'Microsoft\\Edge\\Application\\msedge.exe'),
    (Join-Path $env:ProgramFiles 'Google\\Chrome\\Application\\chrome.exe'),
    (Join-Path $pfX86 'Google\\Chrome\\Application\\chrome.exe'),
    (Join-Path $env:LOCALAPPDATA 'Google\\Chrome\\Application\\chrome.exe')
  )
  foreach ($c in $candidates) {
    if (Test-Path -LiteralPath $c) { $browser = $c; break }
  }

  if ($browser -and $dshProc) {
    # We started this server: close the app window to stop it.
    $browserProc = Start-Process -FilePath $browser -ArgumentList @('--app=' + $webUrl) -PassThru
    $browserProc.WaitForExit()
    & taskkill.exe /PID $dshProc.Id /T /F | Out-Null
  } elseif ($browser) {
    # A server was already running; just open the app window and leave it running.
    Start-Process -FilePath $browser -ArgumentList @('--app=' + $webUrl)
  } else {
    Start-Process $webUrl
    if ($dshProc) {
      # No app-mode browser found; keep the service until the dsh console is closed.
      Wait-Process -Id $dshProc.Id
    }
  }
} else {
  Start-Process $webUrl
}
'@
$launcher = $template.Replace('__DSH_CMD__', $cmd).Replace('__DSH_ARGS__', $dshArgs).Replace('__WEB_URL__', $webUrl).Replace('__CLOSE_ON_BROWSER_EXIT__', '${closeFlag}')
[System.IO.File]::WriteAllText($launcherPath, $launcher, [System.Text.Encoding]::UTF8)

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
  const closeBrowserStopsService = config.closeBrowserStopsService !== false;

  let iconPath;
  try {
    iconPath = installIcon(resolveIcon(config));
  } catch (error) {
    ctx.logger?.warn?.(`[desktop-shortcut] icon install failed: ${error.message}`);
    return;
  }

  const localAppData =
    process.env.LOCALAPPDATA || join(homedir(), "AppData", "Local");
  const launcherPath = join(
    localAppData,
    "DeepSeekHarness",
    "start-dsh-web.ps1",
  );

  const script = buildPowerShell({
    shortcutName,
    dshArgs,
    iconPath,
    workingDirectory,
    launcherPath,
    webUrl,
    closeBrowserStopsService,
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
    { windowsHide: true, timeout: 30000 },
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
