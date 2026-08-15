# dsh-desktop-shortcut

> [English](README.md) | **中文**

![DeepSeek Harness Icon](assets/DeepSeek%20Harness.png?raw=true)

## 关于本项目

DeepSeek Harness 是一个可组合的 AI agent 运行框架。每次启动 `dsh web` 都要手动敲命令、找路径，多少有点麻烦。

这个插件解决的就是这件事：

- 安装后，`dsh web` 每次启动时自动在 Windows 桌面创建/刷新 **DeepSeek Harness** 快捷方式
- 图标使用 DeepSeek 品牌风格的多尺寸 `.ico`
- 只依赖 Node 内置模块和 PowerShell，轻量、无第三方运行时依赖
- 其他平台自动跳过，不影响非 Windows 用户

## 特性

- 安装后，每次启动 `dsh web` 都会自动确保桌面快捷方式存在
- 双击快捷方式会自动启动 `dsh web`，并在 Web UI 就绪后自动打开浏览器
- 默认使用 Edge/Chrome 应用窗口模式，**关闭 Harness 窗口会自动停止服务**
- 使用 DeepSeek 风格图标（`.ico`，包含 256/128/64/48/32/16 多尺寸）
- 快捷方式指向 `cmd.exe /c "dsh.cmd" web`
- 仅 Windows 生效，其他平台自动跳过
- 无第三方运行时依赖，只使用 Node 内置模块和 PowerShell

## 安装

需要先安装 [pnpm](https://pnpm.io/)，然后在你自己的 DeepSeek Harness 环境中执行：

### 从 GitHub 安装

```bash
dsh plugin --profile web add github:fuyue521/dsh-desktop-shortcut
```

### 从本地目录安装

```bash
cd dsh-desktop-shortcut
dsh plugin --profile web add .
```

`dsh plugin` 会自动识别包里的 `dsh.bundle` 声明，并把它加入该 profile 的 `dsh.profile.bundles`。

## 使用

安装后正常启动：

```bash
dsh web
```

插件会在启动时自动创建或刷新：

```
C:\Users\<你>\Desktop\DeepSeek Harness.lnk
```

双击快捷方式会启动 `dsh web`，并自动打开浏览器访问 `http://127.0.0.1:3080`。默认情况下，**关闭这个 Harness 浏览器窗口，服务也会自动停止**。

## 配置

默认配置在 `cordis.patch.yml` 中：

```yaml
- id: desktop-shortcut
  name: dsh-desktop-shortcut
  config:
    shortcutName: DeepSeek Harness
    dshArgs: web
```

可在自己的 profile `cordis.patch.yml` 里按 `id: desktop-shortcut` 覆盖：

```yaml
- id: desktop-shortcut
  config:
    shortcutName: My Harness
    dshArgs: web --port 4000
    port: 4000
    workingDirectory: C:\Users\me
```

如果改了 `dshArgs` 里的端口，记得同步设置 `port`；也可以直接用 `url` 指定完整地址：

```yaml
- id: desktop-shortcut
  config:
    url: http://127.0.0.1:4000
```

如果你不想“关窗口即停服务”，可以关闭该模式：

```yaml
- id: desktop-shortcut
  config:
    closeBrowserStopsService: false
```

`icon` 配置项也支持：填相对于插件包根目录的路径，或绝对路径。

## 卸载

```bash
dsh plugin --profile web remove dsh-desktop-shortcut
```

卸载不会自动删除已创建的桌面快捷方式，可手动删除。

## 目录结构

```text
dsh-desktop-shortcut/
├─ assets/
│  ├─ DeepSeek Harness.ico
│  └─ DeepSeek Harness.png
├─ lib/
│  └─ index.js          # Cordis 插件本体
├─ scripts/
│  └─ build-icon.ps1    # 图标生成/重建脚本（可选）
├─ cordis.patch.yml     # dsh bundle patch
├─ package.json
├─ README.md            # English（默认）
└─ README.zh-CN.md      # 中文
```

## License

MIT
