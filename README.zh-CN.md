# dsh-desktop-shortcut

[![Awesome DSH Plugin](https://awesome-dsh-plugin.com/badge.svg)](https://awesome-dsh-plugin.com)

> [English](README.md) | **中文**

> 一键为 DeepSeek-Harness（DSH）网页版生成 Windows 桌面快捷方式工具

## ✨ 项目介绍

DeepSeek-Harness（dsh web）网页版没有官方桌面入口。  
本工具可以快速生成 Windows 桌面快捷方式，双击直接打开 DSH Web，免去复制粘贴网址的麻烦。

同时还会在 Web UI 中加入一个可拖动的悬浮刷新按钮，让日常使用更顺手。

## 🖼️ 图标展示

![DeepSeek Harness Icon](assets/DeepSeek%20Harness.png?raw=true)

## 🚀 使用方法

1. 安装插件
2. 启动 `dsh web`
3. 桌面自动生成 **DeepSeek Harness** 快捷方式
4. 双击图标直接打开 DSH Web

### 安装 pnpm

```bash
npm install -g pnpm
```

### 从 npm 安装（推荐）

```bash
dsh plugin --profile web add dsh-desktop-shortcut
```

### 从 GitHub 安装

```bash
dsh plugin --profile web add github:fuyue521/dsh-desktop-shortcut
```

安装后启动：

```bash
dsh web
```

## 📋 功能

- ✅ 一键生成 Windows 桌面快捷方式
- ✅ 双击快捷方式自动启动 `dsh web` 并打开浏览器
- ✅ Web UI 悬浮可拖动刷新按钮
- ✅ 点击刷新按钮有旋转动画 + 绿色“刷新成功”反馈
- ✅ AI 正在回复时自动显示红色“AI正在回复中”并禁止刷新
- ✅ 可配置浏览器：`auto` / `edge` / `chrome`
- ✅ 支持自定义快捷方式名称、图标、启动参数

## ⚠️ 前置条件

- Windows 系统
- 本地已经成功运行 DeepSeek Harness（dsh web）
- 已安装 Node.js / pnpm / dsh CLI

## 📝 常见问题

**Q：双击快捷方式打不开网页？**  
A：确认 `dsh web` 服务已经启动，访问地址正确（默认 `http://127.0.0.1:3080`）。

**Q：点击刷新按钮没有反应？**  
A：如果 AI 正在回复，按钮会显示红色“AI正在回复中”并禁用刷新，请等待回复结束。

**Q：我想用 Chrome 打开，不用 Edge？**  
A：在 profile 的 `cordis.patch.yml` 中配置：

```yaml
- id: desktop-shortcut
  config:
    browser: chrome
```

**Q：关闭 Harness 浏览器窗口后服务没有停止？**  
A：请确认使用的是最新版本；如果仍有延迟，可以手动关闭命令行窗口。

## 📄 License

MIT
