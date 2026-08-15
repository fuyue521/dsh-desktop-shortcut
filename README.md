# dsh-desktop-shortcut

> **English** | [中文](README.zh-CN.md)

![DeepSeek Harness Icon](assets/DeepSeek%20Harness.png?raw=true)

## About

DeepSeek Harness is a composable AI agent runtime. Typing `dsh web` every time is fine, but a desktop shortcut is even better.

This plugin solves that:

- Every time `dsh web` starts, it automatically creates/refreshes a **DeepSeek Harness** shortcut on the Windows desktop
- Uses a DeepSeek-style multi-size `.ico` icon
- Lightweight: only Node built-ins and PowerShell, no third-party runtime dependencies
- Non-Windows platforms are skipped automatically

## Features

- Ensures the desktop shortcut exists every time `dsh web` starts
- Double-clicking the shortcut starts `dsh web` and automatically opens the browser when the web UI is ready
- Uses Edge/Chrome app-window mode by default: **closing the Harness window stops the service**
- Multi-size DeepSeek-style icon (256 / 128 / 64 / 48 / 32 / 16)
- Shortcut target: `cmd.exe /c "dsh.cmd" web`
- Windows only; other platforms are skipped
- No third-party runtime dependencies

## Install

Make sure [pnpm](https://pnpm.io/) is installed, then run inside your DeepSeek Harness environment:

### From GitHub

```bash
dsh plugin --profile web add github:fuyue521/dsh-desktop-shortcut
```

### From a local checkout

```bash
cd dsh-desktop-shortcut
dsh plugin --profile web add .
```

`dsh plugin` automatically detects the `dsh.bundle` declaration and adds this package to the profile's `dsh.profile.bundles`.

## Usage

Start DeepSeek Harness normally:

```bash
dsh web
```

The plugin creates or refreshes:

```
C:\Users\<you>\Desktop\DeepSeek Harness.lnk
```

Double-click the shortcut to launch `dsh web` and automatically open the browser at `http://127.0.0.1:3080`. By default, **closing that Harness browser window also stops the service**.

## Configuration

Default configuration lives in `cordis.patch.yml`:

```yaml
- id: desktop-shortcut
  name: dsh-desktop-shortcut
  config:
    shortcutName: DeepSeek Harness
    dshArgs: web
```

You can override it in your own profile `cordis.patch.yml` by targeting `id: desktop-shortcut`:

```yaml
- id: desktop-shortcut
  config:
    shortcutName: My Harness
    dshArgs: web --port 4000
    port: 4000
    workingDirectory: C:\Users\me
```

If you change the port in `dshArgs`, set `port` to match. You can also use `url` to specify the full address:

```yaml
- id: desktop-shortcut
  config:
    url: http://127.0.0.1:4000
```

If you do not want closing the window to stop the service, disable the mode:

```yaml
- id: desktop-shortcut
  config:
    closeBrowserStopsService: false
```

## Custom Icon

You can use your own icon instead of the default one.

### Option 1: Change the shortcut icon manually (temporary)

Right-click the **DeepSeek Harness** desktop shortcut → **Properties** → **Change Icon** → pick your `.ico` file.

> Note: the next time `dsh web` starts, the plugin may refresh the shortcut and restore the default icon.

### Option 2: Set a persistent icon through plugin config (recommended)

Edit your profile patch:

`C:\Users\<you>\.dsh\profiles\web\cordis.patch.yml`

```yaml
- id: desktop-shortcut
  config:
    icon: C:\Users\<you>\Pictures\my-icon.ico
```

You can also use a path relative to the plugin package root:

```yaml
- id: desktop-shortcut
  config:
    icon: assets/MyIcon.ico
```

Then restart `dsh web` once; the plugin will refresh the shortcut with your icon.

### Option 3: Change the default icon for everyone

Replace `assets/DeepSeek Harness.ico` in this repository and push the change. New users who install the plugin will get the new default icon.

> Tip: Use a multi-size `.ico` (256 / 128 / 64 / 48 / 32 / 16) for the best result on the desktop, taskbar, and small views.

## Uninstall

```bash
dsh plugin --profile web remove dsh-desktop-shortcut
```

Uninstalling does not delete the already-created desktop shortcut; remove it manually if needed.

## Project Structure

```text
dsh-desktop-shortcut/
├─ assets/
│  ├─ DeepSeek Harness.ico
│  └─ DeepSeek Harness.png
├─ lib/
│  └─ index.js          # Cordis plugin entry
├─ scripts/
│  └─ build-icon.ps1    # Optional icon rebuild script
├─ cordis.patch.yml     # dsh bundle patch
├─ package.json
├─ README.md            # English (default)
└─ README.zh-CN.md      # 中文
```

## License

MIT
