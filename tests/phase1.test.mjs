import test from "node:test";
import assert from "node:assert/strict";
import { buildPowerShell } from "../lib/index.js";

function render(options = {}) {
  const base = {
    shortcutName: "DeepSeek Harness",
    dshArgs: "web",
    iconPath: "C:\\icon.ico",
    workingDirectory: "C:\\Users\\me",
    launcherPath: "C:\\launcher.ps1",
    webUrl: "http://127.0.0.1:3080",
    closeBrowserStopsService: true,
    browser: "auto",
    uiReadyTimeout: 15000,
    pluginReadyTimeout: 1000,
    logPath: "C:\\logs\\startup-timing.log",
    probeTimeoutMs: 300,
    probeIntervalMs: 100,
    pluginCheckEnabled: true,
    pluginCheckIntervalMs: 100,
    hiddenConsole: true,
    pluginCheckPath: "/plugins/dsh-desktop-shortcut/client.js",
    ...options,
  };
  return buildPowerShell(base);
}

test("closeBrowserStopsService true injects $true", () => {
  const script = render({ closeBrowserStopsService: true });
  assert.match(script, /'__CLOSE_ON_BROWSER_EXIT__', '\$true'/);
});

test("closeBrowserStopsService false injects $false", () => {
  const script = render({ closeBrowserStopsService: false });
  assert.match(script, /'__CLOSE_ON_BROWSER_EXIT__', '\$false'/);
});

test("hiddenConsole true injects $true", () => {
  const script = render({ hiddenConsole: true });
  assert.match(script, /'__HIDDEN_CONSOLE__', '\$true'/);
});

test("hiddenConsole false injects $false", () => {
  const script = render({ hiddenConsole: false });
  assert.match(script, /'__HIDDEN_CONSOLE__', '\$false'/);
});

test("pluginCheckEnabled false injects $false", () => {
  const script = render({ pluginCheckEnabled: false });
  assert.match(script, /'__PLUGIN_CHECK_ENABLED__', '\$false'/);
});

test("pluginCheckPath is injected and present in template", () => {
  const script = render({ pluginCheckPath: "/plugins/dsh-desktop-shortcut/client.js" });
  assert.match(script, /__PLUGIN_CHECK_PATH__/);
  assert.match(script, /'\/plugins\/dsh-desktop-shortcut\/client\.js'/);
});

test("probe and timing values are injected", () => {
  const script = render({
    probeTimeoutMs: 300,
    probeIntervalMs: 100,
    pluginCheckIntervalMs: 100,
    logPath: "C:\\logs\\startup-timing.log",
  });
  assert.match(script, /'300'/);
  assert.match(script, /'100'/);
  assert.match(script, /startup-timing\.log/);
});
