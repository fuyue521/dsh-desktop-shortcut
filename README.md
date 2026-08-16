# dsh-desktop-shortcut

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

> **English** | [中文](README.zh-CN.md)

> One-click Windows desktop shortcut for the DeepSeek Harness (DSH) web UI.

## ✨ About

DeepSeek Harness (dsh web) has no official desktop entry.  
This tool creates a Windows desktop shortcut so you can open DSH Web directly by double-clicking, without typing commands or copying URLs.

It also adds a draggable floating refresh button to the Web UI for a smoother daily experience.

## 🖼️ Icon Showcase

![DeepSeek Harness Icon](assets/DeepSeek%20Harness.png?raw=true)

## 🚀 Usage

1. Install the plugin
2. Start `dsh web`
3. A **DeepSeek Harness** shortcut is created on the desktop automatically
4. Double-click the icon to open DSH Web

### Install pnpm

```bash
npm install -g pnpm
```

### From npm (recommended)

```bash
dsh plugin --profile web add dsh-desktop-shortcut
```

### From GitHub

```bash
dsh plugin --profile web add github:fuyue521/dsh-desktop-shortcut
```

Then start:

```bash
dsh web
```

## 📋 Features

- ✅ One-click Windows desktop shortcut
- ✅ Double-click the shortcut to start `dsh web` and open the browser
- ✅ Draggable floating refresh button in the Web UI
- ✅ Refresh button shows a spinning animation and green "Refresh success" feedback
- ✅ When AI is replying, shows red "AI is replying" and disables refresh
- ✅ Configurable browser: `auto` / `edge` / `chrome`
- ✅ Custom shortcut name, icon, and launch arguments

## ⚠️ Prerequisites

- Windows
- DeepSeek Harness (dsh web) is already running locally
- Node.js / pnpm / dsh CLI installed

## 📝 FAQ

**Q: Double-clicking the shortcut does not open the page?**  
A: Make sure `dsh web` is running and the URL is correct (default `http://127.0.0.1:3080`).

**Q: The refresh button does not work?**  
A: If AI is replying, the button shows red "AI is replying" and refresh is disabled. Wait until the reply finishes.

**Q: I want to use Chrome instead of Edge?**  
A: Configure it in `cordis.patch.yml`:

```yaml
- id: desktop-shortcut
  config:
    browser: chrome
```

**Q: The service does not stop after closing the Harness browser window?**  
A: Make sure you are using the latest version; if there is still a delay, close the command-line window manually.

## 📄 License

MIT
