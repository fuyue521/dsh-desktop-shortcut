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

function buildPowerShell({ shortcutName, dshArgs, iconPath, workingDirectory }) {
  return `
$ErrorActionPreference = 'Stop'
$shortcutName = ${psQuote(shortcutName)}
$dshArgs = ${psQuote(dshArgs)}
$iconPath = ${psQuote(iconPath)}
$workingDirectory = ${psQuote(workingDirectory)}

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

$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = $env:ComSpec
$sc.Arguments = '/c "' + $cmd + '" ' + $dshArgs
$sc.WorkingDirectory = $workingDirectory
$sc.IconLocation = $iconPath + ',0'
$sc.Description = 'Launch DeepSeek Harness web UI (dsh ' + $dshArgs + ')'
$sc.WindowStyle = 1
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

  let iconPath;
  try {
    iconPath = installIcon(resolveIcon(config));
  } catch (error) {
    ctx.logger?.warn?.(`[desktop-shortcut] icon install failed: ${error.message}`);
    return;
  }

  const script = buildPowerShell({
    shortcutName,
    dshArgs,
    iconPath,
    workingDirectory,
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
